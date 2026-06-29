# Title
feat(card): 포춘쿠키 LC 파트 3/4 (다중 문제) 구현 및 안정성 개선

## Summary

포춘쿠키 기능에 TOEIC Part 3(대화) 및 Part 4(담화) 등 다중 문제(Multi-Question)를 지원하도록 기능을 확장하고, 오디오 재생 및 모달 전환 관련 로직의 안정성을 대폭 개선했습니다.
또한, 포춘쿠키 API의 응답 처리 과정 및 UI 관련 중요한 버그를 수정했습니다.

### 1. 리스닝 데이터 확장 (`listening_data.js`)
- **Part 3 & 4 데이터 추가**: 총 8세트의 복수 문항 지문 추가 (DAY 10, DAY 16).
- **상세 데이터 구조**: 실제 시험 환경과 동일하게 구현하기 위해 각 질문(`questionText`, `questionTextKo`)과 보기(`options`, `optionsKo`), 그리고 전체 스크립트(`passage`, `passageKo`)를 모두 포함하도록 스키마를 고도화했습니다.

### 2. UI 모달 구조 개편 (`index.html`)
기존 2단계(문제 풀이 → 운세 결과)로 구성되었던 모달에 **다중 문제 전용 3단계 Phase**를 추가로 구현했습니다.
- `fortune-multi-hub-phase`: 오디오 재생 및 개별 문제 진입을 담당하는 허브 화면.
- `fortune-multi-q-phase`: 실제 영어 질문과 4지선다 보기가 렌더링되는 단일 문제 풀이 화면.
- `fortune-explanation-phase`: 전체 문제 풀이 완료 후 지문, 해석, 정오답을 스크롤로 읽어보는 해설 화면.
- **초상화 위치 수정**: 불필요한 해설 화면(explanation phase)에서 루미 초상화를 제거하고, 대사를 출력하는 최종 운세 결과 화면(result phase)으로 초상화를 이동했습니다.

### 3. 복수 문제 진행 및 피드백 로직 (`fortune_cookie.js`)
- `currentMultiSession` 상태 객체를 도입하여 하나의 지문에 딸린 여러 문제의 진행 상황(`qIndex`)과 풀이 이력(`results`)을 안전하게 관리.
- 문제 풀이 시 즉각적인 피드백(정/오답)을 표시한 뒤, 다음 문제가 있으면 허브로 돌아가 오디오를 재청취할 수 있게 하고, 모든 문제를 풀면 해설 창으로 이동시킵니다.
- **통합 스크롤 해설**: 한 화면에서 영문 스크립트, 한글 해석, 각 문항별 내 선택 및 정답 여부를 한눈에 확인할 수 있는 전체 스크롤 뷰 구현.
- **오디오 UX 개선**: 오디오 버튼 클릭 시 무조건 재시작하던 것을 **재생/일시정지 토글** 형태로 변경하여 청취 편의성을 높였습니다.

### 4. 안정성 (Robustness) 및 버그 픽스
- **[핵심 Bug Fix] API Key 연동 수정** (`fortune_cookie.js`): 포춘쿠키가 존재하지 않는 `localStorage` 키(`gemini_api_key`)에서 API 키를 읽다가 `null`을 반환받아 API 호출 자체를 건너뛰던 버그를 수정했습니다. 다른 모든 기능과 동일하게 `Storage.keys.API_KEY`(`cardRpgApiKey`)를 참조하도록 통일했습니다.
- **Pro 모델 응답 파싱 보완** (`api.js` `generateContent`): `gemini-2.5-pro`(thinkingBudget 방식)를 사용할 때 응답의 `parts`에 `thought: true` 파트가 포함될 수 있어, 기존의 `.filter(part => typeof part.text === 'string')` 조건에 `!part.thought` 조건을 추가하여 사고 과정이 본문에 섞이지 않도록 처리했습니다. (thinkingLevel 방식을 사용하는 다른 Flash 계열 호출부는 해당 없음.)
- **Phase 중복 렌더링 방지**: 재방문 시 `showFortunePhase()`가 직접 호출될 때 이전 Phase들이 숨김 처리되지 않아 UI가 겹칠 수 있는 취약점을 명시적 `display: none` 선언으로 방어했습니다.
- **타이머 오동작 방지**: 답안을 선택하고 1.5초 대기 중 모달을 강제로 닫을 경우, 백그라운드 `setTimeout` 콜백이 모달을 다시 여는 버그를 `clearTimeout`으로 수정했습니다.
- 기존 파트 2 분기 코드 내의 데드코드를 제거하여 유지보수성을 높였습니다.

## Testing
- `npm run verify` 통과 (Card smoke verification + lint checks)
- 다중 문제 진행, 오디오 재생/일시정지, 타이머 강제 종료 로직 수동 검증 완료.
- API 키 로드 및 운세 응답 생성 수동 검증 완료.

## Notes
- 당일 이미 포춘쿠키를 사용한 상태에서 다시 진입할 경우, 해설이나 문제를 다시 보여주지 않고 즉시 운세 결과로 직행하는 기존의 기획 의도는 그대로 보존되었습니다.
