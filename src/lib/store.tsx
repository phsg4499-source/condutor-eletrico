import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type {
  Organization, Client, Material, ServiceItem, Budget, ServiceOrder, Payment, QuoteRequest, BudgetStatus, ServiceOrderStatus, Orcamentista,
} from '../types';
import {
  demoOrganization, demoClients, demoMaterials, demoServices, demoBudgets, demoServiceOrders, demoPayments, demoOrcamentistas,
} from '../data/demoData';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  DEFAULT_ORG_ID, fetchOrganizationData, remoteUpdateOrganization, remoteInsertClient, remoteUpdateClient,
  remoteInsertMaterial, remoteUpdateMaterial, remoteInsertService, remoteUpdateService, remoteInsertBudget,
  remoteUpdateBudget, remoteUpdateBudgetStatus, remoteInsertServiceOrder, remoteSetServiceOrderStatus, remoteToggleChecklistItem,
  remoteInsertQuoteRequest, remoteInsertOrcamentista, remoteUpdateOrcamentista,
} from './supabaseApi';
import { todayISO } from './format';

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
  };
}

function emptyDB(): DB {
  return {
    organization: demoOrganization,
    clients: [], materials: [], services: [], budgets: [], serviceOrders: [], payments: [], quoteRequests: [], orcamentistas: [],
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
  setBudgetStatus: (id: string, status: BudgetStatus) => void;
  convertBudgetToServiceOrder: (budgetId: string) => ServiceOrder | null;
  setServiceOrderStatus: (id: string, status: ServiceOrderStatus) => void;
  toggleChecklistItem: (orderId: string, index: number) => void;
  addQuoteRequest: (data: Omit<QuoteRequest, 'id' | 'created_at'>) => QuoteRequest;
  addOrcamentista: (data: Omit<Orcamentista, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Orcamentista;
  updateOrcamentista: (id: string, data: Partial<Orcamentista>) => void;
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
    if (isSupabaseConfigured) remoteUpdateOrganization(orgId, data).catch(err => console.error('Erro ao salvar configurações', err));
  }, [orgId]);

  const addClient: StoreContextValue['addClient'] = useCallback((data) => {
    const client: Client = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, clients: [client, ...prev.clients] }));
    if (isSupabaseConfigured) remoteInsertClient(client).catch(err => console.error('Erro ao salvar cliente', err));
    return client;
  }, [orgId]);

  const updateClient = useCallback((id: string, data: Partial<Client>) => {
    setDb(prev => ({ ...prev, clients: prev.clients.map(c => c.id === id ? { ...c, ...data, updated_at: todayISO() } : c) }));
    if (isSupabaseConfigured) remoteUpdateClient(id, data).catch(err => console.error('Erro ao atualizar cliente', err));
  }, []);

  const addMaterial: StoreContextValue['addMaterial'] = useCallback((data) => {
    const material: Material = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, materials: [material, ...prev.materials] }));
    if (isSupabaseConfigured) remoteInsertMaterial(material).catch(err => console.error('Erro ao salvar material', err));
    return material;
  }, [orgId]);

  const updateMaterial = useCallback((id: string, data: Partial<Material>) => {
    setDb(prev => ({ ...prev, materials: prev.materials.map(m => m.id === id ? { ...m, ...data, updated_at: todayISO() } : m) }));
    if (isSupabaseConfigured) remoteUpdateMaterial(id, data).catch(err => console.error('Erro ao atualizar material', err));
  }, []);

  const addService: StoreContextValue['addService'] = useCallback((data) => {
    const service: ServiceItem = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, services: [service, ...prev.services] }));
    if (isSupabaseConfigured) remoteInsertService(service).catch(err => console.error('Erro ao salvar serviço', err));
    return service;
  }, [orgId]);

  const updateService = useCallback((id: string, data: Partial<ServiceItem>) => {
    setDb(prev => ({ ...prev, services: prev.services.map(s => s.id === id ? { ...s, ...data, updated_at: todayISO() } : s) }));
    if (isSupabaseConfigured) remoteUpdateService(id, data).catch(err => console.error('Erro ao atualizar serviço', err));
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
      created_at: todayISO(), updated_at: todayISO(), ...data,
    };
    setDb(prev => ({ ...prev, budgets: [budget, ...prev.budgets] }));
    if (isSupabaseConfigured) remoteInsertBudget(budget).catch(err => console.error('Erro ao salvar orçamento', err));
    return budget;
  }, [nextBudgetNumber, orgId]);

  const updateBudget = useCallback((id: string, data: Partial<Budget>) => {
    setDb(prev => ({ ...prev, budgets: prev.budgets.map(b => b.id === id ? { ...b, ...data, updated_at: todayISO() } : b) }));
    if (isSupabaseConfigured) remoteUpdateBudget(id, data).catch(err => console.error('Erro ao atualizar orçamento', err));
  }, []);

  const setBudgetStatus = useCallback((id: string, status: BudgetStatus) => {
    setDb(prev => ({
      ...prev,
      budgets: prev.budgets.map(b => b.id === id
        ? { ...b, status, historico_status: [...b.historico_status, { status, data: todayISO() }], updated_at: todayISO() }
        : b),
    }));
    if (isSupabaseConfigured) remoteUpdateBudgetStatus(id, status).catch(err => console.error('Erro ao atualizar status do orçamento', err));
  }, []);

  const convertBudgetToServiceOrder = useCallback((budgetId: string): ServiceOrder | null => {
    const budget = db.budgets.find(b => b.id === budgetId);
    if (!budget) return null;
    const numero = `OS-${budget.numero}`;
    const order: ServiceOrder = {
      id: newId(), organization_id: orgId, numero, budget_id: budget.id, client_id: budget.client_id,
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
    setDb(prev => ({
      ...prev,
      serviceOrders: [order, ...prev.serviceOrders],
      budgets: prev.budgets.map(b => b.id === budgetId
        ? { ...b, status: 'convertido_em_os', historico_status: [...b.historico_status, { status: 'convertido_em_os', data: todayISO() }] }
        : b),
    }));
    if (isSupabaseConfigured) {
      remoteInsertServiceOrder(order).catch(err => console.error('Erro ao criar ordem de serviço', err));
      remoteUpdateBudgetStatus(budgetId, 'convertido_em_os').catch(err => console.error('Erro ao atualizar status do orçamento', err));
    }
    return order;
  }, [db.budgets, orgId]);

  const setServiceOrderStatus = useCallback((id: string, status: ServiceOrderStatus) => {
    setDb(prev => ({ ...prev, serviceOrders: prev.serviceOrders.map(o => o.id === id ? { ...o, status, updated_at: todayISO() } : o) }));
    if (isSupabaseConfigured) remoteSetServiceOrderStatus(id, status).catch(err => console.error('Erro ao atualizar status da OS', err));
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
    if (isSupabaseConfigured) remoteToggleChecklistItem(orderId, index, newValue).catch(err => console.error('Erro ao atualizar checklist', err));
  }, []);

  const addQuoteRequest: StoreContextValue['addQuoteRequest'] = useCallback((data) => {
    const request: QuoteRequest = { ...data, id: newId(), created_at: todayISO() };
    setDb(prev => ({ ...prev, quoteRequests: [request, ...prev.quoteRequests] }));
    if (isSupabaseConfigured) {
      remoteInsertQuoteRequest({ ...request, organization_id: DEFAULT_ORG_ID }).catch(err => console.error('Erro ao enviar solicitação', err));
    }
    return request;
  }, []);

  const addOrcamentista: StoreContextValue['addOrcamentista'] = useCallback((data) => {
    const orcamentista: Orcamentista = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, orcamentistas: [orcamentista, ...prev.orcamentistas] }));
    if (isSupabaseConfigured) remoteInsertOrcamentista(orcamentista).catch(err => console.error('Erro ao salvar orçamentista', err));
    return orcamentista;
  }, [orgId]);

  const updateOrcamentista = useCallback((id: string, data: Partial<Orcamentista>) => {
    setDb(prev => ({ ...prev, orcamentistas: prev.orcamentistas.map(o => o.id === id ? { ...o, ...data, updated_at: todayISO() } : o) }));
    if (isSupabaseConfigured) remoteUpdateOrcamentista(id, data).catch(err => console.error('Erro ao atualizar orçamentista', err));
  }, []);

  const value = useMemo<StoreContextValue>(() => ({
    isDemoMode: !isSupabaseConfigured,
    authLoading,
    db, user, login, logout, updateOrganization,
    addClient, updateClient, addMaterial, updateMaterial, addService, updateService,
    addBudget, updateBudget, setBudgetStatus, convertBudgetToServiceOrder, setServiceOrderStatus, toggleChecklistItem, addQuoteRequest, addOrcamentista, updateOrcamentista, nextBudgetNumber,
  }), [authLoading, db, user, login, logout, updateOrganization, addClient, updateClient, addMaterial, updateMaterial,
      addService, updateService, addBudget, updateBudget, setBudgetStatus, convertBudgetToServiceOrder,
      setServiceOrderStatus, toggleChecklistItem, addQuoteRequest, addOrcamentista, updateOrcamentista, nextBudgetNumber]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore precisa estar dentro de <StoreProvider>');
  return ctx;
}

export const DEMO_CREDENTIALS = { email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD };
