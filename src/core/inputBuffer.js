// Histórico de inputs (buffer) e reconhecimento de sequências de golpes especiais.
// As direções horizontais são guardadas de forma RELATIVA ao lado para onde o lutador olha
// ('forward' / 'back'), de modo que ↓ → + soco funcione igual nos dois lados da tela.
import { INPUT_BUFFER_FRAMES, INPUT_WINDOW } from '../config.js';

const DIR_TOKENS = new Set(['forward', 'back', 'up', 'down']);
const BTN_TOKENS = new Set(['punch', 'kick', 'block']);

export class InputBuffer {
  /** @param {number} [capacity] tamanho máximo do histórico em frames */
  constructor(capacity = INPUT_BUFFER_FRAMES) {
    this.capacity = capacity;
    /** @type {Array<{frame:number, dirs:Set<string>, buttons:Set<string>}>} */
    this.history = [];
    this.frame = 0;
    /** Último especial reconhecido (para exibir no debug). */
    this.lastSpecial = '-';
  }

  /** Limpa o histórico (início de round ou após disparar um especial). */
  clear() {
    this.history.length = 0;
  }

  /**
   * Registra as ações lógicas de 1 tick, convertendo left/right em forward/back.
   * @param {Object} actions ações lógicas do jogador neste tick
   * @param {1|-1} facing direção do lutador (1 = olhando para a direita, -1 = esquerda)
   */
  record(actions, facing = 1) {
    this.frame++;
    const dirs = new Set();
    const fwd = facing >= 0 ? actions.right : actions.left;
    const back = facing >= 0 ? actions.left : actions.right;
    // Se segurar esquerda e direita ao mesmo tempo, as duas se anulam.
    if (fwd && !back) dirs.add('forward');
    if (back && !fwd) dirs.add('back');
    if (actions.up && !actions.down) dirs.add('up');
    if (actions.down && !actions.up) dirs.add('down');

    const buttons = new Set();
    const pressed = actions.pressed || {};
    for (const btn of BTN_TOKENS) {
      if (pressed[btn]) buttons.add(btn);
    }

    this.history.push({ frame: this.frame, dirs, buttons });
    if (this.history.length > this.capacity) {
      this.history.shift();
    }
  }

  /**
   * Verifica se uma sequência como `{ seq: ['down', 'forward', 'punch'], window: 20 }`
   * foi completada NESTE tick (o último passo sendo um botão recém-pressionado).
   * Tolera frames neutros, diagonais (ex.: ↓ → passando por ↘) e 1-2 frames de ruído.
   * @param {{seq: readonly string[], window?: number}} spec
   * @returns {boolean}
   */
  matches(spec) {
    const seq = spec.seq;
    if (!seq || seq.length === 0 || this.history.length === 0) return false;
    const windowFrames = spec.window ?? INPUT_WINDOW;

    const latest = this.history[this.history.length - 1];
    const lastToken = seq[seq.length - 1];

    // O gatilho final da sequência precisa acontecer no tick atual.
    if (BTN_TOKENS.has(lastToken)) {
      if (!latest.buttons.has(lastToken)) return false;
    } else if (DIR_TOKENS.has(lastToken)) {
      if (!latest.dirs.has(lastToken)) return false;
    } else {
      return false;
    }

    const minFrame = latest.frame - windowFrames;
    const dirs = seq.slice(0, -1);
    if (dirs.length === 0) return true;

    // Coleta os frames dentro da janela [minFrame, latest.frame] em ordem cronológica.
    const win = [];
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].frame >= minFrame) win.push(this.history[i]);
    }

    // Procura os passos direcionais em ordem:
    // - Passo 0: primeiro frame na janela que contém dirs[0].
    // - Passo k > 0: primeiro frame estritamente posterior que contém dirs[k]
    //   e onde a transição ocorreu (ou seja, dirs[k] não estava simplesmente segurado
    //   desde o início do passo anterior sem passar por neutro ou diagonal).
    let idx = 0;
    for (let step = 0; step < dirs.length; step++) {
      const token = dirs[step];
      const prevToken = step > 0 ? dirs[step - 1] : null;
      let found = -1;
      for (let j = idx; j < win.length; j++) {
        const entry = win[j];
        if (!entry.dirs.has(token)) continue;
        // Evita que segurar ↘ (down+forward) em 2 frames seguidos conte como (down -> forward)
        // se o jogador nunca começou em down puro nem transitou para forward puro.
        if (prevToken && entry.dirs.has(prevToken)) {
          const prevEntry = win[idx - 1];
          if (prevEntry && prevEntry.dirs.has(token) && prevEntry.dirs.has(prevToken)) {
            continue;
          }
        }
        found = j;
        break;
      }
      if (found === -1) return false;
      idx = found + 1;
    }

    return true;
  }

  /**
   * Avalia uma lista de especiais (em ordem de prioridade: sequências mais longas primeiro).
   * Se reconhecer algum, limpa o buffer (para não disparar duas vezes) e retorna o golpe.
   * @param {readonly Object[]} specials
   * @param {{consume?: boolean}} [opts]
   * @returns {Object|null}
   */
  matchSpecials(specials, { consume = true } = {}) {
    if (!specials || specials.length === 0) return null;
    // Prioridade: sequência mais específica (maior comprimento) vence a mais curta.
    const sorted = [...specials].sort((a, b) => b.seq.length - a.seq.length);
    for (const sp of sorted) {
      if (this.matches(sp)) {
        this.lastSpecial = sp.id;
        if (consume) this.clear();
        return sp;
      }
    }
    return null;
  }

  /**
   * Resumo compacto dos últimos inputs para o debug overlay (F1).
   * Colapsa frames consecutivos idênticos para mostrar a sequência limpa (ex.: "↓ ↘ →+P").
   * @param {number} [maxTokens]
   * @returns {string}
   */
  describe(maxTokens = 8) {
    const tokens = [];
    let prev = '';
    for (const e of this.history) {
      const sym = formatEntry(e);
      if (!sym) {
        prev = '';
        continue;
      }
      if (sym !== prev) {
        tokens.push(sym);
        prev = sym;
      }
    }
    const tail = tokens.slice(-maxTokens).join(' ');
    return tail || '-';
  }
}

function formatEntry(e) {
  const f = e.dirs.has('forward');
  const b = e.dirs.has('back');
  const u = e.dirs.has('up');
  const d = e.dirs.has('down');

  let dir = '';
  if (d && f) dir = '↘';
  else if (d && b) dir = '↙';
  else if (u && f) dir = '↗';
  else if (u && b) dir = '↖';
  else if (f) dir = '→';
  else if (b) dir = '←';
  else if (d) dir = '↓';
  else if (u) dir = '↑';

  const btns = [];
  if (e.buttons.has('punch')) btns.push('P');
  if (e.buttons.has('kick')) btns.push('K');
  if (e.buttons.has('block')) btns.push('B');

  if (dir && btns.length) return `${dir}+${btns.join('')}`;
  return dir || btns.join('');
}

