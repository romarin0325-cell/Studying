import { deepFreeze } from './combat.js';

const DIRECTION_IDS = ['front', 'back', 'left', 'right'];

function heroAssetIds(heroId) {
  return {
    portrait: `portrait/${heroId}`,
    battle: Object.fromEntries(DIRECTION_IDS.map((direction) => [direction, `battle/${heroId}/${direction}`])),
  };
}

function trait(id, level, name, conditions, effects) {
  return {
    id,
    level,
    name,
    displayName: name,
    conditions,
    effects,
  };
}

function attack({ archetype, attackType, range, interval, damage, effectPreset, ...rest }) {
  return {
    archetype,
    attackType,
    range,
    interval,
    intervalSeconds: interval,
    damage,
    baseDamage: damage,
    effectPreset,
    ...rest,
  };
}

function skill({ id, name, attackType, cooldown, shape, damage, radius = 0, onHitEffects = [] }) {
  return {
    id,
    name,
    displayName: name,
    attackType,
    cooldown,
    cooldownSeconds: cooldown,
    shape,
    damage,
    baseDamage: damage,
    radius,
    effectPreset: shape === 'area' ? 'skill_area_hit' : 'skill_single_hit',
    autoTarget: true,
    holdAtReadyWithoutTarget: true,
    timerIndependentFromBasicAttack: true,
    onHitEffects,
  };
}

