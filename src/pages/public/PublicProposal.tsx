import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, MessageCircle, CheckCircle2, XCircle, Edit3 } from 'lucide-react';
import Logo from '../../components/Logo';
import { useStore } from '../../lib/store';
import { useToast } from '../../lib/toast';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { calculateBudget } from '../../lib/calculations';
import { generateBudgetPdf } from '../../lib/pdf';
import { whatsappLink } from '../../lib/whatsapp';
import { formatMoney, formatDate, addDays } from '../../lib/format';
import type { Budget, BudgetLineItem, ExtraCost, Organization } from '../../types';

const formasPagamentoLabel: Record<string, string> = {
  pix: 'Pix', dinheiro: 'Dinheiro', transferencia: 'Transferência bancária', boleto: 'Boleto',
  debito: 'Cartão de débito', credito: 'Cartão de crédito', entrada_parcelas: 'Entrada + parcelas', a_combinar: 'A combinar',
};

const RESPONDED_STATUSES = ['aprovado', 'aprovado_parcialmente', 'recusado', 'convertido_em_os'];

interface ViewModel {
  budget: Pick<Budget, 'id' | 'numero' | 'titulo' | 'tipo_servico' | 'local_servico' | 'data_emissao' | 'validade_dias' | 'prazo_estimado' | 'status' | 'desconto_percentual' | 'desconto_valor' | 'forma_pagamento' | 'entrada' | 'parcelas' | 'garantia' | 'observacoes_cliente' | 'itens' | 'custos_extras'>;
  cliente: { nome: string; telefone?: string; whatsapp?: string };
  org: Organization;
}

