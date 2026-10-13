const prisma = require('../config/prisma');
const { getDailyStockTotals } = require('../services/inventory.service');
const { generateClosingReportPdf } = require('../utils/closingPdf.util');
const { generateClosingHistoryExcel } = require('../utils/closingExcel.util');

const SHOP_METADATA = {
  'SHOP1': { code: 'SHOP1', name: 'Shop 1 — Central Wine Lounge' },
  'SHOP2': { code: 'SHOP2', name: 'Shop 2 — Premium Spirits & Wine' },
  'SHOP3': { code: 'SHOP3', name: 'Shop 3 — Highway Wine Mart' },
};

// Helper to escape CSV cell value and prevent spreadsheet formula injection
const escapeCSV = (val) => {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Formula injection prevention: if string begins with =, +, -, @, \t, \r, prepend single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
};

// GET /api/sales/export/csv?fromDate=...&toDate=...
const exportClosingHistoryCSV = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { fromDate, toDate } = req.query;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const where = { shopId };
    if (fromDate && toDate) {
      where.businessDate = {
        gte: new Date(`${fromDate}T00:00:00.000Z`),
        lte: new Date(`${toDate}T00:00:00.000Z`)
      };
    }

    const records = await prisma.dailyClosing.findMany({
      where,
      orderBy: { businessDate: 'desc' }
    });

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    const headers = [
      'Shop',
      'Business Date',
      'Closing Status',
      'Total Bottles Sold',
      'Total Bottles Remaining',
      'Total Business (INR)',
      'Online Collection (INR)',
      'Offline Collection (INR)',
      'Total Collected (INR)',
      'Total Expenses (INR)',
      'Collection Difference (INR)',
      'Final Amount (INR)',
      'Extra Amount (Informational)',
      'Closed By',
      'Closing Timestamp'
    ];

    const rows = records.map(r => [
      escapeCSV(shopMeta.code),
      escapeCSV(new Date(r.businessDate).toISOString().slice(0, 10)),
      escapeCSV(r.status),
      escapeCSV(r.totalBottlesSold),
      escapeCSV(r.totalBottlesRemaining),
      escapeCSV(parseFloat(r.totalBusiness).toFixed(2)),
      escapeCSV(parseFloat(r.onlineCollection).toFixed(2)),
      escapeCSV(parseFloat(r.offlineCollection).toFixed(2)),
      escapeCSV(parseFloat(r.totalCollected).toFixed(2)),
      escapeCSV(parseFloat(r.totalExpenses).toFixed(2)),
      escapeCSV(parseFloat(r.collectionDifference).toFixed(2)),
      escapeCSV(parseFloat(r.finalAmount).toFixed(2)),
      escapeCSV(parseFloat(r.extraAmountInformational).toFixed(2)),
      escapeCSV(r.closedBy),
      escapeCSV(new Date(r.closedAt).toLocaleString())
    ]);

    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const filenameRange = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'all';
    res.setHeader('Content-Disposition', `attachment; filename="closing_history_${shopMeta.code}_${filenameRange}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

// GET /api/sales/export/closing/pdf?date=YYYY-MM-DD
const exportClosingPdf = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const dateParam = req.query.date || new Date().toISOString().slice(0, 10);

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const targetDate = new Date(`${dateParam}T00:00:00.000Z`);

    // 1. Fetch closing record for this shop & businessDate
    const closing = await prisma.dailyClosing.findUnique({
      where: {
        shopId_businessDate: {
          shopId,
          businessDate: targetDate
        }
      }
    });

    // 2. Fetch itemized expenses
    const expenses = await prisma.expense.findMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      orderBy: { createdAt: 'asc' }
    });

    // 3. Fetch itemized stock records from Inventory Service
    const stockTotals = await getDailyStockTotals(shopId, dateParam);
    const stockRecords = stockTotals?.records || [];

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="daily_closing_${shopMeta.code}_${dateParam}.pdf"`
    );

    generateClosingReportPdf({
      shopName: shopMeta.name,
      shopCode: shopMeta.code,
      businessDate: dateParam,
      closing,
      stockRecords,
      expenses
    }, res);
  } catch (error) {
    next(error);
  }
};

