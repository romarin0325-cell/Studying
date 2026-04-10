# 7편 특성·이펙트 사전

## 1. trait type 분류

현재 카드 trait type은 아래 범주로 묶어 읽는 것이 가장 실용적이다.

### 덱 시너지형

- `syn_water_3_atk_matk`
- `syn_fire_3_crit`
- `syn_fire_3_crit_burn`
- `syn_fire_3_atk_boost`
- `syn_dark_3_matk`
- `syn_dark_3_all_stats`
- `syn_dark_3_party_atk`
- `syn_dark_full_party_crit`
- `syn_light_fire_atk`
- `syn_light_dark_matk_mdef`
- `syn_light_3_matk_mdef`
- `syn_light_3_party_def_mdef`
- `syn_nature_3_all`
- `syn_nature_3_golem`
- `syn_nature_3_matk`
- `syn_nature_3_party_def_mdef`
- `syn_water_3_ice_age`
- `syn_water_2_moon_twinkle`
- `syn_water_nature`
- `syn_night_rabbit`
- `syn_snow_rabbit`
- `syn_silver_rabbit`

이 범주는 `calculateInitialStats()`에서 주로 처리되며, 덱 구성과 배치 시점에 이미 능력치가 변한다.

### 배치/파티 보정형

- `pos_stat_boost`
- `pos_rear_atk`
- `opening_atk_def`
- `opening_atk_matk`
- `party_stat_boost`
- `party_normal_attack_dmg`
- `mid_party_mdef_boost`
- `reverse_atk_matk_party`

이 범주는 전투 시작 직후 또는 파티 전체 값으로 반영된다.

### 조건부 피해형

- `cond_darkness_dmg`
- `cond_silence_dmg`
- `cond_corrosion_dmg`
- `cond_debuff_3_dmg`
- `cond_target_debuff_3_dmg`
- `cond_divine_3_dmg`
- `cond_target_elements_dmg`
- `cond_twinkle_all`
- `cond_sun_matk_mdef`
- `cond_sanctuary_atk_def`
- `cond_earth_def_mdef`
- `cond_no_field_buff_eva_crit`
- `guard_stun_double_dmg`

이 범주는 `calculateStats()` 또는 `calculateDamage()`에서 매 턴 재평가된다.

### 방어 관통/특수 판정형

- `burn_stack_phy_pen`
- `ignore_def_mdef_by_stack`
- `crit_ignore_def_add`
- `all_advantage`
- `field_buff_immune`

### 사망/피격/회피 반응형

- `death_debuff`
- `death_dmg_mag`
- `death_dmg_phy`
- `death_dmg_debuff`
- `death_field_buff`
- `death_field_buff_count_dmg`
- `death_field_sun`
- `death_multi_debuff`
- `death_sun_bless_chance`
- `death_twinkle`
- `on_evasion_stun`
- `on_hit_random_debuff`

### 런 구조 변경형

- `looter`
- `joker_wild`
- `instant_delayed_skills`
- `normal_attack_burn_divine`
- `cure_master_trait`
- `behemoth_trait`
- `behemoth_liberated_trait`
- `luna_jasmine_trait`
- `cosmic_harmony_random_buff`
- `rabbit_synergy_boost`
- `slime_synergy_boost`

## 2. effect type 분류

### 직접 화력/배율형

- `dmg_boost`
- `cond_target_debuff_3_dmg`
- `count_deck_attr_dmg`
- `random_mult`
- `random_mult_moon_boost`
- `turn_modulo_dmg`
- `remove_field_buff_dmg`
- `consume_field_buff_dmg`
- `consume_random_debuff_fixed_mult`
- `dream_form_execute`
- `force_crit`
- `force_crit_chance`

### 스택 소비/변환형

- `consume_debuff_all`
- `consume_debuff_fixed`
- `consume_divine_add_darkness`
- `consume_field_all`
- `consume_debuff_then_random_debuff`
- `consume_all_burn_cond_buff`

### 상태 부여형

- `buff`
- `debuff`
- `chance_debuff`
- `conditional_debuff`
- `conditional_field_debuff`
- `random_debuff`
- `random_debuff_consume_divine`
- `wild_card_debuff`
- `self_debuff`

### 필드버프 제어형

- `field_buff`
- `random_field_buff`
- `random_field_buff_lumi`
- `conditional_field_buff`
- `roulette_field`

### 지연/예약형

- `delayed_attack`
- `delayed_attack_field`
- `delayed_attack_debuff_scale`
- `delayed_turn_scale_attack`
- `delayed_random_attack`
- `phantom_nightmare`

### 기타 유틸리티형

- `heal_ratio`
- `clear_target_debuffs`
- `clear_self_debuffs`
- `set_self_stats`
- `self_hp_cost_ratio`
- `suicide`
- `random_skill_trigger_from_list`
- `check_divine_3_stun_else_add`

## 3. 설계 관점에서 기억할 포인트

- trait는 주로 “항상성”과 “트리거 조건”을 정의하고, effect는 스킬 실행 시점을 기준으로 동작한다.
- `calculateInitialStats()`에서 끝나는 trait와 `calculateStats()/calculateDamage()`에서 계속 살아 있는 trait를 구분해야 밸런스 판단이 맞다.
- `clear_target_debuffs`는 이름과 달리 대상 `buffs` 맵 전체를 비우므로, 버프/디버프를 한 맵에서 같이 쓰는 현재 구현에서는 영향이 크다.
- `instant_delayed_skills`는 거의 모든 지연형 스킬을 즉시 발동형으로 바꿔 런 템포를 크게 흔든다.
- `joker_wild`는 속성 시너지, 이름 기반 토끼 시너지, `Chaos Lord`의 속성 수 계산에 모두 관여한다.

## 4. 문서 해석 우선순위

새 카드를 설계하거나 밸런싱할 때는 아래 순서로 읽는 것이 안전하다.

1. trait가 초기 스탯형인지 실시간 판정형인지 구분
2. 스킬 effect가 배율형인지 상태 조작형인지 구분
3. `burn/divine/field buff`를 먹는지, 쌓는지, 참조만 하는지 확인
4. 아티팩트 훅이 추가로 붙는지 확인
5. 숨은 예외가 있는지 `battle_runtime.js` 선처리 구간 확인
