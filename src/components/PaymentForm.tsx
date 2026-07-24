import React, { useState } from 'react';
import { CheckCircle2, Wallet } from 'lucide-react';
import { calculateBudget } from '../lib/calculations';
import { formatMoney, todayISO } from '../lib/format';
import type { Budget, FormaPagamento, Payment, PaymentStatus } from '../types';

export const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' }, { value: 'debito', label: 'Cartão de débito' }, { value: 'credito', label: 'Cartão de crédito' },
  { value: 'entrada_parcelas', label: 'Entrada + parcelas' }, { value: 'a_combinar', label: 'A combinar' },
];

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado', renegociado: 'Renegociado',
};
export const paymentStatusColors: Record<PaymentStatus, string> = {
  pendente: 'bg-blue-600', parcial: 'bg-purple-600', pago: 'bg-emerald-600',
  atrasado: 'bg-red-600', cancelado: 'bg-gray-700', renegociado: 'bg-amber-600',
};

export type PaymentInput = Omit<Payment, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;

export type GrupoFiltroPagamento = 'todos' | 'recebido' | 'a_receber' | 'atrasado';

export const grupoFiltroOptions: { value: GrupoFiltroPagamento; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'a_receber', label: 'A receber' },
  { value: 'atrasado', label: 'Atrasado' },
];

export function paymentMatchesGrupo(status: PaymentStatus, grupo: GrupoFiltroPagamento): boolean {
  if (grupo === 'todos') return true;
  if (grupo === 'recebido') return status === 'pago';
  if (grupo === 'a_receber') return status === 'pendente' || status === 'parcial';
  return status === 'atrasado';
}

/**
 * Status "efetivo" de um pagamento para exibição: se ainda está pendente/parcial mas a data de
 * vencimento já passou, mostramos como "Vencido" mesmo que o registro salvo ainda diga
 * "pendente" — sem precisar de um job/cron no banco para isso. O status salvo não é alterado
 * aqui (fica só na exibição); ações do usuário (marcar recebido, editar) continuam funcionando
 * normalmente sobre o registro original.
 */
export function getEffectivePaymentStatus(payment: Payment): PaymentStatus {
  if ((payment.status === 'pendente' || payment.status === 'parcial') && payment.vencimento) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (payment.vencimento < hoje) return 'atrasado';
  }
  return payment.status;
}

export interface SaldoReconciliacao {
  budget: Budget;
  novoSaldo: number;
  vencimento?: string;
}

/**
 * Mantém um único registro "pendente" por orçamento representando o saldo a receber em
 * sincronia com o módulo Pagamentos. É chamado sempre que um pagamento é registrado contra um
 * orçamento: atualiza o valor do saldo pendente existente (ou cria um, se ainda não houver — por
 * exemplo, orçamentos aprovados antes desta funcionalidade existir), ou remove o registro quando
 * o saldo chega a zero.
 */
export function applySaldoReconciliation(
  payments: Payment[],
  { budget, novoSaldo, vencimento }: SaldoReconciliacao,
  actions: {
    addPayment: (data: PaymentInput) => void;
    updatePayment: (id: string, data: Partial<Payment>) => void;
    deletePayment: (id: string) => void;
  },
) {
  const existente = payments.find(p => p.budget_id === budget.id && p.status === 'pendente');
  if (novoSaldo <= 0) {
    if (existente) actions.deletePayment(existente.id);
    return;
  }
  if (existente) {
    actions.updatePayment(existente.id, { valor: novoSaldo, ...(vencimento ? { vencimento } : {}) });
  } else {
    actions.addPayment({
      client_id: budget.client_id ?? null,
      budget_id: budget.id,
      descricao: `Saldo a receber — orçamento ${budget.numero}`,
      valor: novoSaldo,
      status: 'pendente',
      vencimento,
    });
  }
}

/**
 * Formulário de registro de pagamento, compartilhado entre a página "Pagamentos" (todos os
 * pagamentos do negócio) e a seção de pagamentos dentro de um orçamento específico.
 * Quando `lockedBudget` é informado, o seletor de orçamento fica oculto e o pagamento já
 * é vinculado a ele — usado dentro de BudgetView.
 */
