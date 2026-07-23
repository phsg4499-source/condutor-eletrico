import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Budget, Client, Organization } from '../types';
import { calculateBudget } from './calculations';
import { formatMoney, formatDate, addDays } from './format';

// Gera o PDF profissional do orçamento para o CLIENTE.
// Nunca inclui custo, margem, lucro ou observações internas.
export function generateBudgetPdf(budget: Budget, client: Client, org: Organization): jsPDF {
  const doc = new jsPDF();
  const totals = calculateBudget(budget);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Cabeçalho
  doc.setFillColor(22, 24, 29);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CONDUTOR', margin, 14);
  doc.setTextColor(245, 197, 24);
  doc.text('ELÉTRICO', margin + 32, 14);
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal');
  doc.text(org.experiencia, margin, 21);
  doc.text(`Orçamento nº ${budget.numero}`, pageWidth - margin, 14, { align: 'right' });
  doc.text(`Emitido em ${formatDate(budget.data_emissao)}`, pageWidth - margin, 21, { align: 'right' });
  doc.text(`Válido até ${formatDate(addDays(budget.data_emissao, budget.validade_dias))}`, pageWidth - margin, 27, { align: 'right' });

  let y = 42;
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(budget.titulo, margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Cliente: ${client.nome}`, margin, y); y += 5;
  doc.text(`Local do serviço: ${budget.local_servico}`, margin, y); y += 5;
  doc.text(`Responsável: ${budget.responsavel}`, margin, y); y += 5;
  if (budget.prazo_estimado) { doc.text(`Prazo estimado: ${budget.prazo_estimado}`, margin, y); y += 5; }
  y += 3;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  const apresentacao = doc.splitTextToSize(
    `Agradecemos a oportunidade de apresentar esta proposta. A ${org.nome_fantasia} atua há mais de 10 anos oferecendo soluções elétricas com segurança, organização e qualidade técnica.`,
    pageWidth - margin * 2,
  );
  doc.text(apresentacao, margin, y);
  y += apresentacao.length * 4.5 + 4;

  const servicos = budget.itens.filter(i => i.tipo === 'servico');
  const materiais = budget.itens.filter(i => i.tipo === 'material');

  if (servicos.length) {
    autoTable(doc, {
      startY: y,
      head: [['Serviço', 'Qtd', 'Unid.', 'Valor unit.', 'Total']],
      body: servicos.map(i => [
        i.nome, String(i.quantidade), i.unidade,
        formatMoney(i.valor_unitario),
        formatMoney(i.quantidade * i.valor_unitario - i.desconto),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 24, 29] },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable anexa lastAutoTable ao doc
    y = doc.lastAutoTable.finalY + 6;
  }

  if (materiais.length) {
    autoTable(doc, {
      startY: y,
      head: [['Material', 'Qtd', 'Unid.', 'Valor unit.', 'Total']],
      body: materiais.map(i => [
        i.nome, String(i.quantidade), i.unidade,
        formatMoney(i.valor_unitario),
        formatMoney(i.quantidade * i.valor_unitario - i.desconto),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 24, 29] },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error autoTable anexa lastAutoTable ao doc
    y = doc.lastAutoTable.finalY + 6;
  }

  if (y > 250) { doc.addPage(); y = 20; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Valor total: ${formatMoney(totals.totalVenda)}`, margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Forma de pagamento: ${formaPagamentoLabel(budget.forma_pagamento)}`, margin, y); y += 5;
  if (budget.entrada > 0) { doc.text(`Entrada: ${formatMoney(budget.entrada)}  |  Saldo: ${formatMoney(totals.saldoRestante)}`, margin, y); y += 5; }
  if (budget.parcelas > 1) { doc.text(`Parcelamento: ${budget.parcelas}x de ${formatMoney(totals.valorParcela)}`, margin, y); y += 5; }
  doc.text(`Garantia: ${budget.garantia}`, margin, y); y += 5;
  doc.text(`Validade da proposta: ${budget.validade_dias} dias a partir da emissão`, margin, y); y += 8;

  if (budget.observacoes_cliente) {
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    const obs = doc.splitTextToSize(budget.observacoes_cliente, pageWidth - margin * 2);
    doc.text(obs, margin, y);
    y += obs.length * 4.5 + 4;
  }

  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Aceite eletrônico', margin, y); y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Nome: ______________________________     Documento: ______________________', margin, y); y += 8;
  doc.text('Data: ____/____/______     Assinatura: ______________________________', margin, y); y += 10;

  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `${org.responsavel}  |  ${org.telefone}  |  Instagram ${org.instagram}  |  ${org.email}`,
    margin, 285,
  );

  return doc;
}

function formaPagamentoLabel(fp: Budget['forma_pagamento']): string {
  const map: Record<Budget['forma_pagamento'], string> = {
    pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência bancária', boleto: 'Boleto',
    debito: 'Cartão de débito', credito: 'Cartão de crédito', entrada_parcelas: 'Entrada + parcelas', a_combinar: 'A combinar',
  };
  return map[fp];
}
