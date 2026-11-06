import type { HistoryItem } from './types';

const KEY = 'lusm-sorte';
const SOUND_KEY = 'lusm-som';

export interface SavedState {
  names: string[];
  history: HistoryItem[];
}

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { names: [], history: [] };
    const d = JSON.parse(raw) as Partial<SavedState>;
    return {
      names: Array.isArray(d.names) ? d.names.filter((x): x is string => typeof x === 'string') : [],
      history: Array.isArray(d.history) ? d.history : [],
    };
  } catch {
    return { names: [], history: [] };
  }
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

export function loadSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* ignora */
  }
}
