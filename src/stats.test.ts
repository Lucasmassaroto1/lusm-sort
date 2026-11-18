import { describe, expect, it } from 'vitest';
import { winsByName } from './stats';
import type { HistoryItem } from './types';

const h = (...names: string[]): HistoryItem[] => names.map((name, i) => ({ name, n: i + 1, time: '00:00:00' }));

describe('winsByName', () => {
  it('conta as vitórias e calcula a porcentagem', () => {
    const stats = winsByName(h('Ana', 'Bia', 'Ana', 'Ana'));
    expect(stats).toEqual([
      { name: 'Ana', wins: 3, pct: 75 },
      { name: 'Bia', wins: 1, pct: 25 },
    ]);
  });

  it('inclui com 0 quem está na roleta e ainda não ganhou', () => {
    const stats = winsByName(h('Ana'), ['Ana', 'Caio']);
    expect(stats).toEqual([
      { name: 'Ana', wins: 1, pct: 100 },
      { name: 'Caio', wins: 0, pct: 0 },
    ]);
  });

  it('mantém quem ganhou mesmo depois de sair da roleta', () => {
    const stats = winsByName(h('Duda', 'Ana'), ['Ana']);
    expect(stats.map(s => s.name).sort()).toEqual(['Ana', 'Duda']);
  });

  it('sem sorteios, todos ficam com 0%', () => {
    expect(winsByName([], ['Ana', 'Bia']).every(s => s.wins === 0 && s.pct === 0)).toBe(true);
  });

  it('as porcentagens somam 100', () => {
    const stats = winsByName(h('A', 'B', 'C', 'A', 'B', 'A', 'C'));
    expect(stats.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100);
  });
});
