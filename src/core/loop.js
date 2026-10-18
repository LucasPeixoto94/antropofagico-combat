// Game loop com passo fixo (acumulador).
// A lógica roda em ticks de 1/60 s; o render roda uma vez por frame do navegador.
import { STEP_MS, MAX_STEPS_PER_FRAME } from '../config.js';

export class Loop {
  /** @param {{update: () => void, render: () => void}} game */
  constructor(game) {
    this.game = game;
    this.acc = 0;
    this.last = 0;
    this.running = false;

    // Estatísticas (janela de 1 s)
    this.totalTicks = 0;
    this.ticksPerSecond = 0;
    this.framesPerSecond = 0;
    this._statTicks = 0;
    this._statFrames = 0;
    this._statStart = 0;

    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.reset();
    });
    requestAnimationFrame(this._frame);
  }

  /** Descarta o tempo acumulado (ex.: ao voltar de uma aba em segundo plano). */
  reset() {
    this.acc = 0;
    this.last = 0;
    this._statStart = 0;
    this._statTicks = 0;
    this._statFrames = 0;
  }

  _frame(now) {
    if (!this.running) return;
    if (!this.last) this.last = now;

    // Clamp do delta: nunca acumula mais que o permitido num único frame.
    const delta = Math.min(now - this.last, STEP_MS * MAX_STEPS_PER_FRAME);
    this.last = now;
    this.acc += delta;

    let steps = 0;
    while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      this.game.update();
      this.acc -= STEP_MS;
      steps++;
    }
    // Atingiu o limite: joga fora o resto para não "correr atrás" do tempo.
    if (steps >= MAX_STEPS_PER_FRAME) this.acc = 0;

    this.totalTicks += steps;
    this._updateStats(now, steps);

    this.game.render();
    requestAnimationFrame(this._frame);
  }

  _updateStats(now, steps) {
    if (!this._statStart) this._statStart = now;
    this._statTicks += steps;
    this._statFrames += 1;
    const elapsed = now - this._statStart;
    if (elapsed >= 1000) {
      this.ticksPerSecond = Math.round((this._statTicks * 1000) / elapsed);
      this.framesPerSecond = Math.round((this._statFrames * 1000) / elapsed);
      this._statStart = now;
      this._statTicks = 0;
      this._statFrames = 0;
    }
  }
}
