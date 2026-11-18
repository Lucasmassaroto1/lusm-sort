import type { HistoryItem } from './types';

const KEY = 'lusm-sorte';

export interface SavedState {
  names: string[];
  history: HistoryItem[];
  /** Nomes repetidos que o usuário confirmou (chave de nameKey). */
  confirmed: string[];
}

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { names: [], history: [], confirmed: [] };
    const d = JSON.parse(raw) as Partial<SavedState>;
    return {
      names: Array.isArray(d.names) ? d.names.filter((x): x is string => typeof x === 'string') : [],
      history: Array.isArray(d.history) ? d.history : [],
      confirmed: Array.isArray(d.confirmed) ? d.confirmed.filter((x): x is string => typeof x === 'string') : [],
    };
  } catch {
    return { names: [], history: [], confirmed: [] };
  }
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}
