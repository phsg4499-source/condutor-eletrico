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

export function calculateBudget(budget: Pick<Budget, 'itens' | 'custos_extras' | 'desconto_percentual' | 'desconto_valor' | 'entrada' | 'parcelas'>): BudgetTotals {
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
  budget: Pick<Budget, 'itens' | 'prazo_estimado' | 'forma_pagamento'>,
  totals: BudgetTotals,
  margemMinima = 15,
): string[] {
  const alerts: string[] = [];
  if (totals.totalVenda < totals.totalCusto) alerts.push('O valor de venda está abaixo do custo total.');
  if (totals.margemPercentual < margemMinima && totals.totalVenda > 0) alerts.push(`Margem de lucro abaixo do mínimo configurado (${margemMinima}%).`);
  if (budget.itens.some(i => i.valor_unitario <= 0)) alerts.push('Existem itens sem preço definido.');
  if (!budget.prazo_estimado) alerts.push('Orçamento sem prazo estimado definido.');
  if (!budget.forma_pagamento) alerts.push('Orçamento sem condição de pagamento definida.');
  return alerts;
}
