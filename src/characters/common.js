// Animações de combate compartilhadas pelos personagens (mesma estrutura de frames).
// Cada golpe tem 3 frames: preparo (startup), golpe (active) e recuperação (recovery);
// o frame exibido segue a fase do golpe, então fps não importa para eles.
const attack = { frames: 3, fps: 8, loop: false };

export const COMBAT_ANIMATIONS = Object.freeze({
  attack_punch: attack,
  attack_kick: attack,
  attack_crouch_punch: attack,
  attack_crouch_kick: attack,
  attack_air: attack,
  block: { frames: 2, fps: 8, loop: true },
  crouch_block: { frames: 2, fps: 8, loop: true },
  hitstun: { frames: 2, fps: 8, loop: true },
  knockdown: { frames: 2, fps: 6, loop: false },
  victory: { frames: 2, fps: 3, loop: true },
});
