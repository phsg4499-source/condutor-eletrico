import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type {
  Organization, Client, Material, ServiceItem, Budget, ServiceOrder, Payment, QuoteRequest, BudgetStatus, ServiceOrderStatus, Orcamentista, Compromisso,
} from '../types';
import {
  demoOrganization, demoClients, demoMaterials, demoServices, demoBudgets, demoServiceOrders, demoPayments, demoOrcamentistas, demoCompromissos,
} from '../data/demoData';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  DEFAULT_ORG_ID, fetchOrganizationData, remoteUpdateOrganization, remoteInsertClient, remoteUpdateClient,
  remoteInsertMaterial, remoteUpdateMaterial, remoteInsertService, remoteUpdateService, remoteInsertBudget,
  remoteUpdateBudget, remoteDeleteBudget, remoteUpdateBudgetStatus, remoteInsertServiceOrder, remoteSetServiceOrderStatus, remoteToggleChecklistItem,
  remoteInsertQuoteRequest, remoteInsertOrcamentista, remoteUpdateOrcamentista,
  remoteInsertCompromisso, remoteUpdateCompromisso, remoteDeleteCompromisso,
  remoteInsertPayment, remoteUpdatePayment, remoteDeletePayment,
} from './supabaseApi';
import { todayISO } from './format';
import { useToast } from './toast';
import { calculateBudget } from './calculations';

// Camada de dados do sistema.
// MODO DEMONSTRAÇÃO (padrão, sem Supabase configurado): dados vivem em memória e são
// persistidos em localStorage para sobreviver a atualizações de página.
// MODO SUPABASE (quando VITE_SUPABASE_URL/ANON_KEY definidos): login e todos os cadastros são
// gravados de verdade no seu projeto Supabase (ver src/lib/supabaseApi.ts). A atualização de
// cada tela é otimista (aparece na hora) e a gravação remota acontece em segundo plano; erros de
// gravação aparecem no console do navegador.
// Observação: a página institucional pública (landing) e o formulário de solicitação de orçamento
// sempre usam os dados de marca padrão da Condutor Elétrico, independentemente do modo, para evitar
// exigir uma política de leitura pública da tabela "organizations".

const STORAGE_KEY = 'condutor-eletrico-demo-db-v1';

