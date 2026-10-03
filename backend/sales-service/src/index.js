const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'sales-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Sales Service Running' });
});

app.listen(PORT, () => {
  console.log(`Sales Service running on port ${PORT}`);
});
