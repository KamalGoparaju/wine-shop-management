const express = require('express');
const {
  createBrand,
  getBrands,
  getBrandById,
  updateBrand,
  toggleBrandStatus
} = require('../controllers/brand.controller');

const router = express.Router();

router.post('/', createBrand);
router.get('/', getBrands);
router.get('/:id', getBrandById);
router.put('/:id', updateBrand);
router.patch('/:id/status', toggleBrandStatus);

module.exports = router;
