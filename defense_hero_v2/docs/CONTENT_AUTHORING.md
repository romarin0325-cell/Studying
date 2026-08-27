# 콘텐츠 제작·수정 가이드

이 문서는 `defense_hero_v2/js/content/`의 데이터를 안전하게 수정하는 방법을 설명한다. 현재 구현과 검증 코드를 기준으로 작성했으며, 콘텐츠 파일만 바꾸면 되는 경우와 런타임·검증 코드까지 함께 바꿔야 하는 경우를 구분한다.

> 핵심 원칙: 콘텐츠는 **함수가 없는 불변 데이터**이고, 전투 시스템은 영웅 ID가 아니라 공용 조건·효과와 공격 유형을 해석한다. 새 콘텐츠를 추가할 때 `hero.id === ...` 같은 캐릭터 전용 분기를 전투 시스템에 넣지 않는다.

## 1. 소스 오브 트루스

| 대상 | 정의 파일 | 주요 소비자·검증자 |
| --- | --- | --- |
| 전투 상수·상성·보드·웨이브 규칙 | `js/content/combat.js` | 모든 전투 시스템, `validateContent.js` |
| 영웅·기본 공격·스킬·특성 | `js/content/heroes.js` | `BattleState`, 공격/스킬/특성 시스템 |
| 오라 버프 | `js/content/buffs.js` | `AuraSystem`, `TargetingSystem`, `DamageSystem`, 공격/스킬 시스템 |
| 상태이상 | `js/content/statuses.js` | `StatusSystem`, `DamageSystem` |
| 적·보스 | `js/content/enemies.js` | `WaveSystem`, 렌더러 |
| 스테이지·경로·웨이브 | `js/content/stages.js` | `BattleState`, `WaveSystem`, 스테이지 선택 화면 |
| 특성 조건/연산 ID·시각 효과 프리셋 | `js/content/effects.js` | 특성 레지스트리, `EffectRenderer` |
| 초상화·4방향 스프라이트 매니페스트 | `js/content/assets.js` | `AssetManager`, `SpriteResolver`, 로컬 빌드 |
| 전체 콘텐츠 계약 | `js/content/validateContent.js` | 정적 검증과 통합 테스트 |
| 체크포인트 계약 | `js/persistence/schemas.js` | `SaveRepositoryV2`, 전투 재개 |

`dist-local/HeroCoreDefenseV2.html`은 빌드 산출물이다. 직접 수정하지 말고 원본 콘텐츠·에셋을 수정한 뒤 다시 빌드한다.

## 2. 모든 콘텐츠에 적용되는 규칙

### ID와 참조

- 현재 ID는 영문 소문자 `snake_case` 관례를 사용한다. 예: `snow_rabbit`, `rumi_star_form`, `ancient_ruins`.
- 검증기가 실제로 강제하는 공통 조건은 **비어 있지 않은 ID**와 컬렉션 안의 **중복 금지**다. 정규식 형태까지 강제하지는 않는다.
- 특성 ID는 전체 영웅을 통틀어 유일해야 한다. 현재 관례는 `<hero_id>_<trait_slug>`다.
- 논리 에셋 ID는 경로 계약과 정확히 맞아야 한다.
  - 초상화: `portrait/<hero_id>`
  - 영웅 전투: `battle/<hero_id>/<direction>`
  - 보스 전투: `boss/<boss_id>/<direction>`
- ID를 바꾸는 것은 단순 표시명 변경이 아니다. 스테이지 웨이브, 기본 편성, 에셋 매니페스트, 체크포인트 및 테스트의 모든 참조를 함께 바꿔야 한다.

### 불변 데이터와 `deepFreeze`

각 공개 콘텐츠 컬렉션은 `combat.js`의 `deepFreeze`로 감싼다.

```js
export const DEFINITIONS = deepFreeze([
  { id: 'example', values: [1, 2, 3] },
]);

export const DEFINITION_BY_ID = deepFreeze(Object.fromEntries(
  DEFINITIONS.map((definition) => [definition.id, definition]),
));
```

`deepFreeze`는 배열, 객체, 중첩 배열까지 재귀적으로 동결한다. `validateContent()`는 공개 데이터가 깊게 동결됐는지 확인하고, 데이터 안에 함수가 들어 있으면 실패한다. 데이터 생성용 모듈 내부 헬퍼 함수는 괜찮지만, `conditions`, `effects`, `waves` 같은 실제 데이터 필드에 콜백을 넣으면 안 된다.

### 현재 출시 계약은 고정 수량이다

현재 `validateContent.js`는 단순 최소 조건이 아니라 아래 출시 구성을 정확히 고정한다.

- 영웅 10명: 메인 4명 + 일반 6명
- 영웅마다 Lv4 선택지 2개 + Lv6 선택지 2개: 특성 40개
- 일반 적 10종 + 보스 4종
- 스테이지 4개, 각 10웨이브(총 40)
- 버프 7종, 상태 7종, 공개 디버프 6종, 이펙트 프리셋 12종
- 출시 에셋 66개

