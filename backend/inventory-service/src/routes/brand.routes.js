const express = require('express');
const {
  createBrand,
  getNextSerial,
  createBrandWithRates,
  getBrands,
  getBrandById,
  updateBrand,
  toggleBrandStatus,
  deleteBrand
} = require('../controllers/brand.controller');

const router = express.Router();

router.get('/next-serial', getNextSerial);
router.post('/with-rates', createBrandWithRates);
router.post('/', createBrand);
router.get('/', getBrands);
router.get('/:id', getBrandById);
router.put('/:id', updateBrand);
router.patch('/:id/status', toggleBrandStatus);
router.delete('/:id', deleteBrand);

module.exports = router;
