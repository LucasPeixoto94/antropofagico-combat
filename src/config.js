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
export const CHARACTER_STATS = Object.freeze({
  saci: Object.freeze({ height: 100, maxHealth: 90, walkSpeed: 2.6, jumpVelocity: -9.5 }),
  curupira: Object.freeze({ height: 112, maxHealth: 110, walkSpeed: 2.1, jumpVelocity: -8.8 }),
});

// ---- Combate ----
/** Congelamento de ambos os lutadores quando um golpe acerta ou é defendido. */
export const HITSTOP_FRAMES = 5;
/** Fração do dano que passa quando o golpe é defendido (dano de "chip"; mínimo 1). */
export const BLOCK_DAMAGE_MULTIPLIER = 0.2;
/** Velocidade inicial de empurrão ao defender / ao ser acertado (decai com KNOCKBACK_FRICTION). */
export const BLOCK_PUSHBACK = 3;
export const HIT_KNOCKBACK = 5;
export const KNOCKBACK_FRICTION = 0.82;
/** Quanto tempo o lutador fica no chão depois de derrubado. */
export const KNOCKDOWN_FRAMES = 40;
/** Impulso vertical ao ser acertado no ar (pequeno "pop"). */
export const AIR_HIT_POP = -4;
/** Tremor de tela ao acertar (defesa não treme). */
export const HIT_SHAKE_INTENSITY = 2;
export const HIT_SHAKE_FRAMES = 6;

// ---- Caixas de colisão (AABB, relativas aos pés, olhando para a direita) ----
export const HURTBOX_WIDTH = 28;
/** Altura da hurtbox no ar, em relação à altura em pé. */
export const AIR_HURTBOX_RATIO = 0.8;
/** Altura de referência das hitboxes dos golpes; escalam com a altura do personagem. */
export const REF_HEIGHT = 100;

const move = (m) => Object.freeze({ ...m, hitbox: Object.freeze(m.hitbox) });

/**
 * Golpes básicos (ponto de partida; ajustar jogando). Personagens podem sobrescrever
 * campos em `moves` nos seus dados. Unidades: frames a 60 FPS e pixels.
 * stance: 'stand' | 'crouch' | 'air'
 */
export const BASIC_MOVES = Object.freeze({
  punch: move({
    stance: 'stand', startup: 4, active: 3, recovery: 8,
    damage: 6, hitstun: 14, blockstun: 9, hitbox: { x: 12, y: -70, w: 34, h: 14 },
  }),
  kick: move({
    stance: 'stand', startup: 6, active: 3, recovery: 12,
    damage: 9, hitstun: 18, blockstun: 11, hitbox: { x: 12, y: -50, w: 44, h: 16 },
  }),
  crouch_punch: move({
    stance: 'crouch', startup: 5, active: 3, recovery: 9,
    damage: 5, hitstun: 13, blockstun: 8, hitbox: { x: 12, y: -42, w: 32, h: 14 },
  }),
  crouch_kick: move({
    stance: 'crouch', startup: 7, active: 3, recovery: 14,
    damage: 7, hitstun: 20, blockstun: 10, knockdown: true, hitbox: { x: 12, y: -12, w: 48, h: 12 },
  }),
  air: move({
    stance: 'air', startup: 5, active: 6, recovery: 6,
    damage: 8, hitstun: 16, blockstun: 10, hitbox: { x: 10, y: -50, w: 40, h: 30 },
  }),
});

// ---- Carregamento ----
/** Tempo máximo esperando a fonte pixel antes de cair no fallback monospace. */
export const FONT_LOAD_TIMEOUT_MS = 1500;
