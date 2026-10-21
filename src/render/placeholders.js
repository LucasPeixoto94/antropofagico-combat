// Gera spritesheets procedurais (placeholders) com o MESMO tamanho dos sprites finais.
// Cada frame: silhueta colorida do personagem + nome do estado e nº do frame.
import { PALETTE as P } from '../palette.js';
import { CROUCH_HEIGHT_RATIO } from '../config.js';

const LEG_RATIO = 0.38;
/** Tronco (0,34) + cabeça (0,2), em fração da altura. */
const UPPER_RATIO = 0.54;
/** Deslocamento das pernas por frame ao andar. */
const WALK_SWING = [-3, -1, 1, 3, 1, -1];

const FONT = '"Press Start 2P", monospace';

/**
 * @param {Object} o
 * @param {string} o.name     nome exibido (ex.: 'SACI')
 * @param {string} o.state    nome do estado (ex.: 'idle')
 * @param {'saci'|'curupira'|'generic'} [o.kind]
 * @param {number} o.height   altura do personagem em px
 * @param {number} o.frameWidth
 * @param {number} o.frameHeight
 * @param {number} o.frames
 * @param {{x:number,y:number}} o.pivot
 * @param {boolean} [flipped] gera a versão olhando para a esquerda (texto continua legível)
 * @returns {HTMLCanvasElement}
 */
export function generatePlaceholderSheet(o, flipped = false) {
  const canvas = document.createElement('canvas');
  canvas.width = o.frameWidth * o.frames;
  canvas.height = o.frameHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const pivotX = flipped ? o.frameWidth - o.pivot.x : o.pivot.x;
  for (let i = 0; i < o.frames; i++) {
    const ox = i * o.frameWidth;
    let rects = buildFigure(o.kind || 'generic', o.height, i, o.frames, o.pose);
    if (flipped) rects = rects.map((q) => ({ ...q, x: -q.x - q.w }));
    drawRects(ctx, rects, ox + pivotX, o.pivot.y);
    const top = Math.min(...rects.map((q) => q.y));
    drawLabel(ctx, `${shortLabel(o.state)} ${i}`, ox + o.frameWidth / 2, o.pivot.y + top - 8);
  }
  return canvas;
}

/** Desenha retângulos com contorno de 1 px (pixel art nítido). */
function drawRects(ctx, rects, px, py) {
  ctx.fillStyle = P.outline;
  for (const r of rects) ctx.fillRect(px + r.x - 1, py + r.y - 1, r.w + 2, r.h + 2);
  for (const r of rects) {
    ctx.fillStyle = r.c;
    ctx.fillRect(px + r.x, py + r.y, r.w, r.h);
  }
}

