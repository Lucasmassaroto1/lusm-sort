import { describe, expect, it } from 'vitest';
import { fitLabel } from './label';
import { graphemes } from './text';

// Medida falsa: cada caractere visível tem 60% da altura da letra.
const measure = (t: string) => graphemes(t).length * 60;
const widthAt = (t: string, fs: number) => (measure(t) * fs) / 100;

describe('fitLabel (uma linha)', () => {
  const lim = { maxW: 400, maxFs: 56, minFs: 16 };

  it('nome curto: letra máxima', () => {
    expect(fitLabel('Ana', measure, lim)).toEqual({ text: 'Ana', fs: 56 });
  });

  it('nome longo: diminui a letra e aparece inteiro', () => {
    const name = 'Maria Eduarda dos Santos Oliveira'; // 33 caracteres
    const r = fitLabel(name, measure, lim);
    expect(r.text).toBe(name);
    expect(r.fs).toBeLessThan(56);
    expect(r.fs).toBeGreaterThanOrEqual(16);
    expect(widthAt(r.text, r.fs)).toBeLessThanOrEqual(400 + 1e-9);
  });

  it('longo demais até para a letra mínima: reticências, sem estourar', () => {
    const r = fitLabel('Pedro'.repeat(10), measure, lim);
    expect(r.text.endsWith('…')).toBe(true);
    expect(r.fs).toBe(16);
    expect(widthAt(r.text, r.fs)).toBeLessThanOrEqual(400);
  });

  it('fatia fina: o mínimo vira o que a fatia comporta', () => {
    const r = fitLabel('Ana Paula', measure, { maxW: 400, maxFs: 10, minFs: 16 });
    expect(r.fs).toBeLessThanOrEqual(10);
  });

  it('nunca passa da largura disponível', () => {
    for (const name of ['A', 'José', 'Ana Paula Souza', '😀'.repeat(40), 'X'.repeat(40)]) {
      const r = fitLabel(name, measure, lim);
      expect(widthAt(r.text, r.fs)).toBeLessThanOrEqual(400 + 1e-9);
    }
  });
});
