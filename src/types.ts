export interface Entry {
  /** Identidade do item: dois nomes iguais são itens diferentes. Maior id = adicionado depois. */
  id: number;
  name: string;
  color: string;
  /** Cópia repetida confirmada pelo usuário (não pede mais confirmação). */
  confirmed?: boolean;
}

export interface HistoryItem {
  name: string;
  n: number;
  time: string;
  /** Item que ganhou (sorteios antigos não têm). */
  entryId?: number;
}

export const COLORS = [
  '#ff4d6d', '#ffc83d', '#3b82f6', '#2ee59d', '#a855f7', '#ff9f1c',
  '#06b6d4', '#f43f5e', '#84cc16', '#e879f9', '#facc15', '#6366f1',
] as const;

export const MAX_NAME_LENGTH = 40;

/** Máximo de nomes na roleta: acima disso as fatias ficam finas demais para ler. */
export const MAX_NAMES = 100;
