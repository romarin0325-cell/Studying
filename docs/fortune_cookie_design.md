# 🥠 포춘쿠키 (리스닝 + 오늘의 운세) 기능 설계서

> **오늘(2026-06-22)의 작업 범위**: 이 설계 문서를 완성하고 GitHub에 커밋하는 것까지입니다.
> 코드 구현은 이 설계서를 바탕으로 **별도 세션에서** 진행합니다.

---

## 1. 기능 개요

타이틀 화면에 **"🥠 포춘쿠키"** 메뉴를 추가합니다. 클릭 시:

1. TOEIC 리스닝 MP3 재생 (Part 2/3/4)
2. 리스닝 문제 풀기 (4지선다)
3. 정답/오답 판정 후 **오늘의 운세** 표시
4. (확장) 해설 확인 / AI 질문

---

## 2. 확정 사항

| 항목 | 결정 |
|---|---|
| **1일 1회 제한** | ✅ AM/PM 로직 적용 (아래 상세) |
| **RPG 보상 연동** | ❌ 현재 미연동 |
| **운세 톤** | 일반 운세 (학습 한정 X) — 긍정적 톤 |
| **운세 등급** | 10단계 |
| **리스닝 Part** | Part 2, 3, 4만 (Part 1 제외 — 사진 매핑 필요) |
| **MP3 파일 형태** | 문제별 개별 파일 |
| **기초 강의 필요성** | ❌ 별도 강의 없음 — Phase 1 화면에 Part별 한 줄 팁만 표시 |
| **AI 해설 기능** | ✅ 루미 질문하기 연동 (기존 `LumiQuestionRuntime` 패턴 재활용) |

---

## 3. 1일 1회 제한 — AM/PM 로직

### 핵심 규칙

```
오전 (00:00~11:59) 실행 → 오늘의 운세 표시
오후 (12:00~23:59) 실행 → 내일의 운세 표시

오후에 실행한 경우 → 다음날 오전에는 실행 차단
(이미 내일 운세를 봤으므로)
```

### 상세 시나리오

| 시나리오 | 실행 시각 | 운세 대상 | 차단 기간 |
|---|---|---|---|
| A. 오전에 실행 | 6/22 09:00 | **6/22(오늘)** 운세 | 6/22 하루 종일 재실행 불가 |
| B. 오후에 실행 | 6/22 14:00 | **6/23(내일)** 운세 | 6/22 오후 + **6/23 오전** 재실행 불가 |
| C. B 이후 오후에 재실행 | 6/23 15:00 | **6/24(내일)** 운세 | 정상 실행 가능 |

### 데이터 저장 구조

```javascript
// localStorage에 저장
{
  fortuneCookieLastUsed: {
    date: "2026-06-22",        // 실행한 날짜
    period: "pm",              // "am" 또는 "pm"
    fortuneTargetDate: "2026-06-23"  // 운세 대상 날짜
  }
}
```

### 차단 판정 로직

```javascript
function canUseFortuneCookie() {
  const now = new Date();
  const today = toDateString(now);      // "2026-06-22"
  const isAM = now.getHours() < 12;
  const last = loadLastUsed();

  if (!last) return true;  // 처음 사용

  // Case 1: 같은 날 이미 사용함
  if (last.date === today) return false;

  // Case 2: 어제 오후에 사용 → 오늘 오전은 차단
  const yesterday = getYesterday(today);
  if (last.date === yesterday && last.period === "pm" && isAM) {
    return false;  // 어제 오후에 이미 내일(=오늘) 운세를 봄
  }

  return true;
}
```

### UI 차단 메시지

```
# 오전 차단 (어제 오후에 이미 실행)
"어제 오후에 이미 오늘의 운세를 확인했습니다.
오후에 다시 확인할 수 있습니다. 🥠"

# 같은 날 재실행 차단
"오늘의 포춘쿠키는 이미 열었습니다.
내일 다시 도전해주세요! 🥠"
```

---

## 4. 운세 시스템 상세 설계

### 4-1. 10단계 등급 (대체로 긍정적)

