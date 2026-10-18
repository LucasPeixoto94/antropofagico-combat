// Antropofágico Combat — configuração central.
// TODOS os números de balanceamento, resolução e tempo vivem aqui.
// Unidades: pixels da resolução interna e frames (ticks) a 60 FPS.

// ---- Mundo / resolução ----
export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;
/** Largura total do cenário (a câmera percorre). */
export const STAGE_WIDTH = 960;
/** Linha do chão (y dos pés). */
export const GROUND_Y = 230;
export const GRAVITY = 0.55;

// ---- Loop ----
export const FPS = 60;
export const STEP_MS = 1000 / FPS;
/** Máximo de passos lógicos por frame do navegador (evita "espiral da morte"). */
export const MAX_STEPS_PER_FRAME = 5;

// ---- Debug ----
export const DEBUG_DEFAULT = false;

// ---- Controles ----
// Códigos de tecla (KeyboardEvent.code). Direções são absolutas aqui;
// o lutador converte para forward/back conforme o lado em que está.
export const CONTROLS = Object.freeze({
  players: Object.freeze([
    Object.freeze({
      left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      punch: ['KeyF'], kick: ['KeyG'], block: ['KeyH'],
    }),
    Object.freeze({
      left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      punch: ['KeyJ', 'Numpad1'], kick: ['KeyK', 'Numpad2'], block: ['KeyL', 'Numpad3'],
    }),
  ]),
  confirm: ['Enter', 'NumpadEnter'],
  back: ['Escape'],
  debug: ['F1'],
});

// ---- Tela inicial ----
/** Meio ciclo do pisca-pisca de "Pressione ENTER" (30 = 0,5 s aceso, 0,5 s apagado). */
export const TITLE_BLINK_FRAMES = 30;
/** Duração do flash branco após ENTER. */
export const ENTER_FLASH_FRAMES = 8;
/** Tremor de tela ao apertar ENTER (testa os ganchos de FX do renderer). */
export const ENTER_SHAKE_INTENSITY = 2;
export const ENTER_SHAKE_FRAMES = 10;
/** Quantidade de vaga-lumes decorativos na tela inicial. */
export const TITLE_FIREFLIES = 14;

// ---- Sprites ----
/** Tamanho padrão de um frame de personagem (sprites finais devem seguir isso). */
export const CHAR_FRAME_WIDTH = 128;
export const CHAR_FRAME_HEIGHT = 128;
/** Pivô padrão: centro dos pés. */
export const CHAR_PIVOT = Object.freeze({ x: 64, y: 124 });

// ---- Movimento ----
/** Andar para trás é mais lento que para frente. */
export const BACK_WALK_MULTIPLIER = 0.8;
/** Velocidade horizontal no pulo diagonal (px/frame). */
export const JUMP_DRIFT = 2.4;
/** Altura agachado em relação à altura em pé (usado também nas hurtboxes, Etapa 4). */
export const CROUCH_HEIGHT_RATIO = 0.66;
/** Distância mínima em x para o lutador trocar de lado (evita "tremer" quando sobrepostos). */
export const FACING_DEADZONE = 2;

// ---- Limites e câmera ----
/** Distância mínima do lutador até a borda do cenário. */
export const STAGE_EDGE_MARGIN = 24;
/** Margem até a borda da TELA: os dois lutadores sempre cabem na câmera. */
export const SCREEN_EDGE_MARGIN = 28;
/** Suavização da câmera (0..1; 1 = segue instantâneo). */
export const CAMERA_LERP = 0.15;
/** Distância de cada lutador ao centro do cenário no início da luta. */
export const FIGHTER_START_OFFSET = 80;

// ---- Personagens ----
// Vida entra na Etapa 5.
export const CHARACTER_STATS = Object.freeze({
  saci: Object.freeze({ height: 100, walkSpeed: 2.6, jumpVelocity: -9.5 }),
  curupira: Object.freeze({ height: 112, walkSpeed: 2.1, jumpVelocity: -8.8 }),
});

// ---- Carregamento ----
/** Tempo máximo esperando a fonte pixel antes de cair no fallback monospace. */
export const FONT_LOAD_TIMEOUT_MS = 1500;
