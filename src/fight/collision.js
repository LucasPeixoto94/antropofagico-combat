// Colisão AABB: hitbox, hurtbox e (Etapa 5) pushbox.
// Caixas locais são relativas aos pés do lutador, olhando para a direita;
// são espelhadas conforme `facing`.

/**
 * @typedef {{x:number, y:number, w:number, h:number}} Box
 */

/**
 * Converte uma caixa local em caixa de mundo.
 * @param {number} x       posição x do lutador
 * @param {number} y       posição y dos pés
 * @param {1|-1} facing
 * @param {Box} local
 * @param {number} [yScale] escala vertical (altura do personagem / altura de referência)
 * @returns {Box}
 */
export function worldBox(x, y, facing, local, yScale = 1) {
  const lx = facing > 0 ? local.x : -local.x - local.w;
  return { x: x + lx, y: y + local.y * yScale, w: local.w, h: local.h * yScale };
}

/** Interseção estrita de duas caixas (encostar não conta). */
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
