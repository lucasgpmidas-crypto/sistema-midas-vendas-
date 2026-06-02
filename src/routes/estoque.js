const router = require('express').Router();
const db = require('../db');
const { canAccess } = require('../middleware/auth');

// GET /api/estoque/movimentacoes
router.get('/movimentacoes', canAccess('admin','gerente','estoque'), async (req, res) => {
  try {
    const { produto_id, page=1, limit=100 } = req.query;
    const off = (page-1)*limit;
    let where = ['1=1']; const p = [];
    if (produto_id) { p.push(produto_id); where.push(`m.produto_id=$${p.length}`); }
    p.push(limit, off);
    const { rows } = await db.query(`
      SELECT m.*, pr.nome AS produto_nome, u.nome AS usuario_nome
      FROM mov_estoque m
      LEFT JOIN produtos pr ON pr.id = m.produto_id
      LEFT JOIN usuarios u  ON u.id  = m.usuario_id
      WHERE ${where.join(' AND ')}
      ORDER BY m.criado_em DESC
      LIMIT $${p.length-1} OFFSET $${p.length}`, p);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/estoque/movimentacao
router.post('/movimentacao', canAccess('admin','gerente','estoque'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { produto_id, tipo, quantidade, obs } = req.body;
    if (!produto_id || !tipo || !quantidade) throw new Error('Campos obrigatórios faltando');

    const { rows: pr } = await client.query('SELECT estoque_atual, nome FROM produtos WHERE id=$1 FOR UPDATE', [produto_id]);
    if (!pr[0]) throw new Error('Produto não encontrado');

    const saidas = ['ajuste_saida','perda'];
    let novoEst = parseFloat(pr[0].estoque_atual);
    if (saidas.includes(tipo)) {
      if (novoEst < quantidade) throw new Error(`Estoque insuficiente (atual: ${novoEst})`);
      novoEst -= parseFloat(quantidade);
    } else {
      novoEst += parseFloat(quantidade);
    }

    await client.query('UPDATE produtos SET estoque_atual=$1 WHERE id=$2', [novoEst.toFixed(3), produto_id]);
    await client.query(`INSERT INTO mov_estoque (produto_id,tipo,quantidade,obs,usuario_id)
      VALUES ($1,$2,$3,$4,$5)`, [produto_id, tipo, quantidade, obs||null, req.user.id]);

    await client.query('COMMIT');
    res.json({ ok: true, estoque_atual: novoEst, produto: pr[0].nome });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

// GET /api/estoque/alertas — produtos abaixo do mínimo
router.get('/alertas', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.id, p.nome, p.codigo, p.estoque_atual, p.estoque_minimo,
             (p.estoque_minimo - p.estoque_atual) AS deficit,
             c.nome AS categoria_nome
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.status = 'ativo' AND p.estoque_atual <= p.estoque_minimo
      ORDER BY deficit DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