따라서 기존 항목의 수치·표시명만 바꾸는 작업과, 항목을 추가·삭제하는 작업은 다르다. 추가·삭제할 때는 `validateContent.js`의 `EXPECTED_*_IDS`, `CONTENT_COUNTS`와 해당 테스트의 고정 기대값을 의도적으로 함께 갱신해야 한다.

## 3. 영웅 작성법

영웅은 `heroes.js`의 `HEROES` 배열에 넣는다. 같은 파일의 `attack()`, `skill()`, `trait()`, `heroAssetIds()` 헬퍼를 사용하면 런타임이 기대하는 별칭 필드도 함께 생성된다.

```js
{
  id: 'example_hero',
  name: '예시영웅',
  displayName: '예시영웅',
  position: 'normal',
  kind: 'normal',
  element: 'nature',
  role: 'dealer',
  tags: [],
  attack: attack({
    archetype: 'rapid',
    attackType: 'anti_air',
    range: 4,
    interval: 0.5,
    damage: 6,
    effectPreset: 'basic_ranged_hit',
  }),
  skill: skill({
    id: 'example_hero_tempest',
    name: '템페스트',
    attackType: 'anti_air',
    cooldown: 7,
    shape: 'area',
    damage: 42,
    radius: 3,
  }),
  traits: [
    trait('example_hero_trait_a', 4, '특성A', [], [
      { type: 'add_range', value: 1, target: 'source' },
    ], '공격 범위가 +1 늘어난다.'),
    trait('example_hero_trait_b', 4, '특성B', [], [
      { type: 'multiply_skill_cooldown', value: 0.8, target: 'source' },
    ], '스킬 쿨다운이 20% 줄어든다.'),
    trait('example_hero_trait_c', 6, '특성C', [], [
      { type: 'provide_aura', buffId: 'gale', range: 6 },
    ], '범위 6 오라로 아군에게 질풍(스킬 쿨다운 20% 감소)을 건다.'),
    trait('example_hero_trait_d', 6, '특성D', [
      { type: 'is_boss' },
    ], [
      { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
    ], '보스에게 주는 피해가 1.5배가 된다.'),
  ],
  assetIds: heroAssetIds('example_hero'),
}
```

필드 계약은 다음과 같다.

- `position`과 `kind`는 둘 다 `main` 또는 `normal`이어야 하며 서로 같아야 한다.
- `element`: `fire`, `water`, `nature`, `light`, `dark` 중 하나.
- `role`: `dealer`, `balancer`, `buffer`, `debuffer` 중 하나.
- `attack.archetype`: `melee`, `burst`, `rapid`, `shotgun`, `area`, `nova`, `laser` 중 하나.
- `attack.attackType`: `normal`, `anti_air`, `lethal`, `magic`, `flame`, `holy` 중 하나.
- `attack.range`, `interval`, `damage`는 양의 유한수다.
- 스킬 쿨다운은 현재 `5`, `7`, `9`초만 검증을 통과한다.
- 스킬 `shape`는 `single`, `area`, `melee` 중 하나다. `single`·`melee` 반경은 `0`, `area` 반경은 `3`이어야 한다. `melee`는 단일 대상 큰 한방(배율 ×1.3)이다.
- 특성은 정확히 네 개이며 Lv4 두 개, Lv6 두 개다.
- 특성에는 한국어 `description`이 필수다. 특성 선택 버튼과 정보 시트가 원시 effect 유형 대신 이 문구를 그대로 표시하므로, 효과 수치를 담은 완성된 문장으로 쓴다.
- `tags`는 팀 효과의 대상 판별에 사용된다. 현재 `rabbit` 태그가 래빗홀 치명타 효과에 사용된다.

공격 유형별 추가 필드:

- `shotgun`: `pelletCount`, `spreadDegrees`, `normalCollisionRadius`, `bossCollisionRadius`를 현재 샷건 데이터처럼 제공한다. 실제 충돌은 `BasicAttackSystem.resolveShotgunHits()`가 `spreadDegrees`와 두 충돌 반경을 사용한다.
- `area`: `radius`를 제공한다. 기본 공격의 중심 대상 주변에 적용된다.
- `nova`: `radius`를 제공한다. **영웅 중심** 반경 안에 든 모든 적을 타격하며, 반경이 비어 있으면 타이머를 소모하지 않고 대기한다. 시각 프리셋은 `basic_nova_hit`.
- `laser`: `normalCollisionRadius`, `bossCollisionRadius`를 제공한다. 대상 방향 직선 복도 내 모든 적을 거리 순으로 관통한다. 시각 프리셋은 `basic_laser_hit`.
- 그 외 공격은 한 대상에 적용된다. 근접/원거리 시각 프리셋 선택은 `BasicAttackSystem`에도 연결돼 있으므로 새로운 `archetype` 추가는 데이터 수정만으로 끝나지 않는다.

