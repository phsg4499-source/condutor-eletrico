-- =====================================================================================
-- Migration 0006: Agenda — compromissos (visitas técnicas, orçamentos presenciais,
-- reuniões, etc.), com ou sem vínculo a um orçamento/ordem de serviço/cliente.
-- Rode este script no SQL Editor do Supabase, igual os anteriores.
-- =====================================================================================

create table if not exists compromissos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'outro' check (tipo in ('visita_orcamento', 'execucao_servico', 'reuniao', 'outro')),
  data date not null,
  hora time,
  client_id uuid references clients(id) on delete set null,
  cliente_nome_avulso text,
  cliente_telefone_avulso text,
  budget_id uuid references budgets(id) on delete set null,
  service_order_id uuid references service_orders(id) on delete set null,
  orcamentista_id uuid references orcamentistas(id) on delete set null,
  local text,
  observacoes text,
  status text not null default 'agendado' check (status in ('agendado', 'concluido', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_compromissos_org on compromissos(organization_id);
create index if not exists idx_compromissos_data on compromissos(data);

drop trigger if exists trg_compromissos_updated_at on compromissos;
create trigger trg_compromissos_updated_at before update on compromissos
  for each row execute function set_updated_at();

alter table compromissos enable row level security;
drop policy if exists compromissos_select on compromissos;
create policy compromissos_select on compromissos for select using (organization_id = current_org_id());
drop policy if exists compromissos_insert on compromissos;
create policy compromissos_insert on compromissos for insert with check (organization_id = current_org_id());
drop policy if exists compromissos_update on compromissos;
create policy compromissos_update on compromissos for update using (organization_id = current_org_id());
drop policy if exists compromissos_delete on compromissos;
create policy compromissos_delete on compromissos for delete using (organization_id = current_org_id());
