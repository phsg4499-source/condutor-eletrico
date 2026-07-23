-- =====================================================================================
-- CONDUTOR ELÉTRICO — Esquema completo do banco de dados (Supabase / PostgreSQL)
-- =====================================================================================
-- Como executar:
--   1. Acesse seu projeto em https://supabase.com/dashboard
--   2. Vá em "SQL Editor" > "New query"
--   3. Cole todo o conteúdo deste arquivo e clique em "Run"
--   4. Este script é IDEMPOTENTE na criação de tipos/tabelas (usa IF NOT EXISTS),
--      mas foi escrito para ser executado uma única vez em um banco novo.
--   5. Alterações futuras devem ser feitas por migrations incrementais na pasta
--      /supabase/migrations, nunca reescrevendo este arquivo inteiro.
-- =====================================================================================

-- Extensões necessárias
create extension if not exists "pgcrypto";

-- =====================================================================================
-- FUNÇÃO UTILITÁRIA: atualizar updated_at automaticamente
-- =====================================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================================
-- TIPOS ENUMERADOS
-- =====================================================================================
do $$ begin
  create type access_level as enum ('administrador', 'orcamentista', 'eletricista', 'financeiro', 'visualizacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_pessoa as enum ('fisica', 'juridica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unidade_medida as enum ('unidade','metro','rolo','caixa','pacote','par','jogo','kg','litro','hora','diaria','servico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type budget_status as enum (
    'rascunho','em_elaboracao','aguardando_vistoria','aguardando_informacoes','pronto_para_envio',
    'enviado','visualizado','em_negociacao','revisao_solicitada','aprovado','aprovado_parcialmente',
    'recusado','vencido','cancelado','convertido_em_os'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_order_status as enum (
    'aguardando_agendamento','agendada','em_deslocamento','em_execucao','pausada','aguardando_material',
    'aguardando_cliente','concluida','aguardando_conferencia','finalizada','cancelada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type forma_pagamento as enum ('pix','dinheiro','transferencia','boleto','debito','credito','entrada_parcelas','a_combinar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pendente','parcial','pago','atrasado','cancelado','renegociado');
exception when duplicate_object then null; end $$;

-- =====================================================================================
-- TABELA: organizations
-- Estrutura multiempresa. Cada empresa que usar o sistema tem uma linha aqui.
-- =====================================================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text not null,
  documento text,                    -- CPF ou CNPJ
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  logo_url text,
  cor_principal text default '#16181d',
  cor_secundaria text default '#f5c518',
  instagram text,
  site text,
  chave_pix text,
  dados_bancarios text,
  condicoes_padrao text,
  prazo_validade_padrao_dias integer default 10,
  garantia_padrao text default '90 dias',
  observacoes_padrao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table organizations is 'Empresas que utilizam o sistema (estrutura multiempresa/multiusuário).';

drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

-- =====================================================================================
-- TABELA: profiles
-- Perfil de cada usuário autenticado, vinculado a uma organização.
-- Criado automaticamente após o cadastro via trigger em auth.users.
-- =====================================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  nome text,
  email text,
  telefone text,
  cargo access_level not null default 'visualizacao',
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table profiles is 'Perfil e permissões de cada usuário do sistema, vinculado a uma organização.';

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Trigger: criar profile automaticamente quando um usuário se cadastra no Supabase Auth
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome, email, cargo)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email, 'administrador');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================================
-- TABELA: clients
-- =====================================================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  tipo_pessoa tipo_pessoa not null default 'fisica',
  nome text not null,
  nome_fantasia text,
  documento text,
  inscricao_estadual text,
  inscricao_municipal text,
  responsavel_contato text,
  telefone text,
  whatsapp text,
  email text,
  data_nascimento date,
  observacoes text,
  origem text,
  status text not null default 'ativo',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_org on clients(organization_id);
create index if not exists idx_clients_documento on clients(documento);

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- Endereços do cliente (um cliente pode ter vários: residência, obra, loja etc.)
create table if not exists client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  rotulo text not null default 'Principal',
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  ponto_referencia text,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_addresses_client on client_addresses(client_id);

-- =====================================================================================
-- TABELA: suppliers (fornecedores)
-- =====================================================================================
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  razao_social text not null,
  nome_fantasia text,
  documento text,
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  categorias text[] default '{}',
  prazo_pagamento text,
  avaliacao numeric(2,1),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_suppliers_org on suppliers(organization_id);

drop trigger if exists trg_suppliers_updated_at on suppliers;
create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();

-- =====================================================================================
-- TABELA: materials
-- =====================================================================================
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  codigo text not null,
  codigo_barras text,
  nome text not null,
  descricao text,
  categoria text not null default 'Geral',
  subcategoria text,
  marca text,
  modelo text,
  unidade unidade_medida not null default 'unidade',
  preco_custo numeric(12,2) not null default 0,
  preco_venda numeric(12,2) not null default 0,
  margem_padrao numeric(6,2) default 0,
  estoque_atual numeric(12,2) not null default 0,
  estoque_minimo numeric(12,2) not null default 0,
  fornecedor_id uuid references suppliers(id) on delete set null,
  ativo boolean not null default true,
  observacoes text,
  foto_url text,
  link_referencia text,
  garantia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index if not exists idx_materials_org on materials(organization_id);
create index if not exists idx_materials_categoria on materials(categoria);

drop trigger if exists trg_materials_updated_at on materials;
create trigger trg_materials_updated_at before update on materials
  for each row execute function set_updated_at();

-- =====================================================================================
-- TABELA: services (catálogo de serviços)
-- =====================================================================================
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  codigo text not null,
  nome text not null,
  categoria text not null default 'Geral',
  descricao_tecnica text,
  unidade unidade_medida not null default 'servico',
  valor_padrao numeric(12,2) not null default 0,
  custo_mao_obra numeric(12,2) not null default 0,
  tempo_estimado_horas numeric(6,2),
  quantidade_profissionais integer default 1,
  margem_padrao numeric(6,2) default 0,
  garantia_padrao text default '90 dias',
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, codigo)
);
create index if not exists idx_services_org on services(organization_id);

