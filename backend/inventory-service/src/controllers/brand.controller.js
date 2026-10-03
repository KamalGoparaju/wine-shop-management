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

    const brand = await prisma.brand.create({
      data: {
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
          select: { products: true }
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

    if (brand._count.products > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete brand '${brand.name}': it has ${brand._count.products} associated product(s). Please delete or reassign products first.`,
        error: 'BRAND_HAS_PRODUCTS'
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

module.exports = {
  createBrand,
  getBrands,
  getBrandById,
  updateBrand,
  toggleBrandStatus,
  deleteBrand
};
