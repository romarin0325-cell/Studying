**「오늘의 균열」은 매일 같은 다섯 명을 빌려 주고, 누가 쓰러질 때 누구에게 무엇을 남길지 다시 풀게 하는 7층 원정으로 만든다.** 11월 22일 균열에서 헬하운드 → 트라우마 → 시간의지배자는 투신 아레스에게 졌다. 같은 보스 입구에서 중견과 대장만 맞바꾸자 시간의지배자가 트라우마에게 **종언의예고**를 남겼고, 세 명이 살아 돌아왔다. 첫 도전은 그날의 기록으로 남기고, 귀환 직후 같은 편성으로 다시 해볼 수 있게 한다.

## 설계표

| 항목 | 확정안 |
|---|---|
| 한 판 | **7층, 전투 4회, 대여 5명, 동시 출전 최대 3명.** 첫 화면에서 대여 전원, 지역 규칙, 4층 문지기 둘, 7층 보스를 공개한다. |
| 날짜와 지역 | 기기 현지 달력의 `YYYY-MM-DD`가 기준이다. 공개 시드는 하이픈을 뺀 정수다. 홍련 화산 → 황혼 성당 → 별빛 정원 → 심야의 해구 → 투기장을 5일 주기로 돈다. 해당 지역 여정의 배경·규칙·보스를 쓴다. |
| 대여 편성 | 기본 출전은 **노멀 → 레어 → 전설**, 대기는 **레어 → 에픽**이다. 노멀의 유품이 물리면 두 번째 동료는 물리 유품을 주고 공격이 마공 이상인 레어다. 마법이면 반대로 고른다. 대기 둘은 첫 쌍과 반대 계통의 유품을 주고받을 수 있다. 다섯 명 모두 서로 다르고 실제 공격 유품이 있다. 첫 전투부터 다섯 명 사이에서 자유롭게 편성한다. |
| 출전과 사망 | 매 전투 `min(3, 살아 있는 대여 인원)`명을 출전시킨다. 직전 순서를 기억하고 쓰러진 자리만 채운다. 한 번 물러난 동료는 살아서 다음 방에 간다. 쓰러진 동료는 그 판에서 영구 이탈한다. 출전자 전멸로 전투를 지면 대기 동료가 있어도 원정이 끝난다. 보스와 마지막 동료가 함께 쓰러져 전투 결과가 승리면 **돌파 · 생존 0명**이다. |
| 유품 | 기존의 **위력 ×1.5, MP 0, 전투당 1회**를 쓴다. 받은 동료가 생존하면 다음 전투에서도 쓸 수 있다. 새 유품을 받으면 기존 것을 교체한다. 방 사이 HP·MP와 최후의 일인은 기존 전투 규칙을 따른다. |
| 시도 | 날짜마다 **기록 도전 1회**, 기록을 끝낸 뒤 **연습 무제한**이다. 준비 시트를 보는 것은 무료다. `첫 기록에 도전`을 눌러 저장에 성공하면 그날의 자리를 잡는다. 포기도 첫 기록으로 남는다. |
| 성적 | **돌파 > 실패 > 포기**. 돌파끼리는 **생존 인원이 많은 판 → 총 전투 턴이 적은 판** 순이다. 생존은 대기·후퇴를 포함한 대여 5명 전체에서 센다. 실패끼리는 도달층만 비교한다. 동률이면 앞선 기록을 유지한다. 속도 설정과 실제 경과 시간은 점수에 들어가지 않는다. |
| 기록과 보상 | 날짜마다 **첫 기록 1개와 연습 최고 1개**를 이 기기에 보관한다. 첫 기록으로 돌파하면 그 날짜에 황동 **돌파 도장 1개**를 찍는다. 연속 출석·연승 보상, 결정 수입·지출, 계정 영입·인연, 꿈 조각 생성·소비, 악몽 계약 도장, 수첩 진척은 모두 0이다. 대여 중 본 동료·유물도 본편 도감에 올리지 않는다. |
| 해금 | **첫 본편 생환**, 기존 꿈길 수첩 4장 달성 때 연다. 입문에서 배운 릴레이를 본편 보스까지 한 번 써본 시점이다. 기존 4장을 이미 달성한 저장은 첫 실행부터 열린다. |

