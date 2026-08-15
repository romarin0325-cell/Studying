import { deepFreeze } from './combat.js';

export const TRAIT_HOOK_IDS = deepFreeze([
  'before_damage',
  'after_hit',
  'modify_self_stats',
  'modify_team_stats',
  'provide_aura',
  'modify_team_auras',
  'modify_core_damage',
  'on_core_damaged',
]);

export const CONDITION_TYPE_IDS = deepFreeze([
  'always',
  'target_element',
  'target_defense_type',
  'target_has_status',
  'target_has_any_debuff',
  'source_has_buff',
  'source_has_no_named_buff',
  'core_below_ratio',
  'is_boss',
  'attack_kind',
  'core_damaged_previous_wave',
]);

export const OPERATION_TYPE_IDS = deepFreeze([
  'multiply_damage',
  'multiply_damage_by_debuff_count',
  'add_crit_chance',
  'add_range',
  'multiply_skill_cooldown',
  'apply_status',
  'provide_aura',
  'increase_aura_range_tier',
  'floor_matchup_multiplier',
  'multiply_core_damage',
  'random_damage_multiplier',
  'set_next_wave_flag',
  'add_team_crit_chance',
]);

export const EFFECT_PRESET_DEFINITIONS = deepFreeze([
  {
    id: 'basic_melee_hit',
    displayName: '근접 기본 타격',
    durationSeconds: 0.22,
    shape: 'slash_and_impact_ring',
    particleCount: 5,
    radiusScale: 0.55,
  },
  {
    id: 'basic_ranged_hit',
    displayName: '원거리 기본 타격',
    durationSeconds: 0.20,
    shape: 'small_flash_and_afterglow',
    particleCount: 4,
    radiusScale: 0.38,
  },
  {
    id: 'basic_shotgun_hit',
    displayName: '샷건 기본 타격',
    durationSeconds: 0.28,
    shape: 'three_trails_and_impacts',
    trailCount: 3,
    particleCountPerImpact: 3,
    radiusScale: 0.38,
  },
  {
    id: 'basic_area_hit',
    displayName: '범위 기본 타격',
    durationSeconds: 0.38,
    shape: 'expanding_wave',
    radiusCells: 2,
    particleCount: 12,
  },
  {
    id: 'skill_single_hit',
    displayName: '단일 스킬 타격',
    durationSeconds: 0.48,
    shape: 'large_glyph_and_focus_flash',
    particleCount: 16,
    radiusScale: 0.85,
  },
  {
    id: 'skill_area_hit',
    displayName: '범위 스킬 타격',
    durationSeconds: 0.60,
    shape: 'glyph_and_expanding_wave',
    radiusCells: 3,
    particleCount: 24,
  },
  {
    id: 'status_apply',
    displayName: '상태이상 적용',
    durationSeconds: 0.45,
    shape: 'status_icon_rise',
    particleCount: 4,
    radiusScale: 0.35,
  },
  {
    id: 'critical_hit',
    displayName: '치명타 강조',
    durationSeconds: 0.30,
    shape: 'amplified_impact',
    particleCount: 8,
    radiusScale: 0.75,
    overlay: true,
  },
  {
    id: 'advantage_hit',
    displayName: '상성 우위 강조',
    durationSeconds: 0.34,
    shape: 'advantage_outline',
    particleCount: 6,
    radiusScale: 0.82,
    overlay: true,
    triggerMultiplier: 2,
  },
]);

export const EFFECT_PRESET_BY_ID = deepFreeze(Object.fromEntries(
  EFFECT_PRESET_DEFINITIONS.map((definition) => [definition.id, definition]),
));
export const EFFECT_PRESETS = EFFECT_PRESET_DEFINITIONS;

export const ELEMENT_EFFECT_COLORS = deepFreeze({
  fire: '#ff7048',
  water: '#5cc8ff',
  nature: '#74d680',
  light: '#ffe282',
  dark: '#b690ff',
});

export const DISPLAY_EVENT_CONTRACT = deepFreeze({
  type: 'hit',
  requiredFields: ['type', 'actionKind', 'attackArchetype', 'effectPreset', 'element', 'sourceId', 'targetId', 'x', 'y'],
  optionalFields: [
    'radius', 'critical', 'advantageous', 'statusId', 'pelletIndex',
    'sourceX', 'sourceY', 'vectorX', 'vectorY', 'missed', 'visualOnly', 'suppressEffect',
  ],
  rendererMayMutateBattleState: false,
});

export default EFFECT_PRESET_DEFINITIONS;
