/**
 * Encaixe do nome dentro da fatia da roleta, sempre numa linha só e inteiro sempre que possível.
 *
 * 1) Diminui a letra até o nome caber inteiro (sem passar do mínimo legível).
 * 2) Último recurso: letra mínima e reticências (nunca estoura a fatia).
 */
import { truncateToWidth } from './text';

export interface LabelFit {
  text: string;
  /** Tamanho da letra em px. */
  fs: number;
}

export interface FitLimits {
  /** Comprimento disponível ao longo do raio (da borda do botão central até perto do aro). */
  maxW: number;
  /** Maior letra permitida (limitada pela grossura da fatia). */
  maxFs: number;
  /** Menor letra aceitável antes de partir para reticências. */
  minFs: number;
}

/**
 * @param measure largura do texto com letra de 100px (a largura cresce na mesma proporção da letra).
 */
export function fitLabel(name: string, measure: (text: string) => number, lim: FitLimits): LabelFit {
  const at = (text: string, fs: number) => (measure(text) * fs) / 100;
  const floor = Math.min(lim.minFs, lim.maxFs); // fatia muito fina: o mínimo é o que ela comporta

  const fs = Math.min(lim.maxFs, (100 * lim.maxW) / Math.max(1, measure(name)));
  if (fs >= floor) return { text: name, fs };

  return { text: truncateToWidth(name, lim.maxW, t => at(t, floor)), fs: floor };
}
