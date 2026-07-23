import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Wallet } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { resolveClienteInfo } from '../lib/clientInfo';
import { formatMoney, formatDate, todayISO } from '../lib/format';
import type { FormaPagamento, Payment, PaymentStatus } from '../types';

const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' }, { value: 'debito', label: 'Cartão de débito' }, { value: 'credito', label: 'Cartão de crédito' },
  { value: 'entrada_parcelas', label: 'Entrada + parcelas' }, { value: 'a_combinar', label: 'A combinar' },
];

const statusLabels: Record<PaymentStatus, string> = {
  pendente: 'Pendente', parcial: 'Parcial', pago: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado', renegociado: 'Renegociado',
};
const statusColors: Record<PaymentStatus, string> = {
  pendente: 'bg-blue-600', parcial: 'bg-purple-600', pago: 'bg-emerald-600',
  atrasado: 'bg-red-600', cancelado: 'bg-gray-700', renegociado: 'bg-amber-600',
};

export default function Payments() {
  const { db, addPayment, deletePayment } = useStore();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<PaymentStatus | 'todos'>('todos');

  function resolvePaymentCliente(p: Payment) {
    const budget = p.budget_id ? db.budgets.find(b => b.id === p.budget_id) : undefined;
    if (budget) return resolveClienteInfo(budget, db.clients);
    return resolveClienteInfo(p, db.clients);
  }

  const enriched = db.payments.map(p => ({
    payment: p,
    cliente: resolvePaymentCliente(p),
    budget: p.budget_id ? db.budgets.find(b => b.id === p.budget_id) : undefined,
  }));

  const filtered = enriched.filter(({ payment, cliente, budget }) => {
    const matchesQuery = !query
      || payment.descricao.toLowerCase().includes(query.toLowerCase())
      || cliente.nome.toLowerCase().includes(query.toLowerCase())
      || (budget?.numero ?? '').includes(query);
    const matchesStatus = statusFiltro === 'todos' || payment.status === statusFiltro;
    return matchesQuery && matchesStatus;
  }).sort((a, b) => (b.payment.data_recebimento ?? b.payment.vencimento ?? '').localeCompare(a.payment.data_recebimento ?? a.payment.vencimento ?? ''));

  const totalRecebido = db.payments.filter(p => p.status === 'pago').reduce((acc, p) => acc + p.valor, 0);
  const totalPendente = db.payments.filter(p => p.status === 'pendente' || p.status === 'parcial').reduce((acc, p) => acc + p.valor, 0);
  const totalAtrasado = db.payments.filter(p => p.status === 'atrasado').reduce((acc, p) => acc + p.valor, 0);

  function handleDelete(id: string) {
    if (!window.confirm('Excluir este pagamento?')) return;
    deletePayment(id);
    toast.show('Pagamento excluído.', 'info');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-white">Pagamentos</h1>
          <p className="text-sm text-gray-400 mt-1">Sinais, entradas e recebimentos de todos os orçamentos.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="ce-btn-glow ce-cta-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
          <Plus size={16} /> Registrar pagamento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-400">Recebido</p>
          <p className="text-xl font-semibold text-emerald-400 mt-1">{formatMoney(totalRecebido)}</p>
        </div>
        <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-400">A receber</p>
          <p className="text-xl font-semibold text-[#f5c518] mt-1">{formatMoney(totalPendente)}</p>
        </div>
        <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-gray-400">Atrasado</p>
          <p className="text-xl font-semibold text-red-400 mt-1">{formatMoney(totalAtrasado)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por descrição, cliente ou nº do orçamento..."
            className="w-full bg-[#16181d] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
        </div>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value as PaymentStatus | 'todos')}
          className="bg-[#16181d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="todos">Todos os status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl overflow-x-auto ce-fade-up ce-fade-up-1">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/5">
              <th className="px-5 py-3 font-medium">Descrição</th>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Valor</th>
              <th className="px-5 py-3 font-medium">Método</th>
              <th className="px-5 py-3 font-medium">Data</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ payment, cliente, budget }) => (
              <tr key={payment.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-5 py-3 text-gray-300">
                  {payment.descricao}
                  {budget && (
                    <Link to={`/app/orcamentos/${budget.id}`} className="block text-[11px] text-[#f5c518] hover:underline">Orçamento {budget.numero}</Link>
                  )}
                </td>
                <td className="px-5 py-3 text-white">{cliente.nome}</td>
                <td className="px-5 py-3 text-white font-medium">{formatMoney(payment.valor)}</td>
                <td className="px-5 py-3 text-gray-400">{payment.forma_pagamento ? formasPagamento.find(f => f.value === payment.forma_pagamento)?.label : '—'}</td>
                <td className="px-5 py-3 text-gray-300">{formatDate(payment.data_recebimento ?? payment.vencimento ?? '')}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2 py-1 rounded-full text-white ${statusColors[payment.status]}`}>{statusLabels[payment.status]}</span></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => handleDelete(payment.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">Nenhum pagamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PaymentForm
          budgets={db.budgets}
          clients={db.clients}
          onClose={() => setShowForm(false)}
          onSave={(data) => {
            addPayment(data);
            toast.show('Pagamento registrado.');
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function PaymentForm({ budgets, clients, onClose, onSave }: {
  budgets: { id: string; numero: string; titulo: string; client_id?: string | null }[];
  clients: { id: string; nome: string }[];
  onClose: () => void;
  onSave: (data: Omit<Payment, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => void;
}) {
  const [budgetId, setBudgetId] = useState('');
  const [clientId, setClientId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [data, setData] = useState(todayISO());
  const [status, setStatus] = useState<PaymentStatus>('pago');

  const budgetSelecionado = budgets.find(b => b.id === budgetId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valor || valor <= 0) return;
    const descricaoFinal = descricao.trim() || (budgetSelecionado ? `Pagamento — orçamento ${budgetSelecionado.numero}` : 'Pagamento avulso');
    onSave({
      client_id: (budgetSelecionado?.client_id ?? clientId) || null,
      budget_id: budgetId || null,
      descricao: descricaoFinal,
      valor,
      forma_pagamento: formaPagamento,
      status,
      vencimento: status === 'pago' ? undefined : data,
      data_recebimento: status === 'pago' ? data : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="ce-pop-in bg-[#16181d] border border-white/10 rounded-xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="text-white font-medium flex items-center gap-2"><Wallet size={17} /> Registrar pagamento</h2>

        <div>
          <label className="text-xs text-gray-400">Orçamento vinculado (opcional)</label>
          <select value={budgetId} onChange={e => setBudgetId(e.target.value)}
            className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
            <option value="">Nenhum — pagamento avulso</option>
            {budgets.map(b => <option key={b.id} value={b.id}>{b.numero} — {b.titulo}</option>)}
          </select>
        </div>

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

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5">Cancelar</button>
          <button type="submit" className="ce-btn-glow flex-1 py-2.5 rounded-lg bg-[#f5c518] text-[#16181d] font-semibold text-sm hover:bg-[#e0b60f]">Salvar</button>
        </div>
      </form>
    </div>
  );
}
