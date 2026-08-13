export const DIFFICULTY_DEFINITIONS = Object.freeze([
  {
    id: "scout",
    name: "정찰",
    enemyHpMul: 0.88,
    enemySpeedMul: 0.93,
    startingGold: 210,
    unlockRewardMul: 0.8,
    scoreMul: 0.9,
    rules: { bossPatternIntervalMul: 1.15, eliteChanceAddFromStage4: 0 },
    description: "첫 런 추천. 보스 패턴 간격 +15%.",
  },
  {
    id: "standard",
    name: "표준",
    enemyHpMul: 1,
    enemySpeedMul: 1,
    startingGold: 180,
    unlockRewardMul: 1,
    scoreMul: 1,
    rules: { bossPatternIntervalMul: 1, eliteChanceAddFromStage4: 0 },
    description: "기획 의도와 밸런스의 기준 난도입니다.",
  },
  {
    id: "eclipse",
    name: "월식",
    enemyHpMul: 1.18,
    enemySpeedMul: 1.08,
    startingGold: 165,
    unlockRewardMul: 1.25,
    scoreMul: 1.25,
    rules: { bossPatternIntervalMul: 1, eliteChanceAddFromStage4: 0.12, enhancedBossThresholdPatterns: true },
    description: "스테이지 4부터 정예 확률 +12%p, 보스 HP 구간 패턴 강화. 속성 우위 배율은 동일합니다.",
  },
]);

export const DOCTRINE_DEFINITIONS = Object.freeze([
  { id: "doctrine_range", name: "정밀 조준", tags: ["generic", "offense"], effects: [{ type: "ally_range_mul", value: 1.1 }], description: "모든 아군 사거리 +10%." },
  { id: "doctrine_rate", name: "압축 주문", tags: ["generic", "offense"], effects: [{ type: "ally_attack_speed_mul", value: 1.12 }], description: "모든 아군 공격속도 +12%." },
  { id: "doctrine_splash", name: "확산 마법진", tags: ["splash", "aoe"], effects: [{ type: "splash_radius_mul", value: 1.2 }, { type: "splash_damage_mul", value: 1.08 }], description: "splash 반경 +20%, 범위 피해 +8%." },
  { id: "doctrine_control", name: "제어 증폭", tags: ["control"], effects: [{ type: "control_duration_and_gauge_mul", value: 1.2, bossValue: 1.1 }], description: "감속·동결·기절 지속/축적 +20%. 보스 적용은 절반." },
  { id: "doctrine_core", name: "보루 외피", tags: ["defense", "core"], effects: [{ type: "stage_start_core_shield", value: 18 }], description: "각 스테이지 시작 시 코어 보호막 +18." },
  { id: "doctrine_cost", name: "보급선 단축", tags: ["economy"], effects: [{ type: "companion_cost_mul", value: 0.88 }], description: "동료 배치 비용 -12%." },
  { id: "doctrine_relocate", name: "기동 교범", tags: ["mobility"], effects: [{ type: "relocation_cooldown_override", value: 7 }], description: "전투 중 재배치 쿨다운 10초→7초." },
  { id: "doctrine_status", name: "상태 연장", tags: ["burn", "corrosion", "curse", "darkness"], effects: [{ type: "status_duration_mul", statusIds: ["burn", "corrosion", "curse", "darkness"], value: 1.2 }], description: "작열·부식·저주·암흑 지속시간 +20%." },
]);