| 등급 | 이름 | 톤 |
|---|---|---|
| ★★★★★ | 대길 (大吉) | 최고로 좋은 운세 |
| ★★★★☆ | 길 (吉) | 매우 좋은 운세 |
| ★★★★ | 중길 (中吉) | 꽤 좋은 운세 |
| ★★★☆ | 소길 (小吉) | 작은 행운 |
| ★★★ | 반길 (半吉) | 좋은 기운이 반 |
| ★★☆ | 말길 (末吉) | 끝에 가서 좋아지는 운세 |
| ★★ | 평 (平) | 무난한 하루 |
| ★☆ | 소흉반전 (小凶反轉) | 작은 시련, 반드시 뒤집힌다 |
| ★ | 흉전길 (凶轉吉) | 시련 뒤에 큰 행운이 온다 |
| ☆ | 대기만성 (大器晩成) | 지금의 인내가 큰 보답이 된다 |

> 하위 등급도 **절대 부정적으로 끝나지 않습니다.**
> 「소흉반전」 = 작은 불운이 반드시 뒤집힘, 「흉전길」 = 고생 끝에 큰 행운,
> 「대기만성」 = 늦게 피는 꽃이 가장 아름답다는 의미로 구성합니다.

### 4-2. 등급 확률 분포

```javascript
const FORTUNE_GRADE_WEIGHTS = [
  { grade: "대길",     weight: 5  },   // 5%  — 희귀
  { grade: "길",       weight: 10 },   // 10%
  { grade: "중길",     weight: 15 },   // 15%
  { grade: "소길",     weight: 15 },   // 15%
  { grade: "반길",     weight: 15 },   // 15%
  { grade: "말길",     weight: 13 },   // 13%
  { grade: "평",       weight: 12 },   // 12%
  { grade: "소흉반전", weight: 8  },   // 8%
  { grade: "흉전길",   weight: 5  },   // 5%
  { grade: "대기만성", weight: 2  },   // 2%  — 가장 희귀
];
```

### 4-3. 운세 조합 다양성 시스템 — 3계층 구조

매일 해도 질리지 않도록, 운세를 **등급 + 배경설정 + 키워드** 3계층으로 조합합니다.

#### 계층 1: 등급별 메시지 풀

등급마다 5~8개의 메시지 변형을 준비합니다.

```javascript
const FORTUNE_MESSAGES = {
  "대길": [
    "하늘이 내린 행운의 날! 모든 일이 술술 풀릴 것입니다.",
    "별들이 당신을 축복합니다. 오늘 시작하는 일은 반드시 성공합니다.",
    "오늘의 당신에게는 무엇이든 가능합니다. 자신을 믿으세요!",
    // ... 5~8개
  ],
  "대기만성": [
    "늦게 피는 꽃이 가장 아름답습니다. 오늘의 인내가 내일의 풍요입니다.",
    "큰 그릇은 오래 빚어집니다. 지금 이 순간이 당신을 완성시키고 있습니다.",
    // ... 5~8개
  ],
  // ...각 등급별
};
```

#### 계층 2: 배경설정 (메타데이터 기반)

현재 날짜, 사용자 생일, 루미 생일, 계절, 학습 진행상황 등을 활용한 **배경 메시지**를 운세에 덧붙입니다.

```javascript
const FORTUNE_CONTEXT = {
  // 계절별
  getSeasonContext(month) {
    if ([3,4,5].includes(month)) return { season: "봄", msg: "새싹이 돋는 계절, 새로운 시작에 좋은 기운이 가득합니다." };
    if ([6,7,8].includes(month)) return { season: "여름", msg: "뜨거운 열정의 계절, 당신의 에너지가 빛을 발합니다." };
    if ([9,10,11].includes(month)) return { season: "가을", msg: "결실의 계절, 그동안의 노력이 열매를 맺기 시작합니다." };
    return { season: "겨울", msg: "고요한 성찰의 계절, 내면의 힘이 단단해지고 있습니다." };
  },

  // 사용자 생일 근처 (±7일)
  getBirthdayContext(userBirthday, today) {
    // "생일이 가까워오는 당신에게 특별한 행운이 깃듭니다."
    // "생일 축하합니다! 오늘은 특별한 기운이 함께합니다."
  },

  // 루미 생일 근처
  getLumiBirthdayContext(today) {
    // 루미 생일 날짜를 기준으로 특별 메시지
    // "오늘은 루미의 생일! 루미가 전하는 특별한 운세입니다."
  },

  // 요일별
  getDayOfWeekContext(dayOfWeek) {
    // 월요일: "한 주의 시작, 첫 발걸음이 가장 중요합니다."
    // 금요일: "한 주의 마무리가 다가옵니다. 보람찬 마무리를 기대하세요."
  },

  // 학습 진행상황
  getStudyContext(global) {
    // completedToeicSets 수, 해금된 모드 수, 해금된 카드 수 등을 참조
    // "꾸준한 학습이 운도 바꿉니다. 지금까지 N개의 강을 건넜습니다."
  },

  // 날짜 특수일
  getSpecialDateContext(today) {
    // 1/1: "새해 첫 운세! 올해는 특별한 해가 될 것입니다."
    // 12/25, 밸런타인, 화이트데이 등
  }
};
```