### 7층 동선

| 층 | 문과 보상 |
|---|---|
| **1 · 몽마** | 지역 일반전 1회. `wildOf` 배율 **0.84**. 지역 규칙을 먼저 경험한다. |
| **2 · 보물방 둘** | 서로 다른 공개 유물 A·B 중 한 문에 들어가 하나를 무료 장착한다. 지도에서 이름과 효과를 읽을 수 있다. |
| **3 · 사건** | 날짜가 정한 손님 한 명이 온다. **루미**는 전원 축복 +10% 또는 한 명 +40%, **사막여우**는 다음 전투 첫 적에게 작열 3 또는 부식 1·저주 1, **젤리피쉬프린세스**는 스턴 1 또는 약화 1·부식 1이다. 모두 무료이며 `그냥 지나가기`도 가능하다. 손님은 이날 대여 명단에서 제외한다. |
| **4 · 문지기** | 공개된 **레어 그림자 → 에픽 그림자** 2연전. 각각 `shadowOf` **0.88**. 같은 전투 안에서 HP·MP와 유품이 이어진다. 승리하면 5층 보상 선택이 열린다. 그림자 합류 선택은 0회다. |
| **5 · 보물방 / 혼돈의 제단** | 공개 유물 C를 확실히 받거나, 기존 제단에서 살아 있는 한 명에게 축복을 건다. 제단은 최대 **3회** 굴리고 마지막 결과를 확정한다. |
| **6 · 몽마 / 위험한 문** | 두 문은 **같은 적·같은 시작 하늘·같은 전투 시드**, 배율 **0.98**이다. 오른쪽만 변덕 1개 또는 첫 적 접두사 1개가 붙고, 이기면 공개 유물 D를 장착한다. 왼쪽은 추가 효과와 유물 보상이 0이다. |
| **7 · 꿈의 주인** | 지역 여정 보스 1명. `bossOf` 배율 **1.16**. 승패와 동시에 날짜 기록을 정산한다. |

홍련은 1·6층에 야생 둘을 뽑고 각각 위 배율에 **0.65**를 곱한다. 별빛은 전투 문마다 시작 하늘을 공개하고, 심야의 조류는 기존대로 보스에게 적용하지 않는다. 6층 위험 문에도 본편 정예의 추가 ×1.12는 붙이지 않는다. A·B·C·D는 전부 다른 유물이므로 한 판의 최대 장착 수는 **3개**다. 샘·부활·추가 대여는 0회다. [지역 규칙과 기존 원정 구성](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md>)

## 엔진으로 잰 근거

작업 폴더의 `claude/relaymare-v1` 커밋 `3fa3ce7`에서 날짜 생성과 7층 배치를 메모리에 구성했다. 실제 카드 코어, 스프라이트 명단, `Bridge.create`, 출전·전투 정산·사건·제단 명령으로 끝까지 진행했다. **2026-11-21부터 2027-01-19까지 연속 60일**, 지역마다 12일, 두 방식 각 60판이다. [기준 시뮬레이터](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tools/sim.mjs>) · [전투 정산](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js>)

| 첫 시도 지표 | 서투름 | 신중 |
|---|---:|---:|
| 돌파 | **33/60 · 55.0%** | **37/60 · 61.7%** |
| 판당 총 전투 턴, 평균 / 중앙값 / 90백분위 | 34.0 / 34 / 41 | 37.2 / 36 / 49 |
| 소요 시간 추정, 중앙값 / 90백분위 | **8분 45초 / 9분 55초** | **9분 05초 / 11분 15초** |
| 돌파한 판의 평균 생존 인원 | **1.24/5명** | **2.97/5명** |
| 유품을 실제로 한 번 이상 사용한 판 | 57/60 | 53/60 |
| 자발적으로 물러난 판 | 0/60 | 51/60 |
| 7층 도착 | 60/60 | 60/60 |

**첫 기록의 목표는 신중 60~70%, 서투름 40~55%**다. 처음 보는 편성으로도 돌파할 여지를 주고, 예고를 읽고 편성을 바꾼 보람은 살아 돌아온 얼굴 수로도 보여 준다. 첫 표본에서 신중만 이긴 날은 8일, 서투름만 이긴 날은 4일이었다. 같은 배율로 **다음 60일**인 2027-01-20~03-20도 확인했다. 서투름 **26/60 · 43.3%**, 신중 **38/60 · 63.3%**였다.

