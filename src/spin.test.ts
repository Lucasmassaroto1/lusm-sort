import { describe, expect, it } from 'vitest';
import { indexAtPointer, mod, planSpin, TAU, type RandomSource } from './spin';
import { secureInt, secureShuffle } from './random';

describe('planSpin', () => {
  it('sempre para exatamente no vencedor sorteado', () => {
    let rotation = 0;
    for (let k = 0; k < 20000; k++) {
      const n = 2 + (k % 30);
      const plan = planSpin(rotation, n);
      expect(plan.to).toBeGreaterThan(plan.from);
      expect(indexAtPointer(plan.to, n)).toBe(plan.winner);
      rotation = plan.to;
    }
  });

  it('dá pelo menos 6 voltas completas', () => {
    const plan = planSpin(1.234, 8);
    expect(plan.to - plan.from).toBeGreaterThanOrEqual(6 * TAU);
  });

  it('para na fatia que o gerador escolheu (gerador controlado)', () => {
    for (let n = 2; n <= 12; n++) {
      for (let w = 0; w < n; w++) {
        for (const f of [0, 0.5, 0.999999]) {
          const fixed: RandomSource = { int: m => (m === n ? w : 0), float: () => f };
          const plan = planSpin(0.77 * w, n, fixed);
          expect(plan.winner).toBe(w);
          expect(indexAtPointer(plan.to, n)).toBe(w);
        }
      }
    }
  });

  it('continua certo depois de normalizar a rotação entre giros', () => {
    let rotation = 0;
    for (let k = 0; k < 2000; k++) {
      const plan = planSpin(rotation, 5);
      rotation = mod(plan.to, TAU);
      expect(rotation).toBeGreaterThanOrEqual(0);
      expect(rotation).toBeLessThan(TAU);
      expect(indexAtPointer(rotation, 5)).toBe(plan.winner);
    }
  });

  it('giro completo é uniforme (teste qui-quadrado)', () => {
    // Do sorteio até onde o ponteiro parou: cada fatia deve ganhar ~1/n das vezes.
    for (const n of [2, 5, 9]) {
      const runs = 60000;
      const counts = new Array(n).fill(0);
      let rotation = 0;
      for (let i = 0; i < runs; i++) {
        const plan = planSpin(rotation, n);
        rotation = mod(plan.to, TAU);
        counts[indexAtPointer(rotation, n)]++;
      }
      const expected = runs / n;
      const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
      // Valores críticos com p = 0,0001 (graus de liberdade n-1): só falha se houver viés real.
      const critical: Record<number, number> = { 2: 15.14, 5: 23.51, 9: 31.83 };
      expect(chi2).toBeLessThan(critical[n]);
    }
  });

  it('recusa menos de 2 nomes', () => {
    expect(() => planSpin(0, 1)).toThrow();
  });
});

describe('secureInt', () => {
  it('é uniforme (todas as posições com a mesma chance)', () => {
    const n = 7;
    const runs = 140000;
    const counts = new Array(n).fill(0);
    for (let i = 0; i < runs; i++) counts[secureInt(n)]++;
    const expected = runs / n;
    // tolerância de 3% em torno do esperado
    for (const c of counts) expect(Math.abs(c - expected) / expected).toBeLessThan(0.03);
  });

  it('fica sempre dentro do intervalo', () => {
    for (let i = 0; i < 10000; i++) {
      const v = secureInt(3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });
});

describe('secureShuffle', () => {
  it('mantém os mesmos nomes, sem repetir nem perder', () => {
    const names = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu'];
    const shuffled = secureShuffle([...names]);
    expect([...shuffled].sort()).toEqual([...names].sort());
  });
});
