// Cenário: Mata Atlântica ao entardecer.
// 7 camadas com parallax (céu → serra → mata distante → cachoeira → árvores próximas → chão → folhagem da frente).
// Cada camada é desenhada proceduralmente UMA vez num canvas offscreen; se existir
// assets/stages/mataAtlantica/<camada>.png, o PNG substitui a camada sem mudar código.
import {
  INTERNAL_WIDTH as W,
  INTERNAL_HEIGHT as H,
  STAGE_WIDTH,
  GROUND_Y,
  STAGE_SEED,
  STAGE_PARALLAX,
  WATERFALL_SPEED,
  WATERFALL_SPRAY_PER_TICK,
} from '../config.js';
import { PALETTE as P } from '../palette.js';
import { Rng } from '../core/rng.js';
import { AmbientFx } from '../render/fx.js';

// Layout da cachoeira (px dentro da camada "waterfall").
const FALL_X = 336;
const FALL_W = 26;
const FALL_TOP = 86;
const FALL_BOTTOM = 196;
/** Período vertical da textura da água (a textura repete a cada FALL_PERIOD px). */
const FALL_PERIOD = 16;

// ---------------------------------------------------------------------------
// Matemática do parallax (sem DOM; testável)
// ---------------------------------------------------------------------------
/** Largura que uma camada precisa ter para cobrir toda a viagem da câmera. */
export function layerWidth(parallax) {
  return Math.ceil(W + (STAGE_WIDTH - W) * parallax);
}

/** Deslocamento horizontal da camada para a posição de câmera dada. */
export function layerOffset(camX, parallax) {
  return Math.round(camX * parallax);
}

// ---------------------------------------------------------------------------
// Helpers de desenho em pixel art
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Degradê em faixas (visual de pixel art, sem suavização). stops: [[pos 0..1, cor], ...] */
function bandGradient(ctx, x, y, w, h, stops, band = 3) {
  for (let yy = 0; yy < h; yy += band) {
    const t = yy / h;
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    const local = Math.min(1, Math.max(0, (t - p0) / (p1 - p0)));
    // Quantiza em 4 passos por trecho, para as faixas ficarem visíveis.
    ctx.fillStyle = lerpColor(c0, c1, Math.round(local * 4) / 4);
    ctx.fillRect(x, y + yy, w, band);
  }
}

/** Círculo cheio desenhado por linhas (bordas em degrau). */
function pixelCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

/** Silhueta preenchida até o fundo a partir de uma função de altura y(x). */
function fillRidge(ctx, w, h, yAt, color, rim = null, step = 2) {
  let prev = yAt(0);
  for (let x = 0; x < w; x += step) {
    const y = Math.round(yAt(x));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, step, h - y);
    if (rim && y < prev) {
      // Encosta "subindo" para a direita recebe luz do poente (borda clara).
      ctx.fillStyle = rim;
      ctx.fillRect(x, y, step, 1);
    }
    prev = y;
  }
}

// ---------------------------------------------------------------------------
// Camadas procedurais. Assinatura: (ctx, w, h, rng)
// ---------------------------------------------------------------------------
function drawSky(ctx, w, h, rng) {
  bandGradient(ctx, 0, 0, w, h, [
    [0, P.stSkyTop],
    [0.35, P.stSkyMid],
    [0.55, P.stSkyLow],
    [0.68, P.stSkyHorizon],
    [0.78, P.stSkyGlow],
    [1, P.stSkyGlow],
  ]);

  // Estrelas só na parte escura do céu.
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, w - 1);
    const y = rng.int(2, 95);
    const bright = rng.chance(0.2);
    ctx.fillStyle = bright ? P.stStar : P.stStarDim;
    ctx.fillRect(x, y, 1, 1);
    if (bright && rng.chance(0.4)) {
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }

  // Lua com halo e crateras.
  const mx = Math.round(w * 0.74);
  const my = 44;
  pixelCircle(ctx, mx, my, 22, P.stMoonGlow);
  pixelCircle(ctx, mx, my, 16, P.stMoonGlow);
  pixelCircle(ctx, mx, my, 11, P.stMoon);
  ctx.fillStyle = P.stMoonShade;
  ctx.fillRect(mx - 5, my - 3, 3, 3);
  ctx.fillRect(mx + 2, my + 2, 4, 3);
  ctx.fillRect(mx - 2, my + 5, 2, 2);
  ctx.fillRect(mx + 4, my - 6, 2, 2);
}

