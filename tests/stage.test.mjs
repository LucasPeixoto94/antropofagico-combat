// Testes da Etapa 8: RNG determinístico, pool de partículas, sombras e matemática de parallax.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/core/rng.js';
import { ParticlePool, AmbientFx, shadowScale } from '../src/render/fx.js';
import { MATA_ATLANTICA, layerWidth, layerOffset, stageImageManifest } from '../src/stages/mataAtlantica.js';
import { INTERNAL_WIDTH as W, STAGE_WIDTH, SHADOW_MIN_SCALE } from '../src/config.js';

test('Rng com a mesma seed gera exatamente a mesma sequência', () => {
  const a = new Rng(1500);
  const b = new Rng(1500);
  for (let i = 0; i < 50; i++) {
    assert.equal(a.float(), b.float());
    assert.equal(a.int(0, 100), b.int(0, 100));
  }
});

test('ParticlePool respeita o limite máximo e recicla partículas mortas', () => {
  const pool = new ParticlePool(3);
  const p1 = pool.spawn({ id: 1 });
  const p2 = pool.spawn({ id: 2 });
  const p3 = pool.spawn({ id: 3 });
  assert.equal(pool.count, 3);
  assert.equal(pool.spawn({ id: 4 }), null); // cheio

  p2.alive = false;
  assert.equal(pool.count, 2);
  const p4 = pool.spawn({ id: 4 });
  assert.ok(p4 !== null);
  assert.equal(p4.id, 4);
  assert.equal(pool.count, 3);
  assert.ok(p1.alive && p3.alive && p4.alive);
});

test('AmbientFx recicla folhas e expira respingos sem ultrapassar o limite do pool', () => {
  const fx = new AmbientFx({ seed: 42, leaves: 4, fireflies: 4, max: 12 });
  assert.equal(fx.pool.count, 8);
  fx.spawnSpray(100, 190, 0.5);
  fx.spawnSpray(100, 190, 0.5);
  assert.equal(fx.pool.count, 10);

  // Avança 300 ticks: sprays expiram, folhas caem e são recicladas, total nunca passa de 12.
  for (let i = 0; i < 300; i++) {
    fx.update();
    assert.ok(fx.pool.count <= 12);
  }
  assert.equal(fx.pool.count, 8);
});

test('shadowScale é 1 no chão e encolhe ao subir até SHADOW_MIN_SCALE', () => {
  assert.equal(shadowScale(0), 1);
  assert.ok(shadowScale(50) < 1 && shadowScale(50) > SHADOW_MIN_SCALE);
  assert.equal(shadowScale(500), SHADOW_MIN_SCALE);
});

test('parallax: cada camada tem largura suficiente e desloca proporcionalmente à câmera', () => {
  assert.equal(layerWidth(0), W);
  assert.equal(layerWidth(1), STAGE_WIDTH);
  assert.ok(layerWidth(1.25) > STAGE_WIDTH);

  const factors = MATA_ATLANTICA.layers.map((l) => l.parallax);
  // Ordenados do fundo (0) até o primeiro plano (> 1)
  for (let i = 1; i < factors.length; i++) {
    assert.ok(factors[i] > factors[i - 1], `camada ${i} deveria mover mais rápido que ${i - 1}`);
  }

  const camX = 200;
  assert.equal(layerOffset(camX, 0), 0);
  assert.equal(layerOffset(camX, 0.5), 100);
  assert.equal(layerOffset(camX, 1), 200);
  assert.equal(layerOffset(camX, 1.25), 250);

  const manifest = stageImageManifest(MATA_ATLANTICA);
  assert.equal(manifest.length, 7);
  assert.equal(manifest[0].url, 'assets/stages/mataAtlantica/sky.png');
});
