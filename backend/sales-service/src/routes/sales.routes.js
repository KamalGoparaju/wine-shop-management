const express = require('express');
const {
  createSale,
  getSales,
  getSaleById,
  getSalesReport
} = require('../controllers/sales.controller');

const router = express.Router();

router.post('/', createSale);
router.get('/', getSales);
router.get('/reports/summary', getSalesReport);
router.get('/:id', getSaleById);

module.exports = router;
