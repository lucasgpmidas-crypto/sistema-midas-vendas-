# Sistema de Vendas Midas — Instruções para o Claude Code

## O que é este projeto
Sistema profissional de vendas para distribuidoras.
- **Backend:** Node.js + Express + PostgreSQL
- **Banco:** Supabase (schema `midas` — isolado dos outros projetos)
- **Frontend:** HTML/CSS/JS puro em `public/index.html`
- **Deploy:** Vercel (via GitHub push)

## Stack e estrutura
```
src/server.js          ← entry point Express
src/db.js              ← pool PostgreSQL com search_path=midas
src/middleware/auth.js ← JWT + permissões por nível
src/routes/            ← uma rota por módulo
database/schema.sql    ← DDL completo (schema midas)
database/seed.sql      ← dados iniciais
public/index.html      ← SPA frontend completo
```

## Comandos principais
```bash
npm install          # instalar dependências
npm run dev          # rodar em dev (nodemon)
npm start            # rodar em produção
```

## Variáveis de ambiente (.env)
```
DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-0-[região].pooler.supabase.com:6543/postgres
JWT_SECRET=[64 chars aleatórios]
JWT_EXPIRES_IN=8h
NODE_ENV=development
PORT=3000
```

## Banco de dados
- **Schema:** `midas` (isolado — não toca nas tabelas dos outros projetos)
- **search_path** configurado automaticamente no `db.js` via pool.on('connect')
- Todas as queries usam nomes simples de tabela (sem prefixo `midas.`) pois o search_path já está definido

### Tabelas principais
| Tabela | Descrição |
|--------|-----------|
| usuarios | Autenticação e níveis de acesso |
| clientes | Cadastro de clientes |
| produtos | Produtos com estoque |
| categorias | Categorias de produtos |
| vendedores | Cadastro de vendedores |
| vendas | Pedidos/vendas |
| itens_venda | Itens de cada venda |
| mov_estoque | Histórico de movimentações |
| contas_receber | Financeiro / pagamentos |
| logs | Auditoria de ações |

### Para aplicar o schema no Supabase
1. Abrir o Supabase → SQL Editor → New Query
2. Colar `database/schema.sql` → Run
3. Colar `database/seed.sql` → Run

## API REST
Todas as rotas protegidas requerem: `Authorization: Bearer <token>`

| Método | Rota | Acesso |
|--------|------|--------|
| POST | /api/auth/login | público |
| GET/POST | /api/clientes | admin, gerente, vendedor |
| GET/PUT/DELETE | /api/clientes/:id | admin, gerente, vendedor |
| GET/POST | /api/produtos | todos autenticados |
| GET/POST | /api/vendas | admin, gerente, vendedor |
| POST | /api/vendas/:id/cancelar | admin, gerente |
| POST | /api/vendas/:id/pagamento | admin, gerente, financeiro |
| POST | /api/estoque/movimentacao | admin, gerente, estoque |
| GET | /api/dashboard/kpis | todos autenticados |
| GET | /api/financeiro | todos autenticados |
| GET/POST/PUT | /api/usuarios | admin only |

## Níveis de acesso
- **admin** — acesso total
- **gerente** — vendas, clientes, produtos, relatórios
- **vendedor** — seus próprios clientes e vendas
- **financeiro** — contas a receber, pagamentos
- **estoque** — produtos, movimentações

## Convenções de código
- Queries SQL diretas com `db.query(sql, params)` — sem ORM
- Transações em operações críticas (vendas, estoque) com `pool.connect()` + BEGIN/COMMIT/ROLLBACK
- Erros retornam `{ error: "mensagem" }` com status HTTP adequado
- Campos em snake_case no banco e na API
- Frontend faz compat camelCase ↔ snake_case nos helpers getCliente/getProduto

## Deploy (Vercel + GitHub)
```bash
git add .
git commit -m "feat: descrição"
git push origin main   # deploy automático no Vercel
```

Variáveis de ambiente no Vercel:
- DATABASE_URL
- JWT_SECRET  
- JWT_EXPIRES_IN=8h
- NODE_ENV=production

## Tarefas comuns

### Adicionar novo campo a uma tabela
1. Escrever migration SQL: `ALTER TABLE midas.clientes ADD COLUMN novo_campo VARCHAR(100);`
2. Rodar no Supabase SQL Editor
3. Atualizar a rota em `src/routes/clientes.js`
4. Atualizar o formulário em `public/index.html`

### Adicionar nova rota
1. Criar `src/routes/nova_rota.js`
2. Registrar em `src/server.js`: `app.use('/api/nova_rota', authMiddleware, require('./routes/nova_rota'))`

### Criar novo usuário admin
```sql
-- No Supabase SQL Editor:
INSERT INTO midas.usuarios (nome, email, senha_hash, nivel)
VALUES ('Nome', 'email@empresa.com', 
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'admin');
-- Senha gerada: Midas@2025 (mudar após primeiro acesso)
```

### Testar a API localmente
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@midas.com","senha":"Midas@2025"}'

# Listar clientes (usar token do login)
curl http://localhost:3000/api/clientes \
  -H "Authorization: Bearer <token>"
```
