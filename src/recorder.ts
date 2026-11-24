/**
 * Grava um vídeo curto de cada giro: a roleta girando e, no fim, o resultado.
 *
 * O ponteiro e o botão GIRAR são elementos da página, fora do canvas da roleta,
 * então cada quadro do vídeo é montado num canvas próprio (título, roleta, ponteiro,
 * botão e uma faixa embaixo) e esse canvas é gravado com MediaRecorder.
 */
import pointerUrl from './assets/pointer.svg';
import { fitLabel } from './label';

const W = 720;
const H = 960;
const WHEEL = 600; // diâmetro da roleta no vídeo
const CX = W / 2;
const CY = 110 + WHEEL / 2; // centro da roleta
const FPS = 30;
/**
 * A gravação para quando o resultado aparece. Só segura este tempo para o quadro
 * com o resultado entrar no vídeo (o gravador precisa de alguns quadros).
 */
const HOLD_MS = 500;
const TICK_MS = 120;

export interface SpinVideo {
  blob: Blob;
  url: string;
}

/** Só MP4 (H.264): abre em quase tudo (WhatsApp, iPhone, Windows). */
const MIME_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];

function pickMime(): string | undefined {
  return MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t));
}

const pointerImg = new Image();
pointerImg.src = pointerUrl;

