const express = require('express');
const { getRates, upsertRate } = require('../controllers/rate.controller');

const router = express.Router();

router.get('/', getRates);
router.post('/', upsertRate);

module.exports = router;
