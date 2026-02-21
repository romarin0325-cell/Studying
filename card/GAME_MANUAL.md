# Card RPG 시스템 구현 매뉴얼 (코드 동기화판)

이 문서는 `card/` 버전의 실제 동작 코드(`index.html`, `logic.js`, `data.js`)와 **1:1로 맞춘 구현 명세**입니다.  
아래 규칙만 따르면 동일한 시스템을 재구현할 수 있습니다.

---

## 0) 먼저 결론 (질문하신 항목 즉답)

- **마나 자동 회복(턴 시작 +20, 피격 +10, 공격 +10)은 현재 실동작에 없음**.
  - 해당 값은 `GAME_CONSTANTS.BATTLE`에 정의만 되어 있고, 실제 전투 루프에서는 사용되지 않습니다.
- **달의 축복 자체에는 관통 기능이 없음**.
  - `moon_bless` 기본 효과는 `MATK +30%, 회피 +15%` 뿐입니다.
  - 관통은 특정 스킬/아티팩트(예: 초월 루미 `꿈의형태`, `divine_piercing`)에서만 발생합니다.
- **버프/특성/방어 계산식은 아래 식으로 정리 가능**하며, 현재 코드 기준 일관됩니다.
- **초월 룰렛(카오스 룰렛), 퀴즈 연동 보상 시스템은 실제로 존재**하므로 구현 명세에 포함해야 합니다.
- **아티팩트는 현재 총 26개가 전부**입니다(목록 7장 참조).

---

## 1) 데이터 구조

## 1-1. 카드 원본 데이터
- 카드 정의는 `data.js`의 `CARDS`, `BONUS_CARDS`, `TRANSCENDENCE_CARDS`.
- 각 카드 스키마:
  - `id, name, grade, element, role`
  - `stats: { hp, atk, matk, def, mdef }`
  - `trait: { type, val?, ... }`
  - `skills: [{ name, type(phy/mag/sup), tier, cost, val?, desc, effects[] }]`

## 1-2. 전투 중 캐릭터 인스턴스
- 전투 복사본은 대략 아래 필드 사용:
  - `hp, maxHp, mp, atk, matk, def, mdef`
  - `baseCrit(기본 10), baseEva(기본 0)`
  - `buffs` (맵), `isDead`, `proto`(원본 카드 참조)

## 1-3. 필드 버프
- 기본 동시 유지 상한: **3개**, 아티팩트 `buff_overload` 보유 시 **5개**.
- 정의값(플레이어 측에만 스탯 반영):
  - `sun_bless`: atk+30%, matk+30%
  - `moon_bless`: matk+30%, evasion+15
  - `sanctuary`: matk+30%, mdef+30%
  - `goddess_descent`: atk/matk/def/mdef +30%
  - `earth_bless`: atk+25%, matk+25%
  - `twinkle_party`: atk+20%, crit+15
  - `star_powder`: def+40%, mdef+40%
  - `reaper_realm`: crit+40
  - `gale`: crit+20, evasion+20

---

## 2) 스탯 계산 규칙 (`Logic.calculateStats`)

최종 스탯 계산 순서:

1. **기본값 로드**  
   - `crit = baseCrit(없으면 10)`  
   - `evasion = baseEva + 5`

2. **혼돈 축복(blessing) 보정**  
   - 축복 받은 카드: crit +10, evasion +5 (추가로 전투 시작 전 스탯 배수도 이미 반영됨)

3. **조건형 특성(합연산)**  
   - 예: 필드버프 없음 시 crit/evasion 증가 등.

4. **배율 묶음 m 초기값 1.0**  
   - `m = { atk:1, matk:1, def:1, mdef:1 }`
   - 필드버프/디버프/아티팩트/일부 특성은 전부 여기에 더하거나 빼서 누적.

5. **필드버프 적용(플레이어만)**  
   - 각 버프 수치를 `m.*` 또는 `crit/evasion`에 누적.
   - 모드 `flood`이면 필드버프 수치 2배.
   - 아티팩트 배율:
     - `nature_blessing`: `earth_bless` 효과 2배
     - `milkshake`: `star_powder` 효과 2배

