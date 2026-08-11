import type { Budget, Compromisso, CompromissoTipo } from '../types';

const tipoVisitaLabel: Record<CompromissoTipo, string> = {
  visita_orcamento: 'visita para orçamento', execucao_servico: 'execução de serviço',
  reuniao: 'reunião', outro: 'compromisso',
};

// Formata a data (guardada como "YYYY-MM-DD") no padrão brasileiro DD/MM/AAAA sem o problema
// clássico de fuso horário: acrescenta T00:00:00 para o JS interpretar como meia-noite local,
// em vez de UTC (o que podia exibir o dia anterior dependendo do fuso do navegador).
function formatDataBR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('pt-BR');
}

// Mensagem de confirmação de agendamento — enviada para o WhatsApp da própria empresa
// (org.whatsapp), como uma notificação/lembrete de que a visita/serviço foi agendado.
// Nenhum dado é fixo: tipo, responsável, data, horário, cliente e endereço vêm do compromisso
// real que acabou de ser salvo.
export function compromissoConfirmationMessage(
  c: Pick<Compromisso, 'tipo' | 'data' | 'hora' | 'local' | 'observacoes'>,
  opts: { responsavel?: string; cliente?: string } = {},
): string {
  const linhas = [
    `✅ Agendamento ${tipoVisitaLabel[c.tipo]}${opts.responsavel ? ` - Responsável ${opts.responsavel}` : ''}`,
    `⏰ Data: ${formatDataBR(c.data)}${c.hora ? ` às ${c.hora}h` : ''}`,
  ];
  if (c.local) linhas.push(`📍 ${c.local}`);
  if (opts.cliente) linhas.push(`👤 Cliente: ${opts.cliente}`);
  if (c.observacoes) linhas.push(`📝 ${c.observacoes}`);
  return linhas.join('\n');
}

// Resumo diário da agenda — mesmo formato que seria usado num envio automático às 7h, mas aqui
// preparado para o usuário conferir e enviar manualmente com um clique (a conta não tem uma API
// paga de WhatsApp conectada, então o envio automático de verdade não está disponível; ver botão
// "Enviar resumo de hoje" na Agenda/Dashboard).
export function resumoDiarioMessage(
  compromissosDoDia: Array<Pick<Compromisso, 'tipo' | 'hora' | 'local'> & { clienteNome?: string }>,
  dataISO: string,
): string {
  const cabecalho = `⚡ CONDUTOR ELÉTRICO BRASIL\n📅 Agenda de hoje — ${formatDataBR(dataISO)}`;
  if (compromissosDoDia.length === 0) {
    return `${cabecalho}\n\nNão existem compromissos cadastrados para hoje.`;
  }
  const ordenados = [...compromissosDoDia].sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''));
  const itens = ordenados.map((c, i) => {
    const partes = [`${i + 1}️⃣ ${c.hora ? `${c.hora}h` : 'Sem horário definido'}`];
    if (c.clienteNome) partes.push(`👤 Cliente: ${c.clienteNome}`);
    partes.push(`🔧 ${tipoVisitaLabel[c.tipo]}`);
    if (c.local) partes.push(`📍 ${c.local}`);
    return partes.join('\n');
  });
  return `${cabecalho}\n\n${itens.join('\n\n')}\n\nTotal: ${compromissosDoDia.length} compromisso(s).`;
}

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
