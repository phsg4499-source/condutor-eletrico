-- =====================================================================================
-- Migration 0009: Recibos — emitidos ao finalizar um serviço, vinculados ao orçamento e/ou
-- ordem de serviço de origem (rastreabilidade), sem duplicar cadastro de cliente.
-- Não é destrutiva: só cria tabela nova. Rode no SQL Editor do Supabase, igual as anteriores.
-- =====================================================================================

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  numero text not null,
  budget_id uuid references budgets(id) on delete set null,
  service_order_id uuid references service_orders(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  -- Snapshot dos dados do cliente no momento da emissão (o orçamento pode não ter cliente
  -- cadastrado — "cliente sem cadastro" — e mesmo quando tem, o recibo preserva o dado histórico
  -- mesmo que o cadastro do cliente mude depois).
  cliente_nome text not null,
  cliente_documento text,
  cliente_telefone text,
  cliente_endereco text,
  descricao text not null,
  valor numeric not null default 0,
  valor_recebido numeric not null default 0,
  forma_pagamento text,
  data date not null default current_date,
  responsavel text,
  status text not null default 'emitido' check (status in ('emitido', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, numero)
);
create index if not exists idx_receipts_org on receipts(organization_id);
create index if not exists idx_receipts_budget on receipts(budget_id);
create index if not exists idx_receipts_data on receipts(data);

drop trigger if exists trg_receipts_updated_at on receipts;
create trigger trg_receipts_updated_at before update on receipts
  for each row execute function set_updated_at();

alter table receipts enable row level security;
drop policy if exists receipts_select on receipts;
create policy receipts_select on receipts for select using (organization_id = current_org_id());
drop policy if exists receipts_insert on receipts;
create policy receipts_insert on receipts for insert with check (organization_id = current_org_id());
drop policy if exists receipts_update on receipts;
create policy receipts_update on receipts for update using (organization_id = current_org_id());
drop policy if exists receipts_delete on receipts;
create policy receipts_delete on receipts for delete using (organization_id = current_org_id());