function drawMountains(ctx, w, h, rng) {
  // Serra do Mar: picos agudos (|sin| invertido) somados a ondulações suaves.
  const p = Array.from({ length: 6 }, () => rng.range(0, Math.PI * 2));
  const peak = (x, f, ph) => 1 - Math.abs(Math.sin(x * f + ph));
  const far = (x) => 168 - 46 * peak(x, 0.006, p[0]) - 18 * Math.sin(x * 0.017 + p[1]) - 6 * Math.sin(x * 0.05 + p[2]);
  const near = (x) => 188 - 34 * peak(x, 0.009, p[3]) - 12 * Math.sin(x * 0.023 + p[4]) - 4 * Math.sin(x * 0.07 + p[5]);

  fillRidge(ctx, w, h, far, P.stMountainFar, P.stMountainFarRim);
  // Bruma quente do poente separando as duas cadeias (perspectiva atmosférica).
  ctx.fillStyle = P.stHaze;
  ctx.fillRect(0, 150, w, 40);
  fillRidge(ctx, w, h, near, P.stMountainNear, P.stMountainNearRim);
}

function drawTreeCrown(ctx, x, y, r, base, light, dark) {
  pixelCircle(ctx, x, y + 2, r, dark);
  pixelCircle(ctx, x, y, r, base);
  pixelCircle(ctx, x - Math.round(r * 0.35), y - Math.round(r * 0.35), Math.max(1, Math.round(r * 0.45)), light);
}

