// Lógica da partida: rounds, timer, K.O., tempo esgotado e placar.
// Não conhece lutadores nem DOM: recebe só o status (vida/KO) a cada tick, então é testável com node:test.
//
// Fases de um round: ROUND_INTRO -> FIGHTING -> ROUND_END -> (próximo ROUND_INTRO | MATCH_END)
import {
  FPS,
  ROUND_TIME,
  ROUNDS_TO_WIN,
  MAX_ROUNDS,
  ROUND_INTRO_FRAMES,
  ROUND_END_FRAMES,
} from '../config.js';

export const RoundPhase = Object.freeze({
  INTRO: 'ROUND_INTRO',
  FIGHT: 'FIGHTING',
  END: 'ROUND_END',
  MATCH_END: 'MATCH_END',
});

export const RoundEndReason = Object.freeze({
  KO: 'ko',
  DOUBLE_KO: 'double_ko',
  TIME: 'time',
});

/** Eventos devolvidos por Match.update(). */
export const MatchEvent = Object.freeze({
  FIGHT: 'fight', // fim da introdução: lutadores liberados
  KO: 'ko', // round terminou por K.O. (simples ou duplo)
  TIME: 'time', // round terminou por tempo
  NEXT_ROUND: 'next_round', // começou a introdução do próximo round (resetar lutadores)
  MATCH_END: 'match_end', // partida decidida
});

/**
 * Vencedor por tempo: maior porcentagem de vida (os personagens têm vidas máximas diferentes).
 * @param {{health:number[], maxHealth:number[]}} status
 * @returns {0|1|null} índice do vencedor ou null (empate)
 */
export function timeWinner(status) {
  const r0 = status.health[0] / status.maxHealth[0];
  const r1 = status.health[1] / status.maxHealth[1];
  if (Math.abs(r0 - r1) < 1e-9) return null;
  return r0 > r1 ? 0 : 1;
}

export class Match {
  /**
   * @param {Object} [opts] sobrescritas (usadas nos testes); padrão vem de config.js
   */
  constructor(opts = {}) {
    this.cfg = {
      fps: FPS,
      roundTime: ROUND_TIME,
      roundsToWin: ROUNDS_TO_WIN,
      maxRounds: MAX_ROUNDS,
      introFrames: ROUND_INTRO_FRAMES,
      endFrames: ROUND_END_FRAMES,
      ...opts,
    };
    this.wins = [0, 0];
    this.round = 0;
    /** Vencedor da partida: 0 | 1 | 'draw' | null (em andamento). */
    this.winner = null;
    this._startRound();
  }

  _startRound() {
    this.round++;
    this.phase = RoundPhase.INTRO;
    this.phaseFrame = 0;
    this.timeLeft = this.cfg.roundTime * this.cfg.fps;
    /** Resultado do round atual: { reason, winner: 0|1|null }. */
    this.result = null;
  }

  /** Segundos exibidos no timer (arredonda para cima: mostra 60 no primeiro segundo). */
  get secondsLeft() {
    return Math.ceil(this.timeLeft / this.cfg.fps);
  }

  /** Último round possível (ambos a uma vitória, ou limite de rounds). */
  get isFinalRound() {
    const need = this.cfg.roundsToWin - 1;
    return (this.wins[0] === need && this.wins[1] === need) || this.round >= this.cfg.maxRounds;
  }

  /** Os lutadores aceitam input apenas durante a luta. */
  get fighting() {
    return this.phase === RoundPhase.FIGHT;
  }

  /**
   * Avança um tick.
   * @param {{ko:boolean[], health:number[], maxHealth:number[]}} status
   * @returns {string|null} um MatchEvent, ou null
   */
  update(status) {
    this.phaseFrame++;
    switch (this.phase) {
      case RoundPhase.INTRO:
        if (this.phaseFrame >= this.cfg.introFrames) {
          this._setPhase(RoundPhase.FIGHT);
          return MatchEvent.FIGHT;
        }
        return null;

      case RoundPhase.FIGHT: {
        const [ko0, ko1] = status.ko;
        // K.O. tem prioridade sobre o tempo esgotado no mesmo tick.
        if (ko0 && ko1) return this._endRound(RoundEndReason.DOUBLE_KO, null);
        if (ko0 || ko1) return this._endRound(RoundEndReason.KO, ko0 ? 1 : 0);
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          return this._endRound(RoundEndReason.TIME, timeWinner(status));
        }
        return null;
      }

      case RoundPhase.END:
        if (this.phaseFrame >= this.cfg.endFrames) {
          if (this.winner !== null) {
            this._setPhase(RoundPhase.MATCH_END);
            return MatchEvent.MATCH_END;
          }
          this._startRound();
          return MatchEvent.NEXT_ROUND;
        }
        return null;

      default: // MATCH_END: fica parado até o jogo sair do estado
        return null;
    }
  }

  _setPhase(phase) {
    this.phase = phase;
    this.phaseFrame = 0;
  }

  /** @param {string} reason  @param {0|1|null} winner (null = empate: ninguém pontua) */
  _endRound(reason, winner) {
    this.result = { reason, winner };
    if (winner !== null) this.wins[winner]++;
    this.winner = this._decideMatch();
    this._setPhase(RoundPhase.END);
    return reason === RoundEndReason.TIME ? MatchEvent.TIME : MatchEvent.KO;
  }

  /** @returns {0|1|'draw'|null} */
  _decideMatch() {
    const { roundsToWin, maxRounds } = this.cfg;
    if (this.wins[0] >= roundsToWin) return 0;
    if (this.wins[1] >= roundsToWin) return 1;
    if (this.round >= maxRounds) {
      if (this.wins[0] === this.wins[1]) return 'draw';
      return this.wins[0] > this.wins[1] ? 0 : 1;
    }
    return null;
  }
}

