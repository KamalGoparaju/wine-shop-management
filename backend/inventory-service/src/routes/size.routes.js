const express = require('express');
const {
  getSizes,
  getSizeById,
  createSize,
  updateSize,
  toggleSizeStatus,
  deleteSize
} = require('../controllers/size.controller');

const router = express.Router();

router.get('/', getSizes);
router.get('/:id', getSizeById);
router.post('/', createSize);
router.put('/:id', updateSize);
router.patch('/:id/status', toggleSizeStatus);
router.delete('/:id', deleteSize);

module.exports = router;
