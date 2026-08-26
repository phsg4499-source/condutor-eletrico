import type { Budget } from '../types';

export interface BudgetTotals {
  subtotalMateriais: number;
  subtotalServicos: number;
  subtotalCustoMateriais: number;
  subtotalCustoServicos: number;
  subtotalCustosExtras: number;
  totalCusto: number;
  totalVendaBruto: number; // antes do desconto geral
  descontoGeral: number;
  totalVenda: number; // valor final para o cliente
  lucroBruto: number;
  margemPercentual: number;
  valorEntrada: number;
  saldoRestante: number;
  valorParcela: number;
}

export function calculateBudget(budget: Pick<Budget, 'itens' | 'custos_extras' | 'desconto_percentual' | 'desconto_valor' | 'entrada' | 'parcelas' | 'proposta_detalhada'>): BudgetTotals {
  // Proposta técnica completa: o preço é sempre um valor global informado pelo orçamentista,
  // nunca a soma de itens com valor unitário. Não há controle de custo/margem nesse formato —
  // totalCusto acompanha totalVenda para nunca aparecer como "lucro" indevido no Dashboard/Relatórios.
  if (budget.proposta_detalhada) {
    const totalVenda = Math.max(0, budget.proposta_detalhada.valores.valor_total || 0);
    const valorEntrada = budget.entrada || 0;
    const saldoRestante = Math.max(0, totalVenda - valorEntrada);
    const valorParcela = budget.parcelas > 0 ? saldoRestante / budget.parcelas : saldoRestante;
    return {
      subtotalMateriais: 0, subtotalServicos: 0, subtotalCustoMateriais: 0, subtotalCustoServicos: 0,
      subtotalCustosExtras: 0, totalCusto: totalVenda, totalVendaBruto: totalVenda, descontoGeral: 0,
      totalVenda, lucroBruto: 0, margemPercentual: 0, valorEntrada, saldoRestante, valorParcela,
    };
  }

  const servicos = budget.itens.filter(i => i.tipo === 'servico');
  const materiais = budget.itens.filter(i => i.tipo === 'material');

  const sum = (items: typeof servicos, field: 'custo_unitario' | 'valor_unitario') =>
    items.reduce((acc, i) => acc + i.quantidade * i[field] - (field === 'valor_unitario' ? i.desconto : 0), 0);

  const subtotalServicos = sum(servicos, 'valor_unitario');
  const subtotalMateriais = sum(materiais, 'valor_unitario');
  const subtotalCustoServicos = sum(servicos, 'custo_unitario');
  const subtotalCustoMateriais = sum(materiais, 'custo_unitario');
  const subtotalCustosExtras = budget.custos_extras.reduce((acc, c) => acc + c.valor, 0);

  const totalVendaBruto = subtotalServicos + subtotalMateriais + subtotalCustosExtras;
  const totalCusto = subtotalCustoServicos + subtotalCustoMateriais + subtotalCustosExtras;

  const descontoPercentualValor = totalVendaBruto * (budget.desconto_percentual / 100);
  const descontoGeral = descontoPercentualValor + budget.desconto_valor;
  const totalVenda = Math.max(0, totalVendaBruto - descontoGeral);

  const lucroBruto = totalVenda - totalCusto;
  const margemPercentual = totalVenda > 0 ? (lucroBruto / totalVenda) * 100 : 0;

  const valorEntrada = budget.entrada || 0;
  const saldoRestante = Math.max(0, totalVenda - valorEntrada);
  const valorParcela = budget.parcelas > 0 ? saldoRestante / budget.parcelas : saldoRestante;

  return {
    subtotalMateriais, subtotalServicos, subtotalCustoMateriais, subtotalCustoServicos,
    subtotalCustosExtras, totalCusto, totalVendaBruto, descontoGeral, totalVenda,
    lucroBruto, margemPercentual, valorEntrada, saldoRestante, valorParcela,
  };
}

export function budgetAlerts(
  budget: Pick<Budget, 'itens' | 'prazo_estimado' | 'forma_pagamento' | 'proposta_detalhada'>,
  totals: BudgetTotals,
  margemMinima = 15,
): string[] {
  const alerts: string[] = [];

  if (budget.proposta_detalhada) {
    // Proposta técnica completa: sem itens com preço unitário nem controle de margem — os
    // alertas relevantes aqui são outros (cobertos na Revisão do próprio formulário, que já
    // reaproveita esta função para os campos em comum: prazo e forma de pagamento).
    if (!totals.totalVenda) alerts.push('Valor total do orçamento ainda não foi preenchido.');
    if (!budget.prazo_estimado) alerts.push('Orçamento sem prazo estimado definido.');
    if (!budget.forma_pagamento) alerts.push('Orçamento sem condição de pagamento definida.');
    return alerts;
  }

  if (totals.totalVenda < totals.totalCusto) alerts.push('O valor de venda está abaixo do custo total.');
  if (totals.margemPercentual < margemMinima && totals.totalVenda > 0) alerts.push(`Margem de lucro abaixo do mínimo configurado (${margemMinima}%).`);
  if (budget.itens.some(i => i.valor_unitario <= 0)) alerts.push('Existem itens sem preço definido.');
  if (!budget.prazo_estimado) alerts.push('Orçamento sem prazo estimado definido.');
  if (!budget.forma_pagamento) alerts.push('Orçamento sem condição de pagamento definida.');
  return alerts;
}
