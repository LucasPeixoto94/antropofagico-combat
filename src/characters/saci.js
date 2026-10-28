// Saci — dados do personagem. O código de fighter.js é genérico; aqui só há dados.
import { CHARACTER_STATS, SPECIAL_MOVES } from '../config.js';
import { COMBAT_ANIMATIONS } from './common.js';

export default Object.freeze({
  id: 'saci',
  name: 'SACI',
  stats: CHARACTER_STATS.saci,
  // Animações por estado (spritesheet assets/characters/saci/<estado>.png).
  animations: Object.freeze({
    idle: { frames: 6, fps: 8, loop: true },
    walk_fwd: { frames: 6, fps: 12, loop: true },
    walk_back: { frames: 6, fps: 10, loop: true },
    jump: { frames: 4, fps: 8, loop: false },
    crouch: { frames: 2, fps: 12, loop: false },
    ...COMBAT_ANIMATIONS,
    attack_redemoinho: { frames: 3, fps: 12, loop: false },
    attack_sumico: { frames: 3, fps: 10, loop: false },
  }),
  // Sobrescritas opcionais dos golpes básicos (ver BASIC_MOVES em config.js).
  moves: Object.freeze({}),
  // Golpes especiais acionados por sequência no inputBuffer.
  specials: Object.freeze([
    SPECIAL_MOVES.redemoinho,
    SPECIAL_MOVES.sumico,
  ]),
});