- **서투름**은 `Run.defaultParty`를 확정한다. 2·5층 왼쪽 보물, 사건 첫 선택, 6층 안전 문을 고른다. 전투는 첫 처치 예고 기술, 없으면 예상 피해 최대 공격을 쓰고 후퇴하지 않는다.
- **신중**은 매번 `Run.suggestOrder`로 강한 셋을 골라 가장 강한 동료를 대장에 두고, `sim.mjs`의 처치·방어·공격 판단을 쓴다. 보스 전까지는 처치 예고가 없고 현재 동료가 예고 최저 피해에 쓰러지며 후임이 자기 예고 최고 피해를 견디면 물러난다. 2층 유물 선호순은 `double_attack, gale_storm, support_boost, lucky_vicky, big_bang, frozen_body, reverse`다. 사건은 루미의 한 명 축복을 전력 최고 동료에게, 사막여우의 부식·저주, 젤리피쉬의 스턴을 고른다. 5층 C가 더블어택·질풍노도면 보물, 그 외에는 제단에서 대박 또는 +30% 이상이 나올 때까지 최대 3회 굴린다. 6층은 생존 4명 이상이고 `tough`, `leech`, `glass`가 아니면 위험 문을 고른다.
- **시간은 추정치**다. 이전 감사와 같은 `정산 턴 × 10초 + 도달층 × 15초 + 전투 수 × 15초 + 귀환 20초`를 썼다. 승패·턴·생존·유품 사용은 엔진 실측이다. [재미 감사의 시간 환산 기준](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/history/consults/2026-11-21-astra-fun-audit.md>)

## 화면과 시간 경계

| 화면 | 390×844 배치와 실제 문구 |
|---|---|
| **꿈의 관측소** | 원래 큰 출발·이어가기 버튼 아래, `동료 · 수첩 · 기록` 위에 높이 **48px**의 한 줄을 둔다. 왼쪽 `오늘의 균열`, 오른쪽 `11.21 · 첫 도전`. 진행 중이면 `11.21 · 4층 이어가기`, 정산 뒤에는 `11.21 · 연습하기`. 해금 전에는 이 줄을 접는다. 본편과 균열이 모두 진행 중이면 위 버튼은 본편, 아래 줄은 균열을 이어간다. |
| **시작 시트** | 기존 하단 시트의 좌우 **14px**, 최대 높이 **90%**를 쓴다. `11월 21일 · 오늘의 균열` 아래 `심야의 해구 · 7층 · 전투 4회`, 보스 얼굴과 지역 규칙 한 줄을 둔다. 대여 얼굴은 `첫 출전` 3명과 `대기` 2명의 두 줄로 놓는다. 얼굴을 누르면 기술과 넘길 유품이 열린다. 하단에 `첫 도전은 오늘의 기록에 남는다. 이후에는 같은 균열을 연습할 수 있다.`와 높이 **56px**의 `첫 기록에 도전`, **44px**의 `닫기`를 둔다. |
| **지도·출전·전투** | 지도 제목 `11.21 균열`, 기존 층 띠 7칸에 4층 그림자와 7층 보스 얼굴을 표시한다. 결정 자리에는 `기록 도전` 또는 `연습`을 쓴다. 출전 화면은 기존 유품 화살표·순서 기억을 쓰고 영입 자격 문구는 숨긴다. 전투는 기존 방 이름 자리에 `균열 6층`을 표시한다. `전장·유물`을 누르면 전투가 멈추고 `11.21 · 기록 도전 · 정산한 전투 15턴`을 볼 수 있다. 기존 명령 타일과 물러나기 두 결과를 그대로 쓴다. |
| **결과** | `11.21 균열 돌파` 아래 대여 얼굴 5개, `생존 3/5명 · 33턴`, `유품 사용 2회`를 놓는다. 생존자는 원색, 쓰러진 자리는 이름과 `쓰러짐`을 함께 표시한다. 기록전 돌파에는 황동 날짜 도장을 찍는다. 실패 예시는 `7층에서 균열이 닫혔다`, 동귀어진은 `보스 격파 · 생존 0/5명`이다. 같은 날이면 `같은 편성으로 연습`, 날짜가 바뀌었으면 `오늘 균열 보기`, 보조 버튼은 `관측소로`다. |
| **기록** | 기존 `기록`의 `지역별 생환` 아래에 `균열 기록`을 둔다. 완료한 날짜를 최신순 **7개씩** 표시한다. 행 예시는 `11.21 · 심야의 해구 · 돌파`, 상세 시트는 `첫 기록  생존 1/5명 · 27턴`과 `연습 최고  생존 3/5명 · 33턴`이다. 첫 실패 뒤 연습으로 깬 날은 `첫 기록  7층 실패`와 `연습 최고  돌파`가 함께 남는다. |

