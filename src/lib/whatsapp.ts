import type { Budget } from '../types';

export function budgetWhatsappMessage(budget: Budget, client: { nome: string }, link: string): string {
  return `Olá, ${client.nome}! Preparamos o orçamento nº ${budget.numero} referente ao serviço "${budget.titulo}" em ${budget.local_servico}. Você pode visualizar todos os detalhes e condições neste link: ${link}. Ficamos à disposição para qualquer ajuste.`;
}

export function whatsappLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const whatsappTemplates = {
  primeiroEnvio: (numero: string, link: string) =>
    `Olá! Segue o orçamento nº ${numero} da Condutor Elétrico: ${link}`,
  lembrete: (numero: string) =>
    `Olá! Passando para saber se conseguiu analisar o orçamento nº ${numero}. Ficamos à disposição.`,
  vencimentoProximo: (numero: string) =>
    `Olá! O orçamento nº ${numero} está próximo do vencimento. Deseja que renovemos a validade?`,
  agradecimento: (numero: string) =>
    `Obrigado por aprovar o orçamento nº ${numero}! Em breve entraremos em contato para agendar o serviço.`,
  posServico: () =>
    `Olá! O serviço foi concluído. Ficamos à disposição para qualquer dúvida ou necessidade futura.`,
};
