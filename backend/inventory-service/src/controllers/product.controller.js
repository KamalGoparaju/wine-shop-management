const prisma = require('../config/prisma');

// Create product
const createProduct = async (req, res, next) => {
  try {
    const {
      brandId,
      name,
      bottleVolume,
      bottlesPerBox,
      defaultBottlePrice,
      defaultBoxPrice
    } = req.body;

    if (!brandId || !name || !bottleVolume || !bottlesPerBox || defaultBottlePrice === undefined || defaultBoxPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'brandId, name, bottleVolume, bottlesPerBox, defaultBottlePrice, and defaultBoxPrice are required',
        error: 'VALIDATION_ERROR'
      });
    }

    if (bottlesPerBox <= 0) {
      return res.status(400).json({
        success: false,
        message: 'bottlesPerBox must be greater than 0',
        error: 'VALIDATION_ERROR'
      });
    }

    // Check if brand exists
    const brand = await prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Associated brand not found',
        error: 'BRAND_NOT_FOUND'
      });
    }

    // Check unique compound constraint: brandId + name + bottleVolume
    const existingProduct = await prisma.product.findUnique({
      where: {
        brandId_name_bottleVolume: {
          brandId,
          name: name.trim(),
          bottleVolume: bottleVolume.trim()
        }
      }
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: 'Product with this name and bottle volume already exists for this brand',
        error: 'DUPLICATE_PRODUCT'
      });
    }

    const product = await prisma.product.create({
      data: {
        brandId,
        name: name.trim(),
        bottleVolume: bottleVolume.trim(),
        bottlesPerBox: parseInt(bottlesPerBox, 10),
        defaultBottlePrice: parseFloat(defaultBottlePrice),
        defaultBoxPrice: parseFloat(defaultBoxPrice)
      },
      include: {
        brand: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

const {
  parsePaginationParams,
  buildSortClause,
  buildPaginationMetadata
} = require('../utils/pagination.util');

// Get products list with filtering, sorting & server-side pagination
const getProducts = async (req, res, next) => {
  try {
    const { search, brandId, isActive, sortBy, sortOrder } = req.query;

    const where = {};
    if (search && search.trim()) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }
    if (brandId) {
      where.brandId = brandId;
    }
    if (isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    const isExplicitlyPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.paginate === 'true';
    const pagination = parsePaginationParams(req.query);

    const orderBy = buildSortClause({
      sortBy,
      sortOrder,
      allowedFields: ['name', 'defaultBottlePrice', 'bottlesPerBox', 'createdAt', 'isActive'],
      defaultSortBy: 'name',
      defaultSortOrder: 'asc',
      tieBreaker: 'id'
    });

    const include = {
      brand: true,
      _count: {
        select: {
          bottles: {
            where: { status: 'IN_STOCK' }
          }
        }
      }
    };

    let totalRecords;
    let products;

    if (isExplicitlyPaginated && pagination.isPaginated) {
      [totalRecords, products] = await prisma.$transaction([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          include,
          orderBy,
          skip: pagination.skip,
          take: pagination.take
        })
      ]);
    } else {
      products = await prisma.product.findMany({
        where,
        include,
        orderBy
      });
      totalRecords = products.length;
    }

    const paginationMetadata = buildPaginationMetadata(
      totalRecords,
      pagination.page,
      pagination.limit
    );

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: {
        products,
        pagination: paginationMetadata
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get product by ID
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        _count: {
          select: {
            bottles: true,
            stockEntries: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'PRODUCT_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

// Update product
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      bottleVolume,
      bottlesPerBox,
      defaultBottlePrice,
      defaultBoxPrice
    } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'PRODUCT_NOT_FOUND'
      });
    }

    const updatedData = {};
    if (name) updatedData.name = name.trim();
    if (bottleVolume) updatedData.bottleVolume = bottleVolume.trim();
    if (bottlesPerBox !== undefined) updatedData.bottlesPerBox = parseInt(bottlesPerBox, 10);
    if (defaultBottlePrice !== undefined) updatedData.defaultBottlePrice = parseFloat(defaultBottlePrice);
    if (defaultBoxPrice !== undefined) updatedData.defaultBoxPrice = parseFloat(defaultBoxPrice);

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updatedData,
      include: { brand: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product: updatedProduct }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Product with this name and bottle volume already exists for this brand',
        error: 'DUPLICATE_PRODUCT'
      });
    }
    next(error);
  }
};

// Toggle product active status
const toggleProductStatus = async (req, res, next) => {
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

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { isActive },
      include: { brand: true }
    });

    return res.status(200).json({
      success: true,
      message: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { product: updatedProduct }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'PRODUCT_NOT_FOUND'
      });
    }
    next(error);
  }
};

// Delete product
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            bottles: true,
            stockEntries: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'PRODUCT_NOT_FOUND'
      });
    }

    if (product._count.bottles > 0 || product._count.stockEntries > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product '${product.name}': it has ${product._count.stockEntries} stock entry(ies) and ${product._count.bottles} registered bottle(s). Deactivate the product instead.`,
        error: 'PRODUCT_HAS_STOCK'
      });
    }

    await prisma.product.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: `Product '${product.name}' deleted successfully`,
      data: null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductStatus,
  deleteProduct
};
