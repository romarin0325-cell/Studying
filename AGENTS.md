# AGENTS.md

## Priority
Functional correctness of the browser app is more important than refactoring or style polish.

## Verification policy
검증은 이번 작업에서 바뀐 동작과 직접 관계있는 범위만 수행한다.
- 일반 문서는 제품 검증이 필요 없다.
- 배포 입력을 수정하면 해당 게임을 한 번 빌드한다.
- 동작 확인이 필요하면 가장 가까운 기존 테스트나 짧은 재현을 사용한다.
- 변경하지 않은 게임, 전체 회귀, 여러 브라우저, 장시간 시뮬레이션, 보고서 재생성은 기본 실행하지 않는다.
- 같은 입력에 대한 검증을 반복하지 않는다.
- 실행한 검사와 확인하지 못한 핵심 사항만 간단히 알린다.

## Targets
- `card/`: Card game (`card/dist/DREAMWEAVER.html`)
- `card_claude/`: Claude UI comparison build of the card game; reads `card/game` and `card/assets` (`card_claude/dist/DREAMWEAVER-Claude.html`)
- `shooter/`: Astral Bloom shooter (`shooter/dist/AstralBloom.html`)
- `idle/`: Astral Companions idle game (`idle/dist/AstralCompanions.html`)
- `defense_test/`: Star Garden defense prototype (`defense_test/dist/StarGardenDefense.html`)
- `survivor/`: Astra Nocturne survivor game (`survivor/dist/AstraNocturne.html`)
- `defense/`: Hero Core Defense (`defense/dist-local/HeroCoreDefense.html`)

`card_legacy/` and `defense_legacy/` are preserved snapshots; do not use them as active sources.

## Core guidelines
- Prefer the smallest diff that restores working behavior (bug fixes). Design, UI and effect work in `defense_test/` follows the section below instead.
- If UI behavior cannot be fully verified, state exactly what remains unverified.
- For frontend tasks, use image inputs/output when helpful and compare against the requested behavior.

## Star Garden (`defense_test/`) 작업 지침
사용자가 여러 번 반복해서 지적한 내용을 정리한 규칙이다. 지시를 받으면 먼저 여기에 비추어 본다.

### 목적 우선
- 문자 그대로의 지시나 최소 수정이 아니라 지시의 목적을 최대로 달성하는 방법을 찾는다. 기존 구조·에셋 재활용이 목적에 맞지 않으면 새로 만든다(에셋 생성 도구와 다른 AI도 쓸 수 있다).
- 기준은 블루아카이브·스텔라소라 같은 상용 수집형 게임과 상용 방치형 게임이다. 결과물이 그 수준으로 보이는지 스스로 묻고, 아니면 끝난 것이 아니다.
- 한 곳의 문제를 고치다 다른 곳을 겹치거나 가리게 만들지 않는다. 고친 뒤 화면 전체를 다시 본다.

### UI
- 모바일 세로(390×844 전체화면)가 기준이다. 바꾼 화면은 그 크기로 캡처해 확인한다. 메인 메뉴는 위쪽, 전투 화면은 아래쪽에 여백을 둔다.
- 기본 화면은 한눈에 들어오는 정보만 보여 준다. 자세한 내용은 펼치거나 눌러서 본다.
- 스스로 알 수 있는 정보에 상자나 설명을 붙이지 않는다. 주요 버튼과 기능을 스크롤 아래로 밀지 않는다.
- 불필요한 화면 흔들림, 재생성, 레이아웃 이동을 만들지 않는다. 글자 수나 숫자 자릿수가 바뀌어도 줄과 칸이 움직이지 않아야 한다. 길어진 글은 잘라 내지 말고 접히게 한다.
- 수집·호감도·학습 보상처럼 오래 걸려 얻는 보상은 그 무게에 맞는 연출과 감상 방법을 준다.

### 문구
- 설명은 현재 수치만 보여 주고, 강화로 바뀌는 숫자는 색으로 구분한다. "강화로 오릅니다", "상한이 없습니다" 같은 일반 규칙 문장은 쓰지 않고 예외만 적는다.
- 조건부 효과는 "강화" 상태 표시와 지금 적용되는 숫자로 보여 준다. 설명을 읽은 플레이어의 추론과 실제 동작이 모드마다 같아야 한다.
- 한 단어로 충분한 라벨은 한 단어로 쓴다. 캐릭터 대사는 각자의 말투를 지킨다(공용 대사를 돌려쓰지 않는다).

### 밸런스
- 상식적인 대표 상황과 유효 조합으로 정적 분석을 먼저 하고, 그 상황을 시뮬레이터에 넣어 비교한다. 모든 상황을 재는 시뮬레이터는 없다.
- 영웅 예산은 C 1 / R 1.1 / SR 1.25 / UR 1.5, 유물 예산은 C 1.0 / R 1.2 / SR 1.45 / UR 1.8(조건 가중치 적용)이다. 필살기는 배율이 아니라 실제 피해와 효과(별빛 100당 가치)로 비교한다.
- 범용 유물은 수수하지만 안전하게, 특화 유물은 빌드를 바꾸고 재미있게 한다. 시너지로 생기는 새 조합은 환영하지만, 별빛·골드·소환이 스스로를 불리는 순환은 만들지 않는다(필살기 → 별빛, 합성 → 별빛, 소환 → 합성 경로를 항상 계산한다).
- 조건부 필살기는 조건이 맞으면 무조건부보다 확실히 좋아야 하고, 어떤 필살기도 다른 필살기의 완전한 하위호환이 되지 않게 한다. 예외의 예외는 만들지 않는다.
- 캐릭터 밸런스 변경은 사용자가 의도와 수치를 검증한 뒤 지시한다. 지시가 없으면 제안서로만 낸다.

### 도구
- 코딩·시뮬레이터 같은 반복 작업은 Grok을 적극적으로 쓴다. 판단과 최종 품질은 Claude가 책임진다.
- Gemini API는 에셋 생성(나노바나나)에만 쓴다. Gemini 4 Argon은 사용자가 그 턴에 허락했을 때만 의견 수렴에 쓴다. API 키는 커밋하지 않는다.
- 완료하면 PR을 준비 상태로 열고, 필요하면 모든 동료·유물이 열린 로컬 테스트 빌드(`node scripts/build.mjs --unlocked`)를 함께 만든다.
