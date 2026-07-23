import { useParams, Link, useNavigate } from 'react-router-dom';
import { Download, MessageCircle, ArrowLeft, Repeat } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { calculateBudget, budgetAlerts } from '../lib/calculations';
import { formatMoney, formatDate, addDays } from '../lib/format';
import { BudgetStatusBadge, budgetStatusOptions } from '../components/StatusBadge';
import { generateBudgetPdf } from '../lib/pdf';
import { budgetWhatsappMessage, whatsappLink } from '../lib/whatsapp';
import type { BudgetStatus } from '../types';

export default function BudgetView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, setBudgetStatus, convertBudgetToServiceOrder } = useStore();
  const toast = useToast();
  const budget = db.budgets.find(b => b.id === id);
  const client = budget ? db.clients.find(c => c.id === budget.client_id) : undefined;

  if (!budget || !client) {
    return (
      <div className="text-gray-400">
        Orçamento não encontrado. <Link to="/app/orcamentos" className="text-[#f5c518] hover:underline">Voltar</Link>
      </div>
    );
  }

  const totals = calculateBudget(budget);
  const alerts = budgetAlerts(budget, totals, db.organization.margem_minima_percentual);
  const publicLink = `${window.location.origin}/proposta/${budget.id}`;

  function handleDownloadPdf() {
    const doc = generateBudgetPdf(budget!, client!, db.organization);
    doc.save(`orcamento-${budget!.numero}.pdf`);
    toast.show('PDF gerado e baixado.');
  }

  function handleWhatsapp() {
    const message = budgetWhatsappMessage(budget!, client!, publicLink);
    window.open(whatsappLink(client!.whatsapp, message), '_blank');
    toast.show('WhatsApp aberto com a mensagem pronta.', 'info');
  }

  function handleConvert() {
    const order = convertBudgetToServiceOrder(budget!.id);
    if (order) {
      toast.show('Orçamento convertido em ordem de serviço!');
      navigate(`/app/ordens-servico/${order.id}`);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/app/orcamentos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Voltar</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{budget.titulo}</h1>
          <p className="text-sm text-gray-400 mt-1">Orçamento nº {budget.numero} · Cliente: {client.nome}</p>
        </div>
        <BudgetStatusBadge status={budget.status} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleDownloadPdf} className="flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
          <Download size={16} /> Gerar PDF
        </button>
        <button onClick={handleWhatsapp} className="flex items-center gap-2 bg-emerald-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-emerald-500">
          <MessageCircle size={16} /> Enviar por WhatsApp
        </button>
        {budget.status === 'aprovado' && (
          <button onClick={handleConvert} className="flex items-center gap-2 border border-white/10 text-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-white/5">
            <Repeat size={16} /> Converter em ordem de serviço
          </button>
        )}
        <select value={budget.status} onChange={e => { setBudgetStatus(budget.id, e.target.value as BudgetStatus); toast.show('Status atualizado.', 'info'); }}
          className="bg-[#16181d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white ml-auto">
          {budgetStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
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
