// Animação por spritesheet horizontal, com pivô e espelhamento.
import { FPS } from '../config.js';

/** Desenha um frame do sprite com o pivô em (x, y). flip = olhando para a esquerda. */
export function drawSprite(ctx, sprite, frame, x, y, flip = false) {
  const { frameWidth: fw, frameHeight: fh, pivot } = sprite.meta;
  const sx = frame * fw;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip && sprite.imageFlipped) {
    // Versão pré-espelhada (placeholders): texto continua legível.
    ctx.drawImage(sprite.imageFlipped, sx, 0, fw, fh, -(fw - pivot.x), -pivot.y, fw, fh);
  } else {
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(sprite.image, sx, 0, fw, fh, -pivot.x, -pivot.y, fw, fh);
  }
  ctx.restore();
}

/** Toca um sprite contando ticks lógicos (determinístico). */
export class Animation {
  constructor(sprite) {
    this.sprite = sprite;
    this.tick = 0;
  }

  reset() {
    this.tick = 0;
  }

  update() {
    this.tick++;
  }

  get frame() {
    const { frames, fps, loop } = this.sprite.meta;
    const idx = Math.floor((this.tick * fps) / FPS);
    return loop ? idx % frames : Math.min(idx, frames - 1);
  }

  get finished() {
    const { frames, fps, loop } = this.sprite.meta;
    return !loop && Math.floor((this.tick * fps) / FPS) >= frames;
  }

  draw(ctx, x, y, flip = false) {
    drawSprite(ctx, this.sprite, this.frame, x, y, flip);
  }
}
