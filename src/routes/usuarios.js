const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { adminOnly } = require('../middleware/auth');

router.get('/', adminOnly, async (_req, res) => {
  const { rows } = await db.query(
    'SELECT id,nome,email,nivel,status,vendedor_id,criado_em FROM usuarios ORDER BY nome');
  res.json(rows);
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const { nome, email, senha, nivel, vendedor_id, status } = req.body;
    if (!senha || senha.length < 6) return res.status(400).json({ error: 'Senha mínima 6 caracteres' });
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await db.query(`
      INSERT INTO usuarios (nome,email,senha_hash,nivel,vendedor_id,status)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id,nome,email,nivel,status,vendedor_id`,
      [nome, email.toLowerCase(), hash, nivel||'vendedor', vendedor_id||null, status||'ativo']);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'E-mail já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { nome, email, senha, nivel, vendedor_id, status } = req.body;
    let hash = null;
    if (senha && senha.length >= 6) hash = await bcrypt.hash(senha, 10);

    const { rows } = await db.query(`
      UPDATE usuarios SET
        nome=$1, email=$2, nivel=$3, vendedor_id=$4, status=$5
        ${hash ? ', senha_hash=$7' : ''}
      WHERE id=$6
      RETURNING id,nome,email,nivel,status`,
      hash
        ? [nome, email.toLowerCase(), nivel, vendedor_id||null, status, req.params.id, hash]
        : [nome, email.toLowerCase(), nivel, vendedor_id||null, status, req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
