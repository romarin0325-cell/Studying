# 별의 성소 · Card RPG (Celestial Azure Remaster)

> **전략 카드 배틀 RPG & 영어 마스터리 단일 HTML 배포판 리마스터**  
> 모듈식 Git 코드베이스 관리 + 단일 독립 HTML(`dist/CardRPG.html`) 배포 빌드 파이프라인

---

## 🌌 프로젝트 개요 (Overview)

기존 `card/` 프로젝트의 복잡하고 방대한 단일 HTML 구조 및 고전적 UI/UX를 전면 리마스터하여, **shooter** 및 **defense_hero_v2**처럼 Git에서는 깔끔한 모듈식 코드로 관리하고, 최종 배포는 단 하나의 독립 HTML 파일(`CardRPG.html`)로 빌드할 수 있는 최신 아키텍처를 구현했습니다.

### ✨ 핵심 리마스터 포인트

1. **셀레스티얼 애저(Celestial Azure / 하늘색) 디자인 시스템**
   - 기존의 단조로운 그레이 톤과 수직 버튼 나열(Doom-stack)을 전면 탈피.
   - 우주와 별의 성소를 연상시키는 깊은 코스믹 네이비(`rgba(8, 12, 24, 0.95)`) 바탕에 네온 시안/하늘색(`--primary-azure: #38bdf8`, `#7dd3fc`)을 메인 킥으로 적용.
   - 글래스모피즘(Glassmorphism) 반투명 패널, 별빛 오로라 테두리, 카드 등급별(Legend, Epic, Rare, Normal) 네온 발광 효과.

2. **모바일 상용 RPG급 UI/UX 재설계**
   - **타이틀 화면**: 회전 펄스하는 셀레스티얼 성장(Crest) 심볼, 시각적 계층이 뚜렷한 [새로운 여정(NEW RUN)] / [기록 이어하기(CONTINUE)] 히어로 버튼, 포춘쿠키/루미 질문/미션/BGM 서고 4구역 유틸리티 그리드.
   - **메인 로비 (Lobby)**:
     - 상단: 골드 티켓 카운터 바 + 퀵 시스템 설정.
     - 중앙: 다음 스테이지 적 보스 예고 인카운터 카드.
     - 핵심 CTA: 펄스 발광 애니메이션이 적용된 대형 **⚔️ 전 투 출 격 (SORTIE)** 버튼.
     - 하단 그리드: 덱 편성 / 카드 도감 / 도서관 / 축복의 제단 2x2 카드.
   - **하단 글로벌 네비게이션 독 (Dock)**:
     - 5대 핵심 탭: `로비` 🏰, `덱 편성` ⚔️, `카드 도감` 🃏, `서고·학습` 📖, `성소·소환` 🔮.
     - 타이틀 및 전투 중에는 자동으로 숨겨지며, 모험 중 언제든 원터치로 탭 전환 지원.

3. **로컬 상대경로 카드 초상화 & 우아한 폴백(Fallback)**
   - 대용량 카드 초상화 이미지들을 HTML 내부에 인라인(base64)하지 않고, 로컬 상대경로 (`./`, `../card/`, `../../card/`, `./assets/` 등) 후보군을 단계적으로 탐색.
   - 로컬 이미지가 없거나 누락된 환경에서도 깨진 이미지 아이콘 대신 셀레스티얼 시안 보석(`✧`)과 등급별 테두리가 렌더링되도록 방어적 폴백 구현.

4. **순수 Web Audio 절차적 사운드 효과음 (`sfx.js`)**
   - 외부 사운드 에셋 파일 의존성 없이 브라우저 Web Audio API 합성 엔진으로 버튼 클릭음, 카드 검격 슬래시, 스킬 웅웅거림, 팡파르 등을 100% 무손실 오프라인으로 자동 합성.

---

## 📁 디렉토리 구조 (Directory Structure)

