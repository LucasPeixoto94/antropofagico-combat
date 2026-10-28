// Lutador genérico + máquina de estados.
// Os dados (velocidades, animações) vêm de characters/*.js; aqui não há nada específico de personagem.
import {
  GRAVITY,
  GROUND_Y,
  BACK_WALK_MULTIPLIER,
  JUMP_DRIFT,
  FACING_DEADZONE,
  CROUCH_HEIGHT_RATIO,
  AIR_HURTBOX_RATIO,
  HURTBOX_WIDTH,
  REF_HEIGHT,
  KNOCKDOWN_FRAMES,
  KNOCKBACK_FRICTION,
  BLOCK_DAMAGE_MULTIPLIER,
  BLOCK_PUSHBACK,
  HIT_KNOCKBACK,
  AIR_HIT_POP,
  PUSHBOX_WIDTH,
} from '../config.js';
import { Animation, drawSprite } from '../render/sprites.js';
import { getMove, pickMove, movePhase, moveDuration, phaseFrameIndex } from './moves.js';
import { worldBox } from './collision.js';

export const FighterState = Object.freeze({
  IDLE: 'idle',
  WALK_FWD: 'walk_fwd',
  WALK_BACK: 'walk_back',
  JUMP: 'jump',
  CROUCH: 'crouch',
  BLOCK: 'block',
  ATTACK: 'attack',
  HITSTUN: 'hitstun',
  KNOCKDOWN: 'knockdown',
  VICTORY: 'victory',
});
const S = FighterState;

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
    /** Empurrão de golpe/defesa, separado da velocidade de caminhada; decai sozinho. */
    this.kb = 0;
    this.facing = facing;
    this.health = this.stats.maxHealth;

    this.state = null;
    this.spriteKey = null;
    this.stateFrame = 0;
    this.anim = null;

    /** Golpe atual (estado ATTACK) e controle de frame data. */
    this.move = null;
    this.moveFrame = 0;
    this.hasHit = false;
    /** Frames restantes de hitstun / blockstun / knockdown no chão. */
    this.stun = 0;
    this.crouchBlock = false;
    this.lying = false;
    /** Derrotado: cai, fica no chão e os controles travam (até reiniciar). */
    this.ko = false;

    this.setState(S.IDLE);
  }

  /** @param {string} state  @param {string} [spriteKey] chave da animação (padrão: o nome do estado) */
  setState(state, spriteKey = state) {
    if (state === this.state && spriteKey === this.spriteKey) return;
    this.state = state;
    this.spriteKey = spriteKey;
    this.stateFrame = 0;
    const sprite = this.assets.get(`${this.def.id}/${spriteKey}`) || this.assets.get(`${this.def.id}/idle`);
    this.anim = new Animation(sprite);
  }

  get airborne() {
    return this.y < GROUND_Y || this.vy < 0;
  }

  /** Vira para o oponente (só no chão e fora de golpes; no ar a direção fica travada). */
  faceTowards(other) {
    const dx = other.x - this.x;
    if (Math.abs(dx) > FACING_DEADZONE) this.facing = dx > 0 ? 1 : -1;
  }

  /**
   * @param {Object} actions ações lógicas do jogador neste tick
   * @param {Fighter} opponent
   */
  update(actions, opponent) {
    switch (this.state) {
      case S.ATTACK:
        this._updateAttack();
        break;
      case S.HITSTUN:
        if (--this.stun <= 0) this.setState(S.IDLE);
        break;
      case S.KNOCKDOWN:
        this._updateKnockdown(opponent);
        break;
      case S.VICTORY:
        this.vx = 0; // comemora parado até o próximo round
        break;
      case S.BLOCK:
        if (this.stun > 0) {
          // Blockstun: preso na defesa mesmo que solte o botão.
          this.stun--;
          this.vx = 0;
        } else {
          this._control(actions, opponent);
        }
        break;
      default:
        this._control(actions, opponent);
    }

    this.x += this.vx + this.kb;
    this.kb *= KNOCKBACK_FRICTION;
    if (Math.abs(this.kb) < 0.05) this.kb = 0;

    this._physics(opponent);

    this.stateFrame++;
    this.anim.update();
  }

  // ---------------------------------------------------------------------
  // Controle livre (idle, walk, crouch, block, jump)
  // ---------------------------------------------------------------------
  _control(actions, opponent) {
    if (this.state === S.JUMP) {
      const id = pickMove(actions, { air: true });
      if (id) this._startAttack(id);
      return;
    }

    this.faceTowards(opponent);

    const id = pickMove(actions, { air: false, crouch: actions.down });
    if (id) {
      this._startAttack(id);
      return;
    }

    if (actions.block) {
      this.crouchBlock = actions.down;
      this.vx = 0;
      this.setState(S.BLOCK, actions.down ? 'crouch_block' : 'block');
      return;
    }

    const dir = (actions.right ? 1 : 0) - (actions.left ? 1 : 0);
    const forward = dir !== 0 && dir === this.facing;
    const back = dir !== 0 && dir === -this.facing;

    if (actions.up) {
      this.vy = this.stats.jumpVelocity;
      this.vx = dir * JUMP_DRIFT;
      this.setState(S.JUMP);
    } else if (actions.down) {
      this.vx = 0;
      this.setState(S.CROUCH);
    } else if (forward) {
      this.vx = this.facing * this.stats.walkSpeed;
      this.setState(S.WALK_FWD);
    } else if (back) {
      this.vx = -this.facing * this.stats.walkSpeed * BACK_WALK_MULTIPLIER;
      this.setState(S.WALK_BACK);
    } else {
      this.vx = 0;
      this.setState(S.IDLE);
    }
  }

  // ---------------------------------------------------------------------
  // Golpes
  // ---------------------------------------------------------------------
  _startAttack(id) {
    const move = getMove(this.def, id);
    this.move = move;
    this.moveFrame = 0;
    this.hasHit = false;
    if (move.stance !== 'air') this.vx = 0; // golpes no chão não deslizam
    this.setState(S.ATTACK, `attack_${id}`);
  }

  _updateAttack() {
    this.moveFrame++;
    if (movePhase(this.move, this.moveFrame) !== 'done') return;
    const air = this.move.stance === 'air';
    this.move = null;
    // No ar, volta ao pulo (o pouso é tratado na física); no chão, volta ao neutro.
    this.setState(air ? S.JUMP : S.IDLE);
  }

  /** Fase atual do golpe ('startup' | 'active' | 'recovery') ou null fora de golpe. */
  get phase() {
    return this.state === S.ATTACK && this.move ? movePhase(this.move, this.moveFrame) : null;
  }

  /** Hitbox em coordenadas de mundo, apenas nos frames active. */
  currentHitbox() {
    if (this.phase !== 'active') return null;
    return worldBox(this.x, this.y, this.facing, this.move.hitbox, this.stats.height / REF_HEIGHT);
  }

  /** Altura atual do corpo (varia com agachar e pular). */
  _bodyHeight() {
    const h = this.stats.height;
    const crouching =
      this.state === S.CROUCH ||
      (this.state === S.BLOCK && this.crouchBlock) ||
      (this.state === S.ATTACK && this.move?.stance === 'crouch');
    if (crouching) return h * CROUCH_HEIGHT_RATIO;
    if (this.airborne) return h * AIR_HURTBOX_RATIO;
    return h;
  }

  /** Hurtbox em coordenadas de mundo; null quando não pode ser acertado (derrubado). */
  hurtbox() {
    if (this.state === S.KNOCKDOWN) return null;
    const hh = this._bodyHeight();
    return worldBox(this.x, this.y, this.facing, { x: -HURTBOX_WIDTH / 2, y: -hh, w: HURTBOX_WIDTH, h: hh });
  }

  /** Pushbox: impede que os lutadores se atravessem; null quando não empurra (no ar ou derrubado). */
  pushbox() {
    if (this.state === S.KNOCKDOWN || this.airborne) return null;
    const hh = this._bodyHeight();
    return worldBox(this.x, this.y, this.facing, { x: -PUSHBOX_WIDTH / 2, y: -hh, w: PUSHBOX_WIDTH, h: hh });
  }

  /**
   * Aplica um golpe que acertou este lutador.
   * @param {Object} move dados do golpe (capturados antes, pois o atacante pode ser interrompido)
   * @param {Fighter} attacker
   * @returns {'hit'|'block'}
   */
  takeHit(move, attacker) {
    const dir = Math.sign(this.x - attacker.x) || attacker.facing;
    this.move = null;
    this.vx = 0;

    if (this.state === S.BLOCK) {
      // Dano de chip nunca mata: no mínimo sobra 1 de vida.
      this.health = Math.max(1, this.health - Math.max(1, Math.round(move.damage * BLOCK_DAMAGE_MULTIPLIER)));
      this.stun = move.blockstun;
      this.kb = dir * BLOCK_PUSHBACK;
      return 'block';
    }

    this.health = Math.max(0, this.health - move.damage);
    this.kb = dir * HIT_KNOCKBACK;
    const ko = this.health <= 0;
    if (this.airborne || move.knockdown || ko) {
      if (this.airborne) this.vy = AIR_HIT_POP;
      this.lying = false;
      this.ko = ko;
      this.setState(S.KNOCKDOWN);
    } else {
      this.stun = move.hitstun;
      this.setState(S.HITSTUN);
    }
    return 'hit';
  }

  /**
   * Entra na pose de vitória se estiver livre (no chão, fora de golpe/stun).
   * @returns {boolean} true se comemorou (ou já estava comemorando)
   */
  celebrate() {
    if (this.state === S.VICTORY) return true;
    const free = [S.IDLE, S.WALK_FWD, S.WALK_BACK, S.CROUCH, S.BLOCK].includes(this.state);
    if (this.ko || this.airborne || !free || this.stun > 0) return false;
    this.vx = 0;
    this.setState(S.VICTORY);
    return true;
  }

  _updateKnockdown(opponent) {
    if (this.airborne) return; // ainda caindo
    if (!this.lying) {
      this.lying = true;
      this.stun = KNOCKDOWN_FRAMES;
    }
    if (this.ko) return; // derrotado: não levanta
    if (--this.stun <= 0) {
      this.lying = false;
      this.setState(S.IDLE);
      this.faceTowards(opponent);
    }
  }

  // ---------------------------------------------------------------------
  // Física vertical e pouso
  // ---------------------------------------------------------------------
  _physics(opponent) {
    if (!this.airborne) return;
    this.vy += GRAVITY;
    this.y += this.vy;
    if (this.y < GROUND_Y) return;

    // Pouso
    this.y = GROUND_Y;
    this.vy = 0;
    if (this.state === S.JUMP || (this.state === S.ATTACK && this.move?.stance === 'air')) {
      this.vx = 0;
      this.move = null;
      this.setState(S.IDLE);
      this.faceTowards(opponent);
    }
    // KNOCKDOWN: continua no estado; _updateKnockdown cuida do tempo no chão.
  }

  // ---------------------------------------------------------------------
  render(ctx, camX) {
    const x = this.x - camX;
    if (this.state === S.ATTACK && this.move) {
      // Frame da animação segue a fase do golpe (preparo, golpe, recuperação).
      const phase = this.phase === 'done' ? 'recovery' : this.phase;
      drawSprite(ctx, this.anim.sprite, phaseFrameIndex(phase), x, this.y, this.facing < 0);
    } else if (this.state === S.KNOCKDOWN) {
      // Frame 0 = caindo (no ar), frame 1 = deitado.
      drawSprite(ctx, this.anim.sprite, this.airborne ? 0 : 1, x, this.y, this.facing < 0);
    } else {
      this.anim.draw(ctx, x, this.y, this.facing < 0);
    }
  }

  /** Linha de debug. */
  describe() {
    const f = this.facing > 0 ? '+1' : '-1';
    let extra = '';
    if (this.state === S.ATTACK && this.move) {
      extra = ` ${this.move.id}:${this.phase[0].toUpperCase()}${this.moveFrame}/${moveDuration(this.move)}`;
    } else if (this.stun > 0) {
      extra = ` stun${this.stun}`;
    }
    return `${this.state}${this.ko ? ' KO' : ''}${extra} x${Math.round(this.x)} y${Math.round(this.y)} f${f} hp${this.health}`;
  }
}
