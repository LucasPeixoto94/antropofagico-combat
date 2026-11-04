// Efeitos visuais: pool de partículas (reciclado, com limite), partículas ambientes
// (folhas caindo, vaga-lumes, respingos da cachoeira), névoa e sombras dos lutadores.
// A lógica (update) não usa DOM e é determinística (RNG com seed): testável com node:test.
import {
  INTERNAL_WIDTH as W,
  GROUND_Y,
  MAX_PARTICLES,
  LEAF_COUNT,
  FIREFLY_COUNT,
  MIST_PUFFS,
  MIST_ALPHA,
  SHADOW_WIDTH,
  SHADOW_MIN_SCALE,
  SHADOW_FADE_HEIGHT,
  SHADOW_ALPHA,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { Rng } from '../core/rng.js';

/** Largura da faixa em que folhas e vaga-lumes "dão a volta" (um pouco maior que a tela). */
const WRAP_W = W + 24;
const wrap = (v, m) => ((v % m) + m) % m;

// ---------------------------------------------------------------------------
// Pool de partículas
// ---------------------------------------------------------------------------
export class ParticlePool {
  /** @param {number} max limite de partículas vivas */
  constructor(max = MAX_PARTICLES) {
    this.max = max;
    /** @type {Object[]} */
    this.items = Array.from({ length: max }, () => ({ alive: false }));
  }

  /** Reaproveita uma partícula morta; devolve null se o pool estiver cheio. */
  spawn(props) {
    const p = this.items.find((it) => !it.alive);
    if (!p) return null;
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, props, { alive: true });
    return p;
  }

  get count() {
    let n = 0;
    for (const p of this.items) if (p.alive) n++;
    return n;
  }

  *alive() {
    for (const p of this.items) if (p.alive) yield p;
  }
}

// ---------------------------------------------------------------------------
// Partículas ambientes do cenário
// ---------------------------------------------------------------------------
export class AmbientFx {
  /**
   * @param {Object} o
   * @param {number} o.seed
   * @param {number} [o.leaves]
   * @param {number} [o.fireflies]
   * @param {number} [o.max]
   */
  constructor({ seed, leaves = LEAF_COUNT, fireflies = FIREFLY_COUNT, max = MAX_PARTICLES }) {
    this.rng = new Rng(seed);
    this.pool = new ParticlePool(max);
    this.tick = 0;
    for (let i = 0; i < leaves; i++) this._spawnLeaf(true);
    for (let i = 0; i < fireflies; i++) this._spawnFirefly();
    // Névoa: "nuvens" baixas fixas no ciclo (não ocupam o pool).
    this.mist = Array.from({ length: MIST_PUFFS }, () => ({
      x: this.rng.range(0, WRAP_W + 120),
      y: this.rng.range(176, 214),
      w: this.rng.int(50, 120),
      h: this.rng.int(4, 9),
      speed: this.rng.range(0.08, 0.2),
      depth: this.rng.range(0.7, 0.9),
    }));
  }

  _spawnLeaf(initial = false) {
    const r = this.rng;
    return this.pool.spawn({
      kind: 'leaf',
      layer: 'front',
      x: r.range(0, WRAP_W),
      y: initial ? r.range(-10, GROUND_Y) : r.range(-20, -4),
      vy: r.range(0.25, 0.55),
      vx: r.range(-0.15, 0.25),
      swayA: r.range(0.2, 0.6),
      swayF: r.range(0.03, 0.07),
      phase: r.range(0, Math.PI * 2),
      depth: r.range(0.85, 1.3),
      color: r.pick([P.stLeaf, P.stLeafAlt, P.stLeafDark]),
      spin: r.int(0, 3),
    });
  }

  _spawnFirefly() {
    const r = this.rng;
    return this.pool.spawn({
      kind: 'firefly',
      layer: 'front',
      bx: r.range(0, WRAP_W),
      by: r.range(110, 215),
      x: 0,
      y: 0,
      ax: r.range(6, 18),
      ay: r.range(4, 10),
      fx: r.range(0.008, 0.02),
      fy: r.range(0.012, 0.03),
      phase: r.range(0, Math.PI * 2),
      blink: r.range(0.04, 0.09),
      depth: r.range(0.75, 1.1),
    });
  }

  /**
   * Respingo na base da cachoeira, em coordenadas da camada da cachoeira.
   * @param {number} x
   * @param {number} y
   * @param {number} depth fator de parallax da camada
   */
  spawnSpray(x, y, depth) {
    const r = this.rng;
    return this.pool.spawn({
      kind: 'spray',
      layer: 'back',
      x: x + r.range(-6, 6),
      y,
      vx: r.range(-0.7, 0.7),
      vy: r.range(-1.4, -0.4),
      life: r.int(14, 26),
      depth,
    });
  }