drop trigger if exists trg_services_updated_at on services;
create trigger trg_services_updated_at before update on services
  for each row execute function set_updated_at();

-- =====================================================================================
-- TABELA: budgets (orçamentos) + budget_items + budget_extra_costs + budget_status_history
-- =====================================================================================
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  numero text not null,
  client_id uuid not null references clients(id) on delete restrict,
  titulo text not null,
  tipo_servico text,
  descricao_problema text,
  local_servico text,
  data_emissao date not null default current_date,
  validade_dias integer not null default 10,
  prazo_estimado text,
  responsavel text,
  status budget_status not null default 'rascunho',
  desconto_percentual numeric(5,2) not null default 0,
  desconto_valor numeric(12,2) not null default 0,
  forma_pagamento forma_pagamento not null default 'pix',
  entrada numeric(12,2) not null default 0,
  parcelas integer not null default 1,
  garantia text,
  observacoes_internas text,
  observacoes_cliente text,
  link_publico_token uuid not null default gen_random_uuid(), -- usado na URL pública não previsível
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);
create index if not exists idx_budgets_org on budgets(organization_id);
create index if not exists idx_budgets_client on budgets(client_id);
create index if not exists idx_budgets_status on budgets(status);
create index if not exists idx_budgets_public_token on budgets(link_publico_token);

drop trigger if exists trg_budgets_updated_at on budgets;
create trigger trg_budgets_updated_at before update on budgets
  for each row execute function set_updated_at();

create table if not exists budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  tipo text not null check (tipo in ('servico','material')),
  referencia_service_id uuid references services(id) on delete set null,
  referencia_material_id uuid references materials(id) on delete set null,
  nome text not null,
  descricao text,
  quantidade numeric(12,2) not null default 1,
  unidade unidade_medida not null default 'unidade',
  custo_unitario numeric(12,2) not null default 0,
  valor_unitario numeric(12,2) not null default 0,
  desconto numeric(12,2) not null default 0,
  ordem integer default 0,
  fornecido_por_cliente boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_items_budget on budget_items(budget_id);