// GET /api/sales/export/expenses/csv?date=YYYY-MM-DD
const exportExpensesCSV = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { date, fromDate, toDate } = req.query;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const where = { shopId };
    if (date) {
      where.businessDate = new Date(`${date}T00:00:00.000Z`);
    } else if (fromDate && toDate) {
      where.businessDate = {
        gte: new Date(`${fromDate}T00:00:00.000Z`),
        lte: new Date(`${toDate}T00:00:00.000Z`)
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'asc' }]
    });

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    const headers = [
      'Shop',
      'Business Date',
      'Category',
      'Description',
      'Payment Method',
      'Recipient',
      'Amount (INR)',
      'Created By',
      'Created At'
    ];

    const rows = expenses.map(e => [
      escapeCSV(shopMeta.code),
      escapeCSV(new Date(e.businessDate).toISOString().slice(0, 10)),
      escapeCSV(e.category),
      escapeCSV(e.description),
      escapeCSV(e.paymentMethod),
      escapeCSV(e.recipient || '-'),
      escapeCSV(parseFloat(e.amount).toFixed(2)),
      escapeCSV(e.createdBy),
      escapeCSV(new Date(e.createdAt).toLocaleString())
    ]);

    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const fileSuffix = date || (fromDate && toDate ? `${fromDate}_to_${toDate}` : 'all');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${shopMeta.code}_${fileSuffix}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

// GET /api/sales/export/excel?fromDate=...&toDate=...
const exportClosingHistoryExcel = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { fromDate, toDate } = req.query;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const where = { shopId };
    if (fromDate && toDate) {
      where.businessDate = {
        gte: new Date(`${fromDate}T00:00:00.000Z`),
        lte: new Date(`${toDate}T00:00:00.000Z`)
      };
    }

    const [records, expenses] = await Promise.all([
      prisma.dailyClosing.findMany({
        where,
        orderBy: { businessDate: 'desc' }
      }),
      prisma.expense.findMany({
        where,
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'asc' }]
      })
    ]);

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    const dateRangeLabel = fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Dates';
    const filenameRange = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'all';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="closing_history_${shopMeta.code}_${filenameRange}.xlsx"`);

    await generateClosingHistoryExcel({
      shopName: shopMeta.name,
      shopCode: shopMeta.code,
      dateRangeLabel,
      records,
      expenses
    }, res);
  } catch (error) {
    next(error);
  }
};

// GET /api/sales/export/closing/excel?date=YYYY-MM-DD
const exportClosingExcel = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const dateParam = req.query.date || new Date().toISOString().slice(0, 10);

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const targetDate = new Date(`${dateParam}T00:00:00.000Z`);

    const [closing, expenses, stockTotals] = await Promise.all([
      prisma.dailyClosing.findUnique({
        where: {
          shopId_businessDate: {
            shopId,
            businessDate: targetDate
          }
        }
      }),
      prisma.expense.findMany({
        where: {
          shopId,
          businessDate: targetDate
        },
        orderBy: { createdAt: 'asc' }
      }),
      getDailyStockTotals(shopId, dateParam)
    ]);

    const stockRecords = stockTotals?.records || [];

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="daily_closing_${shopMeta.code}_${dateParam}.xlsx"`);

    await generateClosingHistoryExcel({
      shopName: shopMeta.name,
      shopCode: shopMeta.code,
      dateRangeLabel: dateParam,
      records: closing ? [closing] : [],
      expenses,
      stockRecords
    }, res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  escapeCSV,
  exportClosingHistoryCSV,
  exportClosingPdf,
  exportExpensesCSV,
  exportClosingHistoryExcel,
  exportClosingExcel
};
