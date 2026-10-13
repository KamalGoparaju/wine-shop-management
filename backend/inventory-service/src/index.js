const express = require('express');
const cors = require('cors');
require('dotenv').config();

const brandRoutes = require('./routes/brand.routes');
const productRoutes = require('./routes/product.routes');
const stockRoutes = require('./routes/stock.routes');
const adjustmentRoutes = require('./routes/adjustment.routes');
const dailyStockRoutes = require('./routes/dailyStock.routes');
const sizeRoutes = require('./routes/size.routes');
const rateRoutes = require('./routes/rate.routes');
const errorHandler = require('./middleware/error.middleware');
const prisma = require('./config/prisma');

const app = express();
const PORT = process.env.INVENTORY_PORT || process.env.INVENTORY_SERVICE_PORT || 5002;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'inventory-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/daily-stock', dailyStockRoutes);
app.use('/api/inventory/daily-stock', dailyStockRoutes);

app.use('/sizes', sizeRoutes);
app.use('/api/inventory/sizes', sizeRoutes);

app.use('/rates', rateRoutes);
app.use('/api/inventory/rates', rateRoutes);

app.use('/brands', brandRoutes);
app.use('/api/inventory/brands', brandRoutes);

app.use('/products', productRoutes);
app.use('/api/inventory/products', productRoutes);

app.use('/stock', stockRoutes);
app.use('/api/inventory/stock', stockRoutes);

app.use('/adjustments', adjustmentRoutes);
app.use('/api/inventory/adjustments', adjustmentRoutes);

// Global Error Handler
app.use(errorHandler);

const seedDefaultSizes = async () => {
  try {
    const count = await prisma.size.count();
    if (count === 0) {
      await prisma.size.createMany({
        data: [
          { code: 'Q', name: 'Quart (750ml)', volumeMl: 750, isActive: true, description: 'Standard Quart bottle' },
          { code: 'P', name: 'Pint (375ml)', volumeMl: 375, isActive: true, description: 'Standard Pint bottle' },
          { code: 'N', name: 'Nip (180ml)', volumeMl: 180, isActive: true, description: 'Standard Nip bottle' }
        ]
      });
      console.log('[Inventory Service Seed] Default sizes (Q, P, N) initialized');
    }
  } catch (err) {
    console.warn('[Inventory Service Seed] Note on size initialization:', err.message);
  }
};

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Inventory Service running on 0.0.0.0:${PORT}`);
  seedDefaultSizes();
});

const shutdown = async (signal) => {
  console.log(`[Inventory Service] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('[Inventory Service] Database disconnected and HTTP server closed.');
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
