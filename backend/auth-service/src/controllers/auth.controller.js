const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { generateToken } = require('../utils/token');

// Login controller
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact an administrator.',
        error: 'ACCOUNT_DEACTIVATED'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Fetch accessible shops
    let shops = [];
    if (user.role === 'ADMIN') {
      shops = await prisma.shop.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });
    } else {
      const userShops = await prisma.userShop.findMany({
        where: { userId: user.id, shop: { isActive: true } },
        include: { shop: true },
        orderBy: { shop: { code: 'asc' } }
      });
      shops = userShops.map(us => us.shop);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        shops
      }
    });
  } catch (error) {
    next(error);
  }
};

// Register controller (Creating users)
const register = async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
        error: 'USER_ALREADY_EXISTS'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role && ['ADMIN', 'STAFF'].includes(role.toUpperCase()) 
      ? role.toUpperCase() 
      : 'STAFF';

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        role: userRole
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: newUser }
    });
  } catch (error) {
    next(error);
  }
};

// Get current user profile (/me)
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }

    // Fetch accessible shops
    let shops = [];
    if (user.role === 'ADMIN') {
      shops = await prisma.shop.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });
    } else {
      const userShops = await prisma.userShop.findMany({
        where: { userId: user.id, shop: { isActive: true } },
        include: { shop: true },
        orderBy: { shop: { code: 'asc' } }
      });
      shops = userShops.map(us => us.shop);
    }

    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: { user, shops }
    });
  } catch (error) {
    next(error);
  }
};

// List all users (ADMIN only)
const getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: { users }
    });
  } catch (error) {
    next(error);
  }
};

// Toggle user activation status (ADMIN only)
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value',
        error: 'VALIDATION_ERROR'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    });

    return res.status(200).json({
      success: true,
      message: `User status updated to ${isActive ? 'active' : 'inactive'}`,
      data: { user: updatedUser }
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }
    next(error);
  }
};

module.exports = {
  login,
  register,
  getProfile,
  getUsers,
  updateUserStatus
};
