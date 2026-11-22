export const TEMPO_VERSION = 2;
export const EASY_ENEMY_ATTACK = 0.65;
export const ENTRY_FIRST_MAIN_ENEMY_HP = 0.79;
export const START_MP = 65;
export const REINFORCE_FLOORS = [1, 2, 6];
export const ROSTER_LIMIT = 6;
export const REINFORCE_CHOICES = 3;
export const BLESSING_MULTIPLIERS = {
  normal: 1.6, rare: 1.45, epic: 1.3, event: 1.3, legend: 1.15, transcendence: 1.15
};

// Pairs are [HP, ATK/MATK], applied after the existing dungeon and floor tiers.
export const ROOM_MULTIPLIERS = {
  wild: [0.67, 2.8], risk: [0.76, 3.3], gate: [1.25, 4.9], elite: [1.18, 3.4], boss: [1, 1]
};
export const REGION_MULTIPLIERS = {
  ember_volcano: { wild: [0.64, 2.35], risk: [0.73, 2.75], boss: [0.63, 1.69] },
  twilight_cathedral: { wild: [0.67, 2.70], risk: [0.76, 2.95], gate: [1.27, 5.20], elite: [1.32, 3.4], boss: [0.655, 1.70] },
  starlit_garden: { wild: [0.65, 2.55], risk: [0.76, 3.10], gate: [1.19, 4.56], boss: [0.62, 1.66] },
  midnight_trench: { wild: [0.72, 3.35], risk: [0.76, 3.55], boss: [0.62, 1.80] },
  arena: { wild: [0.65, 2.0], risk: [0.75, 2.35], boss: [0.68, 1.68] },
  creation_tower: { boss: [0.61, 1.56] }
};
export const NIGHTMARE_MULTIPLIERS = {
  ember_volcano: { wild: [0.58, 2.2], risk: [0.69, 2.55], gate: [1.17, 4.85], elite: [0.84, 2.15], boss: [0.63, 1.65] },
  twilight_cathedral: { wild: [0.59, 1.66], risk: [0.69, 2.10], gate: [1.20, 4.65], elite: [0.87, 2.10] },
  starlit_garden: { wild: [0.61, 2.18], risk: [0.72, 2.6], gate: [1.13, 4.62], elite: [0.89, 2.20], boss: [0.64, 1.70] },
  midnight_trench: { wild: [0.68, 3.10], risk: [0.76, 3.3], gate: [1.19, 4.85], elite: [0.96, 2.7], boss: [0.61, 1.78] },
  arena: { wild: [0.60, 1.40], risk: [0.69, 1.80], gate: [1.20, 4.65], elite: [0.84, 2.05], boss: [0.66, 1.60] },
  creation_tower: { wild: [0.64, 2.32], risk: [0.74, 2.74], elite: [0.88, 2.2], boss: [0.64, 1.59] }
};
export const LESSON_NIGHTMARE_MULTIPLIERS = {
  midnight_trench: { boss: [0.64, 1.78] }
};
export const FIRST_MAIN_ASSIST = {
  gate: [0.97, 2.85], boss: [0.6, 1.6],
  ember_volcano: { boss: [0.56, 1.55] },
  twilight_cathedral: { boss: [0.53, 1.46] }
};
export const INTRO_MULTIPLIERS = { 3: [0.92, 2.8], 5: [1.12, 4.5] };

const basic = { name: '일반 공격', type: 'phy', power: 1 };
const weak = { name: '약공', type: 'phy', power: 0.55 };
export const THREE_BEAT = [basic, { signature: true, power: 1.15 }, weak];
export const STRONG_BEAT = 2;
const WILD_BEAT_PATTERNS = {
  golemCharge: {
    strong: 2,
    beats: [
      { name: '힘 충전 중', type: 'sup', power: 0, isChargeStart: true, chargeMessage: '골렘이 힘을 모으고 있습니다. (공격 없음)' },
      { name: '강타', type: 'phy', power: 1.6, chargeReset: true },
      weak
    ]
  },
  batOpening: {
    strong: 1,
    beats: [{ signature: true, power: 1 }, { name: '빈틈', type: 'rest', power: 0, vulnerable: 1.3 }, basic]
  }
};
export function wildBeatPattern(pattern) {
  return Object.hasOwn(WILD_BEAT_PATTERNS, pattern) ? WILD_BEAT_PATTERNS[pattern] : null;
}

export const TIDE_BEATS = [
  basic, { name: '잔물결', type: 'phy', power: 0.75 }, { name: '조류의 일격', type: 'mag', power: 2.5 },
  { name: '물러간 조류', type: 'rest', power: 0, vulnerable: 1.5 }
];
export const TIDE_STRONG_BEAT = 3;
export const BOSS_PREVIEW_TURNS = 15;
export const FLOOR_SEED_STEP = 0x9e3779b9;
export const TEMPO_SEEDS = { blessing: 0x95111acd, reinforcement: 0x67b8ea31 };

export function usesTempo(run) {
  return !run.daily && run.tempoVersion === TEMPO_VERSION;
}
