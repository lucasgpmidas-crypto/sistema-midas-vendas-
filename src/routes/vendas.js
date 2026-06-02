const router = require('express').Router();
const db     = require('../db');
const { canAccess } = require('../middleware/auth');

// GET /api/vendas
router.get('/', canAccess('admin','gerente','vendedor','financeiro'), async (req, res) => {
  try {
    const { de, ate, status, status_pagamento, vendedor_id, cliente_id, search, page=1, limit=100 } = req.query;
    const off = (page-1)*limit;
    let where = ['1=1']; const p = [];

    if (req.user.nivel === 'vendedor' && req.user.vendedor_id) {
      p.push(req.user.vendedor_id); where.push(`v.vendedor_id=$${p.length}`);
    } else if (vendedor_id) { p.push(vendedor_id); where.push(`v.vendedor_id=$${p.length}`); }

    if (de)              { p.push(de);              where.push(`v.data>=$${p.length}`); }
    if (ate)             { p.push(ate);              where.push(`v.data<=$${p.length}`); }
    if (status)          { p.push(status);           where.push(`v.status=$${p.length}`); }
    if (status_pagamento){ p.push(status_pagamento); where.push(`v.status_pagamento=$${p.length}`); }
    if (cliente_id)      { p.push(cliente_id);       where.push(`v.cliente_id=$${p.length}`); }
    if (search)          { p.push(`%${search}%`);    where.push(`(v.numero ILIKE $${p.length} OR cl.nome ILIKE $${p.length})`); }

    const ws = where.join(' AND ');
    const { rows: tot } = await db.query(
      `SELECT COUNT(*) FROM vendas v LEFT JOIN clientes cl ON cl.id=v.cliente_id WHERE ${ws}`, p);

    p.push(limit, off);
    const { rows } = await db.query(`
      SELECT v.*,
             cl.nome AS cliente_nome, cl.cidade AS cliente_cidade, cl.estado AS cliente_estado,
             vd.nome AS vendedor_nome
      FROM vendas v
      LEFT JOIN clientes  cl ON cl.id = v.cliente_id
      LEFT JOIN vendedores vd ON vd.id = v.vendedor_id
      WHERE ${ws}
      ORDER BY v.data DESC, v.id DESC
      LIMIT $${p.length-1} OFFSET $${p.length}`, p);

    res.json({ data: rows, total: +tot[0].count });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// GET /api/vendas/:id
router.get('/:id', canAccess('admin','gerente','vendedor','financeiro'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT v.*,
             cl.nome AS cliente_nome, cl.cpf_cnpj, cl.endereco, cl.cidade AS cliente_cidade, cl.estado AS cliente_estado,
             cl.telefone AS cliente_tel, cl.whatsapp AS cliente_wpp,
             vd.nome AS vendedor_nome
      FROM vendas v
      LEFT JOIN clientes  cl ON cl.id=v.cliente_id
      LEFT JOIN vendedores vd ON vd.id=v.vendedor_id
      WHERE v.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });

    const { rows: itens } = await db.query(
      'SELECT * FROM itens_venda WHERE venda_id=$1 ORDER BY id', [req.params.id]);

    res.json({ ...rows[0], itens });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/vendas
router.post('/', canAccess('admin','gerente','vendedor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const d = req.body;

    // Número sequencial
    const { rows: last } = await client.query("SELECT numero FROM vendas ORDER BY id DESC LIMIT 1 FOR UPDATE");
    const nextNum = last[0] ? parseInt(last[0].numero.replace('VND-','')) + 1 : 1;
    const numero = `VND-${String(nextNum).padStart(4,'0')}`;

    // Validações
    if (!d.cliente_id || !d.vendedor_id || !d.itens?.length)
      throw new Error('Cliente, vendedor e itens são obrigatórios');

    const cli = (await client.query('SELECT status FROM clientes WHERE id=$1', [d.cliente_id])).rows[0];
    if (!cli) throw new Error('Cliente não encontrado');
    if (cli.status === 'bloqueado' && req.user.nivel !== 'admin')
      throw new Error('Cliente bloqueado. Contate o administrador.');

    // Verificar estoque e baixar
    for (const item of d.itens) {
      const { rows: pr } = await client.query('SELECT estoque_atual,status,nome FROM produtos WHERE id=$1 FOR UPDATE', [item.produto_id]);
      if (!pr[0]) throw new Error(`Produto ID ${item.produto_id} não encontrado`);
      if (pr[0].status === 'inativo') throw new Error(`Produto "${pr[0].nome}" está inativo`);

      if (d.status !== 'orcamento') {
        const novoEst = parseFloat(pr[0].estoque_atual) - parseFloat(item.quantidade);
        if (novoEst < 0 && !d.forcar_estoque)
          throw new Error(`Estoque insuficiente: ${pr[0].nome} (disponível: ${pr[0].estoque_atual})`);

        await client.query('UPDATE produtos SET estoque_atual=estoque_atual-$1 WHERE id=$2',
          [item.quantidade, item.produto_id]);
        await client.query(`INSERT INTO mov_estoque (produto_id,tipo,quantidade,obs,venda_id,usuario_id)
          VALUES ($1,'saida_venda',$2,$3,$4,$5)`,
          [item.produto_id, item.quantidade, `Venda ${numero}`, null, req.user.id]);
      }
    }

    // Cálculos
    const subtotal = d.itens.reduce((s,i) => s + i.valor_unitario * i.quantidade, 0);
    const desconto = d.itens.reduce((s,i) => s + (i.desconto||0), 0);
    const total    = subtotal - desconto + (d.frete||0) + (d.despesas||0);
    const custo    = d.itens.reduce((s,i) => s + (i.custo_unit||0) * i.quantidade, 0);
    const lucro    = total - custo;
    const margem   = total > 0 ? (lucro/total*100) : 0;

    const { rows: vRows } = await client.query(`
      INSERT INTO vendas (numero,data,cliente_id,vendedor_id,cidade,estado,
        status,status_pagamento,forma_pagamento,prazo_pagamento,data_vencimento,
        subtotal,desconto,frete,despesas,total,custo,lucro,margem,
        tipo_entrega,transportadora,rastreio,obs_interna,obs_cliente,criado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *`,
      [numero, d.data||new Date().toISOString().split('T')[0],
       d.cliente_id, d.vendedor_id,
       d.cidade||null, d.estado||null,
       d.status||'pedido_aberto', 'a_receber',
       d.forma_pagamento||null, d.prazo_pagamento||30, d.data_vencimento||null,
       subtotal.toFixed(2), desconto.toFixed(2), (d.frete||0), (d.despesas||0),
       total.toFixed(2), custo.toFixed(2), lucro.toFixed(2), margem.toFixed(2),
       d.tipo_entrega||'entrega', d.transportadora||null, d.rastreio||null,
       d.obs_interna||null, d.obs_cliente||null, req.user.id]);

    const vendaId = vRows[0].id;

    // Inserir itens
    for (const item of d.itens) {
      const tot = item.valor_unitario * item.quantidade - (item.desconto||0);
      await client.query(`
        INSERT INTO itens_venda (venda_id,produto_id,nome_produto,quantidade,valor_unitario,desconto,total,custo_unit)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [vendaId, item.produto_id, item.nome_produto||item.nome, item.quantidade,
         item.valor_unitario, item.desconto||0, tot.toFixed(2), item.custo_unit||0]);
    }

    // Criar conta a receber
    await client.query(`
      INSERT INTO contas_receber (cliente_id,venda_id,valor,valor_pago,valor_aberto,data_vencimento,status,forma_pagamento)
      VALUES ($1,$2,$3,0,$3,$4,'a_receber',$5)`,
      [d.cliente_id, vendaId, total.toFixed(2), d.data_vencimento||null, d.forma_pagamento||null]);

    await client.query('COMMIT');
    res.status(201).json({ ...vRows[0], itens: d.itens });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

// PUT /api/vendas/:id (editar)
router.put('/:id', canAccess('admin','gerente','vendedor'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const d = req.body;
    const id = req.params.id;

    const { rows: old } = await client.query('SELECT * FROM vendas WHERE id=$1 FOR UPDATE', [id]);
    if (!old[0]) throw new Error('Venda não encontrada');
    if (old[0].status === 'cancelado') throw new Error('Venda cancelada não pode ser editada');

    // Devolver estoque dos itens antigos
    const { rows: oldItens } = await client.query('SELECT * FROM itens_venda WHERE venda_id=$1', [id]);
    for (const oi of oldItens) {
      if (old[0].status !== 'orcamento') {
        await client.query('UPDATE produtos SET estoque_atual=estoque_atual+$1 WHERE id=$2', [oi.quantidade, oi.produto_id]);
      }
    }
    await client.query('DELETE FROM itens_venda WHERE venda_id=$1', [id]);

    // Baixar estoque dos novos itens
    for (const item of d.itens) {
      if (d.status !== 'orcamento') {
        await client.query('UPDATE produtos SET estoque_atual=estoque_atual-$1 WHERE id=$2', [item.quantidade, item.produto_id]);
        await client.query(`INSERT INTO mov_estoque (produto_id,tipo,quantidade,obs,venda_id,usuario_id)
          VALUES ($1,'saida_venda',$2,'Edição venda',$3,$4)`,
          [item.produto_id, item.quantidade, id, req.user.id]);
      }
      const tot = item.valor_unitario * item.quantidade - (item.desconto||0);
      await client.query(`INSERT INTO itens_venda (venda_id,produto_id,nome_produto,quantidade,valor_unitario,desconto,total,custo_unit)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, item.produto_id, item.nome_produto||item.nome, item.quantidade,
         item.valor_unitario, item.desconto||0, tot.toFixed(2), item.custo_unit||0]);
    }

    const subtotal = d.itens.reduce((s,i) => s + i.valor_unitario * i.quantidade, 0);
    const desconto = d.itens.reduce((s,i) => s + (i.desconto||0), 0);
    const total    = subtotal - desconto + (d.frete||0) + (d.despesas||0);
    const custo    = d.itens.reduce((s,i) => s + (i.custo_unit||0) * i.quantidade, 0);
    const lucro    = total - custo;
    const margem   = total > 0 ? (lucro/total*100) : 0;

    const { rows } = await client.query(`
      UPDATE vendas SET
        data=$1,cliente_id=$2,vendedor_id=$3,cidade=$4,estado=$5,
        status=$6,forma_pagamento=$7,prazo_pagamento=$8,data_vencimento=$9,
        subtotal=$10,desconto=$11,frete=$12,despesas=$13,total=$14,
        custo=$15,lucro=$16,margem=$17,tipo_entrega=$18,
        transportadora=$19,rastreio=$20,obs_interna=$21,editado_por=$22
      WHERE id=$23 RETURNING *`,
      [d.data, d.cliente_id, d.vendedor_id, d.cidade||null, d.estado||null,
       d.status, d.forma_pagamento||null, d.prazo_pagamento||30, d.data_vencimento||null,
       subtotal.toFixed(2), desconto.toFixed(2), d.frete||0, d.despesas||0,
       total.toFixed(2), custo.toFixed(2), lucro.toFixed(2), margem.toFixed(2),
       d.tipo_entrega||'entrega', d.transportadora||null, d.rastreio||null,
       d.obs_interna||null, req.user.id, id]);

    // Atualizar conta a receber
    await client.query(`UPDATE contas_receber SET valor=$1, valor_aberto=valor-valor_pago, data_vencimento=$2
      WHERE venda_id=$3`, [total.toFixed(2), d.data_vencimento||null, id]);

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

// POST /api/vendas/:id/cancelar
router.post('/:id/cancelar', canAccess('admin','gerente'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM vendas WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw new Error('Não encontrado');
    if (rows[0].status === 'cancelado') throw new Error('Já cancelada');

    const { rows: itens } = await client.query('SELECT * FROM itens_venda WHERE venda_id=$1', [req.params.id]);
    for (const i of itens) {
      await client.query('UPDATE produtos SET estoque_atual=estoque_atual+$1 WHERE id=$2', [i.quantidade, i.produto_id]);
      await client.query(`INSERT INTO mov_estoque (produto_id,tipo,quantidade,obs,venda_id,usuario_id)
        VALUES ($1,'devolucao',$2,'Cancelamento venda',$3,$4)`,
        [i.produto_id, i.quantidade, req.params.id, req.user.id]);
    }

    await client.query(`UPDATE vendas SET status='cancelado',status_pagamento='cancelado',editado_por=$1 WHERE id=$2`,
      [req.user.id, req.params.id]);
    await client.query(`UPDATE contas_receber SET status='cancelado' WHERE venda_id=$1`, [req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

// POST /api/vendas/:id/pagamento
router.post('/:id/pagamento', canAccess('admin','gerente','financeiro'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { valor, forma_pagamento } = req.body;
    const id = req.params.id;

    const { rows: conta } = await client.query(
      'SELECT * FROM contas_receber WHERE venda_id=$1 FOR UPDATE', [id]);
    if (!conta[0]) throw new Error('Conta não encontrada');

    const novoPago   = parseFloat(conta[0].valor_pago) + parseFloat(valor);
    const novoAberto = parseFloat(conta[0].valor) - novoPago;
    const novoStatus = novoAberto <= 0 ? 'pago' : novoPago > 0 ? 'parcial' : 'a_receber';

    await client.query(`UPDATE contas_receber SET valor_pago=$1,valor_aberto=$2,status=$3,forma_pagamento=$4
      WHERE venda_id=$5`, [novoPago.toFixed(2), Math.max(0,novoAberto).toFixed(2), novoStatus, forma_pagamento||null, id]);
    await client.query(`UPDATE vendas SET status_pagamento=$1,editado_por=$2 WHERE id=$3`,
      [novoStatus, req.user.id, id]);

    await client.query('COMMIT');
    res.json({ ok: true, status: novoStatus, valor_pago: novoPago, valor_aberto: Math.max(0,novoAberto) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;
