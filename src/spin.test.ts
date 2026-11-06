import { describe, expect, it } from 'vitest';
import { indexAtPointer, planSpin, TAU } from './spin';
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
