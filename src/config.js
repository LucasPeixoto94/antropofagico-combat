// Antropofágico Combat — configuração central.
// TODOS os números de balanceamento, resolução e tempo vivem aqui.
// Unidades: pixels da resolução interna e frames (ticks) a 60 FPS.

// ---- Mundo / resolução ----
export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

// ---- Loop ----
export const FPS = 60;
export const STEP_MS = 1000 / FPS;
/** Máximo de passos lógicos por frame do navegador (evita "espiral da morte"). */
export const MAX_STEPS_PER_FRAME = 5;

// ---- Debug ----
export const DEBUG_DEFAULT = false;

// ---- Tela inicial ----
/** Meio ciclo do pisca-pisca de "Pressione ENTER" (30 = 0,5 s aceso, 0,5 s apagado). */
export const TITLE_BLINK_FRAMES = 30;
/** Duração da mensagem de feedback após ENTER. */
export const ENTER_FEEDBACK_FRAMES = 90;
/** Duração do flash branco após ENTER. */
export const ENTER_FLASH_FRAMES = 8;
/** Quantidade de vaga-lumes decorativos na tela inicial. */
export const TITLE_FIREFLIES = 14;

// ---- Carregamento ----
/** Tempo máximo esperando a fonte pixel antes de cair no fallback monospace. */
export const FONT_LOAD_TIMEOUT_MS = 1500;
