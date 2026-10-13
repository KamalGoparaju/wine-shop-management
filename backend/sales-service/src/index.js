const express = require('express');
const cors = require('cors');
require('dotenv').config();

const salesRoutes = require('./routes/sales.routes');
const expenseRoutes = require('./routes/expense.routes');
const closingRoutes = require('./routes/closing.routes');
const exportRoutes = require('./routes/export.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.SALES_PORT || process.env.SALES_SERVICE_PORT || 5003;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'sales-service',
    timestamp: new Date().toISOString()
  });
});

// Sales, Expense, Closing, and Export Routes
app.use('/sales', salesRoutes);
app.use('/api/sales', salesRoutes);

app.use('/expenses', expenseRoutes);
app.use('/api/sales/expenses', expenseRoutes);

app.use('/closing', closingRoutes);
app.use('/api/sales/closing', closingRoutes);

app.use('/export', exportRoutes);
app.use('/api/sales/export', exportRoutes);

const prisma = require('./config/prisma');

// Global Error Handler
app.use(errorHandler);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sales Service running on 0.0.0.0:${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`[Sales Service] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('[Sales Service] Database disconnected and HTTP server closed.');
    } catch (e) {}
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
