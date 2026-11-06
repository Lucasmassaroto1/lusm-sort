/**
 * Ícones da interface, cada um em seu próprio arquivo SVG (src/assets/icons).
 * Importados como texto para ficarem embutidos no botão e herdarem a cor do texto (currentColor).
 */
import somLigado from './assets/icons/som-ligado.svg?raw';
import somDesligado from './assets/icons/som-desligado.svg?raw';
import embaralhar from './assets/icons/embaralhar.svg?raw';
import limpar from './assets/icons/limpar.svg?raw';
import alerta from './assets/icons/alerta.svg?raw';
import trevo from './assets/icons/trevo.svg?raw';
import coroa from './assets/icons/coroa.svg?raw';

export const icons = { somLigado, somDesligado, embaralhar, limpar, alerta, trevo, coroa } as const;
export type IconName = keyof typeof icons;

/** Coloca ícone + texto dentro de um botão. */
export function setButton(button: HTMLElement, icon: IconName, label: string): void {
  button.innerHTML = `<span class="ico" aria-hidden="true">${icons[icon]}</span><span></span>`;
  (button.lastElementChild as HTMLElement).textContent = label;
}
