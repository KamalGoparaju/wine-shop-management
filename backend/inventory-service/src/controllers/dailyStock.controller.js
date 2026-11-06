const prisma = require('../config/prisma');
const { generateDailyStockPdf } = require('../utils/dailyStockPdf.util');
const { generateDailyStockCsv } = require('../utils/dailyStockCsv.util');
const { generateDailyStockExcel } = require('../utils/dailyStockExcel.util');
const {
  parsePaginationParams,
  buildPaginationMetadata
} = require('../utils/pagination.util');

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
              extraPerBottle: 0,
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

      // Enrich records with calculated stockValue and remainingStockValue
      const enrichedRecords = records.map(r => {
        const opening = parseInt(r.openingStock, 10) || 0;
        const indent = parseInt(r.indentStock, 10) || 0;
        const total = parseInt(r.totalStock, 10) || (opening + indent);
        const hasClosing = r.closingStock !== '' && r.closingStock !== null && r.closingStock !== undefined;
        const closing = hasClosing ? parseInt(r.closingStock, 10) || 0 : null;
        const sale = parseInt(r.saleCount, 10) || 0;
        const rate = parseFloat(r.bottleRate) || 0;
        const stockValue = total * rate;
        const saleAmount = parseFloat(r.saleAmount) || (sale * rate);
        const remainingStockValue = hasClosing ? parseFloat((closing * rate).toFixed(2)) : null;
        const extraPerBottle = Math.max(0, parseFloat(r.extraPerBottle) || 0);
        const extraAmount = extraPerBottle > 0
          ? parseFloat((sale * extraPerBottle).toFixed(2))
          : parseFloat(r.extraAmount) || 0;
        return {
          ...r,
          totalStock: total,
          stockValue,
          closingStockValue: remainingStockValue !== null ? remainingStockValue : 0,
          remainingStockValue,
          saleAmount,
          extraPerBottle,
          extraAmount
        };
      });

      const totalOpening = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.openingStock, 10) || 0), 0);
      const totalIndent = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.indentStock, 10) || 0), 0);
      const totalAvailable = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.totalStock, 10) || 0), 0);
      const totalClosing = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.closingStock, 10) || 0), 0);
      const totalSold = enrichedRecords.reduce((acc, r) => acc + (parseInt(r.saleCount, 10) || 0), 0);
      const totalStockValue = enrichedRecords.reduce((acc, r) => acc + (r.stockValue || 0), 0);
      const totalBusiness = enrichedRecords.reduce((acc, r) => acc + (parseFloat(r.saleAmount) || 0), 0);
      const totalRemainingStockValue = enrichedRecords.reduce((acc, r) => acc + (r.remainingStockValue !== null ? r.remainingStockValue : 0), 0);
      const totalExtraAmount = enrichedRecords.reduce((acc, r) => acc + (parseFloat(r.extraAmount) || 0), 0);

      const allCompleted = enrichedRecords.length > 0 && enrichedRecords.every(r => r.closingStock !== '' && r.closingStock !== null && r.closingStock !== undefined);
      const isReconciled = allCompleted && Math.abs(totalStockValue - (totalBusiness + totalRemainingStockValue)) < 0.05;
      const reconciliationStatus = allCompleted
        ? (isReconciled ? 'VERIFIED' : 'DISCREPANCY')
        : 'PENDING';

      const isExplicitlyPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.paginate === 'true';
      const pagination = parsePaginationParams(req.query);

      let filteredRecords = enrichedRecords;
      if (req.query.search && req.query.search.trim()) {
        const term = req.query.search.trim().toLowerCase();
        filteredRecords = enrichedRecords.filter(r => {
          const brandName = (r.brand?.name || '').toLowerCase();
          const brandSerial = String(r.brand?.serialNo || '');
          const sizeCode = (r.size?.code || '').toLowerCase();
          const sizeName = (r.size?.name || '').toLowerCase();
          return brandName.includes(term) || brandSerial === term || sizeCode.includes(term) || sizeName.includes(term);
        });
      }

      let pagedRecords = filteredRecords;
      if (isExplicitlyPaginated && pagination.isPaginated) {
        pagedRecords = filteredRecords.slice(pagination.skip, pagination.skip + pagination.take);
      }

      const paginationMetadata = buildPaginationMetadata(
        filteredRecords.length,
        pagination.page,
        pagination.limit
      );

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
            totalRemainingStockValue: totalRemainingStockValue.toFixed(2),
            isReconciled,
            reconciliationStatus,
            totalExtraAmount: totalExtraAmount.toFixed(2)
          },
          records: pagedRecords,
          pagination: paginationMetadata
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

        // If brand has configured rates, ONLY include its active configured sizes
        // If brand has no rates configured yet, include available sizes as fallback
        if (rateMap[key] !== undefined || !brandConfigured) {
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
            remainingStockValue: null,
            // Unentered closing on new day is empty string to clearly distinguish incomplete records
            closingStock: '',
            saleCount: 0,
            bottleRate: rate,
            saleAmount: 0,
            extraPerBottle: 0,
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

    const isExplicitlyPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.paginate === 'true';
    const pagination = parsePaginationParams(req.query);

    let filteredRecords = generatedItems;
    if (req.query.search && req.query.search.trim()) {
      const term = req.query.search.trim().toLowerCase();
      filteredRecords = generatedItems.filter(r => {
        const brandName = (r.brand?.name || '').toLowerCase();
        const brandSerial = String(r.brand?.serialNo || '');
        const sizeCode = (r.size?.code || '').toLowerCase();
        const sizeName = (r.size?.name || '').toLowerCase();
        return brandName.includes(term) || brandSerial === term || sizeCode.includes(term) || sizeName.includes(term);
      });
    }

    let pagedRecords = filteredRecords;
    if (isExplicitlyPaginated && pagination.isPaginated) {
      pagedRecords = filteredRecords.slice(pagination.skip, pagination.skip + pagination.take);
    }

    const paginationMetadata = buildPaginationMetadata(
      filteredRecords.length,
      pagination.page,
      pagination.limit
    );

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
          totalRemainingStockValue: '0.00',
          isReconciled: false,
          reconciliationStatus: 'PENDING',
          totalExtraAmount: '0.00'
        },
        records: pagedRecords,
        pagination: paginationMetadata
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

    // Check if day is brand new (no records exist yet for this shop and businessDate)
    const existingCount = await prisma.dailyStockRecord.count({
      where: { shopId, businessDate: targetDate }
    });

    // Load master validation data: active brands, active sizes, active rates, and existing records for today
    const [allActiveBrands, allActiveSizes, allActiveRates, todayExistingRecords] = await Promise.all([
      prisma.brand.findMany({ where: { isActive: true } }),
      prisma.size.findMany({ where: { isActive: true } }),
      prisma.brandSizeRate.findMany({
        where: {
          isActive: true,
          OR: [{ shopId }, { shopId: null }]
        }
      }),
      prisma.dailyStockRecord.findMany({
        where: { shopId, businessDate: targetDate },
        select: { brandId: true, sizeId: true, bottleRate: true }
      })
    ]);

    const activeBrandMap = new Map(allActiveBrands.map(b => [b.id, b]));
    const activeSizeMap = new Map(allActiveSizes.map(s => [s.id, s]));
    const activeRateMap = new Map();
    for (const r of allActiveRates) {
      const k = `${r.brandId}_${r.sizeId}`;
      if (!activeRateMap.has(k) || r.shopId === shopId) {
        activeRateMap.set(k, parseFloat(r.rate));
      }
    }
    const todayExistingSet = new Set(todayExistingRecords.map(r => `${r.brandId}_${r.sizeId}`));

    // Validate and prepare upsert records
    const upsertOperations = [];
    const submittedKeys = new Set();

    for (const item of items) {
      const brand = activeBrandMap.get(item.brandId);
      if (!brand) {
        return res.status(400).json({
          success: false,
          message: `Invalid or inactive Brand selected (ID: ${item.brandId})`,
          error: 'INVALID_BRAND'
        });
      }

      const size = activeSizeMap.get(item.sizeId);
      if (!size) {
        return res.status(400).json({
          success: false,
          message: `Invalid or inactive Size selected (ID: ${item.sizeId})`,
          error: 'INVALID_SIZE'
        });
      }

      const rateKey = `${item.brandId}_${item.sizeId}`;
      const configuredRate = activeRateMap.get(rateKey);
      const hasPriorTodayRecord = todayExistingSet.has(rateKey);

      // Strict validation: Reject unconfigured Brand + Size combinations unless preserving prior draft on this date
      if (configuredRate === undefined && !hasPriorTodayRecord) {
        return res.status(400).json({
          success: false,
          message: `Invalid Brand and Size combination: Size '${size.code}' (${size.name}) is not configured for Brand '${brand.name}'.`,
          error: 'INVALID_BRAND_SIZE_COMBINATION'
        });
      }

      const opening = Math.max(0, parseInt(item.openingStock, 10) || 0);
      const indent = Math.max(0, parseInt(item.indentStock, 10) || 0);
      const total = opening + indent;
      const closing = Math.max(0, parseInt(item.closingStock, 10) || 0);

      if (closing > total) {
        return res.status(400).json({
          success: false,
          message: `Closing stock (${closing}) cannot exceed Total stock (${total}) for Brand ${brand.name} (${size.code})`,
          error: 'INVALID_STOCK_QUANTITY'
        });
      }

      // Authoritative rate resolution
      const rate = configuredRate !== undefined
        ? configuredRate
        : Math.max(0, parseFloat(item.bottleRate) || 0);

      if (status === 'COMPLETED' && rate <= 0) {
        return res.status(400).json({
          success: false,
          message: `Selling rate is missing or zero for Brand '${brand.name}' (${size.code}). Rates must be configured before finalizing daily closing.`,
          error: 'RATE_MISSING'
        });
      }

      const sale = total - closing;
      const saleAmount = sale * rate;
      const extraPerBottle = Math.max(0, parseFloat(item.extraPerBottle) || 0);
      let extraAmount = 0;
      if (item.extraPerBottle !== undefined && item.extraPerBottle !== null) {
        extraAmount = parseFloat((sale * extraPerBottle).toFixed(2));
      } else {
        extraAmount = Math.max(0, parseFloat(item.extraAmount) || 0);
      }

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
        extraPerBottle,
        extraAmount,
        status: status || 'DRAFT',
        notes: item.notes ? item.notes.trim() : null
      };

      submittedKeys.add(`${item.brandId}_${item.sizeId}`);

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

    // If new day and not all active brands/sizes were submitted (e.g. paginated save), auto-initialize remaining
    if (existingCount === 0) {
      const [allBrands, allSizes, allRates] = await Promise.all([
        prisma.brand.findMany({ where: { isActive: true } }),
        prisma.size.findMany({ where: { isActive: true } }),
        prisma.brandSizeRate.findMany({
          where: {
            isActive: true,
            OR: [{ shopId }, { shopId: null }]
          }
        })
      ]);

      const rateMap = {};
      for (const r of allRates) {
        const k = `${r.brandId}_${r.sizeId}`;
        if (!rateMap[k] || r.shopId === shopId) {
          rateMap[k] = parseFloat(r.rate);
        }
      }

      const previousRecordDay = await prisma.dailyStockRecord.findFirst({
        where: { shopId, businessDate: { lt: targetDate } },
        orderBy: { businessDate: 'desc' }
      });

      const previousRecordsMap = new Map();
      if (previousRecordDay) {
        const prevRecords = await prisma.dailyStockRecord.findMany({
          where: { shopId, businessDate: previousRecordDay.businessDate }
        });
        prevRecords.forEach(r => {
          previousRecordsMap.set(`${r.brandId}_${r.sizeId}`, r.closingStock);
        });
      }

      for (const brand of allBrands) {
        const brandConfigured = Object.keys(rateMap).some(k => k.startsWith(`${brand.id}_`));
        for (const size of allSizes) {
          const key = `${brand.id}_${size.id}`;
          if (!submittedKeys.has(key)) {
            const prevClosing = previousRecordsMap.get(key);
            const hasPrevVal = prevClosing !== undefined;
            if (rateMap[key] !== undefined || hasPrevVal || !brandConfigured) {
              const op = hasPrevVal ? prevClosing : 0;
              const rate = rateMap[key] !== undefined ? rateMap[key] : 0;

              upsertOperations.push(
                prisma.dailyStockRecord.upsert({
                  where: {
                    shopId_businessDate_brandId_sizeId: {
                      shopId,
                      businessDate: targetDate,
                      brandId: brand.id,
                      sizeId: size.id
                    }
                  },
                  update: {},
                  create: {
                    shopId,
                    businessDate: targetDate,
                    brandId: brand.id,
                    sizeId: size.id,
                    openingStock: op,
                    indentStock: 0,
                    totalStock: op,
                    closingStock: 0,
                    saleCount: 0,
                    bottleRate: rate,
                    saleAmount: 0,
                    extraPerBottle: 0,
                    extraAmount: 0,
                    status: 'DRAFT',
                    notes: null
                  }
                })
              );
            }
          }
        }
      }
    }

    // Execute atomically
    await prisma.$transaction(upsertOperations);

    // Fetch authoritative day records across ALL brands in the shop
    const allDayRecords = await prisma.dailyStockRecord.findMany({
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
        { size: { volumeMl: 'asc' } }
      ]
    });

    // If finalizing as COMPLETED, verify all rows across the entire day in this shop have closing counts
    if (status === 'COMPLETED') {
      const anyIncomplete = allDayRecords.find(
        r => r.closingStock === '' || r.closingStock === null || r.closingStock === undefined
      );
      if (anyIncomplete) {
        return res.status(400).json({
          success: false,
          message: 'All brand rows must have a valid physical closing count to finalize the sheet.',
          error: 'INCOMPLETE_CLOSING_ENTRY'
        });
      }
    }

    // Compute authoritative shop-wide totals
    const totalOpening = allDayRecords.reduce((acc, r) => acc + (parseInt(r.openingStock, 10) || 0), 0);
    const totalIndent = allDayRecords.reduce((acc, r) => acc + (parseInt(r.indentStock, 10) || 0), 0);
    const totalAvailable = allDayRecords.reduce((acc, r) => acc + (parseInt(r.totalStock, 10) || 0), 0);
    const totalRemaining = allDayRecords.reduce((acc, r) => acc + (parseInt(r.closingStock, 10) || 0), 0);
    const totalSold = allDayRecords.reduce((acc, r) => acc + (parseInt(r.saleCount, 10) || 0), 0);
    const totalStockValue = allDayRecords.reduce((acc, r) => acc + ((parseInt(r.totalStock, 10) || 0) * (parseFloat(r.bottleRate) || 0)), 0);
    const totalBusiness = allDayRecords.reduce((acc, r) => acc + (parseFloat(r.saleAmount) || 0), 0);
    const totalRemainingStockValue = allDayRecords.reduce((acc, r) => acc + ((parseInt(r.closingStock, 10) || 0) * (parseFloat(r.bottleRate) || 0)), 0);
    const totalExtraAmount = allDayRecords.reduce((acc, r) => acc + (parseFloat(r.extraAmount) || 0), 0);

    const allCompleted = allDayRecords.length > 0 && status === 'COMPLETED';
    const isReconciled = allCompleted && Math.abs(totalStockValue - (totalBusiness + totalRemainingStockValue)) < 0.05;
    const reconciliationStatus = allCompleted
      ? (isReconciled ? 'VERIFIED' : 'DISCREPANCY')
      : 'PENDING';

    const enrichedSavedRecords = allDayRecords.map(r => ({
      ...r,
      stockValue: (parseInt(r.totalStock, 10) || 0) * (parseFloat(r.bottleRate) || 0),
      remainingStockValue: parseFloat(((parseInt(r.closingStock, 10) || 0) * (parseFloat(r.bottleRate) || 0)).toFixed(2)),
      extraPerBottle: parseFloat(r.extraPerBottle) || 0,
      extraAmount: parseFloat(r.extraAmount) || 0
    }));

    return res.status(200).json({
      success: true,
      message: 'Daily stock sheet saved successfully',
      data: {
        businessDate,
        shopId,
        totalRecords: allDayRecords.length,
        totalOpening,
        totalIndent,
        totalAvailable,
        totalSold,
        totalRemaining,
        totalStockValue: totalStockValue.toFixed(2),
        totalBusiness: totalBusiness.toFixed(2),
        totalRemainingStockValue: totalRemainingStockValue.toFixed(2),
        isReconciled,
        reconciliationStatus,
        totalExtraAmount: totalExtraAmount.toFixed(2),
        summary: {
          totalOpening,
          totalIndent,
          totalAvailable,
          totalClosing: totalRemaining,
          totalSold,
          totalStockValue: totalStockValue.toFixed(2),
          totalBusiness: totalBusiness.toFixed(2),
          totalRemainingStockValue: totalRemainingStockValue.toFixed(2),
          isReconciled,
          reconciliationStatus,
          totalExtraAmount: totalExtraAmount.toFixed(2)
        },
        records: enrichedSavedRecords
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
