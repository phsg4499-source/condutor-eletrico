// Tipos principais do sistema Condutor Elétrico
// Espelham as tabelas definidas em supabase_condutor_eletrico.sql

export type AccessLevel = 'administrador' | 'orcamentista' | 'eletricista' | 'financeiro' | 'visualizacao';

export interface Organization {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  documento: string; // CPF ou CNPJ
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  logo_url?: string;
  cor_principal: string;
  cor_secundaria: string;
  instagram: string;
  site?: string;
  chave_pix?: string;
  dados_bancarios?: string;
  condicoes_padrao: string;
  prazo_validade_padrao_dias: number;
  garantia_padrao: string;
  observacoes_padrao?: string;
  modo_calculo_margem: 'markup_sobre_custo' | 'margem_sobre_venda' | 'valor_fixo' | 'percentual_geral';
  margem_minima_percentual: number;
  impostos_estimados_percentual: number;
  responsavel: string;
  experiencia: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  nome: string;
  email: string;
  telefone?: string;
  cargo: AccessLevel;
  ativo: boolean;
  created_at: string;
}

export type TipoPessoa = 'fisica' | 'juridica';
export type OrigemCliente = 'indicacao' | 'instagram' | 'site' | 'whatsapp' | 'google' | 'outro';

export interface ClienteEndereco {
  id: string;
  rotulo: string; // Residência, Escritório, Obra...
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface Orcamentista {
  id: string;
  organization_id: string;
  nome: string;
  telefone?: string;
  email?: string;
  cargo: string;
  status: 'ativo' | 'inativo';
  foto_url?: string;
  observacoes?: string;
  aparece_no_pdf: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  tipo_pessoa: TipoPessoa;
  nome: string;
  nome_fantasia?: string;
  documento?: string;
  telefone: string;
  whatsapp: string;
  email?: string;
  observacoes?: string;
  origem: OrigemCliente;
  status: 'ativo' | 'inativo';
  tags: string[];
  enderecos: ClienteEndereco[];
  created_at: string;
  updated_at: string;
}

export type UnidadeMedida = 'unidade' | 'metro' | 'rolo' | 'caixa' | 'pacote' | 'par' | 'jogo' | 'kg' | 'litro' | 'hora' | 'diaria' | 'servico';

export interface Material {
  id: string;
  organization_id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria: string;
  subcategoria?: string;
  marca?: string;
  unidade: UnidadeMedida;
  preco_custo: number;
  preco_venda: number;
  margem_padrao: number;
  estoque_atual: number;
  estoque_minimo: number;
  fornecedor?: string;
  ativo: boolean;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceItem {
  id: string;
  organization_id: string;
  codigo: string;
  nome: string;
  categoria: string;
  descricao_tecnica?: string;
  unidade: UnidadeMedida;
  valor_padrao: number;
  custo_mao_obra: number;
  tempo_estimado_horas?: number;
  margem_padrao: number;
  garantia_padrao?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type BudgetStatus =
  | 'rascunho' | 'em_elaboracao' | 'aguardando_vistoria' | 'aguardando_informacoes'
  | 'pronto_para_envio' | 'enviado' | 'visualizado' | 'em_negociacao' | 'revisao_solicitada'
  | 'aprovado' | 'aprovado_parcialmente' | 'recusado' | 'vencido' | 'cancelado' | 'convertido_em_os';

export interface BudgetLineItem {
  id: string;
  tipo: 'servico' | 'material';
  referencia_id?: string; // id do serviço/material catalogado, se aplicável
  nome: string;
  descricao?: string;
  quantidade: number;
  unidade: UnidadeMedida;
  custo_unitario: number;
  valor_unitario: number;
  desconto: number; // valor em reais
}

export interface ExtraCost {
  id: string;
  descricao: string;
  valor: number;
}

export type FormaPagamento = 'pix' | 'dinheiro' | 'transferencia' | 'boleto' | 'debito' | 'credito' | 'entrada_parcelas' | 'a_combinar';

export interface Budget {
  id: string;
  organization_id: string;
  numero: string;
  client_id?: string | null;
  cliente_nome_avulso?: string | null;
  cliente_telefone_avulso?: string | null;
  cliente_whatsapp_avulso?: string | null;
  titulo: string;
  tipo_servico: string;
  descricao_problema?: string;
  local_servico: string;
  data_emissao: string;
  validade_dias: number;
  prazo_estimado?: string;
  responsavel: string;
  orcamentista_id?: string;
  status: BudgetStatus;
  itens: BudgetLineItem[];
  custos_extras: ExtraCost[];
  desconto_percentual: number;
  desconto_valor: number;
  forma_pagamento: FormaPagamento;
  entrada: number;
  parcelas: number;
  garantia: string;
  observacoes_internas?: string;
  observacoes_cliente?: string;
  historico_status: { status: BudgetStatus; data: string }[];
  created_at: string;
  updated_at: string;
}

export type ServiceOrderStatus =
  | 'aguardando_agendamento' | 'agendada' | 'em_deslocamento' | 'em_execucao' | 'pausada'
  | 'aguardando_material' | 'aguardando_cliente' | 'concluida' | 'aguardando_conferencia'
  | 'finalizada' | 'cancelada';

export interface ServiceOrder {
  id: string;
  organization_id: string;
  numero: string;
  budget_id: string;
  client_id?: string | null;
  cliente_nome_avulso?: string | null;
  cliente_telefone_avulso?: string | null;
  cliente_whatsapp_avulso?: string | null;
  data_prevista?: string;
  data_inicio?: string;
  data_conclusao?: string;
  responsavel_tecnico: string;
  status: ServiceOrderStatus;
  checklist: { item: string; concluido: boolean }[];
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = 'pendente' | 'parcial' | 'pago' | 'atrasado' | 'cancelado' | 'renegociado';

export interface Payment {
  id: string;
  organization_id: string;
  client_id?: string | null;
  budget_id?: string | null;
  service_order_id?: string | null;
  descricao: string;
  valor: number;
  vencimento?: string;
  data_recebimento?: string;
  forma_pagamento?: FormaPagamento;
  status: PaymentStatus;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export type CompromissoTipo = 'visita_orcamento' | 'execucao_servico' | 'reuniao' | 'outro';
export type CompromissoStatus = 'agendado' | 'concluido' | 'cancelado';

export interface Compromisso {
  id: string;
  organization_id: string;
  titulo: string;
  tipo: CompromissoTipo;
  data: string;
  hora?: string;
  client_id?: string | null;
  cliente_nome_avulso?: string | null;
  cliente_telefone_avulso?: string | null;
  budget_id?: string | null;
  service_order_id?: string | null;
  orcamentista_id?: string | null;
  local?: string;
  observacoes?: string;
  status: CompromissoStatus;
  created_at: string;
  updated_at: string;
}

export interface QuoteRequest {
  id: string;
  nome: string;
  documento?: string;
  telefone: string;
  email?: string;
  tipo_cliente: string;
  endereco_servico: string;
  cidade: string;
  tipo_imovel: string;
  servico_desejado: string;
  descricao: string;
  urgencia: 'baixa' | 'media' | 'alta' | 'emergencia';
  created_at: string;
}