**자정은 새로 출발할 때 적용한다.** 11월 21일 23:58에 시작해 22일 00:07에 끝내면 21일 기록이다. 준비 시트만 열어 둔 사이 자정이 지나면 `날짜가 바뀌었다. 11.22 균열을 확인하자.`로 새 편성을 보여 주고 다시 눌러 출발한다. 균열 진행 슬롯은 하나다. 어제 판이 남으면 `11.21 균열 이어가기` 또는 `11.21 도전을 포기`를 고른 뒤 오늘 판을 시작한다. 포기는 `이 도전을 ‘포기’로 기록할까요?`에서 확정한다.

**기기 시계는 현지 달력 그대로 받는다.** 이미 기록한 날짜로 돌아가면 연습만 열린다. 한 번도 연 적 없는 과거 날짜에는 첫 도전 1회를 허용한다. 미래 날짜를 잘못 열었다가 돌아온 사람도 원래 날짜를 플레이할 수 있다. 날짜별 기록은 기기 안에 남고, 연속 보상과 전역 순위는 없다.

**이어하기 단위는 기존 방 입구다.** 전투 중 닫으면 같은 방·적·시드와 마지막 출전 배치로 돌아가 순서를 다시 정할 수 있다. 이때 미정산 전투의 턴과 사망은 0회 반영된다. 제단에서 이미 굴린 대상·배율·남은 횟수, 확정한 사건과 유물, 정산이 끝난 전투는 그대로 복원한다. 기록 도전 1회는 **출발부터 최종 정산까지의 원정 한 건**을 뜻한다. [기존 저장 규칙](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js>)

## 구현 계약 블록

경로 기준은 `card_pixel/game/`이다. **엔진 담당**은 `src/content/daily-rift.js`, `src/engine/daily-rift.js`, `src/engine/daily-store.js`, `tests/daily-rift.test.mjs`를 추가하고 기존 `run.js`, `meta.js`, `save.js`, `tools/sim.mjs`를 연결한다. **화면 담당**은 `src/ui/screens/daily-rift.js`를 추가하고 `main.js`, `ui/nav.js`, `ui/run/index.js`와 기존 관측소·지도·출전·전투·기록 화면을 연결한다. `dungeonId`에는 실제 지역 ID를 써서 기존 배경·음악·적 상세를 재사용한다.

```ts
type Kind = 'official' | 'practice'
type DayKey = string                         // 실제 달력 날짜 YYYY-MM-DD
type Floor = 1 | 4 | 6 | 7

type DailySpec = {
  ruleVersion: 1, dayKey: DayKey, seed: number, dungeonId: string, bossId: string,
  loanIds: [string, string, string, string, string],
  gateIds: [string, string], wildIds: { 1: string[], 6: string[] },
  relicIds: [string, string, string, string], // A, B, C, D
  eventId: string, riskId: string,
  sky: Record<Floor, string[] | null>, altarSeed: number
}

type Score = {
  runId: string, dayKey: DayKey, kind: Kind, outcome: 'win' | 'lose' | 'abandon',
  floor: number, turns: number, livingIds: string[], heirloomsUsed: number
}

Daily.dayKey(now: Date) → DayKey
Daily.specFor(dayKey: DayKey, roster, ruleVersion = 1) → DailySpec
Daily.doorsFor(spec: DailySpec, floor: number, roster) → Door[]
Daily.compare(a: Score, b: Score) → -1 | 0 | 1   // 양수면 a가 앞선다
Meta.dailyRiftUnlocked(profile) → boolean        // notebook.chapters.includes(4)
```

