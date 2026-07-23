-- =====================================================================================
-- Migration 0005: permite criar orçamento (e ordem de serviço) sem exigir cliente cadastrado.
-- Antes, client_id era obrigatório em budgets e service_orders, o que forçava cadastrar o
-- cliente antes de orçar. Agora client_id é opcional, e quando não há cliente cadastrado,
-- o nome/telefone ficam guardados direto no próprio orçamento.
-- Rode este script no SQL Editor do Supabase, igual os anteriores.
-- =====================================================================================

alter table budgets
  alter column client_id drop not null,
  add column if not exists cliente_nome_avulso text,
  add column if not exists cliente_telefone_avulso text,
  add column if not exists cliente_whatsapp_avulso text;

alter table service_orders
  alter column client_id drop not null,
  add column if not exists cliente_nome_avulso text,
  add column if not exists cliente_telefone_avulso text,
  add column if not exists cliente_whatsapp_avulso text;
