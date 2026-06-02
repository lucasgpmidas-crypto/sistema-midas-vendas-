const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1 AND status = $2',
      [email.toLowerCase().trim(), 'ativo']
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    const payload = {
      id: user.id, nome: user.nome, email: user.email,
      nivel: user.nivel, vendedor_id: user.vendedor_id
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });

    res.json({ token, user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/trocar-senha
const { authMiddleware } = require('../middleware/auth');
router.post('/trocar-senha', authMiddleware, async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha || nova_senha.length < 6)
    return res.status(400).json({ error: 'Senha nova deve ter no mínimo 6 caracteres' });

  try {
    const { rows } = await db.query('SELECT senha_hash FROM usuarios WHERE id=$1', [req.user.id]);
    const ok = await bcrypt.compare(senha_atual, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(nova_senha, 10);
    await db.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
