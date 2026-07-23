// Camada de integração real com o Supabase.
// Usada apenas quando VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY estão configurados
// (ver src/lib/supabaseClient.ts). Traduz entre as linhas do banco (snake_case, tabelas
// normalizadas) e os tipos usados pelo restante do app (src/types).
import { supabase } from './supabaseClient';
import type {
  Organization, Client, Material, ServiceItem, Budget, ServiceOrder, Payment, QuoteRequest,
  BudgetLineItem, ExtraCost, ClienteEndereco, Orcamentista, Compromisso,
} from '../types';


// Organização "Condutor Elétrico" semeada pelo supabase_condutor_eletrico.sql.
// Usado como organização padrão para o formulário público (sem usuário autenticado).
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

function must() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

// ----- Mapeamento de linhas do banco para os tipos do app -----

function mapClient(row: any): Client {
  return {
    ...row,
    enderecos: (row.client_addresses ?? []).map((a: any): ClienteEndereco => ({
      id: a.id, rotulo: a.rotulo, cep: a.cep ?? '', logradouro: a.logradouro ?? '', numero: a.numero ?? '',
      complemento: a.complemento ?? undefined, bairro: a.bairro ?? '', cidade: a.cidade ?? '', estado: a.estado ?? '',
    })),
    tags: row.tags ?? [],
  };
}

function mapBudget(row: any): Budget {
  return {
    ...row,
    itens: (row.budget_items ?? [])
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((i: any): BudgetLineItem => ({
        id: i.id, tipo: i.tipo, referencia_id: i.referencia_service_id ?? i.referencia_material_id ?? undefined,
        nome: i.nome, descricao: i.descricao ?? undefined, quantidade: Number(i.quantidade), unidade: i.unidade,
        custo_unitario: Number(i.custo_unitario), valor_unitario: Number(i.valor_unitario), desconto: Number(i.desconto),
      })),
    custos_extras: (row.budget_extra_costs ?? []).map((c: any): ExtraCost => ({ id: c.id, descricao: c.descricao, valor: Number(c.valor) })),
    historico_status: (row.budget_status_history ?? [])
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((h: any) => ({ status: h.status, data: h.created_at })),
  };
}

function mapServiceOrder(row: any): ServiceOrder {
  return {
    ...row,
    checklist: (row.service_order_checklist ?? [])
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((c: any) => ({ item: c.item, concluido: c.concluido })),
  };
}

// ----- Carregamento inicial de todos os dados de uma organização -----

export interface RemoteDB {
  organization: Organization;
  clients: Client[];
  materials: Material[];
  services: ServiceItem[];
  budgets: Budget[];
  serviceOrders: ServiceOrder[];
  payments: Payment[];
  quoteRequests: QuoteRequest[];
  orcamentistas: Orcamentista[];
  compromissos: Compromisso[];
}

