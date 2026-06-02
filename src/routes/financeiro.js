const router = require('express').Router();
const db = require('../db');

// GET /api/financeiro
router.get('/', async (req, res) => {
  try {
    const { status, page=1, limit=100 } = req.query;
    const off = (page-1)*limit;
    let where = ['1=1']; const p = [];
    if (status) { p.push(status); where.push(`cr.status=$${p.length}`); }
    p.push(limit, off);
    const { rows } = await db.query(`
      SELECT cr.*,
             cl.nome AS cliente_nome, cl.cidade, cl.estado,
             v.numero AS venda_numero
      FROM contas_receber cr
      LEFT JOIN clientes cl ON cl.id=cr.cliente_id
      LEFT JOIN vendas   v  ON v.id =cr.venda_id
      WHERE ${where.join(' AND ')}
      ORDER BY cr.data_vencimento
      LIMIT $${p.length-1} OFFSET $${p.length}`, p);

    // KPIs resumo
    const { rows: kpi } = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status!='pago' THEN valor_aberto ELSE 0 END),0) AS total_aberto,
        COALESCE(SUM(CASE WHEN status='pago'  THEN valor        ELSE 0 END),0) AS total_pago,
        COUNT(CASE WHEN status!='pago' AND data_vencimento < CURRENT_DATE THEN 1 END) AS vencidas_qtd,
        COALESCE(SUM(CASE WHEN status!='pago' AND data_vencimento < CURRENT_DATE THEN valor_aberto ELSE 0 END),0) AS vencidas_val
      FROM contas_receber`);

    res.json({ data: rows, kpi: kpi[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
