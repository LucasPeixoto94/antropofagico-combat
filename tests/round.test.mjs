// Testes da lógica de rounds (fight/round.js). Rodar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match, MatchEvent, RoundPhase, RoundEndReason, timeWinner } from '../src/fight/round.js';

// Config pequena para os testes rodarem rápido: 10 fps, round de 3 s.
const CFG = { fps: 10, roundTime: 3, roundsToWin: 2, maxRounds: 5, introFrames: 5, endFrames: 4 };

const alive = (h0 = 100, h1 = 100) => ({ ko: [false, false], health: [h0, h1], maxHealth: [100, 100] });
const koP2 = { ko: [false, true], health: [50, 0], maxHealth: [100, 100] };
const koP1 = { ko: [true, false], health: [0, 50], maxHealth: [100, 100] };
const koBoth = { ko: [true, true], health: [0, 0], maxHealth: [100, 100] };

/** Avança n ticks com o mesmo status; devolve os eventos não nulos. */
function run(m, n, status = alive()) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const e = m.update(status);
    if (e) events.push(e);
  }
  return events;
}

/** Leva a partida até a fase de luta. */
function toFight(m) {
  run(m, CFG.introFrames);
  assert.equal(m.phase, RoundPhase.FIGHT);
}

test('começa no round 1, na introdução, com timer cheio e placar zerado', () => {
  const m = new Match(CFG);
  assert.equal(m.round, 1);
  assert.equal(m.phase, RoundPhase.INTRO);
  assert.equal(m.secondsLeft, 3);
  assert.deepEqual(m.wins, [0, 0]);
  assert.equal(m.fighting, false);
  assert.equal(m.winner, null);
});

test('introdução dura introFrames e emite FIGHT', () => {
  const m = new Match(CFG);
  assert.deepEqual(run(m, CFG.introFrames - 1), []);
  assert.equal(m.phase, RoundPhase.INTRO);
  assert.deepEqual(run(m, 1), [MatchEvent.FIGHT]);
  assert.equal(m.fighting, true);
});

test('timer não corre na introdução e corre durante a luta', () => {
  const m = new Match(CFG);
  run(m, CFG.introFrames);
  assert.equal(m.timeLeft, 30);
  run(m, 10);
  assert.equal(m.timeLeft, 20);
  assert.equal(m.secondsLeft, 2);
});

test('K.O. encerra o round e dá ponto ao vencedor', () => {
  const m = new Match(CFG);
  toFight(m);
  assert.deepEqual(run(m, 1, koP2), [MatchEvent.KO]);
  assert.equal(m.phase, RoundPhase.END);
  assert.deepEqual(m.result, { reason: RoundEndReason.KO, winner: 0 });
  assert.deepEqual(m.wins, [1, 0]);
  assert.equal(m.winner, null);
});

test('timer para durante o fim de round', () => {
  const m = new Match(CFG);
  toFight(m);
  run(m, 3);
  run(m, 1, koP2);
  const t = m.timeLeft;
  run(m, 2, koP2);
  assert.equal(m.timeLeft, t);
});

test('após o fim de round começa o próximo, com timer cheio', () => {
  const m = new Match(CFG);
  toFight(m);
  run(m, 7);
  run(m, 1, koP2);
  const events = run(m, CFG.endFrames);
  assert.deepEqual(events, [MatchEvent.NEXT_ROUND]);
  assert.equal(m.round, 2);
  assert.equal(m.phase, RoundPhase.INTRO);
  assert.equal(m.timeLeft, 30);
  assert.equal(m.result, null);
});

test('tempo esgotado: vence quem tem mais vida (em porcentagem)', () => {
  const m = new Match(CFG);
  toFight(m);
  const events = run(m, 30, alive(40, 70));
  assert.deepEqual(events, [MatchEvent.TIME]);
  assert.equal(m.timeLeft, 0);
  assert.deepEqual(m.result, { reason: RoundEndReason.TIME, winner: 1 });
  assert.deepEqual(m.wins, [0, 1]);
});

