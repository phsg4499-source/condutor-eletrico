-- =====================================================================================
-- 0007_public_budget_proposal.sql
-- Corrige o link público do orçamento (WhatsApp/PDF), que apontava para uma rota
-- (/proposta/:id) que nunca chegou a ser implementada no frontend, e que — mesmo se
-- existisse — não conseguiria ler o orçamento, pois a tabela "budgets" só tem policy de
-- SELECT restrita à organização do usuário logado (não há acesso anônimo).
--
-- A coluna budgets.link_publico_token já existe desde a migration 0001 (pensada
-- exatamente para isso), mas nunca foi exposta com segurança. Em vez de criar uma policy
-- de SELECT pública na tabela inteira (o que permitiria a qualquer pessoa anônima listar
-- TODOS os orçamentos de TODOS os clientes), usamos duas funções RPC "security definer":
-- elas rodam com privilégio elevado internamente, mas só devolvem/alteram exatamente o
-- orçamento cujo token foi informado — nunca a tabela inteira.
--
-- Como executar: SQL Editor do Supabase > New query > colar e rodar. Idempotente
-- (create or replace function / grant), pode ser executado mais de uma vez sem problema.
-- =====================================================================================

-- Leitura pública segura de um orçamento por token (para a página /proposta/:token).
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
    b.entrada, b.parcelas, b.garantia, b.observacoes_cliente,
    coalesce(c.nome, b.cliente_nome_avulso, 'Cliente') as cliente_nome,
    coalesce(c.telefone, b.cliente_telefone_avulso) as cliente_telefone,
    coalesce(c.whatsapp, b.cliente_whatsapp_avulso, b.cliente_telefone_avulso) as cliente_whatsapp,
    o.nome_fantasia, o.razao_social, o.telefone, o.whatsapp, o.email, o.instagram, o.logo_url, o.cor_principal, o.cor_secundaria,
    o.experiencia, o.responsavel,
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

-- Resposta pública do cliente (aprovar / recusar / solicitar alteração) via link.
-- Só afeta o orçamento correspondente ao token — nunca outro registro.
create or replace function public_respond_budget(
  p_token uuid,
  p_decisao text,
  p_nome_responsavel text,
  p_documento text default null,
  p_comentario text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget_id uuid;
  v_new_status budget_status;
begin
  if p_decisao not in ('aprovado', 'recusado', 'solicitou_alteracao') then
    raise exception 'Decisão inválida: %', p_decisao;
  end if;

  select id into v_budget_id from budgets where link_publico_token = p_token;
  if v_budget_id is null then
    raise exception 'Orçamento não encontrado ou link inválido/expirado';
  end if;

  insert into budget_approvals (budget_id, nome_responsavel, documento, decisao, comentario)
  values (v_budget_id, p_nome_responsavel, p_documento, p_decisao, p_comentario);

  v_new_status := case p_decisao
    when 'aprovado' then 'aprovado'::budget_status
    when 'recusado' then 'recusado'::budget_status
    else 'revisao_solicitada'::budget_status
  end;

  update budgets set status = v_new_status, updated_at = now() where id = v_budget_id;
  insert into budget_status_history (budget_id, status) values (v_budget_id, v_new_status);
end;
$$;

grant execute on function public_respond_budget(uuid, text, text, text, text) to anon, authenticated;

-- Garante que orçamentos criados antes desta migration também tenham um token
-- (a coluna já tinha default, então isso só preenche linhas antigas que porventura estejam nulas).
update budgets set link_publico_token = gen_random_uuid() where link_publico_token is null;