export const RELIC_DEFINITIONS = Object.freeze([
  { id: "relic_rabbit_hole", name: "래빗홀", tags: ["rabbit", "critical"], effects: [{ type: "tag_crit_chance_add", tag: "rabbit", value: 0.15 }, { type: "tag_range_add", tag: "rabbit", value: 0.2 }], description: "토끼 치명타 +15%p, 사거리 +0.2셀." },
  { id: "relic_overflame", name: "오버플레임", tags: ["burn"], effects: [{ type: "status_max_stacks_override", statusId: "burn", value: 7 }, { type: "first_status_application_bonus", statusId: "burn", stacks: 1 }], description: "작열 최대 5→7, 한 대상에게 작열을 처음 부여할 때 +1스택." },
  { id: "relic_assassin_nail", name: "어쌔신 네일", tags: ["corrosion", "physical"], effects: [{ type: "status_effect_override", statusId: "corrosion", field: "physicalResistAddPerStack", value: -0.16 }], description: "부식의 물리 저항 감소량 12→16%p." },
  { id: "relic_blue_moon", name: "블루문", tags: ["leader_active"], effects: [{ type: "every_nth_leader_active_refund", every: 4, cooldownRefundRatio: 0.5 }], description: "주인공 액티브 4번째 사용마다 쿨다운을 즉시 50% 환급." },
  { id: "relic_dragon_heart", name: "드래곤 하트", tags: ["dragon", "anti_air"], effects: [{ type: "tag_damage_mul", tag: "dragon", value: 1.25 }, { type: "tag_target_damage_mul", tag: "dragon", targetTag: "aerial", value: 1.15 }], description: "드래곤 태그 피해 +25%, 공중 대상 추가 +15%." },
  { id: "relic_hourglass", name: "왜곡 시계", tags: ["core", "control"], effects: [{ type: "first_core_damage_global_slow", perStage: 1, slow: 0.65, duration: 2 }], description: "스테이지당 첫 코어 피해 시 적 전체 65% 감속 2초." },
  { id: "relic_star_crown", name: "별의 왕관", tags: ["field_buff"], effects: [{ type: "global_field_buff_slot_add", value: 1 }, { type: "field_buff_duration_mul", value: 0.85 }], description: "필드버프 슬롯 +1, 필드버프 지속 -15%." },
  { id: "relic_arena", name: "아레나 문장", tags: ["basic_attack"], effects: [{ type: "basic_attack_damage_mul", value: 1.25 }, { type: "active_and_auto_skill_damage_mul", value: 0.9 }], description: "일반 공격 피해 +25%, 액티브·자동 스킬 피해 -10%." },
  { id: "relic_frozen_body", name: "프로즌 바디", tags: ["frost", "control"], effects: [{ type: "frozen_enemy_death_frost_spread", radiusCells: 0.8, gauge: 35 }], description: "동결 적 사망 시 반경 0.8셀에 동결 게이지 35 전파." },
  { id: "relic_broken_clock", name: "부서진 시계", tags: ["delayed"], effects: [{ type: "delayed_damage_mul", value: 1.45 }, { type: "delayed_time_add", value: 0.8 }], description: "delayed 공격 피해 +45%, 기본 지연 +0.8초." },
  { id: "relic_support_boost", name: "서포트 부스트", tags: ["field_buff", "support"], effects: [{ type: "field_buff_skill_cooldown_mul", value: 0.8 }, { type: "direct_damage_mul", value: 0.92 }], description: "필드버프 생성 스킬 쿨다운 -20%, 직접 피해 -8%." },
  { id: "relic_last_light", name: "마지막 별빛", tags: ["core", "attack_speed"], effects: [{ type: "core_hp_threshold_stage_attack_speed", hpRatio: 0.3, attackSpeedMul: 1.3, persistsForStage: true }], description: "코어 HP 30% 이하에서 모든 아군 공격속도 +30%. 회복해도 해당 스테이지 동안 유지." },
]);

export const MUTATOR_DEFINITIONS = Object.freeze([
  { id: "mutator_frenzy", name: "광란 조류", tags: ["speed"], effects: [{ type: "enemy_speed_mul", value: 1.12 }, { type: "clear_gold_mul", value: 1.2 }], description: "적 속도 +12%, 클리어 금화 +20%." },
  { id: "mutator_fortified", name: "철갑 진군", tags: ["armored"], effects: [{ type: "enemy_hp_mul", value: 1.18 }, { type: "enemy_tag_reward_mul", tag: "armored", value: 1.35 }], description: "적 HP +18%, 중갑 적 보상 +35%." },
  { id: "mutator_aerial", name: "상공 균열", tags: ["aerial"], effects: [{ type: "aerial_hp_budget_cap", value: 0.6 }, { type: "enemy_tag_reward_mul", tag: "aerial", value: 1.25 }], description: "공중 HP 예산 상한 60%, 공중 적 보상 +25%." },
  { id: "mutator_split", name: "분기 폭주", tags: ["multi_lane"], effects: [{ type: "simultaneous_path_spawn_weight_add", value: 0.25 }, { type: "score_mul", value: 1.15 }], description: "두 경로 동시 스폰 비중 증가, 점수 +15%." },
  { id: "mutator_cleanse", name: "정화 의식", tags: ["cleanse", "status"], effects: [{ type: "require_wave_tag", tag: "cleanse", minimumPackages: 1 }, { type: "status_duration_mul", value: 1.15 }], description: "정화 패키지 최소 1개, 아군 상태 지속 +15%로 보정." },
  { id: "mutator_volatile", name: "휘발성 균열", tags: ["burn", "splash", "risk"], effects: [{ type: "burn_and_splash_damage_mul", value: 1.2 }, { type: "core_contact_damage_mul", value: 1.1 }], description: "작열·스플래시 피해 +20%, 코어 접촉 피해 +10%." },
  { id: "mutator_leyline", name: "증폭 도관", tags: ["special_tile"], effects: [{ type: "special_tile_count_add", value: 1 }, { type: "special_tile_effect_mul", value: 1.25 }], description: "특수 타일 +1, 타일 효과 +25%." },
  { id: "mutator_black_moon", name: "검은 달", tags: ["field_buff", "risk"], effects: [{ type: "global_field_buff_slot_add", value: -1 }, { type: "field_buff_effect_mul", value: 1.35 }], rules: { lunaNoMoonUsesActuallyActiveBuffs: true }, description: "필드버프 슬롯 -1, 필드버프 효과 +35%. 루나 무월은 실제 활성 버프만 판정." },
]);

