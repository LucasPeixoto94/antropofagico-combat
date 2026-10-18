// Curupira — dados do personagem (parcial; completado na Etapa 5).
import { CHARACTER_STATS } from '../config.js';

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
  }),
});
