import jsPDF from 'jspdf';
import type { Budget, Organization } from '../types';
import { calculateBudget } from './calculations';
import { formatMoney, formatDate, addDays } from './format';
import { parseHtmlToBlocks, drawRichBlocks } from './richTextPdf';

// Gera o PDF da "Proposta técnica completa" — o segundo formato de orçamento, mais elaborado
// (laudo técnico, ambientes/atividades, escopo detalhado, valores e condições). Usa exatamente a
// mesma identidade visual azul/ciano do orçamento simples (src/lib/pdf.ts), mas com uma estrutura
// de seções própria, feita para caber tanto uma proposta curta quanto uma de várias páginas.
// Nunca desenha "valor unitário" em lugar nenhum — o preço é sempre o valor global informado em
// proposta_detalhada.valores.

const GRAPHITE: [number, number, number] = [0, 45, 74];
const GRAPHITE_SOFT: [number, number, number] = [0, 105, 168];
const ACCENT: [number, number, number] = [0, 180, 229];
const ACCENT_DEEP: [number, number, number] = [0, 154, 209];
const INK: [number, number, number] = [24, 26, 31];
const MUTED: [number, number, number] = [110, 116, 128];
const CARD_BG: [number, number, number] = [245, 246, 248];
const WHITE: [number, number, number] = [255, 255, 255];

const SLOGAN = 'Você chama, a Condutor resolve.';

const UNIDADE_PRAZO_LABEL: Record<string, string> = {
  dias_uteis: 'dias úteis', dias_corridos: 'dias corridos', semanas: 'semanas', meses: 'meses',
};