test('timeWinner compara porcentagem, não vida absoluta', () => {
  // Saci 60/90 (66,7%) x Curupira 70/110 (63,6%): Saci vence mesmo com menos vida absoluta.
  assert.equal(timeWinner({ health: [60, 70], maxHealth: [90, 110] }), 0);
  assert.equal(timeWinner({ health: [45, 55], maxHealth: [90, 110] }), null);
  assert.equal(timeWinner({ health: [10, 90], maxHealth: [100, 100] }), 1);
});

test('tempo esgotado com vidas iguais: empate, ninguém pontua', () => {
  const m = new Match(CFG);
  toFight(m);
  run(m, 30, alive(50, 50));
  assert.deepEqual(m.result, { reason: RoundEndReason.TIME, winner: null });
  assert.deepEqual(m.wins, [0, 0]);
});

test('duplo K.O.: empate, ninguém pontua', () => {
  const m = new Match(CFG);
  toFight(m);
  assert.deepEqual(run(m, 1, koBoth), [MatchEvent.KO]);
  assert.deepEqual(m.result, { reason: RoundEndReason.DOUBLE_KO, winner: null });
  assert.deepEqual(m.wins, [0, 0]);
});

test('K.O. no mesmo tick em que o tempo acabaria tem prioridade', () => {
  const m = new Match(CFG);
  toFight(m);
  run(m, 29);
  assert.equal(m.timeLeft, 1);
  assert.deepEqual(run(m, 1, koP1), [MatchEvent.KO]);
  assert.equal(m.result.reason, RoundEndReason.KO);
  assert.equal(m.result.winner, 1);
});

test('melhor de 3: 2 vitórias decidem a partida (2-0)', () => {
  const m = new Match(CFG);
  toFight(m);
  run(m, 1, koP2);
  run(m, CFG.endFrames);
  toFight(m);
  run(m, 1, koP2);
  assert.equal(m.winner, 0);
  assert.deepEqual(run(m, CFG.endFrames), [MatchEvent.MATCH_END]);
  assert.equal(m.phase, RoundPhase.MATCH_END);
  assert.equal(m.round, 2);
  // Fica parado no fim da partida.
  assert.deepEqual(run(m, 50), []);
  assert.equal(m.phase, RoundPhase.MATCH_END);
});

test('1-1 leva ao round final; quem vencer o 3º leva a partida', () => {
  const m = new Match(CFG);
  toFight(m);
  run(m, 1, koP2);
  run(m, CFG.endFrames);
  assert.equal(m.isFinalRound, false);
  toFight(m);
  run(m, 1, koP1);
  run(m, CFG.endFrames);
  assert.deepEqual(m.wins, [1, 1]);
  assert.equal(m.round, 3);
  assert.equal(m.isFinalRound, true);
  toFight(m);
  run(m, 30, alive(10, 20)); // P2 vence por tempo
  assert.equal(m.winner, 1);
  assert.deepEqual(run(m, CFG.endFrames), [MatchEvent.MATCH_END]);
});

test('limite de rounds: empates seguidos terminam em empate da partida', () => {
  const m = new Match(CFG);
  for (let r = 1; r <= CFG.maxRounds; r++) {
    assert.equal(m.round, r);
    toFight(m);
    run(m, 1, koBoth);
    const events = run(m, CFG.endFrames);
    if (r < CFG.maxRounds) assert.deepEqual(events, [MatchEvent.NEXT_ROUND]);
    else assert.deepEqual(events, [MatchEvent.MATCH_END]);
  }
  assert.equal(m.winner, 'draw');
});

test('limite de rounds: decide pelo placar se alguém estiver na frente', () => {
  const m = new Match(CFG);
  toFight(m);
  run(m, 1, koP2); // 1-0
  run(m, CFG.endFrames);
  for (let r = 2; r <= CFG.maxRounds; r++) {
    toFight(m);
    run(m, 1, koBoth);
    run(m, CFG.endFrames);
  }
  assert.equal(m.winner, 0);
  assert.equal(m.phase, RoundPhase.MATCH_END);
});

