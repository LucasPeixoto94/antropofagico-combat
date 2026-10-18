// Máquina de estados do jogo.
// TITLE → CHAR_SELECT → ROUND_INTRO → FIGHTING → ROUND_END → (ROUND_INTRO | MATCH_END) → TITLE
// PAUSED acessível a partir de FIGHTING. Cada estado vive em src/states/.
import { DEBUG_DEFAULT, CONTROLS } from '../config.js';
import { PALETTE as P } from '../palette.js';
import { GameState } from './gameState.js';
import { Input } from './input.js';
import { FONT } from '../render/text.js';
import { TitleState } from '../states/titleState.js';
import { FightState } from '../states/fightState.js';

export { GameState };

export class Game {
  /**
   * @param {import('./renderer.js').Renderer} renderer
   * @param {import('./assets.js').Assets} assets
   */
  constructor(renderer, assets) {
    this.renderer = renderer;
    this.assets = assets;
    this.input = new Input();

    this.frame = 0; // ticks lógicos desde o início
    this.debug = DEBUG_DEFAULT;
    this.loop = null; // preenchido por main.js

    this.states = {
      [GameState.TITLE]: new TitleState(this),
      [GameState.FIGHTING]: new FightState(this),
    };
    this.state = null;
    this.stateName = null;

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

  update() {
    this.input.beginTick();
    if (this.input.pressedAny(CONTROLS.debug)) this.debug = !this.debug;
    this.state.update();
    this.renderer.update();
    this.frame++;
    this.input.endTick();
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
      `ticks/s ${this.loop?.ticksPerSecond ?? 0}  fps ${this.loop?.framesPerSecond ?? 0}`,
      `estado  ${this.stateName}  frame ${this.frame}`,
      `escala  ${scale} dpr ${r.dpr}  tela ${r.canvas.width}x${r.canvas.height}`,
      `sprites png ${a.png} ph ${a.placeholder}`,
      ...(this.state.debugLines?.() ?? []),
    ];
    const width = Math.max(...lines.map((l) => l.length)) * 8 + 8;
    ctx.save();
    ctx.fillStyle = P.debugBg;
    ctx.fillRect(2, 2, width, lines.length * 10 + 6);
    ctx.font = `8px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = P.debug;
    lines.forEach((l, i) => ctx.fillText(l, 6, 6 + i * 10));
    ctx.restore();
  }
}