#### 계층 3: 오늘의 키워드

매일 변하는 키워드를 부여하여, 같은 등급이라도 다른 느낌을 줍니다.

```javascript
const FORTUNE_KEYWORDS = {
  flower: [
    { name: "벚꽃", meaning: "아름다운 시작" },
    { name: "해바라기", meaning: "밝은 에너지" },
    { name: "라벤더", meaning: "평온한 마음" },
    { name: "장미", meaning: "열정과 사랑" },
    { name: "은방울꽃", meaning: "다시 찾아온 행복" },
    { name: "수국", meaning: "변화하는 아름다움" },
    // ... 20~30개
  ],
  mood: [
    "설레는 기분", "포근한 오후", "달콤한 기대", "반짝이는 영감",
    "고요한 자신감", "따뜻한 위안", "잔잔한 기쁨", "용기 있는 한 걸음",
    // ... 20~30개
  ],
  dessert: [
    "마카롱", "티라미수", "크레이프", "푸딩", "슈크림",
    "몽블랑", "밀크티", "초콜릿 무스", "바닐라 아이스크림",
    // ... 15~20개
  ],
  color: [
    { name: "코랄 핑크", meaning: "다정한 관계" },
    { name: "스카이 블루", meaning: "맑은 판단력" },
    { name: "라벤더 퍼플", meaning: "감성의 깊이" },
    { name: "민트 그린", meaning: "상쾌한 전환" },
    // ... 15~20개
  ]
};
```

#### 최종 운세 출력 예시

```
┌──────────────────────────────────────┐
│        🥠 오늘의 포춘쿠키              │
│                                       │
│     ── 6월 23일 (월요일) 운세 ──       │
│                                       │
│          ★★★★☆                       │
│          【 길 (吉) 】                 │
│                                       │
│  "별들이 당신을 축복합니다.             │
│   오늘 시작하는 일은 반드시             │
│   성공합니다."                         │
│                                       │
│  ────────────────────                  │
│  🌸 오늘의 꽃: 벚꽃 — 아름다운 시작     │
│  💫 오늘의 기분: 설레는 기분             │
│  🍰 오늘의 디저트: 마카롱               │
│  🎨 오늘의 색: 코랄 핑크 — 다정한 관계   │
│  ────────────────────                  │
│                                       │
│  "여름의 뜨거운 열정이 당신의           │
│   에너지에 불을 지피고 있습니다."       │
│                                       │
│          [닫기]                         │
└──────────────────────────────────────┘
```

#### 키워드 결정론적 시드 (날짜 기반)

같은 날 다시 열어도 같은 키워드가 나오도록 **날짜 기반 시드**를 사용합니다.

```javascript
function getDailyFortune(targetDate) {
  // 날짜 문자열을 시드로 변환
  const seed = hashDateString(targetDate); // 예: "2026-06-23" → 정수
  const rng = seededRandom(seed);

  const grade = pickWeightedGrade(rng);
  const message = pickFromPool(FORTUNE_MESSAGES[grade], rng);
  const flower = pickFromPool(FORTUNE_KEYWORDS.flower, rng);
  const mood = pickFromPool(FORTUNE_KEYWORDS.mood, rng);
  const dessert = pickFromPool(FORTUNE_KEYWORDS.dessert, rng);
  const color = pickFromPool(FORTUNE_KEYWORDS.color, rng);

  return { grade, message, flower, mood, dessert, color, targetDate };
}
```

> 시드 기반이므로 같은 날짜 → 같은 운세가 나옵니다.
> 오전에 확인한 운세와 실수로 같은 날 다시 열려고 하면 차단되지만,
> 만약 로직 변경으로 다시 볼 수 있게 해도 동일한 결과가 보장됩니다.

---

## 5. 리스닝 문제 데이터 설계

### 5-1. Part별 특성과 데이터 구조

