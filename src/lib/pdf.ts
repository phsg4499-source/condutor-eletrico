import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Budget, Organization, Receipt } from '../types';
import { calculateBudget } from './calculations';
import { formatMoney, formatDate, addDays, valorPorExtenso } from './format';
import { generateTechnicalProposalPdf } from './technicalProposalPdf';

// Gera o PDF profissional do orçamento para o CLIENTE.
// Nunca inclui custo, margem, lucro ou observações internas.
// Identidade visual: azul profundo + ciano elétrico (Condutor Elétrico Brasil), tipografia forte,
// blocos editoriais.

const GRAPHITE: [number, number, number] = [0, 45, 74]; // azul profundo — antes grafite quase preto
const GRAPHITE_SOFT: [number, number, number] = [0, 105, 168]; // azul intermediário — antes cinza-grafite
const ACCENT: [number, number, number] = [0, 180, 229]; // ciano elétrico — antes amarelo
const ACCENT_DEEP: [number, number, number] = [0, 154, 209]; // azul intermediário — antes amarelo escuro
const INK: [number, number, number] = [24, 26, 31];
const MUTED: [number, number, number] = [110, 116, 128];
const CARD_BG: [number, number, number] = [245, 246, 248];
const WHITE: [number, number, number] = [255, 255, 255];

const SLOGAN = 'Você chama, a Condutor resolve.';

// Textos institucionais obrigatórios (conformidade NBR 5410) — o nome do cliente é preenchido
// dinamicamente, nunca fixo.
function textoAberturaAbnt(nomeCliente: string): string {
  return `Prezado(a) ${nomeCliente},\n\nÉ com grande satisfação que apresentamos nossa proposta de mão de obra em conformidade com a ABNT NBR 5410, norma que estabelece os requisitos para instalações elétricas de baixa tensão, garantindo segurança, confiabilidade e desempenho das instalações elétricas.\n\nNossa equipe é formada por profissionais qualificados e comprometidos em executar os serviços com qualidade, segurança e dentro dos prazos estabelecidos.`;
}

const TEXTO_FECHAMENTO_ABNT = `Agradecemos pela oportunidade de apresentar nossa proposta de mão de obra em conformidade com a norma NBR 5410.\n\nEstamos à disposição para discutir detalhes ou esclarecer quaisquer dúvidas que possam surgir. Podemos assegurar que nossos serviços seguirão rigorosamente os requisitos dessa norma, garantindo a segurança e a qualidade das instalações elétricas.\n\nAguardamos sua resposta positiva e permanecemos à disposição para quaisquer esclarecimentos.\n\nA lista de materiais será apresentada separadamente após a aprovação desta proposta.`;

