// Máquina de estados do jogo.
// TITLE → CHAR_SELECT → ROUND_INTRO → FIGHTING → ROUND_END → (ROUND_INTRO | MATCH_END) → TITLE
// PAUSED acessível a partir de FIGHTING.
import {
  INTERNAL_WIDTH as W,
  INTERNAL_HEIGHT as H,
  DEBUG_DEFAULT,
  TITLE_BLINK_FRAMES,
  ENTER_FEEDBACK_FRAMES,
  ENTER_FLASH_FRAMES,
  ENTER_SHAKE_INTENSITY,
  ENTER_SHAKE_FRAMES,
  TITLE_FIREFLIES,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { Animation } from '../render/sprites.js';

export const GameState = Object.freeze({
  TITLE: 'TITLE',
  CHAR_SELECT: 'CHAR_SELECT',
  ROUND_INTRO: 'ROUND_INTRO',
  FIGHTING: 'FIGHTING',
  ROUND_END: 'ROUND_END',
  MATCH_END: 'MATCH_END',
  PAUSED: 'PAUSED',
});

const FONT = '"Press Start 2P", monospace';

export class Game {
  /**
   * @param {import('./renderer.js').Renderer} renderer
   * @param {import('./assets.js').Assets} assets
   */
  constructor(renderer, assets) {
    this.renderer = renderer;
    this.assets = assets;

    this.frame = 0; // ticks lógicos desde o início
    this.debug = DEBUG_DEFAULT;
    this.loop = null; // preenchido por main.js

    this.states = {
      [GameState.TITLE]: new TitleState(this),
    };
    this.state = null;
    this.stateName = null;

    this._pressed = new Set();
    this._installTempKeyboard();

    this.setState(GameState.TITLE);
  }

  setState(name) {
    const next = this.states[name];
    if (!next) {
      console.warn(`[game] estado ainda não implementado: ${name}`);
      return;
    }
    this.state?.exit?.();
    this.state = next;
    this.stateName = name;
    this.state.enter?.();
  }

  /** true apenas no tick em que a tecla foi pressionada. */
  wasPressed(code) {
    return this._pressed.has(code);
  }

  update() {
    if (this.wasPressed('F1')) this.debug = !this.debug;
    this.state.update();
    this.renderer.update();
    this.frame++;
    this._pressed.clear();
  }

  render() {
    const r = this.renderer;
    r.beginFrame();
    const ctx = r.ctx;
    ctx.save();
    this.state.render(ctx);
    ctx.restore();
    if (this.debug) this._renderDebug(ctx);
    r.present();
  }

  _renderDebug(ctx) {
    const r = this.renderer;
    const a = this.assets.summary();
    const scale = Number.isInteger(r.scale) ? `${r.scale}x` : `${r.scale.toFixed(2)}x`;
    const lines = [
      `ticks/s ${this.loop?.ticksPerSecond ?? 0}`,
      `fps     ${this.loop?.framesPerSecond ?? 0}`,
      `estado  ${this.stateName}`,
      `frame   ${this.frame}`,
      `escala  ${scale} dpr ${r.dpr}`,
      `tela    ${r.canvas.width}x${r.canvas.height}`,
      `sprites png ${a.png} ph ${a.placeholder}`,
    ];
    ctx.save();
    ctx.fillStyle = P.debugBg;
    ctx.fillRect(2, 2, 196, lines.length * 10 + 6);
    ctx.font = `8px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = P.debug;
    lines.forEach((l, i) => ctx.fillText(l, 6, 6 + i * 10));
    ctx.restore();
  }

  // TEMP Etapa 1: teclado mínimo. Substituído por core/input.js na Etapa 3.
  _installTempKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
    });
  }
}

// ---------------------------------------------------------------------------
// Estado TITLE
// ---------------------------------------------------------------------------
const TITLE_FIGHTER_Y = H - 18; // pés dos lutadores de demonstração
const TITLE_SACI_X = 64;
const TITLE_CURUPIRA_X = W - 64;

class TitleState {
  constructor(game) {
    this.game = game;
    this.feedback = 0;
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
    // Lutadores de demonstração (testam o pipeline de sprites/placeholders).
    const saci = game.assets.get('saci/idle');
    const curupira = game.assets.get('curupira/idle');
    this.saciAnim = saci ? new Animation(saci) : null;
    this.curupiraAnim = curupira ? new Animation(curupira) : null;
  }

  enter() {
    this.feedback = 0;
  }

  update() {
    const g = this.game;
    if (g.wasPressed('Enter') || g.wasPressed('NumpadEnter')) {
      // Próximo estado (CHAR_SELECT) chega em etapas futuras.
      this.feedback = ENTER_FEEDBACK_FRAMES;
      g.renderer.flash(P.flashWhite, ENTER_FLASH_FRAMES);
      g.renderer.shake(ENTER_SHAKE_INTENSITY, ENTER_SHAKE_FRAMES);
    }
    if (this.feedback > 0) this.feedback--;
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

    // Prompt / feedback
    if (this.feedback > 0) {
      ctx.fillStyle = P.title;
      ctx.fillText('Em breve: seleção de personagem', W / 2, 200);
    } else if (Math.floor(f / TITLE_BLINK_FRAMES) % 2 === 0) {
      ctx.font = `10px ${FONT}`;
      ctx.fillStyle = P.prompt;
      ctx.fillText('Pressione ENTER', W / 2, 200);
    }
  }
}

function drawOutlinedText(ctx, text, x, y, size, fill, outline, glowColor, glow) {
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
