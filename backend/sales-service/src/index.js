const express = require('express');
const cors = require('cors');
require('dotenv').config();

const salesRoutes = require('./routes/sales.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5003;

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

// Sales Routes
app.use('/sales', salesRoutes);
app.use('/api/sales', salesRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Sales Service running on port ${PORT}`);
});

module.exports = app;
