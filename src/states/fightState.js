// Estado FIGHTING (Etapa 4: modo treino com golpes).
// Saci (P1) vs Curupira como boneco de treino — fica parado, a menos que o P2 use as teclas.
// Rounds, vida na tela e pausa entram nas Etapas 5–6.
import {
  INTERNAL_WIDTH as W,
  INTERNAL_HEIGHT as H,
  STAGE_WIDTH,
  GROUND_Y,
  CONTROLS,
  STAGE_EDGE_MARGIN,
  SCREEN_EDGE_MARGIN,
  FIGHTER_START_OFFSET,
  HITSTOP_FRAMES,
  HIT_SHAKE_INTENSITY,
  HIT_SHAKE_FRAMES,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { GameState } from '../core/gameState.js';
import { Camera } from '../core/camera.js';
import { Fighter } from '../fight/fighter.js';
import { overlaps, resolvePushbox } from '../fight/collision.js';
import { CHARACTERS } from '../characters/index.js';
import { FONT } from '../render/text.js';
import { drawFighterBoxes } from '../debug/debugOverlay.js';
import { Hud } from '../render/hud.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Mantém os lutadores dentro do cenário e ambos dentro da tela. */
function constrainFighters(a, b) {
  for (const f of [a, b]) f.x = clamp(f.x, STAGE_EDGE_MARGIN, STAGE_WIDTH - STAGE_EDGE_MARGIN);

  const maxSep = W - 2 * SCREEN_EDGE_MARGIN;
  const left = a.x <= b.x ? a : b;
  const right = left === a ? b : a;
  const excess = right.x - left.x - maxSep;
  if (excess > 0) {
    // Quem estava se afastando (andando ou sendo empurrado) é quem recua.
    const lOut = Math.max(0, -(left.vx + left.kb));
    const rOut = Math.max(0, right.vx + right.kb);
    const total = lOut + rOut;
    const lShare = total > 0 ? lOut / total : 0.5;
    left.x += excess * lShare;
    right.x -= excess * (1 - lShare);
  }
}

export class FightState {
  constructor(game) {
    this.game = game;
    this.hitstop = 0;
    this.lastEvent = '-';
  }

  enter() {
    const g = this.game;
    const mid = STAGE_WIDTH / 2;
    this.p1 = new Fighter({ def: CHARACTERS.saci, assets: g.assets, x: mid - FIGHTER_START_OFFSET, facing: 1 });
    this.p2 = new Fighter({ def: CHARACTERS.curupira, assets: g.assets, x: mid + FIGHTER_START_OFFSET, facing: -1 });
    this.camera = new Camera();
    this.camera.snap(this.p1, this.p2);
    this.hitstop = 0;
    this.lastEvent = '-';
    this.hud = new Hud();
  }

  update() {
    const g = this.game;
    // TEMP: ESC volta ao título. Na Etapa 6 vira pausa.
    if (g.input.pressedAny(CONTROLS.back)) {
      g.setState(GameState.TITLE);
      return;
    }

    // Se houve KO, ENTER reinicia a luta
    if ((this.p1.ko || this.p2.ko) && g.input.pressedAny(CONTROLS.confirm)) {
      this.enter();
      return;
    }

    if (this.hitstop > 0) {
      // Hitstop: lógica dos lutadores congelada; câmera e tremor de tela continuam.
      this.hitstop--;
      this.camera.update(this.p1, this.p2);
      this.hud.update(this.p1, this.p2);
      return;
    }

    this.p1.update(g.input.actions(0), this.p2);
    this.p2.update(g.input.actions(1), this.p1);
    this._resolveHits();
    resolvePushbox(this.p1, this.p2, STAGE_EDGE_MARGIN, STAGE_WIDTH - STAGE_EDGE_MARGIN);
    constrainFighters(this.p1, this.p2);
    this.camera.update(this.p1, this.p2);
    this.hud.update(this.p1, this.p2);
  }

  /** Detecta acertos deste tick. Os dois golpes são avaliados antes de aplicar qualquer um (trade). */
  _resolveHits() {
    const hits = [];
    for (const [att, def] of [[this.p1, this.p2], [this.p2, this.p1]]) {
      if (att.hasHit) continue;
      const hitbox = att.currentHitbox();
      const hurtbox = def.hurtbox();
      if (hitbox && hurtbox && overlaps(hitbox, hurtbox)) {
        // O golpe é capturado agora: o atacante pode ser interrompido por um trade.
        hits.push({ att, def, move: att.move });
      }
    }
    if (hits.length === 0) return;

    let anyHit = false;
    for (const { att, def, move } of hits) {
      att.hasHit = true; // um golpe acerta uma única vez por execução
      const result = def.takeHit(move, att);
      if (result === 'hit') anyHit = true;
      this.lastEvent = `${move.id} -> ${result}`;
    }
    this.hitstop = HITSTOP_FRAMES;
    if (anyHit) this.game.renderer.shake(HIT_SHAKE_INTENSITY, HIT_SHAKE_FRAMES);
  }

  render(ctx) {
    const camX = this.camera.renderX;
    drawTrainingStage(ctx, camX);
    this.p1.render(ctx, camX);
    this.p2.render(ctx, camX);

    if (this.game.debug) drawFighterBoxes(ctx, [this.p1, this.p2], camX);

    // HUD (barras de vida, nomes e KO) desenhada por cima do jogo
    this.hud.render(ctx, this.p1, this.p2);

    ctx.font = `8px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = P.hint;
    const footerText = (this.p1.ko || this.p2.ko)
      ? 'K.O.!  PRESSIONE ENTER PARA REINICIAR  ESC: MENU'
      : 'P1 WASD+F/G/H  P2 SETAS+J/K/L  ESC';
    ctx.fillText(footerText, W / 2, H - 12);
  }

  debugLines() {
    const g = this.game;
    return [
      `P1 ${this.p1.describe()} ${g.input.describe(0)}`,
      `P2 ${this.p2.describe()} ${g.input.describe(1)}`,
      `hitstop ${this.hitstop}  ultimo ${this.lastEvent}`,
      `cam x${this.camera.renderX}`,
    ];
  }
}

/** Cenário provisório de treino (o Mata Atlântica real é a Etapa 8). */
function drawTrainingStage(ctx, camX) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(1, P.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Morros ao fundo com parallax lento (só para perceber o movimento da câmera).
  const farX = Math.round(camX * 0.3);
  ctx.fillStyle = P.mountain;
  for (let sx = 0; sx < W; sx += 4) {
    const wx = sx + farX;
    const h = 40 + Math.round(18 * Math.sin(wx * 0.012) + 10 * Math.sin(wx * 0.031 + 2));
    ctx.fillRect(sx, GROUND_Y - h, 4, h);
  }

  // Chão
  ctx.fillStyle = P.groundTop;
  ctx.fillRect(0, GROUND_Y, W, 2);
  ctx.fillStyle = P.groundDark;
  ctx.fillRect(0, GROUND_Y + 2, W, H - GROUND_Y - 2);

  // Marcadores a cada 80 px do cenário
  ctx.font = `8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let wx = 0; wx <= STAGE_WIDTH; wx += 80) {
    const sx = wx - camX;
    if (sx < -20 || sx > W + 20) continue;
    ctx.fillStyle = P.marker;
    ctx.fillRect(sx, GROUND_Y + 2, 1, 8);
    ctx.fillStyle = P.markerText;
    ctx.fillText(String(wx), sx, GROUND_Y + 12);
  }
}