| Part | 설명 | 문제 수 | 오디오 | 특이사항 |
|---|---|---|---|---|
| **Part 2** | 질문-응답 | 1문항/세트 | 질문 음성 → 보기 3개 (실제 시험은 음성 보기이지만, 게임에서는 텍스트로 표시) | 보기가 3개 (A/B/C) |
| **Part 3** | 대화문 | 3문항/세트 | 대화 1개를 듣고 관련 3문제 풀기 | 하나의 오디오 → 복수 문제 |
| **Part 4** | 담화문 | 3문항/세트 | 담화 1개를 듣고 관련 3문제 풀기 | 하나의 오디오 → 복수 문제 |

### 5-2. 데이터 스키마

```javascript
const LISTENING_DATA = [
  // === Part 2: 질문-응답 (세트당 1문항) ===
  {
    id: "L2-001",
    part: 2,
    setTitle: "Part 2 — 질문-응답 #1",
    audioFile: "listening/audio/part2_001.mp3",
    questions: [
      {
        id: "L2-001-1",
        question: "",  // Part 2는 음성이 문제 자체이므로 질문 텍스트 없음 (또는 "다음 응답 중 올바른 것은?")
        options: ["(A) Yes, it's on the third floor.", "(B) No, I haven't seen her.", "(C) At 3 o'clock."],
        answer: 0  // 0-indexed
      }
    ]
  },

  // === Part 3: 대화문 (세트당 3문항) ===
  {
    id: "L3-001",
    part: 3,
    setTitle: "Part 3 — 대화문 #1",
    audioFile: "listening/audio/part3_001.mp3",  // 대화 전체 1파일
    questions: [
      {
        id: "L3-001-1",
        question: "What are the speakers mainly discussing?",
        options: [
          "(A) A new product launch",
          "(B) An office relocation plan",
          "(C) A client meeting schedule",
          "(D) A budget increase request"
        ],
        answer: 1
      },
      {
        id: "L3-001-2",
        question: "What does the woman suggest?",
        options: [
          "(A) Hiring more staff",
          "(B) Postponing the deadline",
          "(C) Contacting the vendor",
          "(D) Reviewing the report"
        ],
        answer: 2
      },
      {
        id: "L3-001-3",
        question: "What will the man probably do next?",
        options: [
          "(A) Send an email",
          "(B) Schedule a meeting",
          "(C) Call the client",
          "(D) Print the documents"
        ],
        answer: 0
      }
    ]
  },

  // === Part 4: 담화문 (세트당 3문항) ===
  {
    id: "L4-001",
    part: 4,
    setTitle: "Part 4 — 담화문 #1",
    audioFile: "listening/audio/part4_001.mp3",
    questions: [
      // Part 3과 동일 구조 (questions 배열에 3문항)
    ]
  }
];
```

### 5-3. 포춘쿠키에서의 출제 로직

```
1. LISTENING_DATA에서 랜덤으로 세트 1개 선택
2. Part 2 → 1문항 출제
   Part 3/4 → 해당 세트의 3문항을 순차적으로 모두 출제
3. 전체 문제를 풀고 나면 운세 표시
```

> Part 3/4의 경우, 오디오를 한 번 듣고 3문항을 연속으로 풀어야 합니다.
> 오디오 재생 → 문제 1 → 문제 2 → 문제 3 → 운세 표시 흐름이 됩니다.
> 다시듣기 버튼을 통해 문제 풀기 도중에도 오디오를 재생할 수 있어야 합니다.

---

## 6. 파일 구조

```
card/
├── listening/                    # [NEW] 리스닝 자원 폴더
│   └── audio/                    # MP3 파일 저장
│       ├── part2_001.mp3         # Part 2 개별 문항
│       ├── part2_002.mp3
│       ├── part3_001.mp3         # Part 3 세트별 (대화 전체)
│       ├── part3_002.mp3
│       ├── part4_001.mp3         # Part 4 세트별 (담화 전체)
│       └── ...
├── listening_data.js             # [NEW] 리스닝 문제 데이터
├── fortune_cookie.js             # [NEW] 포춘쿠키 로직 (운세 + 리스닝 통합)
├── index.html                    # [MODIFY] 메뉴 버튼 + 모달 + CSS + 스크립트 태그
└── (기존 파일들 변경 없음)
```

---

## 7. UI 플로우 상세

### Phase 0: 진입