새 영웅을 추가할 때 함께 바꿀 곳:

1. `heroes.js`의 `HEROES`.
2. `assets.js`의 `HERO_IDS`, 해당 소스 아틀라스의 `rowByEntityId`, 물리 파일 5개.
3. `validateContent.js`의 영웅 기대 ID와 메인/일반/특성/에셋 수량.
4. 고정 수량을 검사하는 `traits.test.mjs`, `trait-matrix-runtime.test.mjs`, `content-architecture.test.mjs`, `simulation-balance.test.mjs`.
5. 출시 에셋 수량과 로스터를 고정하는 V2 정적 검증·빌드·로컬 번들 검증 스크립트.

기본 편성을 바꿀 경우 `DEFAULT_FORMATION`은 메인 영웅 1명과 서로 다른 일반 영웅 4명을 유지한다. 체크포인트 스키마도 현재 이 1+4 구조를 고정한다.

## 4. 특성: 조건과 효과 레지스트리

특성은 런타임 함수를 데이터에 넣지 않고 조건/효과 레코드로 작성한다. 마지막 인자인 한국어 `description`은 UI에 그대로 노출된다.

```js
trait('snow_rabbit_cold_chaser', 4, '콜드체이서', [
  { type: 'target_has_status', statusId: 'slow' },
], [
  { type: 'multiply_damage', value: 1.5, damageKind: 'direct' },
], '감속된 적에게 주는 피해가 1.5배가 된다.')
```

실행 흐름은 다음과 같다.

1. `TraitCompiler.selectedTraitDefinitions()`가 레벨업으로 선택된 특성만 찾는다.
2. `TraitCompiler.evaluateTraitHook()`가 해당 훅의 효과만 선택한다.
3. `ConditionRegistry`가 모든 조건을 AND로 평가한다.
4. `OperationRegistry` 또는 팀 효과 소비자가 누산기에 값을 넣는다.
5. 공격, 피해, 오라, 코어 시스템이 누산 결과를 소비한다.

현재 데이터에서 사용할 수 있도록 선언된 조건은 `effects.js`의 `CONDITION_TYPE_IDS`가 기준이다. 예시는 다음과 같다.

```js
{ type: 'target_element', element: 'fire' }
{ type: 'target_defense_type', defenseType: 'air' }
{ type: 'target_has_status', statusId: 'darkness' }
{ type: 'target_has_any_debuff' }
{ type: 'source_has_buff', buffId: 'earth_bless' }
{ type: 'source_has_no_named_buff' }
{ type: 'core_below_ratio', ratio: 0.5, inclusive: false }
{ type: 'is_boss' }
{ type: 'attack_kind', attackKind: 'skill' }
{ type: 'core_damaged_previous_wave' }
```

`core_below_ratio`의 현재 런타임 비교는 `<`이며, 데이터의 `inclusive` 필드는 소비되지 않는다. 조건 배열이 비어 있으면 항상 통과한다.

대표 효과 형태:

```js
{ type: 'multiply_damage', value: 2, damageKind: 'direct' }
{ type: 'multiply_damage_by_debuff_count', amountPerDebuff: 0.5, uniqueStatusIdsOnly: true }
{ type: 'add_crit_chance', value: 0.15, target: 'source' }
{ type: 'add_range', value: 1, target: 'source' }
{ type: 'multiply_skill_cooldown', value: 0.8, target: 'source' }
{ type: 'apply_status', statusId: 'slow', chance: 0.5, trigger: 'after_hit' }
{ type: 'provide_aura', buffId: 'sun_bless', range: 6 }
{ type: 'increase_aura_range_tier', target: 'all_allied_aura_providers', maximumRange: 10 }
{ type: 'floor_matchup_multiplier', value: 1, dimension: 'attack_type' }
{ type: 'multiply_core_damage', value: 0.5, target: 'core', dedupeKey: 'world_shield' }
{ type: 'random_damage_multiplier', choices: [0.5, 2], weights: [1, 1], rngScope: 'skill_action' }
{ type: 'add_team_crit_chance', value: 0.2, targetTag: 'rabbit', dedupeKey: 'rabbit_hole' }
```

주의할 점:

