import { useRef, useState } from 'react';
import { Mic, Square, Sparkles, Loader2 } from 'lucide-react';

// Ditado por voz + IA para a Proposta técnica completa.
// Fluxo: 1) você aperta "Gravar", fala, aperta "Parar gravação" — o reconhecimento de voz do
// navegador (Web Speech API, grátis, sem servidor) transcreve em tempo real; 2) ao parar, o texto
// é enviado automaticamente para /api/organizar-proposta, uma função serverless que chama o
// Claude só no servidor (a chave da Anthropic nunca existe no navegador); 3) você revisa o que a
// IA organizou e decide aplicar (ou não) nos campos da proposta — nada é salvo sozinho.
//
// A Web Speech API não é padrão (não existe tipagem no lib.dom do TypeScript) e só tem suporte
// real no Chrome — daí o uso de `any` localizado só nesta integração.

export interface AiProposalDraft {
  titulo: string;
  tipo_servico: string;
  local_servico: string;
  cliente_nome: string;
  apresentacao_html: string;
  laudo_html: string;
  escopo_descricao_html: string;
  escopo_servicos_incluidos_html: string;
  escopo_servicos_nao_incluidos_html: string;
  escopo_premissas_html: string;
  escopo_responsabilidades_cliente_html: string;
  ambientes: { nome: string; descricao?: string; atividades: { descricao: string; quantidade?: number; unidade?: string }[] }[];
  prazo_execucao_valor?: number;
  prazo_execucao_unidade?: 'dias_uteis' | 'dias_corridos' | 'semanas' | 'meses';
  garantia_mao_obra: string;
  valor_total?: number;
  forma_pagamento_observacao: string;
}

interface VoiceDictationProps {
  onApply: (draft: AiProposalDraft) => void;
}

