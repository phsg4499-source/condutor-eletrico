import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useStore } from '../../lib/store';
import { useToast } from '../../lib/toast';
import { calculateBudget, budgetAlerts } from '../../lib/calculations';
import { formatMoney, todayISO } from '../../lib/format';
import type { Budget, BudgetLineItem, ExtraCost, FormaPagamento } from '../../types';

// Formulário de "Orçamento simples" — fluxo original do sistema (itens de catálogo com
// custo/valor unitário, cálculo automático de margem). Mantido tal como estava antes da
// introdução da "Proposta técnica completa" (ver TechnicalProposalWizard.tsx): quem já usa
// orçamentos rápidos com preço por item continua exatamente com a mesma experiência.

// Gera um UUID de verdade: os itens e custos extras do orçamento são gravados nas tabelas
// budget_items/budget_extra_costs, cujas colunas "id" são do tipo uuid no Supabase. O formato
// antigo ("it-1786295689919-1190") não é um UUID válido — o Postgres rejeitava a gravação com
// "invalid input syntax for type uuid". Isso ficava escondido antes porque o salvamento do
// orçamento era "fire-and-forget" (mostrava sucesso mesmo se essa gravação falhasse); agora que
// o resultado real é aguardado e checado, o erro aparece — e esta é a correção definitiva dele.
function uid(_prefixoIgnorado: string): string { return crypto.randomUUID(); }

const formasPagamento: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' }, { value: 'debito', label: 'Cartão de débito' }, { value: 'credito', label: 'Cartão de crédito' },
  { value: 'entrada_parcelas', label: 'Entrada + parcelas' }, { value: 'a_combinar', label: 'A combinar' },
];

