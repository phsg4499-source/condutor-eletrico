import React, { useState } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { formatMoney } from '../lib/format';
import type { ServiceItem, UnidadeMedida } from '../types';

const unidades: UnidadeMedida[] = ['unidade', 'metro', 'servico', 'hora', 'diaria'];

function emptyForm() {
  return { codigo: '', nome: '', categoria: '', unidade: 'servico' as UnidadeMedida, valor_padrao: '', custo_mao_obra: '' };
}

export default function Services() {
  const { db, addService } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const filtered = db.services.filter(s =>
    s.nome.toLowerCase().includes(query.toLowerCase()) || s.categoria.toLowerCase().includes(query.toLowerCase()),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(form.valor_padrao) || 0;
    const custo = Number(form.custo_mao_obra) || 0;
    const data: Omit<ServiceItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'> = {
      codigo: form.codigo || `SRV-${Date.now()}`, nome: form.nome, categoria: form.categoria || 'Geral',
      unidade: form.unidade, valor_padrao: valor, custo_mao_obra: custo,
      margem_padrao: valor > 0 ? Number((((valor - custo) / valor) * 100).toFixed(1)) : 0,
      garantia_padrao: '90 dias', ativo: true,
    };
    addService(data);
    toast.show(`Serviço "${form.nome}" cadastrado.`);
    setForm(emptyForm());
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-white">Serviços</h1>
          <p className="text-sm text-gray-400 mt-1">{db.services.length} serviços cadastrados · valores editáveis</p>
        </div>
        <button onClick={() => setOpen(true)} className="ce-btn-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
          <Plus size={16} /> Novo serviço
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar serviço..."
          className="w-full bg-[#16181d] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
      </div>

      <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl overflow-x-auto ce-fade-up ce-fade-up-1">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/5">
              <th className="px-5 py-3 font-medium">Código</th>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Categoria</th>
              <th className="px-5 py-3 font-medium">Unid.</th>
              <th className="px-5 py-3 font-medium">Custo m.o.</th>
              <th className="px-5 py-3 font-medium">Valor padrão</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-5 py-3 text-gray-400">{s.codigo}</td>
                <td className="px-5 py-3 text-white">{s.nome}</td>
                <td className="px-5 py-3 text-gray-300">{s.categoria}</td>
                <td className="px-5 py-3 text-gray-300">{s.unidade}</td>
                <td className="px-5 py-3 text-gray-300">{formatMoney(s.custo_mao_obra)}</td>
                <td className="px-5 py-3 text-white font-medium">{formatMoney(s.valor_padrao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-[#16181d] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Novo serviço</h2>
              <button type="button" onClick={() => setOpen(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="bg-[#f5c518]/10 border border-[#f5c518]/20 rounded-lg px-3 py-2 text-xs text-amber-300">
              Dica: o "custo de mão de obra" é o que você paga (seu ou do eletricista); o "valor padrão" é o que você cobra do cliente.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código" value={form.codigo} onChange={v => setForm(f => ({ ...f, codigo: v }))} placeholder="Ex: INST-TOM" />
              <div>
                <label className="text-xs text-gray-400">Unidade</label>
                <select value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value as UnidadeMedida }))}
                  className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
                  {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <Field label="Nome" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required placeholder="Ex: Instalação de tomada" />
            <Field label="Categoria" value={form.categoria} onChange={v => setForm(f => ({ ...f, categoria: v }))} placeholder="Ex: Instalações" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Custo de mão de obra (R$)" value={form.custo_mao_obra} onChange={v => setForm(f => ({ ...f, custo_mao_obra: v }))} type="number" placeholder="Ex: 35" />
              <Field label="Valor padrão (R$)" value={form.valor_padrao} onChange={v => setForm(f => ({ ...f, valor_padrao: v }))} type="number" placeholder="Ex: 60" />
            </div>
            <button type="submit" className="w-full bg-[#f5c518] text-[#16181d] font-semibold rounded-lg py-2.5 text-sm hover:bg-[#e0b60f]">Salvar serviço</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, required, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}{required && ' *'}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required} type={type} placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
    </div>
  );
}
