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
const {
  analyzeImportBatch,
  confirmImportBatch
} = require('../controllers/dailyStockImport.controller');
const multer = require('multer');

// Configure multer memory storage for non-persistent staging
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 10
  }
});

const router = express.Router();

// Import & Verification routes
router.post('/import/analyze', upload.array('files', 10), analyzeImportBatch);
router.post('/import/confirm', confirmImportBatch);

router.get('/export/pdf', exportDailyStockPdf);
router.get('/export/csv', exportDailyStockCsv);
router.get('/export/excel', exportDailyStockExcel);
router.get('/', getDailyStockSheet);
router.post('/', saveDailyStockSheet);
router.post('/lock', lockDailyStockSheet);
router.post('/unlock', unlockDailyStockSheet);

module.exports = router;

