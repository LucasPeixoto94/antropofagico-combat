// RNG determinístico com seed (mulberry32). Usado no lugar de Math.random():
// a mesma seed gera sempre o mesmo cenário e as mesmas partículas (testes e replays).

/** @param {number} seed */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  /** @param {number} seed */
  constructor(seed) {
    this._next = mulberry32(seed);
  }

  /** Float em [0, 1). */
  float() {
    return this._next();
  }

  /** Float em [min, max). */
  range(min, max) {
    return min + (max - min) * this._next();
  }

  /** Inteiro em [min, max] (inclusivo). */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** true com probabilidade p. */
  chance(p) {
    return this._next() < p;
  }

  /** Elemento aleatório de um array. */
  pick(arr) {
    return arr[Math.floor(this._next() * arr.length)];
  }
}

