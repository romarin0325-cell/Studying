# 2편 진행방식

## 전체 흐름

1. 게임 데이터 불러오기
2. 모드/게임 타입 선택
3. 새 게임 초기화 또는 이어하기
4. 가챠, 덱 편집, 축복, 아티팩트/보너스풀 설정
5. 전투 진입
6. 승리/패배 후 보상, 미션, 해금 반영
7. 다음 스테이지 또는 런 종료

## 1. 새 게임 시작

모드와 게임 타입을 선택하고 게임을 시작합니다.

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

### 게임 모드

- **일반 모드(Challenge)**: 목표 스테이지까지 도달하는 것이 목표입니다.
- **무한 모드(Endless)**: 끝없이 적을 상대하며 기록을 세우는 모드입니다.

### 초보자 지원

게임을 처음 시작하여 카드가 부족한 플레이어를 위해 초기 진행에 도움을 주는 카드나 티켓이 기본적으로 제공됩니다.

`challenge` 계열에서 해금 보너스 카드가 5장 미만이면 안전장치가 작동한다.

- 일반 모드: `rumi`를 인벤토리에 보정 추가
- `chaos`/`draft`: 티켓을 최소 5장으로 보정

## 2. 전투 전 준비

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

## 3. 등장하는 적

기본 적 로테이션은 일반 보스 6종을 순환한다.

- `artificial_demon_god`
- `iris_love`
- `iris_curse`
- `pharaoh`
- `demon_god`
- `creator_god`

`endless`이고 스테이지가 37 이상이면, 현재 보스에 대응하는 숨은 보스가 30% 확률로 등장한다.

기본 보스로 인조 마신, 사랑의 여신 아이리스, 저주의 여신 아이리스, 고대신 파라오, 마신 벨제뷔트가 등장하며, 무한 모드 후반부에는 이들에 대응하는 숨겨진 보스(플로라, 사신 그레이, 뇌신 토르, 해신 포세이돈, 투신 아레스)가 등장할 확률이 있습니다.

## 4. 전투 승리 시

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

## 5. 전투 패배 시

- 일반 모드: 사망/초월 정리 후 메뉴 복귀
- `origin`: 패배 시 `global.pendingTranscendenceCards`를 비움
- `chaos`/`draft`: 저장 데이터 제거
- `dream_corridor`: 숨은 학습 카운터를 초기화하고 런을 강제 종료

## 6. 저장 및 이어하기

- 세이브에는 세션 상태만 저장되고, TOEIC 질문 세션 등 일부 일시 객체는 제외된다
- 글로벌 해금/미션/보너스풀/카오스 티켓은 별도 글로벌 저장소에 남는다
- 이어하기 시 누락된 신형 필드는 기본값으로 보정된다

## 7. 실전 마법 연습과 꿈의 회랑

`registerToeicPracticeAttempt()`는 TOEIC 실전 연습 결과와 숨은 학습 루트를 관리한다.

- 월간 `toeic3`, 주간 `toeic1` 미션을 증가시킨다
- `tutoringEventEnabled === false`일 때만 숨은 학습 카운터가 오른다
- 이 상태로 실전 연습 5회를 누적하면 `hiddenStudyReady = true`
- `dream_corridor` 시작 시 이 플래그는 즉시 소비되며, 실패하면 카운터도 초기화된다
