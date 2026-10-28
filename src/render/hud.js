// HUD: barras de vida, nomes, timer, placar de rounds e anúncios ("ROUND 1", "FIGHT!", "K.O.").
import {
  INTERNAL_WIDTH as W,
  HUD_BAR_WIDTH as BAR_W,
  HUD_BAR_HEIGHT as BAR_H,
  HUD_BAR_MARGIN_X as MARGIN_X,
  HUD_BAR_MARGIN_Y as MARGIN_Y,
  HUD_DAMAGE_TRAIL_SPEED,
  HUD_WIN_MARKER_SIZE as MARK,
  HUD_WIN_MARKER_GAP as MARK_GAP,
  TIMER_WARNING_SECONDS,
  ROUNDS_TO_WIN,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { FONT, drawOutlinedText } from './text.js';

/** Altura (y) dos anúncios centrais. */
const ANNOUNCE_Y = 100;
const ANNOUNCE_SUB_Y = 128;

export class Hud {
  constructor() {
    this.p1Trail = null;
    this.p2Trail = null;
  }

  /**
   * Atualiza as barras de rastro de dano.
   * @param {import('../fight/fighter.js').Fighter} p1
   * @param {import('../fight/fighter.js').Fighter} p2
   */
  update(p1, p2) {
    this.p1Trail = trail(this.p1Trail, p1);
    this.p2Trail = trail(this.p2Trail, p2);
  }

  /**
   * Renderiza a HUD no canvas (resolução interna fixa).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../fight/fighter.js').Fighter} p1
   * @param {import('../fight/fighter.js').Fighter} p2
   * @param {import('../fight/round.js').Match} match
   * @param {number} frame contador global de ticks (pisca-pisca)
   */
  render(ctx, p1, p2, match, frame) {
    const p1BarX = MARGIN_X;
    const p2BarX = W - MARGIN_X - BAR_W;
    const barY = MARGIN_Y;

    // P1 esvazia em direção à borda esquerda; P2, em direção à borda direita.
    this._renderBar(ctx, p1BarX, barY, p1, this.p1Trail, false);
    this._renderBar(ctx, p2BarX, barY, p2, this.p2Trail, true);

    ctx.save();
    ctx.font = `8px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = P.hudText;
    const nameY = barY + BAR_H + 4;
    ctx.textAlign = 'left';
    ctx.fillText(p1.def.name, p1BarX, nameY);
    ctx.textAlign = 'right';
    ctx.fillText(p2.def.name, p2BarX + BAR_W, nameY);

    // Rounds vencidos: quadradinhos na ponta interna de cada barra.
    for (let i = 0; i < ROUNDS_TO_WIN; i++) {
      const off = i * (MARK + MARK_GAP);
      this._renderMarker(ctx, p1BarX + BAR_W - MARK - off, nameY, i < match.wins[0]);
      this._renderMarker(ctx, p2BarX + off, nameY, i < match.wins[1]);
    }

    // Timer central
    const secs = match.secondsLeft;
    const warn = secs <= TIMER_WARNING_SECONDS && match.fighting;
    const hidden = warn && Math.floor(frame / 15) % 2 === 1;
    if (!hidden) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      drawOutlinedText(ctx, String(secs).padStart(2, '0'), W / 2, barY - 2, 16,
        warn ? P.hudTimerWarn : P.hudTimer, P.titleOutline, P.hudTimerGlow, 4);
    }
    ctx.restore();
  }

  /**
   * Anúncio grande no centro da tela, com subtítulo opcional.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {Object} [o]
   * @param {string} [o.sub]
   * @param {string} [o.color]
   * @param {number} [o.size]
   */
  announce(ctx, text, { sub = '', color = P.announce, size = 28 } = {}) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, text, W / 2, ANNOUNCE_Y, size, color, P.titleOutline, P.announceGlow, 10);
    if (sub) {
      drawOutlinedText(ctx, sub, W / 2, ANNOUNCE_SUB_Y, 10, P.hudText, P.titleOutline, P.announceGlow, 4);
    }
    ctx.restore();
  }

  _renderMarker(ctx, x, y, won) {
    ctx.fillStyle = P.hudBarBorder;
    ctx.fillRect(x - 1, y - 1, MARK + 2, MARK + 2);
    ctx.fillStyle = won ? P.hudWinMarker : P.hudBarBg;
    ctx.fillRect(x, y, MARK, MARK);
  }

  _renderBar(ctx, x, y, fighter, trailHp, isRightAligned) {
    const max = fighter.stats.maxHealth;
    const hpRatio = Math.max(0, fighter.health) / max;
    const trailRatio = (trailHp ?? fighter.health) / max;
    const w = BAR_W;
    const h = BAR_H;

    ctx.save();
    ctx.fillStyle = P.hudBarBg;
    ctx.fillRect(x, y, w, h);

    // Rastro de dano (laranja), que encolhe até a vida real.
    const trailW = Math.round(w * clamp01(trailRatio));
    if (trailW > 0) {
      ctx.fillStyle = P.hudDamageTrail;
      ctx.fillRect(isRightAligned ? x : x + (w - trailW), y, trailW, h);
    }

    const hpW = Math.round(w * clamp01(hpRatio));
    if (hpW > 0) {
      ctx.fillStyle = hpRatio > 0.5 ? P.hudHealthGreen : hpRatio > 0.2 ? P.hudHealthYellow : P.hudHealthRed;
      ctx.fillRect(isRightAligned ? x : x + (w - hpW), y, hpW, h);
    }

    ctx.strokeStyle = P.hudBarBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.restore();
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Rastro de dano: desce gradualmente até a vida atual; sobe na hora se a vida subir. */
function trail(current, fighter) {
  if (current === null || current <= fighter.health) return fighter.health;
  return Math.max(fighter.health, current - fighter.stats.maxHealth * HUD_DAMAGE_TRAIL_SPEED);
}
