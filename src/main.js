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
} from './config.js';
import { CHARACTERS } from './characters/index.js';

async function waitForFont() {
  if (!document.fonts || !document.fonts.load) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));
  try {
    await Promise.race([document.fonts.load('8px "Press Start 2P"'), timeout]);
  } catch {
    // Sem fonte: o canvas cai para monospace.
  }
}

/** Todos os sprites de todos os personagens, a partir dos dados em characters/*.js. */
function spriteManifest() {
  const list = [];
  for (const def of Object.values(CHARACTERS)) {
    for (const [state, anim] of Object.entries(def.animations)) {
      list.push({
        key: `${def.id}/${state}`,
        base: `assets/characters/${def.id}/${state}`,
        spec: {
          frameWidth: CHAR_FRAME_WIDTH,
          frameHeight: CHAR_FRAME_HEIGHT,
          pivot: { ...CHAR_PIVOT },
          ...anim,
          placeholder: { name: def.name, state, kind: def.id, height: def.stats.height, pose: state },
        },
      });
    }
  }
  return list;
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
