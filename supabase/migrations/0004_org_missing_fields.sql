-- =====================================================================================
-- Migration 0004: adiciona campos que existiam no app mas não na tabela organizations.
-- Sem isso, o PDF quebrava ao tentar imprimir um campo inexistente (undefined).
-- Rode este script no SQL Editor do Supabase, igual você fez com os anteriores.
-- =====================================================================================

alter table organizations
  add column if not exists responsavel text,
  add column if not exists experiencia text;

-- Preenche com um valor padrão as organizações que já existem e estão vazias,
-- para o PDF não ficar com texto em branco até você editar em Configurações.
update organizations
set responsavel = coalesce(responsavel, nome_fantasia)
where responsavel is null;

update organizations
set experiencia = coalesce(experiencia, 'Soluções elétricas com segurança e qualidade técnica.')
where experiencia is null;