export const HEROES = deepFreeze([
  {
    id: 'rumi',
    name: '루미',
    displayName: '루미',
    position: 'main',
    kind: 'main',
    element: 'water',
    role: 'buffer',
    tags: [],
    attack: attack({
      archetype: 'shotgun',
      attackType: 'magic',
      range: 4,
      interval: 2,
      damage: 8.75,
      pelletDamage: 8.75,
      pelletCount: 3,
      spreadDegrees: [-12, 0, 12],
      normalCollisionRadius: 0.30,
      bossCollisionRadius: 0.45,
      effectPreset: 'basic_shotgun_hit',
    }),
    skill: skill({
      id: 'rumi_milky_way_ecstasy',
      name: '밀키웨이 엑스터시',
      attackType: 'magic',
      cooldown: 7,
      shape: 'area',
      damage: 31.5,
      radius: 3,
    }),
    traits: [
      trait('rumi_star_form', 4, '별의형태', [], [
        { type: 'provide_aura', buffId: 'star_powder', range: 8 },
      ]),
      trait('rumi_moon_form', 4, '달의형태', [], [
        { type: 'provide_aura', buffId: 'moon_bless', range: 8 },
      ]),
      trait('rumi_dream_form', 6, '꿈의형태', [], [
        { type: 'increase_aura_range_tier', target: 'all_allied_aura_providers', maximumRange: 10 },
      ]),
      trait('rumi_sun_form', 6, '태양의형태', [], [
        { type: 'provide_aura', buffId: 'sun_bless', range: 8 },
      ]),
    ],
    assetIds: heroAssetIds('rumi'),
  },
  {
    id: 'luna',
    name: '루나',
    displayName: '루나',
    position: 'main',
    kind: 'main',
    element: 'dark',
    role: 'dealer',
    tags: [],
    attack: attack({
      archetype: 'melee',
      attackType: 'lethal',
      range: 2,
      interval: 1,
      damage: 18,
      effectPreset: 'basic_melee_hit',
    }),
    skill: skill({
      id: 'luna_eclipse',
      name: '이클립스',
      attackType: 'lethal',
      cooldown: 9,
      shape: 'single',
      damage: 90,
      onHitEffects: [
        { type: 'apply_status', statusId: 'darkness', durationSeconds: 5, chance: 1, trigger: 'after_hit' },
      ],
    }),
    traits: [
      trait('luna_assassin_nail', 4, '어쌔신네일', [
        { type: 'target_has_status', statusId: 'darkness' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ]),
      trait('luna_genocide', 4, '제노사이드', [
        { type: 'source_has_no_named_buff' },
      ], [
        { type: 'add_crit_chance', value: 0.15, target: 'source' },
      ]),
      trait('luna_evil_eye', 6, '마안', [], [
        { type: 'floor_matchup_multiplier', value: 1, dimension: 'attack_type' },
      ]),
      trait('luna_god_killer', 6, '갓킬러', [
        { type: 'is_boss' },
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 3, damageKind: 'direct' },
      ]),
    ],
    assetIds: heroAssetIds('luna'),
  },
  {
    id: 'cinderella',
    name: '신데렐라',
    displayName: '신데렐라',
    position: 'main',
    kind: 'main',
    element: 'light',
    role: 'debuffer',
    tags: [],
    attack: attack({
      archetype: 'area',
      attackType: 'holy',
      range: 5,
      interval: 2,
      damage: 12,
      radius: 2,
      effectPreset: 'basic_area_hit',
    }),
    skill: skill({
      id: 'cinderella_midnight_spell',
      name: '미드나잇스펠',
      attackType: 'holy',
      cooldown: 5,
      shape: 'area',
      damage: 22.5,
      radius: 3,
    }),
    traits: [
      trait('cinderella_glass_slipper', 4, '유리구두', [
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'apply_status', statusId: 'slow', chance: 1, trigger: 'after_hit' },
      ]),
      trait('cinderella_divine_piercing', 4, '디바인피어싱', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'apply_status', statusId: 'curse', chance: 1, trigger: 'after_hit' },
      ]),
      trait('cinderella_shattering_beat', 6, '샤터링비트', [
        { type: 'target_has_any_debuff' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ]),
      trait('cinderella_miracle_spell', 6, '미라클스펠', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'apply_status', statusId: 'stun', chance: 1, trigger: 'after_hit' },
      ]),
    ],
    assetIds: heroAssetIds('cinderella'),
  },
  {
    id: 'zeke',
    name: '지크',
    displayName: '지크',
    position: 'main',
    kind: 'main',
    element: 'fire',
    role: 'balancer',
    tags: [],
    attack: attack({
      archetype: 'melee',
      attackType: 'normal',
      range: 2,
      interval: 1,
      damage: 16,
      effectPreset: 'basic_melee_hit',
    }),
    skill: skill({
      id: 'zeke_ignis_smash',
      name: '이그니스스매시',
      attackType: 'normal',
      cooldown: 7,
      shape: 'area',
      damage: 42,
      radius: 3,
    }),
    traits: [
      trait('zeke_fire_enchant', 4, '파이어인챈트', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ]),
      trait('zeke_heavy_impact', 4, '헤비임팩트', [
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'apply_status', statusId: 'slow', chance: 0.5, trigger: 'after_hit', rngScope: 'hit' },
      ]),
      trait('zeke_prominence', 6, '프로미넌스', [], [
        { type: 'provide_aura', buffId: 'sun_bless', range: 6 },
      ]),
      trait('zeke_ragnarok', 6, '라그나로크', [
        { type: 'core_below_ratio', ratio: 0.5, inclusive: false },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ]),
    ],
    assetIds: heroAssetIds('zeke'),
  },
  {
    id: 'snow_rabbit',
    name: '눈토끼',
    displayName: '눈토끼',
    position: 'normal',
    kind: 'normal',
    element: 'water',
    role: 'dealer',
    tags: ['rabbit'],
    attack: attack({
      archetype: 'rapid',
      attackType: 'magic',
      range: 4,
      interval: 0.5,
      damage: 6,
      effectPreset: 'basic_ranged_hit',
    }),
    skill: skill({
      id: 'snow_rabbit_silver_storm',
      name: '실버스톰',
      attackType: 'magic',
      cooldown: 5,
      shape: 'area',
      damage: 37.5,
      radius: 3,
    }),
    traits: [
      trait('snow_rabbit_frozen_hunt', 4, '프로즌헌트', [
        { type: 'target_element', element: 'fire' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ]),
      trait('snow_rabbit_cold_chaser', 4, '콜드체이서', [
        { type: 'target_has_status', statusId: 'slow' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ]),
      trait('snow_rabbit_rabbit_hole', 6, '래빗홀', [], [
        { type: 'add_team_crit_chance', value: 0.20, targetTag: 'rabbit', dedupeKey: 'rabbit_hole' },
      ]),
      trait('snow_rabbit_silver_burst', 6, '실버버스트', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ]),
    ],
    assetIds: heroAssetIds('snow_rabbit'),
  },
  {
    id: 'avalanche_maid',
    name: '아발란체메이드',
    displayName: '아발란체메이드',
    position: 'normal',
    kind: 'normal',
    element: 'water',
    role: 'balancer',
    tags: [],
    attack: attack({
      archetype: 'burst',
      attackType: 'lethal',
      range: 6,
      interval: 3,
      damage: 36,
      effectPreset: 'basic_ranged_hit',
    }),
    skill: skill({
      id: 'avalanche_maid_ice_age',
      name: '아이스에이지',
      attackType: 'lethal',
      cooldown: 9,
      shape: 'single',
      damage: 72,
    }),
    traits: [
      trait('avalanche_maid_armor_crash', 4, '아머크래시', [
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'apply_status', statusId: 'corrosion', chance: 1, trigger: 'after_hit' },
      ]),
      trait('avalanche_maid_quick_service', 4, '퀵서비스', [], [
        { type: 'multiply_skill_cooldown', value: 0.80, target: 'source' },
      ]),
      trait('avalanche_maid_russian_roulette', 6, '러시안룰렛', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'random_damage_multiplier', choices: [0.5, 2], weights: [1, 1], rngScope: 'skill_action' },
      ]),
      trait('avalanche_maid_moonlight_service', 6, '문라이트서비스', [], [
        { type: 'provide_aura', buffId: 'moon_bless', range: 6 },
      ]),
    ],
    assetIds: heroAssetIds('avalanche_maid'),
  },
  {
    id: 'night_rabbit',
    name: '밤토끼',
    displayName: '밤토끼',
    position: 'normal',
    kind: 'normal',
    element: 'dark',
    role: 'dealer',
    tags: ['rabbit'],
    attack: attack({
      archetype: 'burst',
      attackType: 'normal',
      range: 6,
      interval: 3,
      damage: 42,
      effectPreset: 'basic_ranged_hit',
    }),
    skill: skill({
      id: 'night_rabbit_hop_hop',
      name: '깡총깡총',
      attackType: 'normal',
      cooldown: 7,
      shape: 'single',
      damage: 70,
    }),
    traits: [
      trait('night_rabbit_night_hunt', 4, '나이트헌트', [
        { type: 'target_has_status', statusId: 'darkness' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ]),
      trait('night_rabbit_long_jump', 4, '롱점프', [], [
        { type: 'add_range', value: 1, target: 'source' },
      ]),
      trait('night_rabbit_rabbit_hole', 6, '래빗홀', [], [
        { type: 'add_team_crit_chance', value: 0.20, targetTag: 'rabbit', dedupeKey: 'rabbit_hole' },
      ]),
      trait('night_rabbit_full_moon_jump', 6, '풀문점프', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ]),
    ],
    assetIds: heroAssetIds('night_rabbit'),
  },
  {
    id: 'guardian',
    name: '가디언',
    displayName: '가디언',
    position: 'normal',
    kind: 'normal',
    element: 'nature',
    role: 'balancer',
    tags: [],
    attack: attack({
      archetype: 'melee',
      attackType: 'normal',
      range: 2,
      interval: 1,
      damage: 14,
      effectPreset: 'basic_melee_hit',
    }),
    skill: skill({
      id: 'guardian_pangaea_reverse',
      name: '판게아리버스',
      attackType: 'normal',
      cooldown: 7,
      shape: 'single',
      damage: 56,
    }),
    traits: [
      trait('guardian_earth_breaker', 4, '어스브레이커', [
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'apply_status', statusId: 'corrosion', chance: 1, trigger: 'after_hit' },
      ]),
      trait('guardian_world_shield', 4, '월드실드', [], [
        { type: 'multiply_core_damage', value: 0.5, target: 'core', dedupeKey: 'world_shield' },
      ]),
      trait('guardian_battlefield', 6, '배틀필드', [], [
        { type: 'provide_aura', buffId: 'earth_bless', range: 4 },
      ]),
      trait('guardian_ground_zero', 6, '그라운드제로', [
        { type: 'target_has_status', statusId: 'slow' },
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ]),
    ],
    assetIds: heroAssetIds('guardian'),
  },
  {
    id: 'storm_sage',
    name: '폭풍의현자',
    displayName: '폭풍의현자',
    position: 'normal',
    kind: 'normal',
    element: 'nature',
    role: 'debuffer',
    tags: [],
    attack: attack({
      archetype: 'shotgun',
      attackType: 'anti_air',
      range: 4,
      interval: 2,
      damage: 7.5,
      pelletDamage: 7.5,
      pelletCount: 3,
      spreadDegrees: [-12, 0, 12],
      normalCollisionRadius: 0.30,
      bossCollisionRadius: 0.45,
      effectPreset: 'basic_shotgun_hit',
    }),
    skill: skill({
      id: 'storm_sage_rust_breeze',
      name: '러스트브리즈',
      attackType: 'anti_air',
      cooldown: 7,
      shape: 'area',
      damage: 31.5,
      radius: 3,
    }),
    traits: [
      trait('storm_sage_corroding_wind', 4, '코로드윈드', [
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'apply_status', statusId: 'corrosion', chance: 0.5, trigger: 'after_hit', rngScope: 'pellet' },
      ]),
      trait('storm_sage_downburst', 4, '다운버스트', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'apply_status', statusId: 'slow', chance: 1, trigger: 'after_hit' },
      ]),
      trait('storm_sage_earth_resonance', 6, '어스레조넌스', [
        { type: 'source_has_buff', buffId: 'earth_bless' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ]),
      trait('storm_sage_sky_breaker', 6, '스카이브레이커', [
        { type: 'target_defense_type', defenseType: 'air' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ]),
    ],
    assetIds: heroAssetIds('storm_sage'),
  },
  {
    id: 'lightning_sage',
    name: '번개의현자',
    displayName: '번개의현자',
    position: 'normal',
    kind: 'normal',
    element: 'light',
    role: 'dealer',
    tags: [],
    attack: attack({
      archetype: 'burst',
      attackType: 'anti_air',
      range: 6,
      interval: 3,
      damage: 42,
      effectPreset: 'basic_ranged_hit',
    }),
    skill: skill({
      id: 'lightning_sage_rain_of_thunder',
      name: '레인오브썬더',
      attackType: 'anti_air',
      cooldown: 9,
      shape: 'area',
      damage: 67.5,
      radius: 3,
    }),
    traits: [
      trait('lightning_sage_dark_punisher', 4, '다크퍼니셔', [
        { type: 'target_element', element: 'dark' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ]),
      trait('lightning_sage_thunder_execution', 4, '썬더엑시큐션', [
        { type: 'is_boss' },
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ]),
      trait('lightning_sage_chain_judgment', 6, '체인저지먼트', [], [
        { type: 'multiply_damage_by_debuff_count', amountPerDebuff: 0.5, uniqueStatusIdsOnly: true },
      ]),
      trait('lightning_sage_revenge_thunder', 6, '리벤지썬더', [
        { type: 'core_damaged_previous_wave' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct', expiresAfterWave: true },
      ]),
    ],
    assetIds: heroAssetIds('lightning_sage'),
  },
]);

export const HERO_BY_ID = deepFreeze(Object.fromEntries(HEROES.map((hero) => [hero.id, hero])));
export const MAIN_HEROES = deepFreeze(HEROES.filter((hero) => hero.position === 'main'));
export const NORMAL_HEROES = deepFreeze(HEROES.filter((hero) => hero.position === 'normal'));
export const HERO_TRAITS = deepFreeze(HEROES.flatMap((hero) => hero.traits));
export const DEFAULT_FORMATION = deepFreeze({
  mainId: 'rumi',
  heroIds: ['snow_rabbit', 'avalanche_maid', 'guardian', 'lightning_sage'],
});

export default HEROES;
