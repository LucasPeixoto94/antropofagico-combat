// Golpes: resolução de dados, escolha do golpe pela ação do jogador e fases (startup/active/recovery).
import { BASIC_MOVES } from '../config.js';

/** Dados do golpe: padrão de BASIC_MOVES, com sobrescritas opcionais em `def.moves`. */
export function getMove(def, id) {
  const base = BASIC_MOVES[id];
  if (!base) throw new Error(`golpe desconhecido: ${id}`);
  const override = def.moves?.[id];
  return { ...base, ...(override || {}), id };
}

/**
 * Escolhe o golpe a partir dos botões recém-pressionados neste tick.
 * Chute vence soco quando os dois são apertados juntos (golpe mais específico vence).
 * @param {Object} actions ações lógicas do jogador
 * @param {{air: boolean, crouch?: boolean}} ctx
 * @returns {string|null} id do golpe
 */
export function pickMove(actions, { air, crouch = false }) {
  const punch = actions.pressed.punch;
  const kick = actions.pressed.kick;
  if (!punch && !kick) return null;
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
