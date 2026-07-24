import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Download, MessageCircle, ArrowLeft, Repeat, Pencil, Trash2, Plus, Wallet, CheckCircle2, FileSignature } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { calculateBudget, budgetAlerts } from '../lib/calculations';
import { formatMoney, formatDate, addDays } from '../lib/format';
import { BudgetStatusBadge, budgetStatusOptions } from '../components/StatusBadge';
import { generateBudgetPdf } from '../lib/pdf';
import { generateServiceContractPdf } from '../lib/contract';
import { budgetWhatsappMessage, whatsappLink } from '../lib/whatsapp';
import { resolveClienteInfo } from '../lib/clientInfo';
import {
  PaymentForm, MarcarRecebidoModal, formasPagamento, paymentStatusLabels,
  grupoFiltroOptions, paymentMatchesGrupo, applySaldoReconciliation, getEffectivePaymentStatus, type GrupoFiltroPagamento,
} from '../components/PaymentForm';
import type { BudgetStatus, Payment } from '../types';

export default function BudgetView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, setBudgetStatus, convertBudgetToServiceOrder, deleteBudget, addPayment, updatePayment, deletePayment } = useStore();
  const toast = useToast();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [marcarRecebido, setMarcarRecebido] = useState<Payment | null>(null);
  const [grupoFiltro, setGrupoFiltro] = useState<GrupoFiltroPagamento>('todos');
  const budget = db.budgets.find(b => b.id === id);

  if (!budget) {
    return (
      <div className="text-gray-400">
        Orçamento não encontrado. <Link to="/app/orcamentos" className="text-[#f5c518] hover:underline">Voltar</Link>
      </div>
    );
  }

  const cliente = resolveClienteInfo(budget, db.clients);
  const totals = calculateBudget(budget);
  const alerts = budgetAlerts(budget, totals, db.organization.margem_minima_percentual);
  const publicLink = `${window.location.origin}/proposta/${budget.link_publico_token}`;

  const budgetPayments = db.payments.filter(p => p.budget_id === budget.id).sort((a, b) => (b.data_recebimento ?? b.vencimento ?? '').localeCompare(a.data_recebimento ?? a.vencimento ?? ''));
  const totalPago = budgetPayments.filter(p => p.status === 'pago').reduce((acc, p) => acc + p.valor, 0);
  const saldoReceber = Math.max(0, totals.totalVenda - totalPago);
  const budgetPaymentsFiltrados = budgetPayments.filter(p => paymentMatchesGrupo(getEffectivePaymentStatus(p), grupoFiltro));

  function handleDownloadPdf() {
    try {
      const doc = generateBudgetPdf(budget!, cliente, db.organization);
      doc.save(`orcamento-${budget!.numero}.pdf`);
      toast.show('PDF gerado e baixado.');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.show(`Não foi possível gerar o PDF: ${err instanceof Error ? err.message : 'erro desconhecido'}`, 'warning');
    }
  }

  function handleDownloadContract() {
    try {
      const client = budget!.client_id ? db.clients.find(c => c.id === budget!.client_id) : undefined;
      const doc = generateServiceContractPdf(budget!, cliente, client, db.organization);
      doc.save(`contrato-orcamento-${budget!.numero}.pdf`);
      toast.show('Contrato gerado e baixado.');
    } catch (err) {
      console.error('Erro ao gerar contrato:', err);
      toast.show(`Não foi possível gerar o contrato: ${err instanceof Error ? err.message : 'erro desconhecido'}`, 'warning');
    }
  }

  function handleWhatsapp() {
    if (!cliente.whatsapp) {
      toast.show('Este cliente não tem WhatsApp cadastrado. Edite o orçamento para adicionar um telefone.', 'warning');
      return;
    }
    const message = budgetWhatsappMessage(budget!, cliente, publicLink);
    window.open(whatsappLink(cliente.whatsapp, message), '_blank');
    toast.show('WhatsApp aberto com a mensagem pronta.', 'info');
  }

  function handleConvert() {
    const order = convertBudgetToServiceOrder(budget!.id);
    if (order) {
      toast.show('Orçamento convertido em ordem de serviço!');
      navigate(`/app/ordens-servico/${order.id}`);
    }
  }

  function handleStatusChange(newStatus: BudgetStatus) {
    setBudgetStatus(budget!.id, newStatus);
    toast.show('Status atualizado.', 'info');

    if (newStatus === 'aprovado' || newStatus === 'aprovado_parcialmente') {
      navigate('/app/agenda', {
        state: {
          prefillCompromisso: {
            titulo: `Execução — Orçamento ${budget!.numero}`,
            tipo: 'execucao_servico',
            local: budget!.local_servico || undefined,
            budget_id: budget!.id,
            client_id: budget!.client_id ?? undefined,
            cliente_nome_avulso: budget!.cliente_nome_avulso ?? undefined,
            cliente_telefone_avulso: budget!.cliente_telefone_avulso ?? undefined,
          },
        },
      });
    }
  }

  function handleDelete() {
    const confirmado = window.confirm(
      `Tem certeza que quer excluir o orçamento nº ${budget!.numero}? Essa ação não pode ser desfeita.`,
    );
    if (!confirmado) return;
    deleteBudget(budget!.id);
    toast.show('Orçamento excluído.', 'info');
    navigate('/app/orcamentos');
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/app/orcamentos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Voltar</Link>

      <div className="flex flex-wrap items-start justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-white">{budget.titulo}</h1>
          <p className="text-sm text-gray-400 mt-1">
            Orçamento nº {budget.numero} · Cliente: {cliente.nome}
            {!cliente.cadastrado && <span className="ml-2 text-[10px] uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">sem cadastro</span>}
          </p>
        </div>
        <BudgetStatusBadge status={budget.status} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to={`/app/orcamentos/${budget.id}/editar`} className="flex items-center gap-2 border border-white/10 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-white/5">
          <Pencil size={16} /> Editar
        </Link>
        <button onClick={handleDownloadPdf} className="ce-btn-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
          <Download size={16} /> Gerar PDF
        </button>
        <button onClick={handleDownloadContract} className="flex items-center gap-2 border border-white/10 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-white/5">
          <FileSignature size={16} /> Gerar contrato
        </button>
        <button onClick={handleWhatsapp} className="flex items-center gap-2 bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-emerald-500">
          <MessageCircle size={16} /> Enviar por WhatsApp
        </button>
        {(budget.status === 'aprovado' || budget.status === 'aprovado_parcialmente') && (
          <button onClick={handleConvert} className="flex items-center gap-2 border border-white/10 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-white/5">
            <Repeat size={16} /> Converter em ordem de serviço
          </button>
        )}
        <select value={budget.status} onChange={e => handleStatusChange(e.target.value as BudgetStatus)}
          className="bg-[#16181d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white sm:ml-auto">
          {budgetStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button onClick={handleDelete} className="flex items-center gap-2 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm hover:bg-red-500/10">
          <Trash2 size={16} /> Excluir
        </button>
      </div>

      <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-medium text-sm">Itens</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/5">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium">Qtd</th>
              <th className="py-2 font-medium">Custo unit.</th>
              <th className="py-2 font-medium">Valor unit.</th>
              <th className="py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {budget.itens.map(item => (
              <tr key={item.id} className="border-b border-white/5 last:border-0">
                <td className="py-2 text-white">{item.nome}</td>
                <td className="py-2 text-gray-400 capitalize">{item.tipo}</td>
                <td className="py-2 text-gray-300">{item.quantidade} {item.unidade}</td>
                <td className="py-2 text-gray-400">{formatMoney(item.custo_unitario)}</td>
                <td className="py-2 text-gray-300">{formatMoney(item.valor_unitario)}</td>
                <td className="py-2 text-white text-right">{formatMoney(item.quantidade * item.valor_unitario - item.desconto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {budget.custos_extras.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs text-gray-400 mb-2">Custos adicionais</h3>
            {budget.custos_extras.map(c => (
              <div key={c.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-300">{c.descricao}</span>
                <span className="text-white">{formatMoney(c.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-2">
          <h2 className="text-white font-medium text-sm mb-2">Valores internos</h2>
          <Row label="Custo total" value={formatMoney(totals.totalCusto)} />
          <Row label="Lucro bruto" value={formatMoney(totals.lucroBruto)} />
          <Row label="Margem" value={`${totals.margemPercentual.toFixed(1)}%`} />
          <p className="text-[11px] text-gray-500 pt-1">Estes dados não são exibidos ao cliente nem no PDF.</p>
        </div>
        <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-2">
          <h2 className="text-white font-medium text-sm mb-2">Condições comerciais</h2>
          <Row label="Valor final" value={formatMoney(totals.totalVenda)} />
          <Row label="Entrada" value={formatMoney(totals.valorEntrada)} />
          <Row label="Saldo" value={formatMoney(totals.saldoRestante)} />
          <Row label="Parcelas" value={`${budget.parcelas}x de ${formatMoney(totals.valorParcela)}`} />
          <Row label="Validade" value={formatDate(addDays(budget.data_emissao, budget.validade_dias))} />
          <Row label="Garantia" value={budget.garantia} />
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
          {alerts.map((a, i) => <p key={i} className="text-xs text-amber-400">⚠ {a}</p>)}
        </div>
      )}

      <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-medium text-sm flex items-center gap-1.5"><Wallet size={15} className="text-gray-400" /> Pagamentos</h2>
          <button onClick={() => setShowPaymentForm(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">
            <Plus size={13} /> Registrar pagamento
          </button>
        </div>

        {(budget.status === 'aprovado' || budget.status === 'aprovado_parcialmente') && budgetPayments.length === 0 && (
          <div className="bg-[#f5c518]/10 border border-[#f5c518]/20 rounded-lg px-4 py-3 text-xs text-amber-300 space-y-2">
            <p>Orçamento aprovado — registre o pagamento do sinal combinado na negociação para acompanhar o saldo restante.</p>
            <button
              onClick={() => {
                applySaldoReconciliation(db.payments, { budget, novoSaldo: totals.totalVenda }, { addPayment, updatePayment, deletePayment });
                toast.show('Valor total lançado como a receber.');
              }}
              className="text-xs underline text-amber-200 hover:text-white">
              Ainda não recebi nada — lançar o valor total como a receber
            </button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-[#0f1115] border border-white/5 rounded-lg p-3">
            <p className="text-[11px] text-gray-500">Valor pago</p>
            <p className="text-lg text-emerald-400 font-semibold">{formatMoney(totalPago)}</p>
          </div>
          <div className="bg-[#0f1115] border border-white/5 rounded-lg p-3">
            <p className="text-[11px] text-gray-500">Valor a receber</p>
            <p className="text-lg text-[#f5c518] font-semibold">{formatMoney(saldoReceber)}</p>
          </div>
        </div>

        {budgetPayments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {grupoFiltroOptions.map(g => (
              <button key={g.value} onClick={() => setGrupoFiltro(g.value)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium border transition ${
                  grupoFiltro === g.value ? 'bg-[#f5c518] text-[#16181d] border-[#f5c518]' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                }`}>
                {g.label}
              </button>
            ))}
          </div>
        )}

        {budgetPayments.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum pagamento registrado ainda.</p>
        ) : budgetPaymentsFiltrados.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum pagamento neste filtro.</p>
        ) : (
          <div className="space-y-2">
            {budgetPaymentsFiltrados.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-[#0f1115] border border-white/5 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm text-white">{formatMoney(p.valor)} <span className="text-xs text-gray-500">— {p.forma_pagamento ? formasPagamento.find(f => f.value === p.forma_pagamento)?.label : '—'}</span></p>
                  <p className="text-[11px] text-gray-500">{formatDate(p.data_recebimento ?? p.vencimento ?? '')} · {paymentStatusLabels[getEffectivePaymentStatus(p)]}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.status !== 'pago' && p.status !== 'cancelado' && (
                    <button onClick={() => setMarcarRecebido(p)} title="Marcar como recebido" className="text-gray-500 hover:text-emerald-400">
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                  <button onClick={() => { deletePayment(p.id); toast.show('Pagamento excluído.', 'info'); }} className="text-gray-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#16181d] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-medium text-sm mb-3">Histórico de status</h2>
        <div className="space-y-2">
          {budget.historico_status.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <BudgetStatusBadge status={h.status} />
              <span className="text-gray-400">{formatDate(h.data)}</span>
            </div>
          ))}
        </div>
      </div>

      {showPaymentForm && (
        <PaymentForm
          budgets={db.budgets}
          clients={db.clients}
          payments={db.payments}
          lockedBudget={budget}
          onClose={() => setShowPaymentForm(false)}
          onSave={(data, saldo) => {
            addPayment(data);
            if (saldo) applySaldoReconciliation(db.payments, saldo, { addPayment, updatePayment, deletePayment });
            toast.show('Pagamento registrado.');
            setShowPaymentForm(false);
          }}
        />
      )}

      {marcarRecebido && (
        <MarcarRecebidoModal
          payment={marcarRecebido}
          onClose={() => setMarcarRecebido(null)}
          onConfirm={(data) => {
            updatePayment(marcarRecebido.id, { status: 'pago', data_recebimento: data, vencimento: undefined });
            toast.show('Pagamento marcado como recebido.');
            setMarcarRecebido(null);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

