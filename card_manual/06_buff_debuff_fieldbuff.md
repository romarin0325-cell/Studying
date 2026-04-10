# 6편 버프·디버프·필드버프

## 이름 테이블

현재 버프 이름 테이블은 25개다.

- 디버프: `darkness`, `corrosion`, `silence`, `curse`, `weak`, `burn`, `divine`, `stun`
- 개인 버프: `evasion`, `barrier`, `magic_guard`, `guard`
- 적 전용 방어 프로토콜: `defProtocolPhy`, `defProtocolMag`
- 필드버프: `sun_bless`, `moon_bless`, `sanctuary`, `goddess_descent`, `destiny_oath`, `earth_bless`, `twinkle_party`, `star_powder`, `arena`, `reaper_realm`, `gale`

## 1. 필드버프

### 공통 규칙

- 기본 최대 유지 수: 3
- `buff_overload` 보유 시 최대 5
- 동일한 필드버프 재부여:
  - 만료 턴 정보가 없으면 “이미 존재” 로그만 남김
  - 만료 턴이 있으면 지속 턴을 갱신
- 상한 초과 시 가장 오래된 필드버프부터 제거

### 수치

- **태양의 축복 (sun_bless)**: 물리공격력과 마법공격력이 30% 상승하고, 치명타 피해가 증가합니다.
- **달의 축복 (moon_bless)**: 마법공격력이 30%, 회피율이 15% 상승합니다.
- **성역 (sanctuary)**: 마법공격력과 마법방어력이 30% 상승합니다.
- **여신강림 (goddess_descent)**: 모든 기본 능력치(물리/마법 공격력 및 방어력)가 30% 상승합니다.
- **운명의 맹세 (destiny_oath)**: 모든 기본 능력치가 30% 상승합니다.
- **대지의 축복 (earth_bless)**: 물리공격력과 마법공격력이 25% 상승합니다.
- **트윙클 파티 (twinkle_party)**: 물리공격력이 20%, 치명타 확률이 15% 상승합니다.
- **스타 파우더 (star_powder)**: 물리방어력과 마법방어력이 40% 상승합니다.
- **아레나 (arena)**: 일반 공격의 피해량이 2배로 증가합니다.
- **사신의 영역 (reaper_realm)**: 치명타 확률이 40% 상승하고 치명타 피해가 증가합니다.
- **질풍 (gale)**: 치명타 확률과 회피율이 20% 상승합니다.

## 2. 스택형 디버프

| 상태 | 기본 상한 | 아티팩트 상한 | 주요 소비처 |
|---|---:|---:|---|
| `burn` | 3 | 5 (`over_flame`) | 작열 소모 스킬, 물리 관통, 태양 계열 연계 |
| `divine` | 3 | 5 (`over_divine`) | 디바인 소모 스킬, 마법 관통, 성역 계열 연계 |

추가 규칙:

- `over_flame`, `over_divine` 보유 시 부여량 자체도 2스택씩 들어가는 로직이 존재한다
- 스택은 `Math.min(current + add, cap)`으로 제한된다

## 3. 1턴 버프

`TURN_BUFF_IDS = ['evasion', 'barrier', 'magic_guard', 'guard']`

이 4종은 각 캐릭터 자신의 턴 시작 시 `tickTurnBuffs()`로 감소한다.

- **회피태세 (evasion)**: 이번 턴 동안 회피율이 50% 상승하여 적의 공격을 피할 확률이 높아집니다.
- **배리어 (barrier)**: 적의 물리 공격을 1회 완전히 막아냅니다.
- **매직가드 (magic_guard)**: 적의 마법 공격을 1회 완전히 막아냅니다.
- **가드 (guard)**: 이번 턴 동안 적에게 받는 모든 피해가 절반으로 줄어듭니다.

## 4. 일반 디버프

- **암흑 (darkness)**: 적의 물리 방어력이 20% 감소합니다.
- **부식 (corrosion)**: 적의 물리 방어력이 20% 감소합니다.
- **침묵 (silence)**: 적의 마법 공격력이 20% 감소합니다.
- **저주 (curse)**: 적의 마법 방어력이 20% 감소합니다.
- **약화 (weak)**: 적의 물리 공격력이 20% 감소합니다.
- **기절 (stun)**: 적이 다음 턴에 아무런 행동을 할 수 없게 됩니다.

추가 규칙:

- `darkness + corrosion` 동시 적용 시 DEF -40%
- `shadow_ball`이 있으면 `darkness`가 MDEF 감소까지 확장
- `assassin_nail`이 있으면 `darkness/corrosion` 감소량이 2배
- `curse` 모드에서는 디버프 계수 자체가 2배로 증폭된다

## 5. 상태 해제/변환

대표적인 상태 조작은 아래와 같다.

- `clear_target_debuffs`: 대상 `buffs` 맵 전체 초기화
- `clear_self_debuffs`: 자신에게서 해제 가능한 디버프만 제거
- `consume_debuff_all`: 특정 스택 전부 소모 후 배율 증가
- `consume_debuff_fixed`: 정해진 스택만 소모
- `consume_debuff_then_random_debuff`: 특정 스택을 먹고 다른 디버프 생성
- `consume_all_burn_cond_buff`: 작열을 다 먹어 `sun_bless`, 없으면 `earth_bless`
- `random_debuff_consume_divine`: 디바인을 먹으면 랜덤 디버프 수 증가

## 6. 현재 버전에서 중요한 상태 상호작용

- `support_boost`: 모든 `sup` 스킬 비용을 0으로 만든다
- `lucky_vicky`: 치명타 또는 회피 발생 시 MP 10 회복
- `gale_storm`: 전투 시작 시 `gale`을 3턴 동안 부여
- `kaleidoscope`: 매 턴 시작 시 필드버프 구성을 통째로 섞는다
- `apply_lumi_guard`: `star_powder`가 있을 때만 가드를 생성한다
- `dream_form_execute`: 필드버프를 읽어 HP/MP 회복, 기절, 추가 배율, 버프 소모를 수행한다
