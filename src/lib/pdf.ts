import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Budget, Organization } from '../types';
import { calculateBudget } from './calculations';
import { formatMoney, formatDate, addDays } from './format';

// Gera o PDF profissional do orçamento para o CLIENTE.
// Nunca inclui custo, margem, lucro ou observações internas.
// Identidade visual: grafite profundo + amarelo elétrico, tipografia forte, blocos editoriais.

const GRAPHITE: [number, number, number] = [16, 18, 21];
const GRAPHITE_SOFT: [number, number, number] = [33, 36, 43];
const ACCENT: [number, number, number] = [245, 197, 24];
const ACCENT_DEEP: [number, number, number] = [201, 152, 5];
const INK: [number, number, number] = [24, 26, 31];
const MUTED: [number, number, number] = [110, 116, 128];
const CARD_BG: [number, number, number] = [245, 246, 248];
const WHITE: [number, number, number] = [255, 255, 255];

const SLOGAN = 'Você chama, a Condutor resolve.';

export function generateBudgetPdf(budget: Budget, client: { nome: string }, org: Organization): jsPDF {
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

  // Apresentação
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  const apresentacao = doc.splitTextToSize(
    `Agradecemos a oportunidade de apresentar esta proposta. A ${org.nome_fantasia} atua há mais de 10 anos oferecendo soluções elétricas com segurança, organização e qualidade técnica.`,
    contentWidth,
  );
  doc.text(apresentacao, margin, y);
  y += apresentacao.length * 4.6 + 6;

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

  y = checkPageBreak(y, 14);
  y = drawSloganBar(y);
  y += 8;

  y = checkPageBreak(y, 40);
  y = drawSignatureBlock(y);

  drawFooter();

  return doc;

  // ----- Blocos auxiliares -----

  function checkPageBreak(cursor: number, needed: number): number {
    if (cursor + needed > pageHeight - 22) {
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
    doc.setFontSize(15);
    doc.setTextColor(...WHITE);
    doc.text('CONDUTOR', nameX, 15);
    const w1 = doc.getTextWidth('CONDUTOR ');
    doc.setTextColor(...ACCENT);
    doc.text('ELÉTRICO', nameX + w1, 15);
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
    const footerHeight = 20;
    const footerY = pageHeight - footerHeight;
    doc.setFillColor(...GRAPHITE);
    doc.rect(0, footerY, pageWidth, footerHeight, 'F');
    doc.setFillColor(...ACCENT);
    doc.rect(0, footerY, pageWidth, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(org.responsavel || 'Condutor Elétrico', margin, footerY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 194, 202);
    doc.text(`${org.telefone}  •  Instagram ${org.instagram}  •  ${org.email}`, margin, footerY + 13.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ACCENT);
    doc.text((org.nome_fantasia || 'Condutor Elétrico').toUpperCase(), pageWidth - margin, footerY + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 165, 175);
    doc.text('Energia com padrão profissional.', pageWidth - margin, footerY + 13.5, { align: 'right' });
  }
}

function formaPagamentoLabel(fp: Budget['forma_pagamento']): string {
  const map: Record<Budget['forma_pagamento'], string> = {
    pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência bancária', boleto: 'Boleto',
    debito: 'Cartão de débito', credito: 'Cartão de crédito', entrada_parcelas: 'Entrada + parcelas', a_combinar: 'A combinar',
  };
  return map[fp];
}