export default function VoiceDictation({ onApply }: VoiceDictationProps) {
  const [gravando, setGravando] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<AiProposalDraft | null>(null);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionCtor = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

  async function organizarComIA(texto: string) {
    if (!texto.trim()) { setErro('Grave ou digite um texto antes de organizar com a IA.'); return; }
    setProcessando(true);
    setErro(null);
    setRascunho(null);
    try {
      const resposta = await fetch('/api/organizar-proposta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript: texto.trim() }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.error ?? 'Não foi possível organizar o texto com a IA.');
        return;
      }
      setRascunho(dados.result);
    } catch {
      setErro('Falha de conexão ao chamar a IA. Verifique sua internet e tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  function toggleGravacao() {
    if (gravando) {
      recognitionRef.current?.stop();
      return;
    }
    if (!SpeechRecognitionCtor) {
      setErro('Seu navegador não tem suporte a reconhecimento de voz. Use o Chrome (computador ou Android).');
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    // Texto de uma gravação anterior (se o usuário pausou e retomou) — nunca é reprocessado,
    // só fica na frente do texto novo.
    const prefixoAnterior = transcript ? `${transcript} ` : '';
    let textoFinalDaSessao = '';

    // Reconstrói o texto final inteiro a partir do zero em CADA evento (índice 0 até o fim de
    // event.results), em vez de ir só acrescentando a partir de event.resultIndex. O Chrome, em
    // modo contínuo, às vezes reenvia um resultIndex que já tinha sido processado antes — somar
    // incrementalmente nesses casos duplicava trechos inteiros da fala. Reconstruir do zero é
    // idempotente: não importa quantas vezes o mesmo evento dispare, o texto final não duplica.
    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const resultado = event.results[i];
        if (resultado.isFinal) final += `${resultado[0].transcript} `;
        else interim += resultado[0].transcript;
      }
      textoFinalDaSessao = final;
      setTranscript((prefixoAnterior + final + interim).trim());
    };
    recognition.onerror = (event: any) => {
      setErro(`Erro no reconhecimento de voz: ${event.error === 'not-allowed' ? 'permissão de microfone negada' : event.error}`);
      setGravando(false);
    };
    // Ao parar de gravar (clique em "Parar gravação"), organiza com a IA automaticamente — não
    // precisa de um segundo clique: falar e a IA preencher é uma ação só, como pedido.
    recognition.onend = () => {
      setGravando(false);
      organizarComIA((prefixoAnterior + textoFinalDaSessao).trim());
    };

    recognitionRef.current = recognition;
    setErro(null);
    setRascunho(null);
    recognition.start();
    setGravando(true);
  }

  function aplicar() {
    if (!rascunho) return;
    onApply(rascunho);
    setRascunho(null);
    setTranscript('');
  }

  return (
    <div className="bg-white border border-[#00B4E5]/30 rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[#00B4E5]" />
        <h2 className="text-[#0b2338] font-medium text-sm">Ditar com IA</h2>
      </div>
      <p className="text-[11px] text-slate-400">
        Aperte "Gravar", fale um resumo da visita técnica e aperte "Parar gravação" — a IA organiza automaticamente em
        linguagem técnica e sugere título, laudo, escopo, ambientes/atividades e, quando você disser claramente, também
        prazo, garantia, forma de pagamento e valor. Sempre revise antes de aplicar.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggleGravacao} disabled={!SpeechRecognitionCtor || processando}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
            gravando ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#00B4E5] text-[#0b2338] hover:bg-[#0069A8]'
          }`}>
          {gravando ? <Square size={14} /> : <Mic size={14} />} {gravando ? 'Parar gravação' : 'Gravar'}
        </button>
        {processando && <span className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Organizando com a IA...</span>}
        {!SpeechRecognitionCtor && (
          <span className="text-xs text-amber-600">Reconhecimento de voz não disponível neste navegador — funciona no Chrome (computador ou Android).</span>
        )}
      </div>

      {transcript && (
        <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={3}
          placeholder="O texto falado aparece aqui."
          className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-[#0b2338]" />
      )}
      {transcript && !processando && (
        <button type="button" onClick={() => organizarComIA(transcript)}
          className="text-xs text-[#0069A8] hover:underline">
          Reprocessar este texto com a IA
        </button>
      )}

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {rascunho && (
        <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
          <p className="text-xs font-medium text-slate-500">A IA organizou o relato — confira e aplique nos campos da proposta:</p>
          <div className="space-y-1.5 text-xs text-slate-600">
            {rascunho.titulo && <PreviewLine label="Título" value={rascunho.titulo} />}
            {rascunho.tipo_servico && <PreviewLine label="Tipo de serviço" value={rascunho.tipo_servico} />}
            {rascunho.local_servico && <PreviewLine label="Local" value={rascunho.local_servico} />}
            {rascunho.cliente_nome && <PreviewLine label="Cliente" value={rascunho.cliente_nome} />}
            {rascunho.apresentacao_html && <PreviewHtml label="Apresentação" html={rascunho.apresentacao_html} />}
            {rascunho.laudo_html && <PreviewHtml label="Laudo técnico" html={rascunho.laudo_html} />}
            {rascunho.escopo_descricao_html && <PreviewHtml label="Escopo" html={rascunho.escopo_descricao_html} />}
            {rascunho.ambientes.length > 0 && (
              <div>
                <span className="font-medium text-slate-500">Ambientes ({rascunho.ambientes.length}): </span>
                <span>{rascunho.ambientes.map(a => a.nome).join(', ')}</span>
              </div>
            )}
            {rascunho.prazo_execucao_valor && <PreviewLine label="Prazo de execução" value={`${rascunho.prazo_execucao_valor} ${rascunho.prazo_execucao_unidade ?? ''}`} />}
            {rascunho.garantia_mao_obra && <PreviewLine label="Garantia" value={rascunho.garantia_mao_obra} />}
            {rascunho.forma_pagamento_observacao && <PreviewLine label="Pagamento" value={rascunho.forma_pagamento_observacao} />}
            {typeof rascunho.valor_total === 'number' && (
              <p className="font-medium text-amber-600">⚠ Valor identificado: R$ {rascunho.valor_total.toLocaleString('pt-BR')} — confira com atenção antes de aplicar.</p>
            )}
          </div>
          <button type="button" onClick={aplicar}
            className="ce-btn-glow px-4 py-2 rounded-lg bg-[#00B4E5] text-[#0b2338] font-semibold text-sm hover:bg-[#0069A8]">
            Aplicar nos campos da proposta
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return <div><span className="font-medium text-slate-500">{label}: </span><span>{value}</span></div>;
}

function PreviewHtml({ label, html }: { label: string; html: string }) {
  const texto = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return <div><span className="font-medium text-slate-500">{label}: </span><span>{texto.length > 160 ? `${texto.slice(0, 160)}…` : texto}</span></div>;
}
