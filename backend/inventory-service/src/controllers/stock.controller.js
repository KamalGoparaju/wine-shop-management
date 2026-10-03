const prisma = require('../config/prisma');

// Create a stock entry with boxes and bottle serial numbers
const createStockEntry = async (req, res, next) => {
  try {
    const {
      productId,
      numberOfBoxes,
      bottlesPerBox,
      boxPrice,
      bottlePrice,
      serialNumbers,
      notes
    } = req.body;

    if (!productId || !numberOfBoxes || !serialNumbers) {
      return res.status(400).json({
        success: false,
        message: 'productId, numberOfBoxes, and serialNumbers are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const parsedNumberOfBoxes = parseInt(numberOfBoxes, 10);
    if (parsedNumberOfBoxes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'numberOfBoxes must be greater than 0',
        error: 'VALIDATION_ERROR'
      });
    }

    // Fetch product to validate and resolve defaults
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'PRODUCT_NOT_FOUND'
      });
    }

    const resolvedBottlesPerBox = bottlesPerBox ? parseInt(bottlesPerBox, 10) : product.bottlesPerBox;
    const resolvedBoxPrice = boxPrice !== undefined ? parseFloat(boxPrice) : parseFloat(product.defaultBoxPrice);
    const resolvedBottlePrice = bottlePrice !== undefined ? parseFloat(bottlePrice) : parseFloat(product.defaultBottlePrice);

    // Rule 1: Total bottles calculation
    const calculatedTotalBottles = parsedNumberOfBoxes * resolvedBottlesPerBox;

    // Parse serial numbers (support array or string with newlines/commas)
    let parsedSerials = [];
    if (Array.isArray(serialNumbers)) {
      parsedSerials = serialNumbers.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof serialNumbers === 'string') {
      parsedSerials = serialNumbers
        .split(/[\n,\r]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }

    // Rule 2: Serial number count match validation
    if (parsedSerials.length !== calculatedTotalBottles) {
      return res.status(400).json({
        success: false,
        message: `Expected ${calculatedTotalBottles} serial numbers (${parsedNumberOfBoxes} boxes × ${resolvedBottlesPerBox} bottles/box), but received ${parsedSerials.length}`,
        error: 'INVALID_SERIAL_COUNT',
        data: {
          expectedCount: calculatedTotalBottles,
          receivedCount: parsedSerials.length
        }
      });
    }

    // Check for internal duplicates in input serial list
    const uniqueInputSerials = new Set(parsedSerials);
    if (uniqueInputSerials.size !== parsedSerials.length) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate serial numbers detected in submitted input',
        error: 'DUPLICATE_SERIAL_NUMBER'
      });
    }

    // Rule 3: Check database for existing serial numbers
    const existingBottles = await prisma.bottle.findMany({
      where: {
        serialNumber: { in: parsedSerials }
      },
      select: { serialNumber: true }
    });

    if (existingBottles.length > 0) {
      const duplicateSerials = existingBottles.map(b => b.serialNumber);
      return res.status(409).json({
        success: false,
        message: `Serial number(s) already exist in database: ${duplicateSerials.join(', ')}`,
        error: 'DUPLICATE_SERIAL_NUMBER',
        data: { duplicateSerials }
      });
    }

    // Execute creation in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Stock Entry header
      const stockEntry = await tx.stockEntry.create({
        data: {
          productId,
          numberOfBoxes: parsedNumberOfBoxes,
          bottlesPerBox: resolvedBottlesPerBox,
          totalBottles: calculatedTotalBottles,
          boxPrice: resolvedBoxPrice,
          bottlePrice: resolvedBottlePrice,
          notes: notes ? notes.trim() : null
        }
      });

      let serialIndex = 0;
      const createdBoxes = [];

      // Create Boxes and associated Bottles
      for (let boxNum = 1; boxNum <= parsedNumberOfBoxes; boxNum++) {
        const box = await tx.box.create({
          data: {
            stockEntryId: stockEntry.id,
            boxNumber: boxNum
          }
        });

        const boxSerials = parsedSerials.slice(serialIndex, serialIndex + resolvedBottlesPerBox);
        serialIndex += resolvedBottlesPerBox;

        const bottleCreateData = boxSerials.map(sn => ({
          serialNumber: sn,
          boxId: box.id,
          stockEntryId: stockEntry.id,
          productId,
          bottlePrice: resolvedBottlePrice,
          status: 'IN_STOCK'
        }));

        await tx.bottle.createMany({
          data: bottleCreateData
        });

        createdBoxes.push({
          boxNumber: boxNum,
          boxId: box.id,
          serialNumbers: boxSerials
        });
      }

      return { stockEntry, createdBoxes };
    });

    return res.status(201).json({
      success: true,
      message: 'Stock entry created successfully',
      data: {
        stockEntryId: result.stockEntry.id,
        totalBottles: result.stockEntry.totalBottles,
        numberOfBoxes: result.stockEntry.numberOfBoxes,
        bottlesPerBox: result.stockEntry.bottlesPerBox,
        boxes: result.createdBoxes
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get list of stock entries
const getStockEntries = async (req, res, next) => {
  try {
    const { productId, status } = req.query;

    const where = {};
    if (productId) where.productId = productId;
    if (status) where.status = status;

    const stockEntries = await prisma.stockEntry.findMany({
      where,
      include: {
        product: {
          include: { brand: true }
        },
        _count: {
          select: {
            boxes: true,
            bottles: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      message: 'Stock entries retrieved successfully',
      data: { stockEntries }
    });
  } catch (error) {
    next(error);
  }
};

// Get stock entry details by ID (including boxes and bottle serial numbers)
const getStockEntryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const stockEntry = await prisma.stockEntry.findUnique({
      where: { id },
      include: {
        product: {
          include: { brand: true }
        },
        boxes: {
          include: {
            bottles: {
              orderBy: { serialNumber: 'asc' }
            }
          },
          orderBy: { boxNumber: 'asc' }
        }
      }
    });

    if (!stockEntry) {
      return res.status(404).json({
        success: false,
        message: 'Stock entry not found',
        error: 'STOCK_ENTRY_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Stock entry details retrieved successfully',
      data: { stockEntry }
    });
  } catch (error) {
    next(error);
  }
};

// Cancel / delete unused stock entry (only allowed if all bottles in entry are still IN_STOCK)
const cancelStockEntry = async (req, res, next) => {
  try {
    const { id } = req.params;

    const stockEntry = await prisma.stockEntry.findUnique({
      where: { id },
      include: {
        bottles: {
          select: { status: true }
        }
      }
    });

    if (!stockEntry) {
      return res.status(404).json({
        success: false,
        message: 'Stock entry not found',
        error: 'STOCK_ENTRY_NOT_FOUND'
      });
    }

    const hasNonStockBottles = stockEntry.bottles.some(b => b.status !== 'IN_STOCK');
    if (hasNonStockBottles) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel stock entry: some bottles have already been sold or adjusted',
        error: 'STOCK_ENTRY_IN_USE'
      });
    }

    // Delete stock entry (cascades to boxes & bottles)
    await prisma.stockEntry.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Stock entry cancelled and deleted successfully',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Search / lookup bottle by serial number
const getBottleBySerial = async (req, res, next) => {
  try {
    const { serialNumber } = req.params;

    const bottle = await prisma.bottle.findUnique({
      where: { serialNumber: serialNumber.trim() },
      include: {
        product: {
          include: { brand: true }
        },
        box: true,
        stockEntry: true,
        stockAdjustments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!bottle) {
      return res.status(404).json({
        success: false,
        message: 'Bottle serial number not found',
        error: 'BOTTLE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Bottle details retrieved successfully',
      data: { bottle }
    });
  } catch (error) {
    next(error);
  }
};

// List available stock overview by product
const getAvailableStockSummary = async (req, res, next) => {
  try {
    const stockSummary = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        brand: true,
        bottles: {
          where: { status: 'IN_STOCK' },
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const summaryData = stockSummary.map(p => ({
      productId: p.id,
      productName: p.name,
      brandName: p.brand.name,
      bottleVolume: p.bottleVolume,
      bottlesPerBox: p.bottlesPerBox,
      defaultBottlePrice: p.defaultBottlePrice,
      inStockBottlesCount: p.bottles.length,
      equivalentBoxes: (p.bottles.length / p.bottlesPerBox).toFixed(1)
    }));

    return res.status(200).json({
      success: true,
      message: 'Stock summary retrieved successfully',
      data: { stockSummary: summaryData }
    });
  } catch (error) {
    next(error);
  }
};

// Inventory Stock Report & Valuation
const getStockReport = async (req, res, next) => {
  try {
    const [allBottles, allProducts, allBrands] = await Promise.all([
      prisma.bottle.findMany({ select: { status: true, bottlePrice: true } }),
      prisma.product.findMany({ select: { id: true } }),
      prisma.brand.findMany({ select: { id: true } })
    ]);

    const statusCounts = {
      IN_STOCK: allBottles.filter(b => b.status === 'IN_STOCK').length,
      SOLD: allBottles.filter(b => b.status === 'SOLD').length,
      DAMAGED: allBottles.filter(b => b.status === 'DAMAGED').length,
      RETURNED: allBottles.filter(b => b.status === 'RETURNED').length,
      ADJUSTED: allBottles.filter(b => b.status === 'ADJUSTED').length
    };

    const inStockValuation = allBottles
      .filter(b => b.status === 'IN_STOCK')
      .reduce((acc, b) => acc + parseFloat(b.bottlePrice), 0);

    const totalInventoryValuation = allBottles
      .reduce((acc, b) => acc + parseFloat(b.bottlePrice), 0);

    return res.status(200).json({
      success: true,
      message: 'Stock report generated successfully',
      data: {
        totalProductsCount: allProducts.length,
        totalBrandsCount: allBrands.length,
        totalBottlesRegistered: allBottles.length,
        statusCounts,
        inStockValuation: inStockValuation.toFixed(2),
        totalInventoryValuation: totalInventoryValuation.toFixed(2)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStockEntry,
  getStockEntries,
  getStockEntryById,
  cancelStockEntry,
  getBottleBySerial,
  getAvailableStockSummary,
  getStockReport
};
