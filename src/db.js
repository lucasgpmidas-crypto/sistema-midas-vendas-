const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || '6543'),
      database: process.env.DB_NAME || 'postgres',
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('connect', (client) => {
      client.query("SET search_path TO midas, public");
    });
    pool.on('error', (err) => {
      console.error('Pool error:', err.message);
      pool = null;
    });
  }
  return pool;
}

module.exports = {
  query: (sql, params) => getPool().query(sql, params),
};