  update() {
    this.tick++;
    const t = this.tick;
    for (const p of this.pool.alive()) {
      switch (p.kind) {
        case 'leaf':
          p.x += p.vx + Math.sin(t * p.swayF + p.phase) * p.swayA;
          p.y += p.vy;
          if (p.y > GROUND_Y + 6) {
            // Recicla: volta para o topo.
            p.alive = false;
            this._spawnLeaf();
          }
          break;
        case 'firefly':
          p.x = p.bx + Math.sin(t * p.fx + p.phase) * p.ax;
          p.y = p.by + Math.cos(t * p.fy + p.phase * 1.3) * p.ay;
          break;
        case 'spray':
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.08;
          if (--p.life <= 0) p.alive = false;
          break;
        default:
      }
    }
    for (const m of this.mist) m.x += m.speed;
  }

  /** Posição de tela das partículas que dão a volta (folhas e vaga-lumes). */
  static screenX(p, camX) {
    return wrap(p.x - camX * p.depth, WRAP_W) - 12;
  }

  /** Névoa baixa (atrás dos lutadores). */
  renderMist(ctx, camX) {
    ctx.save();
    ctx.globalAlpha = MIST_ALPHA;
    ctx.fillStyle = P.stMist;
    const span = WRAP_W + 120;
    for (const m of this.mist) {
      const x = Math.round(wrap(m.x - camX * m.depth, span) - 120);
      const y = Math.round(m.y);
      // Três retângulos sobrepostos formam um "puff" com bordas em degrau (pixel art).
      ctx.fillRect(x, y, m.w, m.h);
      ctx.fillRect(x + 8, y - 2, m.w - 16, m.h + 4);
      ctx.fillRect(x + 20, y - 3, m.w - 40, 1);
    }
    ctx.restore();
  }

  /** Partículas da camada de trás (respingos da cachoeira). */
  renderBack(ctx, camX) {
    ctx.save();
    ctx.fillStyle = P.stSpray;
    for (const p of this.pool.alive()) {
      if (p.layer !== 'back') continue;
      ctx.globalAlpha = Math.min(1, p.life / 10);
      ctx.fillRect(Math.round(p.x - camX * p.depth), Math.round(p.y), 1, 1);
    }
    ctx.restore();
  }

  /** Partículas da frente: folhas caindo e vaga-lumes com glow aditivo. */
  renderFront(ctx, camX) {
    const t = this.tick;
    ctx.save();
    for (const p of this.pool.alive()) {
      if (p.kind !== 'leaf') continue;
      const x = Math.round(AmbientFx.screenX(p, camX));
      const y = Math.round(p.y);
      ctx.fillStyle = p.color;
      // Folha "girando": alterna entre deitada, inclinada e em pé.
      const phase = (Math.floor(t / 12) + p.spin) % 4;
      if (phase === 0) ctx.fillRect(x, y, 3, 1);
      else if (phase === 1 || phase === 3) {
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x + 1, y + 1, 2, 1);
      } else ctx.fillRect(x + 1, y - 1, 1, 3);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool.alive()) {
      if (p.kind !== 'firefly') continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * p.blink + p.phase);
      if (pulse < 0.15) continue; // apagado
      const x = Math.round(AmbientFx.screenX(p, camX));
      const y = Math.round(p.y);
      ctx.globalAlpha = 0.25 + 0.75 * pulse;
      ctx.fillStyle = P.fireflyGlow;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = P.firefly;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Sombra sob os lutadores
// ---------------------------------------------------------------------------
/** Escala da sombra em função da altura acima do chão (encolhe ao pular). */
export function shadowScale(heightAboveGround) {
  const s = 1 - Math.max(0, heightAboveGround) / SHADOW_FADE_HEIGHT;
  return Math.max(SHADOW_MIN_SCALE, Math.min(1, s));
}

/**
 * Elipse de pixels no chão, centrada em x (tela).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x posição de tela
 * @param {number} heightAboveGround GROUND_Y - y do lutador
 * @param {number} [width]
 */
export function drawShadow(ctx, x, heightAboveGround, width = SHADOW_WIDTH) {
  const s = shadowScale(heightAboveGround);
  const w = Math.max(4, Math.round(width * s));
  const cx = Math.round(x);
  const y = GROUND_Y;
  ctx.save();
  ctx.globalAlpha = SHADOW_ALPHA * s;
  ctx.fillStyle = P.stShadow;
  ctx.fillRect(cx - Math.round(w / 2), y - 1, w, 3);
  ctx.fillRect(cx - Math.round(w * 0.35), y - 2, Math.round(w * 0.7), 1);
  ctx.fillRect(cx - Math.round(w * 0.35), y + 2, Math.round(w * 0.7), 1);
  ctx.restore();
}

