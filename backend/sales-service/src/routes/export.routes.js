const express = require('express');
const {
  exportClosingHistoryCSV,
  exportClosingPdf,
  exportExpensesCSV,
  exportClosingHistoryExcel,
  exportClosingExcel
} = require('../controllers/export.controller');

const router = express.Router();

router.get('/csv', exportClosingHistoryCSV);
router.get('/excel', exportClosingHistoryExcel);
router.get('/closing/pdf', exportClosingPdf);
router.get('/closing/excel', exportClosingExcel);
router.get('/expenses/csv', exportExpensesCSV);

module.exports = router;
