const prisma = require('../config/prisma');
const inventoryService = require('../services/inventory.service');

// Helper to generate unique invoice numbers (e.g., INV-20261003-8A2F)
const generateInvoiceNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${dateStr}-${randomSuffix}`;
};

// Create a new sale
const createSale = async (req, res, next) => {
  try {
    const { bottleSerialNumbers, paymentMethod, soldBy, notes } = req.body;

    if (!bottleSerialNumbers || !Array.isArray(bottleSerialNumbers) || bottleSerialNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'bottleSerialNumbers array is required and cannot be empty',
        error: 'VALIDATION_ERROR'
      });
    }

    const seller = soldBy || req.headers['x-user-name'] || 'Staff';

    // Step 1: Validate all bottle serial numbers via Inventory Service API
    const itemsToSell = [];
    let calculatedTotal = 0;

    for (const serialNumber of bottleSerialNumbers) {
      const bottle = await inventoryService.lookupBottleBySerial(serialNumber.trim());

      if (!bottle) {
        return res.status(404).json({
          success: false,
          message: `Bottle serial number '${serialNumber}' was not found in inventory`,
          error: 'BOTTLE_NOT_FOUND'
        });
      }

      if (bottle.status !== 'IN_STOCK') {
        return res.status(400).json({
          success: false,
          message: `Bottle '${serialNumber}' cannot be sold because its status is ${bottle.status}`,
          error: 'BOTTLE_NOT_IN_STOCK'
        });
      }

      const unitPrice = parseFloat(bottle.bottlePrice);
      calculatedTotal += unitPrice;

      itemsToSell.push({
        bottleSerialNumber: bottle.serialNumber,
        productId: bottle.productId,
        unitPrice
      });
    }

    const invoiceNumber = generateInvoiceNumber();

    // Step 2: Save Sale transaction in sales_db
    const sale = await prisma.sale.create({
      data: {
        invoiceNumber,
        totalAmount: calculatedTotal,
        paymentMethod: paymentMethod || 'CASH',
        soldBy: seller,
        notes: notes ? notes.trim() : null,
        items: {
          create: itemsToSell.map(item => ({
            bottleSerialNumber: item.bottleSerialNumber,
            productId: item.productId,
            unitPrice: item.unitPrice
          }))
        }
      },
      include: {
        items: true
      }
    });

    // Step 3: Mark bottles as SOLD in Inventory Service (Rule 4)
    for (const item of itemsToSell) {
      await inventoryService.updateBottleStatus(
        item.bottleSerialNumber,
        'SOLD',
        `Sold under invoice ${invoiceNumber}`,
        seller
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      data: { sale }
    });
  } catch (error) {
    next(error);
  }
};

// List sales history
const getSales = async (req, res, next) => {
  try {
    const { search, paymentMethod } = req.query;

    const where = {};
    if (search) {
      where.invoiceNumber = { contains: search.trim(), mode: 'insensitive' };
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        _count: {
          select: { items: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      message: 'Sales history retrieved successfully',
      data: { sales }
    });
  } catch (error) {
    next(error);
  }
};

// Get sale details by ID
const getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale record not found',
        error: 'SALE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sale details retrieved successfully',
      data: { sale }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById
};
