// Overlay de debug (F1): painel de texto e caixas de colisão.
// Hitbox (vermelho) aparece só nos frames active; hurtbox (verde) sempre que o lutador pode ser acertado.
import { PALETTE as P } from '../palette.js';
import { FONT } from '../render/text.js';

/** Painel de texto no canto superior esquerdo. */
export function drawPanel(ctx, lines) {
  const width = Math.max(...lines.map((l) => l.length)) * 8 + 8;
  ctx.save();
  ctx.fillStyle = P.debugBg;
  ctx.fillRect(2, 2, width, lines.length * 10 + 6);
  ctx.font = `8px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = P.debug;
  lines.forEach((l, i) => ctx.fillText(l, 6, 6 + i * 10));
  ctx.restore();
}

/** Contorno de 1 px, nítido, com coordenadas inteiras. */
function outlineBox(ctx, b, color) {
  const x = Math.round(b.x - 0);
  const y = Math.round(b.y);
  const w = Math.max(1, Math.round(b.w));
  const h = Math.max(1, Math.round(b.h));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/** Desenha pivô, hurtbox e hitbox de cada lutador (coordenadas do mundo -> tela). */
export function drawFighterBoxes(ctx, fighters, camX) {
  ctx.save();
  for (const f of fighters) {
    const px = Math.round(f.x - camX);
    const py = Math.round(f.y);
    ctx.fillStyle = P.debug;
    ctx.fillRect(px - 3, py, 7, 1);
    ctx.fillRect(px, py - 3, 1, 7);

    const push = f.pushbox();
    if (push) outlineBox(ctx, { ...push, x: push.x - camX }, P.pushbox);

    const hurt = f.hurtbox();
    if (hurt) outlineBox(ctx, { ...hurt, x: hurt.x - camX }, P.hurtbox);

    const hit = f.currentHitbox();
    if (hit) {
      const b = { ...hit, x: hit.x - camX };
      ctx.fillStyle = P.hitboxFill;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h));
      outlineBox(ctx, b, P.hitbox);
    }
  }
  ctx.restore();
}
