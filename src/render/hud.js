// HUD: Barras de vida, nomes dos lutadores e anúncio de KO.
import {
  INTERNAL_WIDTH as W,
  HUD_BAR_WIDTH as BAR_W,
  HUD_BAR_HEIGHT as BAR_H,
  HUD_BAR_MARGIN_X as MARGIN_X,
  HUD_BAR_MARGIN_Y as MARGIN_Y,
  HUD_DAMAGE_TRAIL_SPEED,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { FONT, drawOutlinedText } from './text.js';

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
    if (this.p1Trail === null) this.p1Trail = p1.health;
    if (this.p2Trail === null) this.p2Trail = p2.health;

    if (this.p1Trail > p1.health) {
      this.p1Trail = Math.max(p1.health, this.p1Trail - (p1.stats.maxHealth * HUD_DAMAGE_TRAIL_SPEED));
    } else {
      this.p1Trail = p1.health;
    }

    if (this.p2Trail > p2.health) {
      this.p2Trail = Math.max(p2.health, this.p2Trail - (p2.stats.maxHealth * HUD_DAMAGE_TRAIL_SPEED));
    } else {
      this.p2Trail = p2.health;
    }
  }

  /**
   * Renderiza a HUD no canvas (resolução interna fixa).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../fight/fighter.js').Fighter} p1
   * @param {import('../fight/fighter.js').Fighter} p2
   */
  render(ctx, p1, p2) {
    const p1Max = p1.stats.maxHealth;
    const p2Max = p2.stats.maxHealth;
    const p1Hp = Math.max(0, p1.health);
    const p2Hp = Math.max(0, p2.health);

    const p1TrailHp = this.p1Trail ?? p1Hp;
    const p2TrailHp = this.p2Trail ?? p2Hp;

    const p1BarX = MARGIN_X;
    const p2BarX = W - MARGIN_X - BAR_W;
    const barY = MARGIN_Y;

    // --- Barra P1 (esvazia da direita para a esquerda, em direção à borda externa) ---
    this._renderBar(ctx, p1BarX, barY, BAR_W, BAR_H, p1Hp / p1Max, p1TrailHp / p1Max, false);
    
    // --- Barra P2 (esvazia da esquerda para a direita, em direção à borda externa) ---
    this._renderBar(ctx, p2BarX, barY, BAR_W, BAR_H, p2Hp / p2Max, p2TrailHp / p2Max, true);

    // --- Nomes dos personagens ---
    ctx.save();
    ctx.font = `8px ${FONT}`;
    ctx.textBaseline = 'top';

    // P1: nome alinhado à esquerda
    ctx.textAlign = 'left';
    ctx.fillStyle = P.hudText;
    ctx.fillText(p1.def.name, p1BarX, barY + BAR_H + 4);

    // P2: nome alinhado à direita
    ctx.textAlign = 'right';
    ctx.fillStyle = P.hudText;
    ctx.fillText(p2.def.name, p2BarX + BAR_W, barY + BAR_H + 4);

    // --- Centro superior: "VS" ---
    ctx.textAlign = 'center';
    ctx.fillStyle = P.title;
    ctx.fillText('VS', W / 2, barY + 2);
    ctx.restore();

    // --- Anúncio de K.O. ---
    if (p1.ko || p2.ko) {
      drawOutlinedText(
        ctx,
        'K.O.',
        W / 2,
        90,
        28,
        P.hudKoText,
        P.titleOutline,
        P.hudKoGlow,
        10
      );
    }
  }

  _renderBar(ctx, x, y, w, h, hpRatio, trailRatio, isRightAligned) {
    ctx.save();
    // Fundo escuro da barra
    ctx.fillStyle = P.hudBarBg;
    ctx.fillRect(x, y, w, h);

    // Rastro de dano (laranja/vermelho)
    const trailW = Math.round(w * Math.max(0, Math.min(1, trailRatio)));
    if (trailW > 0) {
      ctx.fillStyle = P.hudDamageTrail;
      const trailX = isRightAligned ? x : x + (w - trailW);
      ctx.fillRect(trailX, y, trailW, h);
    }

    // Vida real
    const hpW = Math.round(w * Math.max(0, Math.min(1, hpRatio)));
    if (hpW > 0) {
      ctx.fillStyle = hpRatio > 0.5 ? P.hudHealthGreen : hpRatio > 0.2 ? P.hudHealthYellow : P.hudHealthRed;
      const realX = isRightAligned ? x : x + (w - hpW);
      ctx.fillRect(realX, y, hpW, h);
    }

    // Borda da barra
    ctx.strokeStyle = P.hudBarBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    ctx.restore();
  }
}
