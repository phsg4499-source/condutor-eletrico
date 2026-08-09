import { useParams, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { formatDate } from '../lib/format';
import { ServiceOrderStatusBadge, serviceOrderStatusOptions } from '../components/StatusBadge';
import { resolveClienteInfo } from '../lib/clientInfo';
import type { ServiceOrderStatus } from '../types';

export function ServiceOrdersList() {
  const { db } = useStore();
  return (
    <div className="space-y-6">
      <div className="ce-fade-up">
        <h1 className="text-2xl font-semibold text-[#0b2338]">Ordens de Serviço</h1>
        <p className="text-sm text-slate-500 mt-1">{db.serviceOrders.length} ordens de serviço</p>
      </div>
      <div className="ce-card-hover bg-white border border-slate-200 rounded-xl overflow-x-auto ce-fade-up ce-fade-up-1">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-5 py-3 font-medium">Número</th>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Responsável</th>
              <th className="px-5 py-3 font-medium">Data prevista</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {db.serviceOrders.map(o => {
              const cliente = resolveClienteInfo(o, db.clients);
              return (
                <tr key={o.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-100">
                  <td className="px-5 py-3 text-slate-600">{o.numero}</td>
                  <td className="px-5 py-3 text-[#0b2338]">{cliente.nome}</td>
                  <td className="px-5 py-3 text-slate-600">{o.responsavel_tecnico}</td>
                  <td className="px-5 py-3 text-slate-600">{o.data_prevista ? formatDate(o.data_prevista) : '—'}</td>
                  <td className="px-5 py-3"><ServiceOrderStatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-right"><Link to={`/app/ordens-servico/${o.id}`} className="text-xs text-[#00B4E5] hover:underline">Abrir</Link></td>
                </tr>
              );
            })}
            {db.serviceOrders.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Nenhuma ordem de serviço ainda. Aprove um orçamento e converta-o.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ServiceOrderView() {
  const { id } = useParams();
  const { db, setServiceOrderStatus, toggleChecklistItem } = useStore();
  const order = db.serviceOrders.find(o => o.id === id);
  const budget = order ? db.budgets.find(b => b.id === order.budget_id) : undefined;

  if (!order) {
    return <div className="text-slate-500">Ordem de serviço não encontrada. <Link to="/app/ordens-servico" className="text-[#00B4E5] hover:underline">Voltar</Link></div>;
  }

  const cliente = resolveClienteInfo(order, db.clients);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/app/ordens-servico" className="text-sm text-slate-500 hover:text-[#0b2338]">← Voltar</Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0b2338]">{order.numero}</h1>
          <p className="text-sm text-slate-500 mt-1">Cliente: {cliente.nome} {budget && `· Origem: orçamento ${budget.numero}`}</p>
        </div>
        <ServiceOrderStatusBadge status={order.status} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <label className="text-xs text-slate-500">Status</label>
        <select value={order.status} onChange={e => setServiceOrderStatus(order.id, e.target.value as ServiceOrderStatus)}
          className="mt-1 w-full sm:w-64 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
          {serviceOrderStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-[#0b2338] font-medium text-sm mb-3">Checklist técnico</h2>
        <div className="space-y-2">
          {order.checklist.map((item, idx) => (
            <label key={idx} className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={item.concluido} onChange={() => toggleChecklistItem(order.id, idx)} className="accent-[#00B4E5]" />
              {item.item}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
