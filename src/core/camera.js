// Câmera horizontal: segue o ponto médio dos lutadores, presa aos limites do cenário.
import { INTERNAL_WIDTH as W, STAGE_WIDTH, CAMERA_LERP } from '../config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Camera {
  constructor() {
    this.x = 0;
  }

  target(a, b) {
    return clamp((a.x + b.x) / 2 - W / 2, 0, STAGE_WIDTH - W);
  }

  /** Posiciona imediatamente (início de round). */
  snap(a, b) {
    this.x = this.target(a, b);
  }

  update(a, b) {
    this.x += (this.target(a, b) - this.x) * CAMERA_LERP;
  }

  /** Posição inteira para desenhar sem borrão. */
  get renderX() {
    return Math.round(this.x);
  }
}
