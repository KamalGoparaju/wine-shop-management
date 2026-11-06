const express = require('express');
const {
  createBrand,
  getNextSerial,
  getBrandBySerialNo,
  createBrandWithRates,
  getBrands,
  getBrandById,
  getBrandConfiguredSizes,
  updateBrand,
  toggleBrandStatus,
  deleteBrand,
  removeBrandSizeRate
} = require('../controllers/brand.controller');

const router = express.Router();

router.get('/next-serial', getNextSerial);
router.get('/by-serial/:serialNo', getBrandBySerialNo);
router.post('/with-rates', createBrandWithRates);
router.post('/', createBrand);
router.get('/', getBrands);
router.get('/:id/sizes', getBrandConfiguredSizes);
router.get('/:id', getBrandById);
router.put('/:id', updateBrand);
router.patch('/:id/status', toggleBrandStatus);
router.delete('/:id/sizes/:sizeId', removeBrandSizeRate);
router.delete('/:id', deleteBrand);

module.exports = router;
