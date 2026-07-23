import type { BudgetStatus, ServiceOrderStatus, CompromissoStatus } from '../types';

const budgetLabels: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho', em_elaboracao: 'Em elaboração', aguardando_vistoria: 'Aguardando vistoria',
  aguardando_informacoes: 'Aguardando informações', pronto_para_envio: 'Pronto para envio', enviado: 'Enviado',
  visualizado: 'Visualizado', em_negociacao: 'Em negociação', revisao_solicitada: 'Revisão solicitada',
  aprovado: 'Aprovado', aprovado_parcialmente: 'Aprovado parcialmente', recusado: 'Recusado',
  vencido: 'Vencido', cancelado: 'Cancelado', convertido_em_os: 'Convertido em OS',
};

const budgetColors: Record<BudgetStatus, string> = {
  rascunho: 'bg-gray-600', em_elaboracao: 'bg-gray-600', aguardando_vistoria: 'bg-amber-600',
  aguardando_informacoes: 'bg-amber-600', pronto_para_envio: 'bg-blue-600', enviado: 'bg-blue-600',
  visualizado: 'bg-blue-500', em_negociacao: 'bg-purple-600', revisao_solicitada: 'bg-purple-600',
  aprovado: 'bg-emerald-600', aprovado_parcialmente: 'bg-emerald-700', recusado: 'bg-red-600',
  vencido: 'bg-red-700', cancelado: 'bg-gray-700', convertido_em_os: 'bg-teal-600',
};

const osLabels: Record<ServiceOrderStatus, string> = {
  aguardando_agendamento: 'Aguardando agendamento', agendada: 'Agendada', em_deslocamento: 'Em deslocamento',
  em_execucao: 'Em execução', pausada: 'Pausada', aguardando_material: 'Aguardando material',
  aguardando_cliente: 'Aguardando cliente', concluida: 'Concluída', aguardando_conferencia: 'Aguardando conferência',
  finalizada: 'Finalizada', cancelada: 'Cancelada',
};

const osColors: Record<ServiceOrderStatus, string> = {
  aguardando_agendamento: 'bg-gray-600', agendada: 'bg-blue-600', em_deslocamento: 'bg-blue-500',
  em_execucao: 'bg-purple-600', pausada: 'bg-amber-600', aguardando_material: 'bg-amber-600',
  aguardando_cliente: 'bg-amber-600', concluida: 'bg-emerald-600', aguardando_conferencia: 'bg-teal-600',
  finalizada: 'bg-emerald-700', cancelada: 'bg-red-700',
};

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  return <span className={`text-xs px-2 py-1 rounded-full text-white ${budgetColors[status]}`}>{budgetLabels[status]}</span>;
}

export function ServiceOrderStatusBadge({ status }: { status: ServiceOrderStatus }) {
  return <span className={`text-xs px-2 py-1 rounded-full text-white ${osColors[status]}`}>{osLabels[status]}</span>;
}

const compromissoLabels: Record<CompromissoStatus, string> = {
  agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado',
};
const compromissoColors: Record<CompromissoStatus, string> = {
  agendado: 'bg-blue-600', concluido: 'bg-emerald-600', cancelado: 'bg-gray-700',
};

export function CompromissoStatusBadge({ status }: { status: CompromissoStatus }) {
  return <span className={`text-xs px-2 py-1 rounded-full text-white ${compromissoColors[status]}`}>{compromissoLabels[status]}</span>;
}

export const budgetStatusOptions = Object.entries(budgetLabels) as [BudgetStatus, string][];
export const serviceOrderStatusOptions = Object.entries(osLabels) as [ServiceOrderStatus, string][];
export const compromissoStatusOptions = Object.entries(compromissoLabels) as [CompromissoStatus, string][];
