const express = require('express');
const {
  login,
  register,
  getProfile,
  getUsers,
  updateUserStatus
} = require('../controllers/auth.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/register', register); // Initial admin creation or gateway internal registration

// Protected routes
router.get('/me', authenticateToken, getProfile);
router.get('/users', authenticateToken, authorizeRoles('ADMIN'), getUsers);
router.patch('/users/:id/status', authenticateToken, authorizeRoles('ADMIN'), updateUserStatus);

module.exports = router;
