export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Conversor de número por extenso em português (usado no recibo em PDF, campo obrigatório
// "Recebemos de ... a importância de R$ X (X reais)"). Cobre de zero até 999 bilhões, o
// suficiente para qualquer valor real de um recibo de serviço elétrico.
const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['cem', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

// Converte um número de 0 a 999 por extenso (sem escala — "mil"/"milhão" são aplicados por fora).
function grupoDeTresPorExtenso(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const partes: string[] = [];
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  if (centena > 0) partes.push(CENTENAS[centena - 1]);
  if (resto > 0) {
    if (resto < 10) {
      partes.push(UNIDADES[resto]);
    } else if (resto < 20) {
      partes.push(DEZ_A_DEZENOVE[resto - 10]);
    } else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(unidade > 0 ? `${DEZENAS[dezena - 2]} e ${UNIDADES[unidade]}` : DEZENAS[dezena - 2]);
    }
  }
  return partes.join(' e ');
}

// Escalas de milhar, da mais baixa para a mais alta — singular/plural tratado separadamente.
const ESCALAS: Array<{ singular: string; plural: string }> = [
  { singular: '', plural: '' },
  { singular: 'mil', plural: 'mil' },
  { singular: 'milhão', plural: 'milhões' },
  { singular: 'bilhão', plural: 'bilhões' },
];

function numeroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const grupos: number[] = [];
  let restante = Math.floor(n);
  while (restante > 0) {
    grupos.unshift(restante % 1000);
    restante = Math.floor(restante / 1000);
  }
  const partesNaoNulas = grupos
    .map((valor, indice) => ({ valor, escala: grupos.length - 1 - indice }))
    .filter(g => g.valor > 0);

  const textos = partesNaoNulas.map(({ valor, escala }) => {
    const escalaInfo = ESCALAS[escala];
    if (escala === 0) return grupoDeTresPorExtenso(valor);
    if (escala === 1) {
      // "mil" nunca leva "um" na frente (é "mil", não "um mil").
      return valor === 1 ? 'mil' : `${grupoDeTresPorExtenso(valor)} mil`;
    }
    const palavraEscala = valor === 1 ? escalaInfo.singular : escalaInfo.plural;
    return `${grupoDeTresPorExtenso(valor)} ${palavraEscala}`;
  });

  if (textos.length === 1) return textos[0];
  const ultimo = partesNaoNulas[partesNaoNulas.length - 1];
  const usaE = ultimo.escala === 0 && (ultimo.valor < 100 || ultimo.valor % 100 === 0);
  const iniciais = textos.slice(0, -1).join(', ');
  return usaE ? `${iniciais} e ${textos[textos.length - 1]}` : `${iniciais}, ${textos[textos.length - 1]}`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Regra gramatical do português: usa-se "de" entre o numeral e o substantivo quando a palavra
// imediatamente antes do substantivo é "milhão(ões)"/"bilhão(ões)" — "um milhão DE reais", mas
// "mil reais" (sem "de") e "um milhão e cem mil reais" (sem "de", pois quem fica ao lado é "mil").
function precisaDeAntesDoSubstantivo(n: number): boolean {
  let restante = Math.floor(n);
  let escala = 0;
  while (restante > 0) {
    const grupo = restante % 1000;
    if (grupo > 0) return escala >= 2;
    restante = Math.floor(restante / 1000);
    escala += 1;
  }
  return false;
}

// Ex.: valorPorExtenso(1470.5) -> "Mil, quatrocentos e setenta reais e cinquenta centavos"
// Ex.: valorPorExtenso(1000000) -> "Um milhão de reais"
export function valorPorExtenso(value: number): string {
  const valorAbsoluto = Math.abs(value);
  const parteInteira = Math.floor(valorAbsoluto);
  const centavos = Math.round((valorAbsoluto - parteInteira) * 100);

  const conectorReais = precisaDeAntesDoSubstantivo(parteInteira) ? ' de ' : ' ';
  const reaisTexto = `${numeroPorExtenso(parteInteira)}${conectorReais}${parteInteira === 1 ? 'real' : 'reais'}`;
  if (centavos === 0) return capitalizar(reaisTexto);

  const centavosTexto = `${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
  return capitalizar(`${reaisTexto} e ${centavosTexto}`);
}
