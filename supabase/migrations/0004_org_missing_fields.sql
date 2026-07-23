-- =====================================================================================
-- Migration 0004: adiciona campos que existem no app mas faltavam na tabela organizations
-- (por isso apareciam como "undefined" nos Configurações e quebravam o PDF).
-- Rode este script no SQL Editor do Supabase, igual você fez com os anteriores.
-- =====================================================================================

alter table organizations
  add column if not exists responsavel text,
  add column if not exists experiencia text,
  add column if not exists modo_calculo_margem text default 'markup_sobre_custo',
  add column if not exists margem_minima_percentual numeric default 20,
  add column if not exists impostos_estimados_percentual numeric default 0;

-- Preenche com valores padrão as organizações já existentes que estejam vazias,
-- para nada ficar em branco ou "undefined" até você editar em Configurações.
update organizations
set responsavel = coalesce(responsavel, nome_fantasia)
where responsavel is null;

update organizations
set experiencia = coalesce(experiencia, 'Soluções elétricas com segurança e qualidade técnica.')
where experiencia is null;

update organizations
set modo_calculo_margem = coalesce(modo_calculo_margem, 'markup_sobre_custo')
where modo_calculo_margem is null;

update organizations
set margem_minima_percentual = coalesce(margem_minima_percentual, 20)
where margem_minima_percentual is null;

update organizations
set impostos_estimados_percentual = coalesce(impostos_estimados_percentual, 0)
where impostos_estimados_percentual is null;
