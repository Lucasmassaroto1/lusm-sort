interface Piece {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; r: number; vr: number;
  c: string; life: number;
}

/** Chuva de confete em tela cheia, disparada dos dois cantos de baixo. */
export class Confetti {
  private ctx: CanvasRenderingContext2D;
  private pieces: Piece[] = [];
  private running = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.canvas.width = innerWidth * devicePixelRatio;
    this.canvas.height = innerHeight * devicePixelRatio;
  }

  burst(mainColor: string): void {
    const cols = [mainColor, '#ffc83d', '#fff', '#ff4d6d', '#2ee59d', '#3b82f6', '#a855f7'];
    const { width: W, height: H } = this.canvas;
    const d = devicePixelRatio;
    for (const fromLeft of [true, false]) {
      for (let i = 0; i < 120; i++) {
        this.pieces.push({
          x: fromLeft ? 0 : W, y: H * 0.75,
          vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 12) * d,
          vy: -(14 + Math.random() * 14) * d,
          w: (6 + Math.random() * 8) * d, h: (10 + Math.random() * 10) * d,
          r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
          c: cols[Math.floor(Math.random() * cols.length)], life: 0,
        });
      }
    }
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(this.step);
    }
  }

  private step = (): void => {
    const { ctx, canvas } = this;
    const d = devicePixelRatio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of this.pieces) {
      p.vy += 0.45 * d; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.life * 0.15));
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    this.pieces = this.pieces.filter(p => p.y < canvas.height + 40 && p.life < 400);
    if (this.pieces.length) requestAnimationFrame(this.step);
    else {
      this.running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}