interface DB {
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

function seedDB(): DB {
  return {
    organization: demoOrganization,
    clients: demoClients,
    materials: demoMaterials,
    services: demoServices,
    budgets: demoBudgets,
    serviceOrders: demoServiceOrders,
    payments: demoPayments,
    quoteRequests: [],
    orcamentistas: demoOrcamentistas,
    compromissos: demoCompromissos,
  };
}

function emptyDB(): DB {
  return {
    organization: demoOrganization,
    clients: [], materials: [], services: [], budgets: [], serviceOrders: [], payments: [], quoteRequests: [], orcamentistas: [], compromissos: [],
  };
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    // ignora e recria
  }
  const fresh = seedDB();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveDB(db: DB) {
  if (!isSupabaseConfigured) localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function newId(): string {
  return crypto.randomUUID();
}

interface AuthUser {
  email: string;
  nome: string;
  cargo: string;
  organizationId: string;
}

interface StoreContextValue {
  isDemoMode: boolean;
  authLoading: boolean;
  db: DB;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateOrganization: (data: Partial<Organization>) => void;
  addClient: (data: Omit<Client, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Client;
  updateClient: (id: string, data: Partial<Client>) => void;
  addMaterial: (data: Omit<Material, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Material;
  updateMaterial: (id: string, data: Partial<Material>) => void;
  addService: (data: Omit<ServiceItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => ServiceItem;
  updateService: (id: string, data: Partial<ServiceItem>) => void;
  addBudget: (data: Partial<Budget>) => Budget;
  updateBudget: (id: string, data: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  setBudgetStatus: (id: string, status: BudgetStatus) => void;
  convertBudgetToServiceOrder: (budgetId: string) => ServiceOrder | null;
  setServiceOrderStatus: (id: string, status: ServiceOrderStatus) => void;
  toggleChecklistItem: (orderId: string, index: number) => void;
  addQuoteRequest: (data: Omit<QuoteRequest, 'id' | 'created_at'>) => QuoteRequest;
  addOrcamentista: (data: Omit<Orcamentista, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Orcamentista;
  updateOrcamentista: (id: string, data: Partial<Orcamentista>) => void;
  addCompromisso: (data: Omit<Compromisso, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Compromisso;
  updateCompromisso: (id: string, data: Partial<Compromisso>) => void;
  deleteCompromisso: (id: string) => void;
  addPayment: (data: Omit<Payment, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Payment;
  updatePayment: (id: string, data: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  nextBudgetNumber: () => string;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const DEMO_ADMIN_EMAIL = 'admin@condutoreletrico.com.br';
const DEMO_ADMIN_PASSWORD = 'condutor123';
const SESSION_KEY = 'condutor-eletrico-session';

function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha inválidos.';
  if (/email not confirmed/i.test(message)) return 'Confirme o e-mail do usuário no painel do Supabase (Authentication > Users) antes de entrar.';
  return message;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  // Mostra um aviso visível sempre que uma gravação no Supabase falhar (além de logar no console).
  // Sem isso, erros de sincronização passavam despercebidos: a tela parecia salvar (atualização
  // otimista local), mas o dado real não ia para o banco — e sumia/zerava ao recarregar a página.
  const notifySyncError = useCallback((label: string, err: unknown) => {
    console.error(label, err);
    toast.show(`${label}: ${err instanceof Error ? err.message : 'erro desconhecido'}. A alteração pode não ter sido salva — verifique sua conexão e tente novamente.`, 'warning');
  }, [toast]);

  const [db, setDb] = useState<DB>(() => (isSupabaseConfigured ? emptyDB() : loadDB()));
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (isSupabaseConfigured) return null; // restaurado de forma assíncrona via getSession()
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => { saveDB(db); }, [db]);

  // Carrega o perfil + todos os dados da organização a partir de uma sessão Supabase autenticada.
  const loadFromSession = useCallback(async (userId: string, email: string): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) return { ok: false, error: 'Supabase não configurado.' };
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileError || !profile) {
      return { ok: false, error: 'Perfil não encontrado. Verifique se o cadastro do usuário foi concluído.' };
    }
    if (!profile.organization_id) {
      return { ok: false, error: 'Este usuário ainda não está vinculado a uma organização. Rode o UPDATE profiles descrito no README (vincule organization_id e cargo = administrador).' };
    }
    try {
      const remote = await fetchOrganizationData(profile.organization_id);
      setDb(remote);
      setUser({ email, nome: profile.nome || email, cargo: profile.cargo, organizationId: profile.organization_id });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Erro ao carregar dados da organização.' };
    }
  }, []);

  // Restaura sessão existente ao carregar a página (modo Supabase).
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        await loadFromSession(data.session.user.id, data.session.user.email ?? '');
      }
      if (active) setAuthLoading(false);
    });
    return () => { active = false; };
  }, [loadFromSession]);

  const login = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return { ok: false, error: authErrorMessage(error?.message ?? 'Não foi possível entrar.') };
      return loadFromSession(data.user.id, data.user.email ?? email);
    }
    if (email.trim().toLowerCase() === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD) {
      const authUser: AuthUser = { email, nome: 'Felipe Ribeiro', cargo: 'administrador', organizationId: 'org-condutor-eletrico' };
      setUser(authUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
      return { ok: true };
    }
    return { ok: false, error: 'E-mail ou senha inválidos. Use as credenciais de demonstração exibidas na tela.' };
  }, [loadFromSession]);

  const logout = useCallback(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
      setDb(emptyDB());
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
    setUser(null);
  }, []);

  const orgId = user?.organizationId ?? db.organization.id;

  const updateOrganization = useCallback((data: Partial<Organization>) => {
    setDb(prev => ({ ...prev, organization: { ...prev.organization, ...data, updated_at: todayISO() } }));
    if (isSupabaseConfigured) remoteUpdateOrganization(orgId, data).catch(err => notifySyncError('Erro ao salvar configurações', err));
  }, [orgId]);

  const addClient: StoreContextValue['addClient'] = useCallback((data) => {
    const client: Client = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, clients: [client, ...prev.clients] }));
    if (isSupabaseConfigured) remoteInsertClient(client).catch(err => notifySyncError('Erro ao salvar cliente', err));
    return client;
  }, [orgId]);

  const updateClient = useCallback((id: string, data: Partial<Client>) => {
    setDb(prev => ({ ...prev, clients: prev.clients.map(c => c.id === id ? { ...c, ...data, updated_at: todayISO() } : c) }));
    if (isSupabaseConfigured) remoteUpdateClient(id, data).catch(err => notifySyncError('Erro ao atualizar cliente', err));
  }, []);

  const addMaterial: StoreContextValue['addMaterial'] = useCallback((data) => {
    const material: Material = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, materials: [material, ...prev.materials] }));
    if (isSupabaseConfigured) remoteInsertMaterial(material).catch(err => notifySyncError('Erro ao salvar material', err));
    return material;
  }, [orgId]);

  const updateMaterial = useCallback((id: string, data: Partial<Material>) => {
    setDb(prev => ({ ...prev, materials: prev.materials.map(m => m.id === id ? { ...m, ...data, updated_at: todayISO() } : m) }));
    if (isSupabaseConfigured) remoteUpdateMaterial(id, data).catch(err => notifySyncError('Erro ao atualizar material', err));
  }, []);

  const addService: StoreContextValue['addService'] = useCallback((data) => {
    const service: ServiceItem = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, services: [service, ...prev.services] }));
    if (isSupabaseConfigured) remoteInsertService(service).catch(err => notifySyncError('Erro ao salvar serviço', err));
    return service;
  }, [orgId]);

  const updateService = useCallback((id: string, data: Partial<ServiceItem>) => {
    setDb(prev => ({ ...prev, services: prev.services.map(s => s.id === id ? { ...s, ...data, updated_at: todayISO() } : s) }));
    if (isSupabaseConfigured) remoteUpdateService(id, data).catch(err => notifySyncError('Erro ao atualizar serviço', err));
  }, []);

  const nextBudgetNumber = useCallback(() => {
    const year = new Date().getFullYear();
    const count = db.budgets.filter(b => b.numero.startsWith(String(year))).length + 1;
    return `${year}-${String(count).padStart(4, '0')}`;
  }, [db.budgets]);

  const addBudget: StoreContextValue['addBudget'] = useCallback((data) => {
    const numero = data.numero || nextBudgetNumber();
    const budget: Budget = {
      id: newId(), organization_id: orgId, numero, titulo: '', tipo_servico: 'Instalação',
      local_servico: '', data_emissao: todayISO(), validade_dias: 10, responsavel: 'Felipe Ribeiro',
      status: 'rascunho', itens: [], custos_extras: [], desconto_percentual: 0, desconto_valor: 0,
      forma_pagamento: 'pix', entrada: 0, parcelas: 1, garantia: '90 dias',
      historico_status: [{ status: 'rascunho', data: todayISO() }],
      link_publico_token: newId(),
      created_at: todayISO(), updated_at: todayISO(), ...data,
    };
    setDb(prev => ({ ...prev, budgets: [budget, ...prev.budgets] }));
    if (isSupabaseConfigured) remoteInsertBudget(budget).catch(err => notifySyncError('Erro ao salvar orçamento', err));
    return budget;
  }, [nextBudgetNumber, orgId]);

  const updateBudget = useCallback((id: string, data: Partial<Budget>) => {
    setDb(prev => ({ ...prev, budgets: prev.budgets.map(b => b.id === id ? { ...b, ...data, updated_at: todayISO() } : b) }));
    if (isSupabaseConfigured) remoteUpdateBudget(id, data).catch(err => notifySyncError('Erro ao atualizar orçamento', err));
  }, []);

  const deleteBudget = useCallback((id: string) => {
    setDb(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) }));
    if (isSupabaseConfigured) remoteDeleteBudget(id).catch(err => notifySyncError('Erro ao excluir orçamento', err));
  }, []);


  function buildServiceOrderFromBudget(budget: Budget): ServiceOrder {
    return {
      id: newId(), organization_id: orgId, numero: `OS-${budget.numero}`, budget_id: budget.id, client_id: budget.client_id,
      cliente_nome_avulso: budget.cliente_nome_avulso, cliente_telefone_avulso: budget.cliente_telefone_avulso,
      cliente_whatsapp_avulso: budget.cliente_whatsapp_avulso,
      responsavel_tecnico: budget.responsavel, status: 'aguardando_agendamento',
      checklist: [
        { item: 'Energia desligada antes da intervenção', concluido: false },
        { item: 'Uso de equipamentos de proteção', concluido: false },
        { item: 'Circuito identificado', concluido: false },
        { item: 'Aterramento verificado', concluido: false },
        { item: 'Testes realizados', concluido: false },
        { item: 'Limpeza do local', concluido: false },
      ],
      created_at: todayISO(), updated_at: todayISO(),
    };
  }

  // Fluxo manual (botão "Converter em ordem de serviço" em BudgetView): idempotente — se este
  // orçamento já possui uma OS (ex.: criada automaticamente ao aprovar), reaproveita-a em vez de
  // duplicar, e só então marca o orçamento como "convertido_em_os".
  const convertBudgetToServiceOrder = useCallback((budgetId: string): ServiceOrder | null => {
    const budget = db.budgets.find(b => b.id === budgetId);
    if (!budget) return null;
    const existente = db.serviceOrders.find(o => o.budget_id === budgetId);
    const order = existente ?? buildServiceOrderFromBudget(budget);
    setDb(prev => ({
      ...prev,
      serviceOrders: existente ? prev.serviceOrders : [order, ...prev.serviceOrders],
      budgets: prev.budgets.map(b => b.id === budgetId
        ? { ...b, status: 'convertido_em_os', historico_status: [...b.historico_status, { status: 'convertido_em_os', data: todayISO() }] }
        : b),
    }));
    if (isSupabaseConfigured) {
      if (!existente) remoteInsertServiceOrder(order).catch(err => notifySyncError('Erro ao criar ordem de serviço', err));
      remoteUpdateBudgetStatus(budgetId, 'convertido_em_os').catch(err => notifySyncError('Erro ao atualizar status do orçamento', err));
    }
    return order;
  }, [db.budgets, db.serviceOrders, orgId]);

  // Geração automática de OS ao aprovar (total ou parcialmente) um orçamento — chamada de dentro
  // de setBudgetStatus. Diferente do fluxo manual acima, NÃO altera o status do orçamento (ele
  // continua "aprovado"/"aprovado_parcialmente"); apenas garante que a OS exista, sem duplicar.
  const ensureServiceOrderForBudget = useCallback((budget: Budget) => {
    const jaExiste = db.serviceOrders.some(o => o.budget_id === budget.id);
    if (jaExiste) return;
    const order = buildServiceOrderFromBudget(budget);
    setDb(prev => (prev.serviceOrders.some(o => o.budget_id === budget.id)
      ? prev
      : { ...prev, serviceOrders: [order, ...prev.serviceOrders] }));
    if (isSupabaseConfigured) remoteInsertServiceOrder(order).catch(err => notifySyncError('Erro ao criar ordem de serviço automaticamente', err));
  }, [db.serviceOrders, orgId]);

  const setServiceOrderStatus = useCallback((id: string, status: ServiceOrderStatus) => {
    setDb(prev => ({ ...prev, serviceOrders: prev.serviceOrders.map(o => o.id === id ? { ...o, status, updated_at: todayISO() } : o) }));
    if (isSupabaseConfigured) remoteSetServiceOrderStatus(id, status).catch(err => notifySyncError('Erro ao atualizar status da OS', err));
  }, []);

  const toggleChecklistItem = useCallback((orderId: string, index: number) => {
    let newValue = false;
    setDb(prev => ({
      ...prev,
      serviceOrders: prev.serviceOrders.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          checklist: o.checklist.map((item, i) => {
            if (i !== index) return item;
            newValue = !item.concluido;
            return { ...item, concluido: newValue };
          }),
          updated_at: todayISO(),
        };
      }),
    }));
    if (isSupabaseConfigured) remoteToggleChecklistItem(orderId, index, newValue).catch(err => notifySyncError('Erro ao atualizar checklist', err));
  }, []);

  const addQuoteRequest: StoreContextValue['addQuoteRequest'] = useCallback((data) => {
    const request: QuoteRequest = { ...data, id: newId(), created_at: todayISO() };
    setDb(prev => ({ ...prev, quoteRequests: [request, ...prev.quoteRequests] }));
    if (isSupabaseConfigured) {
      remoteInsertQuoteRequest({ ...request, organization_id: DEFAULT_ORG_ID }).catch(err => notifySyncError('Erro ao enviar solicitação', err));
    }
    return request;
  }, []);

  const addOrcamentista: StoreContextValue['addOrcamentista'] = useCallback((data) => {
    const orcamentista: Orcamentista = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, orcamentistas: [orcamentista, ...prev.orcamentistas] }));
    if (isSupabaseConfigured) remoteInsertOrcamentista(orcamentista).catch(err => notifySyncError('Erro ao salvar orçamentista', err));
    return orcamentista;
  }, [orgId]);

  const updateOrcamentista = useCallback((id: string, data: Partial<Orcamentista>) => {
    setDb(prev => ({ ...prev, orcamentistas: prev.orcamentistas.map(o => o.id === id ? { ...o, ...data, updated_at: todayISO() } : o) }));
    if (isSupabaseConfigured) remoteUpdateOrcamentista(id, data).catch(err => notifySyncError('Erro ao atualizar orçamentista', err));
  }, []);

  const addCompromisso: StoreContextValue['addCompromisso'] = useCallback((data) => {
    const compromisso: Compromisso = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, compromissos: [...prev.compromissos, compromisso].sort((a, b) => a.data.localeCompare(b.data)) }));
    if (isSupabaseConfigured) remoteInsertCompromisso(compromisso).catch(err => notifySyncError('Erro ao salvar compromisso', err));
    return compromisso;
  }, [orgId]);

  const updateCompromisso = useCallback((id: string, data: Partial<Compromisso>) => {
    setDb(prev => ({
      ...prev,
      compromissos: prev.compromissos.map(c => c.id === id ? { ...c, ...data, updated_at: todayISO() } : c)
        .sort((a, b) => a.data.localeCompare(b.data)),
    }));
    if (isSupabaseConfigured) remoteUpdateCompromisso(id, data).catch(err => notifySyncError('Erro ao atualizar compromisso', err));
  }, []);

  const deleteCompromisso = useCallback((id: string) => {
    setDb(prev => ({ ...prev, compromissos: prev.compromissos.filter(c => c.id !== id) }));
    if (isSupabaseConfigured) remoteDeleteCompromisso(id).catch(err => notifySyncError('Erro ao excluir compromisso', err));
  }, []);

  const addPayment: StoreContextValue['addPayment'] = useCallback((data) => {
    const payment: Payment = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, payments: [payment, ...prev.payments] }));
    if (isSupabaseConfigured) remoteInsertPayment(payment).catch(err => notifySyncError('Erro ao salvar pagamento', err));
    return payment;
  }, [orgId]);

  const updatePayment = useCallback((id: string, data: Partial<Payment>) => {
    setDb(prev => ({ ...prev, payments: prev.payments.map(p => p.id === id ? { ...p, ...data, updated_at: todayISO() } : p) }));
    if (isSupabaseConfigured) remoteUpdatePayment(id, data).catch(err => notifySyncError('Erro ao atualizar pagamento', err));
  }, []);

  const deletePayment = useCallback((id: string) => {
    setDb(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
    if (isSupabaseConfigured) remoteDeletePayment(id).catch(err => notifySyncError('Erro ao excluir pagamento', err));
  }, []);

  const setBudgetStatus = useCallback((id: string, status: BudgetStatus) => {
    setDb(prev => ({
      ...prev,
      budgets: prev.budgets.map(b => b.id === id
        ? { ...b, status, historico_status: [...b.historico_status, { status, data: todayISO() }], updated_at: todayISO() }
        : b),
    }));
    if (isSupabaseConfigured) remoteUpdateBudgetStatus(id, status).catch(err => notifySyncError('Erro ao atualizar status do orçamento', err));

    // Ao aprovar (total ou parcialmente) um orçamento que ainda não tem nenhum pagamento
    // registrado, já lançamos automaticamente o valor total como "a receber" — assim ele
    // aparece de imediato no módulo Pagamentos, sem precisar de ação manual.
    const isAprovando = status === 'aprovado' || status === 'aprovado_parcialmente';
    if (isAprovando) {
      const budget = db.budgets.find(b => b.id === id);
      const jaTemPagamento = db.payments.some(p => p.budget_id === id);
      if (budget && !jaTemPagamento) {
        const totals = calculateBudget(budget);
        if (totals.totalVenda > 0) {
          addPayment({
            client_id: budget.client_id ?? null,
            budget_id: budget.id,
            descricao: `Saldo a receber — orçamento ${budget.numero}`,
            valor: totals.totalVenda,
            status: 'pendente',
          });
        }
      }
      // Todo orçamento aprovado deve gerar uma ordem de serviço — automaticamente e sem duplicar.
      if (budget) ensureServiceOrderForBudget(budget);
    }
  }, [db.budgets, db.payments, addPayment, ensureServiceOrderForBudget]);

  const value = useMemo<StoreContextValue>(() => ({
    isDemoMode: !isSupabaseConfigured,
    authLoading,
    db, user, login, logout, updateOrganization,
    addClient, updateClient, addMaterial, updateMaterial, addService, updateService,
    addBudget, updateBudget, deleteBudget, setBudgetStatus, convertBudgetToServiceOrder, setServiceOrderStatus, toggleChecklistItem, addQuoteRequest, addOrcamentista, updateOrcamentista,
    addCompromisso, updateCompromisso, deleteCompromisso, addPayment, updatePayment, deletePayment, nextBudgetNumber,
  }), [authLoading, db, user, login, logout, updateOrganization, addClient, updateClient, addMaterial, updateMaterial,
      addService, updateService, addBudget, updateBudget, deleteBudget, setBudgetStatus, convertBudgetToServiceOrder,
      setServiceOrderStatus, toggleChecklistItem, addQuoteRequest, addOrcamentista, updateOrcamentista,
      addCompromisso, updateCompromisso, deleteCompromisso, addPayment, updatePayment, deletePayment, nextBudgetNumber]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore precisa estar dentro de <StoreProvider>');
  return ctx;
}

export const DEMO_CREDENTIALS = { email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD };
