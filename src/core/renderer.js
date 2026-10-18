// Renderer: tudo é desenhado num canvas offscreen de resolução interna fixa
// e ampliado para a tela com ESCALA INTEIRA, centralizado, com barras.
// Tremor de tela e flash são aplicados aqui, sem tocar na lógica.
import { INTERNAL_WIDTH as W, INTERNAL_HEIGHT as H } from '../config.js';

export class Renderer {
  /** @param {HTMLCanvasElement} canvas canvas visível (ocupa a janela inteira) */
  constructor(canvas) {
    this.canvas = canvas;
    this.dctx = canvas.getContext('2d');

    // Buffer interno 480x270 — é aqui que o jogo desenha.
    this.buffer = document.createElement('canvas');
    this.buffer.width = W;
    this.buffer.height = H;
    this.ctx = this.buffer.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.scale = 1;
    this.dpr = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Ganchos de FX (contados em ticks lógicos)
    this._shakeFrames = 0;
    this._shakeIntensity = 0;
    this._shakeTick = 0;
    this._flashFrames = 0;
    this._flashTotal = 1;
    this._flashColor = '#ffffff';

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    // Tamanho real em pixels do dispositivo (HiDPI).
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);

    const fit = Math.min(this.canvas.width / W, this.canvas.height / H);
    // Escala inteira sempre que couber; se a janela for menor que 480x270, encolhe proporcionalmente.
    this.scale = fit >= 1 ? Math.floor(fit) : fit;
    this.dpr = dpr;

    const destW = Math.round(W * this.scale);
    const destH = Math.round(H * this.scale);
    this.destW = destW;
    this.destH = destH;
    this.offsetX = Math.floor((this.canvas.width - destW) / 2);
    this.offsetY = Math.floor((this.canvas.height - destH) / 2);

    // Redimensionar o canvas reseta o contexto.
    this.dctx.imageSmoothingEnabled = false;
  }

  /** Tremor de tela: intensidade em pixels internos, duração em ticks. */
  shake(intensity, frames) {
    if (intensity >= this._shakeIntensity || this._shakeFrames <= 0) {
      this._shakeIntensity = intensity;
    }
    this._shakeFrames = Math.max(this._shakeFrames, frames);
  }

  /** Flash de tela cheia que esmaece ao longo de `frames` ticks. */
  flash(color, frames) {
    this._flashColor = color;
    this._flashFrames = frames;
    this._flashTotal = Math.max(1, frames);
  }

  /** Chamado uma vez por tick lógico. */
  update() {
    if (this._shakeFrames > 0) this._shakeFrames--;
    if (this._flashFrames > 0) this._flashFrames--;
    this._shakeTick++;
  }

  /** Limpa o buffer interno. */
  beginFrame() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, W, H);
  }

  /** Amplia o buffer interno para a tela. */
  present() {
    const d = this.dctx;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.clearRect(0, 0, this.canvas.width, this.canvas.height); // barras = fundo da página

    // Tremor determinístico (sem Math.random): deslocamento em pixels internos inteiros.
    let sx = 0;
    let sy = 0;
    if (this._shakeFrames > 0) {
      const t = this._shakeTick;
      const amp = this._shakeIntensity;
      sx = Math.round(Math.sin(t * 2.7) * amp);
      sy = Math.round(Math.cos(t * 3.9) * amp);
    }
    const px = Math.round(this.scale);
    const x = this.offsetX + sx * px;
    const y = this.offsetY + sy * px;

    d.imageSmoothingEnabled = false;
    d.drawImage(this.buffer, 0, 0, W, H, x, y, this.destW, this.destH);

    if (this._flashFrames > 0) {
      d.globalAlpha = (this._flashFrames / this._flashTotal) * 0.7;
      d.fillStyle = this._flashColor;
      d.fillRect(this.offsetX, this.offsetY, this.destW, this.destH);
      d.globalAlpha = 1;
    }
  }
}
