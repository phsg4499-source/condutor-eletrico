-- =====================================================================================
-- 0008_meta_faturamento_mensal.sql
-- Adiciona a meta de faturamento mensal (editável em Configurações), usada no painel
-- geral para mostrar o percentual atingido no mês. Coluna opcional com valor padrão
-- seguro — não afeta registros existentes.
-- =====================================================================================

alter table organizations
  add column if not exists meta_faturamento_mensal numeric(12,2) not null default 25000;
