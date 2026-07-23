-- Migration incremental: cadastro de orçamentistas (responsáveis por montar orçamentos)
-- e vínculo do orçamento ao orçamentista responsável.

create table if not exists orcamentistas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  cargo text not null default 'Orçamentista',
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  foto_url text,
  observacoes text,
  aparece_no_pdf boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orcamentistas_org on orcamentistas(organization_id);

drop trigger if exists trg_orcamentistas_updated_at on orcamentistas;
create trigger trg_orcamentistas_updated_at before update on orcamentistas
  for each row execute function set_updated_at();

alter table orcamentistas enable row level security;
drop policy if exists orcamentistas_select on orcamentistas;
create policy orcamentistas_select on orcamentistas for select using (organization_id = current_org_id());
drop policy if exists orcamentistas_insert on orcamentistas;
create policy orcamentistas_insert on orcamentistas for insert with check (organization_id = current_org_id());
drop policy if exists orcamentistas_update on orcamentistas;
create policy orcamentistas_update on orcamentistas for update using (organization_id = current_org_id());
drop policy if exists orcamentistas_delete on orcamentistas;
create policy orcamentistas_delete on orcamentistas for delete using (organization_id = current_org_id());

-- Vincula o orçamento ao orçamentista responsável (opcional, mantém compatibilidade com o
-- campo de texto livre "responsavel" já existente).
alter table budgets add column if not exists orcamentista_id uuid references orcamentistas(id) on delete set null;

-- Orçamentistas demonstrativos (fictícios), para quem já rodou a migration inicial.
insert into orcamentistas (organization_id, nome, telefone, email, cargo, status, aparece_no_pdf, observacoes)
values
  ('00000000-0000-0000-0000-000000000001', 'Felipe Ribeiro', '(11) 90000-0000', 'felipe@condutoreletrico.com.br', 'Responsável técnico e comercial', 'ativo', true, 'Fundador — mais de 10 anos de experiência.'),
  ('00000000-0000-0000-0000-000000000001', 'Renata Duarte (fictício)', '(11) 90000-7777', 'renata@condutoreletrico.com.br', 'Orçamentista', 'ativo', true, null)
on conflict do nothing;
