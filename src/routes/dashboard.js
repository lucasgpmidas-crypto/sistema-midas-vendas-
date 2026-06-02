const router = require('express').Router();
const db = require('../db');

// GET /api/dashboard/kpis?de=&ate=&vendedor_id=&estado=
router.get('/kpis', async (req, res) => {
  try {
    const { de, ate, vendedor_id, estado } = req.query;
    let where = ["v.status != 'cancelado'"]; const p = [];
    if (de)          { p.push(de);          where.push(`v.data>=$${p.length}`); }
    if (ate)         { p.push(ate);         where.push(`v.data<=$${p.length}`); }
    if (vendedor_id) { p.push(vendedor_id); where.push(`v.vendedor_id=$${p.length}`); }
    if (estado)      { p.push(estado);      where.push(`v.estado=$${p.length}`); }
    const ws = where.join(' AND ');

    const { rows: k } = await db.query(`
      SELECT
        COUNT(*)                                        AS qtd_vendas,
        COALESCE(SUM(total),0)                         AS faturamento,
        COALESCE(AVG(total),0)                         AS ticket_medio,
        COALESCE(SUM(CASE WHEN status_pagamento='pago'      THEN total ELSE 0 END),0) AS pagas,
        COALESCE(SUM(CASE WHEN status_pagamento IN('a_receber','parcial') THEN total ELSE 0 END),0) AS a_receber,
        COALESCE(SUM(CASE WHEN status_pagamento='vencido'   THEN total ELSE 0 END),0) AS vencidas,
        COALESCE(SUM(desconto),0)                      AS descontos,
        COALESCE(SUM(frete),0)                         AS fretes,
        COALESCE(SUM(lucro),0)                         AS lucro_total
      FROM vendas v WHERE ${ws}`, p);

    const { rows: canceladas } = await db.query(`
      SELECT COUNT(*) AS qtd, COALESCE(SUM(total),0) AS total
      FROM vendas WHERE status='cancelado'
        ${de  ? `AND data>='${de}'`  : ''}
        ${ate ? `AND data<='${ate}'` : ''}`);

    const { rows: estAlerta } = await db.query(
      "SELECT COUNT(*) AS qtd FROM produtos WHERE status='ativo' AND estoque_atual<=estoque_minimo");
    const { rows: estValor } = await db.query(
      "SELECT COALESCE(SUM(estoque_atual*preco_venda),0) AS valor FROM produtos WHERE status='ativo'");

    res.json({
      ...k[0],
      canceladas_qtd:  +canceladas[0].qtd,
      canceladas_val:  +canceladas[0].total,
      estoque_alerta:  +estAlerta[0].qtd,
      estoque_valor:   +estValor[0].valor
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/charts/dia  — últimos 30 dias
router.get('/charts/dia', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT data::text, COUNT(*) AS qtd, SUM(total) AS total
      FROM vendas
      WHERE status!='cancelado' AND data >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY data ORDER BY data`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/charts/vendedor
router.get('/charts/vendedor', async (req, res) => {
  try {
    const { de, ate } = req.query;
    let where = ["v.status!='cancelado'"]; const p = [];
    if (de)  { p.push(de);  where.push(`v.data>=$${p.length}`); }
    if (ate) { p.push(ate); where.push(`v.data<=$${p.length}`); }
    const { rows } = await db.query(`
      SELECT vd.nome AS vendedor, COUNT(*) AS qtd, SUM(v.total) AS total
      FROM vendas v
      LEFT JOIN vendedores vd ON vd.id=v.vendedor_id
      WHERE ${where.join(' AND ')}
      GROUP BY vd.nome ORDER BY total DESC`, p);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/charts/produto — top 10 produtos
router.get('/charts/produto', async (req, res) => {
  try {
    const { de, ate } = req.query;
    let where = ["v.status!='cancelado'"]; const p = [];
    if (de)  { p.push(de);  where.push(`v.data>=$${p.length}`); }
    if (ate) { p.push(ate); where.push(`v.data<=$${p.length}`); }
    const { rows } = await db.query(`
      SELECT iv.nome_produto AS produto,
             SUM(iv.quantidade) AS qtd,
             SUM(iv.total) AS total
      FROM itens_venda iv
      LEFT JOIN vendas v ON v.id=iv.venda_id
      WHERE ${where.join(' AND ')}
      GROUP BY iv.nome_produto ORDER BY qtd DESC LIMIT 10`, p);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/charts/estado
router.get('/charts/estado', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT estado, SUM(total) AS total, COUNT(*) AS qtd
      FROM vendas WHERE status!='cancelado' AND estado IS NOT NULL
      GROUP BY estado ORDER BY total DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dashboard/top/clientes
router.get('/top/clientes', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT cl.nome, cl.cidade, cl.estado, COUNT(*) AS qtd, SUM(v.total) AS total
      FROM vendas v LEFT JOIN clientes cl ON cl.id=v.cliente_id
      WHERE v.status!='cancelado'
      GROUP BY cl.nome,cl.cidade,cl.estado
      ORDER BY total DESC LIMIT 10`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
