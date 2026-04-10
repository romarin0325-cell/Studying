# 9편 모드·보상·해금 시스템

## 1. 시작 티켓

| 모드 | 시작 티켓 |
|---|---:|
| 기본(`default`) | 20 |
| `origin` | 20 |
| `restriction` | 10 |
| `balance` | 10 |
| `suffering` | 10 |
| `overdrive` | 10 |
| `archive` | 10 |
| `curse` | 10 |
| `flood` | 10 |
| `artifact` | 10 |
| `draft` | 5 |
| `chaos` | 0 |

## 2. 클리어 스테이지

`gameType === 'endless'`이면 클리어 스테이지는 무한대로 취급한다. `challenge`일 때만 아래 값이 적용된다.

| 모드 | 클리어 스테이지 |
|---|---:|
| 기본(`default`) | 24 |
| `restriction` | 18 |
| `balance` | 18 |
| `archive` | 18 |
| `chaos` | 24 |
| `draft` | 24 |
| `overdrive` | 30 |
| `curse` | 30 |
| `flood` | 30 |
| `artifact` | 36 |
| `origin` | 무한 |

## 3. 가챠 확률

### 기본/공통 확률표

| 모드 | 일반 가챠 | 챌린지 가챠 |
|---|---|---|
| `default` 계열 | legend 10%, epic 30%, rare 60%, else normal | legend 20%, epic 45%, rare 75%, else normal |
| `restriction` | rare 20%, else normal | rare 40%, else normal |
| `balance` | epic 10%, rare 30%, else normal | epic 20%, rare 50%, else normal |

### 등급 상한

- `restriction`: `rare` 이하
- `balance`: `epic` 이하
- 그 외: 제한 없음

## 4. 보상 규칙

### 기본 전투 승리 보상

- 기본값은 티켓 +1
- `suffering`, `chaos`는 기본 승리 티켓 0

### 추가 보상

- 대현자의 축복 정답: 티켓 +1
- 일반 퀴즈 정답: 티켓 +1
- `creator_god` 퀴즈 정답: 티켓 +3
- looter 카드로 마무리: 추가 보상 루트
- `overdrive` 추가 보상 훅 존재

## 5. 카오스 / 드래프트 / 초월

### 카오스 풀

- 런 시작 시 카드풀에서 15장을 뽑아 `chaosPool` 구성
- 승리할 때마다 다시 15장 풀을 생성
- 이번 런에서 획득한 이벤트 카드도 풀에 포함될 수 있다

### 카오스 룰렛

- `chaosTickets` 1장 소모
- `pendingTranscendenceCards`에 없는 초월 카드 중에서 랜덤 지급
- 보너스 초월 카드가 해금되어 있으면 초월 풀에 함께 들어간다

### 보너스 초월 해금

- 숨은 보스가 `bonusTranscendenceReward`를 갖고 있으면 10% 확률로 영구 해금
- 해금 저장 위치: `global.unlocked_bonus_transcendence_cards`
- 현재 보너스 초월 5장:
  - `trans_gray`
  - `trans_thor`
  - `trans_ares`
  - `trans_poseidon`
  - `trans_flora`

## 6. 보너스 카드 풀 프리셋

### 저장 구조

- `global.bonusPoolPresets`: 최대 3개
- `global.activeBonusPoolPresetIndex`: 현재 적용 프리셋
- `pendingActiveBonusPoolIds`: 편집 중인 이번 설정

### 동작 규칙

- 각 프리셋은 “이번 런에서 활성화할 보너스 카드 ID” 목록이다
- 비어 있거나 유효하지 않으면 해금된 보너스 카드 전체로 정규화된다
- 새 런 시작 시 이 설정이 `state.activeBonusPoolIds`로 복사된다
- UI에서는 “덱 편집” 버튼으로 관리하지만, 실제로는 기본 카드가 아니라 보너스 카드 출현 풀만 제어한다

## 7. 월간/주간 미션

### 월간 미션

- `endless40`: 무한 모드 40 스테이지 돌파 1회
- `challenge3`: 챌린지 모드 클리어 3회
- `toeic3`: 실전마법연습 3회
- 보상: 숨겨진 보너스 카드 1장 우선 해금

### 주간 미션

- `challenge1`: 챌린지 모드 1회 클리어
- `toeic1`: 실전마법연습 1회
- `attendance3`: 3일 출석
- 보상: 카오스 티켓 3장

## 8. 실전마법연습과 숨은 해금

- TOEIC 실전 연습은 월간/주간 미션을 동시에 전진시킨다
- `tutoringEventEnabled === false`일 때만 숨은 학습 카운트가 올라간다
- 5회 누적 시 `hiddenStudyReady = true`
- 이 상태에서 `dream_corridor` 진입이 가능하다

## 9. 아티팩트 모드와 창조신 보상

- `artifact` 모드는 클리어 스테이지가 36
- `creator_god`를 잡고 문법 퀴즈에 성공하면 티켓이 아니라 아티팩트 선택 화면으로 넘어간다
- 이미 가진 아티팩트는 제외한 후보 3개가 제시된다
