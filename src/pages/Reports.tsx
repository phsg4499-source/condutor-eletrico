import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { calculateBudget } from '../lib/calculations';
import { formatMoney } from '../lib/format';

export default function Reports() {
  const { db } = useStore();

  const data = useMemo(() => {
    let receita = 0, custo = 0;
    const porServico = new Map<string, number>();
    db.budgets.forEach(b => {
      const t = calculateBudget(b);
      if (b.status === 'aprovado' || b.status === 'convertido_em_os') {
        receita += t.totalVenda;
        custo += t.totalCusto;
      }
      b.itens.filter(i => i.tipo === 'servico').forEach(i => {
        porServico.set(i.nome, (porServico.get(i.nome) ?? 0) + i.quantidade);
      });
    });
    const materiaisMaisUsados = new Map<string, number>();
    db.budgets.forEach(b => b.itens.filter(i => i.tipo === 'material').forEach(i => {
      materiaisMaisUsados.set(i.nome, (materiaisMaisUsados.get(i.nome) ?? 0) + i.quantidade);
    }));

    const aprovados = db.budgets.filter(b => b.status === 'aprovado' || b.status === 'convertido_em_os').length;
    const recusados = db.budgets.filter(b => b.status === 'recusado').length;
    const taxaConversao = db.budgets.length ? (aprovados / db.budgets.length) * 100 : 0;

    return {
      receita, custo, lucro: receita - custo,
      servicos: [...porServico.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      materiais: [...materiaisMaisUsados.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      aprovados, recusados, taxaConversao,
      vencidos: db.payments.filter(p => p.status === 'atrasado').reduce((a, p) => a + p.valor, 0),
      aReceber: db.payments.filter(p => p.status === 'pendente').reduce((a, p) => a + p.valor, 0),
    };
  }, [db]);

  return (
    <div className="space-y-6">
      <div className="ce-fade-up">
        <h1 className="text-2xl font-semibold text-[#0b2338]">Relatórios</h1>
        <p className="text-sm text-slate-500 mt-1">Visão consolidada de orçamentos, serviços e financeiro.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card label="Receita (aprovados)" value={formatMoney(data.receita)} />
        <Card label="Custo (aprovados)" value={formatMoney(data.custo)} />
        <Card label="Lucro (aprovados)" value={formatMoney(data.lucro)} />
        <Card label="Taxa de conversão" value={`${data.taxaConversao.toFixed(0)}%`} />
        <Card label="A receber" value={formatMoney(data.aReceber)} />
        <Card label="Vencido" value={formatMoney(data.vencidos)} />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-[#0b2338] font-medium text-sm mb-3">Serviços mais orçados</h2>
          {data.servicos.map(([nome, qtd]) => (
            <div key={nome} className="flex justify-between text-sm py-1.5 border-b border-slate-200 last:border-0">
              <span className="text-slate-600">{nome}</span><span className="text-[#0b2338]">{qtd}</span>
            </div>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-[#0b2338] font-medium text-sm mb-3">Materiais mais utilizados</h2>
          {data.materiais.map(([nome, qtd]) => (
            <div key={nome} className="flex justify-between text-sm py-1.5 border-b border-slate-200 last:border-0">
              <span className="text-slate-600">{nome}</span><span className="text-[#0b2338]">{qtd}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-[#0b2338] mt-1">{value}</div>
    </div>
  );
}
