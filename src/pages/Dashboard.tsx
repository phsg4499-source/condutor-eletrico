import { useMemo, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import CountUp from '../components/CountUp';
import { calculateBudget } from '../lib/calculations';
import { formatMoney } from '../lib/format';
import { BudgetStatusBadge } from '../components/StatusBadge';
import { resolveClienteInfo } from '../lib/clientInfo';
import { getEffectivePaymentStatus } from '../components/PaymentForm';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

function CardShell({ to, delay, children }: { to?: string; delay: number; children: ReactNode }) {
  const className = `ce-card-hover ce-fade-up bg-[#16181d] border border-white/5 rounded-xl p-4 ${to ? 'hover:border-[#f5c518]/30 cursor-pointer' : ''}`;
  if (to) return <Link to={to} className={`block ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</Link>;
  return <div className={className} style={{ animationDelay: `${delay}ms` }}>{children}</div>;
}

function Kpi({ label, value, hint, delay = 0, formatter, to }: { label: string; value: number; hint?: string; delay?: number; formatter?: (n: number) => string; to?: string }) {
  return (
    <CardShell to={to} delay={delay}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold text-white mt-1"><CountUp value={value} formatter={formatter} /></div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </CardShell>
  );
}

function KpiMoney({ label, value, hint, delay = 0, to }: { label: string; value: number; hint?: string; delay?: number; to?: string }) {
  return (
    <CardShell to={to} delay={delay}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-semibold text-white mt-1"><CountUp value={value} formatter={formatMoney} /></div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </CardShell>
  );
}

export default function Dashboard() {
  const { db } = useStore();
  const { budgets, clients, serviceOrders, payments, compromissos, organization } = db;

  const stats = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthBudgets = budgets.filter(b => b.data_emissao.startsWith(monthKey));
    const approved = budgets.filter(b => b.status === 'aprovado' || b.status === 'convertido_em_os');
    const waiting = budgets.filter(b => ['enviado', 'visualizado', 'em_negociacao'].includes(b.status));
    const recusados = budgets.filter(b => b.status === 'recusado');

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
    const agendadas = serviceOrders.filter(o => o.status === 'aguardando_agendamento' || o.status === 'agendada').length;
    const emExecucao = serviceOrders.filter(o => ['em_execucao', 'agendada', 'em_deslocamento'].includes(o.status)).length;
    const concluidas = serviceOrders.filter(o => o.status === 'finalizada').length;
    const aReceber = payments.filter(p => getEffectivePaymentStatus(p) === 'pendente' || getEffectivePaymentStatus(p) === 'parcial').reduce((a, p) => a + p.valor, 0);
    const vencidos = payments.filter(p => getEffectivePaymentStatus(p) === 'atrasado');
    const valorVencido = vencidos.reduce((a, p) => a + p.valor, 0);
    const recebido = payments.filter(p => p.status === 'pago').reduce((a, p) => a + p.valor, 0);
    const recebidoNoMes = payments.filter(p => p.status === 'pago' && (p.data_recebimento ?? '').startsWith(monthKey)).reduce((a, p) => a + p.valor, 0);
    const hojeISO = now.toISOString().slice(0, 10);
    const proximosCompromissos = compromissos.filter(c => c.status === 'agendado' && c.data >= hojeISO).length;

    const meta = organization.meta_faturamento_mensal || 25000;
    const percentualMeta = meta > 0 ? Math.round((recebidoNoMes / meta) * 100) : 0;

    return {
      qtdMes: monthBudgets.length, totalOrcado, totalAprovado, taxaAprovacao, aprovados: approved.length,
      aguardando: waiting.length, recusados: recusados.length, agendadas, emExecucao, concluidas,
      aReceber, valorVencido, qtdVencidos: vencidos.length, recebido, recebidoNoMes, ticketMedio, lucroEstimado,
      meta, percentualMeta, proximosCompromissos,
    };
  }, [budgets, serviceOrders, payments, compromissos, organization.meta_faturamento_mensal]);

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

      <div className="ce-card-hover ce-fade-up bg-[#16181d] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#f5c518]" />
            <h2 className="text-white font-medium text-sm">Meta de faturamento do mês</h2>
          </div>
          <span className="text-xs text-gray-400">
            {formatMoney(stats.recebidoNoMes)} <span className="text-gray-600">/</span> {formatMoney(stats.meta)}
          </span>
        </div>
        <div className="h-3 rounded-full bg-[#0f1115] border border-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#c99805] to-[#f5c518] transition-all duration-700"
            style={{ width: `${Math.min(100, stats.percentualMeta)}%`, boxShadow: stats.percentualMeta > 0 ? '0 0 10px rgba(245,197,24,0.5)' : undefined }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {stats.percentualMeta >= 100
            ? (stats.percentualMeta > 100 ? `Sobrecarga positiva: meta superada em ${stats.percentualMeta - 100}%.` : 'Meta energizada com sucesso.')
            : `${stats.percentualMeta}% da meta mensal · faltam ${formatMoney(Math.max(0, stats.meta - stats.recebidoNoMes))}`}
          <Link to="/app/configuracoes" className="ml-2 text-[#f5c518] hover:underline">Ajustar meta</Link>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Kpi label="Orçamentos no mês" value={stats.qtdMes} delay={0} to="/app/orcamentos" />
        <KpiMoney label="Valor total orçado" value={stats.totalOrcado} delay={30} to="/app/orcamentos" />
        <Kpi label="Orçamentos aprovados" value={stats.aprovados} delay={60} to="/app/orcamentos?statusGroup=aprovado,convertido_em_os" />
        <Kpi label="Taxa de aprovação" value={Math.round(stats.taxaAprovacao)} delay={90} formatter={(n) => `${n}%`} />
        <KpiMoney label="Valor aprovado" value={stats.totalAprovado} delay={120} to="/app/orcamentos?statusGroup=aprovado,convertido_em_os" />
        <Kpi label="Aguardando resposta" value={stats.aguardando} delay={150} to="/app/orcamentos?statusGroup=enviado,visualizado,em_negociacao" />
        <Kpi label="Orçamentos recusados" value={stats.recusados} delay={165} to="/app/orcamentos?status=recusado" />
        <Kpi label="Serviços agendados" value={stats.agendadas} delay={180} to="/app/ordens-servico" />
        <Kpi label="Serviços em andamento" value={stats.emExecucao} delay={195} to="/app/ordens-servico" />
        <Kpi label="Serviços concluídos" value={stats.concluidas} delay={210} to="/app/ordens-servico" />
        <KpiMoney label="Recebido no mês" value={stats.recebidoNoMes} delay={225} to="/app/pagamentos?filtro=recebido" />
        <KpiMoney label="A receber" value={stats.aReceber} delay={240} to="/app/pagamentos?filtro=a_receber" />
        <KpiMoney label="Pagamentos vencidos" value={stats.valorVencido} hint={`${stats.qtdVencidos} pagamento(s)`} delay={255} to="/app/pagamentos?filtro=atrasado" />
        <Kpi label="Próximos compromissos" value={stats.proximosCompromissos} delay={270} to="/app/agenda" />
        <KpiMoney label="Ticket médio" value={stats.ticketMedio} delay={285} />
        <KpiMoney label="Lucro estimado (aprovados)" value={stats.lucroEstimado} hint="Interno — não exibido ao cliente" delay={300} />
      </div>

      <div className="bg-[#16181d] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-white font-medium text-sm">Orçamentos recentes</h2>
          <Link to="/app/orcamentos" className="text-xs text-[#f5c518] hover:underline">Ver todos</Link>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {recentBudgets.map(b => {
              const cliente = resolveClienteInfo(b, clients);
              const t = calculateBudget(b);
              return (
                <tr key={b.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 text-gray-300">{b.numero}</td>
                  <td className="px-5 py-3 text-gray-300">{cliente.nome}</td>
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
