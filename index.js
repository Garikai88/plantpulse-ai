const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const pool = require('./db');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;

// Configure Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your preferred SMTP provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendAlertEmail(machineId, issueDescription) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('[EMAIL SKIP] Email credentials not configured.');
    return;
  }

  const mailOptions = {
    from: `"PlantPulse AI Alerts" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // Send alert to yourself or maintenance lead
    subject: `⚠️ HIGH SEVERITY ALERT: Machine #${machineId}`,
    text: `PlantPulse AI Industrial IoT Engine has detected a critical anomaly.\n\nDetails:\n${issueDescription}\n\nTimestamp: ${new Date().toLocaleString()}\n\nPlease check the dashboard immediately.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SENT] Alert dispatched for Machine #${machineId}`);
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send alert email:', err);
  }
}

// Fetch endpoints...
app.get('/api/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM maintenance_tickets ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

app.get('/api/telemetry/recent', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machine_telemetry ORDER BY recorded_at DESC LIMIT 15');
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

// Post telemetry route with email trigger
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
      const issueDesc = `High parameter breach detected! Vibration: ${vibration}, Temp: ${temperature}°C, Pressure: ${pressure}PSI`;
      
      await pool.query(
        `INSERT INTO maintenance_tickets (machine_id, issue_description, severity) 
         VALUES ($1, $2, $3)`,
        [machine_id, issueDesc, 'high']
      );

      // Trigger email dispatch asynchronously
      sendAlertEmail(machine_id, issueDesc);
    }

    res.status(201).json({ status: 'success', telemetry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record telemetry' });
  }
});

app.listen(PORT, () => {
  console.log(`PlantPulse API server running on port ${PORT}`);
});