- 선언 목록에 ID를 추가하는 것만으로 효과가 실행되지는 않는다.
- 새 조건은 `CONDITION_TYPE_IDS`, `validateCondition()`, `ConditionRegistry`를 함께 추가하고 단위 테스트를 작성한다.
- 새 일반 연산은 `OPERATION_TYPE_IDS`, `validateOperation()`, `OperationRegistry`, 누산기 필드, 실제 소비 시스템을 함께 연결한다.
- `add_team_crit_chance`는 일반 `OperationRegistry` 연산이 아니라 `TraitSystem.collectUniqueTeamTraitEffects()`와 `DamageSystem`이 직접 소비한다. `dedupeKey`가 같은 팀 효과는 한 번만 적용된다.
- `increase_aura_range_tier`는 현재 `value`를 단계 수로 사용하고 값이 없으면 1단계로 처리한다. 데이터의 `maximumRange`는 소비되지 않으며 실제 상한은 `AURA_RANGE_TIERS`의 마지막 값 10이다.
- `set_next_wave_flag`는 연산 목록과 누산기에는 있지만 현재 누산 결과를 전투 상태에 반영하는 소비자가 없다. 새 특성에 데이터만 추가해서 사용하지 말고 상태 반영 지점과 회귀 테스트까지 먼저 구현한다.
- 효과 훅은 `TraitCompiler.effectHook()`가 유형별로 추론한다. 현재 실제 호출되는 훅은 `before_damage`, `after_hit`, `provide_aura`, `team_modifier`, `core_damage`, `stat_modifier`다.
- 무작위 효과는 `Math.random()`을 사용하면 안 된다. 전투가 제공하는 시드 RNG를 통해서만 결정돼야 한다.
- 현재 `random_damage_multiplier` 런타임은 `choices`를 시드 RNG로 고르며, `weights`는 검증되지만 선택 계산에는 사용되지 않는다.

새 효과는 최소한 `tests/unit/traits.test.mjs`에서 선언/레지스트리 연결을 검증하고, 실제 전투 결과는 `tests/integration/trait-interactions.test.mjs` 또는 전용 회귀 테스트에서 검증한다. 모든 최종 특성 조합은 `trait-matrix-runtime.test.mjs`를 통과해야 한다.

## 5. 버프와 오라

버프는 `buffs.js`의 `AURA_BUFF_DEFINITIONS`에 추가한다.

```js
{
  id: 'gale',
  displayName: '질풍',
  description: '스킬 쿨다운 20% 감소',
  color: '#82f0d4',
  stacking: 'unique_by_id',
  effects: [
    { type: 'skill_cooldown_multiplier', value: 0.80, combine: 'multiply' },
  ],
}
```

- 각 버프에는 하나 이상의 `effects`가 필요하다.
- `displayName`과 한국어 `description`은 필수다. 정보 시트의 버프 칩이 두 필드를 그대로 표시한다.
- `color`는 `#rrggbb` 형식 필수다. 영웅 스프라이트 뒤 글로우와 발밑 버프 점, 정보 시트 칩의 색으로 사용된다.
- 효과 `type`은 `BUFF_EFFECT_TYPE_IDS`에 있어야 하고 `value`는 양의 유한수여야 한다.
- 오라 범위는 현재 `4`, `6`, `8`, `10` 티어만 허용된다.
- 오라는 배치된 제공자와 대상의 셀 중앙 간 유클리드 거리를 사용하며 경계값을 포함한다. 제공자 자신도 범위 안이면 버프를 받는다.
- 동일 버프 ID는 대상의 `Map`에 한 번만 존재한다. 여러 제공자의 ID는 `sources` 집합에 기록되지만 같은 버프 효과를 중복 계산하지 않는다.
- 현재 런타임의 결합 방식은 효과 타입 소비자가 결정한다. 피해·치명타·사거리는 합산하고, 공격 간격·스킬 쿨다운은 곱한다. `combine`과 `stacking` 문자열 자체를 런타임이 해석하는 구조는 아니다.

새 버프 효과 타입을 만들면 이름만 `BUFF_EFFECT_TYPE_IDS`에 추가하지 말고 다음 소비자 중 필요한 곳을 구현한다.

- 공격 간격: `BasicAttackSystem.getAttackInterval()`
- 스킬 쿨다운: `SkillSystem.getSkillCooldown()`
- 사거리: `TargetingSystem.getEffectiveRange()`
- 피해·치명타: `DamageSystem.calculateDirectDamage()`

행동 검증은 `tests/unit/aura-status.test.mjs`, 조합 피해는 `tests/integration/trait-interactions.test.mjs`에 추가한다.

## 6. 상태이상

상태는 `statuses.js`의 `STATUS_DEFINITIONS`에 추가한다.

```js
{
  id: 'slow',
  displayName: '감속',
  kind: 'debuff',
  debuff: true,
  duration: 10,
  durationSeconds: 10,
  slow_multiplier: 0.50,
  refresh: 'max_remaining',
  maximumStacks: 1,
  effects: [{ type: 'multiply_move_speed', value: 0.50 }],
}
```

검증 계약:

- `duration`은 양수여야 한다.
- `debuff`는 `kind === 'debuff'`와 일치해야 한다.
- 하나 이상의 `effects`가 필요하다.
- `DEBUFF_DEFINITIONS`는 `kind: 'debuff'`인 상태만 공개 디버프로 센다.

