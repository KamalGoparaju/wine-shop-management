const prisma = require('../config/prisma');

// Create brand
const createBrand = async (req, res, next) => {
  try {
    const { sizes, rates } = req.body;
    if ((sizes && sizes.length > 0) || (rates && rates.length > 0)) {
      return createBrandWithRates(req, res, next);
    }

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

const {
  parsePaginationParams,
  buildSortClause,
  buildPaginationMetadata
} = require('../utils/pagination.util');

// Get brands list with optional search, sorting & server-side pagination
const getBrands = async (req, res, next) => {
  try {
    const { search, isActive, sortBy, sortOrder } = req.query;

    const where = {};
    if (search && search.trim()) {
      const term = search.trim();
      const serialNum = parseInt(term, 10);
      if (!isNaN(serialNum)) {
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { serialNo: serialNum }
        ];
      } else {
        where.name = { contains: term, mode: 'insensitive' };
      }
    }
    if (isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    const isExplicitlyPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.paginate === 'true';
    const pagination = parsePaginationParams(req.query);

    const orderBy = buildSortClause({
      sortBy,
      sortOrder,
      allowedFields: ['name', 'serialNo', 'createdAt', 'isActive'],
      defaultSortBy: 'serialNo',
      defaultSortOrder: 'asc',
      tieBreaker: 'id'
    });

    const include = {
      rates: {
        where: { isActive: true },
        include: { size: true }
      },
      _count: {
        select: {
          products: true,
          rates: true,
          dailyStockRecords: true
        }
      }
    };

    let totalRecords;
    let brands;

    if (isExplicitlyPaginated && pagination.isPaginated) {
      [totalRecords, brands] = await prisma.$transaction([
        prisma.brand.count({ where }),
        prisma.brand.findMany({
          where,
          include,
          orderBy,
          skip: pagination.skip,
          take: pagination.take
        })
      ]);
    } else {
      brands = await prisma.brand.findMany({
        where,
        include,
        orderBy
      });
      totalRecords = brands.length;
    }

    const paginationMetadata = buildPaginationMetadata(
      totalRecords,
      pagination.page,
      pagination.limit
    );

    return res.status(200).json({
      success: true,
      message: 'Brands retrieved successfully',
      data: {
        brands,
        pagination: paginationMetadata
      }
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
        rates: {
          where: { isActive: true },
          include: { size: true }
        },
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
    const shopId = req.headers['x-shop-id'] || req.body.shopId || null;
    const { id } = req.params;
    const { name, description, serialNo, isActive, sizes, rates, rateScope } = req.body;

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
          name: {
            equals: name.trim(),
            mode: 'insensitive'
          },
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

    if (serialNo !== undefined && serialNo !== null && serialNo !== '') {
      const parsedSerial = parseInt(serialNo, 10);
      if (isNaN(parsedSerial) || parsedSerial <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Serial number must be a positive integer',
          error: 'VALIDATION_ERROR'
        });
      }
      const existingSerial = await prisma.brand.findFirst({
        where: {
          serialNo: parsedSerial,
          NOT: { id }
        }
      });
      if (existingSerial) {
        return res.status(409).json({
          success: false,
          message: `Serial number #${parsedSerial} is already assigned to brand '${existingSerial.name}'`,
          error: 'DUPLICATE_SERIAL_NO'
        });
      }
    }

    const inputList = (rates && Array.isArray(rates)) ? rates : (sizes && Array.isArray(sizes)) ? sizes : null;

    if (inputList) {
      for (const r of inputList) {
        if (!r.sizeId) {
          return res.status(400).json({
            success: false,
            message: 'Each configured rate must specify a valid sizeId',
            error: 'VALIDATION_ERROR'
          });
        }
        const numericRate = parseFloat(r.rate);
        if (isNaN(numericRate) || numericRate < 0) {
          return res.status(400).json({
            success: false,
            message: 'Rate must be a non-negative number',
            error: 'VALIDATION_ERROR'
          });
        }
      }
    }

    // Atomic update in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description ? description.trim() : null;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (serialNo !== undefined && serialNo !== null && serialNo !== '') {
        updateData.serialNo = parseInt(serialNo, 10);
      }

      const updatedBrand = await tx.brand.update({
        where: { id },
        data: updateData
      });

      if (inputList) {
        const existingRates = await tx.brandSizeRate.findMany({
          where: { brandId: id }
        });

        const effectiveRateScope = rateScope || (inputList.some(i => i.shopId) ? 'shop' : 'global');
        const targetScope = effectiveRateScope === 'shop'
          ? (req.body.shopId || req.headers['x-shop-id'] || null)
          : null;

        const selectedSizeIds = new Set();

        for (const item of inputList) {
          const itemShopId = effectiveRateScope === 'shop'
            ? (item.shopId !== undefined ? item.shopId : targetScope)
            : null;
          const numericRate = parseFloat(item.rate);
          selectedSizeIds.add(item.sizeId);

          const existingRate = existingRates.find(er => 
            er.sizeId === item.sizeId && 
            ((!er.shopId && !itemShopId) || (er.shopId === itemShopId))
          );

          if (existingRate) {
            await tx.brandSizeRate.update({
              where: { id: existingRate.id },
              data: {
                rate: numericRate,
                isActive: true
              }
            });
          } else {
            await tx.brandSizeRate.create({
              data: {
                brandId: id,
                sizeId: item.sizeId,
                rate: numericRate,
                shopId: itemShopId || null,
                isActive: true
              }
            });
          }
        }

        // Deactivate sizes that were unselected
        const toDeactivate = existingRates.filter(er => {
          if (effectiveRateScope === 'global') {
            // Unselected sizes under global scope are deactivated
            return !selectedSizeIds.has(er.sizeId) && er.isActive;
          }
          return er.shopId === targetScope && !selectedSizeIds.has(er.sizeId) && er.isActive;
        });

        for (const der of toDeactivate) {
          await tx.brandSizeRate.update({
            where: { id: der.id },
            data: { isActive: false }
          });
        }
      }

      return tx.brand.findUnique({
        where: { id },
        include: {
          rates: {
            where: { isActive: true },
            include: { size: true }
          }
        }
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Brand updated successfully',
      data: { brand: result }
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

// Get brand by serial number
const getBrandBySerialNo = async (req, res, next) => {
  try {
    const { serialNo } = req.params;
    const parsedSerial = parseInt(serialNo, 10);
    if (isNaN(parsedSerial) || parsedSerial <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid serial number',
        error: 'VALIDATION_ERROR'
      });
    }

    const brand = await prisma.brand.findUnique({
      where: { serialNo: parsedSerial },
      include: {
        rates: {
          where: { isActive: true },
          include: { size: true }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: brand ? 'Brand found by serial number' : 'No brand found with this serial number',
      data: { brand }
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

// Get brand configured sizes with resolved rates (shop override > global fallback)
const getBrandConfiguredSizes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopId = req.headers['x-shop-id'] || req.query.shopId || null;

    const brand = await prisma.brand.findUnique({
      where: { id }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
        error: 'BRAND_NOT_FOUND'
      });
    }

    const rates = await prisma.brandSizeRate.findMany({
      where: {
        brandId: id,
        isActive: true,
        OR: [{ shopId }, { shopId: null }]
      },
      include: { size: true },
      orderBy: { size: { volumeMl: 'desc' } }
    });

    // Resolve shop override vs global fallback per size
    const sizeMap = new Map();
    for (const r of rates) {
      if (!sizeMap.has(r.sizeId) || r.shopId === shopId) {
        sizeMap.set(r.sizeId, {
          sizeId: r.sizeId,
          code: r.size.code,
          name: r.size.name,
          volumeMl: r.size.volumeMl,
          rate: parseFloat(r.rate),
          shopId: r.shopId
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Brand configured sizes retrieved successfully',
      data: {
        brand: {
          id: brand.id,
          name: brand.name,
          serialNo: brand.serialNo
        },
        sizes: Array.from(sizeMap.values())
      }
    });
  } catch (error) {
    next(error);
  }
};

// Remove/Deactivate an individual size from a brand
const removeBrandSizeRate = async (req, res, next) => {
  try {
    const { id, sizeId } = req.params;
    const shopId = req.headers['x-shop-id'] || req.query.shopId || null;
    const { scope = 'all' } = req.query;

    const brand = await prisma.brand.findUnique({
      where: { id }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
        error: 'BRAND_NOT_FOUND'
      });
    }

    const where = { brandId: id, sizeId };
    if (scope === 'shop' && shopId) {
      where.shopId = shopId;
    } else if (scope === 'global') {
      where.shopId = null;
    }

    const result = await prisma.brandSizeRate.updateMany({
      where,
      data: { isActive: false }
    });

    return res.status(200).json({
      success: true,
      message: 'Size removed from brand successfully',
      data: { count: result.count }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBrand,
  getNextSerial,
  getBrandBySerialNo,
  createBrandWithRates,
  getBrands,
  getBrandById,
  getBrandConfiguredSizes,
  updateBrand,
  toggleBrandStatus,
  deleteBrand,
  removeBrandSizeRate
};
