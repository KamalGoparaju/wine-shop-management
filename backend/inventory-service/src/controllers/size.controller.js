const prisma = require('../config/prisma');

// Get sizes list with optional search & active/inactive filtering
const getSizes = async (req, res, next) => {
  try {
    const { search, isActive, includeInactive } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { name: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    if (isActive !== undefined) {
      if (isActive === 'true') where.isActive = true;
      else if (isActive === 'false') where.isActive = false;
      // if isActive === 'all', do not filter by isActive
    } else if (includeInactive !== 'true') {
      // Default to active sizes only for backwards compatibility with Brand modal
      where.isActive = true;
    }

    const sizes = await prisma.size.findMany({
      where,
      include: {
        _count: {
          select: {
            rates: true,
            dailyStockRecords: true
          }
        }
      },
      orderBy: [
        { volumeMl: 'desc' },
        { code: 'asc' }
      ]
    });

    return res.status(200).json({
      success: true,
      message: 'Sizes retrieved successfully',
      data: { sizes }
    });
  } catch (error) {
    next(error);
  }
};

// Get size by ID
const getSizeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const size = await prisma.size.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            rates: true,
            dailyStockRecords: true
          }
        }
      }
    });

    if (!size) {
      return res.status(404).json({
        success: false,
        message: 'Size not found',
        error: 'SIZE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Size retrieved successfully',
      data: { size }
    });
  } catch (error) {
    next(error);
  }
};

// Create a new size in Size Master
const createSize = async (req, res, next) => {
  try {
    const { code, name, volumeMl, description, isActive = true } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Size code / abbreviation is required',
        error: 'VALIDATION_ERROR'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Display name is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const trimmedCode = code.trim().toUpperCase();

    // Check duplicate code (case-insensitive)
    const existingSize = await prisma.size.findFirst({
      where: {
        code: {
          equals: trimmedCode,
          mode: 'insensitive'
        }
      }
    });

    if (existingSize) {
      return res.status(409).json({
        success: false,
        message: `Size with code '${trimmedCode}' already exists (${existingSize.name})`,
        error: 'DUPLICATE_SIZE_CODE'
      });
    }

    let parsedVolume = null;
    if (volumeMl !== undefined && volumeMl !== null && volumeMl !== '') {
      parsedVolume = parseInt(volumeMl, 10);
      if (isNaN(parsedVolume) || parsedVolume < 0) {
        return res.status(400).json({
          success: false,
          message: 'Volume in ML must be a non-negative number if specified',
          error: 'VALIDATION_ERROR'
        });
      }
    }

    const size = await prisma.size.create({
      data: {
        code: trimmedCode,
        name: name.trim(),
        volumeMl: parsedVolume,
        description: description ? description.trim() : null,
        isActive: Boolean(isActive)
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Size created successfully in Size Master',
      data: { size }
    });
  } catch (error) {
    next(error);
  }
};

// Update existing size
const updateSize = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, volumeMl, description, isActive } = req.body;

    const existingSize = await prisma.size.findUnique({
      where: { id }
    });

    if (!existingSize) {
      return res.status(404).json({
        success: false,
        message: 'Size not found',
        error: 'SIZE_NOT_FOUND'
      });
    }

    const updateData = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Display name cannot be empty',
          error: 'VALIDATION_ERROR'
        });
      }
      updateData.name = name.trim();
    }

    if (code !== undefined) {
      if (!code.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Size code cannot be empty',
          error: 'VALIDATION_ERROR'
        });
      }
      const trimmedCode = code.trim().toUpperCase();
      if (trimmedCode !== existingSize.code) {
        const dupCode = await prisma.size.findFirst({
          where: {
            code: { equals: trimmedCode, mode: 'insensitive' },
            NOT: { id }
          }
        });
        if (dupCode) {
          return res.status(409).json({
            success: false,
            message: `Another size with code '${trimmedCode}' already exists`,
            error: 'DUPLICATE_SIZE_CODE'
          });
        }
      }
      updateData.code = trimmedCode;
    }

    if (volumeMl !== undefined) {
      if (volumeMl === null || volumeMl === '') {
        updateData.volumeMl = null;
      } else {
        const parsed = parseInt(volumeMl, 10);
        if (isNaN(parsed) || parsed < 0) {
          return res.status(400).json({
            success: false,
            message: 'Volume in ML must be a non-negative number',
            error: 'VALIDATION_ERROR'
          });
        }
        updateData.volumeMl = parsed;
      }
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const updatedSize = await prisma.size.update({
      where: { id },
      data: updateData
    });

    return res.status(200).json({
      success: true,
      message: 'Size updated successfully',
      data: { size: updatedSize }
    });
  } catch (error) {
    next(error);
  }
};

// Toggle size active/inactive status
const toggleSizeStatus = async (req, res, next) => {
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

    const updatedSize = await prisma.size.update({
      where: { id },
      data: { isActive }
    });

    return res.status(200).json({
      success: true,
      message: `Size '${updatedSize.code}' ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { size: updatedSize }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Size not found',
        error: 'SIZE_NOT_FOUND'
      });
    }
    next(error);
  }
};

// Delete size (rejects if referenced by historical records or brand rates)
const deleteSize = async (req, res, next) => {
  try {
    const { id } = req.params;

    const size = await prisma.size.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            rates: true,
            dailyStockRecords: true
          }
        }
      }
    });

    if (!size) {
      return res.status(404).json({
        success: false,
        message: 'Size not found',
        error: 'SIZE_NOT_FOUND'
      });
    }

    if (size._count.rates > 0 || size._count.dailyStockRecords > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete size '${size.code}' (${size.name}): it is referenced by ${size._count.rates} brand rate(s) and ${size._count.dailyStockRecords} daily stock record(s). Deactivate the size instead to preserve historical records.`,
        error: 'SIZE_IN_USE'
      });
    }

    await prisma.size.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: `Size '${size.code}' deleted successfully`,
      data: null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSizes,
  getSizeById,
  createSize,
  updateSize,
  toggleSizeStatus,
  deleteSize
};