현재 상태 런타임은 완전한 범용 `effects` 실행기가 아니다.

- 공통 표식 상태는 `applyStatus()`가 `remaining`, `stacks: 1`, `debuff`를 만들고 재적용 시 남은 시간을 큰 값으로 갱신한다.
- `slow`의 이동 감소, `stun`/`stun_immunity`, `poison`의 중첩·1초 틱은 `StatusSystem`이 해당 ID를 직접 처리한다.
- `corrosion`, `curse`, `darkness`의 추가 피해는 `DamageSystem`이 정의의 `physical_damage_taken`, `magic_damage_taken`, `direct_damage_taken` 값을 읽는다.
- 중독은 직접 피해 보너스와 치명타를 사용하지 않고, `poison_dps × stacks`의 고정 피해를 준다.

따라서 단순히 다른 특성의 `target_has_status` 조건에 쓰는 표식은 기본 수명주기로 동작할 수 있지만, 이동·행동·지속 피해·받는 피해 같은 새 기계적 효과는 해당 시스템 구현과 테스트가 반드시 필요하다. 새 상태를 추가할 때 `EXPECTED_STATUS_IDS`, 상태/디버프 수량, 상태 적용·갱신·만료 테스트도 함께 갱신한다.

## 7. 일반 적과 보스

일반 적은 `enemies.js`의 `enemy()` 헬퍼를 사용한다.

```js
enemy({
  id: 'example_guard',
  name: '예시수호자',
  element: 'nature',
  defenseType: 'heavy',
  baseHp: 160,
  speed: 0.85,
  stageId: 'ancient_ruins',
  token: { shape: 'square', symbol: '■' },
})
```

보스는 `boss()` 헬퍼를 사용한다.

```js
boss({
  id: 'example_boss',
  name: '예시보스',
  element: 'dark',
  baseHp: 3200,
  speed: 0.72,
  stageId: 'chaos_rift',
})
```

- 일반 적의 방어 타입은 `normal`, `air`, `heavy`, `regeneration`, `demon` 중 하나이며 `renderMode: 'defense_token'`과 무에셋 계약을 유지한다.
- 보스는 `defenseType: 'boss'`, `isBoss: true`, `renderMode: 'directional_sprite'`가 되고 4방향 에셋이 필수다.
- `baseHp`, `speed`는 양의 유한수이며 `hp`는 `baseHp`와 같아야 한다. 코어 도달 피해는 현재 모두 `1`이다.
- 웨이브 시작 시 실제 최대 HP는 기본 HP × 웨이브 × 난이도 × 보스 난이도 배율로 계산된다.
- `stageId`는 현재 데이터에 기록되는 메타데이터다. `validateContent()`는 이 값과 실제 웨이브 소속의 일치를 별도로 검사하지 않으므로 작성자가 참조 일관성을 유지해야 한다.

새 보스를 추가하면 `assets.js`의 `BOSS_IDS`, 보스 아틀라스 행, 4방향 물리 파일과 출시 에셋 검증 수량도 함께 갱신한다. 일반 적은 새 이미지 파일을 추가하지 않는다.

## 8. 스테이지, 경로, 웨이브

스테이지는 12×16 논리 보드를 사용한다. 전투 영역은 상단 12×12(y 0~11)로 고정하고, 하단 y 12~15는 렌더러가 UI 밴드로 그린다. 경로는 꼭 `expandOrthogonalPath()`로 웨이포인트를 셀 목록으로 확장한다.

```js
const EXAMPLE_WAYPOINTS = [
  point(0, 1),
  point(10, 1),
  point(10, 4),
  point(11, 4),
];

{
  id: 'example_stage',
  name: '예시스테이지',
  displayName: '예시스테이지',
  representativeElement: 'nature',
  featuredDefenseTypes: ['normal', 'heavy', 'regeneration'],
  midBossId: 'example_mid_boss',
  finalBossId: 'example_final_boss',
  availableDifficultyIds: ['easy'],
  displayedDifficultyIds: ['easy', 'normal', 'hard'],
  map: {
    columns: BOARD_RULES.columns,
    rows: BOARD_RULES.rows,
    spawn: point(0, 1),
    core: point(11, 4),
    pathWaypoints: EXAMPLE_WAYPOINTS,
    pathCells: expandOrthogonalPath(EXAMPLE_WAYPOINTS),
    obstacles: [point(3, 2)],
    placementCells: [/* 정확히 15칸 */],
    recommendedPlacements: { 0: point(1, 2) /* 슬롯 0~4, 화이트리스트 안 */ },
  },
  waves: exampleWaves,
}
```

경로 검증 규칙:

