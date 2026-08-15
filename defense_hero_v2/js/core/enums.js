export const BATTLE_PHASE = Object.freeze({
  PREPARATION: 'PREPARATION',
  WAVE_RUNNING: 'WAVE_RUNNING',
  INTERMISSION: 'INTERMISSION',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT',
});

export const DIRECTION = Object.freeze({
  FRONT: 'front',
  BACK: 'back',
  LEFT: 'left',
  RIGHT: 'right',
});

export const ATTACK_KIND = Object.freeze({
  SKILL: 'skill',
  BASIC: 'basic',
  POISON: 'poison',
});

export const DIFFICULTY = Object.freeze({
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard',
});

export const BOARD = Object.freeze({ columns: 12, rows: 16 });
export const FIXED_TICK_RATE = 60;
export const FIXED_TICK_SECONDS = 1 / FIXED_TICK_RATE;