**생성 순서까지 v1 규칙으로 고정한다.** `dayKey`는 기기의 `getFullYear/getMonth/getDate`로 만든다. 그 연·월·일의 **UTC 자정**을 86,400,000으로 나눈 정수 `d`는 지역 순환에만 쓴다. 지역 인덱스는 `((d % 5) + 5) % 5`, 배열 순서는 `[ember_volcano, twilight_cathedral, starlit_garden, midnight_trench, arena]`다. `seed = Number(dayKey.replaceAll('-', ''))`다. 난수열 `k`의 초기 상태는 `(seed ^ Math.imul(k, 0x9e3779b9)) >>> 0`이며 기존 `rng.js`의 `pick/shuffle/nextFloat`를 쓴다. URL의 `?seed=`는 본편에만 적용한다.

| 난수열 | 후보와 소비 순서 |
|---|---|
| **3 · 사건** | 먼저 `[rumi, glass_pawprints, jellyfish_vials]`에서 1개를 뽑고 `requires.present[0]`을 손님으로 예약한다. |
| **1 · 대여** | `roster.pool('common').sort()`에서 손님·이미 뽑은 ID·`heirloomSkill(card)`이 없는 카드를 제외한다. 등급은 원본 `card.grade`를 쓴다. 순서대로 ① 노멀 ② ①과 유품 타입이 같고 그 타입 공격치가 반대 공격치 이상인 레어 ③ 전설 ④ ①과 반대 유품 타입인 레어 ⑤ ④와 유품 타입이 같고 그 타입 공격치가 반대 공격치 이상인 에픽을 각각 `pick`한다. 초월·이벤트는 해당 등급을 대체하지 않는다. |
| **2 · 유물** | `[double_attack, gale_storm, lucky_vicky, big_bang]`에서 시작한다. 대여진에 유료 보조 기술, 물속성, 자연속성이 있으면 순서대로 `support_boost`, `frozen_body`, `reverse`를 추가한다. 한 번 `shuffle`한 앞 4개가 A·B·C·D다. |
| **4·5 · 적** | 열 4는 지역 풀을 ID순으로 정렬하고 대여진·손님을 제외한 뒤 레어, 에픽 순으로 문지기를 하나씩 뽑는다. 해당 등급이 비면 같은 조건의 정렬된 공용 풀을 쓴다. 열 5는 지역의 기존 `wild` 배열에서 1층 → 6층 순으로 복원추출한다. 6층 두 문이 추출 결과를 공유한다. |
| **6·7·8 · 전장** | 열 6은 `[glass, overheat, martyr, echo, tough, frenzy, leech, thorns]`에서 하나를 뽑는다. 앞 4개는 방 변덕, 뒤 4개는 첫 적 접두사다. 열 7은 별빛일 때 1·4·6·7층 순으로 한 번씩 굴려 `< 0.5`면 `[sun_bless, star_powder]`, 나머지는 `[]`다. 다른 지역은 `null`이다. 열 8의 초기 상태를 `altarSeed`로 저장하고 실제 제단 굴림에서만 소비한다. |
| **전투 시드** | 기존 `Run.battleOptions`의 `(seed + floor * 1013 + 정산한_전투_수 * 7) >>> 0`을 쓴다. 날짜의 문·유물·적은 시작 전에 확정한다. 제단 대상과 전투 결과는 그때의 생존자·편성·명령을 따른다. |

```ts
Run.createRun({ core, roster, daily: { spec, kind, attemptNo } }) → Run

run.id    = `rift/v1/${spec.dayKey}/${attemptNo}`
run.daily = { spec, kind, attemptNo }
run.dungeonId = spec.dungeonId
run.difficulty = 'normal'
run.floor = 1
run.floors = 7
run.phase = 'map'
run.pool, run.joinOrder, run.bench = 각각 spec.loanIds의 복사본
run.rng = { state: spec.altarSeed }
run.lastParty = null
run.pending = null
run.contract = null
run.guide = { bossOrder: false }
run.crystals = 0
```

