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

// Ingest Telemetry Data Endpoint
app.post('/api/telemetry', async (req, res) => {
  const { machine_id, vibration, temperature, pressure } = req.body;

  if (!machine_id || vibration === undefined || temperature === undefined || pressure === undefined) {
    return res.status(400).json({ error: 'Missing required telemetry fields' });
  }

  try {
    const queryText = `
      INSERT INTO machine_telemetry (machine_id, vibration, temperature, pressure)
      VALUES ($1, $2, $3, $4) RETURNING *;
    `;
    const values = [machine_id, vibration, temperature, pressure];
    const result = await pool.query(queryText, values);

    // Simple threshold breach logic trigger
    if (vibration > 8.0 || temperature > 90.0) {
      await pool.query(
        `INSERT INTO maintenance_tickets (machine_id, issue_description, severity) 
         VALUES ($1, $2, $3)`,
        [
          machine_id, 
          `High parameter breach detected! Vibration: ${vibration}, Temp: ${temperature}°C`, 
          'high'
        ]
      );
    }

    res.status(201).json({ status: 'success', telemetry: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record telemetry data' });
  }
});

app.listen(PORT, () => {
  console.log(`PlantPulse API server running on port ${PORT}`);
});