export class SpinRecorder {
  /** O navegador consegue gravar canvas em vídeo MP4? */
  static supported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      !!pickMime()
    );
  }

  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private mime = '';
  private tickAt = -Infinity;
  private result?: { name: string; color: string };
  private holdTimer = 0;
  private holdRaf = 0;
  private done?: (v: SpinVideo | null) => void;
  private startedAt = '';

  constructor(private wheelCanvas: HTMLCanvasElement) {
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
  }

  get recording(): boolean {
    return !!this.rec && this.rec.state !== 'inactive';
  }

  /** Começa a gravar (descarta uma gravação anterior que ainda não terminou). */
  start(): void {
    this.cancel();
    this.mime = pickMime() ?? '';
    this.chunks = [];
    this.result = undefined;
    this.tickAt = -Infinity;
    this.startedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    this.frame(); // primeiro quadro já pronto antes de gravar

    const stream = this.canvas.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType: this.mime, videoBitsPerSecond: 4_000_000 });
    rec.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const cb = this.done;
      this.done = undefined;
      if (!cb) return; // cancelado
      if (!this.chunks.length) return cb(null);
      const blob = new Blob(this.chunks, { type: 'video/mp4' });
      cb({ blob, url: URL.createObjectURL(blob) });
    };
    rec.start(250);
    this.rec = rec;
  }

  /** O ponteiro passou por uma fatia: balança no vídeo também. */
  tick(): void {
    this.tickAt = performance.now();
  }

  /** Monta um quadro do vídeo a partir do canvas da roleta. Chamar a cada quadro do giro. */
  frame(): void {
    const { ctx } = this;
    const now = performance.now();

    // fundo e título (guardados prontos: não mudam durante o giro)
    ctx.drawImage(this.background(), 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // roleta
    ctx.drawImage(this.wheelCanvas, CX - WHEEL / 2, CY - WHEEL / 2, WHEEL, WHEEL);

    // botão do centro
    const hr = WHEEL * 0.105;
    ctx.beginPath();
    ctx.arc(CX, CY, hr + 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc83d';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CX, CY, hr + 6, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0a14';
    ctx.fill();
    const hg = ctx.createRadialGradient(CX - hr * 0.3, CY - hr * 0.4, 2, CX, CY, hr);
    hg.addColorStop(0, '#fff6d0');
    hg.addColorStop(0.4, '#ffc83d');
    hg.addColorStop(0.75, '#ff9f1c');
    hg.addColorStop(1, '#b86b00');
    ctx.beginPath();
    ctx.arc(CX, CY, hr, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.fillStyle = '#3a2300';
    ctx.font = `400 ${Math.round(hr * 0.62)}px 'Bebas Neue', sans-serif`;
    ctx.fillText('GIRAR', CX, CY + 2);

    // ponteiro (balança quando passa por uma fatia)
    if (pointerImg.complete && pointerImg.naturalWidth) {
      const pw = WHEEL * 0.085;
      const ph = pw * (60 / 46);
      const p = (now - this.tickAt) / TICK_MS; // 0..1 durante o balanço
      const angle = p >= 0 && p < 1 ? ((-18 * Math.PI) / 180) * Math.sin(Math.PI * p) : 0;
      ctx.save();
      ctx.translate(CX, CY - WHEEL / 2 - WHEEL * 0.034 + ph * 0.25);
      ctx.rotate(angle);
      ctx.shadowColor = '#0009';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(pointerImg, -pw / 2, -ph * 0.25, pw, ph);
      ctx.restore();
    }

    // faixa de baixo: girando ou resultado
    const top = CY + WHEEL / 2 + 30;
    if (this.result) {
      ctx.fillStyle = '#16142a';
      ctx.strokeStyle = this.result.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(40, top, W - 80, H - top - 40, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9b95c4';
      ctx.font = "600 24px 'Outfit', sans-serif";
      ctx.fillText('O SORTEADO É', CX, top + 34);
      // Nome inteiro numa linha: diminui a letra até caber (reticências só em último caso).
      ctx.font = "400 100px 'Bebas Neue', sans-serif";
      const { text, fs } = fitLabel(this.result.name, t => ctx.measureText(t).width, {
        maxW: W - 120,
        maxFs: 72,
        minFs: 30,
      });
      ctx.font = `400 ${fs}px 'Bebas Neue', sans-serif`;
      ctx.fillStyle = '#ffc83d';
      ctx.fillText(text, CX, top + 92);
    } else {
      ctx.fillStyle = '#9b95c4';
      ctx.font = "600 30px 'Outfit', sans-serif";
      ctx.fillText('Girando…', CX, top + 50);
    }
    ctx.fillStyle = '#5f5a85';
    ctx.font = "500 18px 'Outfit', sans-serif";
    ctx.fillText(this.startedAt, CX, H - 22);
  }

  private bg?: HTMLCanvasElement;
  private background(): HTMLCanvasElement {
    if (this.bg) return this.bg;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0b0a14';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(CX, CY, WHEEL * 0.3, CX, CY, WHEEL * 0.7);
    glow.addColorStop(0, '#ffc83d33');
    glow.addColorStop(0.6, '#a855f71a');
    glow.addColorStop(1, '#0b0a1400');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "400 58px 'Bebas Neue', sans-serif";
    const tg = ctx.createLinearGradient(0, 30, 0, 80);
    tg.addColorStop(0, '#fff3c4');
    tg.addColorStop(1, '#ffc83d');
    ctx.fillStyle = tg;
    ctx.fillText('LUSM - SORTE', CX, 58);
    // só guarda depois que a fonte do título carregou (senão ficaria com a fonte reserva)
    if (document.fonts?.check("58px 'Bebas Neue'") !== false) this.bg = c;
    return c;
  }

  /**
   * A roleta parou: coloca o resultado no último quadro e encerra o vídeo.
   * Resolve com o vídeo pronto (ou null se não deu para gravar).
   */
  finish(name: string, color: string): Promise<SpinVideo | null> {
    if (!this.rec || this.rec.state === 'inactive') return Promise.resolve(null);
    this.result = { name, color };
    const loop = (): void => {
      this.frame();
      this.holdRaf = requestAnimationFrame(loop);
    };
    loop();
    return new Promise(resolve => {
      this.done = resolve;
      this.holdTimer = window.setTimeout(() => {
        cancelAnimationFrame(this.holdRaf);
        this.frame();
        this.rec?.stop();
      }, HOLD_MS);
    });
  }

  /** Para e descarta a gravação em andamento. */
  cancel(): void {
    clearTimeout(this.holdTimer);
    cancelAnimationFrame(this.holdRaf);
    const cb = this.done;
    this.done = undefined;
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    this.rec = undefined;
    cb?.(null);
  }
}
