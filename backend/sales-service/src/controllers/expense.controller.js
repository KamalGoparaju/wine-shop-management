const prisma = require('../config/prisma');
const {
  parsePaginationParams,
  buildSortClause,
  buildPaginationMetadata
} = require('../utils/pagination.util');

// GET /api/sales/expenses?date=YYYY-MM-DD
const getExpenses = async (req, res, next) => {
  try {
    const shopId = req.headers['x-shop-id'] || req.query.shopId;
    const { date, fromDate, toDate, search, category, paymentMethod, sortBy, sortOrder } = req.query;

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
    } else if (fromDate) {
      where.businessDate = {
        gte: new Date(`${fromDate}T00:00:00.000Z`)
      };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { description: { contains: term, mode: 'insensitive' } },
        { recipient: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } }
      ];
    }

    if (category && category !== 'all') {
      where.category = category.trim().toUpperCase();
    }

    if (paymentMethod && paymentMethod !== 'all') {
      where.paymentMethod = paymentMethod.trim().toUpperCase();
    }

    const isExplicitlyPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.paginate === 'true';
    const pagination = parsePaginationParams(req.query);

    const orderBy = buildSortClause({
      sortBy,
      sortOrder,
      allowedFields: ['createdAt', 'businessDate', 'amount', 'category', 'paymentMethod'],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc',
      tieBreaker: 'id'
    });

    let totalRecords;
    let totalExpenseAmount = 0;
    let expenses;

    if (isExplicitlyPaginated && pagination.isPaginated) {
      const [aggregateResult, pagedExpenses] = await prisma.$transaction([
        prisma.expense.aggregate({
          where,
          _count: { _all: true },
          _sum: { amount: true }
        }),
        prisma.expense.findMany({
          where,
          orderBy,
          skip: pagination.skip,
          take: pagination.take
        })
      ]);

      totalRecords = aggregateResult._count._all || 0;
      totalExpenseAmount = aggregateResult._sum.amount ? parseFloat(aggregateResult._sum.amount) : 0;
      expenses = pagedExpenses;
    } else {
      expenses = await prisma.expense.findMany({
        where,
        orderBy
      });
      totalRecords = expenses.length;
      totalExpenseAmount = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
    }

    const paginationMetadata = buildPaginationMetadata(
      totalRecords,
      pagination.page,
      pagination.limit
    );

    return res.status(200).json({
      success: true,
      message: 'Expenses retrieved successfully',
      data: {
        totalCount: totalRecords,
        totalExpenseAmount: totalExpenseAmount.toFixed(2),
        expenses,
        pagination: paginationMetadata
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
