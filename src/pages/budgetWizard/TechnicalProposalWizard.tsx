import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Copy } from 'lucide-react';
import { useStore } from '../../lib/store';
import { useToast } from '../../lib/toast';
import { calculateBudget, budgetAlerts } from '../../lib/calculations';
import { formatMoney, todayISO, valorPorExtenso } from '../../lib/format';
import { generateBudgetPdf } from '../../lib/pdf';
import RichTextEditor from '../../components/RichTextEditor';
import DragList from '../../components/DragList';
import StepShell, { Field, NumField, TextArea, Toggle } from './StepShell';
import type {
  Budget, BudgetLineItem, BudgetProposalDetails, BudgetAmbiente, BudgetAtividade,
  FormaPagamento, UnidadeMedida, UnidadePrazo,
} from '../../types';

// Formulário de "Proposta técnica completa" — segundo modo de orçamento, para propostas no nível
// de um laudo técnico (diagnóstico, ambiente por ambiente, escopo detalhado). Nunca pede, mostra
// ou grava "valor unitário": o preço é sempre um valor global (detalhes.valores.valor_total).
// Compartilha com o modo simples (SimpleBudgetForm.tsx) só os campos do Budget que fazem sentido
// nos dois formatos (cliente, título, prazo, garantia, forma de pagamento, entrada/parcelas).

function uid(): string { return crypto.randomUUID(); }

const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' }, { value: 'debito', label: 'Cartão de débito' }, { value: 'credito', label: 'Cartão de crédito' },
  { value: 'entrada_parcelas', label: 'Entrada + parcelas' }, { value: 'a_combinar', label: 'A combinar' },
];

const unidadesPrazo: { value: UnidadePrazo; label: string }[] = [
  { value: 'dias_uteis', label: 'Dias úteis' }, { value: 'dias_corridos', label: 'Dias corridos' },
  { value: 'semanas', label: 'Semanas' }, { value: 'meses', label: 'Meses' },
];

const unidadesMedida: UnidadeMedida[] = ['unidade', 'metro', 'rolo', 'caixa', 'pacote', 'par', 'jogo', 'kg', 'litro', 'hora', 'diaria', 'servico'];

function isRichTextEmpty(html?: string): boolean {
  if (!html) return true;
  return !html.replace(/<[^>]*>/g, '').trim();
}

function emptyDetalhes(): BudgetProposalDetails {
  return {
    cliente: {},
    ambientes: [],
    escopo: {},
    valores: { valor_total: 0, a_vista: { ativo: false }, parcelado: { ativo: false }, etapas: [] },
    prazos: { inicio: {}, execucao: {} },
    encerramento: {
      disponibilidade_esclarecimentos_ativo: true, materiais_separados_ativo: false,
      ressalvas_compatibilizacao_ativo: false, aceite_ativo: true,
    },
  };
}

