// Teste end-to-end no navegador (Edge/Chrome headless via DevTools Protocol), sem dependências.
// Joga uma partida completa com eventos de teclado reais e confere o estado do jogo via window.__game.
//
// Rodar:  node tests/e2e.mjs
// (opcional) BROWSER="C:\caminho\para\chrome.exe" node tests/e2e.mjs
// Screenshots vão para tests/output/.
//
// O loop do jogo (requestAnimationFrame) é desligado durante o teste e os ticks são avançados
// manualmente com game.update(): o teste fica determinístico e rápido.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'output');
const DEBUG_PORT = 9333;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

// ---------------------------------------------------------------------------
// Infra: servidor estático, navegador, CDP
// ---------------------------------------------------------------------------
function startServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function findBrowser() {
  const candidates = [
    process.env.BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('Navegador não encontrado; defina a variável BROWSER.');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, what, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      // ainda não está pronto
    }
    await sleep(100);
  }
  throw new Error(`Timeout esperando ${what}`);
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    };
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(fn) {
    this.listeners.push(fn);
  }

  close() {
    this.ws.close();
  }
}

// ---------------------------------------------------------------------------
// Helpers de jogo
// ---------------------------------------------------------------------------
const KEYS = {
  Enter: { key: 'Enter', vk: 13 },
  Escape: { key: 'Escape', vk: 27 },
  ArrowUp: { key: 'ArrowUp', vk: 38 },
  ArrowDown: { key: 'ArrowDown', vk: 40 },
  ArrowLeft: { key: 'ArrowLeft', vk: 37 },
  ArrowRight: { key: 'ArrowRight', vk: 39 },
  KeyA: { key: 'a', vk: 65 },
  KeyD: { key: 'd', vk: 68 },
  KeyS: { key: 's', vk: 83 },
  KeyF: { key: 'f', vk: 70 },
  KeyG: { key: 'g', vk: 71 },
  KeyJ: { key: 'j', vk: 74 },
  KeyK: { key: 'k', vk: 75 },
};

function makeHelpers(cdp) {
  async function js(expression) {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error(`Erro no navegador: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    }
    return r.result.value;
  }
  const step = (n = 1) => js(`(() => { for (let i = 0; i < ${n}; i++) __game.update(); })()`);
  async function keyEvent(type, code) {
    const k = KEYS[code];
    await cdp.send('Input.dispatchKeyEvent', {
      type, code, key: k.key, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk,
    });
  }
  /** Segura a tecla por `ticks` ticks (padrão: um toque de 1 tick). */
  async function press(code, ticks = 1) {
    await keyEvent('keyDown', code);
    await step(ticks);
    await keyEvent('keyUp', code);
  }
  /** Segura várias teclas simultaneamente por `ticks` ticks. */
  async function chord(codes, ticks = 1) {
    for (const c of codes) await keyEvent('keyDown', c);
    await step(ticks);
    for (const c of codes) await keyEvent('keyUp', c);
  }
  /** Avança ticks até a condição (expressão JS) ser verdadeira. */
  async function stepUntil(cond, max = 2000) {
    for (let i = 0; i < max; i++) {
      if (await js(cond)) return i;
      await step(1);
    }
    throw new Error(`Condição não atingida em ${max} ticks: ${cond}`);
  }
  async function shot(name) {
    await js('__game.render()');
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  }
  return { js, step, press, chord, stepUntil, shot };
}

// Expressões curtas reutilizadas
const F = '__game.states.FIGHTING';
const M = `${F}.match`;

// ---------------------------------------------------------------------------
// Cenário
// ---------------------------------------------------------------------------
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  ✖ ${name}\n      ${err.message}`);
    throw err; // os passos dependem uns dos outros
  }
}

