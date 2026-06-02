# ⚡ Sistema de Vendas Midas

Sistema profissional de vendas para distribuidoras.  
**Stack:** Node.js · Express · PostgreSQL (Supabase) · HTML/CSS/JS  
**Deploy:** GitHub → Vercel (backend + frontend) + Supabase (banco)

---

## 🗂️ Estrutura do Projeto

```
midas-sistema/
├── src/
│   ├── server.js          ← Servidor Express principal
│   ├── db.js              ← Conexão PostgreSQL (pool)
│   ├── middleware/
│   │   └── auth.js        ← JWT + controle de permissões
│   └── routes/
│       ├── auth.js        ← Login / troca de senha
│       ├── clientes.js    ← CRUD clientes
│       ├── produtos.js    ← CRUD produtos
│       ├── vendedores.js  ← CRUD vendedores
│       ├── vendas.js      ← Vendas + cancelamento + pagamento
│       ├── estoque.js     ← Movimentações de estoque
│       ├── financeiro.js  ← Contas a receber
│       ├── dashboard.js   ← KPIs e gráficos
│       └── usuarios.js    ← Gestão de usuários
├── database/
│   ├── schema.sql         ← Estrutura completa do banco
│   └── seed.sql           ← Dados iniciais (usuários + produtos)
├── public/
│   └── index.html         ← Frontend completo (SPA)
├── package.json
├── vercel.json            ← Configuração Vercel
├── docker-compose.yml     ← Para rodar localmente
└── .env.example           ← Variáveis necessárias
```

---

## 🚀 Deploy em 3 passos: Supabase + Vercel + GitHub

### PASSO 1 — Criar o banco no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Anote o nome e a senha do projeto
3. Vá em **SQL Editor** → clique em **New Query**
4. Cole o conteúdo de `database/schema.sql` → clique **Run**
5. Abra nova query, cole `database/seed.sql` → clique **Run**
6. Vá em **Project Settings → Database → Connection string → URI**
7. Copie a URI (formato: `postgresql://postgres.xxx:senha@aws-0-xxx.pooler.supabase.com:6543/postgres`)

> **Senha padrão de todos os usuários:** `Midas@2025`  
> Mude as senhas após o primeiro acesso em Configurações → Usuários.

---

### PASSO 2 — Subir para o GitHub

```bash
# Na pasta midas-sistema/:
git init
git add .
git commit -m "feat: Sistema de Vendas Midas v2.0"
git remote add origin https://github.com/SEU_USUARIO/midas-sistema.git
git push -u origin main
```

---

### PASSO 3 — Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório `midas-sistema` do GitHub
3. Em **Build & Output Settings**, deixe tudo padrão
4. Em **Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `DATABASE_URL` | URI copiada do Supabase (Passo 1) |
| `JWT_SECRET` | Gere com: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `8h` |
| `NODE_ENV` | `production` |

5. Clique **Deploy** ✅

O Vercel detecta o `vercel.json` e roteia tudo para o `src/server.js`.  
A cada `git push`, o deploy é feito automaticamente.

---

## 💻 Rodar Localmente

### Opção A — Com Docker (recomendado)

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/midas-sistema.git
cd midas-sistema

# Suba tudo com um comando
docker compose up -d

# Acesse: http://localhost:3000
```

### Opção B — Sem Docker

```bash
# Pré-requisitos: Node.js 18+, PostgreSQL 14+

# 1. Instalar dependências
npm install

# 2. Criar o .env
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Criar o banco
psql -U postgres -c "CREATE DATABASE midas_db;"
psql -U postgres -d midas_db -f database/schema.sql
psql -U postgres -d midas_db -f database/seed.sql

# 4. Rodar em desenvolvimento
npm run dev

# Acesse: http://localhost:3000
```

---

## 👤 Usuários Iniciais

| E-mail | Senha | Nível |
|--------|-------|-------|
| admin@midas.com | Midas@2025 | Administrador |
| gerente@midas.com | Midas@2025 | Gerente |
| vendedor@midas.com | Midas@2025 | Vendedor |
| financeiro@midas.com | Midas@2025 | Financeiro |
| estoque@midas.com | Midas@2025 | Estoque |

> ⚠️ **Mude as senhas imediatamente após o primeiro acesso!**  
> Menu lateral → Configurações → Usuários → Editar

---

## 🔌 API REST — Endpoints Principais

Todas as rotas (exceto `/api/auth/login`) requerem header:
```
Authorization: Bearer <token>
```

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/dashboard/kpis` | KPIs do dashboard |
| GET/POST | `/api/clientes` | Listar / Criar |
| GET/PUT/DELETE | `/api/clientes/:id` | Detalhar / Editar / Excluir |
| GET/POST | `/api/produtos` | Listar / Criar |
| GET/POST | `/api/vendas` | Listar / Criar |
| PUT | `/api/vendas/:id` | Editar venda |
| POST | `/api/vendas/:id/cancelar` | Cancelar venda |
| POST | `/api/vendas/:id/pagamento` | Registrar pagamento |
| POST | `/api/estoque/movimentacao` | Entrada/saída estoque |
| GET | `/api/financeiro` | Contas a receber |

---

## 🔒 Segurança

- Autenticação via **JWT** (expira em 8h, renovado a cada login)
- Senhas com **bcrypt** (10 rounds)
- **Rate limit** no endpoint de login (20 tentativas/15min por IP)
- Headers de segurança via **Helmet.js**
- Compressão gzip via **Compression.js**
- Banco isolado no Supabase com SSL obrigatório
- Dados de clientes protegidos conforme **LGPD**

---

## ☁️ Backups

O Supabase realiza **backups automáticos diários** (plano gratuito: 7 dias).  
Para exportar manualmente:
```bash
# No painel Supabase: Database → Backups → Download
# Ou via CLI:
pg_dump "sua_connection_string" > backup_$(date +%Y%m%d).sql
```

---

## 📱 Acesso pelo Celular

O sistema é **responsivo** — acesse pelo navegador do celular na URL do Vercel.  
Para instalar como app (PWA), no celular: menu do navegador → "Adicionar à tela inicial".

---

## 🔧 Variáveis de Ambiente (.env)

```env
DATABASE_URL=postgresql://...   # Supabase connection string
JWT_SECRET=chave-aleatoria-64-chars
JWT_EXPIRES_IN=8h
NODE_ENV=production
PORT=3000
```

---

## 📦 Dependências

| Pacote | Uso |
|--------|-----|
| express | Servidor web |
| pg | Driver PostgreSQL |
| bcryptjs | Hash de senhas |
| jsonwebtoken | Autenticação JWT |
| helmet | Headers de segurança |
| cors | Cross-origin requests |
| compression | Gzip |
| express-rate-limit | Proteção contra brute-force |
| dotenv | Variáveis de ambiente |

---

## 🆙 Próximas Evoluções

- [ ] Emissão de NF-e (SEFAZ)
- [ ] Notificações WhatsApp (Twilio/Z-API)
- [ ] App Mobile (React Native)
- [ ] Multi-empresa / filiais
- [ ] Integração com ERP
- [ ] Relatórios em PDF (Puppeteer)
- [ ] Dashboard em tempo real (WebSocket)

---

**Sistema de Vendas Midas v2.0** · Desenvolvido com ⚡
