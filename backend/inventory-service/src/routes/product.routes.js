const express = require('express');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductStatus
} = require('../controllers/product.controller');

const router = express.Router();

router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.patch('/:id/status', toggleProductStatus);

module.exports = router;
