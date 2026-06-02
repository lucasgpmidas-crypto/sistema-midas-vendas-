const router = require('express').Router();
const db     = require('../db');
const { canAccess } = require('../middleware/auth');

// GET /api/produtos
router.get('/', async (req, res) => {
  try {
    const { search, categoria_id, status } = req.query;
    let where = ['1=1']; const params = [];
    if (status)       { params.push(status);       where.push(`p.status=$${params.length}`); }
    if (categoria_id) { params.push(categoria_id); where.push(`p.categoria_id=$${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(p.nome ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.codigo ILIKE $${params.length})`);
    }
    const { rows } = await db.query(`
      SELECT p.*, c.nome AS categoria_nome
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.nome`, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/produtos/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*, c.nome AS categoria_nome
      FROM produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/produtos
router.post('/', canAccess('admin','gerente','estoque'), async (req, res) => {
  try {
    const d = req.body;
    const { rows: last } = await db.query("SELECT codigo FROM produtos ORDER BY id DESC LIMIT 1");
    const nextNum = last[0] ? parseInt(last[0].codigo.replace('PRD-','')) + 1 : 1;
    const codigo = `PRD-${String(nextNum).padStart(3,'0')}`;

    const { rows } = await db.query(`
      INSERT INTO produtos (codigo,sku,nome,categoria_id,marca,descricao,unidade,
        preco_custo,preco_venda,estoque_atual,estoque_minimo,estoque_maximo,
        localizacao,codigo_barras,status,obs)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [codigo, d.sku||null, d.nome, d.categoria_id||null, d.marca||null,
       d.descricao||null, d.unidade||'UN', d.preco_custo||0, d.preco_venda||0,
       d.estoque_atual||0, d.estoque_minimo||0, d.estoque_maximo||999999,
       d.localizacao||null, d.codigo_barras||null, d.status||'ativo', d.obs||null]);

    // Registrar entrada inicial de estoque se > 0
    if ((d.estoque_atual||0) > 0) {
      await db.query(`
        INSERT INTO mov_estoque (produto_id,tipo,quantidade,obs,usuario_id)
        VALUES ($1,'entrada',$2,'Estoque inicial',$3)`,
        [rows[0].id, d.estoque_atual, req.user.id]);
    }
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/produtos/:id
router.put('/:id', canAccess('admin','gerente','estoque'), async (req, res) => {
  try {
    const d = req.body;
    const { rows: old } = await db.query('SELECT estoque_atual FROM produtos WHERE id=$1', [req.params.id]);
    const { rows } = await db.query(`
      UPDATE produtos SET
        sku=$1,nome=$2,categoria_id=$3,marca=$4,descricao=$5,unidade=$6,
        preco_custo=$7,preco_venda=$8,estoque_atual=$9,estoque_minimo=$10,
        estoque_maximo=$11,localizacao=$12,codigo_barras=$13,status=$14,obs=$15
      WHERE id=$16 RETURNING *`,
      [d.sku||null, d.nome, d.categoria_id||null, d.marca||null, d.descricao||null,
       d.unidade||'UN', d.preco_custo||0, d.preco_venda||0,
       d.estoque_atual, d.estoque_minimo||0, d.estoque_maximo||999999,
       d.localizacao||null, d.codigo_barras||null, d.status||'ativo', d.obs||null,
       req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });

    const diff = d.estoque_atual - old[0].estoque_atual;
    if (diff !== 0) {
      await db.query(`
        INSERT INTO mov_estoque (produto_id,tipo,quantidade,obs,usuario_id)
        VALUES ($1,$2,$3,'Ajuste via cadastro',$4)`,
        [req.params.id, diff > 0 ? 'ajuste_entrada':'ajuste_saida', Math.abs(diff), req.user.id]);
    }
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE
router.delete('/:id', canAccess('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM produtos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/produtos/categorias
router.get('/meta/categorias', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM categorias ORDER BY nome');
  res.json(rows);
});

module.exports = router;
