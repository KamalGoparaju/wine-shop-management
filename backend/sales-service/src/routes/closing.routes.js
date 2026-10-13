const express = require('express');
const {
  getClosingStatus,
  executeClosing,
  reopenClosing,
  getClosingHistory
} = require('../controllers/closing.controller');

const router = express.Router();

router.get('/status', getClosingStatus);
router.post('/', executeClosing);
router.post('/reopen', reopenClosing);
router.get('/history', getClosingHistory);

module.exports = router;
