/**
 * Placar de vitórias por nome, calculado a partir do histórico.
 * Função pura, testada em stats.test.ts.
 */
import type { HistoryItem } from './types';

export interface WinStat {
  name: string;
  wins: number;
  /** Porcentagem das vitórias sobre o total de sorteios (0 a 100). */
  pct: number;
}

/**
 * Conta quantas vezes cada nome ganhou.
 * Nomes que estão na roleta mas ainda não ganharam entram com 0, para mostrar que também concorrem.
 * Ordem: mais vitórias primeiro; empate fica na ordem em que o nome apareceu.
 */
export function winsByName(history: readonly HistoryItem[], currentNames: readonly string[] = []): WinStat[] {
  const counts = new Map<string, number>();
  for (const h of history) counts.set(h.name, (counts.get(h.name) ?? 0) + 1);
  for (const name of currentNames) if (!counts.has(name)) counts.set(name, 0);

  const total = history.length;
  return [...counts.entries()]
    .map(([name, wins]) => ({ name, wins, pct: total ? (wins / total) * 100 : 0 }))
    .sort((a, b) => b.wins - a.wins);
}

/** Chave usada para comparar nomes: ignora maiúsculas e espaços extras. */
export const nameKey = (s: string): string => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export interface Duplicate {
  /** Nome como aparece primeiro na lista. */
  name: string;
  /** Quantas fatias esse nome ocupa na roleta. */
  count: number;
}

/**
 * Nomes que aparecem mais de uma vez (ignorando maiúsculas e espaços extras).
 * Cada repetição é uma fatia a mais, ou seja, mais chance de ganhar.
 */
export function findDuplicates(names: readonly string[]): Duplicate[] {
  const groups = new Map<string, Duplicate>();
  for (const name of names) {
    const key = nameKey(name);
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { name, count: 1 });
  }
  return [...groups.values()].filter(g => g.count > 1);
}
