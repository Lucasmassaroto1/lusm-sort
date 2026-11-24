import type { Entry } from './types';
import { TAU } from './spin';
import { fitLabel } from './label';

function shade(hex: string, amt: number): string {
  const c = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp((c >> 16) + amt)},${clamp(((c >> 8) & 255) + amt)},${clamp((c & 255) + amt)})`;
}

function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  return [c, ctx];
}

const BULB_COUNT = 24;
const BULB_SPRITE = 48;

/**
 * Desenha a roleta no canvas: aro dourado, fatias, nomes e lâmpadas.
 *
 * Desempenho: as partes que não mudam durante o giro ficam guardadas em canvases
 * fora da tela e só são redesenhadas quando a lista muda:
 * - fundo (aro dourado), brilho por cima e as lâmpadas acesa/apagada: uma vez só;
 * - disco com fatias e nomes: quando nomes ou cores mudam.
 * A cada quadro do giro só se gira a imagem do disco e se colam as lâmpadas,
 * em vez de recalcular gradientes, sombras e o corte de cada nome.
 */
export class WheelRenderer {
  private ctx: CanvasRenderingContext2D;
  private S: number;
  private R: number;
  private rOuter: number;

  private base?: HTMLCanvasElement;
  private gloss?: HTMLCanvasElement;
  private bulbOn?: HTMLCanvasElement;
  private bulbOff?: HTMLCanvasElement;
  private disc?: HTMLCanvasElement;
  private discKey = '';

  rotation = 0;
  spinning = false;
  bulbPhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.S = canvas.width;
    this.R = this.S / 2;
    this.rOuter = this.R - 18;
  }

  /** Descarta as imagens guardadas (ex.: quando a fonte do site termina de carregar). */
  invalidate(): void {
    this.disc = undefined;
    this.discKey = '';
  }

  draw(entries: readonly Entry[]): void {
    const { ctx, S, R } = this;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.getBase(), 0, 0);

    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(this.rotation);
    ctx.drawImage(this.getDisc(entries), -R, -R);
    ctx.restore();

    if (entries.length) ctx.drawImage(this.getGloss(), 0, 0);
    this.drawBulbs();
  }

  // ---------- camadas guardadas ----------

  /** Aro dourado e fundo escuro. */
  private getBase(): HTMLCanvasElement {
    if (this.base) return this.base;
    const { S, R, rOuter } = this;
    const [c, ctx] = makeCanvas(S);
    ctx.beginPath();
    ctx.arc(R, R, R - 4, 0, TAU);
    const rim = ctx.createLinearGradient(0, 0, S, S);
    rim.addColorStop(0, '#fff3c4');
    rim.addColorStop(0.5, '#ffc83d');
    rim.addColorStop(1, '#a86200');
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(R, R, rOuter + 4, 0, TAU);
    ctx.fillStyle = '#0b0a14';
    ctx.fill();
    return (this.base = c);
  }

  /** Brilho fixo por cima das fatias (não gira junto). */
  private getGloss(): HTMLCanvasElement {
    if (this.gloss) return this.gloss;
    const { S, R, rOuter } = this;
    const [c, ctx] = makeCanvas(S);
    const gl = ctx.createRadialGradient(R * 0.7, R * 0.55, 10, R, R, rOuter);
    gl.addColorStop(0, '#ffffff22');
    gl.addColorStop(0.6, '#ffffff00');
    gl.addColorStop(1, '#00000055');
    ctx.beginPath();
    ctx.arc(R, R, rOuter, 0, TAU);
    ctx.fillStyle = gl;
    ctx.fill();
    return (this.gloss = c);
  }

  /** Fatias e nomes, desenhados na rotação 0. Refeito só quando a lista muda. */
  private getDisc(entries: readonly Entry[]): HTMLCanvasElement {
    const key = entries.length + '\u0000' + entries.map(e => e.color + e.name).join('\u0000');
    if (this.disc && key === this.discKey) return this.disc;

    const { S, R, rOuter } = this;
    const [c, ctx] = this.disc ? [this.disc, this.disc.getContext('2d')!] : makeCanvas(S);
    ctx.clearRect(0, 0, S, S);
    const n = entries.length;

    if (n === 0) {
      ctx.beginPath();
      ctx.arc(R, R, rOuter, 0, TAU);
      ctx.fillStyle = '#1f1c36';
      ctx.fill();
      ctx.fillStyle = '#9b95c4';
      ctx.font = '600 40px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Adicione nomes', R, R - 190);
    } else {
      const seg = TAU / n;
      // O nome vai da borda do botão central até perto do aro, sempre numa linha.
      const right = rOuter - 30;
      const left = R * 0.27;
      const maxW = right - left;
      // A fatia afina perto do centro: a letra cabe em ~80% da grossura no ponto onde o texto começa.
      const s = Math.sin(Math.min(seg / 2, Math.PI / 2));
      for (let i = 0; i < n; i++) {
        const a0 = i * seg - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(R, R);
        ctx.arc(R, R, rOuter, a0, a0 + seg);
        ctx.closePath();
        const g = ctx.createRadialGradient(R, R, rOuter * 0.15, R, R, rOuter);
        g.addColorStop(0, shade(entries[i].color, -60));
        g.addColorStop(0.55, entries[i].color);
        g.addColorStop(1, shade(entries[i].color, 25));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#0b0a14aa';
        ctx.lineWidth = n > 40 ? 1.5 : 4;
        ctx.stroke();

        // nome
        ctx.save();
        ctx.translate(R, R);
        ctx.rotate(a0 + seg / 2);
        ctx.font = '800 100px Outfit';
        const measure = (t: string) => ctx.measureText(t).width;
        const m = measure(entries[i].name);
        // Maior letra em que o texto (começando em right - largura) ainda cabe na grossura da fatia.
        const maxFs = Math.min(56, (1.6 * s * right) / (1 + (1.6 * s * m) / 100));
        const { text: label, fs } = fitLabel(entries[i].name, measure, { maxW, maxFs, minFs: 18 });
        ctx.font = `800 ${fs}px Outfit`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000a';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#fff';
        ctx.fillText(label, right, 0);
        ctx.restore();
      }
    }
    this.discKey = key;
    return (this.disc = c);
  }

  /** Lâmpada acesa/apagada desenhada uma vez (o brilho com sombra é caro de refazer). */
  private bulbSprite(on: boolean): HTMLCanvasElement {
    const cached = on ? this.bulbOn : this.bulbOff;
    if (cached) return cached;
    const [c, ctx] = makeCanvas(BULB_SPRITE);
    const m = BULB_SPRITE / 2;
    ctx.beginPath();
    ctx.arc(m, m, 7, 0, TAU);
    ctx.fillStyle = on ? '#fffbe6' : '#7a4a00';
    if (on) {
      ctx.shadowColor = '#ffe58a';
      ctx.shadowBlur = 16;
    }
    ctx.fill();
    if (on) this.bulbOn = c;
    else this.bulbOff = c;
    return c;
  }

  private drawBulbs(): void {
    const { ctx, R, rOuter } = this;
    const on = this.bulbSprite(true);
    const off = this.bulbSprite(false);
    const half = BULB_SPRITE / 2;
    for (let i = 0; i < BULB_COUNT; i++) {
      const a = (i / BULB_COUNT) * TAU;
      const x = R + Math.cos(a) * (rOuter + 9);
      const y = R + Math.sin(a) * (rOuter + 9);
      const lit = this.spinning
        ? (i + this.bulbPhase) % 2 === 0
        : (i + Math.floor(this.bulbPhase / 3)) % 3 === 0;
      ctx.drawImage(lit ? on : off, x - half, y - half);
    }
  }
}
