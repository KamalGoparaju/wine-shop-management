const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
require('dotenv').config();

const { verifyGatewayToken } = require('./middleware/auth.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:5002';
const SALES_SERVICE_URL = process.env.SALES_SERVICE_URL || 'http://localhost:5003';

app.use(cors());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Wine Shop Management System API Gateway Active',
    services: {
      auth: `${AUTH_SERVICE_URL}/health`,
      inventory: `${INVENTORY_SERVICE_URL}/health`,
      sales: `${SALES_SERVICE_URL}/health`
    }
  });
});

// Proxy routes
// Auth Service Proxy
app.use('/api/auth', proxy(AUTH_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    return `/auth${req.url}`;
  },
  proxyErrorHandler: (err, res, next) => {
    res.status(503).json({
      success: false,
      message: 'Auth Service is unavailable',
      error: 'AUTH_SERVICE_UNAVAILABLE'
    });
  }
}));

// Inventory Service Proxy (Protected)
app.use('/api/inventory', verifyGatewayToken, proxy(INVENTORY_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    return req.url;
  },
  proxyErrorHandler: (err, res, next) => {
    res.status(503).json({
      success: false,
      message: 'Inventory Service is unavailable',
      error: 'INVENTORY_SERVICE_UNAVAILABLE'
    });
  }
}));

// Sales Service Proxy (Protected)
app.use('/api/sales', verifyGatewayToken, proxy(SALES_SERVICE_URL, {
  proxyReqPathResolver: (req) => {
    return req.url;
  },
  proxyErrorHandler: (err, res, next) => {
    res.status(503).json({
      success: false,
      message: 'Sales Service is unavailable',
      error: 'SALES_SERVICE_UNAVAILABLE'
    });
  }
}));

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
  console.log(`  -> Auth Service: ${AUTH_SERVICE_URL}`);
  console.log(`  -> Inventory Service: ${INVENTORY_SERVICE_URL}`);
  console.log(`  -> Sales Service: ${SALES_SERVICE_URL}`);
});

module.exports = app;
