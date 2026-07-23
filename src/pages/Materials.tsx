import React, { useState } from 'react';
import { Plus, X, Search, AlertTriangle } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { formatMoney } from '../lib/format';
import type { Material, UnidadeMedida } from '../types';

const unidades: UnidadeMedida[] = ['unidade', 'metro', 'rolo', 'caixa', 'pacote', 'par', 'jogo', 'kg', 'litro', 'hora', 'diaria', 'servico'];

function emptyForm() {
  return { codigo: '', nome: '', categoria: '', unidade: 'unidade' as UnidadeMedida, preco_custo: '', preco_venda: '', estoque_atual: '', estoque_minimo: '' };
}

export default function Materials() {
  const { db, addMaterial } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const filtered = db.materials.filter(m =>
    m.nome.toLowerCase().includes(query.toLowerCase()) || m.categoria.toLowerCase().includes(query.toLowerCase()) || m.codigo.toLowerCase().includes(query.toLowerCase()),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const custo = Number(form.preco_custo) || 0;
    const venda = Number(form.preco_venda) || 0;
    const data: Omit<Material, 'id' | 'organization_id' | 'created_at' | 'updated_at'> = {
      codigo: form.codigo || `MAT-${Date.now()}`, nome: form.nome, categoria: form.categoria || 'Geral',
      unidade: form.unidade, preco_custo: custo, preco_venda: venda,
      margem_padrao: venda > 0 ? Number((((venda - custo) / venda) * 100).toFixed(1)) : 0,
      estoque_atual: Number(form.estoque_atual) || 0, estoque_minimo: Number(form.estoque_minimo) || 0, ativo: true,
    };
    addMaterial(data);
    toast.show(`Material "${form.nome}" cadastrado.`);
    setForm(emptyForm());
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-white">Materiais</h1>
          <p className="text-sm text-gray-400 mt-1">{db.materials.length} materiais cadastrados · valores demonstrativos e editáveis</p>
        </div>
        <button onClick={() => setOpen(true)} className="ce-btn-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
          <Plus size={16} /> Novo material
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar material..."
          className="w-full bg-[#16181d] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
      </div>

      <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl overflow-x-auto ce-fade-up ce-fade-up-1">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-gray-400 border-b border-white/5">
              <th className="px-5 py-3 font-medium">Código</th>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Categoria</th>
              <th className="px-5 py-3 font-medium">Unid.</th>
              <th className="px-5 py-3 font-medium">Custo</th>
              <th className="px-5 py-3 font-medium">Venda</th>
              <th className="px-5 py-3 font-medium">Estoque</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                <td className="px-5 py-3 text-gray-400">{m.codigo}</td>
                <td className="px-5 py-3 text-white">{m.nome}</td>
                <td className="px-5 py-3 text-gray-300">{m.categoria}</td>
                <td className="px-5 py-3 text-gray-300">{m.unidade}</td>
                <td className="px-5 py-3 text-gray-300">{formatMoney(m.preco_custo)}</td>
                <td className="px-5 py-3 text-white font-medium">{formatMoney(m.preco_venda)}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs ${m.estoque_atual <= m.estoque_minimo ? 'text-amber-400' : 'text-gray-300'}`}>
                    {m.estoque_atual <= m.estoque_minimo && <AlertTriangle size={12} />}
                    {m.estoque_atual}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-[#16181d] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Novo material</h2>
              <button type="button" onClick={() => setOpen(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="bg-[#f5c518]/10 border border-[#f5c518]/20 rounded-lg px-3 py-2 text-xs text-amber-300">
              Dica: use um código curto e único (ex: FIO-2.5) para localizar o item rapidamente nos orçamentos.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código interno" value={form.codigo} onChange={v => setForm(f => ({ ...f, codigo: v }))} placeholder="Ex: FIO-2.5" />
              <div>
                <label className="text-xs text-gray-400">Unidade</label>
                <select value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value as UnidadeMedida }))}
                  className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
                  {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <Field label="Nome" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required placeholder="Ex: Cabo flexível 2,5 mm²" />
            <Field label="Categoria" value={form.categoria} onChange={v => setForm(f => ({ ...f, categoria: v }))} placeholder="Ex: Fios e cabos" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço de custo (R$)" value={form.preco_custo} onChange={v => setForm(f => ({ ...f, preco_custo: v }))} type="number" placeholder="Ex: 1.80" />
              <Field label="Preço de venda (R$)" value={form.preco_venda} onChange={v => setForm(f => ({ ...f, preco_venda: v }))} type="number" placeholder="Ex: 3.00" />
            </div>
            {Number(form.preco_venda) > 0 && (
              <p className="text-xs text-gray-500 -mt-2">
                Margem estimada: <span className="text-[#f5c518] font-medium">{((( Number(form.preco_venda) - Number(form.preco_custo||0)) / Number(form.preco_venda)) * 100).toFixed(1)}%</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estoque atual" value={form.estoque_atual} onChange={v => setForm(f => ({ ...f, estoque_atual: v }))} type="number" />
              <Field label="Estoque mínimo" value={form.estoque_minimo} onChange={v => setForm(f => ({ ...f, estoque_minimo: v }))} type="number" />
            </div>
            <button type="submit" className="w-full bg-[#f5c518] text-[#16181d] font-semibold rounded-lg py-2.5 text-sm hover:bg-[#e0b60f]">Salvar material</button>
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
