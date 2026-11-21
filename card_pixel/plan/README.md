# 계획 (plan/)

앞으로 할 일과 그 이유를 둔다. 한 일과 결과는 `../history/`에 둔다.

| 파일 | 내용 | 상태 |
|---|---|---|
| `plan-content.md` | 리뉴얼 기획서 원문: 조사, 진단, 타당성, 설계, 아트, 순서 | 2026-11-15 작성, 2026-11-16 결정 반영 |
| `renewal-plan.html` | 위 기획서의 시각 페이지 (`build-plan.mjs`로 다시 만든다) | 2026-11-16 |
| `experimental-rules.md` | 실험 규칙 E~H: 유품, 최후의 일인, 꿈의 변덕, 적 접두사. 시뮬레이션 수치와 조절 손잡이 | 2026-11-18, 플레이 후 유지 여부 결정 |
| `roadmap.md` | 다음 단계와 남은 결정 | 2026-11-18 |
| `structure.html` | 전체 구조도: 부분, 흐름, 바꾸면 어디까지 가는지, 검증, 역할 (`build-structure.mjs` + `structure.json`) | 2026-11-18 |
| `source-inventory.md` | 카드 게임 데이터 조사 (GPT 작성, 미확인 항목 많음) | 2026-11-15 참고 자료 |
| `pixel-pilot/` | 도트 변환 방식 비교(R1~R4)와 R4b 일관성 실험의 근거 | 2026-11-15~16 근거 자료 |
| `assets/` | 기획서 페이지의 전투 목업에 쓴 첫 스프라이트 | 2026-11-15 |
| `v1-decisions.md` | Claude가 정한 것과 이유·되돌리는 곳(결정 장부). 13절이 2026-11-21 밤 "입장권" 개편, 14절이 2026-11-22 플레이 피드백 | 계속 갱신 |
| `ui-direction.md` | UI 방향: 새벽 꿈(실제로 본 레퍼런스와 공통 규칙), 6절 도트풍 리디자인 | 2026-11-21 |
| `ui-review.html` | 새벽 꿈 UI 전후 비교(`build-ui-review.mjs`, 사진은 `ui-review/`) | 2026-11-21 |
| `entry-report.html` | 2026-11-21 밤 작업 보고서: 요청별 처리, 화면 전후 28장, 판단, 확인한 것·못 한 것(`build-report.mjs` + `entry-report-content.mjs`, 사진은 `entry-review/`) | 2026-11-22 |
| `changes-review.html` | 원본 카드 게임과 달라진 규칙·콘텐츠 전체 검수(데이터에서 자동 생성: `build-changes-review.mjs`, 규칙 문장은 `../game/src/content/rulebook.js`) | 엔진을 바꾸면 다시 생성 |
| `report-2026-11-22.html` | 2026-11-22 플레이 피드백 보고서: 질문에 대한 답(축복 문구·스크롤 관례·GPT 결과), 전투 화면·튜토리얼 전후(`build-report.mjs --content report-2026-11-22-content.mjs`, 사진은 `report-2026-11-22/`) | 2026-11-22 |
| `skill-motion.html` | 스킬 연출 전수조사: 불일치 170건 목록(동료 그림과 함께), 공용 이펙트 14종, 단계와 판정(`build-skill-motion.mjs`, 자료는 `../history/consults/2026-11-22-astra-skill-motion.json`) | 2026-11-22 |
| `workspace.html` | 작업 공간 지도: 시간순 이정표, 작업 공간(worktree), 폐기된 컨셉과 지금 방향, 남은 과제, 정리 후보(`build-workspace.mjs` + `workspace-map.json`) | 2026-11-22 |
| `page-kit.mjs` | 위 페이지들이 함께 쓰는 도트 페이지 틀(색·외곽선·제목 띠·표·필터, 작은 도트 아이콘) | 2026-11-22 |
