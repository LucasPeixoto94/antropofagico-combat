// Lutador genérico + máquina de estados de movimento.
// Os dados (velocidades, animações) vêm de characters/*.js; aqui não há nada específico de personagem.
import {
  GRAVITY,
  GROUND_Y,
  BACK_WALK_MULTIPLIER,
  JUMP_DRIFT,
  FACING_DEADZONE,
} from '../config.js';
import { Animation } from '../render/sprites.js';

export const FighterState = Object.freeze({
  IDLE: 'idle',
  WALK_FWD: 'walk_fwd',
  WALK_BACK: 'walk_back',
  JUMP: 'jump',
  CROUCH: 'crouch',
});

export class Fighter {
  /**
   * @param {Object} o
   * @param {Object} o.def      dados do personagem (characters/*.js)
   * @param {import('../core/assets.js').Assets} o.assets
   * @param {number} o.x
   * @param {1|-1} o.facing     1 = olhando para a direita
   */
  constructor({ def, assets, x, facing }) {
    this.def = def;
    this.stats = def.stats;
    this.assets = assets;
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.state = null;
    this.stateFrame = 0;
    this.anim = null;
    this.setState(FighterState.IDLE);
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.stateFrame = 0;
    const sprite = this.assets.get(`${this.def.id}/${state}`) || this.assets.get(`${this.def.id}/idle`);
    this.anim = new Animation(sprite);
  }

  /** Vira para o oponente (só chamado no chão; no ar a direção fica travada). */
  faceTowards(other) {
    const dx = other.x - this.x;
    if (Math.abs(dx) > FACING_DEADZONE) this.facing = dx > 0 ? 1 : -1;
  }

  /**
   * @param {Object} actions ações lógicas do jogador neste tick
   * @param {Fighter} opponent
   */
  update(actions, opponent) {
    if (this.state !== FighterState.JUMP) {
      this.faceTowards(opponent);
      const dir = (actions.right ? 1 : 0) - (actions.left ? 1 : 0);
      const forward = dir !== 0 && dir === this.facing;
      const back = dir !== 0 && dir === -this.facing;

      if (actions.up) {
        this.vy = this.stats.jumpVelocity;
        this.vx = dir * JUMP_DRIFT;
        this.setState(FighterState.JUMP);
      } else if (actions.down) {
        this.vx = 0;
        this.setState(FighterState.CROUCH);
      } else if (forward) {
        this.vx = this.facing * this.stats.walkSpeed;
        this.setState(FighterState.WALK_FWD);
      } else if (back) {
        this.vx = -this.facing * this.stats.walkSpeed * BACK_WALK_MULTIPLIER;
        this.setState(FighterState.WALK_BACK);
      } else {
        this.vx = 0;
        this.setState(FighterState.IDLE);
      }
    }

    this.x += this.vx;

    if (this.state === FighterState.JUMP) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        this.vx = 0;
        this.setState(FighterState.IDLE);
        this.faceTowards(opponent);
      }
    }

    this.stateFrame++;
    this.anim.update();
  }

  render(ctx, camX) {
    this.anim.draw(ctx, this.x - camX, this.y, this.facing < 0);
  }

  /** Linha de debug. */
  describe() {
    const f = this.facing > 0 ? '+1' : '-1';
    return `${this.state} x${Math.round(this.x)} y${Math.round(this.y)} f${f}`;
  }
}
