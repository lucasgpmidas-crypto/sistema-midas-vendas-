require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const { authMiddleware } = require('./middleware/auth');

const app = express();

// ── Segurança e performance ────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '2mb' }));

// Rate limit apenas no login
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' }
}));

// ── Diagnóstico temporário ────────────────────────────────
app.get('/api/ping', async (_req, res) => {
  const { Pool } = require('pg');
  const configs = [
    { label: 'pooler-ref-6543', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543, user: 'postgres.mqdmsyljjgyusovwfndo', password: process.env.DB_PASSWORD },
    { label: 'pooler-plain-6543', host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543, user: 'postgres', password: process.env.DB_PASSWORD },
    { label: 'direct-5432', host: 'db.mqdmsyljjgyusovwfndo.supabase.co', port: 5432, user: 'postgres', password: process.env.DB_PASSWORD },
  ];
  const results = {};
  for (const cfg of configs) {
    const { label, ...conn } = cfg;
    const pool = new Pool({ ...conn, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    try {
      await pool.query('SELECT 1');
      results[label] = 'OK';
    } catch(e) {
      results[label] = e.message;
    } finally {
      pool.end().catch(() => {});
    }
  }
  res.json(results);
});

// ── Rotas da API ───────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/dashboard',  authMiddleware, require('./routes/dashboard'));
app.use('/api/clientes',   authMiddleware, require('./routes/clientes'));
app.use('/api/produtos',   authMiddleware, require('./routes/produtos'));
app.use('/api/vendedores', authMiddleware, require('./routes/vendedores'));
app.use('/api/vendas',     authMiddleware, require('./routes/vendas'));
app.use('/api/estoque',    authMiddleware, require('./routes/estoque'));
app.use('/api/financeiro', authMiddleware, require('./routes/financeiro'));
app.use('/api/usuarios',   authMiddleware, require('./routes/usuarios'));

// ── Frontend estático ──────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Erro global ───────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`✅ Midas rodando na porta ${PORT}`));
}

module.exports = app;