- `official`은 `attemptNo === 1`, `practice`는 정수 `attemptNo >= 2`다. `daily`와 외부 `seed/dungeonId/profileView`, 악몽, 계약, `plain:true`를 함께 주거나 날짜·버전·대여 명단이 잘못되면 `RangeError('invalid_daily_options')`다. 본편과 이전 원정 저장의 `run.daily` 기본값은 `null`이다.
- `Run.confirmOrder`는 균열에서 생존 가능한 출전 수를 채우지 않으면 `{ok:false, reason:'invalid_party'}`를 돌려준다. `Run.settleBattle(run, summary)`는 기존 반환형을 쓰며 균열에서 `crystals:0`, `contract:null`이다. 4층 승리는 `pending:null`, 6층 위험 승리는 기존 `relic` 결과로 D를 1회 지급한다. 턴·사망·후퇴 생존·유품은 기존 정산을 한 번만 거친다.
- `Run.runRewards/finishRun`의 균열 결과는 `{result, recruitable:[], recruitLimit:0, shardCandidates:[]}`다. 영입 대기를 만들지 않는다. `Meta.recordRunProgress(profile, dailyRun)`은 `{profile, announce:{ok:true, chapters:[]}}`, `Meta.applyRunEnd`는 `announce.reason:'daily_run'`으로 거절한다. 기존 본편 저장소의 `save({profile,run:dailyRun})`도 **쓰기 전에** `false`를 반환한다. 이 가드가 있어야 균열 4층 저장이 본편 수첩을 열거나 진행 중인 본편을 덮는 일을 막을 수 있다.

**날짜 기록 저장소**는 전용 IndexedDB `relaymare.daily`, 스키마 버전 `1`로 둔다. `days[dayKey]`에는 `{spec, starts, official, bestPractice, last}`를, `session['active']`에는 `{runId, dayKey, kind, rev, snapshot, checkpoint}`를 둔다. `snapshot`은 `Save.serializeRun(run)`, `checkpoint`는 `{floor, turns, livingIds, heirloomsUsed}`다. 초기 상태는 날짜 행 0개, 활성 슬롯 `null`이다. 기존 `relaymare.session`에 저장된 본편은 별도로 이어간다.

```ts
DailyStore.open(indexedDB, { core, roster }) → Promise<Store>
store.view(profile, now) → { dayKey, unlocked, spec, official, bestPractice, active }
store.start({ profile, now, expectedDayKey, kind }) → { ok:true, run, rev }
store.resume() → { ok:true, run, rev }
store.save(run, rev) → { ok:true, rev }
store.finish(run, rev) → { ok:true, score, official, bestPractice, duplicate }
store.abandon(runId, rev) → finish와 같은 반환형
store.history({ before = null, limit = 7 }) → { rows, nextBefore }
store.clear() → void
```

저장소 메서드는 모두 비동기다. `view.active`는 `{runId, dayKey, kind, floor, rev} | null`이고 잠금 중 `spec`은 `null`이다. `start`는 해금·오늘 날짜·활성 슬롯·첫 기록 유무를 확인하고 첫 스냅숏과 `starts`를 같은 트랜잭션에 쓴다. 실패는 `{ok:false, reason}`이며 사유는 `locked`, `date_changed`, `active_exists`, `already_recorded`, `official_required`, `no_active`, `stale_revision`, `invalid_save`, `run_not_done`, `storage_failed` 중 하나다. `save`는 `runId/rev`가 맞을 때만 다음 `rev`로 쓴다. `finish`는 날짜 행 갱신과 활성 슬롯 해제를 한 번에 커밋한다. 같은 종료 콜백을 다시 받으면 기존 결과와 `duplicate:true`를 반환한다. 연습 포기는 최고 기록을 갱신하지 않는다. 재시작은 저장된 `spec` 버전을 사용한다. 기존 설정의 `모든 기록 지우기`에는 이 전용 저장소도 포함한다.

