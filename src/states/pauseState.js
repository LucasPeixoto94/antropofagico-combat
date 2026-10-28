// Estado PAUSED: congela a luta (nada é atualizado) e desenha um menu por cima dela.
// ESC ou "CONTINUAR" retomam exatamente de onde parou; "SAIR" volta ao título.
import { INTERNAL_WIDTH as W, INTERNAL_HEIGHT as H, CONTROLS } from '../config.js';
import { PALETTE as P } from '../palette.js';
import { GameState } from '../core/gameState.js';
import { FONT, drawOutlinedText } from '../render/text.js';

const OPTIONS = Object.freeze(['CONTINUAR', 'SAIR PARA O TÍTULO']);

export class PauseState {
  constructor(game) {
    this.game = game;
    this.selected = 0;
  }

  enter() {
    this.selected = 0;
  }

  /** A luta pausada, que continua sendo desenhada por baixo do menu. */
  get fight() {
    return this.game.states[GameState.FIGHTING];
  }

  update() {
    const g = this.game;
    const input = g.input;
    if (input.pressedAny(CONTROLS.back)) {
      this._resume();
      return;
    }
    // Qualquer jogador navega pelo menu.
    const moved = [0, 1].reduce((d, i) => {
      const a = input.actions(i).pressed;
      return d + (a.down ? 1 : 0) - (a.up ? 1 : 0);
    }, 0);
    if (moved !== 0) this.selected = (this.selected + Math.sign(moved) + OPTIONS.length) % OPTIONS.length;

    if (input.pressedAny(CONTROLS.confirm)) {
      if (this.selected === 0) this._resume();
      else g.setState(GameState.TITLE);
    }
  }

  _resume() {
    this.game.setState(GameState.FIGHTING, { resume: true });
  }

  render(ctx) {
    this.fight.render(ctx);

    ctx.fillStyle = P.pauseOverlay;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, 'PAUSA', W / 2, 96, 24, P.title, P.titleOutline, P.titleGlow, 8);

    ctx.font = `10px ${FONT}`;
    OPTIONS.forEach((label, i) => {
      const sel = i === this.selected;
      ctx.fillStyle = sel ? P.pauseSelected : P.pauseOption;
      ctx.fillText(sel ? `> ${label} <` : label, W / 2, 140 + i * 18);
    });

    ctx.font = `8px ${FONT}`;
    ctx.fillStyle = P.hint;
    ctx.fillText('CIMA/BAIXO: ESCOLHER  ENTER: CONFIRMAR  ESC: VOLTAR', W / 2, H - 16);
  }

  debugLines() {
    return this.fight.debugLines?.() ?? [];
  }
}

