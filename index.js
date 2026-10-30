const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Health Check Endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'active', system: 'PlantPulse AI Engine' });
});

// Fetch all machines
app.get('/api/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failure' });
  }
});

app.listen(PORT, () => {
  console.log(`PlantPulse API server running on port ${PORT}`);
});