import type { Entry } from './types';
import { TAU } from './spin';

function shade(hex: string, amt: number): string {
  const c = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp((c >> 16) + amt)},${clamp(((c >> 8) & 255) + amt)},${clamp((c & 255) + amt)})`;
}

/** Desenha a roleta no canvas: aro dourado, fatias, nomes e lâmpadas. */
export class WheelRenderer {
  private ctx: CanvasRenderingContext2D;
  private S: number;
  private R: number;

  rotation = 0;
  spinning = false;
  bulbPhase = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.S = canvas.width;
    this.R = this.S / 2;
  }

  draw(entries: readonly Entry[]): void {
    const { ctx, S, R } = this;
    ctx.clearRect(0, 0, S, S);
    const rOuter = R - 18;

    // aro externo
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
      this.drawBulbs(rOuter);
      return;
    }

    const seg = TAU / n;
    for (let i = 0; i < n; i++) {
      const a0 = this.rotation + i * seg - Math.PI / 2;
      const a1 = a0 + seg;
      ctx.beginPath();
      ctx.moveTo(R, R);
      ctx.arc(R, R, rOuter, a0, a1);
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
      const maxW = rOuter * 0.62;
      const fs = Math.min(56, Math.max(14, seg * rOuter * 0.55));
      ctx.font = `800 ${fs}px Outfit`;
      let label = entries[i].name;
      if (ctx.measureText(label).width > maxW) {
        while (label.length > 1 && ctx.measureText(label + '…').width > maxW) label = label.slice(0, -1);
        label += '…';
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000a';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#fff';
      ctx.fillText(label, rOuter - 36, 0);
      ctx.restore();
    }

    // brilho
    const gl = ctx.createRadialGradient(R * 0.7, R * 0.55, 10, R, R, rOuter);
    gl.addColorStop(0, '#ffffff22');
    gl.addColorStop(0.6, '#ffffff00');
    gl.addColorStop(1, '#00000055');
    ctx.beginPath();
    ctx.arc(R, R, rOuter, 0, TAU);
    ctx.fillStyle = gl;
    ctx.fill();
    this.drawBulbs(rOuter);
  }

  private drawBulbs(rOuter: number): void {
    const { ctx, R } = this;
    const count = 24;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const x = R + Math.cos(a) * (rOuter + 9);
      const y = R + Math.sin(a) * (rOuter + 9);
      const on = this.spinning
        ? (i + this.bulbPhase) % 2 === 0
        : (i + Math.floor(this.bulbPhase / 3)) % 3 === 0;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, TAU);
      ctx.fillStyle = on ? '#fffbe6' : '#7a4a00';
      ctx.shadowColor = on ? '#ffe58a' : 'transparent';
      ctx.shadowBlur = on ? 16 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}
