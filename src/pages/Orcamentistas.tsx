import React, { useState } from 'react';
import { Plus, X, UserCog } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import type { Orcamentista } from '../types';

function emptyForm() {
  return { nome: '', telefone: '', email: '', cargo: 'Orçamentista', observacoes: '', aparece_no_pdf: true };
}

export default function Orcamentistas() {
  const { db, addOrcamentista, updateOrcamentista } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const data: Omit<Orcamentista, 'id' | 'organization_id' | 'created_at' | 'updated_at'> = {
      nome: form.nome, telefone: form.telefone || undefined, email: form.email || undefined,
      cargo: form.cargo || 'Orçamentista', status: 'ativo', observacoes: form.observacoes || undefined,
      aparece_no_pdf: form.aparece_no_pdf,
    };
    addOrcamentista(data);
    toast.show(`Orçamentista "${form.nome}" cadastrado.`);
    setForm(emptyForm());
    setOpen(false);
  }

  function toggleStatus(o: Orcamentista) {
    updateOrcamentista(o.id, { status: o.status === 'ativo' ? 'inativo' : 'ativo' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orçamentistas</h1>
          <p className="text-sm text-gray-400 mt-1">
            Quem monta os orçamentos na sua empresa. O responsável escolhido aparece no PDF entregue ao cliente.
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="ce-btn-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
          <Plus size={16} /> Novo orçamentista
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {db.orcamentistas.map((o, i) => (
          <div key={o.id} className="ce-card-hover ce-fade-up bg-[#16181d] border border-white/5 rounded-xl p-5" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-full bg-[#f5c518]/15 flex items-center justify-center">
                <UserCog className="text-[#f5c518]" size={20} />
              </div>
              <button onClick={() => toggleStatus(o)}
                className={`text-xs px-2 py-1 rounded-full ${o.status === 'ativo' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-600/20 text-gray-400'}`}>
                {o.status}
              </button>
            </div>
            <h3 className="text-white font-medium mt-3">{o.nome}</h3>
            <p className="text-xs text-gray-500">{o.cargo}</p>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              {o.telefone && <p>{o.telefone}</p>}
              {o.email && <p>{o.email}</p>}
            </div>
            {o.observacoes && <p className="text-xs text-gray-500 mt-3 border-t border-white/5 pt-3">{o.observacoes}</p>}
            <p className="text-[11px] text-gray-600 mt-3">{o.aparece_no_pdf ? 'Aparece no PDF' : 'Não aparece no PDF'}</p>
          </div>
        ))}
        {db.orcamentistas.length === 0 && (
          <p className="text-sm text-gray-500 col-span-full">Nenhum orçamentista cadastrado ainda.</p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit} className="ce-glass-card ce-pop-in rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Novo orçamentista</h2>
              <button type="button" onClick={() => setOpen(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <Field label="Nome completo" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required placeholder="Ex: Renata Duarte" />
            <Field label="Cargo / função" value={form.cargo} onChange={v => setForm(f => ({ ...f, cargo: v }))} placeholder="Ex: Orçamentista, Eletricista responsável..." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone" value={form.telefone} onChange={v => setForm(f => ({ ...f, telefone: v }))} placeholder="(11) 90000-0000" />
              <Field label="E-mail" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Observações</label>
              <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2}
                className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.aparece_no_pdf} onChange={e => setForm(f => ({ ...f, aparece_no_pdf: e.target.checked }))} className="accent-[#f5c518]" />
              Exibir nome no PDF do orçamento como responsável
            </label>
            <button type="submit" className="ce-btn-glow w-full bg-[#f5c518] text-[#16181d] font-semibold rounded-lg py-2.5 text-sm hover:bg-[#e0b60f]">
              Salvar orçamentista
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, required, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}{required && ' *'}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required} type={type} placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
    </div>
  );
}
