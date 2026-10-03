const express = require('express');
const {
  createStockEntry,
  getStockEntries,
  getStockEntryById,
  cancelStockEntry,
  getBottleBySerial,
  getAvailableStockSummary,
  getStockReport
} = require('../controllers/stock.controller');

const router = express.Router();

router.post('/entries', createStockEntry);
router.get('/entries', getStockEntries);
router.get('/entries/:id', getStockEntryById);
router.delete('/entries/:id', cancelStockEntry);

router.get('/bottles/:serialNumber', getBottleBySerial);
router.get('/summary', getAvailableStockSummary);
router.get('/reports/stock', getStockReport);

module.exports = router;
