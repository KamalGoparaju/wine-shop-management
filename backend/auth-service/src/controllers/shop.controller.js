const prisma = require('../config/prisma');

// Get all accessible shops for current user
const getAccessibleShops = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let shops = [];
    if (userRole === 'ADMIN') {
      shops = await prisma.shop.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });
    } else {
      const userShops = await prisma.userShop.findMany({
        where: { userId, shop: { isActive: true } },
        include: { shop: true },
        orderBy: { shop: { code: 'asc' } }
      });
      shops = userShops.map(us => us.shop);
    }

    return res.status(200).json({
      success: true,
      message: 'Accessible shops retrieved successfully',
      data: { shops }
    });
  } catch (error) {
    next(error);
  }
};

// Get shop details by ID
const getShopById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shop = await prisma.shop.findUnique({
      where: { id }
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
        error: 'SHOP_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Shop details retrieved successfully',
      data: { shop }
    });
  } catch (error) {
    next(error);
  }
};

// Update shop details (ADMIN only)
const updateShop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, isActive } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Shop name cannot be empty',
          error: 'VALIDATION_ERROR'
        });
      }
    }

    const shop = await prisma.shop.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address ? address.trim() : null }),
        ...(typeof isActive === 'boolean' && { isActive })
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Shop updated successfully',
      data: { shop }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
        error: 'SHOP_NOT_FOUND'
      });
    }
    next(error);
  }
};

module.exports = {
  getAccessibleShops,
  getShopById,
  updateShop
};
