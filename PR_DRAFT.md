# Title
feat(card): 카드 및 카드 클로드의 Pro 모델 옵션을 Gemini 4 Argon으로 업그레이드

## Summary
`card` 및 `card_claude`의 고성능 모델 옵션을 기존 `gemini-2.5-pro`에서 `defense_test`와 동일한 `gemini-4-argon`(Argon)으로 업그레이드했습니다.

### 1. 주요 변경 내용
- **Gemini 4 Argon 모델 도입 (`card/game/api.js`)**:
  - `GEMINI_ARGON_MODEL_ID = 'gemini-4-argon'` 정의 및 `LUMI_MODEL_OPTIONS` 1순위 모델로 등록.
  - UI 버튼 라벨을 `Argon`으로 설정 (`#lumi-chat-model-btn`, `#tutoring-model-btn`).
  - `useThinkingBudget: true` 활성화 (심층 추론 예산 `thinkingBudget: 25000` 적용).
  - `allowSearch: true` (구글 검색 그라운딩) 및 `allowSampling: true` (temperature: 0.7, topP: 0.95) 유지.
  - 유해성 필터 차단 없음(`BLOCK_NONE` 5종 카테고리) 설정 유지.
- **빌드 아티팩트 동기화**:
  - `card/dist/DREAMWEAVER.html` 빌드 반영 (`node card/build.mjs`).
  - `card_claude/dist/DREAMWEAVER-Claude.html` 빌드 반영 (`node card_claude/build.mjs`).
- **테스트 및 검증 스크립트 정합성 갱신**:
  - `scripts/verify_gemini_api_models.js`: 허용 모델 목록에 `gemini-4-argon` 등록 및 `gemini-2.5-pro` 레거시 목록 이관.
  - `scripts/verify_card_refactor.js`: 순차 로드 검증 목록에 `skill_display.js` 누락 보완.
- **매뉴얼 업데이트**:
  - `card/GAME_MANUAL.md`의 모델 안내 문구를 `gemini-4-argon` (Argon)으로 갱신.

### 2. 검증 결과
- `npm run lint:card` 통과
- `npm run test:card:smoke` 통과 (7개 테스트 스위트 전원 통과)
- `node card_claude/tests/smoke.mjs` 통과 (Claude 리마스터 버전 스모크 테스트 통과)
- `npm run verify` 통과
