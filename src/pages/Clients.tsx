import React, { useState } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import type { Client, TipoPessoa, OrigemCliente } from '../types';

const origemOptions: { value: OrigemCliente; label: string }[] = [
  { value: 'indicacao', label: 'Indicação' }, { value: 'instagram', label: 'Instagram' },
  { value: 'site', label: 'Site' }, { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google', label: 'Google' }, { value: 'outro', label: 'Outro' },
];

function emptyForm() {
  return {
    tipo_pessoa: 'fisica' as TipoPessoa, nome: '', documento: '', telefone: '', whatsapp: '', email: '',
    origem: 'indicacao' as OrigemCliente, cep: '', logradouro: '', numero: '', bairro: '', cidade: '', estado: '',
  };
}

export default function Clients() {
  const { db, addClient } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [salvando, setSalvando] = useState(false);

  const filtered = db.clients.filter(c =>
    c.nome.toLowerCase().includes(query.toLowerCase()) ||
    c.telefone.includes(query) ||
    (c.documento ?? '').includes(query),
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) return;
    if (salvando) return; // evita duplo clique/duplo envio
    const newClient: Omit<Client, 'id' | 'organization_id' | 'created_at' | 'updated_at'> = {
      tipo_pessoa: form.tipo_pessoa, nome: form.nome, documento: form.documento || undefined,
      telefone: form.telefone, whatsapp: form.whatsapp || form.telefone, email: form.email || undefined,
      origem: form.origem, status: 'ativo', tags: [],
      enderecos: form.logradouro ? [{
        id: `end-${Date.now()}`, rotulo: 'Principal', cep: form.cep, logradouro: form.logradouro,
        numero: form.numero, bairro: form.bairro, cidade: form.cidade, estado: form.estado,
      }] : [],
    };
    setSalvando(true);
    try {
      // Só mostra sucesso depois de confirmar a gravação real no Supabase — antes disso, o
      // cadastro parecia funcionar na hora, mas podia sumir ao recarregar a página se a gravação
      // remota tivesse falhado silenciosamente.
      const result = await addClient(newClient);
      if (!result.ok) {
        toast.show(result.error ?? 'Não foi possível cadastrar o cliente.', 'warning');
        return;
      }
      toast.show(`Cliente "${form.nome}" cadastrado com sucesso.`);
      setForm(emptyForm());
      setOpen(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-[#0b2338]">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">{db.clients.length} clientes cadastrados</p>
        </div>
        <button onClick={() => setOpen(true)} className="ce-btn-glow flex items-center gap-2 bg-[#00B4E5] text-[#0b2338] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#0069A8]">
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome, telefone ou documento..."
          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
      </div>

      <div className="ce-card-hover bg-white border border-slate-200 rounded-xl overflow-x-auto ce-fade-up ce-fade-up-1">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 font-medium">Telefone</th>
              <th className="px-5 py-3 font-medium">Origem</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-100">
                <td className="px-5 py-3 text-[#0b2338]">{c.nome}</td>
                <td className="px-5 py-3 text-slate-600 capitalize">{c.tipo_pessoa === 'fisica' ? 'Pessoa física' : 'Pessoa jurídica'}</td>
                <td className="px-5 py-3 text-slate-600">{c.telefone}</td>
                <td className="px-5 py-3 text-slate-600 capitalize">{c.origem}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${c.status === 'ativo' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-600/20 text-slate-500'}`}>{c.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[#0b2338] font-semibold">Novo cliente</h2>
              <button type="button" onClick={() => setOpen(false)}><X size={18} className="text-slate-500" /></button>
            </div>

            <div className="flex gap-2">
              {(['fisica', 'juridica'] as TipoPessoa[]).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo_pessoa: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm border ${form.tipo_pessoa === t ? 'bg-[#00B4E5] text-[#0b2338] border-[#00B4E5]' : 'border-slate-200 text-slate-600'}`}>
                  {t === 'fisica' ? 'Pessoa física' : 'Pessoa jurídica'}
                </button>
              ))}
            </div>

            <div className="bg-[#00B4E5]/10 border border-[#00B4E5]/20 rounded-lg px-3 py-2 text-xs text-[#0069A8]">
              Dica: preencha o WhatsApp com DDI + DDD, só números (ex: 5511999998888) — assim o botão de enviar mensagem funciona direto.
            </div>
            <Field label={form.tipo_pessoa === 'fisica' ? 'Nome completo' : 'Razão social'} value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required placeholder={form.tipo_pessoa === 'fisica' ? 'Ex: Marcos Andrade' : 'Ex: Comercial Bela Vista Ltda'} />
            <Field label={form.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'} value={form.documento} onChange={v => setForm(f => ({ ...f, documento: v }))} placeholder={form.tipo_pessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0001-00'} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefone" value={form.telefone} onChange={v => setForm(f => ({ ...f, telefone: v }))} required placeholder="(11) 90000-0000" />
              <Field label="WhatsApp" value={form.whatsapp} onChange={v => setForm(f => ({ ...f, whatsapp: v }))} placeholder="5511900000000" />
            </div>
            <Field label="E-mail" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" placeholder="cliente@exemplo.com" />

            <div>
              <label className="text-xs text-slate-500">Origem do cliente</label>
              <select value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value as OrigemCliente }))}
                className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
                {origemOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <p className="text-xs text-slate-400 pt-1">Endereço do serviço (opcional)</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="CEP" value={form.cep} onChange={v => setForm(f => ({ ...f, cep: v }))} />
              <Field label="Número" value={form.numero} onChange={v => setForm(f => ({ ...f, numero: v }))} />
              <Field label="Estado" value={form.estado} onChange={v => setForm(f => ({ ...f, estado: v }))} />
            </div>
            <Field label="Logradouro" value={form.logradouro} onChange={v => setForm(f => ({ ...f, logradouro: v }))} placeholder="Ex: Rua das Palmeiras" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bairro" value={form.bairro} onChange={v => setForm(f => ({ ...f, bairro: v }))} />
              <Field label="Cidade" value={form.cidade} onChange={v => setForm(f => ({ ...f, cidade: v }))} />
            </div>

            <button type="submit" disabled={salvando} className="w-full bg-[#00B4E5] text-[#0b2338] font-semibold rounded-lg py-2.5 text-sm hover:bg-[#0069A8] disabled:opacity-60 disabled:cursor-not-allowed">
              {salvando ? 'Salvando...' : 'Salvar cliente'}
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
      <label className="text-xs text-slate-500">{label}{required && ' *'}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required} type={type} placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
    </div>
  );
}
