import { useMemo, type ReactNode, type ComponentType } from 'react';
import { useStore } from '../lib/store';
import CountUp from '../components/CountUp';
import MultimeterGauge from '../components/MultimeterGauge';
import { calculateBudget } from '../lib/calculations';
import { formatMoney } from '../lib/format';
import { BudgetStatusBadge } from '../components/StatusBadge';
import { resolveClienteInfo } from '../lib/clientInfo';
import { getEffectivePaymentStatus } from '../components/PaymentForm';
import { Link } from 'react-router-dom';
import {
  Plus, FileText, Banknote, CheckCircle2, Percent, TrendingUp, Hourglass, XCircle,
  CalendarClock, Wrench, ListChecks, Wallet, Clock, AlertTriangle, CalendarDays, Receipt, PiggyBank,
} from 'lucide-react';

type Accent = 'neutral' | 'energy' | 'success' | 'danger' | 'info';

const ACCENTS: Record<Accent, { bg: string; text: string; ring: string }> = {
  neutral: { bg: 'bg-white/[0.06]', text: 'text-gray-300', ring: 'group-hover:border-white/20' },
  energy: { bg: 'bg-[#f5c518]/15', text: 'text-[#f5c518]', ring: 'group-hover:border-[#f5c518]/40' },
  success: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'group-hover:border-emerald-500/40' },
  danger: { bg: 'bg-red-500/15', text: 'text-red-400', ring: 'group-hover:border-red-500/40' },
  info: { bg: 'bg-sky-500/15', text: 'text-sky-400', ring: 'group-hover:border-sky-500/40' },
};

function CardShell({ to, delay, accent = 'neutral', children }: { to?: string; delay: number; accent?: Accent; children: ReactNode }) {
  const a = ACCENTS[accent];
  const className = `group ce-card-hover ce-fade-up relative bg-[#16181d] border border-white/5 rounded-xl p-4 overflow-hidden ${a.ring} ${to ? 'cursor-pointer' : ''}`;
  if (to) return <Link to={to} className={`block ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</Link>;
  return <div className={className} style={{ animationDelay: `${delay}ms` }}>{children}</div>;
}

function CardIcon({ icon: Icon, accent }: { icon: ComponentType<{ size?: number; className?: string }>; accent: Accent }) {
  const a = ACCENTS[accent];
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.bg} ${a.text}`}>
      <Icon size={16} />
    </div>
  );
}

function Kpi({ label, value, hint, delay = 0, formatter, to, icon, accent = 'neutral' }: {
  label: string; value: number; hint?: string; delay?: number; formatter?: (n: number) => string; to?: string;
  icon: ComponentType<{ size?: number; className?: string }>; accent?: Accent;
}) {
  return (
    <CardShell to={to} delay={delay} accent={accent}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-gray-400 tracking-wide truncate">{label}</div>
          <div className="text-xl font-semibold text-white mt-1.5 tabular-nums"><CountUp value={value} formatter={formatter} /></div>
          {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
        </div>
        <CardIcon icon={icon} accent={accent} />
      </div>
    </CardShell>
  );
}

function KpiMoney(props: Omit<Parameters<typeof Kpi>[0], 'formatter'>) {
  return <Kpi {...props} formatter={formatMoney} />;
}

export default function Dashboard() {
  const { db, user } = useStore();
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

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = (user?.nome ?? '').split(' ')[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{saudacao}{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
          <p className="text-sm text-gray-400 mt-1">Painel geral — indicadores comerciais e financeiros da Condutor Elétrico.</p>
        </div>
        <Link
          to="/app/orcamentos/novo"
          className="ce-btn-glow ce-cta-glow flex items-center justify-center gap-2 bg-gradient-to-r from-[#f5c518] to-[#e0b60f] text-[#16181d] font-semibold px-5 py-3 rounded-xl text-sm shrink-0 shadow-[0_4px_20px_-6px_rgba(245,197,24,0.5)]"
        >
          <Plus size={18} strokeWidth={2.5} />
          Novo orçamento
        </Link>
      </div>

      <div className="ce-fade-up">
        <MultimeterGauge recebido={stats.recebidoNoMes} meta={stats.meta} percentual={stats.percentualMeta} aReceber={stats.aReceber} />
        <p className="text-xs text-gray-500 mt-2 text-right">
          <Link to="/app/configuracoes" className="text-[#f5c518] hover:underline">Ajustar meta mensal</Link>
        </p>
      </div>

      <div>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Orçamentos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <Kpi label="Orçamentos no mês" value={stats.qtdMes} delay={0} to="/app/orcamentos" icon={FileText} />
          <KpiMoney label="Valor total orçado" value={stats.totalOrcado} delay={30} to="/app/orcamentos" icon={Banknote} />
          <Kpi label="Aprovados" value={stats.aprovados} delay={60} to="/app/orcamentos?statusGroup=aprovado,convertido_em_os" icon={CheckCircle2} accent="success" />
          <Kpi label="Taxa de aprovação" value={Math.round(stats.taxaAprovacao)} delay={90} formatter={(n) => `${n}%`} icon={Percent} accent="info" />
          <KpiMoney label="Valor aprovado" value={stats.totalAprovado} delay={120} to="/app/orcamentos?statusGroup=aprovado,convertido_em_os" icon={TrendingUp} accent="success" />
          <Kpi label="Aguardando resposta" value={stats.aguardando} delay={150} to="/app/orcamentos?statusGroup=enviado,visualizado,em_negociacao" icon={Hourglass} accent="info" />
          <Kpi label="Recusados" value={stats.recusados} delay={165} to="/app/orcamentos?status=recusado" icon={XCircle} accent="danger" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Serviços</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <Kpi label="Agendados" value={stats.agendadas} delay={180} to="/app/ordens-servico" icon={CalendarClock} accent="info" />
          <Kpi label="Em andamento" value={stats.emExecucao} delay={195} to="/app/ordens-servico" icon={Wrench} accent="energy" />
          <Kpi label="Concluídos" value={stats.concluidas} delay={210} to="/app/ordens-servico" icon={ListChecks} accent="success" />
          <Kpi label="Próximos compromissos" value={stats.proximosCompromissos} delay={270} to="/app/agenda" icon={CalendarDays} />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Financeiro</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiMoney label="Recebido no mês" value={stats.recebidoNoMes} delay={225} to="/app/pagamentos?filtro=recebido" icon={Wallet} accent="success" />
          <KpiMoney label="A receber" value={stats.aReceber} delay={240} to="/app/pagamentos?filtro=a_receber" icon={Clock} accent="info" />
          <KpiMoney label="Vencidos" value={stats.valorVencido} hint={`${stats.qtdVencidos} pagamento(s)`} delay={255} to="/app/pagamentos?filtro=atrasado" icon={AlertTriangle} accent="danger" />
          <KpiMoney label="Ticket médio" value={stats.ticketMedio} delay={285} icon={Receipt} />
          <KpiMoney label="Lucro estimado (aprovados)" value={stats.lucroEstimado} hint="Interno — não exibido ao cliente" delay={300} icon={PiggyBank} accent="energy" />
        </div>
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
                <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
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
