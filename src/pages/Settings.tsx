import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';

export default function Settings() {
  const { db, updateOrganization } = useStore();
  const toast = useToast();
  const [form, setForm] = useState(db.organization);
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    updateOrganization(form);
    setSaved(true);
    toast.show('Configurações salvas com sucesso.');
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Configurações da empresa</h1>
        <p className="text-sm text-gray-400 mt-1">Estes dados são usados no site institucional, PDF e mensagens.</p>
      </div>
      <form onSubmit={submit} className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome fantasia" value={form.nome_fantasia} onChange={v => setForm(f => ({ ...f, nome_fantasia: v }))} />
          <Field label="Responsável" value={form.responsavel} onChange={v => setForm(f => ({ ...f, responsavel: v }))} />
          <Field label="Telefone" value={form.telefone} onChange={v => setForm(f => ({ ...f, telefone: v }))} />
          <Field label="WhatsApp (só números, com DDI)" value={form.whatsapp} onChange={v => setForm(f => ({ ...f, whatsapp: v }))} />
          <Field label="E-mail" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
          <Field label="Instagram" value={form.instagram} onChange={v => setForm(f => ({ ...f, instagram: v }))} />
          <Field label="CNPJ/CPF" value={form.documento} onChange={v => setForm(f => ({ ...f, documento: v }))} />
          <Field label="Chave Pix" value={form.chave_pix ?? ''} onChange={v => setForm(f => ({ ...f, chave_pix: v }))} />
          <Field label="Prazo de validade padrão (dias)" value={String(form.prazo_validade_padrao_dias)} onChange={v => setForm(f => ({ ...f, prazo_validade_padrao_dias: Number(v) || 0 }))} />
          <Field label="Garantia padrão" value={form.garantia_padrao} onChange={v => setForm(f => ({ ...f, garantia_padrao: v }))} />
        </div>
        <div>
          <label className="text-xs text-gray-400">Frase de experiência (aparece no cabeçalho do PDF)</label>
          <input value={form.experiencia ?? ''} onChange={e => setForm(f => ({ ...f, experiencia: e.target.value }))}
            placeholder="Ex: Mais de 10 anos de atuação em instalações elétricas."
            className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
        </div>
        <button type="submit" className="ce-btn-glow bg-[#f5c518] text-[#16181d] font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-[#e0b60f]">Salvar configurações</button>
        {saved && <span className="ml-3 text-xs text-emerald-400">Salvo com sucesso.</span>}
      </form>

      <form onSubmit={submit} className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-medium">Precificação</h2>
          <p className="text-xs text-gray-500 mt-1">Define como o sistema calcula margem e alerta sobre preços baixos nos orçamentos.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400">Modo de cálculo de margem</label>
            <select value={form.modo_calculo_margem} onChange={e => setForm(f => ({ ...f, modo_calculo_margem: e.target.value as typeof f.modo_calculo_margem }))}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              <option value="markup_sobre_custo">Markup sobre o custo</option>
              <option value="margem_sobre_venda">Margem sobre a venda</option>
              <option value="valor_fixo">Valor fixo por item</option>
              <option value="percentual_geral">Percentual geral do orçamento</option>
            </select>
          </div>
          <Field label="Margem mínima aceitável (%)" value={String(form.margem_minima_percentual)} onChange={v => setForm(f => ({ ...f, margem_minima_percentual: Number(v) || 0 }))} />
          <Field label="Impostos estimados (%)" value={String(form.impostos_estimados_percentual)} onChange={v => setForm(f => ({ ...f, impostos_estimados_percentual: Number(v) || 0 }))} />
        </div>
        <p className="text-xs text-gray-500">
          Orçamentos com margem abaixo do mínimo configurado mostram um alerta na etapa de revisão e na tela do orçamento.
        </p>
        <button type="submit" className="ce-btn-glow bg-[#f5c518] text-[#16181d] font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-[#e0b60f]">Salvar precificação</button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
    </div>
  );
}