```text
remaster_gemini/
├── dist/
│   └── CardRPG.html          # 단일 독립 실행형 최종 배포 HTML (1.81 MB)
├── src/
│   ├── template.html         # 마크업 템플릿 및 모달 스켈레톤
│   ├── core/                 # 순수 게임 로직 & 데이터 모듈 (15개 모듈)
│   │   ├── data.js           # 기본 카드 & 몬스터 데이터
│   │   ├── vocab_data.js     # 단어 데이터
│   │   ├── grammar_data.js   # 문법 퀴즈 데이터
│   │   ├── collocation_data.js
│   │   ├── toeic.js          # TOEIC 훈련 데이터
│   │   ├── toeic_explanations.js
│   │   ├── listening_data.js
│   │   ├── api.js            # AI 루미/과외 API 통신
│   │   ├── logic.js          # 게임 유틸 & 상태 머신
│   │   ├── battle_runtime.js # 턴제 전투 엔진 및 데미지 계산
│   │   ├── rpg_features.js   # 세이브/로드, 미션, 드래프트, 아티팩트
│   │   ├── fortune_cookie.js # 포춘쿠키 리스닝 미니게임
│   │   ├── music_data.js     # Chiptune BGM 음원 데이터
│   │   ├── music_player.js   # Web Audio 칩튠 신디사이저 플레이어
│   │   └── rpg_controller.js # UI 이벤트 핸들러 및 메인 컨트롤러
│   └── ui/                   # 디자인 시스템 및 UI 엔진
│       ├── theme.css         # Celestial Azure 디자인 시스템 (1800+ lines)
│       ├── sfx.js            # Web Audio 절차적 사운드 합성기
│       └── app_view.js       # 플로팅 데미지, 하단 독, 초상화 폴백 매니저
├── build.mjs                 # 단일 HTML 번들러 빌드 스크립트
├── test_bundle.mjs           # Playwright 헤드리스 브라우저 통합 검증 스크립트
├── screenshot_title.png      # 타이틀 화면 실제 렌더링 스크린샷
├── screenshot_lobby.png      # 메인 로비 화면 실제 렌더링 스크린샷
├── screenshot_deck.png       # 덱 편성 화면 실제 렌더링 스크린샷
├── screenshot_battle.png     # 전투 화면 실제 렌더링 스크린샷
└── README.md
```

---

## 🛠️ 빌드 방법 (Build Instructions)

Node.js 환경에서 아래 명령어를 실행하면 `dist/CardRPG.html`이 즉시 생성됩니다.

```bash
cd remaster_gemini
node build.mjs
```

출력 결과:
```text
✨ Building Celestial Azure Card RPG Single HTML Distribution...
✅ Build Complete! Standalone Distribution: .../dist/CardRPG.html (1.81 MB)
```

---

## 🧪 자동화 검증 (Automated Verification)

Playwright 헤드리스 브라우저를 통해 `dist/CardRPG.html`의 전체 라이프사이클을 테스트합니다.

- 타이틀 로딩 및 시작 버튼 활성화 검증
- 새 게임 시작 및 `screen-menu` 로비 네비게이션 검증
- 하단 독 탭 전환 (`로비` ↔ `덱 편성` ↔ `카드 도감`)
- 전투 진입, 플레이어/적 상태 렌더링, 스킬 버튼 활성화
- 1턴 일반 공격 실행 및 데미지/로그 기록 및 적 턴 반격 처리 검증
- 화면별 스크린샷 캡처 및 검증

```bash
cd remaster_gemini
node test_bundle.mjs
```

테스트 실행 결과:
```text
🧪 Testing CardRPG.html in headless browser...
✅ Title screen loaded and ready.
✅ Navigated to Main Hub / screen-menu.
✅ Switched to Deck screen: true
✅ Switched to Collection screen: true
✅ Switched back to Lobby: true
✅ Battle state verified: { battleActive: true, playerName: '심해의주인', enemyName: '인조 마신', skillButtonsCount: 4 }
⚔️ Executing normal attack in battle...
✅ Battle turn action executed successfully
🎉 ALL TEST FLOWS PASSED PERFECTLY!
```
