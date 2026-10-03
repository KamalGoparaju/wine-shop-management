const express = require('express');
const cors = require('cors');
require('dotenv').config();

const brandRoutes = require('./routes/brand.routes');
const productRoutes = require('./routes/product.routes');
const stockRoutes = require('./routes/stock.routes');
const adjustmentRoutes = require('./routes/adjustment.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5002;

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

app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});

module.exports = app;
