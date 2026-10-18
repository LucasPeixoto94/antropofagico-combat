// Bootstrap: carrega fonte e assets, cria o Game e inicia o loop de passo fixo.
import { Game } from './core/game.js';
import { Loop } from './core/loop.js';
import { Renderer } from './core/renderer.js';
import { Assets } from './core/assets.js';
import {
  FONT_LOAD_TIMEOUT_MS,
  CHAR_FRAME_WIDTH,
  CHAR_FRAME_HEIGHT,
  CHAR_PIVOT,
  CHARACTER_STATS,
} from './config.js';

async function waitForFont() {
  if (!document.fonts || !document.fonts.load) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));
  try {
    await Promise.race([document.fonts.load('8px "Press Start 2P"'), timeout]);
  } catch {
    // Sem fonte: o canvas cai para monospace.
  }
}

/** Sprites usados até agora. A partir da Etapa 3 a lista vem dos dados dos personagens. */
function spriteManifest() {
  const idle = (id, name) => ({
    key: `${id}/idle`,
    base: `assets/characters/${id}/idle`,
    spec: {
      frameWidth: CHAR_FRAME_WIDTH,
      frameHeight: CHAR_FRAME_HEIGHT,
      frames: 6,
      fps: 8,
      loop: true,
      pivot: { ...CHAR_PIVOT },
      placeholder: { name, state: 'idle', kind: id, height: CHARACTER_STATS[id].height },
    },
  });
  return [idle('saci', 'SACI'), idle('curupira', 'CURUPIRA')];
}

async function boot() {
  const canvas = document.getElementById('game');
  await waitForFont(); // antes dos placeholders, que escrevem texto
  const renderer = new Renderer(canvas);
  const assets = new Assets();
  await assets.loadAll(spriteManifest());

  const game = new Game(renderer, assets);
  const loop = new Loop(game);
  game.loop = loop; // permite ao debug ler as estatísticas do loop
  loop.start();
  canvas.focus();
  // Exposto apenas para depuração no console.
  window.__game = game;
}

boot();
