const prisma = require('../config/prisma');
const { generateDailyStockPdf } = require('../utils/dailyStockPdf.util');
const { generateDailyStockCsv } = require('../utils/dailyStockCsv.util');
const { generateDailyStockExcel } = require('../utils/dailyStockExcel.util');

const SHOP_METADATA = {
  'SHOP1': { code: 'SHOP1', name: 'Shop 1 — Central Wine Lounge' },
  'SHOP2': { code: 'SHOP2', name: 'Shop 2 — Premium Spirits & Wine' },
  'SHOP3': { code: 'SHOP3', name: 'Shop 3 — Highway Wine Mart' },
};

// Helper to format Date to YYYY-MM-DD string without time zone shifts
const formatDateString = (d) => {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
};

// GET /api/inventory/daily-stock?date=YYYY-MM-DD
// Loads daily stock table for active shop, auto carrying forward yesterday's closing to today's opening
const getDailyStockSheet = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const dateParam = req.query.date || formatDateString(new Date());

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const targetDate = new Date(`${dateParam}T00:00:00.000Z`);

    // 1. Check if records already exist for this shop & date
    let records = await prisma.dailyStockRecord.findMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      include: {
        brand: true,
        size: true
      },
      orderBy: [
        { brand: { serialNo: 'asc' } },
        { size: { volumeMl: 'desc' } }
      ]
    });

    if (records.length > 0) {
      const isLocked = records.some(r => r.status === 'LOCKED');

      // If sheet is unlocked, dynamically merge any missing active brands/sizes that have configured rates
      if (!isLocked) {
        const [activeBrands, activeSizes, activeRates] = await Promise.all([
          prisma.brand.findMany({
            where: { isActive: true },
            orderBy: { serialNo: 'asc' }
          }),
          prisma.size.findMany({
            where: { isActive: true },
            orderBy: { volumeMl: 'desc' }
          }),
          prisma.brandSizeRate.findMany({
            where: {
              isActive: true,
              OR: [{ shopId }, { shopId: null }]
            }
          })
        ]);

        const rateMap = {};
        for (const r of activeRates) {
          const key = `${r.brandId}_${r.sizeId}`;
          if (!rateMap[key] || r.shopId === shopId) {
            rateMap[key] = parseFloat(r.rate);
          }
        }

        const existingKeySet = new Set(records.map(r => `${r.brandId}_${r.sizeId}`));

        // Identify missing items that are configured for this brand
        const missingItems = [];
        for (const brand of activeBrands) {
          const brandConfigured = Object.keys(rateMap).some(k => k.startsWith(`${brand.id}_`));
          for (const size of activeSizes) {
            const key = `${brand.id}_${size.id}`;
            if (!existingKeySet.has(key)) {
              if (rateMap[key] !== undefined || !brandConfigured) {
                missingItems.push({
                  brand,
                  size,
                  rate: rateMap[key] !== undefined ? rateMap[key] : 0
                });
              }
            }
          }
        }

        if (missingItems.length > 0) {
          const previousRecordDay = await prisma.dailyStockRecord.findFirst({
            where: {
              shopId,
              businessDate: { lt: targetDate }
            },
            orderBy: { businessDate: 'desc' },
            select: { businessDate: true }
          });

          let prevClosingMap = {};
          if (previousRecordDay) {
            const prevRecords = await prisma.dailyStockRecord.findMany({
              where: {
                shopId,
                businessDate: previousRecordDay.businessDate
              }
            });
            for (const pr of prevRecords) {
              prevClosingMap[`${pr.brandId}_${pr.sizeId}`] = pr.closingStock;
            }
          }

          for (const item of missingItems) {
            const key = `${item.brand.id}_${item.size.id}`;
            const hasPrev = prevClosingMap[key] !== undefined;
            const opening = hasPrev ? prevClosingMap[key] : 0;
            const rate = item.rate;

            records.push({
              id: `temp-${key}`,
              shopId,
              businessDate: targetDate,
              brandId: item.brand.id,
              sizeId: item.size.id,
              brand: item.brand,
              size: item.size,
              openingStock: opening,
              indentStock: 0,
              totalStock: opening,
              closingStock: '',
              saleCount: 0,
              bottleRate: rate,
              stockValue: opening * rate,
              saleAmount: 0,
              extraAmount: 0,
              status: 'DRAFT',
              notes: '',
              isInitialOpening: !hasPrev
            });
          }

          records.sort((a, b) => {
            const sA = a.brand?.serialNo || 999999;
            const sB = b.brand?.serialNo || 999999;
            if (sA !== sB) return sA - sB;
            return (b.size?.volumeMl || 0) - (a.size?.volumeMl || 0);
          });
        }
      }

      // Enrich records with calculated stockValue
      const enrichedRecords = records.map(r => {
        const opening = parseInt(r.openingStock, 10) || 0;
        const indent = parseInt(r.indentStock, 10) || 0;
        const total = parseInt(r.totalStock, 10) || (opening + indent);
        const closing = parseInt(r.closingStock, 10) || 0;
        const sale = parseInt(r.saleCount, 10) || 0;
        const rate = parseFloat(r.bottleRate) || 0;
        const stockValue = total * rate;
        const saleAmount = parseFloat(r.saleAmount) || (sale * rate);
        return {
          ...r,
          totalStock: total,
          stockValue,
          closingStockValue: closing * rate,
          saleAmount
        };
      });

      const totalOpening = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.openingStock, 10) || 0), 0);
      const totalIndent = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.indentStock, 10) || 0), 0);
      const totalAvailable = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.totalStock, 10) || 0), 0);
      const totalClosing = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.closingStock, 10) || 0), 0);
      const totalSold = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.saleCount, 10) || 0), 0);
      const totalStockValue = enrichedRecords.reduce((acc, r) => acc + (r.stockValue || 0), 0);
      const totalBusiness = enrichedRecords.reduce((acc, r) => acc + (parseFloat(r.saleAmount) || 0), 0);
      const totalExtraAmount = enrichedRecords.reduce((acc, r) => acc + (parseFloat(r.extraAmount) || 0), 0);

      return res.status(200).json({
        success: true,
        message: 'Daily stock sheet retrieved',
        data: {
          businessDate: dateParam,
          shopId,
          isNewDay: false,
          isLocked,
          isCompleted: enrichedRecords.every(r => r.status === 'COMPLETED'),
          summary: {
            totalOpening,
            totalIndent,
            totalAvailable,
            totalClosing,
            totalSold,
            totalStockValue: totalStockValue.toFixed(2),
            totalBusiness: totalBusiness.toFixed(2),
            totalExtraAmount: totalExtraAmount.toFixed(2)
          },
          records: enrichedRecords
        }
      });
    }

    // 2. If new day, load all active brands and sizes
    const [brands, sizes, rates] = await Promise.all([
      prisma.brand.findMany({
        where: { isActive: true },
        orderBy: { serialNo: 'asc' }
      }),
      prisma.size.findMany({
        where: { isActive: true },
        orderBy: { volumeMl: 'desc' }
      }),
      prisma.brandSizeRate.findMany({
        where: {
          isActive: true,
          OR: [{ shopId }, { shopId: null }]
        }
      })
    ]);

    // Rate lookup map: "brandId_sizeId" -> rate
    const rateMap = {};
    for (const r of rates) {
      const key = `${r.brandId}_${r.sizeId}`;
      // Prefer shop-specific rate over global fallback
      if (!rateMap[key] || r.shopId === shopId) {
        rateMap[key] = parseFloat(r.rate);
      }
    }

    // 3. Find previous business day's records for auto carry-forward (strictly scoped to this shopId)
    const previousRecordDay = await prisma.dailyStockRecord.findFirst({
      where: {
        shopId,
        businessDate: { lt: targetDate }
      },
      orderBy: { businessDate: 'desc' },
      select: { businessDate: true }
    });

    let previousClosingMap = {};
    let isInitialSetup = !previousRecordDay;
    let hasDateGap = false;
    let gapWarning = null;

    if (previousRecordDay) {
      const prevDateStr = formatDateString(previousRecordDay.businessDate);
      const prevRecords = await prisma.dailyStockRecord.findMany({
        where: {
          shopId,
          businessDate: previousRecordDay.businessDate
        }
      });

      for (const pr of prevRecords) {
        previousClosingMap[`${pr.brandId}_${pr.sizeId}`] = pr.closingStock;
      }

      // Check if there is a date gap (> 1 day prior)
      const prevTime = new Date(`${prevDateStr}T00:00:00.000Z`).getTime();
      const currTime = targetDate.getTime();
      const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        hasDateGap = true;
        gapWarning = `Notice: Previous recorded business day was ${diffDays} days ago (${prevDateStr}). Please verify opening quantities.`;
      }
    }

    // 4. Construct sheet items
    const generatedItems = [];
    for (const brand of brands) {
      const brandConfigured = Object.keys(rateMap).some(k => k.startsWith(`${brand.id}_`));
      for (const size of sizes) {
        const key = `${brand.id}_${size.id}`;
        const hasPrevVal = previousClosingMap[key] !== undefined;

        // Include size if brand has configured rate, prior closing, or no rates configured at all
        if (rateMap[key] !== undefined || hasPrevVal || !brandConfigured) {
          const opening = hasPrevVal ? previousClosingMap[key] : 0;
          const rate = rateMap[key] !== undefined ? rateMap[key] : 0;
          const stockValue = opening * rate;

          generatedItems.push({
            id: `temp-${key}`,
            shopId,
            businessDate: targetDate,
            brandId: brand.id,
            sizeId: size.id,
            brand,
            size,
            openingStock: opening,
            indentStock: 0,
            totalStock: opening,
            stockValue,
            closingStockValue: 0,
            // Unentered closing on new day is empty string to clearly distinguish incomplete records
            closingStock: '',
            saleCount: 0,
            bottleRate: rate,
            saleAmount: 0,
            extraAmount: 0,
            status: 'DRAFT',
            notes: '',
            isInitialOpening: isInitialSetup || !hasPrevVal
          });
        }
      }
    }

    const totalOpening = generatedItems.reduce((acc, r) => acc + (parseInt(r.openingStock, 10) || 0), 0);
    const totalStockValue = generatedItems.reduce((acc, r) => acc + (r.stockValue || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'New daily stock sheet initialized',
      data: {
        businessDate: dateParam,
        shopId,
        isNewDay: true,
        isInitialSetup,
        hasDateGap,
        gapWarning,
        previousDate: previousRecordDay ? formatDateString(previousRecordDay.businessDate) : null,
        summary: {
          totalOpening,
          totalIndent: 0,
          totalAvailable: totalOpening,
          totalClosing: 0,
          totalSold: 0,
          totalStockValue: totalStockValue.toFixed(2),
          totalBusiness: '0.00',
          totalExtraAmount: '0.00'
        },
        records: generatedItems
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/inventory/daily-stock
// Saves or updates daily stock sheet records with authoritative calculations
const saveDailyStockSheet = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const { businessDate, items, status } = req.body;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    if (!businessDate || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'businessDate and non-empty items array are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const targetDate = new Date(`${businessDate}T00:00:00.000Z`);

    // Check if records for this day are already locked after closing
    const existingLocked = await prisma.dailyStockRecord.findFirst({
      where: {
        shopId,
        businessDate: targetDate,
        status: 'LOCKED'
      }
    });

    if (existingLocked) {
      return res.status(403).json({
        success: false,
        message: 'This business date is locked following daily closing. Modifications are restricted.',
        error: 'DATE_LOCKED'
      });
    }

    // If finalizing as COMPLETED, ensure all rows have closing counts
    if (status === 'COMPLETED') {
      const incomplete = items.find(
        it => it.closingStock === '' || it.closingStock === null || it.closingStock === undefined
      );
      if (incomplete) {
        return res.status(400).json({
          success: false,
          message: 'All brand rows must have a valid physical closing count to finalize the sheet.',
          error: 'INCOMPLETE_CLOSING_ENTRY'
        });
      }
    }

    // Validate and prepare upsert records
    const upsertOperations = [];
    for (const item of items) {
      const opening = Math.max(0, parseInt(item.openingStock, 10) || 0);
      const indent = Math.max(0, parseInt(item.indentStock, 10) || 0);
      const total = opening + indent;
      const closing = Math.max(0, parseInt(item.closingStock, 10) || 0);

      if (closing > total) {
        return res.status(400).json({
          success: false,
          message: `Closing stock (${closing}) cannot exceed Total stock (${total}) for Brand ${item.brand?.name || item.brandId}`,
          error: 'INVALID_STOCK_QUANTITY'
        });
      }

      const sale = total - closing;
      const rate = Math.max(0, parseFloat(item.bottleRate) || 0);
      const saleAmount = sale * rate;
      const extraAmount = Math.max(0, parseFloat(item.extraAmount) || 0);

      const recordData = {
        shopId,
        businessDate: targetDate,
        brandId: item.brandId,
        sizeId: item.sizeId,
        openingStock: opening,
        indentStock: indent,
        totalStock: total,
        closingStock: closing,
        saleCount: sale,
        bottleRate: rate,
        saleAmount,
        extraAmount,
        status: status || 'DRAFT',
        notes: item.notes ? item.notes.trim() : null
      };

      upsertOperations.push(
        prisma.dailyStockRecord.upsert({
          where: {
            shopId_businessDate_brandId_sizeId: {
              shopId,
              businessDate: targetDate,
              brandId: item.brandId,
              sizeId: item.sizeId
            }
          },
          update: recordData,
          create: recordData
        })
      );
    }

    // Execute atomically
    const savedRecords = await prisma.$transaction(upsertOperations);

    // Compute summary for response
    const totalOpening = savedRecords.reduce((acc, r) => acc + (parseInt(r.openingStock, 10) || 0), 0);
    const totalIndent = savedRecords.reduce((acc, r) => acc + (parseInt(r.indentStock, 10) || 0), 0);
    const totalAvailable = savedRecords.reduce((acc, r) => acc + (parseInt(r.totalStock, 10) || 0), 0);
    const totalRemaining = savedRecords.reduce((acc, r) => acc + (parseInt(r.closingStock, 10) || 0), 0);
    const totalSold = savedRecords.reduce((acc, r) => acc + (parseInt(r.saleCount, 10) || 0), 0);
    const totalStockValue = savedRecords.reduce((acc, r) => acc + ((parseInt(r.totalStock, 10) || 0) * (parseFloat(r.bottleRate) || 0)), 0);
    const totalBusiness = savedRecords.reduce((acc, r) => acc + (parseFloat(r.saleAmount) || 0), 0);
    const totalExtraAmount = savedRecords.reduce((acc, r) => acc + (parseFloat(r.extraAmount) || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'Daily stock sheet saved successfully',
      data: {
        businessDate,
        shopId,
        totalRecords: savedRecords.length,
        totalOpening,
        totalIndent,
        totalAvailable,
        totalSold,
        totalRemaining,
        totalStockValue: totalStockValue.toFixed(2),
        totalBusiness: totalBusiness.toFixed(2),
        totalExtraAmount: totalExtraAmount.toFixed(2),
        summary: {
          totalOpening,
          totalIndent,
          totalAvailable,
          totalClosing: totalRemaining,
          totalSold,
          totalStockValue: totalStockValue.toFixed(2),
          totalBusiness: totalBusiness.toFixed(2),
          totalExtraAmount: totalExtraAmount.toFixed(2)
        },
        records: savedRecords
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/inventory/daily-stock/lock
// Locks daily stock sheet after daily closing
const lockDailyStockSheet = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const { businessDate } = req.body;

    if (!shopId || !businessDate) {
      return res.status(400).json({
        success: false,
        message: 'shopId and businessDate are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const targetDate = new Date(`${businessDate}T00:00:00.000Z`);
    const updateResult = await prisma.dailyStockRecord.updateMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      data: {
        status: 'LOCKED'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Daily stock records locked successfully',
      data: {
        count: updateResult.count
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/inventory/daily-stock/unlock
// Unlocks daily stock sheet upon authorized reopening
const unlockDailyStockSheet = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const { businessDate } = req.body;

    if (!shopId || !businessDate) {
      return res.status(400).json({
        success: false,
        message: 'shopId and businessDate are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const targetDate = new Date(`${businessDate}T00:00:00.000Z`);
    const updateResult = await prisma.dailyStockRecord.updateMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      data: {
        status: 'COMPLETED'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Daily stock records unlocked successfully',
      data: {
        count: updateResult.count
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/inventory/daily-stock/export/pdf?date=YYYY-MM-DD
const exportDailyStockPdf = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const dateParam = req.query.date || formatDateString(new Date());

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const targetDate = new Date(`${dateParam}T00:00:00.000Z`);

    const records = await prisma.dailyStockRecord.findMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      include: {
        brand: true,
        size: true
      },
      orderBy: [
        { brand: { serialNo: 'asc' } },
        { size: { volumeMl: 'desc' } }
      ]
    });

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    const isLocked = records.some(r => r.status === 'LOCKED');
    const isCompleted = records.length > 0 && records.every(r => r.status === 'COMPLETED' || r.status === 'LOCKED');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="daily_stock_${shopMeta.code}_${dateParam}.pdf"`
    );

    generateDailyStockPdf({
      shopName: shopMeta.name,
      shopCode: shopMeta.code,
      businessDate: dateParam,
      isCompleted,
      isLocked,
      records
    }, res);
  } catch (error) {
    next(error);
  }
};

// GET /api/inventory/daily-stock/export/csv?date=YYYY-MM-DD
const exportDailyStockCsv = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const dateParam = req.query.date || formatDateString(new Date());

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const targetDate = new Date(`${dateParam}T00:00:00.000Z`);

    const records = await prisma.dailyStockRecord.findMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      include: {
        brand: true,
        size: true
      },
      orderBy: [
        { brand: { serialNo: 'asc' } },
        { size: { volumeMl: 'desc' } }
      ]
    });

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    const csvContent = generateDailyStockCsv({
      shopCode: shopMeta.code,
      businessDate: dateParam,
      records
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="daily_stock_${shopMeta.code}_${dateParam}.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

// GET /api/inventory/daily-stock/export/excel?date=YYYY-MM-DD
const exportDailyStockExcel = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const dateParam = req.query.date || formatDateString(new Date());

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const targetDate = new Date(`${dateParam}T00:00:00.000Z`);

    const records = await prisma.dailyStockRecord.findMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      include: {
        brand: true,
        size: true
      },
      orderBy: [
        { brand: { serialNo: 'asc' } },
        { size: { volumeMl: 'desc' } }
      ]
    });

    const shopMeta = {
      code: req.query.shopCode || req.headers['x-shop-code'] || SHOP_METADATA[shopId]?.code || shopId,
      name: req.query.shopName || req.headers['x-shop-name'] || SHOP_METADATA[shopId]?.name || `Shop ${shopId}`
    };

    const isLocked = records.some(r => r.status === 'LOCKED');
    const isCompleted = records.length > 0 && records.every(r => r.status === 'COMPLETED' || r.status === 'LOCKED');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="daily_stock_${shopMeta.code}_${dateParam}.xlsx"`
    );

    await generateDailyStockExcel({
      shopName: shopMeta.name,
      shopCode: shopMeta.code,
      businessDate: dateParam,
      isCompleted,
      isLocked,
      records
    }, res);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDailyStockSheet,
  saveDailyStockSheet,
  lockDailyStockSheet,
  unlockDailyStockSheet,
  exportDailyStockPdf,
  exportDailyStockCsv,
  exportDailyStockExcel
};
