# 3편 전투계산공식

## 1. 전투 시작

전투에 들어가면 선택한 카드의 기본 능력치와 덱의 시너지 효과, 그리고 가지고 있는 축복 등이 모두 합산되어 캐릭터의 최종 스탯이 결정됩니다.

### 적

적은 현재 스테이지 적 데이터를 읽어 아래 형태로 생성된다.

- `maxHp`, `hp`, `atk`, `matk`, `def`, `mdef`
- `baseAtk`, `baseMatk`, `baseDef`, `baseMdef`
- `skills`
- `buffs`
- `isHiddenBoss`
- `bonusRewardTickets`
- `bonusTranscendenceReward`

숨은 보스가 아닌 일반 적도 스테이지 순환 횟수에 따라 `1.0 + cycle * 0.2` 배수로 스탯이 상승한다.

## 2. 초기 스탯 계산 (`Logic.calculateInitialStats`)

기본 스탯은 카드 원본의 `hp/atk/matk/def/mdef`와 `baseCrit = 10`, `baseEva = 0`에서 시작한다.

### 반영 순서

1. 덱 전체 시너지 특성(`syn_*`) 체크
2. 활성 시 본인 스탯 직접 배수 적용
3. 파티 전체 보정 특성 합산
4. 배치 특성 보정
5. 결과를 `floor` 처리

### 대표 초기 시너지

- `syn_water_3_atk_matk`: 물 3장 이상 시 ATK/MATK 강화
- `syn_fire_3_crit`: 불 3장 시 기본 치명타 증가
- `syn_dark_full_party_crit`: 어둠 3장 시 파티 치명타 증가
- `syn_light_3_party_def_mdef`: 빛 3장 시 파티 방어 증가
- `joker_wild`: 조커를 모든 속성/이름으로 취급

## 3. 실시간 스탯 계산 (`Logic.calculateStats`)

실시간 스탯은 턴마다 다시 계산된다.

### 순서

1. 기본값 로드
   - `crit = baseCrit || 10`
   - `evasion = baseEva + 5`
2. 혼돈의 축복 보정
   - 축복 대상은 `crit +10`, `evasion +5`
3. 조건형 특성의 합연산 보정
4. 배율 묶음 `m = { atk:1, matk:1, def:1, mdef:1 }` 초기화
5. 필드버프 반영
6. 개인 버프/디버프 반영
7. 아티팩트 반영
8. `finalStat = floor(base * max(0, m))`

### 필드버프 반영 예시

- `sun_bless`: `atk +30%`, `matk +30%`
- `moon_bless`: `matk +30%`, `evasion +15`
- `star_powder`: `def +40%`, `mdef +40%`
- `gale`: `crit +20`, `evasion +20`

### 디버프 반영 예시

- `weak`: ATK -20%
- `silence`: MATK -20%
- `curse`: MDEF -20%
- `darkness`: DEF -20%
- `corrosion`: DEF -20%
- `darkness + corrosion`: DEF -40%

### 현재 구현상 주의

- `moon_bless` 자체에는 관통이 없다
- `shadow_ball`이 있을 때만 `darkness`가 MDEF 감소까지 확장된다
- `shadow_stab`은 회피를 주는 대신 DEF/MDEF를 30% 깎는다

## 4. 플레이어 피해 공식 (`Logic.calculateDamage`)

### 기본식

1. 공격 종류에 따라 `val = srcStats.atk` 또는 `srcStats.matk`
2. 상성 우위면 `val *= 1.2`
3. 스킬 고유 배율을 `mult = skill.val || 1.0`으로 시작
4. 스킬 효과와 특성이 `mult` 또는 `dmgBonus`를 누적
5. 방어 관통/무시 계산 후 방어치 `def` 확정
6. 치명타면 `val *= critDmg`
7. 최종 계산

```text
finalMult = mult * (1 + dmgBonus)
finalDmg = floor(val * finalMult * (100 / (100 + def)))
```

### 치명타 배율

- 기본: `1.5`
- `sun_bless` 동시 보유: `+0.6`
- `reaper_realm` 동시 보유: `+0.4`

### 대표 관통/무시

- `burn_stack_phy_pen`: 작열 스택 비례 물리방어 관통
- `flame_piercing`: 작열 1스택당 물리방어 10% 관통
- `divine_piercing`: 디바인 1스택당 마법방어 10% 관통
- `ignore_def_mdef_by_stack`: 신데렐라 계열 스택 비례 방어 무시
- `crit_ignore_def_add`: 그레이 계열 치명타 시 추가 50% 방어 무시

## 5. 꿈의형태 특수 공식

`trans_lumi`의 `꿈의형태`는 현재 필드버프를 읽어 추가 배율과 부가 효과를 얻는다.

| 필드버프 | 효과 |
|---|---|
| `sun_bless` | +2.0배, 확정 치명타 |
| `moon_bless` | 마법방어 30% 관통, +1.0배 |
| `star_powder` | +1.0배 |
| `earth_bless` | +2.0배 |
| `sanctuary` | +2.0배 |
| `goddess_descent` | +4.0배 |
| `destiny_oath` | +10.0배 |
| `reaper_realm` | 마법방어 50% 관통, +1.0배 |
| `twinkle_party` | +3.0배 |
| `gale` | +3.0배 |

실행 후 실제 필드버프 소모와 보조 효과는 side effect 단계에서 처리된다.

## 6. 턴 진행

### 플레이어 턴 시작

1. 새 턴이면 필드버프 만료 체크
2. `kaleidoscope`가 있으면 기존 필드버프를 랜덤 재편성
3. 현재 플레이어 슬롯의 지연 스킬 발동
4. `tickTurnBuffs()`로 `evasion`, `barrier`, `magic_guard`, `guard` 지속값 감소
5. `stun`이 남아 있으면 행동 없이 해제 후 턴 종료

### 플레이어 행동

1. 스킬 사용
2. `blue_moon` 30% 무소모 체크
3. 일반 공격 관련 특성 선처리
4. 지연 스킬이면 예약 또는 즉시 발동
5. 대미지 계산
6. 부가 효과 적용
7. 사망 처리

### 적 턴 시작

1. 적의 `def/mdef`를 `baseDef/baseMdef`로 복구
2. `tickTurnBuffs()` 적용
3. `stun`이면 행동 없이 해제 후 종료
4. `Logic.decideEnemyAction()`으로 스킬 선택

## 7. 적 공격 판정 순서

적 공격은 아래 순서를 가진다.

1. 회피 판정
2. `lucky_vicky` MP 회복
3. `on_evasion_stun` 반격 기절 체크
4. `barrier`면 물리 완전 무효
5. `magic_guard`면 마법 완전 무효
6. `guard`면 피해 50% 감소
7. 적중 후 스킬 부가 효과 적용

### 추가 규칙

`guard_stun_double_dmg` 계열 기절 트리거는 이제 “가드 버프가 있었다”가 아니라 실제로 `guardSucceeded`가 된 경우에만 발동한다. 즉, 포세이돈 계열의 기절 조건은 방어 성공 기준이다.

## 8. 현재 구현상 반드시 알아둘 점

- 플레이어 공격은 적의 회피/가드/배리어/매직가드를 체크하지 않는다.
- 적 공격은 플레이어 방어 버프를 모두 체크한다.
- `TURN_BUFF_IDS`는 턴 시작 직전에 감소하므로, `guard`나 `evasion`은 “다음 자기 차례가 오기 전까지” 유지된다.
- `gale` 필드버프는 이미 존재할 때 `expiresAtTurn`을 갱신한다. `실피드`와 `질풍노도` 아티팩트는 이 규칙을 사용한다.