function drawPalm(ctx, x, baseY, height, trunkColor, leafColor) {
  // Palmito-juçara: tronco fino e reto com leque de folhas no topo.
  ctx.fillStyle = trunkColor;
  ctx.fillRect(x, baseY - height, 1, height);
  const top = baseY - height;
  ctx.fillStyle = leafColor;
  for (const [dx, dy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
    for (let k = 1; k <= 7; k++) {
      ctx.fillRect(x + dx * k, top + dy * Math.floor(k * k / 10) - (dy ? 0 : 1), 1, 1);
    }
  }
  ctx.fillRect(x - 1, top - 2, 3, 2);
}

function drawAraucaria(ctx, x, baseY, height, color) {
  // Araucária: tronco reto e copa em "taça" com andares de galhos.
  ctx.fillStyle = color;
  ctx.fillRect(x, baseY - height, 2, height);
  const top = baseY - height;
  for (let tier = 0; tier < 3; tier++) {
    const y = top + tier * 5;
    const half = 14 - tier * 3;
    ctx.fillRect(x - half, y, half * 2 + 2, 2);
    ctx.fillRect(x - half - 2, y - 2, 3, 2);
    ctx.fillRect(x + half + 1, y - 2, 3, 2);
  }
}

function drawFarTrees(ctx, w, h, rng) {
  // Palmeiras e araucárias aparecendo acima do dossel.
  for (let x = rng.int(20, 60); x < w; x += rng.int(50, 110)) {
    if (rng.chance(0.3)) drawAraucaria(ctx, x, 172, rng.int(40, 55), P.stFarTreeDark);
    else drawPalm(ctx, x, 172, rng.int(32, 48), P.stFarTreeDark, P.stFarTree);
  }
  // Dossel contínuo de copas arredondadas.
  for (let x = -10; x < w + 10; x += rng.int(8, 15)) {
    drawTreeCrown(ctx, x, 172 + rng.int(-8, 5), rng.int(8, 15), P.stFarTree, P.stFarTreeLight, P.stFarTreeDark);
  }
  ctx.fillStyle = P.stFarTree;
  ctx.fillRect(0, 176, w, h - 176);
  ctx.fillStyle = P.stFarTreeDark;
  ctx.fillRect(0, 196, w, h - 196);
}

function drawWaterfallLayer(ctx, w, h, rng) {
  // Árvores intermediárias espalhadas (fora da área do penhasco).
  for (let x = rng.int(10, 40); x < w; x += rng.int(70, 130)) {
    if (x > FALL_X - 90 && x < FALL_X + FALL_W + 90) continue;
    const top = rng.int(128, 150);
    ctx.fillStyle = P.stTrunkDark;
    ctx.fillRect(x - 2, top, 4, 210 - top);
    drawTreeCrown(ctx, x, top, rng.int(14, 20), P.stMidTree, P.stMidTreeLight, P.stFarTreeDark);
    drawTreeCrown(ctx, x + rng.int(-14, 14), top + 8, rng.int(10, 14), P.stMidTree, P.stMidTreeLight, P.stFarTreeDark);
  }

  // Penhasco de pedra com a cachoeira no meio.
  const left = FALL_X - 70;
  const right = FALL_X + FALL_W + 64;
  const phase = rng.range(0, Math.PI * 2);
  for (let x = left; x < right; x += 2) {
    const edge = Math.min(x - left, right - x);
    const slope = Math.max(0, 28 - edge) * 1.6; // bordas arredondadas
    const top = Math.round(FALL_TOP - 4 + slope + 5 * Math.sin(x * 0.11 + phase) + rng.int(-1, 1));
    ctx.fillStyle = P.stCliff;
    ctx.fillRect(x, top, 2, 212 - top);
    ctx.fillStyle = P.stCliffLight;
    ctx.fillRect(x, top, 2, 2);
  }
  // Estratos da rocha.
  for (let i = 0; i < 26; i++) {
    const y = rng.int(FALL_TOP + 8, 200);
    const x = rng.int(left + 6, right - 30);
    ctx.fillStyle = rng.chance(0.6) ? P.stCliffDark : P.stCliffLight;
    ctx.fillRect(x, y, rng.int(8, 24), 1);
  }
  // Musgo escorrendo.
  for (let i = 0; i < 14; i++) {
    const x = rng.int(left + 4, right - 6);
    ctx.fillStyle = P.stMoss;
    ctx.fillRect(x, rng.int(FALL_TOP + 2, FALL_TOP + 30), 2, rng.int(4, 16));
  }
  // Canal escuro onde a água cai (a água animada é desenhada por cima a cada frame).
  ctx.fillStyle = P.stCliffDark;
  ctx.fillRect(FALL_X - 2, FALL_TOP - 4, FALL_W + 4, FALL_BOTTOM - FALL_TOP + 6);
  // Vegetação no alto do penhasco.
  for (let x = left; x < right; x += rng.int(10, 16)) {
    if (x > FALL_X - 6 && x < FALL_X + FALL_W + 2) continue;
    drawTreeCrown(ctx, x, FALL_TOP - 6 + rng.int(-3, 3), rng.int(7, 11), P.stMidTree, P.stMidTreeLight, P.stFarTreeDark);
  }
  // Poço na base.
  ctx.fillStyle = P.stPool;
  ctx.fillRect(FALL_X - 34, FALL_BOTTOM - 2, FALL_W + 68, 10);
  ctx.fillRect(FALL_X - 26, FALL_BOTTOM - 4, FALL_W + 52, 2);
  ctx.fillStyle = P.stPoolLight;
  for (let i = 0; i < 8; i++) ctx.fillRect(rng.int(FALL_X - 30, FALL_X + FALL_W + 22), rng.int(FALL_BOTTOM, FALL_BOTTOM + 6), rng.int(3, 8), 1);
}

function drawFern(ctx, x, baseY, size, color, light) {
  for (let k = -3; k <= 3; k++) {
    const len = size - Math.abs(k) * 2;
    for (let i = 0; i < len; i++) {
      ctx.fillStyle = i % 3 === 0 ? light : color;
      ctx.fillRect(x + k * Math.round(i / 2), baseY - i + Math.round((i * i * Math.abs(k)) / (size * 4)), 1, 1);
    }
  }
}

function drawBromelia(ctx, x, y) {
  ctx.fillStyle = P.stBromeliaLeaf;
  ctx.fillRect(x - 4, y, 9, 2);
  ctx.fillRect(x - 6, y - 2, 3, 2);
  ctx.fillRect(x + 4, y - 2, 3, 2);
  ctx.fillRect(x - 2, y - 2, 5, 2);
  ctx.fillStyle = P.stBromelia;
  ctx.fillRect(x, y - 5, 2, 4);
  ctx.fillRect(x - 1, y - 4, 1, 2);
}

function drawNearTrees(ctx, w, h, rng) {
  const trunks = [];
  for (let x = rng.int(10, 50); x < w; x += rng.int(90, 150)) trunks.push(x);

  for (const x of trunks) {
    const tw = rng.int(10, 18);
    ctx.fillStyle = P.stTrunk;
    ctx.fillRect(x, 0, tw, GROUND_Y + 2);
    ctx.fillStyle = P.stTrunkLight;
    ctx.fillRect(x + 1, 0, 2, GROUND_Y + 2);
    ctx.fillStyle = P.stTrunkDark;
    ctx.fillRect(x + tw - 3, 0, 3, GROUND_Y + 2);
    // Casca
    for (let i = 0; i < 12; i++) ctx.fillRect(x + rng.int(3, tw - 5), rng.int(30, GROUND_Y - 6), rng.int(2, 4), 1);
    // Raízes tabulares
    ctx.fillStyle = P.stTrunk;
    ctx.fillRect(x - 6, GROUND_Y - 8, 6, 10);
    ctx.fillRect(x + tw, GROUND_Y - 6, 6, 8);
    ctx.fillRect(x - 10, GROUND_Y - 3, 4, 5);
    // Bromélias no tronco
    if (rng.chance(0.8)) drawBromelia(ctx, x + rng.int(0, tw), rng.int(70, 150));
    // Samambaia na base
    drawFern(ctx, x + tw + 10, GROUND_Y, rng.int(10, 15), P.stFern, P.stFernLight);
  }

  // Cipós pendurados do dossel.
  for (let x = rng.int(20, 60); x < w; x += rng.int(40, 80)) {
    const len = rng.int(60, 150);
    const amp = rng.range(1, 3);
    const ph = rng.range(0, Math.PI * 2);
    for (let y = 20; y < len; y++) {
      const vx = Math.round(x + Math.sin(y * 0.07 + ph) * amp);
      ctx.fillStyle = P.stVine;
      ctx.fillRect(vx, y, 1, 1);
      if (y % 9 === 0) {
        ctx.fillStyle = P.stVineLeaf;
        ctx.fillRect(vx + (y % 18 === 0 ? 1 : -2), y, 2, 1);
      }
    }
  }

  // Dossel denso no alto da tela.
  for (let x = -20; x < w + 20; x += rng.int(16, 28)) {
    drawTreeCrown(ctx, x, rng.int(-6, 16), rng.int(18, 28), P.stNearTree, P.stNearTreeLight, P.stNearTreeDark);
  }
}

function drawGround(ctx, w, h, rng) {
  ctx.fillStyle = P.stGround;
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
  ctx.fillStyle = P.stGroundDark;
  for (let i = 0; i < 260; i++) ctx.fillRect(rng.int(0, w), rng.int(GROUND_Y + 4, h), rng.int(1, 3), 1);
  ctx.fillRect(0, GROUND_Y + 22, w, h - GROUND_Y - 22);

  // Faixa de grama no topo, com tufos acima da linha do chão.
  ctx.fillStyle = P.stGrass;
  ctx.fillRect(0, GROUND_Y, w, 3);
  ctx.fillStyle = P.stGrassLight;
  ctx.fillRect(0, GROUND_Y, w, 1);
  for (let x = 0; x < w; x += rng.int(2, 5)) {
    const bh = rng.int(1, 5);
    ctx.fillStyle = rng.chance(0.5) ? P.stGrass : P.stGrassLight;
    ctx.fillRect(x, GROUND_Y - bh, 1, bh);
  }
  // Pedras e folhas caídas.
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, w - 10);
    const y = rng.int(GROUND_Y + 5, h - 6);
    const sw = rng.int(4, 9);
    ctx.fillStyle = P.stStone;
    ctx.fillRect(x, y, sw, 3);
    ctx.fillRect(x + 1, y - 1, sw - 2, 1);
    ctx.fillStyle = P.stStoneLight;
    ctx.fillRect(x + 1, y - 1, Math.max(1, sw - 5), 1);
  }
  ctx.fillStyle = P.stFallenLeaf;
  for (let i = 0; i < 70; i++) ctx.fillRect(rng.int(0, w), rng.int(GROUND_Y + 3, h - 2), 2, 1);
}

