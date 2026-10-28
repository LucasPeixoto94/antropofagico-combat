// Estado TITLE: tela inicial.
import {
  INTERNAL_WIDTH as W,
  INTERNAL_HEIGHT as H,
  CONTROLS,
  TITLE_BLINK_FRAMES,
  ENTER_FLASH_FRAMES,
  ENTER_SHAKE_INTENSITY,
  ENTER_SHAKE_FRAMES,
  TITLE_FIREFLIES,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { GameState } from '../core/gameState.js';
import { Animation } from '../render/sprites.js';
import { FONT, drawOutlinedText } from '../render/text.js';

const TITLE_FIGHTER_Y = H - 18; // pés dos lutadores de demonstração
const TITLE_SACI_X = 64;
const TITLE_CURUPIRA_X = W - 64;

export class TitleState {
  constructor(game) {
    this.game = game;
    // Vaga-lumes determinísticos: parâmetros fixos derivados do índice.
    this.fireflies = Array.from({ length: TITLE_FIREFLIES }, (_, i) => ({
      x: ((i * 97) % W) + 10,
      y: 40 + ((i * 53) % (H - 80)),
      ax: 6 + (i % 5) * 3,
      ay: 4 + (i % 3) * 3,
      sx: 0.011 + (i % 7) * 0.003,
      sy: 0.017 + (i % 4) * 0.004,
      phase: i * 1.7,
    }));
    const saci = game.assets.get('saci/idle');
    const curupira = game.assets.get('curupira/idle');
    this.saciAnim = saci ? new Animation(saci) : null;
    this.curupiraAnim = curupira ? new Animation(curupira) : null;
  }

  update() {
    const g = this.game;
    if (g.input.pressedAny(CONTROLS.confirm)) {
      g.renderer.flash(P.flashWhite, ENTER_FLASH_FRAMES);
      g.renderer.shake(ENTER_SHAKE_INTENSITY, ENTER_SHAKE_FRAMES);
      // Começa uma partida Saci x Curupira. Seleção de personagem chega na Etapa 10.
      g.setState(GameState.FIGHTING);
      return;
    }
    this.saciAnim?.update();
    this.curupiraAnim?.update();
  }

  render(ctx) {
    const f = this.game.frame;

    // Céu
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, P.skyTop);
    sky.addColorStop(0.6, P.skyMid);
    sky.addColorStop(1, P.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Silhueta de mata (determinística)
    ctx.fillStyle = P.forestDark;
    for (let x = 0; x < W; x += 6) {
      const h = 22 + Math.round(10 * Math.sin(x * 0.05) + 6 * Math.sin(x * 0.13 + 1.3));
      ctx.fillRect(x, H - h, 6, h);
    }

    // Lutadores de demonstração, um de frente para o outro
    this.saciAnim?.draw(ctx, TITLE_SACI_X, TITLE_FIGHTER_Y, false);
    this.curupiraAnim?.draw(ctx, TITLE_CURUPIRA_X, TITLE_FIGHTER_Y, true);

    // Vaga-lumes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ff of this.fireflies) {
      const x = Math.round(ff.x + Math.sin(f * ff.sx + ff.phase) * ff.ax);
      const y = Math.round(ff.y + Math.cos(f * ff.sy + ff.phase) * ff.ay);
      const pulse = 0.5 + 0.5 * Math.sin(f * 0.08 + ff.phase);
      ctx.globalAlpha = 0.25 + 0.75 * pulse;
      ctx.fillStyle = P.fireflyGlow;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = P.firefly;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();

    // Título
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glow = 6 + Math.round(4 * (0.5 + 0.5 * Math.sin(f * 0.05)));
    drawOutlinedText(ctx, 'ANTROPOFÁGICO', W / 2, 92, 20, P.title, P.titleOutline, P.titleGlow, glow);
    drawOutlinedText(ctx, 'COMBAT', W / 2, 124, 28, P.combat, P.combatOutline, P.titleGlow, glow);

    ctx.font = `8px ${FONT}`;
    ctx.fillStyle = P.subtitle;
    ctx.fillText('folclore brasileiro • protótipo', W / 2, 152);

    if (Math.floor(f / TITLE_BLINK_FRAMES) % 2 === 0) {
      ctx.font = `10px ${FONT}`;
      ctx.fillStyle = P.prompt;
      ctx.fillText('Pressione ENTER', W / 2, 200);
    }
  }
}
