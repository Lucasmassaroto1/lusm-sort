import type { HistoryItem } from './types';

const KEY = 'lusm-sorte';

export interface SavedEntry {
  id: number;
  name: string;
  confirmed?: boolean;
}

export interface SavedState {
  entries: SavedEntry[];
  history: HistoryItem[];
}

const empty = (): SavedState => ({ entries: [], history: [] });
const nameKey = (s: string): string => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw) as Partial<SavedState> & { names?: unknown; confirmed?: unknown };
    const history = Array.isArray(d.history) ? d.history : [];

    if (Array.isArray(d.entries)) {
      const entries = d.entries.filter(
        (e): e is SavedEntry => !!e && typeof e.name === 'string' && Number.isInteger(e.id),
      );
      return { entries, history };
    }

    // Formato antigo: só a lista de nomes (+ nomes confirmados). Ganha ids na ordem da lista.
    const names = Array.isArray(d.names) ? d.names.filter((x): x is string => typeof x === 'string') : [];
    const confirmed = new Set(Array.isArray(d.confirmed) ? (d.confirmed as unknown[]).filter((x): x is string => typeof x === 'string') : []);
    return { entries: names.map((name, i) => ({ id: i + 1, name, confirmed: confirmed.has(nameKey(name)) })), history };
  } catch {
    return empty();
  }
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}