function drawForeground(ctx, w, h, rng) {
  // Só nas bordas: moitas na faixa de baixo (abaixo dos pés) e galhos no topo — nunca cobre a luta.
  for (let x = rng.int(0, 80); x < w; x += rng.int(140, 240)) {
    const size = rng.int(16, 26);
    for (let k = -4; k <= 4; k++) {
      const len = size - Math.abs(k) * 2;
      ctx.fillStyle = P.stFg;
      for (let i = 0; i < len; i++) ctx.fillRect(x + k * Math.round(i / 2), h - i, 2, 1);
    }
    ctx.fillStyle = P.stFgRim;
    ctx.fillRect(x - 1, h - size, 2, 2);
    // Folhas largas
    ctx.fillStyle = P.stFg;
    ctx.fillRect(x + 10, h - 12, 14, 5);
    ctx.fillRect(x + 14, h - 15, 10, 3);
    ctx.fillRect(x - 22, h - 10, 12, 4);
  }
  for (let x = rng.int(30, 120); x < w; x += rng.int(260, 380)) {
    const len = rng.int(40, 80);
    ctx.fillStyle = P.stFg;
    ctx.fillRect(x, 0, len, 3);
    for (let i = 0; i < len; i += 6) {
      ctx.fillRect(x + i, 3, 4, rng.int(3, 8));
      ctx.fillStyle = P.stFgRim;
      ctx.fillRect(x + i, 3, 1, 2);
      ctx.fillStyle = P.stFg;
    }
  }
}