```
[🥠 포춘쿠키] 클릭
    ├─ 사용 가능 → 모달 오픈 → Phase 1
    ├─ 리스닝 데이터 없음 → 안내 메시지
    └─ 1일 제한 걸림 → 차단 메시지
```

### Phase 1: 리스닝 재생

```
┌──────────────────────────────────────┐
│        🥠 오늘의 포춘쿠키              │
│                                       │
│      Part 3 — 대화문 #1               │
│                                       │
│         ┌──────────────┐              │
│         │   ▶ 재생     │              │
│         └──────────────┘              │
│                                       │
│      ━━━━━━━━━━━━━━━━━━━━ 00:00      │
│                                       │
│   💡 음성을 듣고 아래 문제를 풀어주세요  │
│                                       │
│      [🔄 다시 듣기]                    │
│      [문제 풀기 →]                     │
│                                       │
│      [✕ 닫기]                          │
└──────────────────────────────────────┘
```

### Phase 2: 문제 풀기

```
┌──────────────────────────────────────┐
│    🥠 Part 3 — 문제 1/3               │
│                                       │
│    Q. What are the speakers mainly    │
│       discussing?                      │
│                                       │
│    ┌────────────────────────────┐     │
│    │ (A) A new product launch    │     │
│    ├────────────────────────────┤     │
│    │ (B) An office relocation    │     │
│    ├────────────────────────────┤     │
│    │ (C) A client meeting        │     │
│    ├────────────────────────────┤     │
│    │ (D) A budget increase       │     │
│    └────────────────────────────┘     │
│                                       │
│    [🔄 다시 듣기]                      │
└──────────────────────────────────────┘
```

- 정답 시: 초록 하이라이트 + "정답!" → 잠시 후 다음 문제
- 오답 시: 빨강 하이라이트 + 정답 표시 → 잠시 후 다음 문제
- 마지막 문제 후: Phase 3으로 전환

### Phase 3: 운세 결과

(상단 Section 4의 최종 운세 출력 예시 참고)

---

## 8. 모듈 구조 (`fortune_cookie.js`)

```javascript
const FortuneCookie = {
  // ── 상태 ──
  currentSession: null,   // { set, qIndex, results, audio, phase }
  audio: null,

  // ── 1일 1회 관리 ──
  canUse(),               // AM/PM 로직 기반 사용 가능 여부
  getFortuneTargetDate(), // 운세 대상 날짜 계산 (오전=오늘, 오후=내일)
  markUsed(),             // 사용 기록 저장

  // ── 리스닝 ──
  selectRandomSet(),      // LISTENING_DATA에서 랜덤 세트 선택
  playAudio(),            // 오디오 재생
  replayAudio(),          // 다시 듣기

  // ── 운세 ──
  generateFortune(targetDate),  // 날짜 시드 기반 운세 생성
  getContextMessages(targetDate, global),  // 배경설정 메시지
  getKeywords(targetDate),       // 키워드 선택

  // ── UI 제어 ──
  open(),                 // 모달 오픈 (Phase 0~1)
  showListening(),        // Phase 1: 리스닝 재생
  showQuestion(),         // Phase 2: 문제 표시
  handleAnswer(index),    // 정답 판정 + 다음 문제 or Phase 3
  showFortune(),          // Phase 3: 운세 표시
  close(),                // 모달 닫기 + 오디오 정지

  // ── 유틸 ──
  seededRandom(seed),     // 결정론적 난수 생성기
  hashDateString(dateStr) // 날짜를 시드 정수로 변환
};
```

---

## 9. 기존 시스템 연동 포인트

### `index.html` 수정 사항

| 위치 | 변경 내용 |
|---|---|
| `<head>` CSS 영역 | 포춘쿠키 모달 스타일 추가 |
| `.title-screen-actions` | `🥠 포춘쿠키` 버튼 추가 |
| 모달 영역 (`</body>` 직전) | `#modal-fortune-cookie` 모달 HTML 추가 |
| 스크립트 태그 영역 | `listening_data.js`, `fortune_cookie.js` 로딩 추가 |

### `RPG.global` 확장

```javascript
// 기존 global 객체에 추가
fortuneCookieLastUsed: null  // { date, period, fortuneTargetDate }
```

### 기존 코드와 충돌 없음

