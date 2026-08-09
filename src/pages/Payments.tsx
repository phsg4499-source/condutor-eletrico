import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { resolveClienteInfo } from '../lib/clientInfo';
import { formatMoney, formatDate } from '../lib/format';
import {
  PaymentForm, MarcarRecebidoModal, formasPagamento, paymentStatusLabels, paymentStatusColors,
  grupoFiltroOptions, paymentMatchesGrupo, applySaldoReconciliation, getEffectivePaymentStatus, type GrupoFiltroPagamento,
} from '../components/PaymentForm';
import type { Payment, PaymentStatus } from '../types';

export default function Payments() {
  const { db, addPayment, updatePayment, deletePayment } = useStore();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<PaymentStatus | 'todos'>('todos');
  const [grupoFiltro, setGrupoFiltro] = useState<GrupoFiltroPagamento>(() => (searchParams.get('filtro') as GrupoFiltroPagamento | null) ?? 'todos');
  const [marcarRecebido, setMarcarRecebido] = useState<Payment | null>(null);

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
    const efetivo = getEffectivePaymentStatus(payment);
    // O filtro rápido (grupo) e o filtro detalhado por status atuam de forma exclusiva:
    // escolher um grupo reseta o status detalhado, e vice-versa (evita combinações impossíveis).
    const matchesFiltro = statusFiltro !== 'todos'
      ? efetivo === statusFiltro
      : paymentMatchesGrupo(efetivo, grupoFiltro);
    return matchesQuery && matchesFiltro;
  }).sort((a, b) => (b.payment.data_recebimento ?? b.payment.vencimento ?? '').localeCompare(a.payment.data_recebimento ?? a.payment.vencimento ?? ''));

  const totalRecebido = db.payments.filter(p => p.status === 'pago').reduce((acc, p) => acc + p.valor, 0);
  const totalPendente = db.payments.filter(p => { const s = getEffectivePaymentStatus(p); return s === 'pendente' || s === 'parcial'; }).reduce((acc, p) => acc + p.valor, 0);
  const totalAtrasado = db.payments.filter(p => getEffectivePaymentStatus(p) === 'atrasado').reduce((acc, p) => acc + p.valor, 0);

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir este pagamento?')) return;
    const result = await deletePayment(id);
    if (!result.ok) {
      toast.show(result.error ?? 'Não foi possível excluir o pagamento.', 'warning');
      return;
    }
    toast.show('Pagamento excluído.', 'info');
  }

  function selecionarGrupo(g: GrupoFiltroPagamento) {
    setGrupoFiltro(g);
    setStatusFiltro('todos');
  }

  function selecionarStatus(s: PaymentStatus | 'todos') {
    setStatusFiltro(s);
    setGrupoFiltro('todos');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-[#0b2338]">Pagamentos</h1>
          <p className="text-sm text-slate-500 mt-1">Sinais, entradas e recebimentos de todos os orçamentos.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="ce-btn-glow ce-cta-glow flex items-center gap-2 bg-[#00B4E5] text-[#0b2338] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#0069A8]">
          <Plus size={16} /> Registrar pagamento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="ce-card-hover bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Recebido</p>
          <p className="text-xl font-semibold text-emerald-400 mt-1">{formatMoney(totalRecebido)}</p>
        </div>
        <div className="ce-card-hover bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">A receber</p>
          <p className="text-xl font-semibold text-[#00B4E5] mt-1">{formatMoney(totalPendente)}</p>
        </div>
        <div className="ce-card-hover bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Atrasado</p>
          <p className="text-xl font-semibold text-red-400 mt-1">{formatMoney(totalAtrasado)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {grupoFiltroOptions.map(g => (
          <button key={g.value} onClick={() => selecionarGrupo(g.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              grupoFiltro === g.value && statusFiltro === 'todos' ? 'bg-[#00B4E5] text-[#0b2338] border-[#00B4E5]' : 'border-slate-200 text-slate-500 hover:text-[#0b2338] hover:border-slate-300'
            }`}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por descrição, cliente ou nº do orçamento..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
        </div>
        <select value={statusFiltro} onChange={e => selecionarStatus(e.target.value as PaymentStatus | 'todos')}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-[#0b2338]" title="Filtrar por status específico (inclui cancelado/renegociado)">
          <option value="todos">Status específico...</option>
          {Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="ce-card-hover bg-white border border-slate-200 rounded-xl overflow-x-auto ce-fade-up ce-fade-up-1">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
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
              <tr key={payment.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-100">
                <td className="px-5 py-3 text-slate-600">
                  {payment.descricao}
                  {budget && (
                    <Link to={`/app/orcamentos/${budget.id}`} className="block text-[11px] text-[#00B4E5] hover:underline">Orçamento {budget.numero}</Link>
                  )}
                </td>
                <td className="px-5 py-3 text-[#0b2338]">{cliente.nome}</td>
                <td className="px-5 py-3 text-[#0b2338] font-medium">{formatMoney(payment.valor)}</td>
                <td className="px-5 py-3 text-slate-500">{payment.forma_pagamento ? formasPagamento.find(f => f.value === payment.forma_pagamento)?.label : '—'}</td>
                <td className="px-5 py-3 text-slate-600">{formatDate(payment.data_recebimento ?? payment.vencimento ?? '')}</td>
                <td className="px-5 py-3"><span className={`text-xs px-2 py-1 rounded-full text-[#0b2338] ${paymentStatusColors[getEffectivePaymentStatus(payment)]}`}>{paymentStatusLabels[getEffectivePaymentStatus(payment)]}</span></td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {payment.status !== 'pago' && payment.status !== 'cancelado' && (
                    <button onClick={() => setMarcarRecebido(payment)} title="Marcar como recebido"
                      className="text-slate-400 hover:text-emerald-400 mr-3"><CheckCircle2 size={15} /></button>
                  )}
                  <button onClick={() => handleDelete(payment.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Nenhum pagamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PaymentForm
          budgets={db.budgets}
          clients={db.clients}
          payments={db.payments}
          onClose={() => setShowForm(false)}
          onSave={async (data, saldo) => {
            const result = await addPayment(data);
            if (!result.ok) {
              toast.show(result.error ?? 'Não foi possível registrar o pagamento.', 'warning');
              return;
            }
            if (saldo) {
              const saldoResult = await applySaldoReconciliation(db.payments, saldo, { addPayment, updatePayment, deletePayment });
              if (!saldoResult.ok) {
                toast.show(`Pagamento registrado, mas não foi possível atualizar o saldo a receber: ${saldoResult.error ?? ''}`, 'warning');
                setShowForm(false);
                return;
              }
            }
            toast.show('Pagamento registrado.');
            setShowForm(false);
          }}
        />
      )}

      {marcarRecebido && (
        <MarcarRecebidoModal
          payment={marcarRecebido}
          onClose={() => setMarcarRecebido(null)}
          onConfirm={async (data) => {
            const result = await updatePayment(marcarRecebido.id, { status: 'pago', data_recebimento: data, vencimento: undefined });
            if (!result.ok) {
              toast.show(result.error ?? 'Não foi possível marcar como recebido.', 'warning');
              return;
            }
            toast.show('Pagamento marcado como recebido.');
            setMarcarRecebido(null);
          }}
        />
      )}
    </div>
  );
}
