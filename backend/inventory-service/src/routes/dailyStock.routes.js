const express = require('express');
const {
  getDailyStockSheet,
  saveDailyStockSheet,
  lockDailyStockSheet,
  unlockDailyStockSheet,
  exportDailyStockPdf,
  exportDailyStockCsv,
  exportDailyStockExcel
} = require('../controllers/dailyStock.controller');

const router = express.Router();

router.get('/export/pdf', exportDailyStockPdf);
router.get('/export/csv', exportDailyStockCsv);
router.get('/export/excel', exportDailyStockExcel);
router.get('/', getDailyStockSheet);
router.post('/', saveDailyStockSheet);
router.post('/lock', lockDailyStockSheet);
router.post('/unlock', unlockDailyStockSheet);

module.exports = router;

