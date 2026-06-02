const router = require('express').Router();
const db = require('../db');
const { canAccess } = require('../middleware/auth');

router.get('/', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM vendedores ORDER BY nome');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM vendedores WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });

  const { rows: stats } = await db.query(`
    SELECT COUNT(*) AS qtd_vendas, COALESCE(SUM(total),0) AS total_vendido,
           COALESCE(AVG(total),0) AS ticket_medio,
           COUNT(DISTINCT cliente_id) AS clientes_atendidos
    FROM vendas WHERE vendedor_id=$1 AND status!='cancelado'`, [req.params.id]);

  res.json({ ...rows[0], ...stats[0] });
});

router.post('/', canAccess('admin','gerente'), async (req, res) => {
  const d = req.body;
  const { rows } = await db.query(`
    INSERT INTO vendedores (nome,telefone,whatsapp,email,cidade,estado,comissao,meta,status,obs)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [d.nome,d.telefone||null,d.whatsapp||null,d.email||null,d.cidade||null,
     d.estado||null,d.comissao||3,d.meta||0,d.status||'ativo',d.obs||null]);
  res.status(201).json(rows[0]);
});

router.put('/:id', canAccess('admin','gerente'), async (req, res) => {
  const d = req.body;
  const { rows } = await db.query(`
    UPDATE vendedores SET nome=$1,telefone=$2,whatsapp=$3,email=$4,cidade=$5,estado=$6,
      comissao=$7,meta=$8,status=$9,obs=$10 WHERE id=$11 RETURNING *`,
    [d.nome,d.telefone||null,d.whatsapp||null,d.email||null,d.cidade||null,
     d.estado||null,d.comissao||3,d.meta||0,d.status||'ativo',d.obs||null,req.params.id]);
  res.json(rows[0]);
});

router.delete('/:id', canAccess('admin'), async (req, res) => {
  await db.query('DELETE FROM vendedores WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
