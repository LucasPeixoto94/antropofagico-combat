// Curupira — dados do personagem.
import { CHARACTER_STATS, SPECIAL_MOVES } from '../config.js';
import { COMBAT_ANIMATIONS } from './common.js';

export default Object.freeze({
  id: 'curupira',
  name: 'CURUPIRA',
  stats: CHARACTER_STATS.curupira,
  animations: Object.freeze({
    idle: { frames: 6, fps: 8, loop: true },
    walk_fwd: { frames: 6, fps: 10, loop: true },
    walk_back: { frames: 6, fps: 8, loop: true },
    jump: { frames: 4, fps: 8, loop: false },
    crouch: { frames: 2, fps: 12, loop: false },
    ...COMBAT_ANIMATIONS,
    attack_fogo_do_cabelo: { frames: 3, fps: 10, loop: false },
    attack_pegada_invertida: { frames: 3, fps: 12, loop: false },
  }),
  moves: Object.freeze({}),
  specials: Object.freeze([
    SPECIAL_MOVES.fogo_do_cabelo,
    SPECIAL_MOVES.pegada_invertida,
  ]),
});