create table if not exists budget_extra_costs (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  descricao text not null,
  valor numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_extra_costs_budget on budget_extra_costs(budget_id);

create table if not exists budget_status_history (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  status budget_status not null,
  comentario text,
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_status_history_budget on budget_status_history(budget_id);

-- Aprovação/rejeição pública do orçamento (aceite eletrônico, não certificação ICP-Brasil)
create table if not exists budget_approvals (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  nome_responsavel text not null,
  documento text,
  decisao text not null check (decisao in ('aprovado','recusado','solicitou_alteracao')),
  comentario text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_budget_approvals_budget on budget_approvals(budget_id);

-- =====================================================================================
-- TABELA: service_orders (ordens de serviço)
-- =====================================================================================
create table if not exists service_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  numero text not null,
  budget_id uuid references budgets(id) on delete set null,
  client_id uuid not null references clients(id) on delete restrict,
  data_prevista date,
  data_inicio date,
  data_conclusao date,
  responsavel_tecnico text,
  status service_order_status not null default 'aguardando_agendamento',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);
create index if not exists idx_service_orders_org on service_orders(organization_id);
create index if not exists idx_service_orders_client on service_orders(client_id);

drop trigger if exists trg_service_orders_updated_at on service_orders;
create trigger trg_service_orders_updated_at before update on service_orders
  for each row execute function set_updated_at();

create table if not exists service_order_checklist (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id) on delete cascade,
  item text not null,
  concluido boolean not null default false,
  ordem integer default 0
);
create index if not exists idx_so_checklist_order on service_order_checklist(service_order_id);

create table if not exists service_order_photos (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references service_orders(id) on delete cascade,
  fase text not null check (fase in ('antes','durante','depois')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================================
-- TABELA: payments (financeiro / contas a receber)
-- =====================================================================================
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  budget_id uuid references budgets(id) on delete set null,
  service_order_id uuid references service_orders(id) on delete set null,
  descricao text not null,
  valor numeric(12,2) not null default 0,
  vencimento date,
  data_recebimento date,
  forma_pagamento forma_pagamento,
  status payment_status not null default 'pendente',
  comprovante_url text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_org on payments(organization_id);
create index if not exists idx_payments_status on payments(status);

drop trigger if exists trg_payments_updated_at on payments;
create trigger trg_payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- =====================================================================================
-- TABELA: quote_requests (solicitações públicas de orçamento — landing page)
-- =====================================================================================
create table if not exists quote_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  nome text not null,
  documento text,
  telefone text not null,
  email text,
  tipo_cliente text,
  endereco_servico text,
  cep text,
  cidade text,
  estado text,
  tipo_imovel text,
  servico_desejado text,
  descricao text,
  urgencia text,
  melhor_dia text,
  melhor_periodo text,
  permite_whatsapp boolean default true,
  status text not null default 'novo',
  created_at timestamptz not null default now()
);
create index if not exists idx_quote_requests_org on quote_requests(organization_id);

-- =====================================================================================
-- ROW LEVEL SECURITY (RLS)
-- Regra geral: usuários só acessam dados da própria organização (via profiles.organization_id).
-- =====================================================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_addresses enable row level security;
alter table suppliers enable row level security;
alter table materials enable row level security;
alter table services enable row level security;
alter table budgets enable row level security;
alter table budget_items enable row level security;
alter table budget_extra_costs enable row level security;
alter table budget_status_history enable row level security;
alter table budget_approvals enable row level security;
alter table service_orders enable row level security;
alter table service_order_checklist enable row level security;
alter table service_order_photos enable row level security;
alter table payments enable row level security;
alter table quote_requests enable row level security;

-- Função auxiliar: organization_id do usuário autenticado
create or replace function current_org_id()
returns uuid as $$
  select organization_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- organizations: usuário só vê/edita a própria organização
drop policy if exists org_select on organizations;
create policy org_select on organizations for select using (id = current_org_id());
drop policy if exists org_update on organizations;
create policy org_update on organizations for update using (id = current_org_id());

-- profiles: usuário vê perfis da própria organização; só edita o próprio perfil
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (organization_id = current_org_id());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (id = auth.uid());

-- Política padrão reaproveitável para tabelas comerciais com organization_id
do $$
declare
  t text;
begin
  foreach t in array array['clients','suppliers','materials','services','budgets','service_orders','payments','quote_requests']
  loop
    execute format('drop policy if exists %I_select on %I;', t, t);
    execute format('create policy %I_select on %I for select using (organization_id = current_org_id());', t, t);
    execute format('drop policy if exists %I_insert on %I;', t, t);
    execute format('create policy %I_insert on %I for insert with check (organization_id = current_org_id());', t, t);
    execute format('drop policy if exists %I_update on %I;', t, t);
    execute format('create policy %I_update on %I for update using (organization_id = current_org_id());', t, t);
    execute format('drop policy if exists %I_delete on %I;', t, t);
    execute format('create policy %I_delete on %I for delete using (organization_id = current_org_id());', t, t);
  end loop;
end $$;

-- Tabelas filhas (sem organization_id direto): checam pela tabela pai
drop policy if exists client_addresses_all on client_addresses;
create policy client_addresses_all on client_addresses for all using (
  exists (select 1 from clients c where c.id = client_addresses.client_id and c.organization_id = current_org_id())
);

drop policy if exists budget_items_all on budget_items;
create policy budget_items_all on budget_items for all using (
  exists (select 1 from budgets b where b.id = budget_items.budget_id and b.organization_id = current_org_id())
);

drop policy if exists budget_extra_costs_all on budget_extra_costs;
create policy budget_extra_costs_all on budget_extra_costs for all using (
  exists (select 1 from budgets b where b.id = budget_extra_costs.budget_id and b.organization_id = current_org_id())
);

drop policy if exists budget_status_history_all on budget_status_history;
create policy budget_status_history_all on budget_status_history for all using (
  exists (select 1 from budgets b where b.id = budget_status_history.budget_id and b.organization_id = current_org_id())
);

drop policy if exists budget_approvals_select on budget_approvals;
create policy budget_approvals_select on budget_approvals for select using (
  exists (select 1 from budgets b where b.id = budget_approvals.budget_id and b.organization_id = current_org_id())
);
-- Inserção de aprovação é feita pelo cliente (anônimo) via link público — sem RLS de organização,
-- mas restrita a um orçamento existente e válido pela camada de aplicação (token não previsível).
drop policy if exists budget_approvals_insert_public on budget_approvals;
create policy budget_approvals_insert_public on budget_approvals for insert with check (true);

drop policy if exists service_order_checklist_all on service_order_checklist;
create policy service_order_checklist_all on service_order_checklist for all using (
  exists (select 1 from service_orders so where so.id = service_order_checklist.service_order_id and so.organization_id = current_org_id())
);

drop policy if exists service_order_photos_all on service_order_photos;
create policy service_order_photos_all on service_order_photos for all using (
  exists (select 1 from service_orders so where so.id = service_order_photos.service_order_id and so.organization_id = current_org_id())
);

-- quote_requests: além do acesso da organização, permite INSERT público (formulário do site)
drop policy if exists quote_requests_insert_public on quote_requests;
create policy quote_requests_insert_public on quote_requests for insert with check (true);

-- =====================================================================================
-- DADOS INICIAIS DEMONSTRATIVOS
-- Claramente marcados como fictícios. Não usar como tabela oficial de preços nem como
-- documentos reais de pessoas.
-- =====================================================================================
insert into organizations (
  id, razao_social, nome_fantasia, documento, telefone, whatsapp, email, endereco, cidade, estado, cep,
  cor_principal, cor_secundaria, instagram, chave_pix, condicoes_padrao, prazo_validade_padrao_dias,
  garantia_padrao, observacoes_padrao
) values (
  '00000000-0000-0000-0000-000000000001',
  'Condutor Elétrico Serviços Elétricos Ltda (demonstrativo)', 'Condutor Elétrico',
  '00.000.000/0001-00 (demonstrativo)', '(11) 90000-0000', '5511900000000',
  'contato@condutoreletrico.com.br', 'Rua das Instalações, 123', 'São Paulo', 'SP', '01000-000',
  '#16181d', '#f5c518', '@condutoreletricobrasil', 'contato@condutoreletrico.com.br (demonstrativo)',
  'Pagamento conforme condições combinadas na proposta.', 10, 'Garantia de 90 dias para serviços executados.',
  'Valores sujeitos a alteração após vistoria técnica presencial.'
) on conflict (id) do nothing;

-- Observação: a criação do primeiro usuário administrador deve ser feita pelo Supabase Auth
-- (ver instruções no README.md), e não por INSERT direto nesta tabela, pois profiles.id
-- referencia auth.users.id. Após o cadastro, atualize o organization_id do profile:
--   update profiles set organization_id = '00000000-0000-0000-0000-000000000001', cargo = 'administrador'
--   where email = 'SEU-EMAIL-DE-ADMIN@exemplo.com';

-- Materiais demonstrativos (preços de exemplo, editáveis)
insert into materials (organization_id, codigo, nome, categoria, unidade, preco_custo, preco_venda, estoque_atual, estoque_minimo) values
('00000000-0000-0000-0000-000000000001','FIO-1.5','Cabo flexível 1,5 mm²','Fios e cabos','metro',1.2,2.1,200,50),
('00000000-0000-0000-0000-000000000001','FIO-2.5','Cabo flexível 2,5 mm²','Fios e cabos','metro',1.8,3.0,200,50),
('00000000-0000-0000-0000-000000000001','FIO-4','Cabo flexível 4 mm²','Fios e cabos','metro',2.6,4.2,150,40),
('00000000-0000-0000-0000-000000000001','FIO-6','Cabo flexível 6 mm²','Fios e cabos','metro',3.9,6.3,100,30),
('00000000-0000-0000-0000-000000000001','DISJ-MONO','Disjuntor monopolar 10-32A','Proteção elétrica','unidade',9.5,18.0,60,15),
('00000000-0000-0000-0000-000000000001','DISJ-BI','Disjuntor bipolar 10-63A','Proteção elétrica','unidade',22.0,39.0,40,10),
('00000000-0000-0000-0000-000000000001','DR-25','Dispositivo DR 25A','Proteção elétrica','unidade',85.0,145.0,20,5),
('00000000-0000-0000-0000-000000000001','DPS-40','DPS classe II 40kA','Proteção elétrica','unidade',65.0,112.0,20,5),
('00000000-0000-0000-0000-000000000001','QD-12','Quadro de distribuição 12 disjuntores','Quadros elétricos','unidade',60.0,105.0,15,5),
('00000000-0000-0000-0000-000000000001','TOM-10A','Tomada 10A com placa','Tomadas e interruptores','unidade',6.5,12.0,100,20),
('00000000-0000-0000-0000-000000000001','INT-SIMPLES','Interruptor simples com placa','Tomadas e interruptores','unidade',5.5,10.5,100,20),
('00000000-0000-0000-0000-000000000001','LAMP-LED9','Lâmpada LED 9W bivolt','Iluminação','unidade',5.0,9.9,150,30),
('00000000-0000-0000-0000-000000000001','PAINEL-LED','Painel LED de embutir 24W','Iluminação','unidade',28.0,49.0,50,10),
('00000000-0000-0000-0000-000000000001','FITA-LED','Fita LED 5m com fonte','Iluminação','unidade',45.0,79.0,20,5),
('00000000-0000-0000-0000-000000000001','HASTE-ATERR','Haste de aterramento 2,4m com conector','Aterramento','unidade',32.0,55.0,25,5)
on conflict (organization_id, codigo) do nothing;

-- Serviços demonstrativos (valores de exemplo, editáveis)
insert into services (organization_id, codigo, nome, categoria, unidade, valor_padrao, custo_mao_obra) values
('00000000-0000-0000-0000-000000000001','VIS-TEC','Visita técnica','Diagnóstico','servico',90,60),
('00000000-0000-0000-0000-000000000001','DIAG-ELET','Diagnóstico elétrico completo','Diagnóstico','servico',180,110),
('00000000-0000-0000-0000-000000000001','INST-TOM','Instalação de tomada','Instalações','unidade',60,35),
('00000000-0000-0000-0000-000000000001','INST-INT','Instalação de interruptor','Instalações','unidade',60,35),
('00000000-0000-0000-0000-000000000001','INST-LUM','Instalação de luminária','Iluminação','unidade',70,40),
('00000000-0000-0000-0000-000000000001','INST-VENT','Instalação de ventilador de teto','Instalações','unidade',150,90),
('00000000-0000-0000-0000-000000000001','INST-CHUV','Instalação de chuveiro elétrico','Instalações','unidade',130,80),
('00000000-0000-0000-0000-000000000001','CIRC-AR','Instalação de circuito para ar-condicionado','Circuitos','servico',320,190),
('00000000-0000-0000-0000-000000000001','INST-DISJ','Instalação de disjuntor','Proteção','unidade',60,35),
('00000000-0000-0000-0000-000000000001','INST-DR','Instalação de DR','Proteção','unidade',140,85),
('00000000-0000-0000-0000-000000000001','MONT-QUADRO','Montagem de quadro elétrico','Quadros','servico',450,280),
('00000000-0000-0000-0000-000000000001','INST-ATERR','Instalação de aterramento','Aterramento','servico',350,210),
('00000000-0000-0000-0000-000000000001','CORR-FUGA','Correção de fuga de corrente','Manutenção','servico',220,130),
('00000000-0000-0000-0000-000000000001','MANUT-PREV','Manutenção preventiva','Manutenção','servico',160,95),
('00000000-0000-0000-0000-000000000001','HORA-TEC','Hora técnica avulsa','Diversos','hora',70,40),
('00000000-0000-0000-0000-000000000001','ATEND-EMERG','Atendimento emergencial','Diversos','servico',250,140)
on conflict (organization_id, codigo) do nothing;

-- =====================================================================================
-- FIM DO SCRIPT
-- =====================================================================================
