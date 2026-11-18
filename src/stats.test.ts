import { describe, expect, it } from 'vitest';
import { findDuplicates, pendingCopies, winsByEntry, winsByName } from './stats';
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

describe('findDuplicates', () => {
  it('acha nomes repetidos ignorando maiúsculas e espaços', () => {
    expect(findDuplicates(['Ana', 'Bia', ' ana ', 'ANA', 'Caio', 'bia'])).toEqual([
      { name: 'Ana', count: 3 },
      { name: 'Bia', count: 2 },
    ]);
  });

  it('sem repetidos, devolve lista vazia', () => {
    expect(findDuplicates(['Ana', 'Bia', 'Ana Paula'])).toEqual([]);
  });
});

describe('pendingCopies', () => {
  it('o item mais antigo é o original; só cópias não confirmadas pedem confirmação', () => {
    const items = [
      { id: 1, name: 'Ana' },
      { id: 2, name: 'Bia' },
      { id: 3, name: 'ana', confirmed: true },
      { id: 4, name: 'Ana' },
    ];
    expect(pendingCopies(items).map(i => i.id)).toEqual([4]);
  });

  it('a ordem na lista (embaralhada) não muda quem é o original', () => {
    const items = [{ id: 7, name: 'Ana' }, { id: 2, name: 'Ana' }];
    expect(pendingCopies(items).map(i => i.id)).toEqual([7]);
  });
});

describe('winsByEntry', () => {
  it('conta por item: nomes repetidos têm vitórias separadas', () => {
    const items = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Ana' }];
    const hist = [
      { name: 'Ana', n: 1, time: '', entryId: 2 },
      { name: 'Ana', n: 2, time: '', entryId: 2 },
      { name: 'Ana', n: 3, time: '', entryId: 1 },
    ];
    const w = winsByEntry(hist, items);
    expect(w.get(1)).toBe(1);
    expect(w.get(2)).toBe(2);
  });

  it('sorteio antigo sem id vai para o item mais antigo com o nome', () => {
    const items = [{ id: 5, name: 'Ana' }, { id: 3, name: 'ana' }];
    expect(winsByEntry([{ name: 'ANA', n: 1, time: '' }], items).get(3)).toBe(1);
  });

  it('ignora vitórias de itens que saíram da lista', () => {
    expect(winsByEntry([{ name: 'Ana', n: 1, time: '', entryId: 9 }], [{ id: 1, name: 'Ana' }]).size).toBe(0);
  });
});
