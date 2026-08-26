-- =====================================================================================
-- 0010_proposta_detalhada.sql
-- Adiciona o suporte a "Proposta técnica completa" — um segundo modo de orçamento, mais
-- elaborado (laudo técnico, ambientes/atividades, escopo, valores e condições em texto rico),
-- ao lado do orçamento simples já existente. Nenhuma tabela nova, nenhuma policy nova: toda a
-- estrutura adicional (ambientes, textos ricos, valores, prazos, encerramento) fica numa única
-- coluna jsonb opcional em "budgets" — coberta pelas RLS policies que já existem na tabela.
--
-- Orçamentos existentes não são afetados: a coluna nasce nula, e o app só entra no caminho novo
-- (formulário/PDF/página pública) quando ela está preenchida.
--
-- Como executar: SQL Editor do Supabase > New query > colar e rodar. Idempotente
-- (add column if not exists / create or replace function), pode rodar mais de uma vez.
-- =====================================================================================

alter table budgets add column if not exists proposta_detalhada jsonb;
alter table organizations add column if not exists apresentacao_padrao_html text;

-- Atualiza a função pública de leitura do orçamento (migration 0007) para também devolver a
-- proposta detalhada e o texto institucional padrão da organização — necessários para a página
-- pública /proposta/:token renderizar corretamente uma proposta técnica completa.
create or replace function public_get_budget(p_token uuid)
returns table (
  id uuid,
  numero text,
  titulo text,
  tipo_servico text,
  local_servico text,
  data_emissao date,
  validade_dias integer,
  prazo_estimado text,
  status budget_status,
  desconto_percentual numeric,
  desconto_valor numeric,
  forma_pagamento forma_pagamento,
  entrada numeric,
  parcelas integer,
  garantia text,
  observacoes_cliente text,
  proposta_detalhada jsonb,
  cliente_nome text,
  cliente_telefone text,
  cliente_whatsapp text,
  org_nome_fantasia text,
  org_razao_social text,
  org_telefone text,
  org_whatsapp text,
  org_email text,
  org_instagram text,
  org_logo_url text,
  org_cor_principal text,
  org_cor_secundaria text,
  org_experiencia text,
  org_responsavel text,
  org_cidade text,
  org_apresentacao_padrao_html text,
  itens jsonb,
  custos_extras jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    b.id, b.numero, b.titulo, b.tipo_servico, b.local_servico, b.data_emissao, b.validade_dias,
    b.prazo_estimado, b.status, b.desconto_percentual, b.desconto_valor, b.forma_pagamento,
    b.entrada, b.parcelas, b.garantia, b.observacoes_cliente, b.proposta_detalhada,
    coalesce(c.nome, b.cliente_nome_avulso, 'Cliente') as cliente_nome,
    coalesce(c.telefone, b.cliente_telefone_avulso) as cliente_telefone,
    coalesce(c.whatsapp, b.cliente_whatsapp_avulso, b.cliente_telefone_avulso) as cliente_whatsapp,
    o.nome_fantasia, o.razao_social, o.telefone, o.whatsapp, o.email, o.instagram, o.logo_url, o.cor_principal, o.cor_secundaria,
    o.experiencia, o.responsavel, o.cidade, o.apresentacao_padrao_html,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', bi.nome, 'descricao', bi.descricao, 'quantidade', bi.quantidade,
        'unidade', bi.unidade, 'valor_unitario', bi.valor_unitario, 'desconto', bi.desconto, 'tipo', bi.tipo
      ) order by bi.ordem)
      from budget_items bi where bi.budget_id = b.id
    ), '[]'::jsonb) as itens,
    coalesce((
      select jsonb_agg(jsonb_build_object('descricao', bec.descricao, 'valor', bec.valor))
      from budget_extra_costs bec where bec.budget_id = b.id
    ), '[]'::jsonb) as custos_extras
  from budgets b
  join organizations o on o.id = b.organization_id
  left join clients c on c.id = b.client_id
  where b.link_publico_token = p_token;
end;
$$;

grant execute on function public_get_budget(uuid) to anon, authenticated;
