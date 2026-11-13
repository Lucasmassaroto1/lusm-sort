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
