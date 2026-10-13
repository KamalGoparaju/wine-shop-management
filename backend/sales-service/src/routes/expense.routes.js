const express = require('express');
const {
  getExpenses,
  createExpense,
  deleteExpense
} = require('../controllers/expense.controller');

const router = express.Router();

router.get('/', getExpenses);
router.post('/', createExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