6. **개인 버프/디버프 적용**
   - `weak`: atk -20%
   - `silence`: matk -20%
   - `curse`: mdef -20%
   - `evasion`: evasion +50
   - `darkness/corrosion`: def -20% / 동시 -40%
   - 모드 `curse`이면 위 디버프 계수 2배

7. **관련 아티팩트 보정**
   - `assassin_nail`: darkness/corrosion 방어 감소량 2배
   - `shadow_ball`: darkness가 mdef도 감소
   - `veil_of_darkness`: 어둠 속성 crit/evasion +10
   - `rabbit_hole`: 특정 토끼 3종 crit/evasion +20
   - `shadow_stab`: evasion +20, def/mdef -30%

8. **최종치 확정**
   - `finalStat = floor(base * max(0, m))`

---

## 3) 대미지 계산 규칙 (`Logic.calculateDamage`)

## 3-1. 적용 대상
- `phy` / `mag`만 대미지 계산, `sup`는 대미지 0.

## 3-2. 치명타
- 확률: `rand < srcStats.crit`
- 강제치명(`force_crit`)·확률강제치명(`force_crit_chance`) 가능
- 치명타 배율 기본 1.5
  - `sun_bless` 활성 시 +0.6
  - `reaper_realm` 활성 시 +0.4

## 3-3. 속성 상성
- `water > fire > nature > water`, `light ↔ dark`
- 우위일 때 1.2배
- `all_advantage` 특성은 항상 우위 처리

## 3-4. 대미지 기본식
- `val = (phy ? src.atk : src.matk)`
- `mult = skill.val(기본 1.0)` + 각종 효과 누적
- `dmgBonus`는 특성 기반 추가 배율(가산 후 마지막에 곱)
- 방어값 `def = (phy ? tgt.def : tgt.mdef)`
- 최종:

```text
finalMult = mult * (1 + dmgBonus)
finalDmg = floor( val * finalMult * (100 / (100 + def)) )
```

> 즉, 방어 상수는 **100**이며, 분모식은 `100 + 방어력`.

## 3-5. 관통/무시
- 기본 `moon_bless`에는 관통 없음.
- 관통이 생기는 경우:
  - 스킬 효과(`ignore_mdef`, 특정 조건 관통 등)
  - 아티팩트 `flame_piercing`(작열 스택×10% 물방 관통)
  - 아티팩트 `divine_piercing`(디바인 스택×10% 마방 관통)
  - 일부 특성(스택 비례 무시, 치명타 시 추가 무시)
  - 초월 루미 `꿈의형태`의 필드버프 변환 효과(버프별 추가 배율/관통)

---

## 4) 전투 턴 루프 요약

1. 플레이어 턴 시작
   - 기절(`stun`)이면 행동 불가 후 해제.
   - 지연 스킬 발동 체크.
   - 아티팩트/필드 관련 턴 시작 효과 처리(`kaleidoscope`, `gale_storm` 등).

2. 플레이어 행동
   - 스킬 선택(또는 일반공격).
   - MP 검사 후 사용(예외: `blue_moon` 30% 확률 무소모, `support_boost`로 sup cost 0).
   - 명중 전 회피 판정.
   - 배리어/매직가드/가드 반영.
   - 대미지 및 부가효과 적용.

3. 적 턴
   - 보스 전용 AI/방어 프로토콜 처리.
   - 동일하게 회피/보호/대미지 계산.

4. 사망 처리
   - 사망 특성(`handleDeathTraits`) 발동.
   - 다음 슬롯 교대.

5. 종료
   - 적 전멸 시 승리, 아군 전멸 시 패배.

---

## 5) MP(마나) 시스템 실제 동작

- 시작 MP: 100
- 스킬 사용 시 `cost`만큼 차감
- 예외:
  - `blue_moon`: 30% 확률로 MP 미소모
  - `support_boost`: 보조스킬 `sup` 비용 0
  - `lucky_vicky`: 치명타 또는 회피 시 MP +10
  - 일부 효과로 즉시 MP 증가(예: 꿈의형태에서 성역/스타파우더 변환 시)