- 웨이포인트는 둘 이상이고 좌표는 정수다.
- 각 구간은 가로 또는 세로 한 방향으로만 이동해야 하며 길이 0 구간은 금지다.
- 확장된 모든 셀은 전투 영역(y ≤ 11) 안에 있어야 하고 같은 셀을 두 번 방문할 수 없다.
- 첫 셀은 `spawn`, 마지막 셀은 `core`와 같아야 한다.
- 장애물은 보드 안에서 서로 달라야 하며 경로와 겹치면 안 되고 y ≤ 11을 지킨다.

배치 화이트리스트 규칙 (`placementCells`):

- 스테이지마다 정확히 15칸, y 1~11, 중복 금지, 경로·장애물과 겹침 금지다.
- `recommendedPlacements`는 슬롯 0~4 전부 화이트리스트 안의 **서로 다른** 셀을 가리켜야 한다. 슬롯 0은 메인 영웅 자리라 첫 레인 인접칸을 권장한다(근접 메인 사거리 2).
- 런타임 배치는 화이트리스트로만 허용된다. 맵 재설계 이후 화이트리스트 밖(또는 옛 경로 위) 배치는 마이그레이션하지 않고 `validateCheckpoint`가 실패한다. `SaveRepositoryV2.loadCheckpoint()`는 그 세이브를 버리고 Continue를 숨긴다.
- `theme`은 `ruins` 또는 `chaos`다. 고대유적 게이트 보정(`enemyHpMultiplier` 1.1, `enemySpeedMultiplier` 0.9)은 해당 스테이지 일반 적 스폰에만 곱해지며, 같은 로스터를 쓰는 `long_boulevard`에는 적용되지 않는다.

웨이브는 `makeWave(number, groups, spawnOrder, options)`로 만든다. Phase 4부터 모든 일반 웨이브는 단일 적 타입이다.

```js
// 단일 타입 헬퍼(stages.js)
singleWave(2, 'sand_wisp', 30)
```

- 일반 웨이브는 단일 적 타입 20~30마리, 5·10웨이브는 보스 1마리다.
- 5웨이브의 한 마리는 `midBossId`, 10웨이브의 한 마리는 `finalBossId`여야 한다.
- `groups` 합계, `spawnOrder` 길이, `spawnOrder` 안의 ID별 빈도는 모두 일치해야 한다.
- `spawnOrder`가 실제 고정 출현 순서다. 런타임의 `buildFixedSpawnSequence()`는 `spawnOrder`가 없는 다른 입력 형태를 위한 결정론적 대체 경로지만, 현재 `makeWave()`와 검증 계약은 명시적 `spawnOrder`를 제공한다.
- HP 배율, 꿈결정 보상, 기본 스폰 간격은 각각 `WAVE_HP_MULTIPLIERS[number]`, `DREAM_CRYSTAL_REWARDS[number - 1]`, `WAVE_RULES.baseSpawnIntervalSeconds`에서 들어간다.
- 현재 한 스테이지의 총 보상은 15이며 체크포인트도 `crystals <= 15`, `nextWave <= 10`을 고정한다.
- 신규 스테이지는 기존 적 로스터를 재사용한다(`crossroads`는 혼돈의틈 로스터, `long_boulevard`는 고대유적 로스터). `enemy.stageId`는 정보성 필드이며 웨이브 참조 가능 적만 규정한다. 신규 적 추가 시 66개 에셋 계약(`directionalAssetIds`)도 함께 점검한다.

스테이지나 경로/웨이브 구성을 바꾸면 `shotgun-stages.test.mjs`의 고정 웨이포인트와 웨이브 기대값을 갱신한다. 새 스테이지는 `validateContent.js`의 기대 ID/수량, `simulation-balance.test.mjs`의 스테이지별 기준, 브라우저 검증의 기본 스테이지 참조도 점검한다.

## 9. 시각 효과 프리셋

`effects.js`의 프리셋 예시는 다음과 같다.

```js
{
  id: 'skill_area_hit',
  displayName: '범위 스킬 타격',
  durationSeconds: 0.60,
  shape: 'glyph_and_expanding_wave',
  particleCount: 24,
  radiusCells: 3,
}
```

`validateContent()`는 프리셋 ID, 양의 `durationSeconds`, 비어 있지 않은 `shape`를 확인한다. 하지만 프리셋 정의만 추가해도 화면에 자동으로 그려지는 구조는 아니다.

- `DamageSystem` 또는 공격 시스템이 `DISPLAY_EVENT_CONTRACT`에 맞는 이벤트를 생성해야 한다.
- `EffectRenderer`의 `LIFE_BY_PRESET`에 수명을 추가해야 한다.
- `EffectRenderer.#drawEffect()`의 `switch`에 실제 드로잉을 추가해야 한다.
- 새 이벤트 필드가 필요하면 표시 계약과 이벤트 생성 테스트를 함께 갱신한다.
- 효과·팝업은 각각 250개·40개 상한을 유지해야 한다.

`tests/unit/effects-renderer.test.mjs`에서 수명, 좌표, 감소 효과 모드, 대미지 숫자, 상한을 검증한다.

