import { useParams, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { formatDate } from '../lib/format';
import { ServiceOrderStatusBadge, serviceOrderStatusOptions } from '../components/StatusBadge';
import type { ServiceOrderStatus } from '../types';

export function ServiceOrdersList() {
  const { db } = useStore();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Ordens de Serviço</h1>
        <p className="text-sm text-gray-400 mt-1">{db.serviceOrders.length} ordens de serviço</p>
      </div>
      <div className="bg-[#16181d] border border-white/5 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/5">
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
              const client = db.clients.find(c => c.id === o.client_id);
              return (
                <tr key={o.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="px-5 py-3 text-gray-300">{o.numero}</td>
                  <td className="px-5 py-3 text-white">{client?.nome ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-300">{o.responsavel_tecnico}</td>
                  <td className="px-5 py-3 text-gray-300">{o.data_prevista ? formatDate(o.data_prevista) : '—'}</td>
                  <td className="px-5 py-3"><ServiceOrderStatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-right"><Link to={`/app/ordens-servico/${o.id}`} className="text-xs text-[#f5c518] hover:underline">Abrir</Link></td>
                </tr>
              );
            })}
            {db.serviceOrders.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Nenhuma ordem de serviço ainda. Aprove um orçamento e converta-o.</td></tr>
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
  const client = order ? db.clients.find(c => c.id === order.client_id) : undefined;
  const budget = order ? db.budgets.find(b => b.id === order.budget_id) : undefined;

  if (!order) {
    return <div className="text-gray-400">Ordem de serviço não encontrada. <Link to="/app/ordens-servico" className="text-[#f5c518] hover:underline">Voltar</Link></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/app/ordens-servico" className="text-sm text-gray-400 hover:text-white">← Voltar</Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{order.numero}</h1>
          <p className="text-sm text-gray-400 mt-1">Cliente: {client?.nome} {budget && `· Origem: orçamento ${budget.numero}`}</p>
        </div>
        <ServiceOrderStatusBadge status={order.status} />
      </div>

      <div className="bg-[#16181d] border border-white/5 rounded-xl p-5">
        <label className="text-xs text-gray-400">Status</label>
        <select value={order.status} onChange={e => setServiceOrderStatus(order.id, e.target.value as ServiceOrderStatus)}
          className="mt-1 w-full sm:w-64 rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
          {serviceOrderStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="bg-[#16181d] border border-white/5 rounded-xl p-5">
        <h2 className="text-white font-medium text-sm mb-3">Checklist técnico</h2>
        <div className="space-y-2">
          {order.checklist.map((item, idx) => (
            <label key={idx} className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={item.concluido} onChange={() => toggleChecklistItem(order.id, idx)} className="accent-[#f5c518]" />
              {item.item}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