- **자동 MP 회복 루프(턴/피격/공격)는 현재 없음**

---

## 6) 모드 / 가챠 / 초월 / 퀴즈 연동

## 6-1. 시작 티켓
- 기본 20, 대부분 특수 모드 10, draft 5, chaos 0.

## 6-2. 가챠 등급 확률
- 모드별 확률표 `GACHA_RATES` 사용.
- challenge 뽑기는 일반보다 상위 등급 확률 증가.

## 6-3. 카오스 룰렛(초월 카드 획득)
- `chaosTickets` 1장 소모.
- 아직 `pendingTranscendenceCards`에 없는 초월 카드 중 랜덤 1장 지급.

## 6-4. 혼돈의 축복 / 대현자의 축복
- 혼돈 축복: 전투 내 강화 버프 부여, 사용 횟수 제한.
- 대현자 축복: 선택 카드군(최대 12) 강화 + 보상(티켓) 로직 포함.

## 6-5. 퀴즈 연동 보상
- 일반 승리 후: 퀴즈 성공 시 티켓 +1.
- `creator_god` 처치 시:
  - 일반 모드: 문법 퀴즈 성공 시 티켓 +3
  - artifact 모드: 문법 퀴즈 성공 시 아티팩트 선택 기회
- chaos/draft: 콜로케이션 퀴즈 성공 시 티켓 +1

> 따라서 “퀴즈 연동 강화/보상 시스템”은 **명세에 반드시 포함**해야 합니다.

---

## 7) 아티팩트 전체 목록 (26개, 현행 전부)

1. 대자연의 축복 (`nature_blessing`)
2. 리버스 (`reverse`)
3. 밀크쉐이크 (`milkshake`)
4. 버프오버로드 (`buff_overload`)
5. 섀도우볼 (`shadow_ball`)
6. 어쌔신네일 (`assassin_nail`)
7. 베일오브다크니스 (`veil_of_darkness`)
8. 래빗홀 (`rabbit_hole`)
9. 럭키비키 (`lucky_vicky`)
10. 오버플레임 (`over_flame`)
11. 오버디바인 (`over_divine`)
12. 홀리플레임버스트 (`holy_flame_burst`)
13. 플레임피어싱 (`flame_piercing`)
14. 디바인피어싱 (`divine_piercing`)
15. 질풍노도 (`gale_storm`)
16. 프로즌바디 (`frozen_body`)
17. 아이스브레이크 (`ice_break`)
18. 서포트부스트 (`support_boost`)
19. 더블어택 (`double_attack`)
20. 데스룰렛 (`death_roulette`)
21. 섀도우스탭 (`shadow_stab`)
22. 드래곤하트 (`dragon_heart`)
23. 빅뱅 (`big_bang`)
24. 길동무 (`companion`)
25. 만화경 (`kaleidoscope`)
26. 블루문 (`blue_moon`)

---

## 8) 구현 체크리스트 (이대로 만들면 동일 동작)

- [ ] 카드/적/스킬/effect/trait 데이터 구조를 동일 키로 구성
- [ ] 스탯 계산 순서를 2장 순서대로 구현 (가감 순서 중요)
- [ ] 대미지 식을 `100/(100+def)`로 고정
- [ ] 회피/배리어/매직가드/가드 우선순위 동일 처리
- [ ] 필드버프 상한(3, 아티팩트 시 5) 및 중복 처리 동일화
- [ ] MP 자동회복 없음 상태로 구현
- [ ] 카오스 룰렛/초월 카드 보관/오리진 연계 구현
- [ ] 전투 후 퀴즈 보상 분기(모드/보스별) 구현
- [ ] 아티팩트 26종 전부 구현

---

## 9) 주의: 문서와 데이터의 역할 분리

- 이 문서는 **엔진 규칙** 명세입니다.
- 개별 카드/적의 수치·스킬 목록은 방대하므로, 실제 구현 시 `data.js` 테이블을 그대로 소스 오브 트루스로 사용해야 누락이 없습니다.
- 즉 “시스템은 본 문서”, “콘텐츠 수치/목록은 데이터 테이블”로 분리하는 것이 정답입니다.
