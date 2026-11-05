const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(express.json());

// Serve static dashboard files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;

// Fetch all machines
app.get('/api/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

// Fetch recent maintenance tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maintenance_tickets ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

// Fetch recent telemetry logs for charting
app.get('/api/telemetry/recent', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machine_telemetry ORDER BY recorded_at DESC LIMIT 15');
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

// Post telemetry route
app.post('/api/telemetry', async (req, res) => {
  const { machine_id, vibration, temperature, pressure } = req.body;

  if (!machine_id || vibration === undefined || temperature === undefined || pressure === undefined) {
    return res.status(400).json({ error: 'Missing telemetry fields' });
  }

  try {
    const queryText = `
      INSERT INTO machine_telemetry (machine_id, vibration, temperature, pressure)
      VALUES ($1, $2, $3, $4) RETURNING *;
    `;
    const result = await pool.query(queryText, [machine_id, vibration, temperature, pressure]);

    if (vibration > 8.0 || temperature > 90.0) {
      await pool.query(
        `INSERT INTO maintenance_tickets (machine_id, issue_description, severity) 
         VALUES ($1, $2, $3)`,
        [machine_id, `High parameter breach detected! Vibration: ${vibration}, Temp: ${temperature}°C`, 'high']
      );
    }

    res.status(201).json({ status: 'success', telemetry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record telemetry' });
  }
});

app.listen(PORT, () => {
  console.log(`PlantPulse API server running on port ${PORT}`);
});