export async function fetchOrganizationData(organizationId: string): Promise<RemoteDB> {
  const db = must();

  const [orgRes, clientsRes, materialsRes, servicesRes, budgetsRes, ordersRes, paymentsRes, quotesRes, orcamentistasRes, compromissosRes] = await Promise.all([
    db.from('organizations').select('*').eq('id', organizationId).single(),
    db.from('clients').select('*, client_addresses(*)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    db.from('materials').select('*').eq('organization_id', organizationId).order('nome'),
    db.from('services').select('*').eq('organization_id', organizationId).order('nome'),
    db.from('budgets').select('*, budget_items(*), budget_extra_costs(*), budget_status_history(*)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    db.from('service_orders').select('*, service_order_checklist(*)').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    db.from('payments').select('*').eq('organization_id', organizationId).order('vencimento', { ascending: true }),
    db.from('quote_requests').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    db.from('orcamentistas').select('*').eq('organization_id', organizationId).order('nome'),
    db.from('compromissos').select('*').eq('organization_id', organizationId).order('data', { ascending: true }),
  ]);

  if (orgRes.error) throw orgRes.error;

  return {
    organization: orgRes.data as Organization,
    clients: (clientsRes.data ?? []).map(mapClient),
    materials: (materialsRes.data ?? []) as Material[],
    services: (servicesRes.data ?? []) as ServiceItem[],
    budgets: (budgetsRes.data ?? []).map(mapBudget),
    serviceOrders: (ordersRes.data ?? []).map(mapServiceOrder),
    payments: (paymentsRes.data ?? []) as Payment[],
    quoteRequests: (quotesRes.data ?? []) as QuoteRequest[],
    orcamentistas: (orcamentistasRes.data ?? []) as Orcamentista[],
    compromissos: (compromissosRes.data ?? []) as Compromisso[],
  };
}

// ----- Escrita -----

export async function remoteUpdateOrganization(id: string, data: Partial<Organization>) {
  const { error } = await must().from('organizations').update(data).eq('id', id);
  if (error) throw error;
}

export async function remoteInsertClient(client: Client) {
  const db = must();
  const { enderecos, ...clientRow } = client;
  const { error } = await db.from('clients').insert(clientRow);
  if (error) throw error;
  if (enderecos.length) {
    const { error: addrError } = await db.from('client_addresses').insert(
      enderecos.map(e => ({ ...e, client_id: client.id })),
    );
    if (addrError) throw addrError;
  }
}

export async function remoteUpdateClient(id: string, data: Partial<Client>) {
  const { enderecos, ...rest } = data as Client;
  const { error } = await must().from('clients').update(rest).eq('id', id);
  if (error) throw error;
}

export async function remoteInsertMaterial(material: Material) {
  const { error } = await must().from('materials').insert(material);
  if (error) throw error;
}

export async function remoteUpdateMaterial(id: string, data: Partial<Material>) {
  const { error } = await must().from('materials').update(data).eq('id', id);
  if (error) throw error;
}

export async function remoteInsertService(service: ServiceItem) {
  const { error } = await must().from('services').insert(service);
  if (error) throw error;
}

export async function remoteUpdateService(id: string, data: Partial<ServiceItem>) {
  const { error } = await must().from('services').update(data).eq('id', id);
  if (error) throw error;
}

export async function remoteInsertBudget(budget: Budget) {
  const db = must();
  const { itens, custos_extras, historico_status, ...budgetRow } = budget;
  const { error } = await db.from('budgets').insert(budgetRow);
  if (error) throw error;

  if (itens.length) {
    const { error: itemsError } = await db.from('budget_items').insert(
      itens.map((i, idx) => ({
        id: i.id, budget_id: budget.id, tipo: i.tipo,
        referencia_service_id: i.tipo === 'servico' ? i.referencia_id ?? null : null,
        referencia_material_id: i.tipo === 'material' ? i.referencia_id ?? null : null,
        nome: i.nome, descricao: i.descricao ?? null, quantidade: i.quantidade, unidade: i.unidade,
        custo_unitario: i.custo_unitario, valor_unitario: i.valor_unitario, desconto: i.desconto, ordem: idx,
      })),
    );
    if (itemsError) throw itemsError;
  }
  if (custos_extras.length) {
    const { error: extraError } = await db.from('budget_extra_costs').insert(
      custos_extras.map(c => ({ id: c.id, budget_id: budget.id, descricao: c.descricao, valor: c.valor })),
    );
    if (extraError) throw extraError;
  }
  const { error: historyError } = await db.from('budget_status_history').insert(
    historico_status.map(h => ({ budget_id: budget.id, status: h.status })),
  );
  if (historyError) throw historyError;
}

export async function remoteUpdateBudget(id: string, budget: Partial<Budget>) {
  const db = must();
  const { itens, custos_extras, historico_status, ...budgetRow } = budget as Budget;

  if (Object.keys(budgetRow).length) {
    const { error } = await db.from('budgets').update(budgetRow).eq('id', id);
    if (error) throw error;
  }

  if (itens) {
    const { error: delErr } = await db.from('budget_items').delete().eq('budget_id', id);
    if (delErr) throw delErr;
    if (itens.length) {
      const { error: insErr } = await db.from('budget_items').insert(
        itens.map((i, idx) => ({
          id: i.id, budget_id: id, tipo: i.tipo,
          referencia_service_id: i.tipo === 'servico' ? i.referencia_id ?? null : null,
          referencia_material_id: i.tipo === 'material' ? i.referencia_id ?? null : null,
          nome: i.nome, descricao: i.descricao ?? null, quantidade: i.quantidade, unidade: i.unidade,
          custo_unitario: i.custo_unitario, valor_unitario: i.valor_unitario, desconto: i.desconto, ordem: idx,
        })),
      );
      if (insErr) throw insErr;
    }
  }

  if (custos_extras) {
    const { error: delErr } = await db.from('budget_extra_costs').delete().eq('budget_id', id);
    if (delErr) throw delErr;
    if (custos_extras.length) {
      const { error: insErr } = await db.from('budget_extra_costs').insert(
        custos_extras.map(c => ({ id: c.id, budget_id: id, descricao: c.descricao, valor: c.valor })),
      );
      if (insErr) throw insErr;
    }
  }
}

export async function remoteUpdateBudgetStatus(id: string, status: string) {
  const db = must();
  const { error } = await db.from('budgets').update({ status }).eq('id', id);
  if (error) throw error;
  const { error: histError } = await db.from('budget_status_history').insert({ budget_id: id, status });
  if (histError) throw histError;
}

export async function remoteDeleteBudget(id: string) {
  // budget_items, budget_extra_costs e budget_status_history têm "on delete cascade"
  // referenciando budgets(id), então excluem-se sozinhos junto com o orçamento.
  const { error } = await must().from('budgets').delete().eq('id', id);
  if (error) throw error;
}

export async function remoteInsertServiceOrder(order: ServiceOrder) {
  const db = must();
  const { checklist, ...orderRow } = order;
  const { error } = await db.from('service_orders').insert(orderRow);
  if (error) throw error;
  if (checklist.length) {
    const { error: checklistError } = await db.from('service_order_checklist').insert(
      checklist.map((c, idx) => ({ service_order_id: order.id, item: c.item, concluido: c.concluido, ordem: idx })),
    );
    if (checklistError) throw checklistError;
  }
}

export async function remoteSetServiceOrderStatus(id: string, status: string) {
  const { error } = await must().from('service_orders').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function remoteToggleChecklistItem(orderId: string, index: number, concluido: boolean) {
  const db = must();
  const { data, error } = await db.from('service_order_checklist').select('id').eq('service_order_id', orderId).order('ordem');
  if (error) throw error;
  const row = data?.[index];
  if (!row) return;
  const { error: updError } = await db.from('service_order_checklist').update({ concluido }).eq('id', row.id);
  if (updError) throw updError;
}

export async function remoteInsertQuoteRequest(request: QuoteRequest & { organization_id: string }) {
  const { error } = await must().from('quote_requests').insert(request);
  if (error) throw error;
}

export async function remoteInsertOrcamentista(orcamentista: Orcamentista) {
  const { error } = await must().from('orcamentistas').insert(orcamentista);
  if (error) throw error;
}

export async function remoteUpdateOrcamentista(id: string, data: Partial<Orcamentista>) {
  const { error } = await must().from('orcamentistas').update(data).eq('id', id);
  if (error) throw error;
}

export async function remoteInsertCompromisso(compromisso: Compromisso) {
  const { error } = await must().from('compromissos').insert(compromisso);
  if (error) throw error;
}

export async function remoteUpdateCompromisso(id: string, data: Partial<Compromisso>) {
  const { error } = await must().from('compromissos').update(data).eq('id', id);
  if (error) throw error;
}

export async function remoteDeleteCompromisso(id: string) {
  const { error } = await must().from('compromissos').delete().eq('id', id);
  if (error) throw error;
}

export async function remoteInsertPayment(payment: Payment) {
  const { error } = await must().from('payments').insert(payment);
  if (error) throw error;
}

export async function remoteUpdatePayment(id: string, data: Partial<Payment>) {
  const { error } = await must().from('payments').update(data).eq('id', id);
  if (error) throw error;
}

export async function remoteDeletePayment(id: string) {
  const { error } = await must().from('payments').delete().eq('id', id);
  if (error) throw error;
}