## 10. 66개 출시 에셋 계약

현재 출시 에셋은 정확히 다음 66개다.

- 영웅 초상화 10개
- 영웅 전투 스프라이트 10 × 4방향 = 40개
- 보스 전투 스프라이트 4 × 4방향 = 16개

물리 파일 경로:

```text
assets/characters/portraits/<hero_id>.webp
assets/characters/battle/<hero_id>/front.webp
assets/characters/battle/<hero_id>/back.webp
assets/characters/battle/<hero_id>/left.webp
assets/characters/battle/<hero_id>/right.webp
assets/bosses/<boss_id>/front.webp
assets/bosses/<boss_id>/back.webp
assets/bosses/<boss_id>/left.webp
assets/bosses/<boss_id>/right.webp
```

방향 순서 계약은 `front`, `back`, `left`, `right`이며 소스 아틀라스의 열도 이 순서를 사용한다. 현재 개별 WebP는 이미 잘린 단일 프레임이라 매니페스트의 `frame`은 `{ x: 0, y: 0, width: 1, height: 1 }` 전체 파일이다. `atlas.sourceFrame`은 원본 아틀라스에서의 위치를 보존하는 메타데이터다.

피벗:

- 초상화: `pivotX: 0.5`, `pivotY: 0.5`
- 전투 영웅/보스: `pivotX: 0.5`, `pivotY: 0.88`

피벗은 `BattleRenderer.spriteDestination()`에서 논리 엔티티 지점에 이미지의 어느 위치를 맞출지 결정한다. 값은 `[0, 1]` 범위여야 한다.

매니페스트의 출시 의미:

```js
{
  optional: true,
  fallbackAllowed: true,
  fallbackAllowedIn: ['development'],
  fallbackMode: 'development-only',
  releaseRequired: true,
  releaseFallbackAllowed: false,
}
```

개발 런타임에서는 요청 방향이 없으면 `SpriteResolver`가 같은 엔티티의 `front`를 시도하고, 그것도 없으면 렌더러의 코드 폴백을 사용할 수 있다. 그러나 출시 빌드는 폴백을 허용하지 않는다. 정적 검증은 모든 필수 파일의 존재, ID·경로 중복 금지, 정확한 디렉터리 패턴, 각 엔티티의 네 방향, 로스터 일치를 검사한다. 로컬 단일 HTML 빌드는 매니페스트의 모든 출시 파일을 data URL로 내장한다.

### 현재 생성 이미지의 불투명 배경 주의사항

현재 소스 아틀라스와 잘린 WebP는 생성 과정에서 실제 알파 대신 밝은 체크무늬가 들어간 불투명 이미지다. 그래서 `assets.js`는 사실대로 다음 상태를 기록한다.

```js
hasAlpha: false,
transparencyRequired: true,
transparencyStatus: 'runtime-connected-background-removal',
backgroundStatus: 'opaque-checkerboard-from-generation',
```

`AssetManager`는 `backgroundStatus`가 정확히 `opaque-checkerboard-from-generation`일 때만, 이미지 가장자리와 연결된 밝은 중성 픽셀을 캔버스에서 투명하게 만든다. 판정은 RGB 최솟값 224 이상이고 채널 간 차이가 14 이하인 픽셀이다. 이 처리는 가장자리와 연결된 밝은 의상·효과까지 제거할 가능성이 있으므로 새 에셋의 권장 계약은 실제 알파가 포함된 WebP다.

실제 투명 에셋으로 교체하면 픽셀 알파를 확인한 뒤 소스 아틀라스 메타데이터의 `hasAlpha`와 `transparencyStatus`를 사실에 맞게 갱신한다. `hasAlpha: true`이면 생성되는 매니페스트의 `backgroundStatus`는 `transparent`가 되어 런타임 배경 제거를 건너뛴다. 파일이 불투명한데 메타데이터만 투명으로 바꾸면 안 된다.

새 영웅은 출시 에셋이 5개, 새 보스는 4개 늘어난다. 현재 아래 위치가 `66`과 로스터 `10/10/4`를 고정하므로 모두 함께 갱신해야 한다.

- `js/content/validateContent.js`
- `scripts/verify_hero_defense_v2.js`
- `scripts/build_hero_defense_v2_local.mjs`
- `scripts/verify_hero_defense_v2_local_bundle.js`
- `tests/integration/content-architecture.test.mjs`

현재 보스 엔트리 생성기는 `SOURCE_ATLASES.bosses` 한 개를 직접 사용한다. 새 보스를 다른 아틀라스에 둘 경우 `BOSS_IDS`만 추가해서는 안 되고 보스별 아틀라스 선택 로직도 수정해야 한다.

## 11. 체크포인트와 콘텐츠 변경