화면의 연결점은 `openDailyPreparation(view, ui)`, `dailyResultScreen(node, {spec, score, official, bestPractice}, ui)`, `openDailyHistory({rows, nextBefore}, ui)` 세 개다. `ui/nav.js`가 기록전·연습의 시작과 끝을 맡고, 진행 중에는 기존 `enterRun`에 균열 저장용 `host`를 전달한다. 결과 화면은 종료 트랜잭션이 성공한 뒤 연다.

## 합격 테스트

| 검사 | 고정 입력과 합격값 |
|---|---|
| **1. 날짜와 생성** | `20261121`은 심야의 해구·포세이돈, 대여 순서 `[werebear, void_knight, cure_master, succubus, archangel]`, 문지기 `[silent_librarian, red_dragon]`, 사건 `glass_pawprints`, 위험 `martyr`, 유물 `[double_attack, big_bang, lucky_vicky, gale_storm]`이다. 대표·봉인·꿈 조각·URL `?seed=7`을 달리해도 같은 날짜 명세가 나온다. |
| **2. 하늘과 선택 독립성** | `20261125` 별빛 정원은 1·4·6·7층 하늘이 차례로 `[]`, `[sun_bless,star_powder]`, `[]`, `[]`다. 2층의 다른 보물, 사건 건너뛰기, 제단 굴림 수를 바꿔도 6층 두 문의 적·하늘과 7층 보스 시드가 같다. `2024-02-29`는 유효하고 `2026-02-29`는 거절한다. |
| **3. 실제로 뒤집히는 보스 순서** | `20261122` 신중 정책의 7층에서 `hellhound → trauma → time_ruler`는 **누적 31턴 실패, 대기 2명 생존**이다. 같은 입구·명령 정책에서 `hellhound → time_ruler → trauma`는 **누적 46턴 돌파, 3명 생존**이며 `time_ruler → trauma`의 유품은 `종언의예고`다. |
| **4. 사망·정산 경계** | `20261203` 서투름은 **49턴 돌파·생존 0명**으로 첫 도장을 받는다. 같은 전멸 승리를 비최종 방에 넣으면 실패다. 4층에서 그림자 합류 대기가 생기지 않고, 6층 위험문 정산을 두 번 호출해도 D와 턴은 각각 한 번만 반영된다. |
| **5. 자정·시계 변경** | 도쿄 `2026-11-21 23:59:59`에 연 준비 시트로 22일 00:00에 첫 출발을 누르면 `date_changed`, 소모 0회다. 이미 출발한 21일 판은 22일에 끝내도 21일 행에 기록된다. 시계를 21일로 되돌리면 연습만 열리고, 22일의 미사용 첫 도전은 남는다. |
| **6. 복원과 본편 격리** | 본편 4층 저장과 꿈 조각 예약을 둔 채 균열을 시작한다. 균열 전투 중 복원하면 같은 방의 `order`, 제단 두 번째 굴림 뒤 복원하면 같은 대상·배율과 남은 1회다. 균열 승리·패배·포기 각각에서 본편 저장, 영입·인연·도감·수첩·계약 도장·예약 조각이 전후 동일해야 한다. 전용 저장소가 비어 있는 기존 프로필도 그대로 열린다. |
| **7. 기록의 단일성** | 두 탭에서 같은 날 첫 출발을 눌러도 공식 `runId`는 하나다. 오래된 `rev`의 저장은 거절한다. `20261121` 첫 기록이 **27턴·1명 돌파**, 연습이 **33턴·3명 돌파**이면 첫 기록은 그대로, 연습 최고는 3명, 날짜 도장은 하나다. |
| **8. 수치와 화면** | 구현 후 `node card_pixel/game/tools/sim.mjs --daily-from=2026-11-21 --days=60`이 위 두 정책으로 **33승·2,040턴 / 37승·2,229턴**을 재현해야 한다. 390×844에서는 본편·균열 이어가기가 각각 맞는 슬롯을 열고, 준비 시트의 출발 버튼이 닿으며, `전장·유물`을 열면 전투가 멈추고, 결과에서 날짜별 첫 기록과 연습 최고를 구별할 수 있어야 한다. |

이번 작업은 읽기 전용으로 진행했다. 파일 변경은 0건이다. 날짜별 승패와 보스 순서 교환은 Node에서 확인했고, 390×844 배치와 사람의 실제 플레이 시간은 구현 후 확인할 항목이다.