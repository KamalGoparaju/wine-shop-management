const express = require('express');
const {
  createBrand,
  getBrands,
  getBrandById,
  updateBrand,
  toggleBrandStatus,
  deleteBrand
} = require('../controllers/brand.controller');

const router = express.Router();

router.post('/', createBrand);
router.get('/', getBrands);
router.get('/:id', getBrandById);
router.put('/:id', updateBrand);
router.patch('/:id/status', toggleBrandStatus);
router.delete('/:id', deleteBrand);

module.exports = router;