export function generateBudgetPdf(budget: Budget, client: { nome: string }, org: Organization): jsPDF {
  // Proposta técnica completa: template próprio (ver technicalProposalPdf.ts). Orçamentos no
  // formato simples (a grande maioria, e todos os já emitidos) seguem exatamente como sempre —
  // nenhuma linha abaixo deste "if" é alterada por essa funcionalidade.
  if (budget.proposta_detalhada) return generateTechnicalProposalPdf(budget, client, org);

  const doc = new jsPDF();
  const totals = calculateBudget(budget);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  drawHeader();
  let y = 64;

  // Título + card de informações
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const tituloLines = doc.splitTextToSize(budget.titulo, contentWidth);
  doc.text(tituloLines, margin, y);
  y += tituloLines.length * 6.5 + 4;

  y = drawInfoCard(y);
  y += 6;

  // Texto institucional obrigatório (conformidade ABNT NBR 5410), com o nome do cliente
  // preenchido dinamicamente — sempre entre a identificação do cliente e a descrição dos serviços.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const abertura = doc.splitTextToSize(textoAberturaAbnt(client.nome), contentWidth);
  doc.text(abertura, margin, y);
  y += abertura.length * 4.6 + 6;

  const servicos = budget.itens.filter(i => i.tipo === 'servico');
  const materiais = budget.itens.filter(i => i.tipo === 'material');

  if (servicos.length) {
    y = sectionLabel('Serviços', y);
    autoTable(doc, {
      startY: y,
      head: [['Descrição', 'Qtd', 'Unid.', 'Valor unit.', 'Total']],
      body: servicos.map(i => [
        i.nome || '—', String(i.quantidade ?? ''), i.unidade || '—',
        formatMoney(i.valor_unitario),
        formatMoney(i.quantidade * i.valor_unitario - i.desconto),
      ]),
      styles: { fontSize: 9, cellPadding: 3, textColor: INK, lineColor: [225, 227, 231], lineWidth: 0.2 },
      headStyles: { fillColor: GRAPHITE, textColor: ACCENT, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: CARD_BG },
      columnStyles: { 1: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable anexa lastAutoTable ao doc
    y = doc.lastAutoTable.finalY + 8;
  }

  if (materiais.length) {
    y = checkPageBreak(y, 30);
    y = sectionLabel('Materiais', y);
    autoTable(doc, {
      startY: y,
      head: [['Descrição', 'Qtd', 'Unid.', 'Valor unit.', 'Total']],
      body: materiais.map(i => [
        i.nome || '—', String(i.quantidade ?? ''), i.unidade || '—',
        formatMoney(i.valor_unitario),
        formatMoney(i.quantidade * i.valor_unitario - i.desconto),
      ]),
      styles: { fontSize: 9, cellPadding: 3, textColor: INK, lineColor: [225, 227, 231], lineWidth: 0.2 },
      headStyles: { fillColor: GRAPHITE, textColor: ACCENT, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: CARD_BG },
      columnStyles: { 1: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable anexa lastAutoTable ao doc
    y = doc.lastAutoTable.finalY + 8;
  }

  y = checkPageBreak(y, 34);
  y = drawTotalBox(y);
  y += 8;

  y = checkPageBreak(y, 34);
  y = drawConditionsCard(y);
  y += 8;

  if (budget.observacoes_cliente) {
    y = checkPageBreak(y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text('Observações', margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    const obs = doc.splitTextToSize(budget.observacoes_cliente, contentWidth);
    doc.text(obs, margin, y);
    y += obs.length * 4.5 + 6;
  }

  // Texto institucional obrigatório de fechamento (conformidade NBR 5410) — sempre antes da
  // assinatura.
  y = checkPageBreak(y, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const fechamento = doc.splitTextToSize(TEXTO_FECHAMENTO_ABNT, contentWidth);
  doc.text(fechamento, margin, y);
  y += fechamento.length * 4.4 + 6;

  y = checkPageBreak(y, 14);
  y = drawSloganBar(y);
  y += 8;

  y = checkPageBreak(y, 40);
  y = drawSignatureBlock(y);

  // Rodapé discreto e padronizado em TODAS as páginas, não só na última — orçamentos com
  // múltiplas páginas (muitos itens) antes ficavam sem identificação da empresa nas páginas
  // anteriores à final.
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    drawFooter();
  }

  return doc;

  // ----- Blocos auxiliares -----

  function checkPageBreak(cursor: number, needed: number): number {
    if (cursor + needed > pageHeight - 26) {
      doc.addPage();
      return 20;
    }
    return cursor;
  }

  function drawHeader() {
    doc.setFillColor(...GRAPHITE);
    doc.rect(0, 0, pageWidth, 52, 'F');

    // Selo/símbolo
    const badgeX = margin + 9;
    const badgeY = 17;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.1);
    doc.circle(badgeX, badgeY, 9, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...WHITE);
    doc.text('C', badgeX, badgeY + 4.3, { align: 'center' });
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.4);
    doc.line(badgeX - 4, badgeY + 2, badgeX + 4, badgeY - 5);

    const nameX = margin + 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text('CONDUTOR', nameX, 15);
    const w1 = doc.getTextWidth('CONDUTOR ');
    doc.setTextColor(...ACCENT);
    doc.text('ELÉTRICO', nameX + w1, 15);
    const w2 = doc.getTextWidth('ELÉTRICO ');
    doc.setTextColor(...WHITE);
    doc.text('BRASIL', nameX + w1 + w2, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(org.experiencia || 'Soluções elétricas com segurança e qualidade técnica.', nameX, 21, { maxWidth: 110 });

    // Selo do orçamento (canto superior direito)
    const pillW = 62;
    const pillX = pageWidth - margin - pillW;
    doc.setFillColor(...ACCENT);
    doc.roundedRect(pillX, 9, pillW, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAPHITE);
    doc.text(`ORÇAMENTO Nº ${budget.numero}`, pillX + pillW / 2, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(`Emitido em ${formatDate(budget.data_emissao)}`, pageWidth - margin, 25, { align: 'right' });
    doc.text(`Válido até ${formatDate(addDays(budget.data_emissao, budget.validade_dias))}`, pageWidth - margin, 30, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...ACCENT);
    doc.text(SLOGAN, pageWidth - margin, 42, { align: 'right' });

    doc.setFillColor(...ACCENT);
    doc.rect(0, 52, pageWidth, 2, 'F');
  }

  function drawInfoCard(startY: number): number {
    const cardPad = 6;
    const rows = [
      ['Cliente', client.nome],
      ['Local do serviço', budget.local_servico || '—'],
      ['Responsável', budget.responsavel],
      ['Prazo estimado', budget.prazo_estimado || 'A combinar'],
    ];
    const lineHeight = 5.6;
    const cardHeight = rows.length * lineHeight + cardPad * 2 - 2;

    doc.setFillColor(...CARD_BG);
    doc.roundedRect(margin, startY, contentWidth, cardHeight, 2.5, 2.5, 'F');
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1);
    doc.line(margin, startY, margin, startY + cardHeight);

    let ry = startY + cardPad + 2;
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(String(label).toUpperCase(), margin + cardPad, ry);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(String(value), margin + 52, ry);
      ry += lineHeight;
    });

    return startY + cardHeight;
  }

  function sectionLabel(label: string, startY: number): number {
    doc.setFillColor(...ACCENT);
    doc.rect(margin, startY - 3.6, 3, 4.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(label, margin + 5, startY);
    return startY + 5;
  }

  function drawTotalBox(startY: number): number {
    const boxHeight = 22;
    doc.setFillColor(...ACCENT);
    doc.roundedRect(margin, startY, contentWidth, boxHeight, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRAPHITE);
    doc.text('VALOR TOTAL DO ORÇAMENTO', margin + 7, startY + 9);
    doc.setFontSize(17);
    doc.text(formatMoney(totals.totalVenda), margin + 7, startY + 17.5);

    const rightX = margin + contentWidth - 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (budget.entrada > 0) {
      doc.text(`Entrada: ${formatMoney(budget.entrada)}`, rightX, startY + 9, { align: 'right' });
      doc.text(`Saldo: ${formatMoney(totals.saldoRestante)}`, rightX, startY + 14.5, { align: 'right' });
    }
    if (budget.parcelas > 1) {
      doc.text(`${budget.parcelas}x de ${formatMoney(totals.valorParcela)}`, rightX, startY + (budget.entrada > 0 ? 20 : 12), { align: 'right' });
    }
    return startY + boxHeight;
  }

  function drawConditionsCard(startY: number): number {
    const cardPad = 6;
    const rows = [
      ['Forma de pagamento', formaPagamentoLabel(budget.forma_pagamento)],
      ['Garantia', budget.garantia],
      ['Validade da proposta', `${budget.validade_dias} dias a partir da emissão`],
    ];
    const lineHeight = 5.6;
    const cardHeight = rows.length * lineHeight + cardPad * 2 - 2;

    doc.setFillColor(...CARD_BG);
    doc.roundedRect(margin, startY, contentWidth, cardHeight, 2.5, 2.5, 'F');

    let ry = startY + cardPad + 2;
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(String(label).toUpperCase(), margin + cardPad, ry);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(String(value), margin + 62, ry);
      ry += lineHeight;
    });

    return startY + cardHeight;
  }

  function drawSloganBar(startY: number): number {
    const barHeight = 12;
    doc.setFillColor(...GRAPHITE_SOFT);
    doc.roundedRect(margin, startY, contentWidth, barHeight, 2, 2, 'F');
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(10.5);
    doc.setTextColor(...ACCENT);
    doc.text(SLOGAN, pageWidth / 2, startY + barHeight / 2 + 1.5, { align: 'center' });
    return startY + barHeight;
  }

  function drawSignatureBlock(startY: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('Aceite eletrônico', margin, startY);
    startY += 4;
    doc.setDrawColor(...ACCENT_DEEP);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, startY, contentWidth, 30, 2.5, 2.5, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(
      'Ao assinar, você declara estar de acordo com o escopo, os valores e as condições descritas nesta proposta.',
      margin + 6, startY + 7, { maxWidth: contentWidth - 12 },
    );

    doc.setTextColor(...INK);
    doc.setFontSize(9);
    doc.text('Nome: ______________________________________', margin + 6, startY + 17);
    doc.text('Documento: ____________________________', margin + 6, startY + 24);
    doc.text('Data: ____/____/______', margin + contentWidth - 60, startY + 17);
    doc.text('Assinatura: ___________________', margin + contentWidth - 60, startY + 24);

    return startY + 30;
  }

  function drawFooter() {
    // Endereço completo, montado a partir dos campos da organização (nunca fixo no código) —
    // some silenciosamente as partes que ainda não foram preenchidas em Configurações.
    const enderecoCompleto = [org.endereco, org.cidade && org.estado ? `${org.cidade} - ${org.estado}` : (org.cidade || org.estado)]
      .filter(Boolean).join(' • ');

    const footerHeight = enderecoCompleto ? 24 : 20;
    const footerY = pageHeight - footerHeight;
    doc.setFillColor(...GRAPHITE);
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');
    doc.setFillColor(...ACCENT);
    doc.rect(0, footerY, pageWidth, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(org.responsavel || 'Condutor Elétrico Brasil', margin, footerY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(`Contato: ${org.telefone || '—'}${org.email ? `  •  ${org.email}` : ''}`, margin, footerY + 13.5);
    if (enderecoCompleto) {
      doc.setFontSize(7.5);
      doc.setTextColor(160, 165, 175);
      doc.text(enderecoCompleto, margin, footerY + 19);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ACCENT);
    doc.text((org.nome_fantasia || 'Condutor Elétrico Brasil').toUpperCase(), pageWidth - margin, footerY + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 165, 175);
    doc.text(org.documento ? `CNPJ ${org.documento}` : 'Energia com padrão profissional.', pageWidth - margin, footerY + 13.5, { align: 'right' });
  }
}

function formaPagamentoLabel(fp: Budget['forma_pagamento']): string {
  const map: Record<Budget['forma_pagamento'], string> = {
    pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência bancária', boleto: 'Boleto',
    debito: 'Cartão de débito', credito: 'Cartão de crédito', entrada_parcelas: 'Entrada + parcelas', a_combinar: 'A combinar',
  };
  return map[fp];
}

// Gera o PDF profissional do RECIBO — emitido ao finalizar um serviço (ORÇAMENTO -> APROVADO ->
// AGENDADO -> EXECUÇÃO -> FINALIZADO -> EMITIR RECIBO). Reaproveita a mesma identidade visual
// azul/ciano do orçamento (mesma paleta, mesmo estilo de cabeçalho/rodapé) para consistência.
export function generateReceiptPdf(receipt: Receipt, org: Organization): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  drawHeader();
  let y = 66;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('RECIBO DE PAGAMENTO', margin, y);
  y += 10;

  // Caixa de destaque com o valor recebido — mesmo estilo do "valor total" do orçamento.
  const boxHeight = 22;
  doc.setFillColor(...ACCENT);
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRAPHITE);
  doc.text('VALOR RECEBIDO', margin + 7, y + 9);
  doc.setFontSize(17);
  doc.text(formatMoney(receipt.valor_recebido), margin + 7, y + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Data: ${formatDate(receipt.data)}`, margin + contentWidth - 7, y + 9, { align: 'right' });
  if (receipt.forma_pagamento) {
    doc.text(formaPagamentoLabel(receipt.forma_pagamento), margin + contentWidth - 7, y + 14.5, { align: 'right' });
  }
  y += boxHeight + 10;

  // Parágrafo obrigatório: "Recebemos de ..., a importância de R$ X (X por extenso), referente a ...".
  const documentoTexto = receipt.cliente_documento ? `, CPF/CNPJ ${receipt.cliente_documento}` : '';
  const enderecoTexto = receipt.cliente_endereco ? `, residente/estabelecido em ${receipt.cliente_endereco}` : '';
  const paragrafo = `Recebemos de ${receipt.cliente_nome}${documentoTexto}${enderecoTexto}, a importância de `
    + `${formatMoney(receipt.valor_recebido)} (${valorPorExtenso(receipt.valor_recebido)}), referente a: ${receipt.descricao}.`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const linhasParagrafo = doc.splitTextToSize(paragrafo, contentWidth);
  doc.text(linhasParagrafo, margin, y);
  y += linhasParagrafo.length * 5.6 + 10;

  y = drawDetailsCard(y);
  y += 12;

  y = checkPageBreak(y, 40);
  y = drawSignatureBlock(y);

  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    drawFooter();
  }

  return doc;

  // ----- Blocos auxiliares (mesmo padrão visual do orçamento) -----

  function checkPageBreak(cursor: number, needed: number): number {
    if (cursor + needed > pageHeight - 26) {
      doc.addPage();
      return 20;
    }
    return cursor;
  }

  function drawHeader() {
    doc.setFillColor(...GRAPHITE);
    doc.rect(0, 0, pageWidth, 52, 'F');

    const badgeX = margin + 9;
    const badgeY = 17;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.1);
    doc.circle(badgeX, badgeY, 9, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...WHITE);
    doc.text('C', badgeX, badgeY + 4.3, { align: 'center' });
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.4);
    doc.line(badgeX - 4, badgeY + 2, badgeX + 4, badgeY - 5);

    const nameX = margin + 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text('CONDUTOR', nameX, 15);
    const w1 = doc.getTextWidth('CONDUTOR ');
    doc.setTextColor(...ACCENT);
    doc.text('ELÉTRICO', nameX + w1, 15);
    const w2 = doc.getTextWidth('ELÉTRICO ');
    doc.setTextColor(...WHITE);
    doc.text('BRASIL', nameX + w1 + w2, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(org.experiencia || 'Soluções elétricas com segurança e qualidade técnica.', nameX, 21, { maxWidth: 110 });

    const pillW = 62;
    const pillX = pageWidth - margin - pillW;
    doc.setFillColor(...ACCENT);
    doc.roundedRect(pillX, 9, pillW, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRAPHITE);
    doc.text(`RECIBO Nº ${receipt.numero}`, pillX + pillW / 2, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(`Emitido em ${formatDate(receipt.data)}`, pageWidth - margin, 25, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...ACCENT);
    doc.text(SLOGAN, pageWidth - margin, 42, { align: 'right' });

    doc.setFillColor(...ACCENT);
    doc.rect(0, 52, pageWidth, 2, 'F');
  }

  function drawDetailsCard(startY: number): number {
    const cardPad = 6;
    const rows: [string, string][] = [
      ['Cliente', receipt.cliente_nome],
      ...(receipt.cliente_documento ? [['CPF/CNPJ', receipt.cliente_documento] as [string, string]] : []),
      ...(receipt.cliente_telefone ? [['Telefone', receipt.cliente_telefone] as [string, string]] : []),
      ['Forma de pagamento', receipt.forma_pagamento ? formaPagamentoLabel(receipt.forma_pagamento) : 'A combinar'],
      ['Responsável', receipt.responsavel || org.responsavel || '—'],
    ];
    const lineHeight = 5.6;
    const cardHeight = rows.length * lineHeight + cardPad * 2 - 2;

    doc.setFillColor(...CARD_BG);
    doc.roundedRect(margin, startY, contentWidth, cardHeight, 2.5, 2.5, 'F');
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1);
    doc.line(margin, startY, margin, startY + cardHeight);

    let ry = startY + cardPad + 2;
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(String(label).toUpperCase(), margin + cardPad, ry);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(String(value), margin + 52, ry);
      ry += lineHeight;
    });

    return startY + cardHeight;
  }

  function drawSignatureBlock(startY: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('Assinatura', margin, startY);
    startY += 4;
    doc.setDrawColor(...ACCENT_DEEP);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, startY, contentWidth, 30, 2.5, 2.5, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(
      'Este recibo confirma o recebimento do valor acima descrito, dando plena quitação referente ao serviço prestado.',
      margin + 6, startY + 7, { maxWidth: contentWidth - 12 },
    );

    doc.setTextColor(...INK);
    doc.setFontSize(9);
    doc.text(`Recibo emitido por: ${receipt.responsavel || org.responsavel || '______________________'}`, margin + 6, startY + 17);
    doc.text('Assinatura: ___________________________', margin + 6, startY + 24);
    doc.text('Data: ____/____/______', margin + contentWidth - 60, startY + 17);

    return startY + 30;
  }

  function drawFooter() {
    const enderecoCompleto = [org.endereco, org.cidade && org.estado ? `${org.cidade} - ${org.estado}` : (org.cidade || org.estado)]
      .filter(Boolean).join(' • ');

    const footerHeight = enderecoCompleto ? 24 : 20;
    const footerY = pageHeight - footerHeight;
    doc.setFillColor(...GRAPHITE);
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');
    doc.setFillColor(...ACCENT);
    doc.rect(0, footerY, pageWidth, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(org.responsavel || 'Condutor Elétrico Brasil', margin, footerY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(`Contato: ${org.telefone || '—'}${org.email ? `  •  ${org.email}` : ''}`, margin, footerY + 13.5);
    if (enderecoCompleto) {
      doc.setFontSize(7.5);
      doc.setTextColor(160, 165, 175);
      doc.text(enderecoCompleto, margin, footerY + 19);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ACCENT);
    doc.text((org.nome_fantasia || 'Condutor Elétrico Brasil').toUpperCase(), pageWidth - margin, footerY + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 165, 175);
    doc.text(org.documento ? `CNPJ ${org.documento}` : 'Energia com padrão profissional.', pageWidth - margin, footerY + 13.5, { align: 'right' });
  }
}
