const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
const pool = require('./db');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;

// Configure Nodemailer transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key'
});

async function sendAlertEmail(machineId, issueDescription) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('[EMAIL SKIP] Email credentials not configured.');
    return;
  }

  const mailOptions = {
    from: `"PlantPulse AI Alerts" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
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

// Fetch all machines
app.get('/api/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

// Fetch recent maintenance tickets (with optional machine filter)
app.get('/api/tickets', async (req, res) => {
  const { machine_id } = req.query;
  try {
    let query = 'SELECT * FROM maintenance_tickets';
    let params = [];
    if (machine_id) {
      query += ' WHERE machine_id = $1';
      params.push(machine_id);
    }
    query += ' ORDER BY created_at DESC LIMIT 10';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

// Fetch recent telemetry logs for charting (with optional machine filter)
app.get('/api/telemetry/recent', async (req, res) => {
  const { machine_id } = req.query;
  try {
    let query = 'SELECT * FROM machine_telemetry';
    let params = [];
    if (machine_id) {
      query += ' WHERE machine_id = $1';
      params.push(machine_id);
    }
    query += ' ORDER BY recorded_at DESC LIMIT 15';
    const result = await pool.query(query, params);
    res.json(result.rows.reverse()); 
  } catch (err) {
    res.status(500).json({ error: 'Database query failure' });
  }
});

// AI Predictive Maintenance Insight Endpoint
app.get('/api/machines/:id/ai-insights', async (req, res) => {
  const machineId = req.params.id;
  try {
    const telemetryResult = await pool.query(
      'SELECT vibration, temperature, pressure, recorded_at FROM machine_telemetry WHERE machine_id = $1 ORDER BY recorded_at DESC LIMIT 20',
      [machineId]
    );

    const machineResult = await pool.query('SELECT * FROM machines WHERE id = $1', [machineId]);

    if (machineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    const machine = machineResult.rows[0];
    const logs = telemetryResult.rows;

    if (logs.length === 0) {
      return res.json({ insight: 'Insufficient telemetry data available for AI analysis yet.' });
    }

    // Fallback analytical simulation if no live OpenAI API key is set
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'mock-key') {
      const avgTemp = (logs.reduce((acc, l) => acc + parseFloat(l.temperature), 0) / logs.length).toFixed(1);
      const avgVib = (logs.reduce((acc, l) => acc + parseFloat(l.vibration), 0) / logs.length).toFixed(1);
      
      let statusSummary = `AI Diagnostic for ${machine.name} (${machine.location}): Average temperature is ${avgTemp}°C and average vibration is ${avgVib} mm/s over the last 20 telemetry cycles. `;
      statusSummary += avgVib > 7.0 || avgTemp > 85.0 
        ? '⚠️ Warning: Elevated wear patterns detected on mechanical bearings. Recommend preventative alignment check within 24 hours.' 
        : '✅ Status Normal: Operating within safe parametric thresholds. No immediate action required.';
      
      return res.json({ insight: statusSummary });
    }

    const prompt = `You are an expert industrial machinery reliability engineer. Analyze these recent telemetry readings for ${machine.name} (${machine.location}):\n${JSON.stringify(logs, null, 2)}\n\nProvide a concise 2-sentence predictive maintenance health summary and recommendation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150
    });

    res.json({ insight: completion.choices[0].message.content });

  } catch (err) {
    console.error('AI Insight Error:', err);
    res.status(500).json({ error: 'Failed to generate AI predictive insights' });
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





