// Utilitários de texto pixel.
export const FONT = '"Press Start 2P", monospace';

export function drawOutlinedText(ctx, text, x, y, size, fill, outline, glowColor, glow) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.font = `${size}px ${FONT}`;
  // Sombra deslocada
  ctx.fillStyle = outline;
  ctx.fillText(text, x + 2, y + 2);
  // Contorno de 1 px
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    ctx.fillText(text, x + dx, y + dy);
  }
  // Preenchimento com glow
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glow;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}
