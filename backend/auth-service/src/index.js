const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const errorHandler = require('./middleware/error.middleware');
const { seedAdminUser } = require('./utils/seed');

const app = express();
const PORT = process.env.PORT || 5001;

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

// Auth Routes
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes); // Direct access compatibility

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Auth Service running on port ${PORT}`);
  // Run seed check when database is available
  if (process.env.NODE_ENV !== 'test') {
    await seedAdminUser();
  }
});

module.exports = app;