function drawLabel(ctx, text, cx, y) {
  ctx.font = `8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = Math.round(cx);
  const ty = Math.max(6, Math.round(y));
  ctx.fillStyle = P.placeholderTextShadow;
  ctx.fillText(text, x + 1, ty + 1);
  ctx.fillStyle = P.placeholderText;
  ctx.fillText(text, x, ty);
}

const r = (x, y, w, h, c) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), c });

/** Abrevia nomes longos de estado para o rótulo caber no frame (ex.: attack_crouch_kick -> atk cr_kick). */
function shortLabel(state) {
  return state.replace(/^attack_/, 'atk ').replace('crouch', 'cr');
}

/** Pose base usada por cada pose de combate (as demais poses são a própria base). */
const POSE_BASE = {
  attack_punch: 'idle',
  attack_kick: 'idle',
  attack_crouch_punch: 'crouch',
  attack_crouch_kick: 'crouch',
  attack_air: 'jump',
  block: 'idle',
  crouch_block: 'crouch',
  hitstun: 'idle',
};

/**
 * Silhueta completa de uma pose. Golpes têm 3 frames (preparo, golpe, recuperação);
 * o alcance do membro no frame 1 acompanha a hitbox em config.js (BASIC_MOVES).
 */
function buildFigure(kind, h, frame, frames, pose = 'idle') {
  if (pose === 'knockdown') return buildLying(kind, frame);
  let rects = buildBase(kind, h, frame, frames, POSE_BASE[pose] ?? pose);
  const skin = kind === 'curupira' ? P.curupiraSkin : P.saciSkin;
  const shade = kind === 'curupira' ? P.curupiraShade : P.saciShade;
  const reach = (lens) => lens[Math.min(frame, 2)];
  switch (pose) {
    case 'attack_punch':
      rects.push(r(8, -h * 0.68, reach([10, 38, 16]), 7, skin));
      break;
    case 'attack_kick':
      rects.push(r(4, -h * 0.5, reach([8, 52, 16]), 8, shade));
      break;
    case 'attack_crouch_punch':
      rects.push(r(4, -h * 0.42, reach([10, 40, 14]), 7, skin));
      break;
    case 'attack_crouch_kick':
      rects.push(r(4, -10, reach([10, 56, 16]), 8, shade));
      break;
    case 'attack_air':
      rects.push(r(4, -h * 0.35, reach([10, 44, 16]), 10, shade));
      break;
    case 'block':
      rects.push(r(10, -h * 0.8, 8, h * 0.3, shade));
      break;
    case 'crouch_block':
      rects.push(r(10, -h * 0.52, 8, h * 0.2, shade));
      break;
    case 'hitstun':
      rects = rects.map((q) => ({ ...q, x: q.x - 5 }));
      break;
    default:
  }
  return rects;
}

/** Figura deitada (knockdown). */
function buildLying(kind, frame) {
  const skin = kind === 'curupira' ? P.curupiraSkin : P.saciSkin;
  const shade = kind === 'curupira' ? P.curupiraShade : P.saciShade;
  const dy = frame % 2 ? -1 : 0;
  const rects = [
    r(-34, -14 + dy, 64, 14, skin),
    r(-38, -8 + dy, 8, 8, shade),
    r(30, -18 + dy, 18, 18, skin),
  ];
  if (kind === 'curupira') rects.push(r(48, -22 + dy, 6, 12, P.curupiraHair));
  else rects.push(r(30, -24 + dy, 18, 6, P.saciCap));
  return rects;
}

/**
 * Silhueta base em coordenadas relativas ao pivô (pés no 0,0; y cresce para baixo; olhando para a direita).
 * pose: 'idle' | 'walk_fwd' | 'walk_back' | 'jump' | 'crouch'
 */
function buildBase(kind, h, frame, frames, pose = 'idle') {
  // Respiração: corpo sobe 1 px na metade do ciclo.
  const bob = Math.sin((frame / frames) * Math.PI * 2) > 0 ? -1 : 0;
  // Pernas: no agachado encolhem até a altura total bater com CROUCH_HEIGHT_RATIO.
  const legScale = pose === 'crouch' ? (CROUCH_HEIGHT_RATIO - UPPER_RATIO) / LEG_RATIO
    : pose === 'jump' ? 0.6 : 1;
  const isWalk = pose === 'walk_fwd' || pose === 'walk_back';
  const swing = isWalk ? WALK_SWING[frame % WALK_SWING.length] * (pose === 'walk_back' ? -1 : 1) : 0;
  const legH = h * LEG_RATIO * legScale;
  const torsoH = h * 0.34;
  const headS = Math.round(h * 0.2);
  const torsoW = Math.round(h * 0.24);
  const torsoY = -legH - torsoH + bob;
  const headY = torsoY - headS;

  if (kind === 'saci') {
    const legW = Math.round(h * 0.08);
    return [
      // Uma perna só
      r(-legW / 2 + swing, -legH, legW, legH, P.saciSkin),
      // Bermuda
      r(-torsoW / 2, -legH - 8 + bob, torsoW, 10, P.saciShorts),
      // Tronco
      r(-torsoW / 2, torsoY, torsoW, torsoH - 8, P.saciSkin),
      // Braço (frente)
      r(torsoW / 2 - 2, torsoY + 4, 6, torsoH * 0.6, P.saciShade),
      // Cabeça
      r(-headS / 2, headY, headS, headS, P.saciSkin),
      // Olho
      r(headS / 2 - 6, headY + headS * 0.35, 3, 3, P.placeholderText),
      // Gorro vermelho (pende para trás)
      r(-headS / 2, headY - 6, headS, 7, P.saciCap),
      r(-headS / 2 - 4, headY - 11, headS * 0.7, 6, P.saciCap),
      r(-headS / 2 - 8, headY - 15, headS * 0.35, 5, P.saciCapShade),
    ];
  }

  if (kind === 'curupira') {
    const legW = Math.round(h * 0.07);
    const gap = Math.round(torsoW * 0.18);
    // Cabelo de fogo: altura das chamas varia por frame.
    const flames = [0, 1, 2, 3, 4].map((k) => {
      const fh = 8 + ((frame + k * 2) % 4) * 3;
      const fx = -headS / 2 + k * (headS / 5);
      return r(fx, headY - fh + 2, headS / 5, fh, (frame + k) % 2 ? P.curupiraHair : P.curupiraHairHot);
    });
    return [
      // Duas pernas (alternam ao andar)
      r(-gap - legW + swing, -legH, legW, legH, P.curupiraSkin),
      r(gap - swing, -legH, legW, legH, P.curupiraShade),
      // Pés virados para TRÁS (apontam para a esquerda quando olha para a direita)
      r(-gap - legW - 8 + swing, -4, 8 + legW, 4, P.curupiraSkin),
      r(gap - 8 - swing, -4, 8 + legW, 4, P.curupiraShade),
      // Tanga
      r(-torsoW / 2, -legH - 6 + bob, torsoW, 10, P.curupiraLoincloth),
      // Tronco
      r(-torsoW / 2, torsoY, torsoW, torsoH - 6, P.curupiraSkin),
      // Braço
      r(torsoW / 2 - 2, torsoY + 4, 6, torsoH * 0.6, P.curupiraShade),
      // Cabeça
      r(-headS / 2, headY, headS, headS, P.curupiraSkin),
      r(headS / 2 - 6, headY + headS * 0.35, 3, 3, P.curupiraHairHot),
      ...flames,
    ];
  }

  // Genérico: caixa com cabeça.
  return [
    r(-torsoW / 2, torsoY, torsoW, torsoH + legH, P.forestMid),
    r(-headS / 2, headY, headS, headS, P.forestMid),
  ];
}
