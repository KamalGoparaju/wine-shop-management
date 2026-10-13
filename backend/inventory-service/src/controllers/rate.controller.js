const prisma = require('../config/prisma');

// Get rates for brand and size (optionally filtered by shopId)
const getRates = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { brandId } = req.query;

    const where = { isActive: true };
    if (brandId) where.brandId = brandId;
    if (shopId) {
      where.OR = [{ shopId }, { shopId: null }];
    }

    const rates = await prisma.brandSizeRate.findMany({
      where,
      include: {
        brand: true,
        size: true
      },
      orderBy: [
        { brand: { serialNo: 'asc' } },
        { size: { volumeMl: 'desc' } }
      ]
    });

    return res.status(200).json({
      success: true,
      message: 'Rates retrieved successfully',
      data: { rates }
    });
  } catch (error) {
    next(error);
  }
};

// Set or update rate for brand and size
const upsertRate = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId || null;
    const { brandId, sizeId, rate } = req.body;

    if (!brandId || !sizeId || rate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'brandId, sizeId, and rate are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const numericRate = parseFloat(rate);
    if (numericRate < 0) {
      return res.status(400).json({
        success: false,
        message: 'rate must be non-negative',
        error: 'VALIDATION_ERROR'
      });
    }

    const rateRecord = await prisma.brandSizeRate.upsert({
      where: {
        brandId_sizeId_shopId: {
          brandId,
          sizeId,
          shopId
        }
      },
      update: {
        rate: numericRate,
        isActive: true
      },
      create: {
        brandId,
        sizeId,
        rate: numericRate,
        shopId,
        isActive: true
      },
      include: {
        brand: true,
        size: true
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Rate configured successfully',
      data: { rate: rateRecord }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRates,
  upsertRate
};
