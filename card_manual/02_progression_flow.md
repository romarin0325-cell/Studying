# 2편 진행방식

## 전체 흐름

1. 글로벌 데이터 로드
2. 모드/게임 타입 선택
3. 새 게임 초기화 또는 이어하기
4. 가챠, 덱 편집, 축복, 아티팩트/보너스풀 설정
5. 전투 진입
6. 승리/패배 후 보상, 미션, 해금 반영
7. 다음 스테이지 또는 런 종료

## 1. 글로벌 데이터 초기화

게임 시작 시 아래 글로벌 상태가 먼저 정리된다.

- 기본 해금 보너스 카드 4장 보장: `ancient_soul`, `sun_priestess`, `cloud_sheep`, `joker`
- 카오스 티켓 버전 체크 후 필요 시 초기화
- 보너스 카드 풀 프리셋 3칸 정규화
- 월간 미션, 주간 미션 상태 생성
- 주간 출석 카운트 반영

## 2. 새 게임 시작

`initNewGame(mode)`는 아래 상태를 만든다.

- `tickets`
- `inventory`
- `deck`
- `enemyScale`
- `chaosBlessingUses`, `greatSageBlessingUses`
- `chaosBuffs`, `activeChaosBlessing`, `activeSageBlessing`
- `activeBonusPoolIds`
- `activeTranscendenceCards`
- `activeEventCards`
- `artifacts`
- `chaosPool`
- `draft` 상태

### 게임 타입

- 기본값은 `challenge`
- `origin`은 보통 `endless`로 쓰인다
- `endless`에서는 `global.pendingTranscendenceCards`가 이번 런의 활성 초월 카드로 옮겨진다
- `challenge`는 모드별 클리어 스테이지가 존재한다

### 초보자 보호

`challenge` 계열에서 해금 보너스 카드가 5장 미만이면 안전장치가 작동한다.

- 일반 모드: `rumi`를 인벤토리에 보정 추가
- `chaos`/`draft`: 티켓을 최소 5장으로 보정

## 3. 전투 전 준비

### 가챠

- 일반 가챠: 티켓 1장 소모
- 챌린지 가챠: 티켓 1장 선소모 후 퀴즈 성공 시 상향 확률 사용
- 등급은 `GameUtils.resolveGachaGrade()`가 모드별 확률표로 결정

### 덱 편집

- 덱은 3칸
- 빈 덱으로는 전투 시작 불가
- `activeBonusPoolIds`는 이번 런에서만 사용할 보너스 카드 하위 집합

### 혼돈의 축복 / 대현자의 축복

- `혼돈의 축복`: 일반 3장, 도전 5장 카드 풀에서 랜덤 축복
- `대현자의 축복`: 문법 퀴즈 성공 시 최대 12장 카드 중 축복 + 티켓 1장
- 둘 다 남은 사용 횟수는 새 게임에서만 리셋된다

### 카오스 / 드래프트

- `chaos`는 시작 시 카드풀 15장을 `chaosPool`로 뽑고 인벤토리에 바로 넣는다
- `draft`는 4장 선택지를 만들고 리롤 횟수(`rerolls`)를 가진다
- 둘 다 전투 승리 후 덱과 인벤토리를 다시 갱신한다

## 4. 적 선정

기본 적 로테이션은 일반 보스 6종을 순환한다.

- `artificial_demon_god`
- `iris_love`
- `iris_curse`
- `pharaoh`
- `demon_god`
- `creator_god`

`endless`이고 스테이지가 37 이상이면, 현재 보스에 대응하는 숨은 보스가 30% 확률로 등장한다.

| 기본 보스 | 숨은 보스 |
|---|---|
| `artificial_demon_god` | `flora` |
| `iris_love` | `gray` |
| `iris_curse` | `thor` |
| `pharaoh` | `poseidon` |
| `demon_god` | `ares` |

## 5. 승리 처리

승리 시 공통으로 일어나는 일:

- 티켓 지급
- 혼돈 축복/대현자 축복의 활성 로그 초기화
- `endless40`, `challenge3`, `toeic3`, `challenge1`, `toeic1` 등 관련 미션 카운트 반영

모드별 추가 처리:

- `chaos`: 다음 전투용 `chaosPool` 15장 재생성
- `draft`: 드래프트 상태 초기화
- `archive`: 문법 퀴즈를 강제로 거쳐 `finishWinBattle()`로 이동
- `dream_corridor`: 일반 승리 처리 대신 전용 종료 루틴 사용

보스/이벤트 추가 처리:

- `creator_god` 승리 후 일반 모드에서는 문법 퀴즈 성공 시 티켓 +3
- `creator_god` 승리 후 `artifact` 모드에서는 퀴즈 성공 시 아티팩트 선택 화면 진입
- 특정 숨은 보스는 10% 확률로 보너스 초월 카드를 영구 해금한다

## 6. 패배 처리

- 일반 모드: 사망/초월 정리 후 메뉴 복귀
- `origin`: 패배 시 `global.pendingTranscendenceCards`를 비움
- `chaos`/`draft`: 저장 데이터 제거
- `dream_corridor`: 숨은 학습 카운터를 초기화하고 런을 강제 종료

## 7. 저장/불러오기

- 세이브에는 세션 상태만 저장되고, TOEIC 질문 세션 등 일부 일시 객체는 제외된다
- 글로벌 해금/미션/보너스풀/카오스 티켓은 별도 글로벌 저장소에 남는다
- 이어하기 시 누락된 신형 필드는 기본값으로 보정된다

## 8. 실전마법연습과 꿈의회랑

`registerToeicPracticeAttempt()`는 TOEIC 실전 연습 결과와 숨은 학습 루트를 관리한다.

- 월간 `toeic3`, 주간 `toeic1` 미션을 증가시킨다
- `tutoringEventEnabled === false`일 때만 숨은 학습 카운터가 오른다
- 이 상태로 실전 연습 5회를 누적하면 `hiddenStudyReady = true`
- `dream_corridor` 시작 시 이 플래그는 즉시 소비되며, 실패하면 카운터도 초기화된다
