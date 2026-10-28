// Estado FIGHTING: uma partida completa (melhor de 3) entre Saci (P1) e Curupira (P2).
// As fases do round (intro, luta, fim de round, fim de partida) vivem em fight/round.js;
// a pausa (ESC) é um estado do jogo à parte (states/pauseState.js) que retoma sem perder nada.
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
  ROUND_INTRO_FRAMES,
  ROUND_INTRO_FIGHT_FRAMES,
  KO_SLOWMO_FRAMES,
  KO_SLOWMO_RATE,
  KO_SHAKE_INTENSITY,
  KO_SHAKE_FRAMES,
  KO_FLASH_FRAMES,
  ROUND_END_WINNER_FRAMES,
  MATCH_END_INPUT_DELAY,
  TITLE_BLINK_FRAMES,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { GameState } from '../core/gameState.js';
import { ACTIONS } from '../core/input.js';
import { Camera } from '../core/camera.js';
import { Fighter } from '../fight/fighter.js';
import { overlaps, resolvePushbox } from '../fight/collision.js';
import { Match, MatchEvent, RoundPhase, RoundEndReason } from '../fight/round.js';
import { CHARACTERS } from '../characters/index.js';
import { FONT } from '../render/text.js';
import { drawFighterBoxes } from '../debug/debugOverlay.js';
import { Hud } from '../render/hud.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Ações "nada apertado": usadas fora da fase de luta (intro, fim de round). */
const NO_INPUT = Object.freeze({
  ...Object.fromEntries(ACTIONS.map((a) => [a, false])),
  pressed: Object.freeze(Object.fromEntries(ACTIONS.map((a) => [a, false]))),
});

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

  /** @param {{resume?: boolean}} [params] resume = voltando da pausa (não reinicia nada) */
  enter(params) {
    if (params?.resume && this.match) return;
    this.match = new Match();
    this._resetRound();
  }

  /** Reset explícito de TUDO que pertence a um round (evita estado vazando entre rounds). */
  _resetRound() {
    const g = this.game;
    const mid = STAGE_WIDTH / 2;
    this.p1 = new Fighter({ def: CHARACTERS.saci, assets: g.assets, x: mid - FIGHTER_START_OFFSET, facing: 1 });
    this.p2 = new Fighter({ def: CHARACTERS.curupira, assets: g.assets, x: mid + FIGHTER_START_OFFSET, facing: -1 });
    this.camera = new Camera();
    this.camera.snap(this.p1, this.p2);
    this.hud = new Hud();
    this.hitstop = 0;
    this.lastEvent = '-';
  }

  get fighters() {
    return [this.p1, this.p2];
  }

  /** Lutador vencedor do round atual (ou null). */
  get roundWinner() {
    const w = this.match.result?.winner;
    return w === 0 || w === 1 ? this.fighters[w] : null;
  }

  update() {
    const g = this.game;
    const m = this.match;

    if (m.phase === RoundPhase.MATCH_END) {
      const ready = m.phaseFrame >= MATCH_END_INPUT_DELAY;
      if (ready && (g.input.pressedAny(CONTROLS.confirm) || g.input.pressedAny(CONTROLS.back))) {
        g.setState(GameState.TITLE);
        return;
      }
    } else if (g.input.pressedAny(CONTROLS.back)) {
      g.setState(GameState.PAUSED);
      return;
    }

    const event = m.update({
      ko: [this.p1.ko, this.p2.ko],
      health: [this.p1.health, this.p2.health],
      maxHealth: [this.p1.stats.maxHealth, this.p2.stats.maxHealth],
    });
    this._onMatchEvent(event);
    if (event === MatchEvent.NEXT_ROUND) return;

    this._simulate();
  }

  _onMatchEvent(event) {
    if (!event) return;
    this.lastEvent = event;
    const r = this.game.renderer;
    switch (event) {
      case MatchEvent.NEXT_ROUND:
        this._resetRound();
        break;
      case MatchEvent.KO:
        r.flash(P.flashWhite, KO_FLASH_FRAMES);
        r.shake(KO_SHAKE_INTENSITY, KO_SHAKE_FRAMES);
        break;
      default:
    }
  }

  /** Um tick da simulação dos lutadores (respeitando hitstop e câmera lenta do K.O.). */
  _simulate() {
    const g = this.game;
    const m = this.match;

    const slowmo = m.phase === RoundPhase.END && m.result.reason !== RoundEndReason.TIME &&
      m.phaseFrame < KO_SLOWMO_FRAMES && m.phaseFrame % KO_SLOWMO_RATE !== 0;

    if (this.hitstop > 0 || slowmo) {
      // Lógica dos lutadores congelada; câmera, tremor e HUD continuam.
      if (!slowmo) this.hitstop--;
      this._updateView();
      return;
    }

    const fighting = m.fighting;
    this.p1.update(fighting ? g.input.actions(0) : NO_INPUT, this.p2);
    this.p2.update(fighting ? g.input.actions(1) : NO_INPUT, this.p1);
    if (fighting) this._resolveHits();
    resolvePushbox(this.p1, this.p2, STAGE_EDGE_MARGIN, STAGE_WIDTH - STAGE_EDGE_MARGIN);
    constrainFighters(this.p1, this.p2);

    // Vencedor comemora assim que estiver livre (depois do anúncio de K.O./TEMPO).
    const showWinner = m.phase === RoundPhase.MATCH_END ||
      (m.phase === RoundPhase.END && m.phaseFrame >= ROUND_END_WINNER_FRAMES);
    if (showWinner) this.roundWinner?.celebrate();

    this._updateView();
  }

  _updateView() {
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
    // Derrotado atrás; vencedor na frente.
    const order = this.p1.ko ? [this.p1, this.p2] : [this.p2, this.p1];
    for (const f of order) f.render(ctx, camX);

    if (this.game.debug) drawFighterBoxes(ctx, this.fighters, camX);

    this.hud.render(ctx, this.p1, this.p2, this.match, this.game.frame);
    this._renderAnnouncement(ctx);
    this._renderFooter(ctx);
  }

  _renderAnnouncement(ctx) {
    const m = this.match;
    const hud = this.hud;
    const winnerName = (w) => this.fighters[w].def.name;

    switch (m.phase) {
      case RoundPhase.INTRO:
        if (m.phaseFrame < ROUND_INTRO_FRAMES - ROUND_INTRO_FIGHT_FRAMES) {
          hud.announce(ctx, m.isFinalRound ? 'ROUND FINAL' : `ROUND ${m.round}`, { size: 20 });
        } else {
          hud.announce(ctx, 'FIGHT!', { color: P.announceFight });
        }
        break;

      case RoundPhase.END: {
        const { reason, winner } = m.result;
        if (m.phaseFrame < ROUND_END_WINNER_FRAMES) {
          if (reason === RoundEndReason.TIME) hud.announce(ctx, 'TEMPO!', { size: 24 });
          else if (reason === RoundEndReason.DOUBLE_KO) hud.announce(ctx, 'DUPLO K.O.', { color: P.hudKoText, size: 20 });
          else hud.announce(ctx, 'K.O.', { color: P.hudKoText });
        } else if (winner === null) {
          hud.announce(ctx, 'EMPATE', { size: 20, sub: 'NINGUÉM PONTUA' });
        } else {
          hud.announce(ctx, `${winnerName(winner)} VENCE`, { size: 16 });
        }
        break;
      }

      case RoundPhase.MATCH_END:
        if (m.winner === 'draw') hud.announce(ctx, 'EMPATE', { size: 20, sub: 'A LUTA TERMINOU EMPATADA' });
        else hud.announce(ctx, winnerName(m.winner), { size: 20, sub: 'VENCE A LUTA!' });
        break;

      default:
    }
  }

  _renderFooter(ctx) {
    const m = this.match;
    let text = 'P1 WASD+F/G/H  P2 SETAS+J/K/L  ESC PAUSA';
    if (m.phase === RoundPhase.MATCH_END) {
      const blinkOn = Math.floor(this.game.frame / TITLE_BLINK_FRAMES) % 2 === 0;
      text = m.phaseFrame >= MATCH_END_INPUT_DELAY && blinkOn ? 'ENTER: VOLTAR AO TÍTULO' : '';
    }
    if (!text) return;
    ctx.font = `8px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = P.hint;
    ctx.fillText(text, W / 2, H - 12);
  }

  debugLines() {
    const g = this.game;
    const m = this.match;
    return [
      `P1 ${this.p1.describe()} ${g.input.describe(0)}`,
      `P2 ${this.p2.describe()} ${g.input.describe(1)}`,
      `round ${m.round} ${m.phase} f${m.phaseFrame}  timer ${m.timeLeft}  placar ${m.wins[0]}-${m.wins[1]}`,
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
