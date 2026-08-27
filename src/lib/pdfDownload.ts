import type jsPDF from 'jspdf';

// Entrega um PDF já gerado ao usuário. O download automático de jsPDF (doc.save(), que cria um
// <a download> e clica nele sozinho) falha silenciosamente em vários navegadores móveis — sem
// erro nenhum, sem toast, o clique simplesmente não completa o download, dando a impressão de
// "o PDF não foi gerado". Abrir o PDF numa nova aba (o navegador então mostra o próprio leitor de
// PDF nativo, com opção de baixar/compartilhar/imprimir) é muito mais confiável em celular e
// funciona igualmente bem em desktop. Se a nova aba for bloqueada (bloqueador de pop-up), cai
// para o download automático como alternativa.
export function openOrDownloadPdf(doc: jsPDF, filename: string): void {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const janela = window.open(url, '_blank');
    if (!janela) {
      doc.save(filename);
      return;
    }
    // Revoga o Object URL depois de um tempo — dá margem para a aba nova carregar o PDF antes
    // de liberar a memória.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    console.error('[openOrDownloadPdf] Falha ao abrir o PDF numa nova aba, tentando download direto', err);
    doc.save(filename);
  }
}
