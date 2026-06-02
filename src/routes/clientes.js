const router = require('express').Router();
const db     = require('../db');
const { canAccess } = require('../middleware/auth');

const PERM = ['admin','gerente','vendedor'];

// GET /api/clientes
router.get('/', canAccess(...PERM), async (req, res) => {
  try {
    const { search, status, vendedor_id, page = 1, limit = 100 } = req.query;
    const off = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];

    // Vendedor só vê seus próprios clientes
    if (req.user.nivel === 'vendedor' && req.user.vendedor_id) {
      params.push(req.user.vendedor_id);
      where.push(`c.vendedor_id = $${params.length}`);
    } else if (vendedor_id) {
      params.push(vendedor_id);
      where.push(`c.vendedor_id = $${params.length}`);
    }

    if (status) { params.push(status); where.push(`c.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(c.nome ILIKE $${params.length} OR c.nome_fantasia ILIKE $${params.length} OR c.cpf_cnpj ILIKE $${params.length} OR c.cidade ILIKE $${params.length})`);
    }

    const whereStr = where.join(' AND ');
    const { rows: total } = await db.query(`SELECT COUNT(*) FROM clientes c WHERE ${whereStr}`, params);

    params.push(limit, off);
    const { rows } = await db.query(`
      SELECT c.*, v.nome AS vendedor_nome
      FROM clientes c
      LEFT JOIN vendedores v ON v.id = c.vendedor_id
      WHERE ${whereStr}
      ORDER BY c.nome
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ data: rows, total: +total[0].count, page: +page, limit: +limit });
  } catch (err) {
    console.error(err); res.status(500).json({ error: err.message });
  }
});

// GET /api/clientes/:id
router.get('/:id', canAccess(...PERM), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, v.nome AS vendedor_nome
      FROM clientes c
      LEFT JOIN vendedores v ON v.id = c.vendedor_id
      WHERE c.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });

    // Histórico de vendas do cliente
    const { rows: vendas } = await db.query(`
      SELECT v.id, v.numero, v.data, v.total, v.status, v.status_pagamento
      FROM vendas v WHERE v.cliente_id = $1
      ORDER BY v.data DESC LIMIT 20`, [req.params.id]);

    // Contas pendentes
    const { rows: contas } = await db.query(`
      SELECT * FROM contas_receber
      WHERE cliente_id = $1 AND status != 'pago'
      ORDER BY data_vencimento`, [req.params.id]);

    res.json({ ...rows[0], vendas, contas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clientes
router.post('/', canAccess(...PERM), async (req, res) => {
  try {
    const d = req.body;
    const { rows: last } = await db.query("SELECT codigo FROM clientes ORDER BY id DESC LIMIT 1");
    const nextNum = last[0] ? parseInt(last[0].codigo.replace('CLI-','')) + 1 : 1;
    const codigo = `CLI-${String(nextNum).padStart(3,'0')}`;

    const { rows } = await db.query(`
      INSERT INTO clientes (codigo,nome,nome_fantasia,cpf_cnpj,ie,tipo,responsavel,
        telefone,whatsapp,email,endereco,numero,bairro,cidade,estado,cep,
        tipo_estab,obs,limite_credito,prazo_pagamento,status,vendedor_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [codigo, d.nome, d.nome_fantasia||null, d.cpf_cnpj||null, d.ie||null,
       d.tipo||'PJ', d.responsavel||null, d.telefone||null, d.whatsapp||null,
       d.email||null, d.endereco||null, d.numero||null, d.bairro||null,
       d.cidade, d.estado, d.cep||null, d.tipo_estab||null, d.obs||null,
       d.limite_credito||0, d.prazo_pagamento||30, d.status||'ativo',
       d.vendedor_id||null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/clientes/:id
router.put('/:id', canAccess(...PERM), async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await db.query(`
      UPDATE clientes SET
        nome=$1,nome_fantasia=$2,cpf_cnpj=$3,ie=$4,tipo=$5,responsavel=$6,
        telefone=$7,whatsapp=$8,email=$9,endereco=$10,numero=$11,bairro=$12,
        cidade=$13,estado=$14,cep=$15,tipo_estab=$16,obs=$17,
        limite_credito=$18,prazo_pagamento=$19,status=$20,vendedor_id=$21
      WHERE id=$22 RETURNING *`,
      [d.nome, d.nome_fantasia||null, d.cpf_cnpj||null, d.ie||null,
       d.tipo||'PJ', d.responsavel||null, d.telefone||null, d.whatsapp||null,
       d.email||null, d.endereco||null, d.numero||null, d.bairro||null,
       d.cidade, d.estado, d.cep||null, d.tipo_estab||null, d.obs||null,
       d.limite_credito||0, d.prazo_pagamento||30, d.status||'ativo',
       d.vendedor_id||null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clientes/:id
router.delete('/:id', canAccess('admin','gerente'), async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM clientes WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