export function generateTechnicalProposalPdf(budget: Budget, client: { nome: string }, org: Organization): jsPDF {
  const detalhes = budget.proposta_detalhada;
  if (!detalhes) throw new Error('Este orçamento não é uma proposta técnica completa.');

  const doc = new jsPDF();
  const totals = calculateBudget(budget);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  drawHeader();
  let y = 64;

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const tituloLines = doc.splitTextToSize(budget.titulo || 'Proposta técnica', contentWidth);
  doc.text(tituloLines, margin, y);
  y += tituloLines.length * 6.5 + 4;

  y = drawKeyValueCard(y, buildInfoRows(), { accentBar: true });
  y += 7;

  y = richSection('Apresentação', detalhes.apresentacao_html);
  y = richSection('Laudo técnico / diagnóstico', detalhes.laudo_html);
  y = drawAmbientes(y);
  y = drawEscopo(y);
  y = drawServicosIncluidos(y);

  y = checkPageBreak(y, 34);
  y = drawValorBox(y);
  y += 8;

  y = checkPageBreak(y, 34);
  y = drawKeyValueCard(y, buildPrazosRows(), { accentBar: false, title: 'Prazos e garantias' });
  y += 8;

  y = drawEncerramento(y);

  y = checkPageBreak(y, 14);
  y = drawSloganBar(y);
  y += 8;

  if (detalhes.encerramento.aceite_ativo) {
    y = checkPageBreak(y, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(`${detalhes.cidade_encerramento || org.cidade || 'Local'}, ${formatDate(budget.data_emissao)}.`, margin, y);
    y += 8;
    y = drawSignatureBlock(y);
  }

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

  function buildInfoRows(): [string, string][] {
    const rows: [string, string][] = [['Cliente', client.nome]];
    if (budget.local_servico) rows.push(['Local do serviço', budget.local_servico]);
    if (detalhes!.cliente.contato_nome) rows.push(['Contato', detalhes!.cliente.contato_nome]);
    rows.push(['Responsável', budget.responsavel]);
    if (budget.tipo_servico) rows.push(['Tipo de serviço', budget.tipo_servico]);
    if (budget.prazo_estimado) rows.push(['Prazo estimado', budget.prazo_estimado]);
    if (detalhes!.cliente.info_complementar_imovel) rows.push(['Imóvel/empreendimento', detalhes!.cliente.info_complementar_imovel]);
    return rows;
  }

  function buildPrazosRows(): [string, string][] {
    const rows: [string, string][] = [];
    const p = detalhes!.prazos;
    if (p.inicio.valor) rows.push(['Prazo para início', `${p.inicio.valor} ${UNIDADE_PRAZO_LABEL[p.inicio.unidade ?? 'dias_corridos']}`]);
    if (p.execucao.valor) rows.push(['Prazo de execução', `${p.execucao.valor} ${UNIDADE_PRAZO_LABEL[p.execucao.unidade ?? 'dias_corridos']}`]);
    if (p.condicao_cronograma) rows.push(['Condição do cronograma', p.condicao_cronograma]);
    if (budget.garantia) rows.push(['Garantia da mão de obra', budget.garantia]);
    if (p.garantia_materiais) rows.push(['Garantia dos materiais', p.garantia_materiais]);
    if (p.garantia_observacoes) rows.push(['Observações sobre a garantia', p.garantia_observacoes]);
    if (p.norma_aplicavel) rows.push(['Norma/legislação aplicável', p.norma_aplicavel]);
    rows.push(['Validade da proposta', `${budget.validade_dias} dias a partir da emissão`]);
    return rows;
  }

  function drawKeyValueCard(startY: number, rows: [string, string][], opts: { accentBar?: boolean; title?: string }): number {
    if (rows.length === 0) return startY;
    let y2 = startY;
    if (opts.title) {
      y2 = sectionLabel(opts.title, y2);
      y2 += 2;
    }
    const cardPad = 6;
    const lineHeight = 5.6;
    // Largura da coluna de rótulo calculada a partir do maior rótulo real (em vez de um valor
    // fixo) — rótulos longos como "NORMA/LEGISLAÇÃO APLICÁVEL" senão se sobrepunham ao valor.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const maiorLabelWidth = rows.reduce((max, [label]) => Math.max(max, doc.getTextWidth(label.toUpperCase())), 0);
    const labelColWidth = Math.min(Math.max(maiorLabelWidth + 8, 40), contentWidth - cardPad * 2 - 30);
    const valueMaxWidth = contentWidth - cardPad * 2 - labelColWidth;
    const wrapped = rows.map(([label, value]) => ({ label, lines: doc.splitTextToSize(String(value), valueMaxWidth) as string[] }));
    const cardHeight = wrapped.reduce((acc, r) => acc + Math.max(1, r.lines.length) * lineHeight, 0) + cardPad * 2 - 2;

    y2 = checkPageBreak(y2, cardHeight + 4);
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(margin, y2, contentWidth, cardHeight, 2.5, 2.5, 'F');
    if (opts.accentBar) {
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(1);
      doc.line(margin, y2, margin, y2 + cardHeight);
    }

    let ry = y2 + cardPad + 2;
    wrapped.forEach(({ label, lines }) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), margin + cardPad, ry);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(lines, margin + labelColWidth, ry);
      ry += Math.max(1, lines.length) * lineHeight;
    });

    return y2 + cardHeight;
  }

  function sectionLabel(label: string, startY: number): number {
    const y2 = checkPageBreak(startY, 14);
    doc.setFillColor(...ACCENT);
    doc.rect(margin, y2 - 3.6, 3, 4.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(label, margin + 5, y2);
    return y2 + 5;
  }

  function richSection(title: string, html: string | undefined): number {
    const blocks = parseHtmlToBlocks(html);
    if (blocks.length === 0) return y;
    y = sectionLabel(title, y);
    y = drawRichBlocks(doc, blocks, margin, y, contentWidth, checkPageBreak);
    y += 3;
    return y;
  }

  function drawAmbientes(startY: number): number {
    const ambientes = [...detalhes!.ambientes].sort((a, b) => a.ordem - b.ordem);
    if (ambientes.length === 0) return startY;
    let y2 = sectionLabel('Detalhamento por ambientes', startY);

    ambientes.forEach(ambiente => {
      y2 = checkPageBreak(y2, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...GRAPHITE_SOFT);
      doc.text(ambiente.nome || 'Ambiente', margin, y2);
      y2 += 4.6;
      if (ambiente.descricao) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        const lines = doc.splitTextToSize(ambiente.descricao, contentWidth);
        y2 = checkPageBreak(y2, lines.length * 4.2 + 2);
        doc.text(lines, margin, y2);
        y2 += lines.length * 4.2 + 1;
      }
      const atividades = [...ambiente.atividades].sort((a, b) => a.ordem - b.ordem);
      atividades.forEach(at => {
        const partes = [at.descricao];
        if (at.quantidade) partes.push(`(${at.quantidade}${at.unidade ? ` ${at.unidade}` : ''})`);
        const texto = partes.filter(Boolean).join(' ') + (at.observacao ? ` — ${at.observacao}` : '');
        const lines = doc.splitTextToSize(texto, contentWidth - 5);
        y2 = checkPageBreak(y2, lines.length * 4.4 + 1);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text('•', margin, y2);
        doc.text(lines, margin + 5, y2);
        y2 += lines.length * 4.4;
      });
      y2 += 3;
    });

    if (detalhes!.ambientes_total_label) {
      const total = ambientes.reduce((acc, a) => acc + a.atividades.reduce((s, at) => s + (at.quantidade || 1), 0), 0);
      y2 = checkPageBreak(y2, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...GRAPHITE_SOFT);
      doc.text(`Total aproximado: ${total} ${detalhes!.ambientes_total_label}`, margin, y2);
      y2 += 6;
    }
    return y2;
  }

  function drawEscopo(startY: number): number {
    const e = detalhes!.escopo;
    const principalBlocks = parseHtmlToBlocks(e.descricao_html);
    const hasAnySubBlock = [e.servicos_incluidos_html, e.servicos_nao_incluidos_html, e.premissas_html, e.responsabilidades_cliente_html, e.observacoes_materiais_html].some(Boolean);
    if (principalBlocks.length === 0 && !hasAnySubBlock) return startY;

    let y2 = sectionLabel(e.titulo || 'Escopo principal', startY);
    if (principalBlocks.length > 0) {
      y2 = drawRichBlocks(doc, principalBlocks, margin, y2, contentWidth, checkPageBreak);
      y2 += 2;
    }

    const subSecoes: [string, string | undefined][] = [
      ['Serviços incluídos', e.servicos_incluidos_html],
      ['Serviços não incluídos', e.servicos_nao_incluidos_html],
      ['Premissas técnicas', e.premissas_html],
      ['Responsabilidades do cliente', e.responsabilidades_cliente_html],
      ['Observações sobre materiais', e.observacoes_materiais_html],
    ];
    subSecoes.forEach(([subtitulo, html]) => {
      const blocks = parseHtmlToBlocks(html);
      if (blocks.length === 0) return;
      y2 = checkPageBreak(y2, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...GRAPHITE_SOFT);
      doc.text(subtitulo, margin, y2);
      y2 += 4.6;
      y2 = drawRichBlocks(doc, blocks, margin, y2, contentWidth, checkPageBreak);
      y2 += 1;
    });
    y2 += 2;
    return y2;
  }

  function drawServicosIncluidos(startY: number): number {
    if (budget.itens.length === 0) return startY;
    let y2 = sectionLabel('Relação de serviços', startY);
    budget.itens.forEach(item => {
      const partes = [item.nome];
      if (item.quantidade) partes.push(`(${item.quantidade}${item.unidade ? ` ${item.unidade}` : ''})`);
      const texto = partes.filter(Boolean).join(' ') + (item.descricao ? ` — ${item.descricao}` : '');
      const lines = doc.splitTextToSize(texto, contentWidth - 5);
      y2 = checkPageBreak(y2, lines.length * 4.4 + 1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text('•', margin, y2);
      doc.text(lines, margin + 5, y2);
      y2 += lines.length * 4.4;
    });
    return y2 + 4;
  }

  function drawValorBox(startY: number): number {
    const v = detalhes!.valores;
    const extraLines: string[] = [];
    if (v.a_vista.ativo && v.a_vista.valor) {
      extraLines.push(`À vista: ${formatMoney(v.a_vista.valor)}${v.a_vista.forma_pagamento ? ` via ${v.a_vista.forma_pagamento}` : ''}`);
    }
    if (v.parcelado.ativo && budget.parcelas > 1) {
      extraLines.push(`${budget.parcelas}x de ${formatMoney(totals.valorParcela)}${v.parcelado.juros_info ? ` — ${v.parcelado.juros_info}` : ''}`);
    }
    if (budget.entrada > 0) extraLines.push(`Entrada: ${formatMoney(budget.entrada)} · Saldo: ${formatMoney(totals.saldoRestante)}`);

    const boxHeight = 22 + (extraLines.length > 0 ? 6 : 0);
    let y2 = checkPageBreak(startY, boxHeight + 12);
    doc.setFillColor(...ACCENT);
    doc.roundedRect(margin, y2, contentWidth, boxHeight, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GRAPHITE);
    doc.text('VALOR TOTAL DO ORÇAMENTO', margin + 7, y2 + 9);
    doc.setFontSize(17);
    doc.text(formatMoney(totals.totalVenda), margin + 7, y2 + 17.5);
    if (extraLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(extraLines.join('  •  '), margin + 7, y2 + boxHeight - 3, { maxWidth: contentWidth - 14 });
    }
    y2 += boxHeight + 3;

    if (v.valor_total_extenso) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(`(${v.valor_total_extenso})`, contentWidth);
      y2 = checkPageBreak(y2, lines.length * 4.2 + 2);
      doc.text(lines, margin, y2);
      y2 += lines.length * 4.2 + 2;
    }

    if (v.condicoes_texto) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(v.condicoes_texto, contentWidth);
      y2 = checkPageBreak(y2, lines.length * 4.4 + 2);
      doc.text(lines, margin, y2);
      y2 += lines.length * 4.4 + 2;
    }

    if (v.etapas.length > 0) {
      y2 = checkPageBreak(y2, v.etapas.length * 4.6 + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text('ETAPAS DE PAGAMENTO', margin, y2);
      y2 += 4.6;
      v.etapas.forEach(etapa => {
        const partes = [etapa.descricao];
        if (etapa.valor) partes.push(formatMoney(etapa.valor));
        if (etapa.data) partes.push(formatDate(etapa.data));
        y2 = checkPageBreak(y2, 4.6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text(`• ${partes.filter(Boolean).join(' — ')}`, margin, y2);
        y2 += 4.6;
      });
    }

    return y2;
  }

  function drawEncerramento(startY: number): number {
    const enc = detalhes!.encerramento;
    const agradecimento = parseHtmlToBlocks(enc.agradecimento_html);
    const finais = parseHtmlToBlocks(enc.observacoes_finais_html);
    const avisos: string[] = [];
    if (enc.disponibilidade_esclarecimentos_ativo) avisos.push('Estamos à disposição para esclarecer quaisquer dúvidas sobre esta proposta.');
    if (enc.materiais_separados_ativo) avisos.push('A lista de materiais será apresentada separadamente após a aprovação desta proposta.');
    if (enc.ressalvas_compatibilizacao_ativo) avisos.push('Este escopo pode sofrer ajustes conforme a compatibilização final dos projetos e definições em obra.');

    if (agradecimento.length === 0 && finais.length === 0 && avisos.length === 0) return startY;

    let y2 = sectionLabel('Observações e encerramento', startY);
    if (agradecimento.length > 0) { y2 = drawRichBlocks(doc, agradecimento, margin, y2, contentWidth, checkPageBreak); y2 += 2; }
    avisos.forEach(texto => {
      const lines = doc.splitTextToSize(texto, contentWidth);
      y2 = checkPageBreak(y2, lines.length * 4.4 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(lines, margin, y2);
      y2 += lines.length * 4.4 + 2;
    });
    if (finais.length > 0) y2 = drawRichBlocks(doc, finais, margin, y2, contentWidth, checkPageBreak);
    return y2 + 3;
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
    let y2 = startY;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('Aceite eletrônico', margin, y2);
    y2 += 4;
    doc.setDrawColor(...ACCENT_DEEP);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y2, contentWidth, 30, 2.5, 2.5, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(
      'Ao assinar, você declara estar de acordo com o escopo, os valores e as condições descritas nesta proposta.',
      margin + 6, y2 + 7, { maxWidth: contentWidth - 12 },
    );

    doc.setTextColor(...INK);
    doc.setFontSize(9);
    doc.text('Nome: ______________________________________', margin + 6, y2 + 17);
    doc.text('Documento: ____________________________', margin + 6, y2 + 24);
    doc.text('Data: ____/____/______', margin + contentWidth - 60, y2 + 17);
    doc.text('Assinatura: ___________________', margin + contentWidth - 60, y2 + 24);

    return y2 + 30;
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
