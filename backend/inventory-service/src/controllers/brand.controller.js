const prisma = require('../config/prisma');

// Create brand
const createBrand = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const existingBrand = await prisma.brand.findUnique({
      where: { name: name.trim() }
    });

    if (existingBrand) {
      return res.status(409).json({
        success: false,
        message: 'Brand with this name already exists',
        error: 'DUPLICATE_BRAND_NAME'
      });
    }

    const maxBrand = await prisma.brand.findFirst({
      orderBy: { serialNo: 'desc' }
    });
    const nextSerialNo = (maxBrand && maxBrand.serialNo) ? maxBrand.serialNo + 1 : 1;

    const brand = await prisma.brand.create({
      data: {
        serialNo: nextSerialNo,
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: { brand }
    });
  } catch (error) {
    next(error);
  }
};

// Get brands list with optional search & filtering
const getBrands = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;

    const where = {};
    if (search) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const brands = await prisma.brand.findMany({
      where,
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return res.status(200).json({
      success: true,
      message: 'Brands retrieved successfully',
      data: { brands }
    });
  } catch (error) {
    next(error);
  }
};

// Get brand by ID
const getBrandById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
        error: 'BRAND_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Brand retrieved successfully',
      data: { brand }
    });
  } catch (error) {
    next(error);
  }
};

// Update brand
const updateBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Brand name cannot be empty',
        error: 'VALIDATION_ERROR'
      });
    }

    if (name) {
      const existingBrand = await prisma.brand.findFirst({
        where: {
          name: name.trim(),
          NOT: { id }
        }
      });

      if (existingBrand) {
        return res.status(409).json({
          success: false,
          message: 'Another brand with this name already exists',
          error: 'DUPLICATE_BRAND_NAME'
        });
      }
    }

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null })
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Brand updated successfully',
      data: { brand: updatedBrand }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
        error: 'BRAND_NOT_FOUND'
      });
    }
    next(error);
  }
};

// Toggle brand status (active/deactive)
const toggleBrandStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
        error: 'VALIDATION_ERROR'
      });
    }

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: { isActive }
    });

    return res.status(200).json({
      success: true,
      message: `Brand ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { brand: updatedBrand }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
        error: 'BRAND_NOT_FOUND'
      });
    }
    next(error);
  }
};

// Delete brand
const deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true, dailyStockRecords: true }
        }
      }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
        error: 'BRAND_NOT_FOUND'
      });
    }

    if (brand._count.products > 0 || brand._count.dailyStockRecords > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete brand '${brand.name}': it has ${brand._count.products} associated product(s) and ${brand._count.dailyStockRecords} daily stock record(s). Deactivate the brand instead to preserve historical business records.`,
        error: 'BRAND_IN_USE'
      });
    }

    await prisma.brand.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: `Brand '${brand.name}' deleted successfully`,
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Get next available serial number
const getNextSerial = async (req, res, next) => {
  try {
    const maxBrand = await prisma.brand.findFirst({
      orderBy: { serialNo: 'desc' }
    });
    const nextSerialNo = (maxBrand && maxBrand.serialNo) ? maxBrand.serialNo + 1 : 1;
    return res.status(200).json({
      success: true,
      message: 'Next serial number determined',
      data: { nextSerialNo }
    });
  } catch (error) {
    next(error);
  }
};

// Create brand with size rates in a single atomic transaction
const createBrandWithRates = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId || null;
    const { name, description, serialNo, isActive = true, rates = [], sizes = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const trimmedName = name.trim();

    // Check duplicate brand name (case-insensitive)
    const existingBrand = await prisma.brand.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive'
        }
      }
    });

    if (existingBrand) {
      return res.status(409).json({
        success: false,
        message: `Brand with name '${trimmedName}' already exists`,
        error: 'DUPLICATE_BRAND_NAME'
      });
    }

    // Determine serial number
    let assignedSerialNo;
    if (serialNo !== undefined && serialNo !== null && serialNo !== '') {
      const parsedSerial = parseInt(serialNo, 10);
      if (isNaN(parsedSerial) || parsedSerial <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Serial number must be a positive integer',
          error: 'VALIDATION_ERROR'
        });
      }
      const existingSerial = await prisma.brand.findUnique({
        where: { serialNo: parsedSerial }
      });
      if (existingSerial) {
        return res.status(409).json({
          success: false,
          message: `Serial number #${parsedSerial} is already assigned to brand '${existingSerial.name}'`,
          error: 'DUPLICATE_SERIAL_NO'
        });
      }
      assignedSerialNo = parsedSerial;
    } else {
      const maxBrand = await prisma.brand.findFirst({
        orderBy: { serialNo: 'desc' }
      });
      assignedSerialNo = (maxBrand && maxBrand.serialNo) ? maxBrand.serialNo + 1 : 1;
    }

    // Normalize rate list from either rates or sizes array
    const inputList = rates.length > 0 ? rates : sizes;
    if (!Array.isArray(inputList) || inputList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one applicable size and rate must be configured for the brand',
        error: 'VALIDATION_ERROR'
      });
    }

    const rateList = inputList.map(r => ({
      sizeId: r.sizeId,
      rate: parseFloat(r.rate),
      shopId: r.shopId !== undefined ? r.shopId : shopId
    }));

    for (const r of rateList) {
      if (!r.sizeId) {
        return res.status(400).json({
          success: false,
          message: 'Each configured rate must specify a valid sizeId',
          error: 'VALIDATION_ERROR'
        });
      }
      if (isNaN(r.rate) || r.rate < 0) {
        return res.status(400).json({
          success: false,
          message: 'Rate must be a non-negative number',
          error: 'VALIDATION_ERROR'
        });
      }
    }

    // Atomic transaction creating Brand and all configured BrandSizeRate rows
    const result = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({
        data: {
          serialNo: assignedSerialNo,
          name: trimmedName,
          description: description ? description.trim() : null,
          isActive: Boolean(isActive)
        }
      });

      const rateRecords = [];
      for (const r of rateList) {
        const rateRecord = await tx.brandSizeRate.create({
          data: {
            brandId: brand.id,
            sizeId: r.sizeId,
            rate: r.rate,
            shopId: r.shopId || null,
            isActive: true
          },
          include: {
            size: true
          }
        });
        rateRecords.push(rateRecord);
      }

      return {
        ...brand,
        rates: rateRecords
      };
    });

    return res.status(201).json({
      success: true,
      message: 'Brand and size rates created successfully',
      data: { brand: result }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBrand,
  getNextSerial,
  createBrandWithRates,
  getBrands,
  getBrandById,
  updateBrand,
  toggleBrandStatus,
  deleteBrand
};
