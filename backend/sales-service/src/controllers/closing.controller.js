const prisma = require('../config/prisma');
const { lockDailyStock, unlockDailyStock, getDailyStockTotals } = require('../services/inventory.service');

// GET /api/sales/closing/status?date=YYYY-MM-DD
const getClosingStatus = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { date } = req.query;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);

    const closing = await prisma.dailyClosing.findUnique({
      where: {
        shopId_businessDate: {
          shopId,
          businessDate: targetDate
        }
      }
    });

    const expenses = await prisma.expense.findMany({
      where: {
        shopId,
        businessDate: targetDate
      }
    });
    const totalExpenses = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

    return res.status(200).json({
      success: true,
      message: 'Closing status retrieved',
      data: {
        isClosed: !!closing && closing.status === 'CLOSED',
        closing,
        totalExpenses: totalExpenses.toFixed(2),
        expenseCount: expenses.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/sales/closing
// Execute daily business closing with authoritative formula verification
const executeClosing = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const {
      businessDate,
      totalBusiness,
      totalBottlesSold,
      totalBottlesRemaining,
      onlineCollection,
      offlineCollection,
      extraAmountInformational,
      notes
    } = req.body;
    const closedBy = req.headers['x-user-email'] || req.headers['x-user-id'] || 'Admin';

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    if (!businessDate) {
      return res.status(400).json({
        success: false,
        message: 'businessDate is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const targetDate = new Date(`${businessDate}T00:00:00.000Z`);

    // 0. Authoritative Stock Validation & Calculation
    let businessAmount = Math.max(0, parseFloat(totalBusiness) || 0);
    let bottlesSold = parseInt(totalBottlesSold, 10) || 0;
    let bottlesRemaining = parseInt(totalBottlesRemaining, 10) || 0;

    const stockInfo = await getDailyStockTotals(shopId, businessDate);
    if (stockInfo && stockInfo.records) {
      if (stockInfo.records.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot close business: Daily stock sheet records have not been entered for this date.',
          error: 'STOCK_SHEET_MISSING'
        });
      }

      const hasDraft = stockInfo.records.some(r => r.status === 'DRAFT');
      if (hasDraft) {
        return res.status(400).json({
          success: false,
          message: 'Cannot close business: Daily stock entries are still marked as DRAFT. Please complete physical closing counts on the Daily Stock Sheet first.',
          error: 'STOCK_SHEET_DRAFT'
        });
      }

      // Authoritative overwrite from verified backend stock records
      businessAmount = stockInfo.totalBusiness;
      bottlesSold = stockInfo.totalBottlesSold;
      bottlesRemaining = stockInfo.totalBottlesRemaining;
    }

    // 1. Authoritative Total Expenses Calculation from Saved Database Records
    const expenses = await prisma.expense.findMany({
      where: {
        shopId,
        businessDate: targetDate
      }
    });
    const calculatedExpenses = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

    // 2. Authoritative Collections and Totals
    const online = Math.max(0, parseFloat(onlineCollection) || 0);
    const offline = Math.max(0, parseFloat(offlineCollection) || 0);
    const totalCollected = online + offline;

    const finalAmount = totalCollected - calculatedExpenses;
    const collectionDifference = totalCollected - businessAmount;
    const extraAmount = Math.max(0, parseFloat(extraAmountInformational) || 0);

    // 3. Upsert closing record atomically
    const closingRecord = await prisma.dailyClosing.upsert({
      where: {
        shopId_businessDate: {
          shopId,
          businessDate: targetDate
        }
      },
      update: {
        totalBusiness: businessAmount,
        totalBottlesSold: bottlesSold,
        totalBottlesRemaining: bottlesRemaining,
        onlineCollection: online,
        offlineCollection: offline,
        totalCollected,
        totalExpenses: calculatedExpenses,
        finalAmount,
        collectionDifference,
        extraAmountInformational: extraAmount,
        status: 'CLOSED',
        closedBy,
        closedAt: new Date(),
        notes: notes ? notes.trim() : null
      },
      create: {
        shopId,
        businessDate: targetDate,
        totalBusiness: businessAmount,
        totalBottlesSold: bottlesSold,
        totalBottlesRemaining: bottlesRemaining,
        onlineCollection: online,
        offlineCollection: offline,
        totalCollected,
        totalExpenses: calculatedExpenses,
        finalAmount,
        collectionDifference,
        extraAmountInformational: extraAmount,
        status: 'CLOSED',
        closedBy,
        closedAt: new Date(),
        notes: notes ? notes.trim() : null
      }
    });

    // Lock corresponding inventory daily stock records
    await lockDailyStock(shopId, businessDate);

    return res.status(200).json({
      success: true,
      message: 'Daily business closed successfully',
      data: {
        closing: closingRecord,
        summary: {
          totalBusiness: businessAmount.toFixed(2),
          onlineCollection: online.toFixed(2),
          offlineCollection: offline.toFixed(2),
          totalCollected: totalCollected.toFixed(2),
          totalExpenses: calculatedExpenses.toFixed(2),
          finalAmount: finalAmount.toFixed(2),
          collectionDifference: collectionDifference.toFixed(2),
          extraAmountInformational: extraAmount.toFixed(2)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/sales/closing/reopen
// Authorized reopening/correction of a closed business day
const reopenClosing = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const { businessDate, reason } = req.body;
    const reopenedBy = req.headers['x-user-email'] || req.headers['x-user-id'] || 'Admin';

    if (!shopId || !businessDate) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID and businessDate are required',
        error: 'VALIDATION_ERROR'
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A specific reason is required for reopening a closed business day',
        error: 'REOPEN_REASON_REQUIRED'
      });
    }

    const targetDate = new Date(`${businessDate}T00:00:00.000Z`);

    const existingClosing = await prisma.dailyClosing.findUnique({
      where: {
        shopId_businessDate: {
          shopId,
          businessDate: targetDate
        }
      }
    });

    if (!existingClosing) {
      return res.status(404).json({
        success: false,
        message: 'No closing record found for this business date',
        error: 'CLOSING_NOT_FOUND'
      });
    }

    const auditEntry = `\n[REOPENED ${new Date().toISOString()} by ${reopenedBy}: ${reason.trim()}]`;
    const updatedNotes = existingClosing.notes ? `${existingClosing.notes}${auditEntry}` : auditEntry.trim();

    const updatedClosing = await prisma.dailyClosing.update({
      where: {
        shopId_businessDate: {
          shopId,
          businessDate: targetDate
        }
      },
      data: {
        status: 'REOPENED',
        notes: updatedNotes
      }
    });

    // Unlock inventory stock sheet
    await unlockDailyStock(shopId, businessDate);

    return res.status(200).json({
      success: true,
      message: 'Business day reopened successfully for authorized adjustments',
      data: {
        closing: updatedClosing
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/sales/closing/history
// List historical daily closing summaries for active shop with date filters
const getClosingHistory = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { fromDate, toDate } = req.query;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const where = { shopId };
    if (fromDate && toDate) {
      where.businessDate = {
        gte: new Date(`${fromDate}T00:00:00.000Z`),
        lte: new Date(`${toDate}T00:00:00.000Z`)
      };
    } else if (fromDate) {
      where.businessDate = { gte: new Date(`${fromDate}T00:00:00.000Z`) };
    }

    const history = await prisma.dailyClosing.findMany({
      where,
      orderBy: { businessDate: 'desc' }
    });

    return res.status(200).json({
      success: true,
      message: 'Closing history retrieved successfully',
      data: { history }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getClosingStatus,
  executeClosing,
  reopenClosing,
  getClosingHistory
};
