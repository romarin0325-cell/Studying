const COLLOCATION_DATA = [
    {
        "id": 1,
        "expression": "conduct a survey",
        "meaning": "설문조사를 실시하다",
        "options": [
            "conduct",
            "connect",
            "commit",
            "contain"
        ],
        "question": "The marketing team plans to _______ a survey to gather feedback from customers about the new product line.",
        "answer": "conduct",
        "translation": "마케팅 팀은 신제품 라인에 대한 고객들의 피드백을 수집하기 위해 설문조사를 실시할 계획이다."
    },
    {
        "id": 2,
        "expression": "meet the deadline",
        "meaning": "마감일을 맞추다",
        "options": [
            "see",
            "face",
            "meet",
            "hit"
        ],
        "question": "All employees worked overtime this week to _______ the deadline for the project proposal.",
        "answer": "meet",
        "translation": "모든 직원들은 프로젝트 제안서의 마감일을 맞추기 위해 이번 주에 초과 근무를 했다."
    },
    {
        "id": 3,
        "expression": "reach an agreement",
        "meaning": "합의에 도달하다",
        "options": [
            "arrive",
            "reach",
            "get",
            "touch"
        ],
        "question": "After hours of negotiation, the two companies finally were able to _______ an agreement on the merger terms.",
        "answer": "reach",
        "translation": "몇 시간의 협상 끝에, 두 회사는 마침내 합병 조건에 대한 합의에 도달할 수 있었다."
    },
    {
        "id": 4,
        "expression": "address the issue",
        "meaning": "문제를 해결하다/다루다",
        "options": [
            "address",
            "speak",
            "talk",
            "say"
        ],
        "question": "The manager promised to _______ the issue regarding the defective equipment as soon as possible.",
        "answer": "address",
        "translation": "관리자는 결함이 있는 장비와 관련된 문제를 가능한 한 빨리 해결하겠다고 약속했다."
    },
    {
        "id": 5,
        "expression": "deliver a presentation",
        "meaning": "발표하다",
        "options": [
            "tell",
            "deliver",
            "say",
            "announce"
        ],
        "question": "Ms. Carter is scheduled to _______ a presentation on the latest market trends at the upcoming conference.",
        "answer": "deliver",
        "translation": "Carter 씨는 다가오는 컨퍼런스에서 최신 시장 동향에 대해 발표할 예정이다."
    },
    {
        "id": 6,
        "expression": "renew a subscription",
        "meaning": "구독을 갱신하다",
        "options": [
            "renew",
            "redo",
            "repeat",
            "review"
        ],
        "question": "Please remember to _______ your subscription before it expires next month to avoid service interruption.",
        "answer": "renew",
        "translation": "서비스 중단을 피하기 위해 다음 달에 만료되기 전에 구독을 갱신하는 것을 잊지 마십시오."
    },
    {
        "id": 7,
        "expression": "play a significant role",
        "meaning": "중요한 역할을 하다",
        "options": [
            "do",
            "make",
            "play",
            "take"
        ],
        "question": "Social media platforms _______ a significant role in modern advertising strategies.",
        "answer": "play",
        "translation": "소셜 미디어 플랫폼들은 현대 광고 전략에서 중요한 역할을 한다."
    },
    {
        "id": 8,
        "expression": "accommodate the demand",
        "meaning": "수요를 수용하다/맞추다",
        "options": [
            "accommodate",
            "accumulate",
            "account",
            "access"
        ],
        "question": "The factory was expanded to _______ the increasing demand for electric vehicles.",
        "answer": "accommodate",
        "translation": "그 공장은 전기차에 대한 증가하는 수요를 감당하기 위해 확장되었다."
    },
    {
        "id": 9,
        "expression": "face a challenge",
        "meaning": "도전에 직면하다",
        "options": [
            "face",
            "look",
            "view",
            "head"
        ],
        "question": "Startups often _______ many challenges when trying to enter a competitive market.",
        "answer": "face",
        "translation": "스타트업들은 경쟁이 치열한 시장에 진입하려고 할 때 종종 많은 도전에 직면한다."
    },
    {
        "id": 10,
        "expression": "exceed expectations",
        "meaning": "기대를 뛰어넘다",
        "options": [
            "excelled",
            "exceeded",
            "accepted",
            "accessed"
        ],
        "question": "The quarterly profits _______ all expectations, surprising both analysts and investors.",
        "answer": "exceeded",
        "translation": "분기 수익이 모든 기대를 뛰어넘어 분석가들과 투자자들을 놀라게 했다."
    },
    {
        "id": 11,
        "expression": "highly recommended",
        "meaning": "강력히 추천되는",
        "options": [
            "highly",
            "heavy",
            "hugely",
            "hardly"
        ],
        "question": "The new software is _______ recommended by IT experts for its advanced security features.",
        "answer": "highly",
        "translation": "그 새 소프트웨어는 향상된 보안 기능 덕분에 IT 전문가들에 의해 강력히 추천된다."
    },
    {
        "id": 12,
        "expression": "conveniently located",
        "meaning": "편리하게 위치한",
        "options": [
            "completely",
            "conveniently",
            "confidently",
            "considerably"
        ],
        "question": "Our hotel is _______ located just a five-minute walk from the central train station.",
        "answer": "conveniently",
        "translation": "우리 호텔은 중앙 기차역에서 도보로 단 5분 거리에 편리하게 위치해 있다."
    },
    {
        "id": 13,
        "expression": "heavily discounted",
        "meaning": "대폭 할인된",
        "options": [
            "heavily",
            "tightly",
            "strictly",
            "busily"
        ],
        "question": "Winter clothing is often _______ discounted during the spring clearance sales.",
        "answer": "heavily",
        "translation": "겨울 의류는 봄맞이 재고 정리 세일 기간 동안 종종 대폭 할인된다."
    },
    {
        "id": 14,
        "expression": "strictly prohibited",
        "meaning": "엄격히 금지된",
        "options": [
            "strictly",
            "strongly",
            "straightly",
            "securely"
        ],
        "question": "Taking photographs is _______ prohibited inside the art gallery to protect the exhibits.",
        "answer": "strictly",
        "translation": "전시품 보호를 위해 미술관 내부에서의 사진 촬영은 엄격히 금지된다."
    },
    {
        "id": 15,
        "expression": "mutually beneficial",
        "meaning": "상호 이익이 되는",
        "options": [
            "mutually",
            "mostly",
            "merely",
            "manually"
        ],
        "question": "We hope to establish a _______ beneficial partnership that will help both companies grow.",
        "answer": "mutually",
        "translation": "우리는 두 회사가 모두 성장하는 데 도움이 될 상호 이익이 되는 파트너십을 구축하기를 희망한다."
    },
    {
        "id": 16,
        "expression": "promptly respond",
        "meaning": "즉시 응답하다",
        "options": [
            "promptly",
            "presently",
            "previously",
            "primarily"
        ],
        "question": "The customer service team is trained to _______ respond to all inquiries within 24 hours.",
        "answer": "promptly",
        "translation": "고객 서비스 팀은 24시간 이내에 모든 문의에 즉시 응답하도록 교육받는다."
    },
    {
        "id": 17,
        "expression": "increasingly popular",
        "meaning": "점점 더 인기 있는",
        "options": [
            "increasingly",
            "intentionally",
            "importantly",
            "inadvertently"
        ],
        "question": "Online education platforms have become _______ popular among working professionals.",
        "answer": "increasingly",
        "translation": "온라인 교육 플랫폼들은 직장인들 사이에서 점점 더 인기를 얻고 있다."
    },
    {
        "id": 18,
        "expression": "currently unavailable",
        "meaning": "현재 이용 불가한",
        "options": [
            "currently",
            "commonly",
            "clearly",
            "closely"
        ],
        "question": "The item you requested is _______ unavailable, but we expect a new shipment next week.",
        "answer": "currently",
        "translation": "귀하가 요청하신 물품은 현재 구매하실 수 없으나, 다음 주에 새 입고가 예정되어 있습니다."
    },
    {
        "id": 19,
        "expression": "reasonably priced",
        "meaning": "합리적으로 가격이 책정된",
        "options": [
            "reasonably",
            "recently",
            "rapidly",
            "regularly"
        ],
        "question": "The restaurant is known for serving delicious meals that are _______ priced.",
        "answer": "reasonably",
        "translation": "그 식당은 합리적인 가격의 맛있는 식사를 제공하는 것으로 알려져 있다."
    },
    {
        "id": 20,
        "expression": "thoroughly inspect",
        "meaning": "철저하게 검사하다",
        "options": [
            "thoroughly",
            "thoughtfully",
            "through",
            "totally"
        ],
        "question": "Technicians must _______ inspect the machinery before the factory begins operation each day.",
        "answer": "thoroughly",
        "translation": "기술자들은 매일 공장 가동이 시작되기 전에 기계를 철저하게 검사해야 한다."
    },
    {
        "id": 21,
        "expression": "look forward to",
        "meaning": "~을 고대하다",
        "options": [
            "forward",
            "up",
            "after",
            "out"
        ],
        "question": "We look _______ to hearing from you regarding the partnership proposal.",
        "answer": "forward",
        "translation": "우리는 파트너십 제안과 관련하여 귀하의 연락을 받기를 고대하고 있습니다."
    },
    {
        "id": 22,
        "expression": "comply with",
        "meaning": "준수하다",
        "options": [
            "comply",
            "compete",
            "compare",
            "complain"
        ],
        "question": "All visitors must _______ with the safety regulations while inside the factory.",
        "answer": "comply",
        "translation": "모든 방문객은 공장 내부에 있는 동안 안전 규정을 준수해야 한다."
    },
    {
        "id": 23,
        "expression": "account for",
        "meaning": "설명하다 / 비율을 차지하다",
        "options": [
            "account",
            "apply",
            "ask",
            "arrange"
        ],
        "question": "Electronic products _______ for nearly 40% of the company's total sales.",
        "answer": "account",
        "translation": "전자 제품은 회사 전체 매출의 거의 40%를 차지한다."
    },
    {
        "id": 24,
        "expression": "fill out",
        "meaning": "작성하다",
        "options": [
            "fill",
            "find",
            "figure",
            "fall"
        ],
        "question": "Please _______ out this application form and return it to the front desk.",
        "answer": "fill",
        "translation": "이 신청서를 작성해서 안내 데스크에 반납해 주십시오."
    },
    {
        "id": 25,
        "expression": "call off",
        "meaning": "취소하다",
        "options": [
            "called",
            "taken",
            "turned",
            "put"
        ],
        "question": "The outdoor event was _______ off due to the unexpected heavy rain.",
        "answer": "called",
        "translation": "예기치 못한 폭우로 인해 야외 행사가 취소되었다."
    },
    {
        "id": 26,
        "expression": "put off",
        "meaning": "연기하다/미루다",
        "options": [
            "put",
            "set",
            "keep",
            "take"
        ],
        "question": "We decided to _______ off the meeting until the CEO returns from her business trip.",
        "answer": "put",
        "translation": "우리는 CEO가 출장에서 돌아올 때까지 회의를 연기하기로 결정했다."
    },
    {
        "id": 27,
        "expression": "turn down",
        "meaning": "거절하다",
        "options": [
            "turn",
            "look",
            "break",
            "settle"
        ],
        "question": "Mr. Kim had to _______ down the job offer because he was not willing to relocate.",
        "answer": "turn",
        "translation": "Kim 씨는 이사할 의향이 없었기 때문에 그 일자리 제안을 거절해야 했다."
    },
    {
        "id": 28,
        "expression": "set up",
        "meaning": "설치하다/일정을 잡다/설립하다",
        "options": [
            "set",
            "give",
            "make",
            "bring"
        ],
        "question": "The IT department will _______ up the new computer network over the weekend.",
        "answer": "set",
        "translation": "IT 부서는 주말 동안 새로운 컴퓨터 네트워크를 설치할 것이다."
    },
    {
        "id": 29,
        "expression": "go over",
        "meaning": "검토하다",
        "options": [
            "go",
            "come",
            "watch",
            "take"
        ],
        "question": "Let's _______ over the contract details one more time before signing.",
        "answer": "go",
        "translation": "서명하기 전에 계약서 세부 사항을 한 번 더 검토합시다."
    },
    {
        "id": 30,
        "expression": "cut back on",
        "meaning": "줄이다/삭감하다",
        "options": [
            "back",
            "away",
            "out",
            "off"
        ],
        "question": "The company is trying to cut _______ on travel expenses to improve profitability.",
        "answer": "back",
        "translation": "그 회사는 수익성을 개선하기 위해 출장 비용을 줄이려 노력하고 있다."
    },
    {
        "id": 31,
        "expression": "dispose of",
        "meaning": "처분하다/버리다",
        "options": [
            "dispose",
            "disperse",
            "dissolve",
            "display"
        ],
        "question": "Please make sure to _______ of chemical waste in the designated containers.",
        "answer": "dispose",
        "translation": "화학 폐기물은 반드시 지정된 용기에 담아 처분해 주십시오."
    },
    {
        "id": 32,
        "expression": "rely on",
        "meaning": "의존하다",
        "options": [
            "rely",
            "reply",
            "relay",
            "release"
        ],
        "question": "Small businesses often _______ heavily on word-of-mouth marketing to attract customers.",
        "answer": "rely",
        "translation": "소규모 기업들은 고객을 유치하기 위해 입소문 마케팅에 크게 의존하는 경우가 많다."
    },
    {
        "id": 33,
        "expression": "enroll in",
        "meaning": "등록하다",
        "options": [
            "enroll",
            "enter",
            "enlist",
            "entail"
        ],
        "question": "Employees who wish to _______ in the advanced training course must sign up by Friday.",
        "answer": "enroll",
        "translation": "심화 교육 과정에 등록하고자 하는 직원은 금요일까지 신청해야 한다."
    },
    {
        "id": 34,
        "expression": "deal with",
        "meaning": "다루다/처리하다",
        "options": [
            "deal",
            "dial",
            "draw",
            "dwell"
        ],
        "question": "The customer service department is trained to _______ with complaints professionally.",
        "answer": "deal",
        "translation": "고객 서비스 부서는 불만 사항을 전문적으로 처리하도록 훈련받는다."
    },
    {
        "id": 35,
        "expression": "bring up",
        "meaning": "화제를 꺼내다",
        "options": [
            "bring",
            "take",
            "come",
            "make"
        ],
        "question": "He decided to _______ up the issue of salary negotiation during the meeting.",
        "answer": "bring",
        "translation": "그는 회의 중에 연봉 협상 문제를 꺼내기로 결정했다."
    },
    {
        "id": 36,
        "expression": "in charge of",
        "meaning": "~을 담당하는",
        "options": [
            "charge",
            "change",
            "check",
            "case"
        ],
        "question": "Ms. Lee is in _______ of overseeing the entire construction project.",
        "answer": "charge",
        "translation": "Lee 씨는 전체 건설 프로젝트 감독을 담당하고 있다."
    },
    {
        "id": 37,
        "expression": "regardless of",
        "meaning": "~와 상관없이",
        "options": [
            "regardless",
            "regarding",
            "regards",
            "regard"
        ],
        "question": "The event is open to everyone, _______ of age or occupation.",
        "answer": "regardless",
        "translation": "이 행사는 나이나 직업에 상관없이 모든 사람에게 열려 있다."
    },
    {
        "id": 38,
        "expression": "prior to",
        "meaning": "~ 이전에",
        "options": [
            "prior",
            "primary",
            "previous",
            "present"
        ],
        "question": "Passengers should arrive at the airport at least two hours _______ to departure.",
        "answer": "prior",
        "translation": "승객들은 출발 최소 2시간 전에 공항에 도착해야 한다."
    },
    {
        "id": 39,
        "expression": "subject to",
        "meaning": "~의 대상이 되는 / ~하기 쉬운",
        "options": [
            "subject",
            "object",
            "project",
            "inject"
        ],
        "question": "The schedule is _______ to change depending on weather conditions.",
        "answer": "subject",
        "translation": "일정은 기상 조건에 따라 변경될 수 있습니다."
    },
    {
        "id": 40,
        "expression": "on behalf of",
        "meaning": "~을 대표하여",
        "options": [
            "behalf",
            "belief",
            "behave",
            "behind"
        ],
        "question": "I would like to accept this award on _______ of my entire team.",
        "answer": "behalf",
        "translation": "저는 저희 팀 전체를 대표하여 이 상을 받고 싶습니다."
    },
    {
        "id": 41,
        "expression": "in accordance with",
        "meaning": "~에 따라서",
        "options": [
            "accordance",
            "account",
            "access",
            "accord"
        ],
        "question": "All travel expenses must be filed in _______ with the company's reimbursement policy.",
        "answer": "accordance",
        "translation": "모든 출장 경비는 회사의 환급 규정에 따라서 청구되어야 한다."
    },
    {
        "id": 42,
        "expression": "out of order",
        "meaning": "고장 난",
        "options": [
            "order",
            "place",
            "stock",
            "duty"
        ],
        "question": "The elevator in the main lobby is currently out of _______ and will be repaired by noon.",
        "answer": "order",
        "translation": "메인 로비에 있는 엘리베이터는 현재 고장 난 상태이며 정오까지 수리될 예정이다."
    },
    {
        "id": 43,
        "expression": "upon request",
        "meaning": "요청 시에",
        "options": [
            "request",
            "question",
            "require",
            "demand"
        ],
        "question": "Further details regarding the project are available upon _______ from the headquarters.",
        "answer": "request",
        "translation": "프로젝트에 관한 추가 세부 사항은 본사에 요청 시 제공됩니다."
    },
    {
        "id": 44,
        "expression": "in writing",
        "meaning": "서면으로",
        "options": [
            "writing",
            "written",
            "write",
            "writer"
        ],
        "question": "All formal complaints must be submitted in _______ to the legal department.",
        "answer": "writing",
        "translation": "모든 공식적인 불만 사항은 서면으로 법무 부서에 제출되어야 한다."
    },
    {
        "id": 45,
        "expression": "at all times",
        "meaning": "항상",
        "options": [
            "times",
            "days",
            "hours",
            "periods"
        ],
        "question": "Employees are required to wear their identification badges at all _______ while in the building.",
        "answer": "times",
        "translation": "직원들은 건물 내에 있는 동안 항상 신분증을 착용해야 한다."
    },
    {
        "id": 46,
        "expression": "in terms of",
        "meaning": "~의 면에서",
        "options": [
            "terms",
            "teams",
            "turns",
            "times"
        ],
        "question": "The new model is superior to the old one in _______ of fuel efficiency and safety.",
        "answer": "terms",
        "translation": "새 모델은 연료 효율성과 안전성 면에서 구형 모델보다 우수하다."
    },
    {
        "id": 47,
        "expression": "take advantage of",
        "meaning": "~을 이용하다",
        "options": [
            "take",
            "make",
            "get",
            "have"
        ],
        "question": "Customers are encouraged to _______ advantage of the special holiday discounts.",
        "answer": "take",
        "translation": "고객 여러분은 특별 휴일 할인 혜택을 이용하시기를 권장합니다."
    },
    {
        "id": 48,
        "expression": "keep track of",
        "meaning": "~을 파악하다/기록하다",
        "options": [
            "keep",
            "hold",
            "stay",
            "put"
        ],
        "question": "It is difficult to _______ track of all the inventory changes without an automated system.",
        "answer": "keep",
        "translation": "자동화된 시스템 없이는 모든 재고 변경 사항을 파악하는 것이 어렵다."
    },
    {
        "id": 49,
        "expression": "under construction",
        "meaning": "공사 중인",
        "options": [
            "construction",
            "connection",
            "contraction",
            "contribution"
        ],
        "question": "The bridge is currently under _______, so traffic is being diverted to a nearby route.",
        "answer": "construction",
        "translation": "그 다리는 현재 공사 중이어서, 교통이 인근 경로로 우회되고 있다."
    },
    {
        "id": 50,
        "expression": "with the exception of",
        "meaning": "~을 제외하고",
        "options": [
            "exception",
            "expectation",
            "reception",
            "inception"
        ],
        "question": "The library is open every day with the _______ of public holidays.",
        "answer": "exception",
        "translation": "도서관은 공휴일을 제외하고 매일 개방한다."
    }
];