/**
 * Placar de vitórias por nome, calculado a partir do histórico.
 * Função pura, testada em stats.test.ts.
 */
import type { HistoryItem } from './types';
import { nameKey } from './text';

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

export { nameKey };

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

/** Item da lista com identidade própria (dois "Ana" são itens diferentes). */
export interface ListItem {
  id: number;
  name: string;
  /** O usuário confirmou que esta cópia repetida é intencional. */
  confirmed?: boolean;
}

/**
 * Cópias repetidas: em cada grupo de nomes iguais, o item mais antigo (menor id) é o original
 * e os demais são cópias. Só as cópias ainda não confirmadas pedem confirmação.
 */
export function pendingCopies<T extends ListItem>(items: readonly T[]): T[] {
  const original = new Map<string, number>();
  for (const it of items) {
    const k = nameKey(it.name);
    const cur = original.get(k);
    if (cur === undefined || it.id < cur) original.set(k, it.id);
  }
  return items.filter(it => original.get(nameKey(it.name)) !== it.id && !it.confirmed);
}

/**
 * Vitórias de cada item (por id), para que nomes repetidos tenham selos separados.
 * Sorteios antigos, salvos antes de existir id, contam para o item mais antigo com aquele nome.
 */
export function winsByEntry(history: readonly HistoryItem[], items: readonly ListItem[]): Map<number, number> {
  const wins = new Map<number, number>();
  const ids = new Set(items.map(it => it.id));
  const oldest = new Map<string, number>();
  for (const it of items) {
    const k = nameKey(it.name);
    const cur = oldest.get(k);
    if (cur === undefined || it.id < cur) oldest.set(k, it.id);
  }
  for (const h of history) {
    const id = h.entryId !== undefined ? h.entryId : oldest.get(nameKey(h.name));
    if (id !== undefined && ids.has(id)) wins.set(id, (wins.get(id) ?? 0) + 1);
  }
  return wins;
}