/** Textura da água (repete a cada FALL_PERIOD px na vertical). */
function buildWaterTexture(rng) {
  const c = document.createElement('canvas');
  c.width = FALL_W;
  c.height = FALL_BOTTOM - FALL_TOP + FALL_PERIOD;
  const ctx = c.getContext('2d');
  ctx.fillStyle = P.stWater;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let x = 0; x < FALL_W; x++) {
    const offset = rng.int(0, FALL_PERIOD - 1);
    const len = rng.int(3, 8);
    const color = rng.chance(0.5) ? P.stWaterLight : P.stWaterDark;
    for (let y = -FALL_PERIOD; y < c.height; y += FALL_PERIOD) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y + offset, 1, len);
    }
  }
  ctx.fillStyle = P.stWaterDark;
  ctx.fillRect(0, 0, 1, c.height);
  ctx.fillRect(FALL_W - 1, 0, 1, c.height);
  return c;
}

// ---------------------------------------------------------------------------
// Definição do cenário (dados)
// ---------------------------------------------------------------------------
export const MATA_ATLANTICA = Object.freeze({
  id: 'mataAtlantica',
  name: 'MATA ATLÂNTICA',
  seed: STAGE_SEED,
  layers: Object.freeze([
    { id: 'sky', parallax: STAGE_PARALLAX.sky, front: false, draw: drawSky },
    { id: 'mountains', parallax: STAGE_PARALLAX.mountains, front: false, draw: drawMountains },
    { id: 'far_trees', parallax: STAGE_PARALLAX.far_trees, front: false, draw: drawFarTrees },
    { id: 'waterfall', parallax: STAGE_PARALLAX.waterfall, front: false, draw: drawWaterfallLayer },
    { id: 'near_trees', parallax: STAGE_PARALLAX.near_trees, front: false, draw: drawNearTrees },
    { id: 'ground', parallax: STAGE_PARALLAX.ground, front: false, draw: drawGround },
    { id: 'foreground', parallax: STAGE_PARALLAX.foreground, front: true, draw: drawForeground },
  ]),
});

/** Lista de PNGs opcionais que substituem camadas (para o carregador de assets). */
export function stageImageManifest(def) {
  return def.layers.map((l) => ({
    key: `stages/${def.id}/${l.id}`,
    url: `assets/stages/${def.id}/${l.id}.png`,
  }));
}

