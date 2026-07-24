import jsPDF from 'jspdf';
import type { Budget, Client, Organization } from '../types';
import { calculateBudget } from './calculations';
import { formatMoney, formatDate, todayISO } from './format';

// Gera um Contrato de Prestação de Serviços em PDF, preenchido automaticamente com os dados
// do orçamento, do cliente e da organização. Documento-modelo com cláusulas padrão de mercado
// para serviços elétricos — não substitui a revisão de um advogado para casos específicos.

const GRAPHITE: [number, number, number] = [16, 18, 21];
const ACCENT: [number, number, number] = [245, 197, 24];
const INK: [number, number, number] = [24, 26, 31];
const MUTED: [number, number, number] = [110, 116, 128];
const WHITE: [number, number, number] = [255, 255, 255];

function formaPagamentoLabel(fp: Budget['forma_pagamento']): string {
  const map: Record<Budget['forma_pagamento'], string> = {
    pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência bancária', boleto: 'Boleto',
    debito: 'Cartão de débito', credito: 'Cartão de crédito', entrada_parcelas: 'Entrada + parcelas', a_combinar: 'A combinar',
  };
  return map[fp];
}

function formatEndereco(client?: Client): string {
  const end = client?.enderecos?.[0];
  if (!end) return '';
  const partes = [
    `${end.logradouro}, ${end.numero}${end.complemento ? ` - ${end.complemento}` : ''}`,
    end.bairro, `${end.cidade}/${end.estado}`, end.cep ? `CEP ${end.cep}` : '',
  ].filter(Boolean);
  return partes.join(' — ');
}

