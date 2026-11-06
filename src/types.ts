export interface Entry {
  name: string;
  color: string;
}

export interface HistoryItem {
  name: string;
  n: number;
  time: string;
}

export const COLORS = [
  '#ff4d6d', '#ffc83d', '#3b82f6', '#2ee59d', '#a855f7', '#ff9f1c',
  '#06b6d4', '#f43f5e', '#84cc16', '#e879f9', '#facc15', '#6366f1',
] as const;

export const MAX_NAME_LENGTH = 40;
