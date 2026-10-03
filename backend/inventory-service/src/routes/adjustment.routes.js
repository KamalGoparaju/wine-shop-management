const express = require('express');
const {
  createStockAdjustment,
  getStockAdjustments
} = require('../controllers/adjustment.controller');

const router = express.Router();

router.post('/', createStockAdjustment);
router.get('/', getStockAdjustments);

module.exports = router;
