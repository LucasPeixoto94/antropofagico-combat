// Carregador de assets com fallback para placeholder procedural.
// Para cada sprite tenta <base>.png (+ <base>.json opcional). Se o PNG não existir,
// usa um placeholder gerado com os mesmos metadados — sem mudar código.
import { generatePlaceholderSheet } from '../render/placeholders.js';

/**
 * @typedef {Object} SpriteMeta
 * @property {number} frameWidth
 * @property {number} frameHeight
 * @property {number} frames
 * @property {number} fps
 * @property {boolean} loop
 * @property {{x:number, y:number}} pivot
 */

/**
 * @typedef {Object} Sprite
 * @property {string} key
 * @property {HTMLImageElement|HTMLCanvasElement} image
 * @property {SpriteMeta} meta
 * @property {'png'|'placeholder'} source
 */

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`não encontrado: ${url}`));
    img.src = url;
  });
}

async function loadJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export class Assets {
  constructor() {
    /** @type {Map<string, Sprite>} */
    this.sprites = new Map();
    /** Imagens avulsas opcionais (ex.: camadas de cenário). Só existem se o PNG foi encontrado. */
    /** @type {Map<string, HTMLImageElement>} */
    this.images = new Map();
  }

  /**
   * Tenta carregar PNGs opcionais; os que não existirem são simplesmente ignorados
   * (quem usa cai no desenho procedural).
   * @param {Array<{key:string, url:string}>} list
   */
  async loadImages(list) {
    await Promise.all(list.map(async ({ key, url }) => {
      const img = await loadImage(url).catch(() => null);
      if (img) this.images.set(key, img);
    }));
  }

  /** @returns {HTMLImageElement|null} */
  getImage(key) {
    return this.images.get(key) ?? null;
  }

  /**
   * @param {string} key identificador, ex.: 'saci/idle'
   * @param {string} base caminho sem extensão, ex.: 'assets/characters/saci/idle'
   * @param {SpriteMeta & {placeholder: object}} spec metadados padrão + dados do placeholder
   * @returns {Promise<Sprite>}
   */
  async loadSprite(key, base, spec) {
    const { placeholder, ...defaults } = spec;
    const image = await loadImage(`${base}.png`).catch(() => null);
    // O JSON só faz sentido junto de um PNG (evita 404 extra para cada placeholder).
    const json = image ? await loadJson(`${base}.json`) : null;

    /** @type {Sprite} */
    let sprite;
    if (image) {
      const meta = { ...defaults, ...(json || {}) };
      if (!json) {
        // Sem JSON: deduz pelo tamanho do PNG (spritesheet horizontal).
        meta.frameHeight = image.height;
        if (image.width < meta.frameWidth) meta.frameWidth = image.width;
        meta.frames = Math.max(1, Math.floor(image.width / meta.frameWidth));
      }
      meta.pivot = { ...defaults.pivot, ...(meta.pivot || {}) };
      sprite = { key, image, meta, source: 'png' };
    } else {
      const meta = { ...defaults, pivot: { ...defaults.pivot } };
      const canvas = generatePlaceholderSheet({ ...placeholder, ...meta });
      const flipped = generatePlaceholderSheet({ ...placeholder, ...meta }, true);
      sprite = { key, image: canvas, imageFlipped: flipped, meta, source: 'placeholder' };
    }

    this.sprites.set(key, sprite);
    return sprite;
  }

  /** @param {Array<{key:string, base:string, spec:object}>} list */
  loadAll(list) {
    return Promise.all(list.map(({ key, base, spec }) => this.loadSprite(key, base, spec)));
  }

  /** @returns {Sprite|undefined} */
  get(key) {
    return this.sprites.get(key);
  }

  /** Resumo para o debug: quantos vieram de PNG e quantos são placeholder. */
  summary() {
    let png = 0;
    let placeholder = 0;
    for (const s of this.sprites.values()) {
      if (s.source === 'png') png++;
      else placeholder++;
    }
    return { png, placeholder, images: this.images.size };
  }
}
