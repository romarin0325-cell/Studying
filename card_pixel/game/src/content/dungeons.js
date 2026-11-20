import { INTRO } from './intro.js';

const EMBER = { id: 'ember_carry' };
const BELL = { id: 'twilight_bell', turns: [3, 6, 9], stacks: 2 };
const SKY = { id: 'starlit_sky' };
const TIDE = { id: 'tide_cycle' };
const ARENA = { id: 'arena_charge' };
const APPROACH = [0.86, 1, 1, 0.96, 1, 1.20, 1];
const nightmare = scale => ({ scale, extraAffix: true });

const standard = {
  floors: 8, layout: 'expedition',
  tiers: [...APPROACH, 1.20],
  nightmareRule: nightmare(1.10)
};

export const DUNGEONS = {
  dawn_forest: {
    id: 'dawn_forest', name: '새벽의 숲', background: 'dawn_forest',
    pool: { name: '입문 풀', ids: ['ash', 'snow_rabbit', 'silver_rabbit', 'night_rabbit', 'sunflower', 'siren',
      'aurora', 'guardian', 'storm_sage', 'luna', 'queen', 'rumi', 'red_dragon', 'gold_dragon'] },
    floors: 5, layout: 'intro', tiers: [1, 1, 0.56, 1, 0.46],
    wild: ['golem', 'emerald_beetle', 'gold_moth'], boss: INTRO.boss.id,
    hiddenBosses: [], nightmareRule: null, region: null, unlock: { kind: 'initial' }
  },
  ember_volcano: {
    ...standard, id: 'ember_volcano', name: '홍련 화산', background: 'ember_volcano',
    tiers: [...APPROACH, 1.25],
    nightmareRule: nightmare(1), // The two-enemy rooms, extra affixes, and hidden boss supply the pressure.
    pool: { set: 'ember_relay' }, wild: ['magma_beetle', 'golem', 'emerald_beetle'],
    boss: 'iris_curse', hiddenBosses: ['artificial_demon_god'], region: EMBER, unlock: { kind: 'intro_clear' }
  },
  twilight_cathedral: {
    ...standard, id: 'twilight_cathedral', name: '황혼 성당', background: 'twilight_cathedral',
    nightmareRule: nightmare(1.28), // Gray was a softer finale than the other hidden bosses.
    pool: { set: 'twilight_liturgy' }, wild: ['wraith', 'night_bat', 'dark_knight'],
    boss: 'iris_love', hiddenBosses: ['gray'], region: BELL, unlock: { kind: 'intro_clear' }
  },
  starlit_garden: {
    ...standard, id: 'starlit_garden', name: '별빛 정원', background: 'starlit_garden',
    pool: { set: 'starlit_garden', spriteFallback: ['shooting_star_boy'] },
    wild: ['gold_moth', 'emerald_beetle', 'treant'], boss: 'pharaoh', hiddenBosses: ['flora'],
    region: SKY, unlock: { kind: 'early_region_clear' }
  },
  midnight_trench: {
    ...standard, id: 'midnight_trench', name: '심야의 해구', background: 'midnight_trench',
    tiers: [0.86, 1, 1, 1.16, 1, 1.20, 1, 1.18], // Floor-four shadows last long enough to show their opening.
    nightmareRule: nightmare(1), // The stronger gate still applies alongside the extra affixes and hidden boss.
    pool: { set: 'midnight_tide' }, wild: ['abyss_eye', 'wraith', 'night_bat'],
    boss: 'poseidon', hiddenBosses: ['demon_god'], region: TIDE, unlock: { kind: 'early_region_clear' }
  },
  arena: {
    ...standard, id: 'arena', name: '투기장', background: 'arena',
    tiers: [...APPROACH, 1.23],
    pool: { set: 'arena_company', spriteFallback: ['underdog', 'joker', 'night_rabbit', 'siren'] },
    wild: ['golem', 'dark_knight', 'emerald_beetle'], boss: 'ares', hiddenBosses: ['thor'],
    region: ARENA, unlock: { kind: 'early_region_clear' }
  },
  creation_tower: {
    ...standard, id: 'creation_tower', name: '창조의 탑', background: 'creation_tower',
    tiers: [...APPROACH, 1.06],
    nightmareRule: nightmare(1.05),
    pool: { all: true, name: '전체 동료' }, wild: ['golem', 'magma_beetle', 'gold_moth', 'wraith', 'abyss_eye', 'dark_knight'],
    boss: 'creator_god', hiddenBosses: [],
    region: { first: [EMBER, BELL, SKY, TIDE, ARENA], second: [EMBER, BELL, SKY, TIDE, ARENA] },
    unlock: { kind: 'region_clear_count', count: 3 }
  }
};
