const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const errorHandler = require('./middleware/error.middleware');
const { seedAdminUser } = require('./utils/seed');

const app = express();
const PORT = process.env.AUTH_PORT || process.env.AUTH_SERVICE_PORT || 5001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// Auth Routes - Mount on multiple base paths for proxy flexibility
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/', authRoutes);

const prisma = require('./config/prisma');

// Global Error Handler
app.use(errorHandler);

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Auth Service running on 0.0.0.0:${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    await seedAdminUser();
  }
});

const shutdown = async (signal) => {
  console.log(`[Auth Service] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('[Auth Service] Database disconnected and HTTP server closed.');
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
