// Input: teclado -> ações lógicas por jogador, amostradas uma vez por tick.
// (Gamepad entra na Etapa 10.)
import { CONTROLS } from '../config.js';

export const ACTIONS = Object.freeze(['left', 'right', 'up', 'down', 'punch', 'kick', 'block']);

/** Teclas que não devem disparar comportamento do navegador. */
const PREVENT_DEFAULT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'F1', 'Tab',
]);

function emptyActions() {
  const a = { pressed: {} };
  for (const act of ACTIONS) {
    a[act] = false;
    a.pressed[act] = false;
  }
  return a;
}

export class Input {
  constructor() {
    /** Teclas seguradas agora. */
    this.down = new Set();
    /** Teclas pressionadas desde o último tick (mesmo que já soltas). */
    this.justPressed = new Set();
    this.players = CONTROLS.players.map(() => emptyActions());

    window.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.justPressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    // Ao perder o foco, solta tudo (evita tecla "presa").
    window.addEventListener('blur', () => this.down.clear());
  }

  /** Início do tick: converte teclas em ações de cada jogador. */
  beginTick() {
    CONTROLS.players.forEach((map, i) => {
      const a = this.players[i];
      for (const act of ACTIONS) {
        const codes = map[act];
        const pressed = codes.some((c) => this.justPressed.has(c));
        // Um toque mais curto que um tick ainda conta como segurado neste tick.
        a[act] = pressed || codes.some((c) => this.down.has(c));
        a.pressed[act] = pressed;
      }
    });
  }

  /** Fim do tick: descarta as teclas "recém-pressionadas". */
  endTick() {
    this.justPressed.clear();
  }

  /** true se alguma das teclas foi pressionada neste tick. */
  pressedAny(codes) {
    return codes.some((c) => this.justPressed.has(c));
  }

  /** Ações lógicas do jogador i (0 = P1, 1 = P2). */
  actions(i) {
    return this.players[i];
  }

  /** Texto curto das ações seguradas (debug). */
  describe(i) {
    const a = this.players[i];
    const map = { left: '←', right: '→', up: '↑', down: '↓', punch: 'P', kick: 'K', block: 'B' };
    return ACTIONS.filter((act) => a[act]).map((act) => map[act]).join('') || '-';
  }
}