- 새 파일 2개(`listening_data.js`, `fortune_cookie.js`) 추가
- `index.html`에 버튼 1개 + 모달 1개 + CSS 추가
- 기존 TOEIC/RPG 로직에 영향 없음 (완전 독립 모듈)

---

## 10. MP3 파일 준비 가이드

교재 구매 후 MP3 파일을 준비할 때:

1. 교재에서 제공하는 MP3를 다운로드 (문제별 개별 파일)
2. 파일명 규칙에 맞게 이름 변경:
   - Part 2: `part2_001.mp3`, `part2_002.mp3`, ...
   - Part 3: `part3_001.mp3` (대화 전체), `part3_002.mp3`, ...
   - Part 4: `part4_001.mp3` (담화 전체), `part4_002.mp3`, ...
3. `card/listening/audio/` 폴더에 배치
4. `listening_data.js`에 문제-파일 매핑 데이터 작성

> Part 3/4는 하나의 대화/담화에 3문항이 딸려있으므로,
> **세트(대화/담화)당 MP3 1개 + 문제 3개**로 매핑합니다.
> 교재에서 대화별로 파일을 제공하면 그대로 사용 가능합니다.

---

## 결정 완료 — 기초 강의 및 AI 해설

### Q1. 기초 강의 → ❌ 별도 강의 없음, Part별 한 줄 팁만 표시

#### 결정 근거

- **포춘쿠키의 본질은 "운세"**입니다. 리스닝은 운세를 열기 위한 관문이지, 학습 시스템 그 자체가 아닙니다. 여기에 강의 시스템을 붙이면 가벼운 일상 콘텐츠라는 정체성이 흐려집니다.
- 다만, 사용자가 아직 리스닝 공부를 시작하지 않았으므로 Part 형식 자체를 모를 수 있습니다. 따라서 **Phase 1(리스닝 재생) 화면에 Part별 한 줄 팁**을 표시하여 최소한의 안내를 제공합니다.
- 추후 교재를 학습하면서 전략 콘텐츠가 필요하다고 느끼면 별도로 추가할 수 있는 여지는 남겨둡니다.

#### 구현 방식

Phase 1 리스닝 재생 화면에 Part에 따라 다른 한 줄 안내를 표시합니다:

```javascript
const PART_TIPS = {
  2: "💡 질문을 듣고 가장 적절한 응답을 고르세요. (보기 3개)",
  3: "💡 두 사람의 대화를 듣고 3개의 질문에 답하세요. 핵심 키워드에 집중!",
  4: "💡 한 사람의 담화를 듣고 3개의 질문에 답하세요. 목적과 세부사항을 파악!"
};
```

---

### Q2. AI 해설 → ✅ 루미 질문하기 연동

#### 결정 근거

- **정적 해설(B)은 콘텐츠 부담이 큽니다.** 모든 리스닝 문제에 수동으로 해설을 입력해야 하며, 문제를 추가할 때마다 해설도 함께 작성해야 합니다.
- **기존 `LumiQuestionRuntime` 인프라가 이미 완성되어 있어** 재활용 비용이 매우 낮습니다. Part 6/7 루미 질문하기와 동일한 패턴으로 리스닝에도 적용 가능합니다.
- **리스닝은 "왜 이게 정답인지" 맥락 이해가 핵심**인데, AI가 대화 스크립트 분석, 핵심 어휘 설명, 오답 소거 이유 등을 동적으로 제공할 수 있습니다.
- **운세 흐름을 방해하지 않습니다.** 운세 화면(Phase 3)에서 "루미에게 질문하기" 버튼을 **선택적으로** 누르는 구조이므로, 관심 없는 사용자는 운세만 보고 닫을 수 있습니다.

#### 구현 방식

```
Phase 3 (운세 화면)
┌──────────────────────────────────────┐
│        🥠 운세 결과 (기존 내용)        │
│        ...                            │
│  ────────────────────                  │
│  📝 문제 결과: 2/3 정답                │
│                                       │
│  [💬 루미에게 질문하기]    ← 선택적     │
│  [닫기]                               │
└──────────────────────────────────────┘
```

- 기존 TOEIC 루미 질문과 동일하게, 문제/보기/정답/사용자 선택을 컨텍스트로 묶어 `LumiQuestionRuntime` 세션을 생성합니다.
- 리스닝 전용 세션 키를 사용하여 일반 질문/TOEIC 질문 세션과 분리합니다.
- 모달 닫기 시 리스닝 루미 세션도 정리합니다.