export default function TechnicalProposalWizard() {
  const { db, addBudget, updateBudget, nextBudgetNumber } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const { id } = useParams();

  const existingBudget = id ? db.budgets.find(b => b.id === id) : undefined;
  const isEditing = Boolean(id);

  const defaultClientMode: 'existing' | 'avulso' = existingBudget
    ? (existingBudget.client_id ? 'existing' : 'avulso')
    : (db.clients.length ? 'existing' : 'avulso');
  const [clientMode, setClientMode] = useState<'existing' | 'avulso'>(defaultClientMode);
  const [clientId, setClientId] = useState(existingBudget?.client_id ?? '');
  const [novoClienteNome, setNovoClienteNome] = useState(existingBudget?.cliente_nome_avulso ?? '');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState(existingBudget?.cliente_telefone_avulso ?? '');
  const [novoClienteWhatsapp, setNovoClienteWhatsapp] = useState(existingBudget?.cliente_whatsapp_avulso ?? '');
  const [titulo, setTitulo] = useState(existingBudget?.titulo ?? '');
  const [dataEmissao, setDataEmissao] = useState(existingBudget?.data_emissao ?? todayISO());
  const [validadeDias, setValidadeDias] = useState(existingBudget?.validade_dias ?? db.organization.prazo_validade_padrao_dias ?? 10);
  const orcamentistasAtivos = db.orcamentistas.filter(o => o.status === 'ativo');
  const [orcamentistaId, setOrcamentistaId] = useState(existingBudget?.orcamentista_id ?? orcamentistasAtivos[0]?.id ?? '');
  const [tipoServico, setTipoServico] = useState(existingBudget?.tipo_servico ?? 'Instalação');
  const [localServico, setLocalServico] = useState(existingBudget?.local_servico ?? '');
  const [garantia, setGarantia] = useState(existingBudget?.garantia ?? db.organization.garantia_padrao ?? '90 dias');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(existingBudget?.forma_pagamento ?? 'a_combinar');
  const [entrada, setEntrada] = useState(existingBudget?.entrada ?? 0);
  const [parcelas, setParcelas] = useState(existingBudget?.parcelas ?? 1);
  const [itens, setItens] = useState<BudgetLineItem[]>(existingBudget?.itens ?? []);
  const [novoAmbienteNome, setNovoAmbienteNome] = useState('');

  const [detalhes, setDetalhes] = useState<BudgetProposalDetails>(() => {
    if (existingBudget?.proposta_detalhada) return existingBudget.proposta_detalhada;
    const base = emptyDetalhes();
    if (db.organization.apresentacao_padrao_html) base.apresentacao_html = db.organization.apresentacao_padrao_html;
    base.cidade_encerramento = db.organization.cidade || '';
    return base;
  });

  const [openStep, setOpenStep] = useState(1);
  const [extensoEditadoManualmente, setExtensoEditadoManualmente] = useState(Boolean(existingBudget?.proposta_detalhada?.valores.valor_total_extenso));
  const [salvando, setSalvando] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);

  function patchDetalhes(patch: Partial<BudgetProposalDetails>) { setDetalhes(prev => ({ ...prev, ...patch })); }
  function patchCliente(patch: Partial<BudgetProposalDetails['cliente']>) { setDetalhes(prev => ({ ...prev, cliente: { ...prev.cliente, ...patch } })); }
  function patchEscopo(patch: Partial<BudgetProposalDetails['escopo']>) { setDetalhes(prev => ({ ...prev, escopo: { ...prev.escopo, ...patch } })); }
  function patchValores(patch: Partial<BudgetProposalDetails['valores']>) { setDetalhes(prev => ({ ...prev, valores: { ...prev.valores, ...patch } })); }
  function patchAVista(patch: Partial<BudgetProposalDetails['valores']['a_vista']>) { setDetalhes(prev => ({ ...prev, valores: { ...prev.valores, a_vista: { ...prev.valores.a_vista, ...patch } } })); }
  function patchParcelado(patch: Partial<BudgetProposalDetails['valores']['parcelado']>) { setDetalhes(prev => ({ ...prev, valores: { ...prev.valores, parcelado: { ...prev.valores.parcelado, ...patch } } })); }
  function patchPrazos(patch: Partial<BudgetProposalDetails['prazos']>) { setDetalhes(prev => ({ ...prev, prazos: { ...prev.prazos, ...patch } })); }
  function patchEncerramento(patch: Partial<BudgetProposalDetails['encerramento']>) { setDetalhes(prev => ({ ...prev, encerramento: { ...prev.encerramento, ...patch } })); }
  function updateAmbientes(updater: (ambientes: BudgetAmbiente[]) => BudgetAmbiente[]) { setDetalhes(prev => ({ ...prev, ambientes: updater(prev.ambientes) })); }

  // Sugestão automática do valor por extenso — só enquanto o orçamentista não editar manualmente.
  useEffect(() => {
    if (extensoEditadoManualmente) return;
    if (!detalhes.valores.valor_total) return;
    setDetalhes(prev => ({ ...prev, valores: { ...prev.valores, valor_total_extenso: valorPorExtenso(prev.valores.valor_total) } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalhes.valores.valor_total, extensoEditadoManualmente]);

  function addAmbiente() {
    if (!novoAmbienteNome.trim()) return;
    updateAmbientes(ambientes => [...ambientes, { id: uid(), nome: novoAmbienteNome.trim(), ordem: ambientes.length, atividades: [] }]);
    setNovoAmbienteNome('');
  }
  function removeAmbiente(ambienteId: string) { updateAmbientes(ambientes => ambientes.filter(a => a.id !== ambienteId)); }
  function duplicateAmbiente(ambienteId: string) {
    updateAmbientes(ambientes => {
      const original = ambientes.find(a => a.id === ambienteId);
      if (!original) return ambientes;
      return [...ambientes, { ...original, id: uid(), nome: `${original.nome} (cópia)`, ordem: ambientes.length, atividades: original.atividades.map(at => ({ ...at, id: uid() })) }];
    });
  }
  function reorderAmbientes(next: BudgetAmbiente[]) { updateAmbientes(() => next.map((a, i) => ({ ...a, ordem: i }))); }
  function updateAmbienteField(ambienteId: string, patch: Partial<Pick<BudgetAmbiente, 'nome' | 'descricao'>>) {
    updateAmbientes(ambientes => ambientes.map(a => a.id === ambienteId ? { ...a, ...patch } : a));
  }
  function addAtividade(ambienteId: string) {
    updateAmbientes(ambientes => ambientes.map(a => a.id === ambienteId
      ? { ...a, atividades: [...a.atividades, { id: uid(), descricao: '', ordem: a.atividades.length }] }
      : a));
  }
  function updateAtividade(ambienteId: string, atividadeId: string, patch: Partial<BudgetAtividade>) {
    updateAmbientes(ambientes => ambientes.map(a => a.id === ambienteId
      ? { ...a, atividades: a.atividades.map(at => at.id === atividadeId ? { ...at, ...patch } : at) }
      : a));
  }
  function removeAtividade(ambienteId: string, atividadeId: string) {
    updateAmbientes(ambientes => ambientes.map(a => a.id === ambienteId ? { ...a, atividades: a.atividades.filter(at => at.id !== atividadeId) } : a));
  }
  function reorderAtividades(ambienteId: string, next: BudgetAtividade[]) {
    updateAmbientes(ambientes => ambientes.map(a => a.id === ambienteId ? { ...a, atividades: next.map((at, i) => ({ ...at, ordem: i })) } : a));
  }

  function addItem() {
    setItens(prev => [...prev, { id: uid(), tipo: 'servico', nome: '', quantidade: 1, unidade: 'unidade', custo_unitario: 0, valor_unitario: 0, desconto: 0, descricao: '' }]);
  }
  function updateItemField(itemId: string, patch: Partial<BudgetLineItem>) {
    setItens(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i));
  }
  function removeItem(itemId: string) { setItens(prev => prev.filter(i => i.id !== itemId)); }

  function addEtapa() {
    patchValores({ etapas: [...detalhes.valores.etapas, { descricao: '' }] });
  }
  function updateEtapa(index: number, patch: Partial<BudgetProposalDetails['valores']['etapas'][number]>) {
    patchValores({ etapas: detalhes.valores.etapas.map((e, i) => i === index ? { ...e, ...patch } : e) });
  }
  function removeEtapa(index: number) {
    patchValores({ etapas: detalhes.valores.etapas.filter((_, i) => i !== index) });
  }

  function buildPrazoTexto(): string {
    const ex = detalhes.prazos.execucao;
    if (!ex.valor) return '';
    const label = unidadesPrazo.find(u => u.value === (ex.unidade ?? 'dias_corridos'))?.label.toLowerCase() ?? '';
    return `${ex.valor} ${label}`.trim();
  }

  function buildBudgetDraft(): Budget {
    const responsavelSelecionado = orcamentistasAtivos.find(o => o.id === orcamentistaId);
    const clientFields = clientMode === 'existing'
      ? { client_id: clientId || null, cliente_nome_avulso: null, cliente_telefone_avulso: null, cliente_whatsapp_avulso: null }
      : { client_id: null, cliente_nome_avulso: novoClienteNome.trim(), cliente_telefone_avulso: novoClienteTelefone.trim(), cliente_whatsapp_avulso: (novoClienteWhatsapp || novoClienteTelefone).trim() };
    return {
      id: existingBudget?.id ?? 'preview',
      organization_id: db.organization.id,
      numero: existingBudget?.numero ?? nextBudgetNumber(),
      ...clientFields,
      titulo, tipo_servico: tipoServico, local_servico: localServico,
      data_emissao: dataEmissao, validade_dias: validadeDias, prazo_estimado: buildPrazoTexto(),
      responsavel: responsavelSelecionado?.nome ?? db.organization.responsavel, orcamentista_id: orcamentistaId || undefined,
      status: existingBudget?.status ?? 'rascunho',
      itens, custos_extras: [], desconto_percentual: 0, desconto_valor: 0,
      forma_pagamento: formaPagamento, entrada, parcelas, garantia,
      historico_status: existingBudget?.historico_status ?? [{ status: 'rascunho', data: todayISO() }],
      link_publico_token: existingBudget?.link_publico_token ?? crypto.randomUUID(),
      proposta_detalhada: detalhes,
      created_at: existingBudget?.created_at ?? todayISO(), updated_at: todayISO(),
    };
  }

  function gerarPreview() {
    try {
      const draft = buildBudgetDraft();
      const clienteNome = clientMode === 'existing' ? (db.clients.find(c => c.id === clientId)?.nome ?? 'Cliente') : (novoClienteNome || 'Cliente');
      const doc = generateBudgetPdf(draft, { nome: clienteNome }, db.organization);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const out = doc.output('bloburl');
      const url = typeof out === 'string' ? out : String(out);
      previewUrlRef.current = url;
      setPdfPreviewUrl(url);
    } catch (err) {
      console.error('Erro ao gerar prévia do PDF', err);
      toast.show('Não foi possível gerar a prévia do PDF.', 'warning');
    }
  }

  async function saveBudget(status: 'rascunho' | 'pronto_para_envio') {
    if (!titulo.trim()) { toast.show('Preencha o título da proposta (etapa 1).', 'warning'); setOpenStep(1); return; }
    if (clientMode === 'existing' && !clientId) { toast.show('Selecione o cliente (etapa 2).', 'warning'); setOpenStep(2); return; }
    if (clientMode === 'avulso' && !novoClienteNome.trim()) { toast.show('Informe o nome do cliente (etapa 2).', 'warning'); setOpenStep(2); return; }
    if (salvando) return;

    const responsavelSelecionado = orcamentistasAtivos.find(o => o.id === orcamentistaId);
    const clientFields = clientMode === 'existing'
      ? { client_id: clientId, cliente_nome_avulso: null, cliente_telefone_avulso: null, cliente_whatsapp_avulso: null }
      : { client_id: null, cliente_nome_avulso: novoClienteNome.trim(), cliente_telefone_avulso: novoClienteTelefone.trim(), cliente_whatsapp_avulso: (novoClienteWhatsapp || novoClienteTelefone).trim() };
    const prazoTexto = buildPrazoTexto();

    setSalvando(true);
    try {
      if (isEditing && existingBudget) {
        const result = await updateBudget(existingBudget.id, {
          ...clientFields, titulo, tipo_servico: tipoServico, local_servico: localServico,
          data_emissao: dataEmissao, validade_dias: validadeDias, prazo_estimado: prazoTexto,
          responsavel: responsavelSelecionado?.nome ?? existingBudget.responsavel, orcamentista_id: orcamentistaId || undefined,
          itens, forma_pagamento: formaPagamento, entrada, parcelas, garantia,
          proposta_detalhada: detalhes,
        });
        if (!result.ok) { toast.show(result.error ?? 'Não foi possível atualizar a proposta. Nenhuma alteração foi confirmada.', 'warning'); return; }
        toast.show('Proposta atualizada com sucesso!');
        navigate(`/app/orcamentos/${existingBudget.id}`);
        return;
      }
      const result = await addBudget({
        ...clientFields, titulo, tipo_servico: tipoServico, local_servico: localServico,
        data_emissao: dataEmissao, validade_dias: validadeDias, prazo_estimado: prazoTexto,
        responsavel: responsavelSelecionado?.nome ?? db.organization.responsavel, orcamentista_id: orcamentistaId || undefined,
        status, itens, custos_extras: [], desconto_percentual: 0, desconto_valor: 0,
        forma_pagamento: formaPagamento, entrada, parcelas, garantia,
        historico_status: [{ status, data: todayISO() }],
        proposta_detalhada: detalhes,
      });
      if (!result.ok) { toast.show(result.error ?? 'Não foi possível salvar a proposta. Nenhuma alteração foi confirmada.', 'warning'); return; }
      toast.show(status === 'rascunho' ? 'Rascunho salvo.' : 'Proposta criada com sucesso!');
      navigate(`/app/orcamentos/${result.budget.id}`);
    } finally {
      setSalvando(false);
    }
  }

  if (isEditing && !existingBudget) {
    return (
      <div className="text-slate-500">
        Orçamento não encontrado. <Link to="/app/orcamentos" className="text-[#00B4E5] hover:underline">Voltar</Link>
      </div>
    );
  }

  const totals = calculateBudget({ itens, custos_extras: [], desconto_percentual: 0, desconto_valor: 0, entrada, parcelas, proposta_detalhada: detalhes });
  const alerts = budgetAlerts({ itens, prazo_estimado: buildPrazoTexto(), forma_pagamento: formaPagamento, proposta_detalhada: detalhes }, totals, db.organization.margem_minima_percentual);
  const totalAmbientesAtividades = detalhes.ambientes.reduce((acc, a) => acc + a.atividades.reduce((s, at) => s + (at.quantidade || 1), 0), 0);

  const step = (n: number, titulo2: string, descricao: string, preenchida: boolean, content: React.ReactNode) => (
    <StepShell numero={n} titulo={titulo2} descricao={descricao} preenchida={preenchida} aberta={openStep === n} onToggle={() => setOpenStep(openStep === n ? 0 : n)}>
      {content}
    </StepShell>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to={isEditing ? `/app/orcamentos/${id}` : '/app/orcamentos'} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#0b2338]">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="ce-fade-up">
        <h1 className="text-2xl font-semibold text-[#0b2338]">{isEditing ? `Editar proposta técnica nº ${existingBudget?.numero}` : 'Nova proposta técnica completa'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Preencha as 11 etapas abaixo — cada uma pode ser aberta/fechada, e você pode salvar como rascunho a qualquer momento.
        </p>
      </div>

      {step(1, 'Identificação da proposta', 'Número, título, datas e responsável', Boolean(titulo.trim()), (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Número do orçamento</label>
            <p className="mt-1 text-sm text-[#0b2338] px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
              {existingBudget?.numero ?? `${nextBudgetNumber()} (gerado automaticamente ao salvar)`}
            </p>
          </div>
          <Field label="Título da proposta *" value={titulo} onChange={setTitulo} placeholder="Ex: Modernização elétrica residencial" />
          <div>
            <label className="text-xs text-slate-500">Data de emissão</label>
            <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]" />
          </div>
          <NumField label="Validade da proposta (dias)" value={validadeDias} onChange={v => setValidadeDias(v ?? 10)} />
          <div>
            <label className="text-xs text-slate-500">Responsável pela proposta</label>
            <select value={orcamentistaId} onChange={e => setOrcamentistaId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
              <option value="">{db.organization.responsavel} (padrão)</option>
              {orcamentistasAtivos.map(o => <option key={o.id} value={o.id}>{o.nome} — {o.cargo}</option>)}
            </select>
          </div>
          <Field label="Tipo de serviço" value={tipoServico} onChange={setTipoServico} />
          <Field label="Cidade para encerramento do documento" value={detalhes.cidade_encerramento ?? ''} onChange={v => patchDetalhes({ cidade_encerramento: v })}
            hint="Usada na linha 'Cidade, data' antes do aceite. Se vazia, usa a cidade cadastrada em Configurações." />
        </div>
      ))}

      {step(2, 'Cliente e local do serviço', 'Quem é o cliente e onde o serviço será executado', clientMode === 'existing' ? Boolean(clientId) : Boolean(novoClienteNome.trim()), (
        <div className="space-y-4">
          {!isEditing && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setClientMode('existing')}
                className={`flex-1 py-2 rounded-lg text-sm border ${clientMode === 'existing' ? 'bg-[#00B4E5] text-[#0b2338] border-[#00B4E5]' : 'border-slate-200 text-slate-600'}`}>
                Cliente já cadastrado
              </button>
              <button type="button" onClick={() => setClientMode('avulso')}
                className={`flex-1 py-2 rounded-lg text-sm border ${clientMode === 'avulso' ? 'bg-[#00B4E5] text-[#0b2338] border-[#00B4E5]' : 'border-slate-200 text-slate-600'}`}>
                Cliente sem cadastro
              </button>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {clientMode === 'existing' ? (
              <div>
                <label className="text-xs text-slate-500">Cliente *</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
                  <option value="">Selecione...</option>
                  {db.clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            ) : (
              <>
                <Field label="Nome do cliente *" value={novoClienteNome} onChange={setNovoClienteNome} placeholder="Ex: Marcelo Andrade" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone" value={novoClienteTelefone} onChange={setNovoClienteTelefone} placeholder="(11) 90000-0000" />
                  <Field label="WhatsApp" value={novoClienteWhatsapp} onChange={setNovoClienteWhatsapp} placeholder="5511900000000" />
                </div>
              </>
            )}
            <Field label="Nome do contato responsável" value={detalhes.cliente.contato_nome ?? ''} onChange={v => patchCliente({ contato_nome: v })} hint="Opcional — quando é diferente do cliente principal." />
            <div className="sm:col-span-2">
              <Field label="Endereço completo do serviço" value={localServico} onChange={setLocalServico} placeholder="Rua, número, bairro, cidade/UF" />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Informações complementares do imóvel/empreendimento" value={detalhes.cliente.info_complementar_imovel ?? ''} onChange={v => patchCliente({ info_complementar_imovel: v })}
                hint="Opcional — ex: apartamento, bloco, ponto de referência." />
            </div>
          </div>
        </div>
      ))}

      {step(3, 'Apresentação', 'Texto de abertura da proposta — editável livremente', !isRichTextEmpty(detalhes.apresentacao_html), (
        <RichTextEditor value={detalhes.apresentacao_html ?? ''} onChange={v => patchDetalhes({ apresentacao_html: v })} placeholder="Texto de apresentação da proposta..." />
      ))}

      {step(4, 'Laudo ou diagnóstico técnico', 'O que foi identificado na visita, solução recomendada, normas aplicáveis', !isRichTextEmpty(detalhes.laudo_html), (
        <RichTextEditor value={detalhes.laudo_html ?? ''} onChange={v => patchDetalhes({ laudo_html: v })} placeholder="Descreva o diagnóstico técnico, a solução recomendada, normas aplicáveis (ex: ABNT NBR 5410)..." />
      ))}

      {step(5, 'Detalhamento por ambientes ou áreas', 'Ambientes e atividades — quantos forem necessários', detalhes.ambientes.length > 0, (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={novoAmbienteNome} onChange={e => setNovoAmbienteNome(e.target.value)} placeholder="Nome do ambiente (ex: Sala, Cozinha, Quadro de distribuição)"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmbiente(); } }}
              className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]" />
            <button type="button" onClick={addAmbiente} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#00B4E5] text-[#0b2338] text-sm font-semibold hover:bg-[#0069A8]">
              <Plus size={14} /> Novo ambiente
            </button>
          </div>

          <DragList<BudgetAmbiente>
            items={detalhes.ambientes} onReorder={reorderAmbientes} getKey={a => a.id}
            className="space-y-3"
            renderItem={ambiente => (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={ambiente.nome} onChange={e => updateAmbienteField(ambiente.id, { nome: e.target.value })}
                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-sm font-medium text-[#0b2338]" />
                  <button type="button" onClick={() => duplicateAmbiente(ambiente.id)} title="Duplicar ambiente" className="text-slate-400 hover:text-[#0069A8]"><Copy size={14} /></button>
                  <button type="button" onClick={() => removeAmbiente(ambiente.id)} title="Excluir ambiente" className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                <input value={ambiente.descricao ?? ''} onChange={e => updateAmbienteField(ambiente.id, { descricao: e.target.value })} placeholder="Descrição do ambiente (opcional)"
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-600" />

                <DragList<BudgetAtividade>
                  items={ambiente.atividades} onReorder={next => reorderAtividades(ambiente.id, next)} getKey={a => a.id}
                  className="space-y-1.5 pl-1"
                  renderItem={atividade => (
                    <div className="grid grid-cols-12 gap-1.5">
                      <input value={atividade.descricao} onChange={e => updateAtividade(ambiente.id, atividade.id, { descricao: e.target.value })} placeholder="Atividade (ex: Instalação de 3 spots)"
                        className="col-span-6 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-[#0b2338]" />
                      <input type="number" value={atividade.quantidade ?? ''} onChange={e => updateAtividade(ambiente.id, atividade.id, { quantidade: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Qtd"
                        className="col-span-1 bg-white border border-slate-200 rounded px-1 py-1 text-xs text-[#0b2338]" />
                      <input value={atividade.unidade ?? ''} onChange={e => updateAtividade(ambiente.id, atividade.id, { unidade: e.target.value })} placeholder="Unid."
                        className="col-span-2 bg-white border border-slate-200 rounded px-1 py-1 text-xs text-[#0b2338]" />
                      <input value={atividade.observacao ?? ''} onChange={e => updateAtividade(ambiente.id, atividade.id, { observacao: e.target.value })} placeholder="Observação"
                        className="col-span-2 bg-white border border-slate-200 rounded px-1 py-1 text-xs text-[#0b2338]" />
                      <button type="button" onClick={() => removeAtividade(ambiente.id, atividade.id)} className="col-span-1 text-slate-400 hover:text-red-500 flex justify-center"><Trash2 size={13} /></button>
                    </div>
                  )}
                />
                <button type="button" onClick={() => addAtividade(ambiente.id)} className="flex items-center gap-1 text-[11px] text-[#0069A8] hover:underline">
                  <Plus size={12} /> Adicionar atividade
                </button>
              </div>
            )}
          />

          <div className="grid sm:grid-cols-2 gap-4 items-end pt-2 border-t border-slate-100">
            <Field label="Rótulo do total aproximado (opcional)" value={detalhes.ambientes_total_label ?? ''} onChange={v => patchDetalhes({ ambientes_total_label: v })}
              placeholder="Ex: pontos de iluminação" hint="Se preenchido, o PDF mostra 'Total aproximado: N ...' ao final dos ambientes." />
            {detalhes.ambientes_total_label && (
              <p className="text-sm text-[#0069A8]">Total aproximado: <strong>{totalAmbientesAtividades} {detalhes.ambientes_total_label}</strong></p>
            )}
          </div>
        </div>
      ))}

      {step(6, 'Escopo principal', 'O que está incluído, premissas e responsabilidades', !isRichTextEmpty(detalhes.escopo.descricao_html), (
        <div className="space-y-4">
          <Field label="Título" value={detalhes.escopo.titulo ?? ''} onChange={v => patchEscopo({ titulo: v })} placeholder="Escopo principal" />
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descrição completa do escopo</label>
            <RichTextEditor value={detalhes.escopo.descricao_html ?? ''} onChange={v => patchEscopo({ descricao_html: v })} placeholder="Descreva o escopo do serviço..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Serviços incluídos</label>
            <RichTextEditor value={detalhes.escopo.servicos_incluidos_html ?? ''} onChange={v => patchEscopo({ servicos_incluidos_html: v })} placeholder="O que está incluído no escopo..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Serviços não incluídos (opcional)</label>
            <RichTextEditor value={detalhes.escopo.servicos_nao_incluidos_html ?? ''} onChange={v => patchEscopo({ servicos_nao_incluidos_html: v })} placeholder="O que fica de fora do escopo..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Premissas técnicas (opcional)</label>
            <RichTextEditor value={detalhes.escopo.premissas_html ?? ''} onChange={v => patchEscopo({ premissas_html: v })} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Responsabilidades do cliente (opcional)</label>
            <RichTextEditor value={detalhes.escopo.responsabilidades_cliente_html ?? ''} onChange={v => patchEscopo({ responsabilidades_cliente_html: v })} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Observações sobre materiais (opcional)</label>
            <RichTextEditor value={detalhes.escopo.observacoes_materiais_html ?? ''} onChange={v => patchEscopo({ observacoes_materiais_html: v })} />
          </div>
        </div>
      ))}

      {step(7, 'Relação de serviços', 'Lista de serviços do orçamento — sem valores, só descrição e quantidade', itens.length > 0, (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400">Nenhum preço aparece aqui — o valor do orçamento é definido de forma global na etapa 8.</p>
          <DragList<BudgetLineItem>
            items={itens} onReorder={setItens} getKey={i => i.id}
            className="space-y-2"
            renderItem={item => (
              <div className="grid grid-cols-12 gap-2 items-center bg-white border border-slate-200 rounded-lg p-2">
                <input value={item.nome} onChange={e => updateItemField(item.id, { nome: e.target.value })} placeholder="Descrição do serviço"
                  className="col-span-5 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
                <input type="number" value={item.quantidade || ''} onChange={e => updateItemField(item.id, { quantidade: e.target.value === '' ? 1 : Number(e.target.value) })} placeholder="Qtd"
                  className="col-span-1 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
                <select value={item.unidade} onChange={e => updateItemField(item.id, { unidade: e.target.value as UnidadeMedida })}
                  className="col-span-2 bg-transparent border border-slate-200 rounded px-1 py-1.5 text-xs text-[#0b2338]">
                  {unidadesMedida.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input value={item.descricao ?? ''} onChange={e => updateItemField(item.id, { descricao: e.target.value })} placeholder="Observação (opcional)"
                  className="col-span-3 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
                <button type="button" onClick={() => removeItem(item.id)} className="col-span-1 text-slate-400 hover:text-red-500 flex justify-end"><Trash2 size={14} /></button>
              </div>
            )}
          />
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
            <Plus size={14} /> Adicionar serviço
          </button>
        </div>
      ))}

      {step(8, 'Valores e formas de pagamento', 'Valor global, à vista, parcelamento e etapas', detalhes.valores.valor_total > 0, (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <NumField label="Valor total do orçamento (R$) *" value={detalhes.valores.valor_total || undefined} onChange={v => patchValores({ valor_total: v ?? 0 })} />
            <div>
              <label className="text-xs text-slate-500">Forma de pagamento (resumo, usado em outras telas)</label>
              <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value as FormaPagamento)}
                className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
                {formasPagamento.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <TextArea label="Valor total por extenso" value={detalhes.valores.valor_total_extenso ?? ''}
            onChange={v => { setExtensoEditadoManualmente(true); patchValores({ valor_total_extenso: v }); }} rows={2}
            hint="Sugerido automaticamente a partir do valor total — você pode editar livremente." />

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <Toggle label="Oferecer pagamento à vista" checked={detalhes.valores.a_vista.ativo} onChange={v => patchAVista({ ativo: v })} />
            {detalhes.valores.a_vista.ativo && (
              <div className="grid sm:grid-cols-2 gap-3 pl-6">
                <NumField label="Valor à vista (R$)" value={detalhes.valores.a_vista.valor} onChange={v => patchAVista({ valor: v })} />
                <Field label="Forma de pagamento à vista" value={detalhes.valores.a_vista.forma_pagamento ?? ''} onChange={v => patchAVista({ forma_pagamento: v })} placeholder="Ex: Pix ou TED" />
                <NumField label="Desconto à vista (%)" value={detalhes.valores.a_vista.desconto_percentual} onChange={v => patchAVista({ desconto_percentual: v })} />
                <NumField label="Desconto à vista (R$)" value={detalhes.valores.a_vista.desconto_valor} onChange={v => patchAVista({ desconto_valor: v })} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <Toggle label="Oferecer pagamento parcelado" checked={detalhes.valores.parcelado.ativo} onChange={v => patchParcelado({ ativo: v })} />
            {detalhes.valores.parcelado.ativo && (
              <div className="grid sm:grid-cols-2 gap-3 pl-6">
                <NumField label="Número de parcelas" value={parcelas} onChange={v => setParcelas(v ?? 1)} />
                <Field label="Informação sobre juros" value={detalhes.valores.parcelado.juros_info ?? ''} onChange={v => patchParcelado({ juros_info: v })} placeholder="Ex: sem juros no cartão" />
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
            <NumField label="Entrada / sinal (R$, opcional)" value={entrada} onChange={v => setEntrada(v ?? 0)} />
          </div>
          <TextArea label="Condições de pagamento (texto complementar, opcional)" value={detalhes.valores.condicoes_texto ?? ''} onChange={v => patchValores({ condicoes_texto: v })} />

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <label className="text-xs text-slate-500">Etapas de pagamento (opcional)</label>
            {detalhes.valores.etapas.map((etapa, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={etapa.descricao} onChange={e => updateEtapa(i, { descricao: e.target.value })} placeholder="Descrição da etapa"
                  className="col-span-6 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
                <input type="number" value={etapa.valor ?? ''} onChange={e => updateEtapa(i, { valor: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Valor"
                  className="col-span-3 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
                <input type="date" value={etapa.data ?? ''} onChange={e => updateEtapa(i, { data: e.target.value })}
                  className="col-span-2 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
                <button type="button" onClick={() => removeEtapa(i)} className="col-span-1 text-slate-400 hover:text-red-500 flex justify-end"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={addEtapa} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
              <Plus size={14} /> Adicionar etapa
            </button>
          </div>
        </div>
      ))}

      {step(9, 'Prazos e garantias', 'Início, execução, garantia da mão de obra e materiais', Boolean(detalhes.prazos.execucao.valor || garantia), (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Prazo para início" value={detalhes.prazos.inicio.valor} onChange={v => patchPrazos({ inicio: { ...detalhes.prazos.inicio, valor: v } })} />
            <div>
              <label className="text-xs text-slate-500">Unidade</label>
              <select value={detalhes.prazos.inicio.unidade ?? 'dias_corridos'} onChange={e => patchPrazos({ inicio: { ...detalhes.prazos.inicio, unidade: e.target.value as UnidadePrazo } })}
                className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-2 py-2 text-sm text-[#0b2338]">
                {unidadesPrazo.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Prazo de execução" value={detalhes.prazos.execucao.valor} onChange={v => patchPrazos({ execucao: { ...detalhes.prazos.execucao, valor: v } })} />
            <div>
              <label className="text-xs text-slate-500">Unidade</label>
              <select value={detalhes.prazos.execucao.unidade ?? 'dias_uteis'} onChange={e => patchPrazos({ execucao: { ...detalhes.prazos.execucao, unidade: e.target.value as UnidadePrazo } })}
                className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-2 py-2 text-sm text-[#0b2338]">
                {unidadesPrazo.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <Field label="Condição relacionada ao cronograma (opcional)" value={detalhes.prazos.condicao_cronograma ?? ''} onChange={v => patchPrazos({ condicao_cronograma: v })} placeholder="Ex: conforme cronograma de obra" />
          <Field label="Garantia da mão de obra" value={garantia} onChange={setGarantia} placeholder="Ex: 90 dias" />
          <Field label="Garantia dos materiais (opcional)" value={detalhes.prazos.garantia_materiais ?? ''} onChange={v => patchPrazos({ garantia_materiais: v })} />
          <Field label="Norma/legislação aplicável (opcional)" value={detalhes.prazos.norma_aplicavel ?? ''} onChange={v => patchPrazos({ norma_aplicavel: v })} placeholder="Ex: ABNT NBR 5410" />
          <div className="sm:col-span-2">
            <TextArea label="Observações sobre a garantia (opcional)" value={detalhes.prazos.garantia_observacoes ?? ''} onChange={v => patchPrazos({ garantia_observacoes: v })} />
          </div>
        </div>
      ))}

      {step(10, 'Observações e encerramento', 'Agradecimento, ressalvas e aceite', true, (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Texto de agradecimento / disposição para esclarecimentos</label>
            <RichTextEditor value={detalhes.encerramento.agradecimento_html ?? ''} onChange={v => patchEncerramento({ agradecimento_html: v })} />
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <Toggle label="Mostrar aviso de disponibilidade para esclarecimentos" checked={detalhes.encerramento.disponibilidade_esclarecimentos_ativo} onChange={v => patchEncerramento({ disponibilidade_esclarecimentos_ativo: v })} />
            <Toggle label="Informar que a lista de materiais será apresentada separadamente" checked={detalhes.encerramento.materiais_separados_ativo} onChange={v => patchEncerramento({ materiais_separados_ativo: v })} />
            <Toggle label="Incluir ressalva sobre ajustes após compatibilização de projetos" checked={detalhes.encerramento.ressalvas_compatibilizacao_ativo} onChange={v => patchEncerramento({ ressalvas_compatibilizacao_ativo: v })} />
            <Toggle label="Incluir bloco de aceite eletrônico ao final do PDF" checked={detalhes.encerramento.aceite_ativo} onChange={v => patchEncerramento({ aceite_ativo: v })} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Observações finais (opcional)</label>
            <RichTextEditor value={detalhes.encerramento.observacoes_finais_html ?? ''} onChange={v => patchEncerramento({ observacoes_finais_html: v })} />
          </div>
        </div>
      ))}

      {step(11, 'Revisão e geração do PDF', 'Confira tudo antes de salvar', false, (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <RevisaoRow label="Cliente" value={clientMode === 'existing' ? (db.clients.find(c => c.id === clientId)?.nome ?? '—') : (novoClienteNome || '—')} />
            <RevisaoRow label="Valor total" value={formatMoney(totals.totalVenda)} highlight />
            <RevisaoRow label="Ambientes" value={`${detalhes.ambientes.length} ambiente(s), ${totalAmbientesAtividades} atividade(s)`} />
            <RevisaoRow label="Serviços listados" value={String(itens.length)} />
            <RevisaoRow label="Pagamento à vista" value={detalhes.valores.a_vista.ativo ? 'Ativado' : 'Não oferecido'} />
            <RevisaoRow label="Pagamento parcelado" value={detalhes.valores.parcelado.ativo ? `${parcelas}x` : 'Não oferecido'} />
            <RevisaoRow label="Aceite eletrônico no PDF" value={detalhes.encerramento.aceite_ativo ? 'Incluído' : 'Não incluído'} />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-slate-500 mb-1">Seções que NÃO aparecerão no PDF (ainda vazias):</p>
            {[
              ['Apresentação', isRichTextEmpty(detalhes.apresentacao_html)],
              ['Laudo técnico', isRichTextEmpty(detalhes.laudo_html)],
              ['Escopo principal', isRichTextEmpty(detalhes.escopo.descricao_html)],
              ['Serviços não incluídos', isRichTextEmpty(detalhes.escopo.servicos_nao_incluidos_html)],
              ['Premissas técnicas', isRichTextEmpty(detalhes.escopo.premissas_html)],
              ['Responsabilidades do cliente', isRichTextEmpty(detalhes.escopo.responsabilidades_cliente_html)],
              ['Observações sobre materiais', isRichTextEmpty(detalhes.escopo.observacoes_materiais_html)],
              ['Norma/legislação aplicável', !detalhes.prazos.norma_aplicavel],
            ].filter(([, vazio]) => vazio).map(([label]) => (
              <p key={String(label)} className="text-[11px] text-slate-400">• {label}</p>
            ))}
          </div>

          {alerts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
              {alerts.map((a, i) => <p key={i} className="text-xs text-amber-600">⚠ {a}</p>)}
            </div>
          )}

          <div>
            <button type="button" onClick={gerarPreview} className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 mb-3">
              Gerar prévia do PDF
            </button>
            {pdfPreviewUrl && (
              <iframe src={pdfPreviewUrl} title="Prévia do PDF" className="w-full h-[600px] rounded-lg border border-slate-200" />
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-3 pb-8">
        {isEditing ? (
          <button type="button" disabled={salvando} onClick={() => saveBudget('pronto_para_envio')} className="ce-btn-glow px-5 py-2.5 rounded-lg bg-[#00B4E5] text-[#0b2338] font-semibold text-sm hover:bg-[#0069A8] disabled:opacity-60 disabled:cursor-not-allowed">
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        ) : (
          <>
            <button type="button" disabled={salvando} onClick={() => saveBudget('rascunho')} className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed">{salvando ? 'Salvando...' : 'Salvar rascunho'}</button>
            <button type="button" disabled={salvando} onClick={() => saveBudget('pronto_para_envio')} className="ce-btn-glow px-5 py-2.5 rounded-lg bg-[#00B4E5] text-[#0b2338] font-semibold text-sm hover:bg-[#0069A8] disabled:opacity-60 disabled:cursor-not-allowed">{salvando ? 'Salvando...' : 'Salvar proposta'}</button>
          </>
        )}
      </div>
    </div>
  );
}

function RevisaoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${highlight ? 'bg-[#00B4E5]/10 border border-[#00B4E5]/30' : 'bg-slate-50'}`}>
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? 'text-[#00B4E5] font-semibold' : 'text-[#0b2338]'}>{value}</span>
    </div>
  );
}
