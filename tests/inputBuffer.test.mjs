// Testes do reconhecimento de sequências (core/inputBuffer.js). Rodar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputBuffer } from '../src/core/inputBuffer.js';
import { SPECIAL_MOVES } from '../src/config.js';
import { pickMove } from '../src/fight/moves.js';

/** Cria um objeto de ações lógicas para 1 tick. */
function act({ left = false, right = false, up = false, down = false, punch = false, kick = false, block = false } = {}) {
  return {
    left, right, up, down,
    punch, kick, block,
    pressed: { left, right, up, down, punch, kick, block },
  };
}

/** Grava n frames idênticos no buffer. */
function repeat(buf, a, facing, n) {
  for (let i = 0; i < n; i++) buf.record(a, facing);
}

const QCF_P = { id: 'redemoinho', seq: ['down', 'forward', 'punch'], window: 20 };
const QCB_K = { id: 'sumico', seq: ['down', 'back', 'kick'], window: 20 };

test('reconhece ↓ → + soco olhando para a direita (facing = 1)', () => {
  const buf = new InputBuffer();
  buf.record(act({ down: true }), 1);
  buf.record(act({ right: true }), 1);
  buf.record(act({ punch: true }), 1);
  assert.equal(buf.matches(QCF_P), true);
  assert.equal(buf.matches(QCB_K), false);
});

test('reconhece ↓ → + soco no mesmo frame que → (→+P juntos)', () => {
  const buf = new InputBuffer();
  buf.record(act({ down: true }), 1);
  buf.record(act({ down: true, right: true }), 1); // diagonal ↘
  buf.record(act({ right: true, punch: true }), 1); // →+P no mesmo frame
  assert.equal(buf.matches(QCF_P), true);
});

test('espelhamento: ↓ → + soco funciona olhando para a esquerda (facing = -1, usa left)', () => {
  const buf = new InputBuffer();
  buf.record(act({ down: true }), -1);
  buf.record(act({ left: true }), -1);
  buf.record(act({ left: true, punch: true }), -1);
  assert.equal(buf.matches(QCF_P), true);

  // Se apertar right enquanto olha para a esquerda, isso é 'back', não 'forward'.
  const bufWrong = new InputBuffer();
  bufWrong.record(act({ down: true }), -1);
  bufWrong.record(act({ right: true }), -1);
  bufWrong.record(act({ punch: true }), -1);
  assert.equal(bufWrong.matches(QCF_P), false);
});

test('reconhece ↓ ← + chute dos dois lados da tela (facing = 1 e facing = -1)', () => {
  // Olhando para a direita: back = left
  const bufRight = new InputBuffer();
  bufRight.record(act({ down: true }), 1);
  bufRight.record(act({ down: true, left: true }), 1);
  bufRight.record(act({ left: true, kick: true }), 1);
  assert.equal(bufRight.matches(QCB_K), true);

  // Olhando para a esquerda: back = right
  const bufLeft = new InputBuffer();
  bufLeft.record(act({ down: true }), -1);
  bufLeft.record(act({ down: true, right: true }), -1);
  bufLeft.record(act({ right: true, kick: true }), -1);
  assert.equal(bufLeft.matches(QCB_K), true);
});

test('tolera frames neutros e ruído entre os passos dentro da janela', () => {
  const buf = new InputBuffer();
  repeat(buf, act({ down: true }), 1, 3);
  repeat(buf, act(), 1, 2); // 2 frames neutros
  buf.record(act({ up: true }), 1); // 1 frame de ruído acidental
  repeat(buf, act({ right: true }), 1, 2);
  repeat(buf, act(), 1, 2); // soltou direção antes de apertar o botão
  buf.record(act({ punch: true }), 1);
  assert.equal(buf.matches(QCF_P), true);
});

test('rejeita sequência quando excede a janela de frames (window)', () => {
  const buf = new InputBuffer();
  buf.record(act({ down: true }), 1);
  repeat(buf, act(), 1, 21); // passou da janela de 20 frames
  buf.record(act({ right: true }), 1);
  buf.record(act({ punch: true }), 1);
  assert.equal(buf.matches(QCF_P), false);
});

test('rejeita quando a ordem está invertida (→ depois ↓)', () => {
  const buf = new InputBuffer();
  buf.record(act({ right: true }), 1);
  buf.record(act({ down: true }), 1);
  buf.record(act({ punch: true }), 1);
  assert.equal(buf.matches(QCF_P), false);
});

test('rejeita segurar diagonal ↘ parada sem transição real de ↓ para →', () => {
  const buf = new InputBuffer();
  buf.record(act({ down: true, right: true }), 1);
  buf.record(act({ down: true, right: true }), 1);
  buf.record(act({ down: true, right: true, punch: true }), 1);
  assert.equal(buf.matches(QCF_P), false);
});

test('não dispara se o botão não foi pressionado neste exato tick', () => {
  const buf = new InputBuffer();
  buf.record(act({ down: true }), 1);
  buf.record(act({ right: true, punch: true }), 1);
  assert.equal(buf.matches(QCF_P), true);
  // No frame seguinte, sem novo aperto de punch, não pode disparar de novo.
  buf.record(act({ right: true }), 1);
  assert.equal(buf.matches(QCF_P), false);
});

test('matchSpecials consome o buffer e dá prioridade ao especial sobre golpe básico em pickMove', () => {
  const buf = new InputBuffer();
  const specials = [SPECIAL_MOVES.redemoinho, SPECIAL_MOVES.sumico];

  buf.record(act({ down: true }), 1);
  buf.record(act({ right: true }), 1);
  const finalTick = act({ right: true, punch: true });
  buf.record(finalTick, 1);

  const chosen = pickMove(finalTick, { air: false, crouch: false, buffer: buf, specials });
  assert.equal(chosen, 'redemoinho');
  assert.equal(buf.lastSpecial, 'redemoinho');
  // Buffer foi limpo após consumir o especial:
  assert.equal(buf.history.length, 0);
});

test('describe formata o histórico colapsando repetições consecutivas', () => {
  const buf = new InputBuffer();
  assert.equal(buf.describe(), '-');
  repeat(buf, act({ down: true }), 1, 3);
  buf.record(act({ down: true, right: true }), 1);
  buf.record(act({ right: true, punch: true }), 1);
  assert.equal(buf.describe(), '↓ ↘ →+P');
});
