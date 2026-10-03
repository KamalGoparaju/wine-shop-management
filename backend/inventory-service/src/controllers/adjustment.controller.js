const prisma = require('../config/prisma');

// Adjust bottle status (DAMAGED, RETURNED, ADJUSTED, IN_STOCK) and log history
const createStockAdjustment = async (req, res, next) => {
  try {
    const { serialNumber, bottleId, newStatus, reason, adjustedBy } = req.body;

    if ((!serialNumber && !bottleId) || !newStatus || !reason || !adjustedBy) {
      return res.status(400).json({
        success: false,
        message: 'serialNumber or bottleId, newStatus, reason, and adjustedBy are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const validStatuses = ['IN_STOCK', 'SOLD', 'DAMAGED', 'RETURNED', 'ADJUSTED'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid newStatus. Allowed values: ${validStatuses.join(', ')}`,
        error: 'VALIDATION_ERROR'
      });
    }

    // Find target bottle
    const bottle = await prisma.bottle.findFirst({
      where: {
        OR: [
          ...(bottleId ? [{ id: bottleId }] : []),
          ...(serialNumber ? [{ serialNumber: serialNumber.trim() }] : [])
        ]
      }
    });

    if (!bottle) {
      return res.status(404).json({
        success: false,
        message: 'Bottle not found',
        error: 'BOTTLE_NOT_FOUND'
      });
    }

    const previousStatus = bottle.status;

    if (previousStatus === newStatus) {
      return res.status(400).json({
        success: false,
        message: `Bottle already has status ${newStatus}`,
        error: 'NO_CHANGE'
      });
    }

    // Perform status update and log creation in transaction (Rule 5)
    const result = await prisma.$transaction(async (tx) => {
      const updatedBottle = await tx.bottle.update({
        where: { id: bottle.id },
        data: { status: newStatus }
      });

      const adjustmentLog = await tx.stockAdjustment.create({
        data: {
          bottleId: bottle.id,
          previousStatus,
          newStatus,
          reason: reason.trim(),
          adjustedBy: adjustedBy.trim()
        }
      });

      return { updatedBottle, adjustmentLog };
    });

    return res.status(200).json({
      success: true,
      message: `Bottle status adjusted from ${previousStatus} to ${newStatus}`,
      data: {
        bottle: result.updatedBottle,
        adjustment: result.adjustmentLog
      }
    });
  } catch (error) {
    next(error);
  }
};

// List stock adjustment history logs
const getStockAdjustments = async (req, res, next) => {
  try {
    const { bottleId, serialNumber } = req.query;

    const where = {};
    if (bottleId) where.bottleId = bottleId;
    if (serialNumber) {
      where.bottle = { serialNumber: serialNumber.trim() };
    }

    const adjustments = await prisma.stockAdjustment.findMany({
      where,
      include: {
        bottle: {
          include: {
            product: { include: { brand: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      message: 'Stock adjustments retrieved successfully',
      data: { adjustments }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStockAdjustment,
  getStockAdjustments
};