// 시작 축복의 구체 수치는 원문에 예시 1종만 있어 보수적인 세 후보로 데이터화했다.
export const STARTING_BLESSING_DEFINITIONS = Object.freeze([
  {
    id: "blessing_supply_route",
    name: "간이 보급로",
    tags: ["economy"],
    effects: [{ type: "companion_cost_mul", value: 0.92 }],
    description: "이번 원정 동안 동료 배치 비용 -8%.",
    balanceNote: "기획서 예시 수치를 그대로 사용한 기준 축복입니다.",
  },
  {
    id: "blessing_core_lining",
    name: "코어 내피",
    tags: ["defense", "core"],
    effects: [{ type: "expedition_start_core_shield", value: 15 }],
    description: "원정 시작 시 코어 보호막 15를 얻습니다.",
    balanceNote: "자동 수리 대신 일회성 보호막만 제공하는 보수적 방어 축복입니다.",
  },
  {
    id: "blessing_leader_focus",
    name: "리더의 집중",
    tags: ["leader_active"],
    effects: [{ type: "leader_active_cooldown_mul", value: 0.92 }],
    description: "이번 원정 동안 주인공 액티브 쿨다운 -8%.",
    balanceNote: "확률 효과 없이 결정론을 유지하는 보수적 공격 축복입니다.",
  },
]);

export const FIXED_CHALLENGE_DEFINITIONS = Object.freeze([
  {
    id: "challenge_sky_rift",
    name: "하늘의 균열",
    purpose: "대공·타깃 우선순위·속성 우위 학습",
    fixedDeck: { leaderId: "rumi", companionIds: ["silver_rabbit", "snow_rabbit", "guardian", "gray"] },
    enemyRules: { aerialHpBudgetRatio: 0.6, fixedPrimaryElement: "dark" },
    fixedGrowthShards: 8,
    fixedRelicIds: [],
    starConditions: [
      { id: "clear", description: "도전을 클리어합니다." },
      { id: "core_no_damage", description: "코어 HP 피해 없이 클리어합니다." },
      { id: "time_under_300", description: "5분 이내에 클리어합니다.", limitSeconds: 300 },
    ],
    unlock: { type: "expedition_stage_reached", stage: 3 },
  },
  {
    id: "challenge_iron_column",
    name: "철갑 행렬",
    purpose: "부식·물리/마법 피해·집중 육성 학습",
    fixedDeck: { leaderId: "cinderella", companionIds: ["guardian", "snow_rabbit", "gray", "gold_dragon"] },
    enemyRules: { highWeightTags: ["armored", "magic"], elementPool: ["fire", "dark"], maxElements: 2 },
    fixedGrowthShards: 10,
    fixedRelicIds: [],
    starConditions: [
      { id: "clear", description: "도전을 클리어합니다." },
      { id: "corrosion_breaks", description: "부식 3스택 파열을 5회 이상 일으킵니다.", minimum: 5 },
      { id: "core_hp_70", description: "코어 HP 70 이상으로 클리어합니다.", minimum: 70 },
    ],
    unlock: { type: "challenge_stars", challengeId: "challenge_sky_rift", minimum: 1 },
  },
  {
    id: "challenge_stopped_clock",
    name: "멈춘 시계",
    purpose: "그레이와 시간의마술사 지연 연계 학습",
    fixedDeck: { leaderId: "rumi", companionIds: ["gray", "time_magician", "guardian", "silver_rabbit"] },
    enemyRules: {
      bossOnly: true,
      bossOverride: { bossId: "artificial_demon", element: "light" },
    },
    fixedGrowthShards: 12,
    fixedRelicIds: ["relic_broken_clock"],
    timeLimitSeconds: 420,
    starConditions: [
      { id: "clear", description: "7분 제한 안에 도전을 클리어합니다." },
      { id: "delayed_damage_ratio", description: "총 피해의 35% 이상을 delayed 공격으로 줍니다.", minimumRatio: 0.35 },
      { id: "time_under_300", description: "5분 이내에 클리어합니다.", limitSeconds: 300 },
    ],
    unlock: { type: "challenge_stars", challengeId: "challenge_iron_column", minimum: 1 },
  },
]);

export const META_PROGRESSION = Object.freeze({
  initiallyUnlocked: {
    leaders: ["rumi", "zeke"],
    companions: ["guardian", "silver_rabbit", "snow_rabbit", "gray"],
    difficulties: ["scout", "standard"],
    challenges: [],
  },
  unlockable: {
    leaders: ["luna", "cinderella"],
    companions: ["gold_dragon", "time_magician"],
    difficulties: ["eclipse"],
    challenges: FIXED_CHALLENGE_DEFINITIONS.map(({ id }) => id),
  },
  affinityCombatStatBonuses: false,
  recentSeedLimit: 10,
});
