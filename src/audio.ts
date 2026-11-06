/** Efeitos sonoros gerados na hora com Web Audio (sem arquivos de áudio). */
export class SoundFx {
  private ctx: AudioContext | null = null;

  constructor(public enabled = true) {}

  private context(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx ??= new Ctor();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Chame dentro de um clique para liberar o áudio no navegador. */
  unlock(): void {
    this.context();
  }

  tick(): void {
    const a = this.context();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.value = 900 + Math.random() * 200;
    g.gain.setValueAtTime(0.12, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.05);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.06);
  }

  win(): void {
    const a = this.context();
    if (!a) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      const t = a.currentTime + i * 0.12;
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  }
}
