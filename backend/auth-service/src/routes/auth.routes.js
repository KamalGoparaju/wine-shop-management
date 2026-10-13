const express = require('express');
const {
  login,
  register,
  getProfile,
  getUsers,
  updateUserStatus
} = require('../controllers/auth.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const {
  getAccessibleShops,
  getShopById,
  updateShop
} = require('../controllers/shop.controller');

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/register', register); // Initial admin creation or gateway internal registration

// Protected routes
router.get('/me', authenticateToken, getProfile);
router.get('/users', authenticateToken, authorizeRoles('ADMIN'), getUsers);
router.patch('/users/:id/status', authenticateToken, authorizeRoles('ADMIN'), updateUserStatus);

// Shop routes (Protected)
router.get('/shops', authenticateToken, getAccessibleShops);
router.get('/shops/:id', authenticateToken, getShopById);
router.put('/shops/:id', authenticateToken, authorizeRoles('ADMIN'), updateShop);

module.exports = router;