async function scenario(h) {
  const { js, step, press, chord, stepUntil, shot } = h;

  await check('tela de título carregou', async () => {
    assert.equal(await js('__game.stateName'), 'TITLE');
    await shot('01-titulo');
  });

  await check('ENTER inicia a partida no ROUND 1 (introdução)', async () => {
    await press('Enter');
    assert.equal(await js('__game.stateName'), 'FIGHTING');
    assert.equal(await js(`${M}.phase`), 'ROUND_INTRO');
    assert.equal(await js(`${M}.round`), 1);
    assert.deepEqual(await js(`${M}.wins`), [0, 0]);
  });

  await check('controles travados durante a introdução', async () => {
    const x0 = await js(`${F}.p1.x`);
    await press('KeyD', 30);
    assert.equal(await js(`${F}.p1.x`), x0);
    await shot('02-round1');
  });

  await check('"FIGHT!" libera a luta e o timer começa em 60', async () => {
    await stepUntil(`${M}.phase === 'FIGHTING'`);
    assert.equal(await js(`${M}.secondsLeft`), 60);
    const x0 = await js(`${F}.p1.x`);
    await press('KeyD', 20);
    assert.ok((await js(`${F}.p1.x`)) > x0, 'P1 deveria andar para a direita');
  });

  await check('Especiais Saci: Redemoinho (↓ → + P) e Sumiço (↓ ← + K)', async () => {
    // Posiciona Saci a 75 px do Curupira e executa ↓ → + F (Redemoinho)
    await js(`(() => { const f = ${F}; f.p1.x = 400; f.p2.x = 475; f.p2.health = 110; })()`);
    await press('KeyS', 2);
    await chord(['KeyD', 'KeyF'], 1);
    assert.equal(await js(`${F}.p1.move?.id`), 'redemoinho');
    assert.equal(await js(`${F}.p1.inputBuffer.lastSpecial`), 'redemoinho');
    await step(12);
    await shot('03a-saci-redemoinho');
    await stepUntil(`${F}.p1.state === 'idle' && ${F}.p2.state === 'idle'`, 200);
    assert.equal(await js(`${F}.p2.health`), 110 - 12);

    // Sumiço (↓ ← + G): Saci reaparece atrás do Curupira (x > p2.x) e olha para a esquerda
    const p2x = await js(`${F}.p2.x`);
    await press('KeyS', 2);
    await chord(['KeyA', 'KeyG'], 1);
    assert.equal(await js(`${F}.p1.move?.id`), 'sumico');
    await stepUntil(`${F}.p1.state === 'idle'`, 100);
    assert.ok((await js(`${F}.p1.x`)) > p2x, 'Saci deveria ter teleportado para a direita do Curupira');
    assert.equal(await js(`${F}.p1.facing`), -1);
  });

  await check('Especiais Curupira: Fogo do Cabelo (↓ → + P) e Pegada Invertida (↓ ← + K)', async () => {
    // Reposiciona P1 à esquerda e P2 à direita (facing = -1, então forward de P2 = ArrowLeft)
    await js(`(() => { const f = ${F}; f.p1.x = 380; f.p2.x = 500; f.p1.health = 90; })()`);
    await step(2);
    await press('ArrowDown', 2);
    await chord(['ArrowLeft', 'KeyJ'], 1);
    assert.equal(await js(`${F}.p2.move?.id`), 'fogo_do_cabelo');
    await stepUntil(`${F}.projectiles.length === 1`, 40);
    await shot('03b-curupira-fogo');
    await stepUntil(`${F}.p1.health < 90`, 100);
    assert.equal(await js(`${F}.p1.health`), 90 - 10);
    await stepUntil(`${F}.p1.state === 'idle' && ${F}.p2.state === 'idle'`, 150);

    // Pegada Invertida (↓ ← + K; para P2 olhando para a esquerda, back = ArrowRight)
    await js(`(() => { const f = ${F}; f.p1.x = 420; f.p2.x = 490; })()`);
    await step(2);
    await press('ArrowDown', 2);
    await chord(['ArrowRight', 'KeyK'], 1);
    assert.equal(await js(`${F}.p2.move?.id`), 'pegada_invertida');
    await stepUntil(`${F}.p1.state === 'knockdown'`, 60);
    assert.equal(await js(`${F}.p1.health`), 80 - 11);
    await stepUntil(`${F}.p1.state === 'idle' && ${F}.p2.state === 'idle'`, 200);
  });

  await check('K.O. no round 1: Curupira cai e Saci pontua', async () => {
    await js(`(() => { const f = ${F}; f.p2.health = 1; f.p1.x = f.p2.x - 40; f.p1.kb = 0; })()`);
    await press('KeyF');
    await step(30);
    assert.equal(await js(`${F}.p2.ko`), true);
    assert.equal(await js(`${M}.phase`), 'ROUND_END');
    assert.deepEqual(await js(`${M}.result`), { reason: 'ko', winner: 0 });
    assert.deepEqual(await js(`${M}.wins`), [1, 0]);
    await shot('03-ko');
  });

  await check('vencedor do round faz a pose de vitória', async () => {
    await stepUntil(`${F}.p1.state === 'victory'`, 300);
    assert.equal(await js(`${M}.phase`), 'ROUND_END');
    await step(10);
    await shot('04-saci-vence');
  });

  await check('round 2 começa com tudo resetado', async () => {
    await js(`window.__oldP1 = ${F}.p1`);
    await stepUntil(`${M}.phase === 'ROUND_INTRO'`, 400);
    assert.equal(await js(`${M}.round`), 2);
    assert.equal(await js(`${F}.p2.health`), 110);
    assert.equal(await js(`${F}.p2.ko`), false);
    assert.equal(await js(`${F}.p1.state`), 'idle');
    assert.equal(await js(`${F}.p1 !== window.__oldP1`), true);
    assert.equal(await js(`${F}.hitstop`), 0);
    assert.equal(await js(`${M}.timeLeft`), 3600);
  });

  await check('ESC pausa: nada anda durante a pausa', async () => {
    await stepUntil(`${M}.phase === 'FIGHTING'`);
    await step(30);
    await js(`window.__p1 = ${F}.p1`);
    const t = await js(`${M}.timeLeft`);
    await press('Escape');
    assert.equal(await js('__game.stateName'), 'PAUSED');
    await step(120);
    assert.equal(await js(`${M}.timeLeft`), t);
    await press('ArrowDown');
    assert.equal(await js('__game.states.PAUSED.selected'), 1);
    await press('ArrowUp');
    assert.equal(await js('__game.states.PAUSED.selected'), 0);
    await shot('05-pausa');
  });

  await check('ESC retoma do mesmo ponto (mesmos lutadores, mesmo timer)', async () => {
    const t = await js(`${M}.timeLeft`);
    await press('Escape');
    assert.equal(await js('__game.stateName'), 'FIGHTING');
    assert.equal(await js(`${F}.p1 === window.__p1`), true);
    // O tick do ESC não conta; o seguinte já anda.
    assert.equal(await js(`${M}.timeLeft`), t);
    await step(1);
    assert.equal(await js(`${M}.timeLeft`), t - 1);
  });

  await check('tempo esgotado no round 2: vence quem tem mais vida (Curupira)', async () => {
    await js(`(() => { ${M}.timeLeft = 3; ${F}.p1.health = 30; })()`);
    await step(5);
    assert.equal(await js(`${M}.phase`), 'ROUND_END');
    assert.deepEqual(await js(`${M}.result`), { reason: 'time', winner: 1 });
    assert.deepEqual(await js(`${M}.wins`), [1, 1]);
    await shot('06-tempo');
  });

  await check('1-1 leva ao ROUND FINAL', async () => {
    await stepUntil(`${M}.phase === 'ROUND_INTRO'`, 400);
    assert.equal(await js(`${M}.round`), 3);
    assert.equal(await js(`${M}.isFinalRound`), true);
    await step(20);
    await shot('07-round-final');
  });

  await check('K.O. no round 3: Curupira vence a partida', async () => {
    await stepUntil(`${M}.phase === 'FIGHTING'`);
    await js(`(() => { const f = ${F}; f.p1.health = 1; f.p2.x = f.p1.x + 40; f.p2.kb = 0; })()`);
    await press('KeyJ');
    await step(30);
    assert.equal(await js(`${F}.p1.ko`), true);
    assert.equal(await js(`${M}.winner`), 1);
    await stepUntil(`${M}.phase === 'MATCH_END'`, 400);
  });

  await check('tela de vitória ignora ENTER no começo e depois volta ao título', async () => {
    await press('Enter');
    assert.equal(await js('__game.stateName'), 'FIGHTING');
    await step(70);
    await shot('08-fim-de-partida');
    await press('Enter');
    assert.equal(await js('__game.stateName'), 'TITLE');
  });

  await check('nova partida começa zerada; pausa > SAIR volta ao título', async () => {
    await press('Enter');
    assert.equal(await js(`${M}.round`), 1);
    assert.deepEqual(await js(`${M}.wins`), [0, 0]);
    await press('Escape');
    await press('ArrowDown');
    await press('Enter');
    assert.equal(await js('__game.stateName'), 'TITLE');
  });
}

// ---------------------------------------------------------------------------
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const appUrl = `http://127.0.0.1:${server.address().port}/`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'antropofagico-e2e-'));
  const browser = spawn(findBrowser(), [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=960,540',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });

  const errors = [];
  let cdp;
  try {
    const page = await waitFor(async () => {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      return list.find((t) => t.type === 'page');
    }, 'o navegador abrir');

    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.ready;
    cdp.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: appUrl });

    const h = makeHelpers(cdp);
    await waitFor(() => h.js('!!window.__game'), 'o jogo carregar');
    // Desliga o loop de tempo real: o teste controla os ticks.
    await h.js('__game.loop.running = false');

    console.log(`E2E em ${appUrl}`);
    await scenario(h);

    await check('nenhum erro de JavaScript no console', async () => {
      assert.deepEqual(errors, []);
    });
  } finally {
    cdp?.close();
    browser.kill();
    server.close();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passaram. Screenshots em tests/output/`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

