const prisma = require('../config/prisma');

// GET /api/sales/expenses?date=YYYY-MM-DD
const getExpenses = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { date, fromDate, toDate } = req.query;

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID (x-shop-id header or query) is required',
        error: 'SHOP_REQUIRED'
      });
    }

    const where = { shopId };

    if (date) {
      where.businessDate = new Date(`${date}T00:00:00.000Z`);
    } else if (fromDate && toDate) {
      where.businessDate = {
        gte: new Date(`${fromDate}T00:00:00.000Z`),
        lte: new Date(`${toDate}T00:00:00.000Z`)
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const totalExpenseAmount = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

    return res.status(200).json({
      success: true,
      message: 'Expenses retrieved successfully',
      data: {
        totalCount: expenses.length,
        totalExpenseAmount: totalExpenseAmount.toFixed(2),
        expenses
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/sales/expenses
const createExpense = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.body.shopId;
    const { businessDate, category, description, amount, paymentMethod, recipient } = req.body;
    const createdBy = req.headers['x-user-email'] || req.headers['x-user-id'] || 'Admin';

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Active Shop ID is required',
        error: 'SHOP_REQUIRED'
      });
    }

    if (!businessDate || !description || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'businessDate, description, and amount are required',
        error: 'VALIDATION_ERROR'
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0',
        error: 'VALIDATION_ERROR'
      });
    }

    const expense = await prisma.expense.create({
      data: {
        shopId,
        businessDate: new Date(`${businessDate}T00:00:00.000Z`),
        category: category ? category.trim().toUpperCase() : 'MISC',
        description: description.trim(),
        amount: parsedAmount,
        paymentMethod: paymentMethod || 'CASH',
        recipient: recipient ? recipient.trim() : null,
        createdBy
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      data: { expense }
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/sales/expenses/:id
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shopId = req.headers['x-shop-id'];

    const where = { id };
    if (shopId) where.shopId = shopId;

    await prisma.expense.delete({ where });

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
      data: null
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found',
        error: 'EXPENSE_NOT_FOUND'
      });
    }
    next(error);
  }
};

module.exports = {
  getExpenses,
  createExpense,
  deleteExpense
};
