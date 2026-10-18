// Estados do jogo (separado para evitar import circular entre game.js e src/states/*).
export const GameState = Object.freeze({
  TITLE: 'TITLE',
  CHAR_SELECT: 'CHAR_SELECT',
  ROUND_INTRO: 'ROUND_INTRO',
  FIGHTING: 'FIGHTING',
  ROUND_END: 'ROUND_END',
  MATCH_END: 'MATCH_END',
  PAUSED: 'PAUSED',
});
