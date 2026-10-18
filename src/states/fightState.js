// Estado FIGHTING (Etapa 3: modo treino).
// Saci (P1) vs Curupira como boneco de treino — fica parado, a menos que o P2 use as setas.
// Rounds, vida e pausa entram nas Etapas 5–6.
import {
  INTERNAL_WIDTH as W,
  INTERNAL_HEIGHT as H,
  STAGE_WIDTH,
  GROUND_Y,
  CONTROLS,
  STAGE_EDGE_MARGIN,
  SCREEN_EDGE_MARGIN,
  FIGHTER_START_OFFSET,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { GameState } from '../core/gameState.js';
import { Camera } from '../core/camera.js';
import { Fighter } from '../fight/fighter.js';
import { CHARACTERS } from '../characters/index.js';
import { FONT } from '../render/text.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Mantém os lutadores dentro do cenário e ambos dentro da tela. */
function constrainFighters(a, b) {
  for (const f of [a, b]) f.x = clamp(f.x, STAGE_EDGE_MARGIN, STAGE_WIDTH - STAGE_EDGE_MARGIN);

  const maxSep = W - 2 * SCREEN_EDGE_MARGIN;
  const left = a.x <= b.x ? a : b;
  const right = left === a ? b : a;
  const excess = right.x - left.x - maxSep;
  if (excess > 0) {
    // Quem estava se afastando é quem recua.
    const lOut = Math.max(0, -left.vx);
    const rOut = Math.max(0, right.vx);
    const total = lOut + rOut;
    const lShare = total > 0 ? lOut / total : 0.5;
    left.x += excess * lShare;
    right.x -= excess * (1 - lShare);
  }
}

export class FightState {
  constructor(game) {
    this.game = game;
  }

  enter() {
    const g = this.game;
    const mid = STAGE_WIDTH / 2;
    this.p1 = new Fighter({ def: CHARACTERS.saci, assets: g.assets, x: mid - FIGHTER_START_OFFSET, facing: 1 });
    this.p2 = new Fighter({ def: CHARACTERS.curupira, assets: g.assets, x: mid + FIGHTER_START_OFFSET, facing: -1 });
    this.camera = new Camera();
    this.camera.snap(this.p1, this.p2);
  }

  update() {
    const g = this.game;
    // TEMP: ESC volta ao título. Na Etapa 6 vira pausa.
    if (g.input.pressedAny(CONTROLS.back)) {
      g.setState(GameState.TITLE);
      return;
    }
    this.p1.update(g.input.actions(0), this.p2);
    this.p2.update(g.input.actions(1), this.p1);
    constrainFighters(this.p1, this.p2);
    this.camera.update(this.p1, this.p2);
  }

  render(ctx) {
    const camX = this.camera.renderX;
    drawTrainingStage(ctx, camX);
    this.p1.render(ctx, camX);
    this.p2.render(ctx, camX);

    if (this.game.debug) {
      for (const f of [this.p1, this.p2]) {
        const x = Math.round(f.x - camX);
        const y = Math.round(f.y);
        ctx.fillStyle = P.debug;
        ctx.fillRect(x - 3, y, 7, 1);
        ctx.fillRect(x, y - 3, 1, 7);
      }
    }

    ctx.font = `8px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = P.hint;
    ctx.fillText('TREINO  •  P1: WASD  •  P2: setas  •  ESC: sair', W / 2, H - 12);
  }

  debugLines() {
    const g = this.game;
    return [
      `P1 ${this.p1.describe()} ${g.input.describe(0)}`,
      `P2 ${this.p2.describe()} ${g.input.describe(1)}`,
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
