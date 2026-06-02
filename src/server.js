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
  const cfg = {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '6543'),
    database: process.env.DB_NAME || 'postgres',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  };
  const pool = new Pool(cfg);
  try {
    const r = await pool.query("SET search_path TO midas, public; SELECT current_schema() as schema, NOW() as ts");
    res.json({ ok: true, config: { host: cfg.host, port: cfg.port, user: cfg.user }, result: r[1]?.rows[0] || r.rows[0] });
  } catch(e) {
    res.status(500).json({ ok: false, config: { host: cfg.host, port: cfg.port, user: cfg.user }, error: e.message });
  } finally {
    pool.end().catch(() => {});
  }
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