export default function SimpleBudgetForm() {
  const { db, addBudget, updateBudget } = useStore();
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
  const [tipoServico, setTipoServico] = useState(existingBudget?.tipo_servico ?? 'Instalação');
  const [localServico, setLocalServico] = useState(existingBudget?.local_servico ?? '');
  const [prazo, setPrazo] = useState(existingBudget?.prazo_estimado ?? '');
  const orcamentistasAtivos = db.orcamentistas.filter(o => o.status === 'ativo');
  const [orcamentistaId, setOrcamentistaId] = useState(existingBudget?.orcamentista_id ?? orcamentistasAtivos[0]?.id ?? '');
  const [itens, setItens] = useState<BudgetLineItem[]>(existingBudget?.itens ?? []);
  const [custosExtras, setCustosExtras] = useState<ExtraCost[]>(existingBudget?.custos_extras ?? []);
  const [descontoValor, setDescontoValor] = useState(existingBudget?.desconto_valor ?? 0);
  const [descontoPercentual, setDescontoPercentual] = useState(existingBudget?.desconto_percentual ?? 0);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(existingBudget?.forma_pagamento ?? 'pix');
  const [entrada, setEntrada] = useState(existingBudget?.entrada ?? 0);
  const [parcelas, setParcelas] = useState(existingBudget?.parcelas ?? 1);
  const [garantia, setGarantia] = useState(existingBudget?.garantia ?? '90 dias');
  const [validadeDias, setValidadeDias] = useState(existingBudget?.validade_dias ?? db.organization.prazo_validade_padrao_dias ?? 10);
  const [obsInternas, setObsInternas] = useState(existingBudget?.observacoes_internas ?? '');
  const [obsCliente, setObsCliente] = useState(existingBudget?.observacoes_cliente ?? '');
  const [salvando, setSalvando] = useState(false);

  const totals = calculateBudget({ itens, custos_extras: custosExtras, desconto_percentual: descontoPercentual, desconto_valor: descontoValor, entrada, parcelas, proposta_detalhada: undefined });
  const alerts = budgetAlerts({ itens, prazo_estimado: prazo, forma_pagamento: formaPagamento, proposta_detalhada: undefined }, totals, db.organization.margem_minima_percentual);

  function addServiceItem(serviceId: string) {
    const svc = db.services.find(s => s.id === serviceId);
    if (!svc) return;
    setItens(prev => [...prev, {
      id: uid('it'), tipo: 'servico', referencia_id: svc.id, nome: svc.nome, quantidade: 1, unidade: svc.unidade,
      custo_unitario: svc.custo_mao_obra, valor_unitario: svc.valor_padrao, desconto: 0,
    }]);
  }

  function addMaterialItem(materialId: string) {
    const mat = db.materials.find(m => m.id === materialId);
    if (!mat) return;
    setItens(prev => [...prev, {
      id: uid('it'), tipo: 'material', referencia_id: mat.id, nome: mat.nome, quantidade: 1, unidade: mat.unidade,
      custo_unitario: mat.preco_custo, valor_unitario: mat.preco_venda, desconto: 0,
    }]);
  }

  function addCustomItem(tipo: 'servico' | 'material') {
    setItens(prev => [...prev, { id: uid('it'), tipo, nome: '', quantidade: 1, unidade: 'unidade', custo_unitario: 0, valor_unitario: 0, desconto: 0 }]);
  }

  function updateItem(id: string, patch: Partial<BudgetLineItem>) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  function removeItem(id: string) {
    setItens(prev => prev.filter(i => i.id !== id));
  }

  function addExtraCost() {
    setCustosExtras(prev => [...prev, { id: uid('ex'), descricao: '', valor: 0 }]);
  }

  async function saveBudget(status: 'rascunho' | 'pronto_para_envio') {
    if (!titulo) return;
    if (salvando) return; // impede duplo clique/duplo envio enquanto uma gravação está em andamento

    // O orçamento nunca depende de o cliente estar cadastrado: se "Cliente sem cadastro" estiver
    // selecionado, os dados de contato ficam gravados direto no orçamento (client_id fica vazio).
    let clientFields: Partial<Budget>;
    if (clientMode === 'existing') {
      if (!clientId) return;
      clientFields = { client_id: clientId, cliente_nome_avulso: null, cliente_telefone_avulso: null, cliente_whatsapp_avulso: null };
    } else {
      if (!novoClienteNome.trim()) return;
      clientFields = {
        client_id: null,
        cliente_nome_avulso: novoClienteNome.trim(),
        cliente_telefone_avulso: novoClienteTelefone.trim(),
        cliente_whatsapp_avulso: (novoClienteWhatsapp || novoClienteTelefone).trim(),
      };
    }

    const responsavelSelecionado = orcamentistasAtivos.find(o => o.id === orcamentistaId);

    setSalvando(true);
    try {
      if (isEditing && existingBudget) {
        const result = await updateBudget(existingBudget.id, {
          ...clientFields, titulo, tipo_servico: tipoServico,
          local_servico: localServico, prazo_estimado: prazo,
          responsavel: responsavelSelecionado?.nome ?? existingBudget.responsavel, orcamentista_id: orcamentistaId || undefined,
          itens, custos_extras: custosExtras, validade_dias: validadeDias,
          desconto_percentual: descontoPercentual, desconto_valor: descontoValor, forma_pagamento: formaPagamento,
          entrada, parcelas, garantia, observacoes_internas: obsInternas, observacoes_cliente: obsCliente,
        });
        // Nunca mostra sucesso e erro juntos: só um toast, refletindo exatamente o que o Supabase
        // confirmou. Se falhou, permanece na tela (nada é perdido) para o usuário tentar de novo.
        if (!result.ok) {
          toast.show(result.error ?? 'Não foi possível atualizar o orçamento. Nenhuma alteração foi confirmada.', 'warning');
          return;
        }
        toast.show('Orçamento atualizado com sucesso!');
        navigate(`/app/orcamentos/${existingBudget.id}`);
        return;
      }

      const result = await addBudget({
        // Não passamos "numero" aqui de propósito: se o gerarmos aqui e ele colidir com um já
        // existente no banco, o addBudget trata isso como "número escolhido pelo usuário" e NÃO
        // tenta de novo sozinho — devolve erro na hora e pede pra clicar em salvar de novo, o que
        // recalculava o mesmo número (porque o estado local do formulário não muda) e falhava de
        // novo, indefinidamente. Deixando o addBudget gerar o número internamente, ele tenta
        // números novos automaticamente contra o Supabase (fonte real) até achar um livre.
        ...clientFields, titulo, tipo_servico: tipoServico,
        local_servico: localServico, data_emissao: todayISO(), validade_dias: validadeDias, prazo_estimado: prazo,
        responsavel: responsavelSelecionado?.nome ?? db.organization.responsavel, orcamentista_id: orcamentistaId || undefined,
        status, itens, custos_extras: custosExtras,
        desconto_percentual: descontoPercentual, desconto_valor: descontoValor, forma_pagamento: formaPagamento,
        entrada, parcelas, garantia, observacoes_internas: obsInternas, observacoes_cliente: obsCliente,
        historico_status: [{ status, data: todayISO() }],
      });
      if (!result.ok) {
        toast.show(result.error ?? 'Não foi possível salvar o orçamento. Nenhuma alteração foi confirmada.', 'warning');
        return;
      }
      toast.show(status === 'rascunho' ? 'Rascunho salvo.' : 'Orçamento criado com sucesso!');
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

  return (
    <div className="space-y-8 max-w-4xl">
      <Link to={isEditing ? `/app/orcamentos/${id}` : '/app/orcamentos'} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#0b2338]">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="ce-fade-up">
        <h1 className="text-2xl font-semibold text-[#0b2338]">{isEditing ? `Editar orçamento nº ${existingBudget?.numero}` : 'Novo orçamento'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEditing ? 'Ajuste os dados abaixo e salve para atualizar o orçamento.' : 'Preencha as etapas abaixo. O número será gerado automaticamente.'}
        </p>
      </div>

      <div className="bg-[#00B4E5]/10 border border-[#00B4E5]/20 rounded-lg px-4 py-3 text-xs text-[#0069A8]">
        Dica: comece escolhendo o cliente e adicionando itens do catálogo de serviços/materiais — os valores de custo e venda
        já vêm preenchidos e você pode ajustar quantidade e preço na hora. O custo e a margem (etapa 5) são só para você, o
        cliente só vê o valor final no PDF.
      </div>

      <Section title="1. Cliente e dados do orçamento">
        {!isEditing && (
          <div className="flex gap-2 mb-2">
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
        {!isEditing && (
          <p className="text-[11px] text-slate-400 mb-4">
            Você não precisa cadastrar o cliente para fazer o orçamento. Escolha "Cliente sem cadastro" e digite só o nome e
            telefone — se quiser, você cadastra esse cliente depois, na tela de Clientes, sem nenhuma pressa.
          </p>
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
              {db.clients.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">Nenhum cliente cadastrado ainda — use "Cliente sem cadastro" ao lado.</p>
              )}
            </div>
          ) : (
            <>
              <Field label="Nome do cliente *" value={novoClienteNome} onChange={setNovoClienteNome} placeholder="Ex: Marcos Andrade" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefone" value={novoClienteTelefone} onChange={setNovoClienteTelefone} placeholder="(11) 90000-0000" />
                <Field label="WhatsApp" value={novoClienteWhatsapp} onChange={setNovoClienteWhatsapp} placeholder="5511900000000" />
              </div>
            </>
          )}
          <div>
            <Field label="Título do orçamento *" value={titulo} onChange={setTitulo} placeholder="Ex: Instalação elétrica completa - Apto 302" />
            <p className="text-[11px] text-slate-400 mt-1">Esse texto aparece em destaque no topo do PDF que o cliente recebe.</p>
          </div>
          <div>
            <label className="text-xs text-slate-500">Responsável pelo orçamento</label>
            <select value={orcamentistaId} onChange={e => setOrcamentistaId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
              <option value="">{db.organization.responsavel} (padrão)</option>
              {orcamentistasAtivos.map(o => <option key={o.id} value={o.id}>{o.nome} — {o.cargo}</option>)}
            </select>
          </div>
          <Field label="Tipo de serviço" value={tipoServico} onChange={setTipoServico} />
          <Field label="Prazo estimado" value={prazo} onChange={setPrazo} placeholder="Ex: 2 dias" />
          <div className="sm:col-span-2">
            <Field label="Local do serviço" value={localServico} onChange={setLocalServico} />
          </div>
        </div>
      </Section>

      <Section title="2. Serviços e materiais">
        <div className="flex flex-wrap gap-2 mb-4">
          <select onChange={e => { if (e.target.value) addServiceItem(e.target.value); e.target.value = ''; }}
            className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
            <option value="">+ Adicionar serviço cadastrado...</option>
            {db.services.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select onChange={e => { if (e.target.value) addMaterialItem(e.target.value); e.target.value = ''; }}
            className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
            <option value="">+ Adicionar material cadastrado...</option>
            {db.materials.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <button type="button" onClick={() => addCustomItem('servico')} className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">+ Serviço personalizado</button>
          <button type="button" onClick={() => addCustomItem('material')} className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">+ Material personalizado</button>
        </div>

        <p className="text-[11px] text-slate-400 mb-2">
          "Custo (interno)" é o quanto você gasta — nunca aparece pro cliente. "Valor (cliente)" é o preço que ele vê e paga.
          A diferença entre os dois é o seu lucro. No celular, arraste para o lado para ver todas as colunas.
        </p>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="min-w-[600px]">
            {itens.length > 0 && (
              <div className="grid grid-cols-12 gap-2 px-2 mb-1 text-[10px] uppercase text-slate-400">
                <span className="col-span-1">Tipo</span>
                <span className="col-span-4">Descrição</span>
                <span className="col-span-1">Qtd</span>
                <span className="col-span-2">Custo (interno)</span>
                <span className="col-span-2">Valor (cliente)</span>
                <span className="col-span-1 text-right">Total</span>
              </div>
            )}
            <div className="space-y-2">
              {itens.map(item => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white border border-slate-200 rounded-lg p-2">
                  <span className={`col-span-1 text-[10px] uppercase text-center rounded px-1 py-1 ${item.tipo === 'servico' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{item.tipo === 'servico' ? 'Serv.' : 'Mat.'}</span>
                  <input value={item.nome} onChange={e => updateItem(item.id, { nome: e.target.value })} placeholder="Descrição"
                    className="col-span-4 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
                  <input type="number" value={item.quantidade} onChange={e => updateItem(item.id, { quantidade: Number(e.target.value) })}
                    className="col-span-1 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" title="Quantidade" />
                  <input type="number" value={item.custo_unitario} onChange={e => updateItem(item.id, { custo_unitario: Number(e.target.value) })}
                    className="col-span-2 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" title="Custo interno unitário" />
                  <input type="number" value={item.valor_unitario} onChange={e => updateItem(item.id, { valor_unitario: Number(e.target.value) })}
                    className="col-span-2 bg-transparent border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" title="Valor de venda unitário" />
                  <span className="col-span-1 text-xs text-[#0b2338] text-right">{formatMoney(item.quantidade * item.valor_unitario - item.desconto)}</span>
                  <button type="button" onClick={() => removeItem(item.id)} className="col-span-1 text-slate-400 hover:text-red-400 flex justify-end"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
        {itens.length === 0 && <p className="text-xs text-slate-400 mt-2">Nenhum item adicionado ainda.</p>}
      </Section>

      <Section title="3. Custos adicionais">
        <button type="button" onClick={addExtraCost} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 mb-3">
          <Plus size={14} /> Adicionar custo (deslocamento, taxas, etc.)
        </button>
        <div className="space-y-2">
          {custosExtras.map(cost => (
            <div key={cost.id} className="grid grid-cols-12 gap-2 items-center">
              <input value={cost.descricao} onChange={e => setCustosExtras(prev => prev.map(c => c.id === cost.id ? { ...c, descricao: e.target.value } : c))}
                placeholder="Descrição" className="col-span-7 sm:col-span-8 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
              <input type="number" value={cost.valor} onChange={e => setCustosExtras(prev => prev.map(c => c.id === cost.id ? { ...c, valor: Number(e.target.value) } : c))}
                placeholder="Valor" className="col-span-4 sm:col-span-3 bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-[#0b2338]" />
              <button type="button" onClick={() => setCustosExtras(prev => prev.filter(c => c.id !== cost.id))} className="col-span-1 text-slate-400 hover:text-red-400 flex justify-end"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="4. Condições comerciais">
        <p className="text-[11px] text-slate-400 mb-3">
          Estas informações aparecem no PDF como as condições da proposta. Use "Entrada" e "Parcelas" juntos se o pagamento
          vai ser dividido (ex: entrada + 3x). Se for à vista, deixe parcelas em 1.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500">Forma de pagamento</label>
            <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value as FormaPagamento)}
              className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338]">
              {formasPagamento.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <Field label="Garantia" value={garantia} onChange={setGarantia} placeholder="Ex: 90 dias" />
            <p className="text-[11px] text-slate-400 mt-1">Prazo de garantia do serviço executado, mostrado no PDF.</p>
          </div>
          <div>
            <NumField label="Validade da proposta (dias)" value={validadeDias} onChange={setValidadeDias} />
            <p className="text-[11px] text-slate-400 mt-1">Por quantos dias a partir da emissão este orçamento vale, mostrado no PDF.</p>
          </div>
          <div>
            <NumField label="Desconto (%)" value={descontoPercentual} onChange={setDescontoPercentual} />
            <p className="text-[11px] text-slate-400 mt-1">Use % ou R$ — não os dois ao mesmo tempo, pra não descontar em dobro.</p>
          </div>
          <NumField label="Desconto (R$)" value={descontoValor} onChange={setDescontoValor} />
          <NumField label="Entrada (R$)" value={entrada} onChange={setEntrada} />
          <NumField label="Número de parcelas" value={parcelas} onChange={setParcelas} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <TextArea label="Observações internas (não aparece no PDF)" value={obsInternas} onChange={setObsInternas} />
          <TextArea label="Observações para o cliente" value={obsCliente} onChange={setObsCliente} />
        </div>
      </Section>

      <Section title="5. Revisão">
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Row label="Subtotal serviços" value={formatMoney(totals.subtotalServicos)} />
          <Row label="Subtotal materiais" value={formatMoney(totals.subtotalMateriais)} />
          <Row label="Custos adicionais" value={formatMoney(totals.subtotalCustosExtras)} />
          <Row label="Desconto aplicado" value={formatMoney(totals.descontoGeral)} />
          <Row label="Custo total (interno)" value={formatMoney(totals.totalCusto)} highlight="internal" />
          <Row label="Lucro bruto (interno)" value={formatMoney(totals.lucroBruto)} highlight="internal" />
          <Row label="Margem (interno)" value={`${totals.margemPercentual.toFixed(1)}%`} highlight="internal" />
          <Row label="Valor final para o cliente" value={formatMoney(totals.totalVenda)} highlight="final" />
        </div>
        {alerts.length > 0 && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
            {alerts.map((a, i) => <p key={i} className="text-xs text-amber-400">⚠ {a}</p>)}
          </div>
        )}
      </Section>

      <div className="flex gap-3 pb-8">
        {isEditing ? (
          <button type="button" disabled={salvando} onClick={() => saveBudget('pronto_para_envio')} className="ce-btn-glow px-5 py-2.5 rounded-lg bg-[#00B4E5] text-[#0b2338] font-semibold text-sm hover:bg-[#0069A8] disabled:opacity-60 disabled:cursor-not-allowed">
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        ) : (
          <>
            <button type="button" disabled={salvando} onClick={() => saveBudget('rascunho')} className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed">{salvando ? 'Salvando...' : 'Salvar rascunho'}</button>
            <button type="button" disabled={salvando} onClick={() => saveBudget('pronto_para_envio')} className="ce-btn-glow px-5 py-2.5 rounded-lg bg-[#00B4E5] text-[#0b2338] font-semibold text-sm hover:bg-[#0069A8] disabled:opacity-60 disabled:cursor-not-allowed">{salvando ? 'Salvando...' : 'Salvar orçamento'}</button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-[#0b2338] font-medium text-sm mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'internal' | 'final' }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${highlight === 'final' ? 'bg-[#00B4E5]/10 border border-[#00B4E5]/30' : highlight === 'internal' ? 'bg-slate-50' : ''}`}>
      <span className="text-slate-500">{label}</span>
      <span className={highlight === 'final' ? 'text-[#00B4E5] font-semibold' : 'text-[#0b2338]'}>{value}</span>
    </div>
  );
}
