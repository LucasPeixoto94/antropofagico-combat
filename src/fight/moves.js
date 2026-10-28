// Golpes: resolução de dados, escolha do golpe pela ação do jogador e fases (startup/active/recovery).
import { BASIC_MOVES } from '../config.js';

/**
 * Dados do golpe: procura primeiro nos especiais do personagem (`def.specials`),
 * depois em `BASIC_MOVES` (com sobrescritas opcionais em `def.moves`).
 */
export function getMove(def, id) {
  const special = def?.specials?.find((s) => s.id === id);
  if (special) return special;
  const base = BASIC_MOVES[id];
  if (!base) throw new Error(`golpe desconhecido: ${id}`);
  const override = def?.moves?.[id];
  return { ...base, ...(override || {}), id };
}

/**
 * Escolhe o golpe a partir dos botões recém-pressionados neste tick.
 * Prioridade explícita:
 * 1) Especial reconhecido pelo InputBuffer (só no chão) vence qualquer golpe básico.
 * 2) Entre golpes básicos, chute vence soco quando apertados juntos.
 * @param {Object} actions ações lógicas do jogador
 * @param {{air: boolean, crouch?: boolean, buffer?: import('../core/inputBuffer.js').InputBuffer, specials?: readonly Object[]}} ctx
 * @returns {string|null} id do golpe
 */
export function pickMove(actions, { air, crouch = false, buffer = null, specials = null }) {
  const punch = actions.pressed.punch;
  const kick = actions.pressed.kick;
  if (!punch && !kick) return null;

  if (!air && buffer && specials && specials.length > 0) {
    const sp = buffer.matchSpecials(specials);
    if (sp) return sp.id;
  }

  if (air) return 'air';
  if (crouch) return kick ? 'crouch_kick' : 'crouch_punch';
  return kick ? 'kick' : 'punch';
}

export const moveDuration = (m) => m.startup + m.active + m.recovery;

/** @returns {'startup'|'active'|'recovery'|'done'} */
export function movePhase(m, frame) {
  if (frame < m.startup) return 'startup';
  if (frame < m.startup + m.active) return 'active';
  if (frame < moveDuration(m)) return 'recovery';
  return 'done';
}

/** Índice do frame da animação do golpe (3 frames: preparo, golpe, recuperação). */
export function phaseFrameIndex(phase) {
  return phase === 'startup' ? 0 : phase === 'active' ? 1 : 2;
}
