// Text of plan/entry-report.html (built by build-entry-report.mjs). Plain Korean for the owner.
export const REPORT = {
  subtitle: '2026-11-21 밤 · UI 선택 뒤 "입장권" 지시에 따른 작업 보고',
  toc: [['summary', '한눈에'], ['requests', '요청별 처리'], ['screens', '화면 전후'], ['decisions', '제가 판단한 것'], ['checks', '확인한 것'], ['files', '파일']],
  summary: [
    '고르신 "새벽 꿈" UI의 색과 배치는 그대로 두고 도트로 다시 그렸습니다. 둥근 모서리·흐린 그림자·부드러운 색 번짐을 없애고, 2px 남색 외곽선·계단 모서리·단단한 그림자·도트 글꼴(Galmuri)로 바꿨습니다.',
    'GPT가 만든 새 도트 150종(동료 130·야생 9·보스 11)으로 모든 캐릭터를 바꿨습니다. 메모하신 6명은 보완본을 썼습니다.',
    '카드 게임의 전투 규칙 파일 4개를 이 게임 안(game/core/)으로 복사했습니다. 이제 이 게임에서만 규칙을 고칠 수 있습니다.',
    '처음 하는 사람에게는 기능을 단계별로 엽니다. 첫 본편은 꿈결(쉬움)에 단순한 규칙으로 진행하고, 첫 본편을 클리어하면 지역 규칙·변덕·접두사·제단·◆3 등이 열립니다. 이미 진행한 저장은 지금처럼 모두 열려 있습니다.',
    '루미가 실제 버튼을 짚으며 알려 주는 튜토리얼을 디펜스처럼 넣었습니다. 기능이 처음 열릴 때도 한 번씩 짧게 알려 줍니다.',
    '뽑기에서 한 번 나온 동료가 다시 안 나오던 규칙을 없앴습니다. 이제 표기한 확률이 실제 확률과 같습니다. 이미 함께인 동료가 나오면 그 동료가 강해집니다(★).',
    '전투 결과, 편성, 영입, 준비(시작 동료·샘 초대·출현 제외), 층 표시줄, 기록 버튼, 전투 기록, 공격+버프 기술 연출을 짚어 주신 대로 고쳤습니다.',
    '원본 카드 게임과 달라진 규칙·콘텐츠를 모두 모은 검수 페이지를 따로 만들었습니다(plan/changes-review.html).'
  ],
  // [요청, 한 일, 어디서 보나, 상태]
  requests: [
    ['UI를 도트풍으로 (지금 느낌 유지)', '색·배치는 그대로, 외곽선·모서리·그림자·글꼴·움직임을 도트 규칙으로. 실제 화면으로 본 Cobalt Core·Sea of Stars·Coromon·Balatro의 공통점을 적용', '모든 화면', '완료'],
    ['전투 뒤 초상화 4개의 뜻을 모르겠다', '결과를 "○층 돌파 → 쓰러진 동료 → 물려받은 기술 → 보상 → 다음 할 일 버튼"으로. 초상은 기술을 받은 동료 하나만. 마지막 일격·원주인·생환은 전투 기록으로', '전투 결과', '완료'],
    ['시작은 단순하게, 진행은 경쾌하게 (입장권)', '새 프로필은 첫 본편을 꿈결·단순 규칙으로(적 HP ×0.79 보정), 첫 본편 클리어 뒤 기능을 연다. 첫 대여 전투는 상단 조작을 숨김. 빈 유물 띠 숨김', '첫 세션 전체', '완료'],
    ['새 도트 에셋으로 교체', '150종 450장 교체, 머리 위치로 얼굴 자르기', '모든 화면', '완료'],
    ['card 로직을 게임 안으로', 'game/core/에 4파일 복사, 시뮬 출력 바이트 일치', '코드', '완료'],
    ['그림자 적 층의 칸이 커지고 머리카락만 보임', '층 칸 너비 통일, 문지기는 방패·보스는 왕관 아이콘', '층 지도 위 표시줄', '완료'],
    ['로그 보기가 흰 빈칸', '책 아이콘과 글자가 있는 도트 버튼', '지도·전투 상단', '완료'],
    ['드래그 편성창 대신 세련된 편성창 / 초상 쏠림', '독립 편성 화면(적 요약·세 자리 1배 전신·대기·고정 시작 버튼). 얼굴은 머리 중심으로', '문을 고른 뒤', '완료'],
    ['전투 로그의 어중간한 초상', '초상을 빼고 아군(청록)·적(산호) 색 표식', '전투 기록', '완료'],
    ['공격+버프 기술의 이펙트', '타격 → 0.18초 뒤 실제로 바뀐 곳(필드 칸·머리 위)에 효과 이름표 한 번', '전투', '완료'],
    ['원본과 바뀐 부분 검수 페이지', '22범주 277+항목, 검색·판정·메모·내보내기', 'plan/changes-review.html', '완료'],
    ['기초 전력 제안 삭제', '버튼과 계산 연결을 모두 제거', '편성', '완료'],
    ['영입은 클리어 시점 보유 카드로', '클리어할 때 살아 있는 미영입 동료 전원이 후보(대기·물러남 포함), 후보마다 출전 이력 표시', '영입', '완료'],
    ['만나고 싶은 동료 (확률 불변, 버튼이 커짐)', '기능을 없애고, 동료 상세에 "나오는 지역"을 바로 표시', '동료 도감', '완료'],
    ['동행·봉인이 직관적이지 않다', '시작 동료·샘 초대·출현 제외로 이름을 바꾸고, 지역 출현 명단 격자에서 칸마다 상태를 아이콘+글자로. 첫 본편 클리어 전에는 숨김', '출발 준비', '완료'],
    ['뽑기의 중복 금지 로직 삭제', '삭제. 확률 표기 = 실제. 중복은 강화(+10%), 쓰러진 동료가 나오면 기억(+10%)', '소환의 샘·보충', '완료'],
    ['디펜스 같은 튜토리얼', '루미의 코치 표시(실제 버튼 구멍, 직접 눌러야 진행), 기능 안내 1회씩, 건너뛰기·다시 보기', '첫 실행', '완료'],
    ['변경점 보고서', '이 페이지', '—', '완료'],
    ['구현·검증은 GPT 위주', 'Astra(자문 1회)·Sol(구현 10회)', 'history/model-log.md', '완료']
  ],
  // { before, after, title, note } — before/after are gallery shot names (before = commit e98c361)
  screens: [
    {
      "before": "opening-choices-title",
      "after": "title-clean",
      "title": "제목",
      "note": "지금 색·배치 그대로, 도트 글꼴 로고와 계단 끝 리본, 도트 틀 버튼. 캐릭터는 새 도트"
    },
    {
      "before": "next-goal",
      "after": "next-goal",
      "title": "관측소",
      "note": "메뉴 이름표를 남색 도트 꼬리표로, 버튼은 도트 틀"
    },
    {
      "before": "destinations",
      "after": "destinations",
      "title": "행선지",
      "note": "지역 카드의 둥근 모서리·흐린 그림자 → 계단 모서리·단단한 그림자"
    },
    {
      "before": "difficulty-choice",
      "after": "entry-preparation",
      "title": "출발 준비",
      "note": "대표·동행·우선 후보·봉인이 흩어진 시트 → 시작 동료 1명 + 이 지역 출현 명단 격자(칸마다 상태 표시)"
    },
    {
      "before": "roster-table",
      "after": "entry-preparation-action-menu",
      "title": "출현 명단",
      "note": "\"만나고 싶은 동료\" 글자 때문에 칸이 커지던 것 → 높이 고정, 칸을 누르면 할 수 있는 행동과 이유"
    },
    {
      "before": "opening-choices",
      "after": "opening-choices",
      "title": "첫 전투의 두 선택",
      "note": "도트 틀 카드. 물러나기는 결과(생존·다음 동료가 받는 피해)를 그대로 보여 줌"
    },
    {
      "before": "tempo-telegraph",
      "after": "tempo-telegraph",
      "title": "전투",
      "note": "적 정보판·동료 칩·명령 타일을 도트로, 큰 숫자는 도트 글꼴. 새 그림"
    },
    {
      "before": "last-hit",
      "after": "last-hit",
      "title": "전투 결과",
      "note": "초상 6개(실제로는 3명) → 쓰러진 동료 → 물려받은 기술 → 다음 할 일 버튼"
    },
    {
      "before": "formation-board",
      "after": "formation-board",
      "title": "편성",
      "note": "독립 화면: 적 요약 두 줄, 1배 전신 세 자리, 대기, 고정 시작 버튼. 기초 전력 제안 삭제"
    },
    {
      "before": "map-formation-preview",
      "after": "map-formation-preview",
      "title": "지도",
      "note": "지도 아래 붙던 편성을 분리. 문 위 이름표는 실제 행동(2턴 MP 흡수 등)"
    },
    {
      "before": "map-three-doors",
      "after": "map-three-doors",
      "title": "층 표시줄",
      "note": "그림자 적 칸이 커지고 머리카락만 보이던 것 → 같은 너비, 문지기 방패·보스 왕관"
    },
    {
      "before": "spring-count",
      "after": "spring-boost",
      "title": "소환의 샘",
      "note": "고정 확률표 → 실제 확률(전설군 펼침), 결과는 합류·강화(★)·기억"
    },
    {
      "before": "battle-log",
      "after": "battle-log",
      "title": "전투 기록",
      "note": "잘린 초상 → 아군 청록·적 산호 표식"
    },
    {
      "before": "reinforcement-board",
      "after": "reinforcement-board",
      "title": "동료 보충",
      "note": "도트 틀, 1배 전신, 강화 대상이면 그렇게 표시"
    },
    {
      "before": "relic-compare",
      "after": "relic-compare",
      "title": "유물 비교",
      "note": "도트 틀 비교 카드"
    },
    {
      "before": "event-values",
      "after": "event-values",
      "title": "사건",
      "note": "대화창·선택지를 도트로, 새 그림"
    },
    {
      "before": "opening-awaken",
      "after": "opening-awaken",
      "title": "첫 깨우기",
      "note": "도트 틀 카드"
    },
    {
      "before": null,
      "after": "entry-stand-title",
      "title": "튜토리얼 1 · 시작",
      "note": "루미가 실제 시작 버튼만 열어 두고 한 줄로 안내. 건너뛰기 가능"
    },
    {
      "before": null,
      "after": "entry-stand-opening",
      "title": "튜토리얼 2 · 첫 선택",
      "note": "두 선택만 열림. 바깥을 누르면 막힘"
    },
    {
      "before": null,
      "after": "entry-stand-inherit",
      "title": "튜토리얼 3 · 유품",
      "note": "실제로 물려받았을 때만 유품 타일을 짚음"
    },
    {
      "before": null,
      "after": "entry-stand-doors",
      "title": "튜토리얼 4 · 문",
      "note": "문 카드만 열림"
    },
    {
      "before": null,
      "after": "entry-stand-recruit",
      "title": "튜토리얼 5 · 영입",
      "note": "돌아온 동료 중 한 명, 후보마다 출전 이력"
    },
    {
      "before": null,
      "after": "entry-stand-departure",
      "title": "튜토리얼 6 · 첫 출발",
      "note": "준비 시트 없이 바로 출발(첫 본편은 꿈결)"
    },
    {
      "before": null,
      "after": "entry-recruit-unlock",
      "title": "해금 알림",
      "note": "첫 본편 클리어 뒤 한 줄: 이제 여정·지역 규칙·샘 초대를 쓸 수 있어"
    },
    {
      "before": null,
      "after": "entry-appearance",
      "title": "도감 · 나오는 지역",
      "note": "만나고 싶은 동료 대신 나오는 지역을 바로 표시"
    },
    {
      "before": null,
      "after": "result-boss-wipe",
      "title": "보스와 함께 쓰러진 승리",
      "note": "보스 격파 · 돌아온 동료 0명 → 관측소로"
    },
    {
      "before": null,
      "after": "spring-memory",
      "title": "기억",
      "note": "쓰러진 동료가 다시 나오면 가장 먼저 합류한 생존 동료가 강해짐"
    },
    {
      "before": null,
      "after": "compact-stage",
      "title": "작은 화면 전투",
      "note": "390×640에서도 큰 그림이 위로 잘리지 않음"
    }
  ],
  // [항목, 결정, 이유, 바꾸고 싶으면]
  decisions: [
    ['중복 뽑기의 보상', '이미 함께인 동료가 나오면 이번 원정 공격·마공 +10%(★ 중첩), 쓰러진·보낸 동료면 가장 먼저 합류한 생존 동료에게 +10%', '진짜 중복 유닛은 엔진 전 범위(유품·축복·편성·저장)가 한 캐릭터 = 한 ID를 가정해 비용이 컸습니다. 이 방식이면 확률 표기가 항상 실제와 같습니다', '수치는 engine/awakenings.js 한 곳. 진짜 중복 유닛을 원하시면 말씀해 주세요(대안 설계 필요)'],
    ['첫 본편', '새 프로필은 꿈결 고정, 지역 규칙·변덕·접두사·위험 문·제단·내기·가격 거래·전투 축복·◆3·준비 편집을 끔. 적 HP ×0.79로 서투른 플레이 기준 클리어 70~78%', '끈 기능에 플레이어에게 유리한 것이 많아 그대로면 46.9%로 오히려 어려워졌습니다', 'content/tempo.js의 첫 본편 배율, engine/entry.js의 기능 목록'],
    ['튜토리얼 안내자', '루미(디펜스와 같은 선생님, 반말, 첫인사만 "형아")', '이 게임 세계에도 있는 캐릭터이고, 두 게임에서 선생님이 같으면 헷갈리지 않습니다', 'ui/tutorial.js의 문구'],
    ['선봉·중견·대장 이름', '유지(Astra는 첫째·둘째·셋째를 제안)', '카드 특성 문장이 이 이름을 씁니다. 바꾸면 특성 설명과 어긋납니다', '—'],
    ['만나고 싶은 동료', '삭제(Astra는 "출현 지역 책갈피"를 제안)', '숨은 상태를 하나 더 배워야 하는 장치보다, 동료 상세에 나오는 지역을 바로 보여 주는 편이 직관적입니다', '—'],
    ['용어', '대표→시작 동료, 동행→샘 초대, 봉인→출현 제외, 문 이름표에 쉬운 말(전투·강한 적·중간 보스·보스). 나머지 용어는 처음 나올 때 한 줄 설명', 'Astra의 전면 개명안은 Gemini가 다듬은 문구와 충돌하고 범위가 커서 단계적으로', 'ui/glossary.js 한 곳'],
    ['도트 글꼴 크기', 'Galmuri는 10·12·15px와 그 2배만, 문장은 Noto Sans KR', '1배 화면에서 다른 크기는 흐리게 깨지는 것을 확인했습니다', 'styles/base.css 머리말']
  ],
  checked: [
    "Node 테스트 384개 통과(전투·릴레이 규칙·원정·음악·균열·그림·원본 대비 규칙·복합 기술 연출).",
    "Chrome 화면 갤러리 86개, 지도 갤러리 8개 모두 통과(390×844, 일부 390×640). 사진은 제가 직접 넘겨 보며 확인했습니다.",
    "자동 플레이 두 판 완주: 시드 7·21 각각 입문 승리 → 홍련 화산 승리 → 황혼 성당 패배, 중간 새로고침 이어하기 포함, 브라우저 오류 0.",
    "튜토리얼 두 경로 완주: 애쉬로 맞서고 끝까지 따라가기(시드 7), 물러나고 건너뛰기(시드 21).",
    "확률 표기 = 실제: 입문 4층 상태에서 ◆1이 정확히 40/30/20/10%(이전 규칙에서는 0/0/66.7/33.3%였음).",
    "시뮬레이션: 모두 열린 저장 기준 여정 평균 74.5%→71.6%, 악몽 44.6%→43.6%(중복 뽑기 영향). 새 프로필 첫 본편은 서투른 플레이 기준 70.3%(64판)·78.1%(128판). 그 밖의 모드 출력은 조정 전후 바이트 일치.",
    "카드 규칙 복사 전후 시뮬레이션 출력과 규칙 번들 본문이 바이트 단위로 같음.",
    "새 그림 150종 450장: 포즈·크기·기준점·얼굴 상자를 테스트로 확인, 수정 6명은 보완본 해시 일치."
  ],
  unchecked: [
    "실제 휴대폰과 소유자 PC의 실행 파일 창에서 본 모습(Chrome 390·430px 흉내와 1배 화면까지만 확인).",
    "처음 하는 사람이 설명 없이 이해하는지. 입장권의 최종 판정은 실제 사람이 해 봐야 합니다.",
    "기능 안내(유물 교체·계약·균열 첫 방문 등)는 코드와 일부 갤러리로만 확인했고, 하나하나 실제로 띄워 보지는 않았습니다.",
    "강화·기억 +10%와 첫 본편 적 HP ×0.79는 시뮬레이션 기준 값입니다. 사람이 했을 때의 손맛은 미확인입니다.",
    "큰 글자(125%) 설정에서의 모든 화면 배치.",
    "새 그림 150종의 개별 품질(비율·머리 크기)은 소유자 채택을 따랐고, 제가 한 명씩 다시 판정하지는 않았습니다."
  ],
  files: [
    ['실행 파일(더블클릭)', 'C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui\\card_pixel\\game\\dist\\Relaymare.exe'],
    ['게임 HTML', 'C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui\\card_pixel\\game\\dist\\Relaymare.html'],
    ['원본 대비 검수 페이지', 'C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui\\card_pixel\\plan\\changes-review.html'],
    ['결정 장부(13절)', 'C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui\\card_pixel\\plan\\v1-decisions.md'],
    ['UI 방향(6절 도트풍)', 'C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui\\card_pixel\\plan\\ui-direction.md'],
    ['Astra 자문 전문', 'C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui\\card_pixel\\history\\consults\\2026-11-21-astra-entry.md'],
    ['소유자 지시 원문', 'C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui\\card_pixel\\history\\feedback\\2026-11-21-owner-ui-choice-and-entry.md']
  ]
};
