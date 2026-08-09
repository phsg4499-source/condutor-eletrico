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
  remoteInsertMaterial, remoteUpdateMaterial, remoteInsertService, remoteUpdateService, remoteInsertBudget, remoteMaxBudgetNumero,
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

// Traduz um erro técnico do Supabase (PostgrestError, erro de rede, etc.) em uma mensagem que o
// usuário consegue entender, sem nunca dizer "erro desconhecido" quando há informação disponível.
// O detalhe técnico completo (mensagem, código, details, hint) é sempre registrado no console.
function describeSupabaseError(err: unknown, contexto: string, acao: 'salvar' | 'atualizar' | 'excluir'): string {
  const anyErr = err as { message?: string; code?: string; details?: string; hint?: string } | null;
  const message = typeof anyErr?.message === 'string' ? anyErr.message : '';
  const code = anyErr?.code;
  console.error(`[${contexto}] Falha ao ${acao}`, { message, code, details: anyErr?.details, hint: anyErr?.hint, err });

  if (/jwt|token|session/i.test(message) || code === 'PGRST301') {
    return 'Sua sessão expirou. Entre novamente para salvar as alterações.';
  }
  if (code === '42501' || /row-level security|permission denied|policy/i.test(message)) {
    return `Você não possui permissão para ${acao} este registro.`;
  }
  if (code === '23505' || /duplicate key value violates unique constraint/i.test(message)) {
    return 'Esse número já está em uso. Tente salvar novamente — o sistema vai gerar um novo número automaticamente.';
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return 'Ocorreu uma falha de conexão. Nenhuma alteração foi confirmada.';
  }
  if (message) {
    return `Não foi possível ${acao} ${contexto}: ${message}`;
  }
  return `Não foi possível ${acao} ${contexto}. Nenhuma alteração foi confirmada.`;
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
  // As funções abaixo que mexem com dados críticos (cliente, orçamento, pagamento, compromisso,
  // ordem de serviço) retornam o resultado REAL da gravação no Supabase (ok/erro) em vez de
  // assumir sucesso apenas por terem sido chamadas. Quem chama deve aguardar (await) e só mostrar
  // mensagem de sucesso quando ok === true — nunca sucesso e erro ao mesmo tempo, e nunca "some"
  // depois de atualizar a página, porque a tela só é atualizada de verdade após a confirmação.
  addClient: (data: Omit<Client, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Promise<{ client: Client; ok: boolean; error?: string }>;
  updateClient: (id: string, data: Partial<Client>) => Promise<{ ok: boolean; error?: string }>;
  addMaterial: (data: Omit<Material, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Material;
  updateMaterial: (id: string, data: Partial<Material>) => void;
  addService: (data: Omit<ServiceItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => ServiceItem;
  updateService: (id: string, data: Partial<ServiceItem>) => void;
  addBudget: (data: Partial<Budget>) => Promise<{ budget: Budget; ok: boolean; error?: string }>;
  updateBudget: (id: string, data: Partial<Budget>) => Promise<{ ok: boolean; error?: string }>;
  deleteBudget: (id: string) => Promise<{ ok: boolean; error?: string }>;
  // Retorna ok/erro da troca de status; se aprovando, também tenta lançar o pagamento pendente e
  // gerar a Ordem de Serviço — "warning" traz um aviso não-bloqueante caso essas duas etapas
  // automáticas falhem (o status em si já foi confirmado nesse caso).
  setBudgetStatus: (id: string, status: BudgetStatus) => Promise<{ ok: boolean; error?: string; warning?: string; serviceOrder?: ServiceOrder | null }>;
  convertBudgetToServiceOrder: (budgetId: string) => Promise<{ order: ServiceOrder | null; ok: boolean; error?: string }>;
  setServiceOrderStatus: (id: string, status: ServiceOrderStatus) => void;
  toggleChecklistItem: (orderId: string, index: number) => void;
  addQuoteRequest: (data: Omit<QuoteRequest, 'id' | 'created_at'>) => QuoteRequest;
  addOrcamentista: (data: Omit<Orcamentista, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Orcamentista;
  updateOrcamentista: (id: string, data: Partial<Orcamentista>) => void;
  addCompromisso: (data: Omit<Compromisso, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Promise<{ compromisso: Compromisso; ok: boolean; error?: string }>;
  updateCompromisso: (id: string, data: Partial<Compromisso>) => Promise<{ ok: boolean; error?: string }>;
  deleteCompromisso: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addPayment: (data: Omit<Payment, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Promise<{ payment: Payment; ok: boolean; error?: string }>;
  updatePayment: (id: string, data: Partial<Payment>) => Promise<{ ok: boolean; error?: string }>;
  deletePayment: (id: string) => Promise<{ ok: boolean; error?: string }>;
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
      const authUser: AuthUser = { email, nome: 'Sansão', cargo: 'administrador', organizationId: 'org-condutor-eletrico' };
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

  const addClient: StoreContextValue['addClient'] = useCallback(async (data) => {
    const client: Client = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, clients: [client, ...prev.clients] }));
    if (!isSupabaseConfigured) return { client, ok: true as const };
    try {
      await remoteInsertClient(client);
      return { client, ok: true as const };
    } catch (err) {
      // Gravação real falhou: tira o cliente "fantasma" da tela (ele só parecia salvo) e devolve
      // o erro real para o formulário mostrar — sem isso, o cliente sumia ao recarregar a página.
      setDb(prev => ({ ...prev, clients: prev.clients.filter(c => c.id !== client.id) }));
      return { client, ok: false as const, error: describeSupabaseError(err, 'o cliente', 'salvar') };
    }
  }, [orgId]);

  const updateClient: StoreContextValue['updateClient'] = useCallback(async (id, data) => {
    let previous: Client | undefined;
    setDb(prev => {
      previous = prev.clients.find(c => c.id === id);
      return { ...prev, clients: prev.clients.map(c => c.id === id ? { ...c, ...data, updated_at: todayISO() } : c) };
    });
    if (!isSupabaseConfigured) return { ok: true as const };
    try {
      await remoteUpdateClient(id, data);
      return { ok: true as const };
    } catch (err) {
      setDb(prev => ({ ...prev, clients: prev.clients.map(c => (c.id === id && previous) ? previous! : c) }));
      return { ok: false as const, error: describeSupabaseError(err, 'o cliente', 'atualizar') };
    }
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
    // Baseado no MAIOR número já usado no ano (não na quantidade de orçamentos existentes).
    // Antes contava quantos orçamentos existiam e somava 1 — se um orçamento fosse excluído no
    // meio do caminho, o próximo número gerado colidia com um número já usado por outro orçamento
    // (erro "duplicate key value violates unique constraint budgets_organization_id_numero_key").
    const year = new Date().getFullYear();
    const prefix = `${year}-`;
    const numerosExistentes = new Set(db.budgets.map(b => b.numero));
    const maiorSequencia = db.budgets.reduce((max, b) => {
      if (!b.numero.startsWith(prefix)) return max;
      const seq = parseInt(b.numero.slice(prefix.length), 10);
      return Number.isFinite(seq) && seq > max ? seq : max;
    }, 0);
    let seq = maiorSequencia + 1;
    let numero = `${prefix}${String(seq).padStart(4, '0')}`;
    // Garantia extra contra colisão (ex.: numeração antiga fora do padrão, ou estado local
    // momentaneamente desatualizado): se ainda assim colidir, avança até achar um número livre.
    while (numerosExistentes.has(numero)) {
      seq += 1;
      numero = `${prefix}${String(seq).padStart(4, '0')}`;
    }
    return numero;
  }, [db.budgets]);

  const addBudget: StoreContextValue['addBudget'] = useCallback(async (data) => {
    let budget: Budget = {
      id: newId(), organization_id: orgId, numero: data.numero || nextBudgetNumber(), titulo: '', tipo_servico: 'Instalação',
      local_servico: '', data_emissao: todayISO(), validade_dias: 10, responsavel: 'Felipe Ribeiro',
      status: 'rascunho', itens: [], custos_extras: [], desconto_percentual: 0, desconto_valor: 0,
      forma_pagamento: 'pix', entrada: 0, parcelas: 1, garantia: '90 dias',
      historico_status: [{ status: 'rascunho', data: todayISO() }],
      link_publico_token: newId(),
      created_at: todayISO(), updated_at: todayISO(), ...data,
    };
    // Atualização otimista: aparece na tela imediatamente. Em modo demo (sem Supabase) isso já é
    // a gravação definitiva. Em modo real, só é considerado sucesso de fato depois que o Supabase
    // confirmar — se falhar, a criação é desfeita da tela e o erro real é devolvido a quem chamou,
    // que decide o que mostrar (nunca sucesso E erro ao mesmo tempo).
    setDb(prev => ({ ...prev, budgets: [budget, ...prev.budgets] }));
    if (!isSupabaseConfigured) return { budget, ok: true as const };

    const idOtimista = budget.id;
    const MAX_TENTATIVAS = 6;
    const ano = new Date().getFullYear();
    const prefixo = `${ano}-`;
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        await remoteInsertBudget(budget);
        return { budget, ok: true as const };
      } catch (err) {
        const codigo = (err as { code?: string } | null)?.code;
        const ehColisaoDeNumero = codigo === '23505';
        // Colisão de número: o cache local pode estar bem desatualizado em relação ao banco de
        // verdade (ex.: outros orçamentos criados em outra sessão/dispositivo, ou uma exclusão
        // remota que falhou silenciosamente antes). Em vez de só somar 1 ao número que já tinha
        // (o que pode colidir de novo se o cache estiver muito atrasado), consulta o maior número
        // real no Supabase e parte dele — assim converge rápido mesmo com o cache bem defasado.
        // Faz isso sempre que houver colisão, mesmo que o número tenha sido passado manualmente,
        // porque nunca faz sentido devolver esse erro pro usuário se dá pra resolver sozinho.
        if (ehColisaoDeNumero && tentativa < MAX_TENTATIVAS) {
          let proximaSeq: number;
          try {
            proximaSeq = (await remoteMaxBudgetNumero(orgId, prefixo)) + 1;
          } catch {
            const seqAtual = budget.numero.startsWith(prefixo) ? parseInt(budget.numero.slice(prefixo.length), 10) : 0;
            proximaSeq = (Number.isFinite(seqAtual) ? seqAtual : 0) + 1;
          }
          const proximoNumero = `${prefixo}${String(proximaSeq).padStart(4, '0')}`;
          budget = { ...budget, numero: proximoNumero };
          setDb(prev => ({ ...prev, budgets: prev.budgets.map(b => b.id === idOtimista ? budget : b) }));
          continue;
        }
        setDb(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== idOtimista) }));
        return { budget, ok: false as const, error: describeSupabaseError(err, 'o orçamento', 'salvar') };
      }
    }
    setDb(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== idOtimista) }));
    return { budget, ok: false as const, error: 'Não foi possível encontrar um número livre para o orçamento. Tente novamente em instantes.' };
  }, [nextBudgetNumber, orgId]);

  const updateBudget: StoreContextValue['updateBudget'] = useCallback(async (id, data) => {
    let previous: Budget | undefined;
    setDb(prev => {
      previous = prev.budgets.find(b => b.id === id);
      return { ...prev, budgets: prev.budgets.map(b => b.id === id ? { ...b, ...data, updated_at: todayISO() } : b) };
    });
    if (!isSupabaseConfigured) return { ok: true as const };
    try {
      await remoteUpdateBudget(id, data);
      return { ok: true as const };
    } catch (err) {
      // Gravação real falhou: desfaz a atualização otimista para a tela não mentir que salvou,
      // e devolve o erro real para quem chamou mostrar (uma única mensagem, nunca as duas).
      setDb(prev => ({ ...prev, budgets: prev.budgets.map(b => (b.id === id && previous) ? previous! : b) }));
      return { ok: false as const, error: describeSupabaseError(err, 'o orçamento', 'atualizar') };
    }
  }, []);

  const deleteBudget: StoreContextValue['deleteBudget'] = useCallback(async (id) => {
    let removido: Budget | undefined;
    setDb(prev => {
      removido = prev.budgets.find(b => b.id === id);
      return { ...prev, budgets: prev.budgets.filter(b => b.id !== id) };
    });
    if (!isSupabaseConfigured) return { ok: true as const };
    try {
      await remoteDeleteBudget(id);
      return { ok: true as const };
    } catch (err) {
      // Se a exclusão real falhar, o orçamento tem que voltar a aparecer na tela — do contrário
      // ele some da lista local mas continua existindo (e ocupando o número) no banco de verdade,
      // o que já causou orçamentos "fantasma" colidindo com números novos.
      if (removido) {
        const restaurado = removido;
        setDb(prev => (prev.budgets.some(b => b.id === id) ? prev : { ...prev, budgets: [restaurado, ...prev.budgets] }));
      }
      return { ok: false as const, error: describeSupabaseError(err, 'o orçamento', 'excluir') };
    }
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
  // duplicar, e só então marca o orçamento como "convertido_em_os". Aguarda a confirmação real do
  // Supabase antes de devolver sucesso; se falhar, desfaz a mudança otimista.
  const convertBudgetToServiceOrder: StoreContextValue['convertBudgetToServiceOrder'] = useCallback(async (budgetId) => {
    const budget = db.budgets.find(b => b.id === budgetId);
    if (!budget) return { order: null, ok: false as const, error: 'Orçamento não encontrado.' };
    const existente = db.serviceOrders.find(o => o.budget_id === budgetId);
    const order = existente ?? buildServiceOrderFromBudget(budget);
    let previousBudget: Budget | undefined;
    setDb(prev => {
      previousBudget = prev.budgets.find(b => b.id === budgetId);
      return {
        ...prev,
        serviceOrders: existente ? prev.serviceOrders : [order, ...prev.serviceOrders],
        budgets: prev.budgets.map(b => b.id === budgetId
          ? { ...b, status: 'convertido_em_os', historico_status: [...b.historico_status, { status: 'convertido_em_os', data: todayISO() }] }
          : b),
      };
    });
    if (!isSupabaseConfigured) return { order, ok: true as const };
    try {
      if (!existente) await remoteInsertServiceOrder(order);
      await remoteUpdateBudgetStatus(budgetId, 'convertido_em_os');
      return { order, ok: true as const };
    } catch (err) {
      setDb(prev => ({
        ...prev,
        serviceOrders: existente ? prev.serviceOrders : prev.serviceOrders.filter(o => o.id !== order.id),
        budgets: prev.budgets.map(b => (b.id === budgetId && previousBudget) ? previousBudget! : b),
      }));
      return { order: null, ok: false as const, error: describeSupabaseError(err, 'a ordem de serviço', 'salvar') };
    }
  }, [db.budgets, db.serviceOrders, orgId]);

  // Geração automática de OS ao aprovar (total ou parcialmente) um orçamento — chamada de dentro
  // de setBudgetStatus. Diferente do fluxo manual acima, NÃO altera o status do orçamento (ele
  // continua "aprovado"/"aprovado_parcialmente"); apenas garante que a OS exista, sem duplicar.
  // Aguarda a confirmação real do Supabase — o chamador (setBudgetStatus) só considera a aprovação
  // totalmente concluída depois que isso retornar ok.
  const ensureServiceOrderForBudget = useCallback(async (budget: Budget): Promise<{ ok: boolean; error?: string; order: ServiceOrder | null }> => {
    const existente = db.serviceOrders.find(o => o.budget_id === budget.id);
    if (existente) return { ok: true, order: existente };
    const order = buildServiceOrderFromBudget(budget);
    setDb(prev => (prev.serviceOrders.some(o => o.budget_id === budget.id)
      ? prev
      : { ...prev, serviceOrders: [order, ...prev.serviceOrders] }));
    if (!isSupabaseConfigured) return { ok: true, order };
    try {
      await remoteInsertServiceOrder(order);
      return { ok: true, order };
    } catch (err) {
      setDb(prev => ({ ...prev, serviceOrders: prev.serviceOrders.filter(o => o.id !== order.id) }));
      return { ok: false, order: null, error: describeSupabaseError(err, 'a ordem de serviço', 'salvar') };
    }
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

  const addCompromisso: StoreContextValue['addCompromisso'] = useCallback(async (data) => {
    const compromisso: Compromisso = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, compromissos: [...prev.compromissos, compromisso].sort((a, b) => a.data.localeCompare(b.data)) }));
    if (!isSupabaseConfigured) return { compromisso, ok: true as const };
    try {
      await remoteInsertCompromisso(compromisso);
      return { compromisso, ok: true as const };
    } catch (err) {
      setDb(prev => ({ ...prev, compromissos: prev.compromissos.filter(c => c.id !== compromisso.id) }));
      return { compromisso, ok: false as const, error: describeSupabaseError(err, 'o compromisso', 'salvar') };
    }
  }, [orgId]);

  const updateCompromisso: StoreContextValue['updateCompromisso'] = useCallback(async (id, data) => {
    let previous: Compromisso | undefined;
    setDb(prev => {
      previous = prev.compromissos.find(c => c.id === id);
      return {
        ...prev,
        compromissos: prev.compromissos.map(c => c.id === id ? { ...c, ...data, updated_at: todayISO() } : c)
          .sort((a, b) => a.data.localeCompare(b.data)),
      };
    });
    if (!isSupabaseConfigured) return { ok: true as const };
    try {
      await remoteUpdateCompromisso(id, data);
      return { ok: true as const };
    } catch (err) {
      setDb(prev => ({ ...prev, compromissos: prev.compromissos.map(c => (c.id === id && previous) ? previous! : c) }));
      return { ok: false as const, error: describeSupabaseError(err, 'o compromisso', 'atualizar') };
    }
  }, []);

  const deleteCompromisso: StoreContextValue['deleteCompromisso'] = useCallback(async (id) => {
    let removido: Compromisso | undefined;
    setDb(prev => {
      removido = prev.compromissos.find(c => c.id === id);
      return { ...prev, compromissos: prev.compromissos.filter(c => c.id !== id) };
    });
    if (!isSupabaseConfigured) return { ok: true as const };
    try {
      await remoteDeleteCompromisso(id);
      return { ok: true as const };
    } catch (err) {
      if (removido) {
        const restaurado = removido;
        setDb(prev => (prev.compromissos.some(c => c.id === id) ? prev : { ...prev, compromissos: [...prev.compromissos, restaurado].sort((a, b) => a.data.localeCompare(b.data)) }));
      }
      return { ok: false as const, error: describeSupabaseError(err, 'o compromisso', 'excluir') };
    }
  }, []);

  const addPayment: StoreContextValue['addPayment'] = useCallback(async (data) => {
    const payment: Payment = { ...data, id: newId(), organization_id: orgId, created_at: todayISO(), updated_at: todayISO() };
    setDb(prev => ({ ...prev, payments: [payment, ...prev.payments] }));
    if (!isSupabaseConfigured) return { payment, ok: true as const };
    try {
      await remoteInsertPayment(payment);
      return { payment, ok: true as const };
    } catch (err) {
      setDb(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== payment.id) }));
      return { payment, ok: false as const, error: describeSupabaseError(err, 'o pagamento', 'salvar') };
    }
  }, [orgId]);

  const updatePayment: StoreContextValue['updatePayment'] = useCallback(async (id, data) => {
    let previous: Payment | undefined;
    setDb(prev => {
      previous = prev.payments.find(p => p.id === id);
      return { ...prev, payments: prev.payments.map(p => p.id === id ? { ...p, ...data, updated_at: todayISO() } : p) };
    });
    if (!isSupabaseConfigured) return { ok: true as const };
    try {
      await remoteUpdatePayment(id, data);
      return { ok: true as const };
    } catch (err) {
      setDb(prev => ({ ...prev, payments: prev.payments.map(p => (p.id === id && previous) ? previous! : p) }));
      return { ok: false as const, error: describeSupabaseError(err, 'o pagamento', 'atualizar') };
    }
  }, []);

  const deletePayment: StoreContextValue['deletePayment'] = useCallback(async (id) => {
    let removido: Payment | undefined;
    setDb(prev => {
      removido = prev.payments.find(p => p.id === id);
      return { ...prev, payments: prev.payments.filter(p => p.id !== id) };
    });
    if (!isSupabaseConfigured) return { ok: true as const };
    try {
      await remoteDeletePayment(id);
      return { ok: true as const };
    } catch (err) {
      if (removido) {
        const restaurado = removido;
        setDb(prev => (prev.payments.some(p => p.id === id) ? prev : { ...prev, payments: [restaurado, ...prev.payments] }));
      }
      return { ok: false as const, error: describeSupabaseError(err, 'o pagamento', 'excluir') };
    }
  }, []);

  // Fluxo de aprovação, na ordem que o usuário espera: 1) salva o status e SÓ SEGUE depois de
  // confirmar a gravação real no Supabase; 2) lança o pagamento "a receber" automaticamente, se
  // ainda não houver nenhum; 3) garante a Ordem de Serviço. As etapas 2 e 3 são automações que
  // seguem a aprovação — se alguma delas falhar, o status (que é o que realmente importa) já está
  // salvo, e o chamador recebe um "warning" claro em vez de um erro genérico ou um sucesso mudo.
  const setBudgetStatus: StoreContextValue['setBudgetStatus'] = useCallback(async (id, status) => {
    let previous: Budget | undefined;
    setDb(prev => {
      previous = prev.budgets.find(b => b.id === id);
      return {
        ...prev,
        budgets: prev.budgets.map(b => b.id === id
          ? { ...b, status, historico_status: [...b.historico_status, { status, data: todayISO() }], updated_at: todayISO() }
          : b),
      };
    });

    if (isSupabaseConfigured) {
      try {
        await remoteUpdateBudgetStatus(id, status);
      } catch (err) {
        setDb(prev => ({ ...prev, budgets: prev.budgets.map(b => (b.id === id && previous) ? previous! : b) }));
        return { ok: false as const, error: describeSupabaseError(err, 'o status do orçamento', 'atualizar') };
      }
    }

    const isAprovando = status === 'aprovado' || status === 'aprovado_parcialmente';
    if (!isAprovando || !previous) return { ok: true as const, serviceOrder: null };

    // Reconstrói o orçamento já com o status novo (em vez de reler de db.budgets, que pode ainda
    // não ter sido re-renderizado neste exato instante) para gerar pagamento/OS com dados corretos.
    const budgetAtualizado: Budget = {
      ...previous, status, historico_status: [...previous.historico_status, { status, data: todayISO() }], updated_at: todayISO(),
    };

    const avisos: string[] = [];

    const jaTemPagamento = db.payments.some(p => p.budget_id === id);
    if (!jaTemPagamento) {
      const totals = calculateBudget(budgetAtualizado);
      if (totals.totalVenda > 0) {
        const paymentResult = await addPayment({
          client_id: budgetAtualizado.client_id ?? null,
          budget_id: budgetAtualizado.id,
          descricao: `Saldo a receber — orçamento ${budgetAtualizado.numero}`,
          valor: totals.totalVenda,
          status: 'pendente',
        });
        if (!paymentResult.ok) {
          avisos.push(`não foi possível lançar o valor a receber automaticamente (${paymentResult.error})`);
        }
      }
    }

    const osResult = await ensureServiceOrderForBudget(budgetAtualizado);
    if (!osResult.ok) {
      avisos.push(`não foi possível gerar a ordem de serviço (${osResult.error})`);
    }

    if (avisos.length > 0) {
      return { ok: true as const, warning: `Status atualizado, mas ${avisos.join('; ')}.`, serviceOrder: osResult.order };
    }
    return { ok: true as const, serviceOrder: osResult.order };
  }, [db.payments, addPayment, ensureServiceOrderForBudget]);

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
