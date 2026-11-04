// Projéteis (ex.: Fogo do Cabelo do Curupira).
// Viajam horizontalmente a PROJECTILE_SPEED px/frame, têm hitbox AABB e somem ao acertar ou sair da tela.
import {
  STAGE_WIDTH,
  PROJECTILE_SPEED,
  PROJECTILE_DAMAGE,
  PROJECTILE_HITSTUN,
  PROJECTILE_BLOCKSTUN,
  PROJECTILE_WIDTH,
  PROJECTILE_HEIGHT,
  PROJECTILE_SPAWN_X,
  PROJECTILE_SPAWN_Y,
  PROJECTILE_MAX_LIFETIME,
  PROJECTILE_MARGIN,
} from '../config.js';
import { PALETTE as P } from '../palette.js';

export class Projectile {
  /**
   * @param {Object} o
   * @param {import('./fighter.js').Fighter} o.owner lutador que disparou
   * @param {number} [o.x]
   * @param {number} [o.y]
   * @param {1|-1} [o.facing]
   * @param {Object} [o.move] metadados do golpe (damage, hitstun, blockstun)
   */
  constructor({ owner, x, y, facing, move }) {
    this.owner = owner;
    this.facing = facing ?? owner.facing;
    this.x = x ?? owner.x + this.facing * PROJECTILE_SPAWN_X;
    this.y = y ?? owner.y + PROJECTILE_SPAWN_Y;
    this.vx = this.facing * (move?.projectileSpeed ?? PROJECTILE_SPEED);
    this.w = PROJECTILE_WIDTH;
    this.h = PROJECTILE_HEIGHT;
    this.frame = 0;
    this.active = true;

    /** Objeto compatível com Fighter.takeHit(move, attacker). */
    this.move = Object.freeze({
      id: move?.id ?? 'fogo_do_cabelo',
      damage: move?.damage ?? PROJECTILE_DAMAGE,
      hitstun: move?.hitstun ?? PROJECTILE_HITSTUN,
      blockstun: move?.blockstun ?? PROJECTILE_BLOCKSTUN,
      knockdown: Boolean(move?.knockdown),
    });
  }

  update() {
    if (!this.active) return;
    this.x += this.vx;
    this.frame++;
    if (
      this.frame > PROJECTILE_MAX_LIFETIME ||
      this.x < -PROJECTILE_MARGIN ||
      this.x > STAGE_WIDTH + PROJECTILE_MARGIN
    ) {
      this.active = false;
    }
  }

  /** Hitbox em coordenadas de mundo (AABB centrada em x, y). */
  hitbox() {
    if (!this.active) return null;
    return {
      x: this.x - this.w / 2,
      y: this.y - this.h / 2,
      w: this.w,
      h: this.h,
    };
  }

  /** Renderiza a bola de fogo em pixel art com glow aditivo. */
  render(ctx, camX) {
    if (!this.active) return;
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y);
    const dir = this.facing;
    const flicker = this.frame % 4 < 2 ? 1 : -1;

    ctx.save();
    // Glow aditivo externo
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = P.projectileGlow;
    ctx.fillRect(sx - 12, sy - 8, 24, 16);
    ctx.restore();

    ctx.save();
    // Contorno escuro da cabeça da chama
    ctx.fillStyle = P.outline;
    ctx.fillRect(sx - 9, sy - 6, 18, 12);

    // Cauda de chamas (para trás da direção do movimento)
    ctx.fillStyle = P.projectileOuter;
    ctx.fillRect(sx - dir * 13, sy - 4 + flicker, 8, 8);
    ctx.fillRect(sx - dir * 17, sy - 2 - flicker, 5, 5);

    // Corpo laranja/avermelhado
    ctx.fillStyle = P.projectileOuter;
    ctx.fillRect(sx - 8, sy - 5, 16, 10);
    ctx.fillStyle = P.projectileMid;
    ctx.fillRect(sx - 6 + dir * 2, sy - 4, 12, 8);

    // Núcleo quente amarelo-claro na frente
    ctx.fillStyle = P.projectileCore;
    ctx.fillRect(sx - 2 + dir * 3, sy - 2, 6, 4);
    ctx.restore();
  }
}