export default function PublicProposal() {
  const { token } = useParams();
  const { db, setBudgetStatus } = useStore();
  const toast = useToast();
  const [vm, setVm] = useState<ViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondendo, setRespondendo] = useState<'aprovado' | 'recusado' | 'solicitou_alteracao' | null>(null);
  const [nome, setNome] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [respondido, setRespondido] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!token) { setError('Link inválido.'); setLoading(false); return; }

      if (!isSupabaseConfigured) {
        // Modo demonstração: os dados já estão em memória/localStorage.
        const budget = db.budgets.find(b => b.link_publico_token === token);
        if (!budget) { setError('Orçamento não encontrado ou link inválido.'); setLoading(false); return; }
        const client = budget.client_id ? db.clients.find(c => c.id === budget.client_id) : undefined;
        setVm({
          budget,
          cliente: {
            nome: client?.nome || budget.cliente_nome_avulso || 'Cliente',
            telefone: client?.telefone || budget.cliente_telefone_avulso || undefined,
            whatsapp: client?.whatsapp || budget.cliente_whatsapp_avulso || budget.cliente_telefone_avulso || undefined,
          },
          org: db.organization,
        });
        setLoading(false);
        return;
      }

      if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return; }
      const rpcResult: any = await supabase.rpc('public_get_budget', { p_token: token }).maybeSingle();
      const data: any = rpcResult.data;
      const rpcError = rpcResult.error;
      if (!active) return;
      if (rpcError || !data) {
        setError('Orçamento não encontrado ou link inválido/expirado.');
        setLoading(false);
        return;
      }
      const itens: BudgetLineItem[] = (data.itens ?? []).map((i: any, idx: number) => ({
        id: String(idx), tipo: i.tipo, nome: i.nome, descricao: i.descricao ?? undefined,
        quantidade: Number(i.quantidade), unidade: i.unidade, custo_unitario: 0,
        valor_unitario: Number(i.valor_unitario), desconto: Number(i.desconto ?? 0),
      }));
      const custos_extras: ExtraCost[] = (data.custos_extras ?? []).map((c: any, idx: number) => ({
        id: String(idx), descricao: c.descricao, valor: Number(c.valor),
      }));
      setVm({
        budget: {
          id: data.id, numero: data.numero, titulo: data.titulo, tipo_servico: data.tipo_servico,
          local_servico: data.local_servico, data_emissao: data.data_emissao, validade_dias: data.validade_dias,
          prazo_estimado: data.prazo_estimado, status: data.status, desconto_percentual: Number(data.desconto_percentual ?? 0),
          desconto_valor: Number(data.desconto_valor ?? 0), forma_pagamento: data.forma_pagamento,
          entrada: Number(data.entrada ?? 0), parcelas: Number(data.parcelas ?? 1), garantia: data.garantia,
          observacoes_cliente: data.observacoes_cliente, itens, custos_extras,
        },
        cliente: { nome: data.cliente_nome, telefone: data.cliente_telefone, whatsapp: data.cliente_whatsapp },
        org: {
          id: '', razao_social: data.org_razao_social ?? data.org_nome_fantasia, nome_fantasia: data.org_nome_fantasia,
          documento: '', telefone: data.org_telefone, whatsapp: data.org_whatsapp, email: data.org_email,
          endereco: '', cidade: '', estado: '', cep: '', logo_url: data.org_logo_url ?? undefined,
          cor_principal: data.org_cor_principal ?? '#16181d', cor_secundaria: data.org_cor_secundaria ?? '#f5c518',
          instagram: data.org_instagram, condicoes_padrao: '', prazo_validade_padrao_dias: 10,
          garantia_padrao: '', modo_calculo_margem: 'markup_sobre_custo', margem_minima_percentual: 15,
          impostos_estimados_percentual: 0, responsavel: data.org_responsavel ?? '', experiencia: data.org_experiencia ?? '',
          meta_faturamento_mensal: 0, created_at: '', updated_at: '',
        },
      });
      setLoading(false);
    }
    load();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const totals = useMemo(() => vm ? calculateBudget(vm.budget) : null, [vm]);

  function handleDownloadPdf() {
    if (!vm) return;
    try {
      const doc = generateBudgetPdf(vm.budget as Budget, vm.cliente, vm.org);
      doc.save(`orcamento-${vm.budget.numero}.pdf`);
    } catch (err) {
      toast.show('Não foi possível gerar o PDF.', 'warning');
    }
  }

  function handleWhatsapp() {
    if (!vm?.cliente.whatsapp) return;
    const message = `Olá! Sobre o orçamento nº ${vm.budget.numero} da ${vm.org.nome_fantasia}, tenho uma dúvida.`;
    window.open(whatsappLink(vm.org.whatsapp || vm.org.telefone, message), '_blank');
  }

  async function confirmarResposta() {
    if (!vm || !respondendo || !nome.trim()) return;
    setEnviando(true);
    try {
      if (!isSupabaseConfigured) {
        setBudgetStatus(vm.budget.id, respondendo === 'solicitou_alteracao' ? 'revisao_solicitada' : respondendo);
      } else if (supabase && token) {
        const { error: rpcError } = await supabase.rpc('public_respond_budget', {
          p_token: token, p_decisao: respondendo, p_nome_responsavel: nome.trim(), p_comentario: comentario.trim() || null,
        });
        if (rpcError) throw rpcError;
      }
      setRespondido(true);
      setRespondendo(null);
    } catch (err) {
      toast.show('Não foi possível registrar sua resposta. Tente novamente.', 'warning');
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando orçamento...</p>
      </div>
    );
  }

  if (error || !vm || !totals) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex flex-col items-center justify-center gap-3 px-4 text-center">
        <Logo theme="dark" />
        <p className="text-gray-300 mt-4">{error || 'Não foi possível carregar este orçamento.'}</p>
      </div>
    );
  }

  const { budget, cliente, org } = vm;
  const jaRespondido = respondido || RESPONDED_STATUSES.includes(budget.status);
  const servicos = budget.itens.filter(i => i.tipo === 'servico');
  const materiais = budget.itens.filter(i => i.tipo === 'material');

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-200">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Logo theme="dark" />
          <span className="text-xs text-gray-500">Orçamento nº {budget.numero}</span>
        </div>

        <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-1">
          <h1 className="text-xl font-semibold text-white">{budget.titulo}</h1>
          <p className="text-sm text-gray-400">Para: {cliente.nome}</p>
          <p className="text-xs text-gray-500">
            Emitido em {formatDate(budget.data_emissao)} · Válido até {formatDate(addDays(budget.data_emissao, budget.validade_dias))}
          </p>
          {budget.local_servico && <p className="text-xs text-gray-500">Local: {budget.local_servico}</p>}
        </div>

        {servicos.length > 0 && (
          <div className="bg-[#16181d] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3">Serviços</h2>
            <div className="space-y-2">
              {servicos.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-300">{i.nome} <span className="text-gray-500">x{i.quantidade}</span></span>
                  <span className="text-white">{formatMoney(i.quantidade * i.valor_unitario - i.desconto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {materiais.length > 0 && (
          <div className="bg-[#16181d] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-3">Materiais</h2>
            <div className="space-y-2">
              {materiais.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-300">{i.nome} <span className="text-gray-500">x{i.quantidade}</span></span>
                  <span className="text-white">{formatMoney(i.quantidade * i.valor_unitario - i.desconto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#f5c518] rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#16181d]/70 uppercase">Valor total</p>
            <p className="text-2xl font-bold text-[#16181d]">{formatMoney(totals.totalVenda)}</p>
          </div>
          {budget.parcelas > 1 && (
            <p className="text-sm text-[#16181d]/80 text-right">{budget.parcelas}x de {formatMoney(totals.valorParcela)}</p>
          )}
        </div>

        <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Forma de pagamento</span><span className="text-white">{formasPagamentoLabel[budget.forma_pagamento] ?? budget.forma_pagamento}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Garantia</span><span className="text-white">{budget.garantia || '—'}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Prazo estimado</span><span className="text-white">{budget.prazo_estimado || 'A combinar'}</span></div>
        </div>

        {budget.observacoes_cliente && (
          <div className="bg-[#16181d] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-medium text-white mb-2">Observações</h2>
            <p className="text-sm text-gray-400">{budget.observacoes_cliente}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={handleDownloadPdf} className="flex-1 flex items-center justify-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-[#e0b60f]">
            <Download size={16} /> Baixar PDF
          </button>
          {cliente.whatsapp && (
            <button onClick={handleWhatsapp} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-emerald-500">
              <MessageCircle size={16} /> Falar no WhatsApp
            </button>
          )}
        </div>

        {jaRespondido ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
            <p className="text-emerald-300 text-sm">
              {budget.status === 'recusado'
                ? 'Recebemos sua resposta. Obrigado pelo retorno!'
                : 'Orçamento aprovado com sucesso. A equipe da ' + org.nome_fantasia + ' entrará em contato para confirmar o agendamento.'}
            </p>
          </div>
        ) : respondendo ? (
          <div className="bg-[#16181d] border border-white/5 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-medium text-white">
              {respondendo === 'aprovado' ? 'Confirmar aprovação' : respondendo === 'recusado' ? 'Confirmar recusa' : 'Solicitar alteração'}
            </h2>
            <div>
              <label className="text-xs text-gray-400">Seu nome *</label>
              <input value={nome} onChange={e => setNome(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Comentário (opcional)</label>
              <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
                className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRespondendo(null)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5">Cancelar</button>
              <button onClick={confirmarResposta} disabled={!nome.trim() || enviando}
                className="flex-1 py-2.5 rounded-lg bg-[#f5c518] text-[#16181d] font-semibold text-sm hover:bg-[#e0b60f] disabled:opacity-50">
                {enviando ? 'Enviando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setRespondendo('aprovado')} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-emerald-500">
              <CheckCircle2 size={16} /> Aprovar orçamento
            </button>
            <button onClick={() => setRespondendo('solicitou_alteracao')} className="flex-1 flex items-center justify-center gap-2 border border-white/10 text-gray-200 px-4 py-2.5 rounded-lg text-sm hover:bg-white/5">
              <Edit3 size={16} /> Solicitar alteração
            </button>
            <button onClick={() => setRespondendo('recusado')} className="flex-1 flex items-center justify-center gap-2 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-lg text-sm hover:bg-red-500/10">
              <XCircle size={16} /> Recusar
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-600 pt-2">{org.nome_fantasia} — Desenvolvido por Simplifica Seguros</p>
      </div>
    </div>
  );
}
