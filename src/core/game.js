// Máquina de estados do jogo.
// TITLE → CHAR_SELECT → ROUND_INTRO → FIGHTING → ROUND_END → (ROUND_INTRO | MATCH_END) → TITLE
// As fases do round (ROUND_INTRO, ROUND_END, MATCH_END) vivem dentro de FIGHTING (fight/round.js).
// PAUSED acessível a partir de FIGHTING. Cada estado vive em src/states/.
import { DEBUG_DEFAULT, CONTROLS } from '../config.js';
import { GameState } from './gameState.js';
import { Input } from './input.js';
import { drawPanel } from '../debug/debugOverlay.js';
import { TitleState } from '../states/titleState.js';
import { FightState } from '../states/fightState.js';
import { PauseState } from '../states/pauseState.js';

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
      [GameState.PAUSED]: new PauseState(this),
    };
    this.state = null;
    this.stateName = null;

    this.setState(GameState.TITLE);
  }

  /**
   * @param {string} name
   * @param {Object} [params] repassado ao enter() do estado (ex.: { resume: true } ao sair da pausa)
   */
  setState(name, params) {
    const next = this.states[name];
    if (!next) {
      console.warn(`[game] estado ainda não implementado: ${name}`);
      return;
    }
    this.state?.exit?.();
    this.state = next;
    this.stateName = name;
    this.state.enter?.(params);
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
    drawPanel(ctx, lines);
  }
}