`schemas.js`의 `validateCheckpoint()`는 `HERO_BY_ID`와 `STAGE_BY_ID`를 조회하므로 같은 데이터 shape 안에서 추가된 영웅·스테이지 ID는 룩업 테이블에 포함된다. 다만 아래 게임 규칙은 스키마에 고정돼 있다.

- 이지 난이도만 허용
- 메인 1명 + 일반 4명, 전원 배치
- 12×16 배치 좌표와 경로/장애물 충돌 검사
- 웨이브 1~10, 코어 1~10, 결정 0~15
- 영웅 레벨 1~6
- `lv4`, `lv6` 특성 선택과 해당 영웅/레벨 일치
- RNG 스냅샷 `sfc32-v1`

영웅 수, 웨이브 수, 레벨/특성 구조, 재화 상한 또는 저장 데이터 shape를 바꾸면 `schemas.js`, `persistence.test.mjs`, 체크포인트 연속성 테스트를 함께 바꾸고 `CHECKPOINT_SCHEMA_VERSION` 호환 정책을 명시해야 한다. 기존 ID 삭제·변경은 저장된 체크포인트를 무효화할 수 있으므로 별도 마이그레이션 없이 가볍게 처리하지 않는다.

## 12. 변경 유형별 검증 체크리스트

### 공통

- [ ] 공개 컬렉션과 룩업 테이블을 `deepFreeze`로 감쌌다.
- [ ] 데이터 안에 런타임 함수나 `Math.random()`을 넣지 않았다.
- [ ] ID가 비어 있지 않고 중복이 없으며 모든 참조가 존재한다.
- [ ] 캐릭터 ID 전용 분기를 `js/battle/systems/`에 넣지 않았다.
- [ ] `validateContent({ assets: ASSET_MANIFEST, throwOnError: true })`가 통과한다.

### 영웅·특성·버프·상태

- [ ] 메인/일반 수, Lv4/Lv6 선택지 수와 기대 ID를 갱신했다.
- [ ] 새 조건·효과 타입을 선언, 검증, 레지스트리, 소비 시스템까지 연결했다.
- [ ] `traits.test.mjs`, `aura-status.test.mjs`, `trait-interactions.test.mjs`에 행동 회귀 테스트를 추가했다.
- [ ] `trait-matrix-runtime.test.mjs`에서 모든 최종 빌드가 기본 공격과 스킬을 실제로 실행한다.
- [ ] 수치 변경 후 `simulation-balance.test.mjs`의 클리어율·중앙 시간을 확인했다.

### 적·보스·스테이지·웨이브

- [ ] 적/보스/스테이지 기대 ID와 수량을 갱신했다.
- [ ] 경로가 직교·보드 내부·무반복이고 장애물이 경로와 겹치지 않는다.
- [ ] 그룹 합계와 고정 `spawnOrder` 빈도가 일치한다.
- [ ] 5/10웨이브 보스, HP 배율, 보상, 스폰 간격 계약을 유지하거나 관련 전투·저장 규칙을 함께 변경했다.
- [ ] `shotgun-stages.test.mjs`, `content-architecture.test.mjs`, `simulation-balance.test.mjs` 기대값을 갱신했다.

### 효과·에셋

- [ ] 새 프리셋을 이벤트 생성부, 렌더러 수명, 드로잉 분기까지 연결했다.
- [ ] 초상화와 네 방향 WebP의 ID·파일 경로·피벗이 매니페스트와 일치한다.
- [ ] 실제 알파 여부와 `backgroundStatus` 메타데이터가 일치한다.
- [ ] 출시 에셋 수량 상수를 정적 검증·빌드·로컬 번들 검증에서 모두 갱신했다.
- [ ] `assets.test.mjs`, `effects-renderer.test.mjs`와 브라우저 시각 검증을 수행했다.

## 13. 권장 검증 명령

저장소 루트에서 실행한다.

```powershell
npm run lint:defense-hero-v2
node --test defense_hero_v2/tests/unit/traits.test.mjs defense_hero_v2/tests/unit/aura-status.test.mjs defense_hero_v2/tests/unit/assets.test.mjs defense_hero_v2/tests/unit/effects-renderer.test.mjs defense_hero_v2/tests/unit/shotgun-stages.test.mjs defense_hero_v2/tests/integration/content-architecture.test.mjs defense_hero_v2/tests/integration/trait-interactions.test.mjs defense_hero_v2/tests/integration/trait-matrix-runtime.test.mjs
npm run test:defense-hero-v2
npm run test:defense-hero-v2:local
npm run test:defense-hero-v2:browser
npm run verify
```

`npm run test:defense-hero-v2:local`은 66개 출시 에셋을 포함한 단일 HTML을 다시 만들고 `file://` 오프라인 실행을 확인한다. PR을 열거나 작업을 완료로 표시하기 전에는 저장소 규칙에 따라 최종 `npm run verify`가 반드시 통과해야 한다.
