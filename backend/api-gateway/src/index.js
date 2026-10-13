const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const { verifyGatewayToken } = require('./middleware/auth.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || `http://127.0.0.1:${process.env.AUTH_PORT || 5001}`;
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || `http://127.0.0.1:${process.env.INVENTORY_PORT || 5002}`;
const SALES_SERVICE_URL = process.env.SALES_SERVICE_URL || `http://127.0.0.1:${process.env.SALES_PORT || 5003}`;

// Configurable CORS for production deployment
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(cors({
  origin: corsOrigins === '*' ? '*' : corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-shop-id', 'x-shop-code', 'x-shop-name'],
  exposedHeaders: ['Content-Disposition']
}));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Root Endpoint (Sanitized - does not disclose internal network topology)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Wine Shop Management System API Gateway Active',
    version: '1.0.0'
  });
});

// Auth Service Proxy
app.use('/api/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true
}));

// Inventory Service Proxy (Protected)
app.use('/api/inventory', verifyGatewayToken, createProxyMiddleware({
  target: INVENTORY_SERVICE_URL,
  changeOrigin: true
}));

// Sales Service Proxy (Protected)
app.use('/api/sales', verifyGatewayToken, createProxyMiddleware({
  target: SALES_SERVICE_URL,
  changeOrigin: true
}));

// Global Error Handler
app.use(errorHandler);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway listening on 0.0.0.0:${PORT}`);
  console.log(`  -> Auth Service: ${AUTH_SERVICE_URL}`);
  console.log(`  -> Inventory Service: ${INVENTORY_SERVICE_URL}`);
  console.log(`  -> Sales Service: ${SALES_SERVICE_URL}`);
});

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`[API Gateway] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[API Gateway] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[API Gateway] Forceful termination.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
