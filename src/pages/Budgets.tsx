import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { calculateBudget } from '../lib/calculations';
import { formatMoney, formatDate } from '../lib/format';
import { BudgetStatusBadge, budgetStatusOptions } from '../components/StatusBadge';
import { resolveClienteInfo } from '../lib/clientInfo';
import type { BudgetStatus } from '../types';

export default function Budgets() {
  const { db, deleteBudget } = useStore();
  const toast = useToast();

  function handleDelete(id: string, numero: string) {
    if (!window.confirm(`Tem certeza que quer excluir o orçamento nº ${numero}? Essa ação não pode ser desfeita.`)) return;
    deleteBudget(id);
    toast.show('Orçamento excluído.', 'info');
  }
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BudgetStatus | 'todos'>('todos');

  const filtered = db.budgets.filter(b => {
    const cliente = resolveClienteInfo(b, db.clients);
    const matchesQuery = b.numero.includes(query) || b.titulo.toLowerCase().includes(query.toLowerCase()) || cliente.nome.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'todos' || b.status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orçamentos</h1>
          <p className="text-sm text-gray-400 mt-1">{db.budgets.length} orçamentos cadastrados</p>
        </div>
        <Link to="/app/orcamentos/novo" className="ce-btn-glow ce-cta-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
          <Plus size={16} /> Novo orçamento
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por número, título ou cliente..."
            className="w-full bg-[#16181d] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value as BudgetStatus | 'todos')}
          className="bg-[#16181d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          <option value="todos">Todos os status</option>
          {budgetStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl overflow-x-auto ce-fade-up ce-fade-up-1">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/5">
              <th className="px-5 py-3 font-medium">Número</th>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Título</th>
              <th className="px-5 py-3 font-medium">Emissão</th>
              <th className="px-5 py-3 font-medium">Valor</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => {
              const cliente = resolveClienteInfo(b, db.clients);
              const totals = calculateBudget(b);
              return (
                <tr key={b.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="px-5 py-3 text-gray-300">{b.numero}</td>
                  <td className="px-5 py-3 text-white">
                    {cliente.nome}
                    {!cliente.cadastrado && <span className="ml-1.5 text-[9px] uppercase text-amber-400">sem cadastro</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-300">{b.titulo}</td>
                  <td className="px-5 py-3 text-gray-300">{formatDate(b.data_emissao)}</td>
                  <td className="px-5 py-3 text-white font-medium">{formatMoney(totals.totalVenda)}</td>
                  <td className="px-5 py-3"><BudgetStatusBadge status={b.status} /></td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Link to={`/app/orcamentos/${b.id}`} className="text-xs text-[#f5c518] hover:underline">Abrir</Link>
                    <button onClick={() => handleDelete(b.id, b.numero)} title="Excluir orçamento" className="ml-3 text-gray-500 hover:text-red-400 align-middle">
                      <Trash2 size={14} className="inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">Nenhum orçamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
