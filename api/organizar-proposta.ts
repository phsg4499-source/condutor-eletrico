import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

// Função serverless (roda só na Vercel, nunca no navegador) que recebe a transcrição de voz do
// orçamentista — captada no navegador via Web Speech API, ver src/components/VoiceDictation.tsx
// — e devolve os campos da "Proposta técnica completa" já organizados em linguagem técnica pelo
// Claude: identificação, laudo, escopo, ambientes/atividades e, quando o relato trouxer essa
// informação, também prazo, garantia e valor. A chave ANTHROPIC_API_KEY só existe aqui (variável
// de ambiente do servidor); o app nunca a expõe ao cliente.
//
// O orçamentista sempre revisa o rascunho antes de aplicar nos campos (ver VoiceDictation.tsx) —
// nada é salvo automaticamente, então mesmo o valor sugerido pela IA passa por conferência humana
// antes de virar orçamento de verdade.

const AtividadeSchema = z.object({
  descricao: z.string(),
  quantidade: z.number().optional(),
  unidade: z.string().optional(),
});

const AmbienteSchema = z.object({
  nome: z.string(),
  descricao: z.string().optional(),
  atividades: z.array(AtividadeSchema),
});

const PropostaDraftSchema = z.object({
  titulo: z.string(),
  tipo_servico: z.string(),
  local_servico: z.string(),
  cliente_nome: z.string(),
  apresentacao_html: z.string(),
  laudo_html: z.string(),
  escopo_descricao_html: z.string(),
  escopo_servicos_incluidos_html: z.string(),
  escopo_servicos_nao_incluidos_html: z.string(),
  escopo_premissas_html: z.string(),
  escopo_responsabilidades_cliente_html: z.string(),
  ambientes: z.array(AmbienteSchema),
  prazo_execucao_valor: z.number().optional(),
  prazo_execucao_unidade: z.enum(['dias_uteis', 'dias_corridos', 'semanas', 'meses']).optional(),
  garantia_mao_obra: z.string(),
  valor_total: z.number().optional(),
  forma_pagamento_observacao: z.string(),
});

const SYSTEM_PROMPT = `Você é um assistente técnico da empresa Condutor Elétrico Brasil (serviços elétricos residenciais, comerciais, prediais e industriais).

Você recebe a transcrição de um relato FALADO de um orçamentista, feito logo após uma visita técnica, e organiza esse relato numa proposta técnica completa, em português técnico, claro e profissional. Seu objetivo é preencher o máximo de campos que o relato realmente permitir — mas sem NUNCA inventar o que não foi dito.

Regras obrigatórias:
- Nunca invente informações que não estejam no relato — não invente normas técnicas, garantias, prazos, quantidades, materiais, valores ou qualquer dado que a pessoa não tenha mencionado claramente.
- Se o relato não trouxer informação suficiente para preencher algum campo, devolva string vazia "" (lista vazia [] para ambientes, e OMITA os campos numéricos opcionais como valor_total/prazo_execucao_valor) — nunca invente conteúdo só para preencher.
- "valor_total": só preencha se a pessoa citou claramente um valor final em reais para o serviço todo. Se houver qualquer ambiguidade sobre o valor (ex: valores parciais, "mais ou menos", múltiplos valores confusos), deixe o campo vazio (omita) em vez de arriscar um número errado.
- Campos em HTML (apresentacao_html, laudo_html, escopo_descricao_html, escopo_servicos_incluidos_html, escopo_servicos_nao_incluidos_html, escopo_premissas_html, escopo_responsabilidades_cliente_html) devem usar HTML simples, apenas com as tags: <p>, <strong>, <em>, <ul>, <ol>, <li>, <h3>. Nunca use nenhuma outra tag, nem atributos.

Como preencher cada campo:
- "titulo": um título curto e comercial para a proposta (ex: "Modernização elétrica residencial"), baseado no serviço descrito.
- "tipo_servico": categoria curta (ex: "Instalação", "Reforma elétrica", "Manutenção", "Vistoria").
- "local_servico": endereço ou descrição do local, só se mencionado.
- "cliente_nome": nome do cliente, só se mencionado explicitamente no relato.
- "apresentacao_html": um parágrafo curto de abertura da proposta, cordial e profissional — só se o relato der base pra isso; senão, vazio.
- "laudo_html": o diagnóstico técnico em si — o que foi identificado, situação atual, problema, solução recomendada, normas citadas pelo relato (nunca invente normas).
- "escopo_descricao_html": descrição geral do escopo do serviço a ser executado.
- "escopo_servicos_incluidos_html" / "escopo_servicos_nao_incluidos_html" / "escopo_premissas_html" / "escopo_responsabilidades_cliente_html": listas (<ul>) correspondentes, só quando identificáveis no relato.
- "ambientes": um item por ambiente/área mencionado (ex: sala, cozinha, quadro de distribuição), cada um com as atividades citadas para aquele ambiente — quantidade/unidade só quando explicitamente ditas.
- "prazo_execucao_valor" + "prazo_execucao_unidade": só se a pessoa deu um prazo de execução claro (ex: "uns 10 dias úteis").
- "garantia_mao_obra": só se a pessoa mencionou um prazo de garantia.
- "forma_pagamento_observacao": uma frase curta resumindo o que foi dito sobre pagamento (ex: "à vista no Pix, ou parcelado no cartão"), sem inventar condições não citadas; vazio se nada foi dito.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      error: 'A integração com IA ainda não foi configurada neste ambiente. Defina a variável de ambiente ANTHROPIC_API_KEY (nunca com prefixo VITE_) nas configurações do projeto na Vercel.',
    });
    return;
  }

  const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript.trim() : '';
  if (!transcript) {
    res.status(400).json({ error: 'Nenhum texto foi enviado para organizar.' });
    return;
  }
  if (transcript.length > 8000) {
    res.status(400).json({ error: 'Texto muito longo (máximo de 8000 caracteres por vez).' });
    return;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Relato transcrito do orçamentista sobre a visita técnica:\n\n${transcript}` },
      ],
      output_config: { format: zodOutputFormat(PropostaDraftSchema) },
    });

    if (!response.parsed_output) {
      res.status(502).json({ error: 'A IA não conseguiu organizar esse texto. Tente descrever com mais detalhes.' });
      return;
    }

    res.status(200).json({ result: response.parsed_output });
  } catch (err) {
    console.error('[organizar-proposta] Falha ao chamar a IA', err);
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(502).json({ error: 'Chave de IA inválida configurada no servidor.' });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(502).json({ error: 'Limite de uso da IA atingido no momento. Tente novamente em instantes.' });
    } else {
      res.status(502).json({ error: 'Não foi possível organizar o texto com a IA agora. Tente novamente.' });
    }
  }
}