export function PaymentForm({ budgets, clients, payments, lockedBudget, onClose, onSave }: {
  budgets: Budget[];
  clients: { id: string; nome: string }[];
  payments: Payment[];
  lockedBudget?: Budget;
  onClose: () => void;
  onSave: (data: PaymentInput, saldo?: SaldoReconciliacao) => void;
}) {
  const [budgetId, setBudgetId] = useState(lockedBudget?.id ?? '');
  const [clientId, setClientId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [data, setData] = useState(todayISO());
  const [status, setStatus] = useState<PaymentStatus>('pago');
  const [dataPrevistaSaldo, setDataPrevistaSaldo] = useState('');

  const budgetSelecionado = lockedBudget ?? budgets.find(b => b.id === budgetId);

  const totalVendaBudget = budgetSelecionado ? calculateBudget(budgetSelecionado).totalVenda : 0;
  const jaPagoBudget = budgetSelecionado
    ? payments.filter(p => p.budget_id === budgetSelecionado.id && p.status === 'pago').reduce((acc, p) => acc + p.valor, 0)
    : 0;
  const saldoAposEste = budgetSelecionado
    ? Math.max(0, totalVendaBudget - jaPagoBudget - (status === 'pago' ? valor : 0))
    : 0;
  const mostrarSaldo = Boolean(budgetSelecionado) && status === 'pago' && valor > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valor || valor <= 0) return;
    const descricaoFinal = descricao.trim() || (budgetSelecionado ? `Pagamento — orçamento ${budgetSelecionado.numero}` : 'Pagamento avulso');
    const principal: PaymentInput = {
      client_id: (budgetSelecionado?.client_id ?? clientId) || null,
      budget_id: budgetSelecionado?.id ?? null,
      descricao: descricaoFinal,
      valor,
      forma_pagamento: formaPagamento,
      status,
      vencimento: status === 'pago' ? undefined : data,
      data_recebimento: status === 'pago' ? data : undefined,
    };
    const saldo: SaldoReconciliacao | undefined = budgetSelecionado && status === 'pago'
      ? { budget: budgetSelecionado, novoSaldo: saldoAposEste, vencimento: dataPrevistaSaldo || undefined }
      : undefined;
    onSave(principal, saldo);
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="ce-pop-in bg-[#16181d] border border-white/10 rounded-xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="text-white font-medium flex items-center gap-2"><Wallet size={17} /> Registrar pagamento</h2>

        {lockedBudget ? (
          <div className="text-xs text-gray-400 bg-[#0f1115] border border-white/5 rounded-lg px-3 py-2">
            Vinculado ao orçamento <span className="text-white">{lockedBudget.numero}</span>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-400">Orçamento vinculado (opcional)</label>
            <select value={budgetId} onChange={e => setBudgetId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              <option value="">Nenhum — pagamento avulso</option>
              {budgets.map(b => <option key={b.id} value={b.id}>{b.numero} — {b.titulo}</option>)}
            </select>
          </div>
        )}

        {!budgetSelecionado && (
          <div>
            <label className="text-xs text-gray-400">Cliente (opcional)</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              <option value="">—</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400">Descrição</label>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Sinal combinado na negociação"
            className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Valor (R$) *</label>
            <input type="number" step="0.01" value={valor || ''} onChange={e => setValor(Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Método de pagamento</label>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value as FormaPagamento)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              {formasPagamento.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as PaymentStatus)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              <option value="pago">Pago</option>
              <option value="pendente">Pendente (a receber)</option>
              <option value="parcial">Parcial</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
        </div>

        {mostrarSaldo && (
          <div className="rounded-lg border border-[#f5c518]/30 bg-[#f5c518]/5 p-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Valor total do orçamento</span>
              <span className="text-white">{formatMoney(totalVendaBudget)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Valor a receber (saldo)</span>
              <span className="font-semibold text-[#f5c518]">{formatMoney(saldoAposEste)}</span>
            </div>
            <p className="text-[11px] text-gray-500">
              {saldoAposEste > 0
                ? 'O saldo é atualizado automaticamente no módulo Pagamentos.'
                : 'Este pagamento quita o orçamento — o saldo será zerado.'}
            </p>
            {saldoAposEste > 0 && (
              <div>
                <label className="text-xs text-gray-400">Data prevista para recebimento do saldo (opcional)</label>
                <input type="date" value={dataPrevistaSaldo} onChange={e => setDataPrevistaSaldo(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5">Cancelar</button>
          <button type="submit" className="ce-btn-glow flex-1 py-2.5 rounded-lg bg-[#f5c518] text-[#16181d] font-semibold text-sm hover:bg-[#e0b60f]">Salvar</button>
        </div>
      </form>
    </div>
  );
}

export function MarcarRecebidoModal({ payment, onClose, onConfirm }: {
  payment: Payment;
  onClose: () => void;
  onConfirm: (data: string) => void;
}) {
  const [data, setData] = useState(todayISO());
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="ce-pop-in bg-[#16181d] border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4">
        <h2 className="text-white font-medium flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-400" /> Marcar como recebido</h2>
        <p className="text-sm text-gray-400">{payment.descricao} — {formatMoney(payment.valor)}</p>
        <div>
          <label className="text-xs text-gray-400">Data do recebimento</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5">Cancelar</button>
          <button type="button" onClick={() => onConfirm(data)} className="ce-btn-glow flex-1 py-2.5 rounded-lg bg-[#f5c518] text-[#16181d] font-semibold text-sm hover:bg-[#e0b60f]">Confirmar</button>
        </div>
      </div>
    </div>
  );
}
