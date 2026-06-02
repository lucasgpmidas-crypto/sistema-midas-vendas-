const { Pool } = require('pg');

// Supabase → Project Settings → Database → Connection string → URI
// O search_path='midas' isola as tabelas do Midas dos outros projetos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // obrigatório no Supabase
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Definir search_path em todas as conexões novas
pool.on('connect', (client) => {
  client.query("SET search_path TO midas, public");
});

pool.on('er