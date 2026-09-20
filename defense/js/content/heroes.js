import { deepFreeze } from './combat.js';

const DIRECTION_IDS = ['front', 'back', 'left', 'right'];

function heroAssetIds(heroId) {
  return {
    portrait: `portrait/${heroId}`,
    battle: Object.fromEntries(DIRECTION_IDS.map((direction) => [direction, `battle/${heroId}/${direction}`])),
  };
}

function trait(id, level, name, conditions, effects, description = '') {
  return {
    id,
    level,
    name,
    displayName: name,
    description,
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

function companion(id, name, gender, element, role, basic, special, traits, extra = {}) {
  return { id, name, displayName: name, gender, element, role, position: 'normal', kind: 'normal',
    tags: [], attack: attack(basic), skill: skill({ id: id + '_skill', ...special }), traits,
    assetIds: heroAssetIds(id), ...extra };
}
const status = (statusId, durationSeconds = 4) => ({ type: 'apply_status', statusId, durationSeconds, chance: 1 });
const damage = value => ({ type: 'multiply_damage', value, damageKind: 'direct' });
const whenStatus = statusId => ({ type: 'target_has_status', statusId });
const skillOnly = { type: 'attack_kind', attackKind: 'skill' };

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
      ], '범위 8 오라로 아군에게 스타파우더(사거리 +1)를 뿌린다.'),
      trait('rumi_moon_form', 4, '달의형태', [], [
        { type: 'provide_aura', buffId: 'moon_bless', range: 8 },
      ], '범위 8 오라로 아군에게 달의축복(공격 속도 15% 증가)을 건다.'),
      trait('rumi_dream_form', 6, '꿈의형태', [], [
        { type: 'increase_aura_range_tier', target: 'all_allied_aura_providers', maximumRange: 10 },
      ], '아군 오라 제공자의 오라 범위를 한 단계 넓힌다. (최대 10)'),
      trait('rumi_sun_form', 6, '태양의형태', [], [
        { type: 'provide_aura', buffId: 'sun_bless', range: 8 },
      ], '범위 8 오라로 아군에게 태양의축복(물리 피해 +20%, 치명타 피해 +50%)을 건다.'),
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
      shape: 'melee',
      damage: 117,
      onHitEffects: [
        { type: 'apply_status', statusId: 'darkness', durationSeconds: 5, chance: 1, trigger: 'after_hit' },
      ],
    }),
    traits: [
      trait('luna_assassin_nail', 4, '어쌔신네일', [
        { type: 'target_has_status', statusId: 'darkness' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ], '어둠 상태의 적에게 주는 피해가 2배가 된다.'),
      trait('luna_genocide', 4, '제노사이드', [
        { type: 'source_has_no_named_buff' },
      ], [
        { type: 'add_crit_chance', value: 0.15, target: 'source' },
      ], '버프를 받지 않은 동안 치명타 확률 +15%p.'),
      trait('luna_evil_eye', 6, '마안', [], [
        { type: 'floor_matchup_multiplier', value: 1, dimension: 'attack_type' },
      ], '상성 배수의 하한을 1.0으로 고정해 불리한 상성에서도 피해가 깎이지 않는다.'),
      trait('luna_god_killer', 6, '갓킬러', [
        { type: 'is_boss' },
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 3, damageKind: 'direct' },
      ], '보스에게 스킬로 주는 피해가 3배가 된다.'),
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
      damage: 16,
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
      ], '기본 공격이 적중하면 감속을 건다.'),
      trait('cinderella_divine_piercing', 4, '디바인피어싱', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'apply_status', statusId: 'curse', chance: 1, trigger: 'after_hit' },
      ], '스킬이 적중하면 저주를 건다.'),
      trait('cinderella_shattering_beat', 6, '샤터링비트', [
        { type: 'target_has_any_debuff' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ], '디버프가 있는 적에게 주는 피해가 1.5배가 된다.'),
      trait('cinderella_miracle_spell', 6, '미라클스펠', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'apply_status', statusId: 'stun', chance: 1, trigger: 'after_hit' },
      ], '스킬이 적중하면 기절을 건다.'),
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
      attackType: 'flame',
      cooldown: 7,
      shape: 'melee',
      damage: 73,
    }),
    traits: [
      trait('zeke_fire_enchant', 4, '파이어인챈트', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ], '스킬 피해가 2배가 된다.'),
      trait('zeke_heavy_impact', 4, '헤비임팩트', [
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'apply_status', statusId: 'slow', chance: 0.5, trigger: 'after_hit', rngScope: 'hit' },
      ], '기본 공격 적중 시 50% 확률로 감속을 건다.'),
      trait('zeke_prominence', 6, '프로미넌스', [], [
        { type: 'provide_aura', buffId: 'sun_bless', range: 6 },
      ], '범위 6 오라로 아군에게 태양의축복(물리 피해 +20%, 치명타 피해 +50%)을 건다.'),
      trait('zeke_ragnarok', 6, '라그나로크', [
        { type: 'core_below_ratio', ratio: 0.5, inclusive: false },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ], '코어 내구도가 50% 미만이면 주는 피해가 2배가 된다.'),
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
      ], '화속성 적에게 주는 피해가 1.5배가 된다.'),
      trait('snow_rabbit_cold_chaser', 4, '콜드체이서', [
        { type: 'target_has_status', statusId: 'slow' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ], '감속된 적에게 주는 피해가 1.5배가 된다.'),
      trait('snow_rabbit_rabbit_hole', 6, '래빗홀', [], [
        { type: 'add_team_crit_chance', value: 0.20, targetTag: 'rabbit', dedupeKey: 'rabbit_hole' },
      ], '토끼 태그 영웅들의 팀 치명타 확률 +20%p. (중복 제공자 1회만 적용)'),
      trait('snow_rabbit_silver_burst', 6, '실버버스트', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ], '스킬 피해가 1.5배가 된다.'),
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
      ], '기본 공격이 적중하면 부식을 건다.'),
      trait('avalanche_maid_quick_service', 4, '퀵서비스', [], [
        { type: 'multiply_skill_cooldown', value: 0.80, target: 'source' },
      ], '스킬 쿨다운이 20% 줄어든다.'),
      trait('avalanche_maid_russian_roulette', 6, '러시안룰렛', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'random_damage_multiplier', choices: [0.5, 2], weights: [1, 1], rngScope: 'skill_action' },
      ], '스킬 피해가 무작위로 ×0.5 또는 ×2가 된다.'),
      trait('avalanche_maid_moonlight_service', 6, '문라이트서비스', [], [
        { type: 'provide_aura', buffId: 'moon_bless', range: 6 },
      ], '범위 6 오라로 아군에게 달의축복(공격 속도 15% 증가)을 건다.'),
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
      ], '어둠 상태의 적에게 주는 피해가 1.5배가 된다.'),
      trait('night_rabbit_long_jump', 4, '롱점프', [], [
        { type: 'add_range', value: 1, target: 'source' },
      ], '공격 범위가 +1 늘어난다.'),
      trait('night_rabbit_rabbit_hole', 6, '래빗홀', [], [
        { type: 'add_team_crit_chance', value: 0.20, targetTag: 'rabbit', dedupeKey: 'rabbit_hole' },
      ], '토끼 태그 영웅들의 팀 치명타 확률 +20%p. (중복 제공자 1회만 적용)'),
      trait('night_rabbit_full_moon_jump', 6, '풀문점프', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
      ], '스킬 피해가 1.5배가 된다.'),
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
      archetype: 'nova',
      attackType: 'normal',
      range: 4,
      interval: 2.5,
      damage: 20,
      radius: 2.5,
      effectPreset: 'basic_nova_hit',
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
      ], '기본 공격이 적중하면 부식을 건다.'),
      trait('guardian_world_shield', 4, '월드실드', [], [
        { type: 'multiply_core_damage', value: 0.5, target: 'core', dedupeKey: 'world_shield' },
      ], '코어가 받는 피해가 절반이 된다.'),
      trait('guardian_battlefield', 6, '배틀필드', [], [
        { type: 'provide_aura', buffId: 'earth_bless', range: 4 },
      ], '범위 4 오라로 아군에게 대지의축복(직접 피해 +20%)을 건다.'),
      trait('guardian_ground_zero', 6, '그라운드제로', [
        { type: 'target_has_status', statusId: 'slow' },
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ], '감속된 적에게 스킬 피해가 2배가 된다.'),
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
      ], '기본 공격 산탄 알마다 50% 확률로 부식을 건다.'),
      trait('storm_sage_downburst', 4, '다운버스트', [
        { type: 'attack_kind', attackKind: 'skill' },
      ], [
        { type: 'apply_status', statusId: 'slow', chance: 1, trigger: 'after_hit' },
      ], '스킬 적중 시 감속을 건다.'),
      trait('storm_sage_earth_resonance', 6, '어스레조넌스', [
        { type: 'source_has_buff', buffId: 'earth_bless' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ], '대지의축복 버프를 받는 동안 주는 피해가 2배가 된다.'),
      trait('storm_sage_sky_breaker', 6, '스카이브레이커', [
        { type: 'target_defense_type', defenseType: 'air' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ], '공중형 적에게 주는 피해가 2배가 된다.'),
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
      archetype: 'laser',
      attackType: 'anti_air',
      range: 8,
      interval: 3,
      damage: 24,
      normalCollisionRadius: 0.45,
      bossCollisionRadius: 0.60,
      effectPreset: 'basic_laser_hit',
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
      ], '어둠 속성 적에게 주는 피해가 1.5배가 된다.'),
      trait('lightning_sage_thunder_execution', 4, '썬더엑시큐션', [
        { type: 'is_boss' },
        { type: 'attack_kind', attackKind: 'basic' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct' },
      ], '보스에게 기본 공격 피해가 2배가 된다.'),
      trait('lightning_sage_chain_judgment', 6, '체인저지먼트', [], [
        { type: 'multiply_damage_by_debuff_count', amountPerDebuff: 0.5, uniqueStatusIdsOnly: true },
      ], '적에게 걸린 고유 디버프 하나당 피해가 +50%씩 증가한다.'),
      trait('lightning_sage_revenge_thunder', 6, '리벤지썬더', [
        { type: 'core_damaged_previous_wave' },
      ], [
        { type: 'multiply_damage', value: 2, damageKind: 'direct', expiresAfterWave: true },
      ], '이전 웨이브에 코어가 피해를 입었다면 이번 웨이브 동안 주는 피해가 2배가 된다.'),
    ],
    assetIds: heroAssetIds('lightning_sage'),
  },
  companion('red_dragon', '레드드래곤', 'female', 'fire', 'dealer',
    { archetype: 'shotgun', attackType: 'flame', range: 3.4, interval: 1.8, damage: 7,
      pelletCount: 3, spreadDegrees: [-16, 0, 16], normalCollisionRadius: .3, bossCollisionRadius: .45,
      effectPreset: 'basic_shotgun_hit' },
    { name: '파이어브레스', attackType: 'flame', cooldown: 8, shape: 'area', damage: 45, radius: 2,
      onHitEffects: [status('burn', 4)] },
    [
      trait('red_dragon_embers', 4, '잔불 추격', [whenStatus('burn')], [damage(1.4)], '작열 상태의 적에게 직접 피해 +40%.'),
      trait('red_dragon_claws', 4, '용의 발톱', [], [status('corrosion', 4)], '공격 적중 시 4초 부식. 물리 공격 동료와 연계한다.'),
      trait('red_dragon_solar', 6, '태양의 날개', [{ type: 'source_has_buff', buffId: 'sun_bless' }], [damage(1.5)], '태양의축복을 받는 동안 직접 피해 +50%.'),
      trait('red_dragon_breath', 6, '용의 포효', [skillOnly], [damage(1.6), status('stun', .7)], '브레스 피해 +60%, 0.7초 기절.'),
    ], { tags: ['dragon'] }),
  companion('flame_sage', '화염의현자', 'male', 'fire', 'buffer',
    { archetype: 'rapid', attackType: 'flame', range: 2.6, interval: 1.1, damage: 7, effectPreset: 'basic_ranged_hit' },
    { name: '프로미넌스', attackType: 'flame', cooldown: 8, shape: 'area', damage: 28, radius: 1.8,
      onHitEffects: [status('burn', 5)] },
    [
      trait('flame_sage_cinders', 4, '불씨 전파', [{ type: 'attack_kind', attackKind: 'basic' }], [status('burn', 4)], '기본 공격으로도 4초 작열을 남긴다.'),
      trait('flame_sage_sanctuary', 4, '불꽃 성역', [], [{ type: 'provide_aura', buffId: 'sanctuary', range: 4 }], '주변 범위 4에 마법 피해 +30% 오라.'),
      trait('flame_sage_trinity', 6, '세 개의 태양', [{ type: 'team_element_count', element: 'fire', count: 3 }], [{ type: 'provide_aura', buffId: 'twinkle_party', range: 4 }], '배치한 화속성 영웅이 3명 이상이면 주변 치명타 확률 +20%p.'),
      trait('flame_sage_eruption', 6, '화산의 심장', [whenStatus('burn')], [damage(1.8)], '작열 적에게 직접 피해 +80%.'),
    ], { innateAuras: [{ buffId: 'sun_bless', range: 4 }] }),
  companion('mushroom_king', '머쉬룸킹', 'male', 'nature', 'dealer',
    { archetype: 'nova', attackType: 'magic', range: 2.3, radius: 2.3, interval: 2.1, damage: 16,
      statuses: [status('poison', 5)], effectPreset: 'basic_nova_hit' },
    { name: '그랜드슬램', attackType: 'normal', cooldown: 8, shape: 'area', damage: 40, radius: 2,
      onHitEffects: [status('slow', 2)] },
    [
      trait('mushroom_king_harvest', 4, '마지막 수확', [{ type: 'target_hp_below_ratio', ratio: .5 }], [damage(1.5)], '생명력 50% 이하의 적에게 직접 피해 +50%.'),
      trait('mushroom_king_mycelium', 4, '균사의 숲', [], [{ type: 'add_range', value: .6 }], '포자 노바와 스킬 표적 사거리 +0.6.'),
      trait('mushroom_king_earth', 6, '대지의 왕관', [{ type: 'source_has_buff', buffId: 'earth_bless' }], [damage(1.7)], '대지의축복을 받으면 직접 피해 +70%.'),
      trait('mushroom_king_spores', 6, '깊은 포자', [skillOnly], [status('curse', 6), status('poison', 8)], '스킬이 6초 저주와 8초 중독을 남긴다.'),
    ]),
  companion('great_detective', '명탐정', 'male', 'water', 'balancer',
    { archetype: 'laser', attackType: 'holy', range: 6, interval: 2.6, damage: 19,
      normalCollisionRadius: .35, bossCollisionRadius: .5, effectPreset: 'basic_laser_hit' },
    { name: '파이널 앤서', attackType: 'holy', cooldown: 8, shape: 'single', damage: 52, onHitEffects: [status('curse', 5)] },
    [
      trait('great_detective_evidence', 4, '다섯 번째 단서', [{ type: 'attack_count_modulo', mod: 5 }], [{ type: 'add_crit_chance', value: 1 }], '다섯 번째 기본 공격마다 반드시 치명타.'),
      trait('great_detective_lucid', 4, '루시드 플래시', [skillOnly], [status('darkness', 4)], '스킬이 4초 암흑을 남겨 모든 직접 공격을 돕는다.'),
      trait('great_detective_answer', 6, '완벽한 추론', [{ type: 'target_has_any_debuff' }], [damage(1.5)], '디버프가 있는 적에게 직접 피해 +50%.'),
      trait('great_detective_search', 6, '넓은 수사망', [], [{ type: 'add_range', value: 1.5 }], '관통과 스킬 표적 사거리 +1.5.'),
    ]),
  companion('siren', '세이렌', 'female', 'water', 'buffer',
    { archetype: 'rapid', attackType: 'magic', range: 2.8, interval: 1.3, damage: 7, effectPreset: 'basic_ranged_hit' },
    { name: '타이달 스크림', attackType: 'magic', cooldown: 9, shape: 'area', damage: 25, radius: 2,
      onHitEffects: [status('slow', 3)] },
    [
      trait('siren_duet', 4, '달빛 이중창', [{ type: 'team_element_count', element: 'water', count: 2 }], [{ type: 'provide_aura', buffId: 'twinkle_party', range: 4 }], '배치한 물속성 영웅이 2명 이상이면 주변 치명타 확률 +20%p.'),
      trait('siren_echo', 4, '메아리', [], [{ type: 'multiply_skill_cooldown', value: .7 }], '타이달 스크림 쿨다운 30% 감소.'),
      trait('siren_starlight', 6, '별빛 항로', [], [{ type: 'provide_aura', buffId: 'star_powder', range: 4 }], '주변 범위 4에 사거리 +1 오라.'),
      trait('siren_lullaby', 6, '깊은 자장가', [skillOnly], [status('stun', 1)], '타이달 스크림이 1초 기절도 남긴다.'),
    ], { innateAuras: [{ buffId: 'moon_bless', range: 4 }] }),
  companion('phantom', '팬텀', 'male', 'dark', 'dealer',
    { archetype: 'burst', attackType: 'magic', range: 5, interval: 2.4, damage: 29, effectPreset: 'basic_ranged_hit' },
    { name: '나이트메어', attackType: 'magic', cooldown: 9, shape: 'area', damage: 50, radius: 1.8,
      onHitEffects: [status('darkness', 4)] },
    [
      trait('phantom_nightmare', 4, '잠들지 않는 악몽', [whenStatus('darkness')], [damage(1.5)], '암흑 상태의 적에게 직접 피해 +50%.'),
      trait('phantom_curse', 4, '저주받은 인형', [{ type: 'attack_kind', attackKind: 'basic' }], [status('curse', 4)], '기본 공격이 4초 저주를 남긴다.'),
      trait('phantom_solitude', 6, '혼자만의 세계', [], [{ type: 'add_range', value: 1.5 }, { type: 'multiply_skill_cooldown', value: .85 }], '사거리 +1.5, 스킬 쿨다운 15% 감소.'),
      trait('phantom_dread', 6, '악몽의 왕', [], [{ type: 'multiply_damage_by_debuff_count', amountPerDebuff: .2 }], '적의 고유 디버프 하나당 직접 피해 +20%.'),
    ], { auraImmune: true }),
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
