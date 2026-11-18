/**
 * Tratamento de texto dos nomes: limpeza de caracteres invisíveis, comparação
 * e corte sem quebrar emoji ou letras acentuadas.
 */

/**
 * Caracteres que não aparecem na tela e não servem para nada num nome:
 * espaços de largura zero, marcas de direção, hífen invisível, BOM, preenchimentos
 * (Hangul, Braille em branco) e afins. ZWJ (‍) e ZWNJ (‌) ficam no nome
 * exibido, porque formam emojis compostos e algumas escritas, mas saem da comparação.
 */
const INVISIBLE =
  /[­͏؜ᅟᅠ឴឵᠋-᠎​‎‏‪-‮⁠-⁯⠀ㅤ﻿ﾠ]/g;

/** Limpa o nome como ele vai aparecer: tira invisíveis, junta espaços e apara as pontas. */
export function cleanName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** O nome tem pelo menos um caractere visível (não é só espaço, marca ou formatação)? */
export function hasVisibleChar(name: string): boolean {
  return name.replace(/[\p{Cf}\p{Z}\p{M}\s︎️]/gu, '').length > 0;
}

/**
 * Chave para comparar nomes: ignora maiúsculas, espaços extras, invisíveis e a forma
 * como o acento foi digitado ("é" pronto ou "e" + acento). Assim "Ana" e "Ana" com
 * um caractere invisível contam como o mesmo nome.
 */
export function nameKey(s: string): string {
  return cleanName(s).replace(/\p{Cf}/gu, '').toLocaleLowerCase('pt-BR');
}

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }) : null;

/**
 * Divide em "caracteres que a pessoa vê" (grafemas): um emoji de família ou um "é"
 * com acento separado contam como um só.
 */
export function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), x => x.segment);
  return Array.from(s); // reserva: ao menos não parte pares de emoji
}

/** Quantidade de caracteres visíveis (grafemas). */
export const visibleLength = (s: string): number => graphemes(s).length;

/** Corta em `max` grafemas, com reticências se cortou. */
export function truncate(s: string, max: number): string {
  const g = graphemes(s);
  return g.length <= max ? s : g.slice(0, max).join('') + '…';
}

/**
 * Maior começo do texto que cabe em `maxW` (medido por `measure`), com reticências.
 * Corta por grafema e usa busca binária para medir poucas vezes.
 */
export function truncateToWidth(s: string, maxW: number, measure: (t: string) => number): string {
  if (measure(s) <= maxW) return s;
  const g = graphemes(s);
  let lo = 1;
  let hi = g.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(g.slice(0, mid).join('') + '…') <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return g.slice(0, lo).join('') + '…';
}
