-- ============================================================
-- MIDAS - Dados iniciais (seed)
-- Senha padrao: Midas@2025
-- ============================================================

SET search_path TO midas, public;

INSERT INTO midas.categorias (nome) VALUES
  ('Frios'),('Aves'),('Oleos'),('Graos'),('Massas'),
  ('Bebidas'),('Laticinios'),('Limpeza'),('Higiene'),('Outro')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO midas.usuarios (nome, email, senha_hash, nivel, status) VALUES
  ('Administrador',  'admin@midas.com',      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin',      'ativo'),
  ('Gerente Midas',  'gerente@midas.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'gerente',    'ativo'),
  ('Joao Vendedor',  'vendedor@midas.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'vendedor',   'ativo'),
  ('Ana Financeiro', 'financeiro@midas.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'financeiro', 'ativo'),
  ('Pedro Estoque',  'estoque@midas.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'estoque',    'ativo')
ON CONFLICT (email) DO NOTHING;

INSERT INTO midas.vendedores (nome, telefone, whatsapp, email, cidade, estado, comissao, meta, status) VALUES
  ('Joao Carlos Vendas', '(11) 99111-2222', '(11) 99111-2222', 'joao@midas.com',     'Sao Paulo',      'SP', 3.0, 50000, 'ativo'),
  ('Fernanda Lima',      '(21) 99222-3333', '(21) 99222-3333', 'fernanda@midas.com', 'Rio de Janeiro', 'RJ', 3.5, 40000, 'ativo'),
  ('Roberto Sousa',      '(31) 99333-4444', '(31) 99333-4444', 'roberto@midas.com',  'Belo Horizonte', 'MG', 2.5, 30000, 'ativo')
ON CONFLICT DO NOTHING;

UPDATE midas.usuarios SET vendedor_id = (
  SELECT id FROM midas.vendedores WHERE email='joao@midas.com' LIMIT 1
) WHERE email = 'vendedor@midas.com';

INSERT INTO midas.clientes
  (codigo, nome, nome_fantasia, cpf_cnpj, tipo, responsavel, telefone, whatsapp, email,
   endereco, numero, bairro, cidade, estado, cep, tipo_estab, limite_credito, prazo_pagamento, status, vendedor_id)
VALUES
  ('CLI-001','Mercado Central Ltda','Mercado Central','12.345.678/0001-90','PJ','Carlos Silva',
   '(11) 3333-1111','(11) 99999-1111','carlos@mercadocentral.com',
   'Av. Paulista','1000','Bela Vista','Sao Paulo','SP','01310-100','Supermercado',50000,30,'ativo',
   (SELECT id FROM midas.vendedores WHERE email='joao@midas.com' LIMIT 1)),
  ('CLI-002','Padaria Flor do Trigo','Flor do Trigo','98.765.432/0001-10','PJ','Maria Oliveira',
   '(11) 4444-2222','(11) 98888-2222','maria@flortrigo.com',
   'Rua Augusta','500','Consolacao','Sao Paulo','SP','01305-000','Padaria',15000,15,'ativo',
   (SELECT id FROM midas.vendedores WHERE email='joao@midas.com' LIMIT 1)),
  ('CLI-003','Distribuidora Nortao','Nortao','11.222.333/0001-44','PJ','Pedro Santos',
   '(92) 3333-5555','(92) 97777-5555','pedro@nortao.com',
   'Av. Eduardo Ribeiro','200','Centro','Manaus','AM','69010-000','Distribuidora',80000,60,'ativo',
   (SELECT id FROM midas.vendedores WHERE email='fernanda@midas.com' LIMIT 1))
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO midas.produtos
  (codigo, sku, nome, categoria_id, marca, unidade, preco_custo, preco_venda,
   estoque_atual, estoque_minimo, estoque_maximo, localizacao, codigo_barras, status)
VALUES
  ('PRD-001','BAC-LT-001','Bacon Defumado 1kg',
   (SELECT id FROM midas.categorias WHERE nome='Frios'),
   'FrigoTop','KG',22.50,35.90,150,30,500,'A1-01','7891234560001','ativo'),
  ('PRD-002','LGC-PT-001','Linguica Toscana 1kg',
   (SELECT id FROM midas.categorias WHERE nome='Frios'),
   'FrigoTop','KG',15.00,24.90,200,50,600,'A1-02','7891234560002','ativo'),
  ('PRD-003','ARZ-TP5-001','Arroz Tipo 1 5kg',
   (SELECT id FROM midas.categorias WHERE nome='Graos'),
   'TioJoao','SC',14.50,22.90,300,80,1000,'D1-01','7891234560005','ativo'),
  ('PRD-004','FEJ-PT1-001','Feijao Preto 1kg',
   (SELECT id FROM midas.categorias WHERE nome='Graos'),
   'Camil','UN',6.20,9.90,180,60,800,'D1-02','7891234560006','ativo'),
  ('PRD-005','OLE-SJ1-001','Oleo de Soja 900ml',
   (SELECT id FROM midas.categorias WHERE nome='Oleos'),
   'Liza','UN',5.80,8.90,120,50,600,'C1-02','7891234560008','ativo')
ON CONFLICT (codigo) DO NOTHING;
