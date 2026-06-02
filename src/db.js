const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'db.mqdmsyljjgyusovwfndo.supabase.co',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'postgres',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', (client) => {
  client.query("SET search_path TO midas, public");
});

pool.on('error', (err) => {
  console.error('Erro no pool PostgreSQL:', err.message);
});

module.exports = pool;