export function generateServiceContractPdf(
  budget: Budget,
  cliente: { nome: string; telefone?: string },
  client: Client | undefined,
  org: Organization,
): jsPDF {
  const doc = new jsPDF();
  const totals = calculateBudget(budget);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  drawHeader();
  y = 42;

  title('CONTRATO DE PRESTAÇÃO DE SERVIÇOS');
  y += 2;

  paragraph(
    `Pelo presente instrumento particular, de um lado o CONTRATANTE e, de outro, a CONTRATADA, identificados a seguir, ` +
    `têm entre si justo e acordado o presente Contrato de Prestação de Serviços, referente ao orçamento nº ${budget.numero}, ` +
    `que se regerá pelas cláusulas e condições seguintes.`,
  );
  y += 2;

  y = checkBreak(38);
  y = partyBox('CONTRATANTE (CLIENTE)', [
    ['Nome / Razão social', cliente.nome],
    ['CPF/CNPJ', client?.documento || '____________________'],
    ['Telefone', cliente.telefone || client?.telefone || '____________________'],
    ['Endereço', formatEndereco(client) || '____________________'],
  ]);
  y += 5;

  y = checkBreak(38);
  y = partyBox('CONTRATADA (PRESTADORA DE SERVIÇOS)', [
    ['Razão social', org.razao_social || org.nome_fantasia],
    ['Nome fantasia', org.nome_fantasia],
    ['CPF/CNPJ', org.documento || '____________________'],
    ['Telefone', org.telefone],
    ['Endereço', org.endereco ? `${org.endereco} — ${org.cidade}/${org.estado}` : '____________________'],
  ]);
  y += 6;

  clause('CLÁUSULA 1ª — DO OBJETO', [
    `O presente contrato tem por objeto a prestação, pela CONTRATADA, dos serviços elétricos descritos no orçamento nº ${budget.numero} ` +
    `("${budget.titulo}"), a serem executados no seguinte local: ${budget.local_servico || 'a combinar entre as partes'}.`,
    budget.descricao_problema
      ? `Descrição do problema/escopo relatado: ${budget.descricao_problema}`
      : '',
    'Os itens de serviço e material incluídos no escopo, com suas respectivas quantidades e valores, constam do orçamento referido, ' +
    'que integra este contrato como Anexo I, independentemente de transcrição.',
  ]);

  clause('CLÁUSULA 2ª — DO VALOR E DA FORMA DE PAGAMENTO', [
    `O valor total dos serviços e materiais objeto deste contrato é de ${formatMoney(totals.totalVenda)}.`,
    budget.entrada > 0
      ? `Fica ajustado o pagamento de um sinal/entrada no valor de ${formatMoney(budget.entrada)}, ` +
        `com o saldo remanescente de ${formatMoney(totals.saldoRestante)} a ser quitado ` +
        (budget.parcelas > 1 ? `em ${budget.parcelas}x de ${formatMoney(totals.valorParcela)}.` : 'conforme acordado entre as partes.')
      : `O pagamento será efetuado ${budget.parcelas > 1 ? `em ${budget.parcelas}x de ${formatMoney(totals.valorParcela)}` : 'em parcela única'}, ` +
        'salvo negociação diversa registrada por escrito entre as partes.',
    `Forma de pagamento combinada: ${formaPagamentoLabel(budget.forma_pagamento)}.`,
    'Em caso de atraso no pagamento, incidirão os encargos legais cabíveis (juros, multa e correção monetária), sem prejuízo do direito ' +
    'da CONTRATADA de suspender a execução dos serviços até a regularização.',
  ]);

  clause('CLÁUSULA 3ª — DO PRAZO DE EXECUÇÃO', [
    `O prazo estimado para execução dos serviços é de ${budget.prazo_estimado || 'a combinar entre as partes, conforme cronograma técnico'}, ` +
    'contado a partir da liberação do local de trabalho e/ou do pagamento do sinal, quando aplicável.',
    'Prazos poderão ser prorrogados por motivos alheios à vontade da CONTRATADA (força maior, caso fortuito, atraso em fornecimento de ' +
    'materiais por terceiros, condições do imóvel não informadas previamente, ou solicitação de alteração de escopo pelo CONTRATANTE).',
  ]);

  clause('CLÁUSULA 4ª — DA GARANTIA', [
    `Os serviços executados possuem garantia de ${budget.garantia || 'conforme normas técnicas aplicáveis'}, contada a partir da data de conclusão, ` +
    'cobrindo exclusivamente defeitos de execução do próprio serviço prestado.',
    'A garantia não cobre danos decorrentes de mau uso, intervenção de terceiros não autorizados, sobrecarga da rede elétrica, ' +
    'fenômenos naturais ou desgaste natural dos materiais.',
  ]);

  clause('CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA', [
    'a) Executar os serviços conforme as normas técnicas vigentes (incluindo a NBR 5410 e demais normas regulamentadoras aplicáveis à atividade elétrica);',
    'b) Utilizar mão de obra qualificada e os equipamentos de proteção individual e coletiva necessários à segurança da execução;',
    'c) Fornecer, sempre que solicitado, informações sobre o andamento dos serviços;',
    'd) Responsabilizar-se pelos vícios de execução verificados dentro do prazo de garantia estipulado na Cláusula 4ª;',
    'e) Comunicar previamente ao CONTRATANTE qualquer necessidade de alteração do escopo, prazo ou valor originalmente acordados.',
  ]);

  clause('CLÁUSULA 6ª — DAS OBRIGAÇÕES DO CONTRATANTE', [
    'a) Franquear o acesso da CONTRATADA ao local de execução dos serviços, nos dias e horários combinados;',
    'b) Efetuar os pagamentos nas datas e condições estabelecidas na Cláusula 2ª;',
    'c) Informar previamente à CONTRATADA sobre condições especiais do local (rede elétrica antiga, presença de riscos, restrições de acesso, etc.);',
    'd) Comunicar de imediato qualquer irregularidade ou insatisfação quanto aos serviços prestados, para que a CONTRATADA possa saná-la ' +
    'dentro do prazo de garantia;',
    'e) Não solicitar alterações de escopo sem o devido ajuste de valor e prazo, formalizado por aditivo ou novo orçamento.',
  ]);

  clause('CLÁUSULA 7ª — DOS SERVIÇOS ADICIONAIS', [
    'Quaisquer serviços não previstos no orçamento original e solicitados durante a execução serão objeto de orçamento complementar, ' +
    'com valor e prazo próprios, somente sendo executados mediante aprovação expressa do CONTRATANTE.',
  ]);

  clause('CLÁUSULA 8ª — DA RESCISÃO', [
    'O presente contrato poderá ser rescindido por qualquer das partes, mediante comunicação prévia por escrito, em caso de descumprimento ' +
    'de qualquer cláusula aqui prevista, ou por acordo mútuo.',
    'Em caso de rescisão pelo CONTRATANTE após o início da execução dos serviços, será devido à CONTRATADA o pagamento proporcional aos ' +
    'serviços e materiais já executados/adquiridos até a data da rescisão.',
  ]);

  clause('CLÁUSULA 9ª — DISPOSIÇÕES GERAIS E FORO', [
    'Aplicam-se a este contrato, no que couber, as disposições do Código Civil e, quando o CONTRATANTE for pessoa física destinatária ' +
    'final dos serviços, as normas do Código de Defesa do Consumidor (Lei nº 8.078/1990).',
    `Fica eleito o foro da comarca de ${org.cidade || '____________________'}/${org.estado || '__'} para dirimir quaisquer dúvidas ou ` +
    'controvérsias oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
    `E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.`,
  ]);

  y = checkBreak(50);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(`${org.cidade || 'Local'}, ${formatDate(todayISO())}.`, margin, y);
  y += 16;

  signatureLine('CONTRATANTE', cliente.nome);
  y += 20;
  signatureLine('CONTRATADA', org.nome_fantasia);

  drawFooter();

  return doc;

  // ----- helpers -----

  function checkBreak(needed: number): number {
    if (y + needed > pageHeight - 24) {
      doc.addPage();
      return 20;
    }
    return y;
  }

  function drawHeader() {
    doc.setFillColor(...GRAPHITE);
    doc.rect(0, 0, pageWidth, 34, 'F');
    doc.setFillColor(...ACCENT);
    doc.rect(0, 34, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...WHITE);
    doc.text('CONDUTOR', margin, 15);
    const w1 = doc.getTextWidth('CONDUTOR ');
    doc.setTextColor(...ACCENT);
    doc.text('ELÉTRICO', margin + w1, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(org.nome_fantasia || 'Condutor Elétrico', margin, 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ACCENT);
    doc.text(`ORÇAMENTO Nº ${budget.numero}`, pageWidth - margin, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(`Emitido em ${formatDate(todayISO())}`, pageWidth - margin, 21, { align: 'right' });
  }

  function title(text: string) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(text, pageWidth / 2, y, { align: 'center' });
    y += 8;
  }

  function paragraph(text: string) {
    if (!text) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(text, contentWidth);
    y = checkBreak(lines.length * 4.4 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 4.4 + 4;
  }

  function partyBox(label: string, rows: [string, string][]): number {
    const cardPad = 5;
    const lineHeight = 5.2;
    const cardHeight = rows.length * lineHeight + cardPad * 2 + 4;
    y = checkBreak(cardHeight + 6);
    doc.setFillColor(245, 246, 248);
    doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'F');
    doc.setFillColor(...ACCENT);
    doc.rect(margin, y, 2.5, cardHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(label, margin + cardPad + 2, y + cardPad + 2);

    let ry = y + cardPad + 2 + lineHeight;
    rows.forEach(([k, v]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${k}:`, margin + cardPad + 2, ry);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(String(v), margin + 48, ry, { maxWidth: contentWidth - 52 });
      ry += lineHeight;
    });
    return y + cardHeight;
  }

  function clause(heading: string, paragraphs: string[]) {
    y = checkBreak(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(heading, margin, y);
    y += 5.5;
    paragraphs.filter(Boolean).forEach(p => paragraph(p));
    y += 1;
  }

  function signatureLine(label: string, nome: string) {
    y = checkBreak(20);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 90, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(label, margin, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(nome, margin, y + 10);
  }

  function drawFooter() {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(
        `${org.nome_fantasia || 'Condutor Elétrico'} — Contrato de Prestação de Serviços — Orçamento nº ${budget.numero} — Página ${i}/${pageCount}`,
        pageWidth / 2, pageHeight - 8, { align: 'center' },
      );
    }
  }
}
