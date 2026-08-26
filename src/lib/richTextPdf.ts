import type jsPDF from 'jspdf';

// Converte o HTML salvo pelo RichTextEditor (schema restrito do Tiptap — ver
// src/components/RichTextEditor.tsx: só p/h3/strong/em/ul/ol/li/br) em blocos desenháveis no PDF.
// jsPDF não tem suporte nativo a rich text — cada "run" (trecho com o mesmo negrito/itálico) é
// desenhado separadamente, um do lado do outro, medindo a largura real de cada palavra para
// quebrar linha corretamente mesmo com estilos misturados numa mesma frase.

export interface RichRun { text: string; bold?: boolean; italic?: boolean }
export type RichBlock =
  | { type: 'heading'; runs: RichRun[] }
  | { type: 'paragraph'; runs: RichRun[] }
  | { type: 'list'; items: RichRun[][] };

function extractRuns(el: Element, bold = false, italic = false): RichRun[] {
  const runs: RichRun[] = [];
  el.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) runs.push({ text, bold, italic });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element;
      const tag = childEl.tagName.toLowerCase();
      if (tag === 'br') { runs.push({ text: '\n', bold, italic }); return; }
      const nextBold = bold || tag === 'strong' || tag === 'b';
      const nextItalic = italic || tag === 'em' || tag === 'i';
      runs.push(...extractRuns(childEl, nextBold, nextItalic));
    }
  });
  return runs;
}

function hasVisibleText(runs: RichRun[]): boolean {
  return runs.some(r => r.text.trim().length > 0);
}

// Parseia client-side (DOMParser só existe no navegador) — sempre chamado a partir de código de
// UI/geração de PDF, nunca em contexto de servidor.
export function parseHtmlToBlocks(html: string | undefined | null): RichBlock[] {
  if (!html || !html.trim()) return [];
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const blocks: RichBlock[] = [];
  parsed.body.childNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'p') {
      const runs = extractRuns(el);
      if (hasVisibleText(runs)) blocks.push({ type: 'paragraph', runs });
    } else if (/^h[1-6]$/.test(tag)) {
      const runs = extractRuns(el);
      if (hasVisibleText(runs)) blocks.push({ type: 'heading', runs });
    } else if (tag === 'ul' || tag === 'ol') {
      const items: RichRun[][] = [];
      Array.from(el.children).forEach(child => {
        if (child.tagName.toLowerCase() !== 'li') return;
        const runs = extractRuns(child);
        if (hasVisibleText(runs)) items.push(runs);
      });
      if (items.length) blocks.push({ type: 'list', items });
    }
  });
  return blocks;
}

export function richBlocksHaveContent(blocks: RichBlock[]): boolean {
  return blocks.length > 0;
}

function fontStyle(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

// Quebra os runs em linhas que cabem em maxWidth, medindo palavra a palavra com a fonte/estilo
// correto de cada run (negrito é um pouco mais largo que o texto normal).
function wrapRuns(doc: jsPDF, runs: RichRun[], fontSize: number, maxWidth: number): RichRun[][] {
  doc.setFontSize(fontSize);
  const lines: RichRun[][] = [];
  let current: RichRun[] = [];
  let currentWidth = 0;

  const pushLine = () => { lines.push(current); current = []; currentWidth = 0; };

  runs.forEach(run => {
    run.text.split(/(\n)/).forEach(part => {
      if (part === '\n') { pushLine(); return; }
      if (!part) return;
      part.split(/(\s+)/).filter(w => w.length > 0).forEach(word => {
        doc.setFont('helvetica', fontStyle(run.bold, run.italic));
        const w = doc.getTextWidth(word);
        if (currentWidth + w > maxWidth && current.length > 0 && word.trim()) pushLine();
        current.push({ text: word, bold: run.bold, italic: run.italic });
        currentWidth += w;
      });
    });
  });
  if (current.length) pushLine();
  return lines;
}

function drawRunLine(doc: jsPDF, line: RichRun[], x: number, y: number, fontSize: number, color: [number, number, number]) {
  let cx = x;
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  line.forEach(run => {
    doc.setFont('helvetica', fontStyle(run.bold, run.italic));
    doc.text(run.text, cx, y);
    cx += doc.getTextWidth(run.text);
  });
}

export interface DrawRichBlocksOptions {
  paragraphFontSize?: number;
  headingFontSize?: number;
  lineHeight?: number;
  color?: [number, number, number];
}

// Desenha os blocos a partir de (x, startY), respeitando quebra de página ANTES de cada linha —
// nunca corta uma linha ao meio, e chama checkPageBreak antes do título/primeira linha de cada
// bloco para nunca deixar um título "órfão" sozinho no fim da página. Retorna o novo Y.
export function drawRichBlocks(
  doc: jsPDF,
  blocks: RichBlock[],
  x: number,
  startY: number,
  width: number,
  checkPageBreak: (cursor: number, needed: number) => number,
  opts: DrawRichBlocksOptions = {},
): number {
  const paragraphSize = opts.paragraphFontSize ?? 9.5;
  const headingSize = opts.headingFontSize ?? 11;
  const lineHeight = opts.lineHeight ?? 4.6;
  const color = opts.color ?? [24, 26, 31];
  let y = startY;

  blocks.forEach(block => {
    if (block.type === 'heading') {
      const lines = wrapRuns(doc, block.runs, headingSize, width);
      // Garante que o título e ao menos a linha seguinte não fiquem sozinhos no fim da página.
      y = checkPageBreak(y, lineHeight * Math.min(lines.length, 2) + 4);
      y += 1.5;
      lines.forEach(line => {
        y = checkPageBreak(y, lineHeight + 2);
        drawRunLine(doc, line.map(r => ({ ...r, bold: true })), x, y, headingSize, color);
        y += lineHeight + 0.6;
      });
      y += 1;
    } else if (block.type === 'paragraph') {
      const lines = wrapRuns(doc, block.runs, paragraphSize, width);
      lines.forEach(line => {
        y = checkPageBreak(y, lineHeight + 2);
        drawRunLine(doc, line, x, y, paragraphSize, color);
        y += lineHeight;
      });
      y += lineHeight * 0.4;
    } else if (block.type === 'list') {
      const bulletIndent = 5;
      block.items.forEach(itemRuns => {
        const lines = wrapRuns(doc, itemRuns, paragraphSize, width - bulletIndent);
        lines.forEach((line, li) => {
          y = checkPageBreak(y, lineHeight + 2);
          if (li === 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(paragraphSize);
            doc.setTextColor(...color);
            doc.text('•', x, y);
          }
          drawRunLine(doc, line, x + bulletIndent, y, paragraphSize, color);
          y += lineHeight;
        });
      });
      y += lineHeight * 0.4;
    }
  });

  return y;
}
