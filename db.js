const { Pool } = require('pg');
require('dotenv').config();

// Automatically uses Render's DATABASE_URL environment variable in production, 
// or falls back to local configuration if needed.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database successfully.');
});

module.exports = pool;
