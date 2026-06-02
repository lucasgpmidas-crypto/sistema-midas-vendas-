-- ============================================================
-- MIDAS SISTEMA DE VENDAS — Schema PostgreSQL
-- Roda em schema próprio "midas" para não conflitar
-- com outros projetos no mesmo Supabase.
--
-- COMO USAR NO SUPABASE:
--   SQL Editor → New Query → cole este arquivo → Run
-- ============================================================

-- Criar schema isolado
CREATE SCHEMA IF NOT EXISTS midas;

-- Definir search_path para este script
SET search_path TO midas, public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- ── USUÁRIOS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NOT NULL,
  nivel       VARCHAR(20)  NOT NULL DEFAULT 'vendedor'
                CHECK (nivel IN ('admin','gerente','vendedor','financeiro','estoque')),
  status      VARCHAR(10)  NOT NULL DEFAULT 'ativo'
                CHECK (status IN ('ativo','inativo')),
  vendedor_id INT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VENDEDORES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.vendedores (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  telefone    VARCHAR(20),
  whatsapp    VARCHAR(20),
  email       VARCHAR(120),
  cidade      VARCHAR(80),
  estado      CHAR(2),
  comissao    NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  meta        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status      VARCHAR(10)  NOT NULL DEFAULT 'ativo'
                CHECK (status IN ('ativo','inativo')),
  obs         TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CLIENTES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.clientes (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(20) NOT NULL UNIQUE,
  nome            VARCHAR(150) NOT NULL,
  nome_fantasia   VARCHAR(150),
  cpf_cnpj        VARCHAR(20),
  ie              VARCHAR(30),
  tipo            CHAR(2) NOT NULL DEFAULT 'PJ' CHECK (tipo IN ('PF','PJ')),
  responsavel     VARCHAR(120),
  telefone        VARCHAR(20),
  whatsapp        VARCHAR(20),
  email           VARCHAR(120),
  endereco        VARCHAR(200),
  numero          VARCHAR(10),
  bairro          VARCHAR(80),
  cidade          VARCHAR(80),
  estado          CHAR(2),
  cep             VARCHAR(10),
  tipo_estab      VARCHAR(60),
  obs             TEXT,
  limite_credito  NUMERIC(12,2) NOT NULL DEFAULT 0,
  prazo_pagamento INT          NOT NULL DEFAULT 30,
  status          VARCHAR(10)  NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','inativo','bloqueado')),
  vendedor_id     INT REFERENCES midas.vendedores(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CATEGORIAS + PRODUTOS ────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.categorias (
  id    SERIAL PRIMARY KEY,
  nome  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS midas.produtos (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(20) NOT NULL UNIQUE,
  sku             VARCHAR(60),
  nome            VARCHAR(200) NOT NULL,
  categoria_id    INT REFERENCES midas.categorias(id) ON DELETE SET NULL,
  marca           VARCHAR(80),
  descricao       TEXT,
  unidade         VARCHAR(10) NOT NULL DEFAULT 'UN',
  preco_custo     NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_venda     NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_atual   NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_maximo  NUMERIC(12,3) NOT NULL DEFAULT 999999,
  localizacao     VARCHAR(30),
  codigo_barras   VARCHAR(30),
  status          VARCHAR(10) NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','inativo')),
  obs             TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── MOVIMENTAÇÕES DE ESTOQUE ─────────────────────────────
CREATE TABLE IF NOT EXISTS midas.mov_estoque (
  id          SERIAL PRIMARY KEY,
  produto_id  INT NOT NULL REFERENCES midas.produtos(id) ON DELETE CASCADE,
  tipo        VARCHAR(20) NOT NULL
                CHECK (tipo IN ('entrada','saida_venda','ajuste_entrada',
                                'ajuste_saida','perda','devolucao')),
  quantidade  NUMERIC(12,3) NOT NULL,
  obs         TEXT,
  venda_id    INT,
  usuario_id  INT REFERENCES midas.usuarios(id) ON DELETE SET NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VENDAS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.vendas (
  id               SERIAL PRIMARY KEY,
  numero           VARCHAR(20) NOT NULL UNIQUE,
  data             DATE        NOT NULL DEFAULT CURRENT_DATE,
  cliente_id       INT NOT NULL REFERENCES midas.clientes(id)   ON DELETE RESTRICT,
  vendedor_id      INT NOT NULL REFERENCES midas.vendedores(id)  ON DELETE RESTRICT,
  cidade           VARCHAR(80),
  estado           CHAR(2),
  status           VARCHAR(20) NOT NULL DEFAULT 'pedido_aberto'
                     CHECK (status IN ('orcamento','pedido_aberto','separando',
                                       'enviado','entregue','pago','a_receber',
                                       'cancelado','devolvido')),
  status_pagamento VARCHAR(20) NOT NULL DEFAULT 'a_receber'
                     CHECK (status_pagamento IN ('pago','a_receber','vencido',
                                                  'parcial','cancelado')),
  forma_pagamento  VARCHAR(40),
  prazo_pagamento  INT NOT NULL DEFAULT 30,
  data_vencimento  DATE,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto         NUMERIC(12,2) NOT NULL DEFAULT 0,
  frete            NUMERIC(12,2) NOT NULL DEFAULT 0,
  despesas         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo            NUMERIC(12,2) NOT NULL DEFAULT 0,
  lucro            NUMERIC(12,2) NOT NULL DEFAULT 0,
  margem           NUMERIC(6,2)  NOT NULL DEFAULT 0,
  tipo_entrega     VARCHAR(20)  DEFAULT 'entrega',
  endereco_entrega TEXT,
  transportadora   VARCHAR(100),
  rastreio         VARCHAR(100),
  obs_interna      TEXT,
  obs_cliente      TEXT,
  criado_por       INT REFERENCES midas.usuarios(id) ON DELETE SET NULL,
  editado_por      INT REFERENCES midas.usuarios(id) ON DELETE SET NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ITENS DA VENDA ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.itens_venda (
  id              SERIAL PRIMARY KEY,
  venda_id        INT NOT NULL REFERENCES midas.vendas(id)   ON DELETE CASCADE,
  produto_id      INT NOT NULL REFERENCES midas.produtos(id) ON DELETE RESTRICT,
  nome_produto    VARCHAR(200) NOT NULL,
  quantidade      NUMERIC(12,3) NOT NULL,
  valor_unitario  NUMERIC(12,2) NOT NULL,
  desconto        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL,
  custo_unit      NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- ── CONTAS A RECEBER ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.contas_receber (
  id               SERIAL PRIMARY KEY,
  cliente_id       INT NOT NULL REFERENCES midas.clientes(id) ON DELETE CASCADE,
  venda_id         INT REFERENCES midas.vendas(id) ON DELETE SET NULL,
  valor            NUMERIC(12,2) NOT NULL,
  valor_pago       NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_aberto     NUMERIC(12,2) NOT NULL,
  data_vencimento  DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'a_receber'
                     CHECK (status IN ('pago','a_receber','vencido','parcial','cancelado')),
  forma_pagamento  VARCHAR(40),
  obs              TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── LOGS DE AUDITORIA ────────────────────────────────────
CREATE TABLE IF NOT EXISTS midas.logs (
  id          SERIAL PRIMARY KEY,
  usuario_id  INT REFERENCES midas.usuarios(id) ON DELETE SET NULL,
  usuario_nm  VARCHAR(120),
  acao        VARCHAR(20),
  tabela      VARCHAR(40),
  referencia  INT,
  dados       TEXT,
  ip          VARCHAR(45),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ÍNDICES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_midas_vendas_data       ON midas.vendas(data);
CREATE INDEX IF NOT EXISTS idx_midas_vendas_cliente    ON midas.vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_midas_vendas_vendedor   ON midas.vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_midas_vendas_status     ON midas.vendas(status);
CREATE INDEX IF NOT EXISTS idx_midas_vendas_statuspag  ON midas.vendas(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_midas_itens_venda       ON midas.itens_venda(venda_id);
CREATE INDEX IF NOT EXISTS idx_midas_itens_produto     ON midas.itens_venda(produto_id);
CREATE INDEX IF NOT EXISTS idx_midas_mov_produto       ON midas.mov_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_midas_contas_cliente    ON midas.contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_midas_contas_venc       ON midas.contas_receber(data_vencimento);

-- ── TRIGGER: atualizar atualizado_em ─────────────────────
CREATE OR REPLACE FUNCTION midas.set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_usuarios_atualizado_em
  BEFORE UPDATE ON midas.usuarios
  FOR EACH ROW EXECUTE FUNCTION midas.set_atualizado_em();

CREATE OR REPLACE TRIGGER trg_vendedores_atualizado_em
  BEFORE UPDATE ON midas.vendedores
  FOR EACH ROW EXECUTE FUNCTION midas.set_atualizado_em();

CREATE OR REPLACE TRIGGER trg_clientes_atualizado_em
  BEFORE UPDATE ON midas.clientes
  FOR EACH ROW EXECUTE FUNCTION midas.set_atualizado_em();

CREATE OR REPLACE TRIGGER trg_produtos_atualizado_em
  BEFORE UPDATE ON midas.produtos
  FOR EACH ROW EXECUTE FUNCTION midas.set_atualizado_em();

CREATE OR REPLACE TRIGGER trg_vendas_atualizado_em
  BEFORE UPDATE ON midas.vendas
  FOR EACH ROW EXECUTE FUNCTION midas.set_atualizado_em();

CREATE OR REPLACE TRIGGER trg_contas_atualizado_em
  BEFORE UPDATE ON midas.contas_receber
  FOR EACH ROW EXECUTE FUNCTION midas.set_atualizado_em();