// ---------------------------------------------------------------------------
// Cenário em execução
// ---------------------------------------------------------------------------
export class Stage {
  /**
   * @param {typeof MATA_ATLANTICA} def
   * @param {import('../core/assets.js').Assets} [assets]
   */
  constructor(def, assets) {
    this.def = def;
    const rng = new Rng(def.seed);
    this.layers = def.layers.map((l) => {
      const png = assets?.getImage?.(`stages/${def.id}/${l.id}`);
      if (png) return { ...l, image: png, source: 'png' };
      const canvas = document.createElement('canvas');
      canvas.width = layerWidth(l.parallax);
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      // Cada camada usa o mesmo RNG em sequência: o cenário inteiro é determinístico.
      l.draw(ctx, canvas.width, H, rng);
      return { ...l, image: canvas, source: 'procedural' };
    });
    this.waterfall = this.layers.find((l) => l.id === 'waterfall');
    this.animatedWater = this.waterfall?.source === 'procedural';
    this.waterTexture = this.animatedWater ? buildWaterTexture(rng) : null;
    this.fx = new AmbientFx({ seed: def.seed + 1 });
    this.tick = 0;
  }

  /** Avança animações ambientes (chamado a cada tick lógico, inclusive durante hitstop). */
  update() {
    this.tick++;
    if (this.animatedWater) {
      for (let i = 0; i < WATERFALL_SPRAY_PER_TICK; i++) {
        this.fx.spawnSpray(FALL_X + FALL_W / 2, FALL_BOTTOM, STAGE_PARALLAX.waterfall);
      }
    }
    this.fx.update();
  }

  /** Deslocamento de cada camada para uma posição de câmera (debug/testes). */
  offsets(camX) {
    return Object.fromEntries(this.layers.map((l) => [l.id, layerOffset(camX, l.parallax)]));
  }

  _drawLayer(ctx, layer, camX) {
    const img = layer.image;
    const off = layerOffset(camX, layer.parallax);
    const y = H - img.height; // PNGs mais baixos ficam alinhados pela base
    // Repete na horizontal se a imagem for mais estreita que o necessário.
    let x = -(off % img.width);
    while (x < W) {
      ctx.drawImage(img, x, y);
      x += img.width;
    }
  }

  _drawWater(ctx, camX) {
    const sx = FALL_X - layerOffset(camX, STAGE_PARALLAX.waterfall);
    if (sx > W || sx + FALL_W < 0) return;
    const scroll = (this.tick * WATERFALL_SPEED) % FALL_PERIOD;
    const hgt = FALL_BOTTOM - FALL_TOP;
    ctx.drawImage(this.waterTexture, 0, FALL_PERIOD - scroll, FALL_W, hgt, sx, FALL_TOP, FALL_W, hgt);
    // Espuma na queda e na base (pisca entre dois desenhos).
    ctx.fillStyle = P.stFoam;
    const f = Math.floor(this.tick / 6) % 2;
    ctx.fillRect(sx - 1, FALL_TOP, FALL_W + 2, 2);
    ctx.fillRect(sx - 4 + f * 2, FALL_BOTTOM - 3, FALL_W + 6, 3);
    ctx.fillRect(sx - 8 + f * 3, FALL_BOTTOM - 1, 6, 2);
    ctx.fillRect(sx + FALL_W + 2 - f * 3, FALL_BOTTOM - 1, 6, 2);
  }

  /** Tudo que fica atrás dos lutadores. */
  renderBack(ctx, camX) {
    for (const layer of this.layers) {
      if (layer.front) continue;
      this._drawLayer(ctx, layer, camX);
      if (layer.id === 'waterfall' && this.animatedWater) {
        this._drawWater(ctx, camX);
        this.fx.renderBack(ctx, camX);
      }
      if (layer.id === 'near_trees') this.fx.renderMist(ctx, camX);
    }
  }

  /** Primeiro plano: folhagem da frente, folhas caindo e vaga-lumes. */
  renderFront(ctx, camX) {
    for (const layer of this.layers) {
      if (layer.front) this._drawLayer(ctx, layer, camX);
    }
    this.fx.renderFront(ctx, camX);
  }
}

