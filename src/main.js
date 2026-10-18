// Bootstrap: cria o Game e inicia o loop de passo fixo.
import { Game } from './core/game.js';
import { Loop } from './core/loop.js';
import { FONT_LOAD_TIMEOUT_MS } from './config.js';

async function waitForFont() {
  if (!document.fonts || !document.fonts.load) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS));
  try {
    await Promise.race([document.fonts.load('8px "Press Start 2P"'), timeout]);
  } catch {
    // Sem fonte: o canvas cai para monospace.
  }
}

async function boot() {
  const canvas = document.getElementById('game');
  await waitForFont();
  const game = new Game(canvas);
  const loop = new Loop(game);
  game.loop = loop; // permite ao debug ler as estatísticas do loop
  loop.start();
  canvas.focus();
  // Exposto apenas para depuração no console.
  window.__game = game;
}

boot();
