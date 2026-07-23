import { useMemo } from 'react';
import { useStore } from '../lib/store';
import CountUp from '../components/CountUp';
import { calculateBudget } from '../lib/calculations';
import { formatMoney } from '../lib/format';
import { BudgetStatusBadge } from '../components/StatusBadge';
import { Link } from 'react-router-dom';

function Kpi({ label, value, hint, delay = 0, formatter }: { label: string; value: number; hint?: string; delay?: number; formatter?: (n: number) => string }) {
  return (
    <div className="ce-card-hover ce-fade-up bg-[#16181d] border border-white/5 rounded-xl p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold text-white mt-1"><CountUp value={value} formatter={formatter} /></div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

function KpiMoney({ label, value, hint, delay = 0 }: { label: string; value: number; hint?: string; delay?: number }) {
  return (
    <div className="ce-card-hover ce-fade-up bg-[#16181d] border border-white/5 rounded-xl p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold text-white mt-1"><CountUp value={value} formatter={formatMoney} /></div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { db } = useStore();
  const { budgets, clients, serviceOrders, payments } = db;

  const stats = useMemo(() => {
    const thisMonth = new Date().getMonth();
    const monthBudgets = budgets.filter(b => new Date(b.data_emissao).getMonth() === thisMonth);
    const approved = budgets.filter(b => b.status === 'aprovado' || b.status === 'convertido_em_os');
    const waiting = budgets.filter(b => ['enviado', 'visualizado', 'em_negociacao'].includes(b.status));

    let totalOrcado = 0, totalAprovado = 0, lucroEstimado = 0;
    budgets.forEach(b => {
      const t = calculateBudget(b);
      totalOrcado += t.totalVenda;
      if (b.status === 'aprovado' || b.status === 'convertido_em_os') {
        totalAprovado += t.totalVenda;
        lucroEstimado += t.lucroBruto;
      }
    });

    const ticketMedio = budgets.length ? totalOrcado / budgets.length : 0;
    const taxaAprovacao = budgets.length ? (approved.length / budgets.length) * 100 : 0;
    const emExecucao = serviceOrders.filter(o => ['em_execucao', 'agendada', 'em_deslocamento'].includes(o.status)).length;
    const concluidas = serviceOrders.filter(o => o.status === 'finalizada').length;
    const aReceber = payments.filter(p => p.status === 'pendente' || p.status === 'atrasado').reduce((a, p) => a + p.valor, 0);
    const recebido = payments.filter(p => p.status === 'pago').reduce((a, p) => a + p.valor, 0);

    return {
      qtdMes: monthBudgets.length, totalOrcado, totalAprovado, taxaAprovacao, aprovados: approved.length,
      aguardando: waiting.length, emExecucao, concluidas, aReceber, recebido, ticketMedio, lucroEstimado,
    };
  }, [budgets, serviceOrders, payments]);

  const recentBudgets = [...budgets].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Painel geral</h1>
          <p className="text-sm text-gray-400 mt-1">Indicadores comerciais e financeiros da Condutor Elétrico.</p>
        </div>
        <Link to="/app/orcamentos/novo" className="ce-btn-glow ce-cta-glow flex items-center justify-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f] shrink-0">
          Novo orçamento
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Kpi label="Orçamentos no mês" value={stats.qtdMes} delay={0} />
        <KpiMoney label="Valor total orçado" value={stats.totalOrcado} delay={30} />
        <Kpi label="Orçamentos aprovados" value={stats.aprovados} delay={60} />
        <Kpi label="Taxa de aprovação" value={Math.round(stats.taxaAprovacao)} delay={90} formatter={(n) => `${n}%`} />
        <KpiMoney label="Valor aprovado" value={stats.totalAprovado} delay={120} />
        <Kpi label="Aguardando resposta" value={stats.aguardando} delay={150} />
        <Kpi label="Serviços em andamento" value={stats.emExecucao} delay={180} />
        <Kpi label="Serviços concluídos" value={stats.concluidas} delay={210} />
        <KpiMoney label="A receber" value={stats.aReceber} delay={240} />
        <KpiMoney label="Recebido" value={stats.recebido} delay={270} />
        <KpiMoney label="Ticket médio" value={stats.ticketMedio} delay={300} />
        <KpiMoney label="Lucro estimado (aprovados)" value={stats.lucroEstimado} hint="Interno — não exibido ao cliente" delay={330} />
      </div>

      <div className="bg-[#16181d] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-white font-medium text-sm">Orçamentos recentes</h2>
          <Link to="/app/orcamentos" className="text-xs text-[#f5c518] hover:underline">Ver todos</Link>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {recentBudgets.map(b => {
              const client = clients.find(c => c.id === b.client_id);
              const t = calculateBudget(b);
              return (
                <tr key={b.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 text-gray-300">{b.numero}</td>
                  <td className="px-5 py-3 text-gray-300">{client?.nome ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-300 hidden sm:table-cell">{b.titulo}</td>
                  <td className="px-5 py-3 text-white font-medium">{formatMoney(t.totalVenda)}</td>
                  <td className="px-5 py-3"><BudgetStatusBadge status={b.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/app/orcamentos/${b.id}`} className="text-xs text-[#f5c518] hover:underline">Abrir</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
