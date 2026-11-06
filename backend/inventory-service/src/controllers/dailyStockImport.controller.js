const prisma = require('../config/prisma');
const { analyzeStockFiles } = require('../utils/stockSheetParser.util');

const formatDateString = (d) => {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
};

/**
 * POST /api/inventory/daily-stock/import/analyze
 * Analyzes uploaded images, PDFs, Excel, and CSV files in memory without committing to DB.
 */
const analyzeImportBatch = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const businessDate = req.body.businessDate || formatDateString(new Date());

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or shopId body) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one file must be uploaded for analysis',
        error: 'NO_FILES_UPLOADED'
      });
    }

    const targetDate = new Date(`${businessDate}T00:00:00.000Z`);

    // 1. Verify that this business date is not LOCKED
    const lockedCheck = await prisma.dailyStockRecord.findFirst({
      where: {
        shopId,
        businessDate: targetDate,
        status: 'LOCKED'
      }
    });

    if (lockedCheck) {
      return res.status(403).json({
        success: false,
        message: `Business date ${businessDate} is LOCKED after closing. Stock import is prohibited.`,
        error: 'DATE_LOCKED'
      });
    }

    // 2. Check existing records for potential overwrite warning
    const existingRecords = await prisma.dailyStockRecord.findMany({
      where: {
        shopId,
        businessDate: targetDate
      },
      select: { brandId: true, sizeId: true, status: true }
    });

    // 3. Load Master Data (Brands, Sizes, Rates)
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

    // 4. Run Analysis & Staging Parser (Zero DB commit)
    const { fileSummaries, rows } = await analyzeStockFiles({
      files: req.files,
      shopId,
      activeBrands,
      activeSizes,
      activeRates
    });

    // Cross-check existing DB records to flag existing duplicates
    const existingKeySet = new Set(existingRecords.map(r => `${r.brandId}_${r.sizeId}`));
    for (const row of rows) {
      if (row.brandId && row.sizeId && existingKeySet.has(`${row.brandId}_${row.sizeId}`)) {
        if (!row.validationIssues.some(i => i.includes('Already exists in database'))) {
          row.validationIssues.push('Already exists in database for this date (will update if confirmed)');
          if (row.status === 'VERIFIED') {
            row.status = 'NEEDS_REVIEW';
          }
        }
      }
    }

    // Calculate preview aggregate summaries
    const totalExtractedRows = rows.length;
    const verifiedRows = rows.filter(r => r.status === 'VERIFIED').length;
    const needsReviewRows = rows.filter(r => r.status === 'NEEDS_REVIEW' || r.status === 'BRAND_NOT_FOUND' || r.status === 'SIZE_NOT_FOUND').length;
    const invalidRows = rows.filter(r => r.status === 'INVALID').length;
    const duplicateRows = rows.filter(r => r.status === 'DUPLICATE').length;

    let totalBottlesSold = 0;
    let totalSaleAmount = 0;
    let totalStockValue = 0;

    for (const r of rows) {
      if (r.status !== 'INVALID') {
        totalBottlesSold += (r.saleCount || 0);
        totalSaleAmount += (r.saleAmount || 0);
        totalStockValue += (r.stockValue || 0);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        shopId,
        businessDate,
        existingRecordCount: existingRecords.length,
        fileSummaries,
        summary: {
          totalExtractedRows,
          verifiedRows,
          needsReviewRows,
          invalidRows,
          duplicateRows,
          totalBottlesSold,
          totalStockValue: totalStockValue.toFixed(2),
          totalSaleAmount: totalSaleAmount.toFixed(2)
        },
        rows,
        masterData: {
          brands: activeBrands.map(b => ({
            id: b.id,
            name: b.name,
            serialNo: b.serialNo,
            configuredSizes: activeRates
              .filter(r => r.brandId === b.id)
              .map(r => {
                const s = activeSizes.find(sz => sz.id === r.sizeId);
                return {
                  sizeId: r.sizeId,
                  code: s ? s.code : '',
                  name: s ? s.name : '',
                  volumeMl: s ? s.volumeMl : null,
                  rate: parseFloat(r.rate)
                };
              })
          })),
          sizes: activeSizes.map(s => ({ id: s.id, code: s.code, name: s.name, volumeMl: s.volumeMl })),
          rates: activeRates.map(r => ({
            brandId: r.brandId,
            sizeId: r.sizeId,
            rate: parseFloat(r.rate),
            shopId: r.shopId
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/inventory/daily-stock/import/confirm
 * Atomically commits the operator-verified and approved stock records to DailyStockRecord table.
 */
const confirmImportBatch = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const { businessDate, items, importMode = 'merge', status = 'DRAFT' } = req.body;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or body) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    if (!businessDate || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'businessDate and approved items array are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const targetDate = new Date(`${businessDate}T00:00:00.000Z`);

    // Verify date is not locked
    const lockedRecord = await prisma.dailyStockRecord.findFirst({
      where: {
        shopId,
        businessDate: targetDate,
        status: 'LOCKED'
      }
    });

    if (lockedRecord) {
      return res.status(403).json({
        success: false,
        message: `Date ${businessDate} is locked. Modifications are not allowed.`,
        error: 'DATE_LOCKED'
      });
    }

    // Filter out invalid items or items without brand/size
    const approvedItems = items.filter(it => it.brandId && it.sizeId);
    if (approvedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid records with assigned Brand and Size to import',
        error: 'EMPTY_APPROVED_ITEMS'
      });
    }

    // Authoritative backend validation: Reject unconfigured Brand + Size combinations
    const activeRates = await prisma.brandSizeRate.findMany({
      where: {
        isActive: true,
        OR: [{ shopId }, { shopId: null }]
      },
      include: { brand: true, size: true }
    });
    const rateMap = new Map();
    for (const r of activeRates) {
      const k = `${r.brandId}_${r.sizeId}`;
      if (!rateMap.has(k) || r.shopId === shopId) {
        rateMap.set(k, parseFloat(r.rate));
      }
    }

    for (const it of approvedItems) {
      const k = `${it.brandId}_${it.sizeId}`;
      if (!rateMap.has(k)) {
        return res.status(400).json({
          success: false,
          message: `Cannot commit import: Size '${it.sizeCode || it.sizeId}' is not configured for Brand '${it.brandName || it.brandId}'.`,
          error: 'INVALID_BRAND_SIZE_COMBINATION'
        });
      }
    }

    // Authoritative calculations and sanity checks
    const preparedRecords = approvedItems.map(it => {
      const opening = Math.max(0, parseInt(it.openingStock) || 0);
      const indent = Math.max(0, parseInt(it.indentStock) || 0);
      const total = opening + indent;
      const closing = Math.max(0, parseInt(it.closingStock) || 0);

      if (closing > total) {
        throw new Error(`Item ${it.brandName || it.brandId}: Closing stock (${closing}) exceeds total stock (${total})`);
      }

      const sale = Math.max(0, total - closing);
      const rate = parseFloat(it.bottleRate) || 0;
      const saleAmount = parseFloat((sale * rate).toFixed(2));
      const extraPerBottle = Math.max(0, parseFloat(it.extraPerBottle) || 0);
      let extraAmount = 0;
      if (it.extraPerBottle !== undefined && it.extraPerBottle !== null) {
        extraAmount = parseFloat((sale * extraPerBottle).toFixed(2));
      } else {
        extraAmount = parseFloat(parseFloat(it.extraAmount || 0).toFixed(2));
      }

      return {
        shopId,
        businessDate: targetDate,
        brandId: it.brandId,
        sizeId: it.sizeId,
        openingStock: opening,
        indentStock: indent,
        totalStock: total,
        closingStock: closing,
        saleCount: sale,
        bottleRate: rate,
        saleAmount,
        extraPerBottle,
        extraAmount,
        status: status === 'COMPLETED' ? 'COMPLETED' : 'DRAFT'
      };
    });

    // Atomic execution inside a Prisma transaction
    let importedCount = 0;
    let totalSaleAmount = 0;
    let totalBottlesSold = 0;

    await prisma.$transaction(async (tx) => {
      if (importMode === 'replace') {
        // Delete existing non-locked records for this shop & date
        await tx.dailyStockRecord.deleteMany({
          where: {
            shopId,
            businessDate: targetDate,
            status: { not: 'LOCKED' }
          }
        });
      }

      for (const rec of preparedRecords) {
        if (importMode === 'append_only') {
          // Check if exists
          const exists = await tx.dailyStockRecord.findUnique({
            where: {
              shopId_businessDate_brandId_sizeId: {
                shopId: rec.shopId,
                businessDate: rec.businessDate,
                brandId: rec.brandId,
                sizeId: rec.sizeId
              }
            }
          });
          if (exists) continue; // Skip existing
        }

        await tx.dailyStockRecord.upsert({
          where: {
            shopId_businessDate_brandId_sizeId: {
              shopId: rec.shopId,
              businessDate: rec.businessDate,
              brandId: rec.brandId,
              sizeId: rec.sizeId
            }
          },
          update: {
            openingStock: rec.openingStock,
            indentStock: rec.indentStock,
            totalStock: rec.totalStock,
            closingStock: rec.closingStock,
            saleCount: rec.saleCount,
            bottleRate: rec.bottleRate,
            saleAmount: rec.saleAmount,
            extraPerBottle: rec.extraPerBottle,
            extraAmount: rec.extraAmount,
            status: rec.status,
            updatedAt: new Date()
          },
          create: rec
        });

        importedCount++;
        totalBottlesSold += rec.saleCount;
        totalSaleAmount += rec.saleAmount;
      }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully imported and verified ${importedCount} stock records.`,
      data: {
        importedCount,
        totalBottlesSold,
        totalSaleAmount: totalSaleAmount.toFixed(2),
        businessDate,
        shopId,
        status
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeImportBatch,
  confirmImportBatch
};
