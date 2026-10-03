const express = require('express');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  toggleProductStatus,
  deleteProduct
} = require('../controllers/product.controller');

const router = express.Router();

router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.patch('/:id/status', toggleProductStatus);
router.delete('/:id', deleteProduct);

module.exports = router;
