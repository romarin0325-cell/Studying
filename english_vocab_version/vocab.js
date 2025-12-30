const VOCAB_DATA = [
  {
    "word": "access",
    "meaning": "(명) 접근, 이용 권한; (동) 접근하다",
    "trap_meaning": "(동) 평가하다; (동) 가늠하다, 재다",
    "trap_word": "assess"
  },
  {
    "word": "resume",
    "meaning": "(동) 재개하다; (명) 이력서",
    "trap_meaning": "(동) 가정하다; (동) (책임을) 떠맡다",
    "trap_word": "assume"
  },
  {
    "word": "complementary",
    "meaning": "(형) 상호보완적인; (형) 보충하는",
    "trap_meaning": "(형) 무료의; (형) 칭찬의, 경의를 표하는",
    "trap_word": "complimentary"
  },
  {
    "word": "inventory",
    "meaning": "(명) 재고, 재고 목록; (명) 재고 조사",
    "trap_meaning": "(명) 발명품; (명) 발명, 창작력",
    "trap_word": "invention"
  },
  {
    "word": "feature",
    "meaning": "(명) 특징, 특색; (명) 특집 기사",
    "trap_meaning": "(명) 미래, 장래; (형) 미래의, 향후의",
    "trap_word": "future"
  },
  {
    "word": "contractor",
    "meaning": "(명) 계약자, 도급업자",
    "trap_meaning": "(명) 수축, 축소; (명) (단어의) 축약형",
    "trap_word": "contraction"
  },
  {
    "word": "issue",
    "meaning": "(명) 문제, 이슈; (동) 발행하다",
    "trap_meaning": "(명) 조직, 화장지; (동) (휴지로) 닦다",
    "trap_word": "tissue"
  },
  {
    "word": "eligible",
    "meaning": "(형) 자격이 있는; (형) 적격의",
    "trap_meaning": "(형) 읽기 어려운; (형) 판독이 불가능한",
    "trap_word": "illegible"
  },
  {
    "word": "confirm",
    "meaning": "(동) 확인하다; (동) 승인하다",
    "trap_meaning": "(동) 따르다, 순응하다; (동) (규칙에) 일치하다",
    "trap_word": "conform"
  },
  {
    "word": "affect",
    "meaning": "(동) 영향을 미치다; (명) 정서, 감정",
    "trap_meaning": "(명) 효과, 영향; (명) 결과",
    "trap_word": "effect"
  },
  {
    "word": "attribute",
    "meaning": "(명) 속성, 특질; (동) ~의 탓으로 돌리다",
    "trap_meaning": "(동) 기여하다; (동) 기부하다, 기증하다",
    "trap_word": "contribute"
  },
  {
    "word": "facility",
    "meaning": "(명) 시설; (명) 쉬움, 유창함",
    "trap_meaning": "(명) 교수진, 교직원; (명) (타고난) 능력, 재능",
    "trap_word": "faculty"
  },
  {
    "word": "appraisal",
    "meaning": "(명) 평가; (명) 감정",
    "trap_meaning": "(명) 승인, 인가; (명) 찬성, 동의",
    "trap_word": "approval"
  },
  {
    "word": "commission",
    "meaning": "(명) 수수료; (명) 위원회",
    "trap_meaning": "(명) 허락, 허가; (명) 승인",
    "trap_word": "permission"
  },
  {
    "word": "delinquent",
    "meaning": "(형) 연체된, 체납된; (형) 태만한",
    "trap_meaning": "(형) 성실한, 부지런한; (형) 끈기 있는",
    "trap_word": "diligent"
  },
  {
    "word": "precede",
    "meaning": "(동) ~에 앞서다; (동) 선행하다",
    "trap_meaning": "(동) 계속하다, 진행하다; (동) 나아가다",
    "trap_word": "proceed"
  },
  {
    "word": "personal",
    "meaning": "(형) 개인적인; (형) 사적인",
    "trap_meaning": "(명) 직원, 인원; (명) 인사부서, 인사과",
    "trap_word": "personnel"
  },
  {
    "word": "extensive",
    "meaning": "(형) 광범위한; (형) 대규모의",
    "trap_meaning": "(형) 비싼, 고가의; (형) 돈이 많이 드는",
    "trap_word": "expensive"
  },
  {
    "word": "liability",
    "meaning": "(명) 법적 책임; (명) 부채, 빚",
    "trap_meaning": "(명) 능력, 재능; (명) 할 수 있음",
    "trap_word": "ability"
  },
  {
    "word": "perspective",
    "meaning": "(명) 관점, 시각; (명) 원근법",
    "trap_meaning": "(형) 장래의, 유망한; (형) 예비의",
    "trap_word": "prospective"
  },
  {
    "word": "stationery",
    "meaning": "(명) 문구류, 편지지",
    "trap_meaning": "(형) 정지된; (형) 움직이지 않는",
    "trap_word": "stationary"
  },
  {
    "word": "vacation",
    "meaning": "(명) 휴가, 방학",
    "trap_meaning": "(명) 직업, 천직; (명) 소명",
    "trap_word": "vocation"
  },
  {
    "word": "expand",
    "meaning": "(동) 확장하다; (동) 팽창하다",
    "trap_meaning": "(동) (돈, 시간을) 쓰다; (동) 소비하다",
    "trap_word": "expend"
  },
  {
    "word": "wander",
    "meaning": "(동) 돌아다니다; (동) 헤매다",
    "trap_meaning": "(동) 궁금해하다; (명) 경이로움, 놀라움",
    "trap_word": "wonder"
  },
  {
    "word": "principal",
    "meaning": "(명) 교장, 학장; (형) 주요한, 주된",
    "trap_meaning": "(명) 원칙, 원리; (명) 신조",
    "trap_word": "principle"
  },
  {
    "word": "confident",
    "meaning": "(형) 자신감 있는; (형) 확신하는",
    "trap_meaning": "(형) 기밀의, 비밀의; (형) 신뢰를 요하는",
    "trap_word": "confidential"
  },
  {
    "word": "diary",
    "meaning": "(명) 일기, 수첩",
    "trap_meaning": "(명) 유제품; (형) 유제품의, 우유의",
    "trap_word": "dairy"
  },
  {
    "word": "collaborate",
    "meaning": "(동) 협력하다; (동) 공동 작업하다",
    "trap_meaning": "(동) 기념하다, 축하하다; (동) 찬양하다",
    "trap_word": "celebrate"
  },
  {
    "word": "auditor",
    "meaning": "(명) 회계 감사관; (명) 청강생",
    "trap_meaning": "(명) 오디션; (명) 청력, 청각",
    "trap_word": "audition"
  },
  {
    "word": "physics",
    "meaning": "(명) 물리학",
    "trap_meaning": "(명) 의사, 내과 의사; (동) 치료하다",
    "trap_word": "physician"
  },
  {
    "word": "adapt",
    "meaning": "(동) 적응하다; (동) (소설 등을) 각색하다",
    "trap_meaning": "(동) 입양하다; (동) 채택하다, 도입하다",
    "trap_word": "adopt"
  },
  {
    "word": "attitude",
    "meaning": "(명) 태도, 자세; (명) 사고방식",
    "trap_meaning": "(명) 고도, 높이; (명) 해발",
    "trap_word": "altitude"
  },
  {
    "word": "commute",
    "meaning": "(동) 통근하다; (동) (처벌을) 감형하다",
    "trap_meaning": "(동) 계산하다, 산출하다; (동) 추정하다",
    "trap_word": "compute"
  },
  {
    "word": "subscription",
    "meaning": "(명) 구독(료); (명) 기부금",
    "trap_meaning": "(명) 처방전; (명) 처방, 규정",
    "trap_word": "prescription"
  },
  {
    "word": "morale",
    "meaning": "(명) 사기, 의욕; (명) (군대 등의) 기세",
    "trap_meaning": "(형) 도덕적인; (명) 교훈",
    "trap_word": "moral"
  },
  {
    "word": "contact",
    "meaning": "(명) 연락, 접촉; (동) 연락하다",
    "trap_meaning": "(명) 계약, 계약서; (동) 계약하다",
    "trap_word": "contract"
  },
  {
    "word": "sensitive",
    "meaning": "(형) 예민한, 민감한; (형) 세심한",
    "trap_meaning": "(형) 분별 있는, 합리적인; (형) 실용적인",
    "trap_word": "sensible"
  },
  {
    "word": "economic",
    "meaning": "(형) 경제의, 경제학의",
    "trap_meaning": "(형) 경제적인; (형) 절약하는, 실속 있는",
    "trap_word": "economical"
  },
  {
    "word": "conversation",
    "meaning": "(명) 대화, 회화",
    "trap_meaning": "(명) 보존, 보호; (명) (에너지) 절약",
    "trap_word": "conservation"
  },
  {
    "word": "waive",
    "meaning": "(동) (권리를) 포기하다; (동) 철회하다",
    "trap_meaning": "(동) 손을 흔들다; (명) 파도, 물결",
    "trap_word": "wave"
  },
  {
    "word": "require",
    "meaning": "(동) 필요로 하다; (동) 요구하다",
    "trap_meaning": "(동) 문의하다, 묻다; (동) 조사하다",
    "trap_word": "inquire"
  },
  {
    "word": "conscious",
    "meaning": "(형) 의식하는, 지각 있는; (형) 의도적인",
    "trap_meaning": "(형) 양심적인; (형) 성실한, 꼼꼼한",
    "trap_word": "conscientious"
  },
  {
    "word": "dessert",
    "meaning": "(명) 디저트, 후식",
    "trap_meaning": "(명) 사막; (동) 버리다, 떠나다",
    "trap_word": "desert"
  },
  {
    "word": "custom",
    "meaning": "(명) 관습, 풍습; (형) 맞춤의, 주문한",
    "trap_meaning": "(명) 의상, 복장; (명) (무대) 의상",
    "trap_word": "costume"
  },
  {
    "word": "simultaneous",
    "meaning": "(형) 동시의; (형) 동시에 일어나는",
    "trap_meaning": "(형) 자발적인; (형) 즉흥적인, 저절로 일어나는",
    "trap_word": "spontaneous"
  },
  {
    "word": "object",
    "meaning": "(명) 물건, 대상; (동) 반대하다",
    "trap_meaning": "(명) 주제, 과목; (형) 지배를 받는",
    "trap_word": "subject"
  },
  {
    "word": "propose",
    "meaning": "(동) 제안하다; (동) 청혼하다",
    "trap_meaning": "(명) 목적, 목표; (명) 용도, 의도",
    "trap_word": "purpose"
  },
  {
    "word": "allocate",
    "meaning": "(동) 할당하다, 배분하다",
    "trap_meaning": "(동) (위치를) 찾아내다; (동) 위치시키다",
    "trap_word": "locate"
  },
  {
    "word": "favorable",
    "meaning": "(형) 호의적인; (형) 유리한, 순조로운",
    "trap_meaning": "(형) 가장 좋아하는; (명) 마음에 드는 사람",
    "trap_word": "favorite"
  },
  {
    "word": "bald",
    "meaning": "(형) 대머리의; (형) 단조로운",
    "trap_meaning": "(형) 대담한, 용감한; (형) 굵은(글씨체)",
    "trap_word": "bold"
  },
  {
    "word": "collision",
    "meaning": "(명) 충돌, 부딪침; (명) (의견) 대립",
    "trap_meaning": "(명) 공모, 결탁; (명) 유착",
    "trap_word": "collusion"
  },
  {
    "word": "valuable",
    "meaning": "(형) 소중한, 귀중한; (명) 귀중품",
    "trap_meaning": "(형) 이용 가능한; (형) 시간이 나는",
    "trap_word": "available"
  },
  {
    "word": "loose",
    "meaning": "(형) 헐거운, 풀린; (동) 놓아주다",
    "trap_meaning": "(동) 잃어버리다; (동) 지다, 패배하다",
    "trap_word": "lose"
  },
  {
    "word": "evolution",
    "meaning": "(명) 진화; (명) 점진적 발전",
    "trap_meaning": "(명) 혁명; (명) 갑작스런 변화",
    "trap_word": "revolution"
  },
  {
    "word": "cooperation",
    "meaning": "(명) 협력, 협동",
    "trap_meaning": "(명) 기업, 회사; (명) 법인",
    "trap_word": "corporation"
  },
  {
    "word": "through",
    "meaning": "(전) ~을 통하여; (형) 끝난",
    "trap_meaning": "(형) 철저한, 빈틈없는; (형) 완전한",
    "trap_word": "thorough"
  },
  {
    "word": "assure",
    "meaning": "(동) 장담하다, 안심시키다",
    "trap_meaning": "(동) 보험에 들다; (동) (손실을) 보장하다",
    "trap_word": "insure"
  },
  {
    "word": "meditation",
    "meaning": "(명) 명상, 묵상",
    "trap_meaning": "(명) 중재, 조정; (명) 매개",
    "trap_word": "mediation"
  },
  {
    "word": "notify",
    "meaning": "(동) 통지하다, 알리다",
    "trap_meaning": "(동) 알아차리다, 주목하다; (명) 공고문",
    "trap_word": "notice"
  },
  {
    "word": "vague",
    "meaning": "(형) 모호한, 희미한",
    "trap_meaning": "(명) 유행; (형) 유행하는",
    "trap_word": "vogue"
  },
  {
    "word": "retail",
    "meaning": "(명) 소매; (형) 소매의",
    "trap_meaning": "(명) 세부사항; (동) 상세히 알리다",
    "trap_word": "detail"
  },
  {
    "word": "affordable",
    "meaning": "(형) 가격이 알맞은; (형) 감당할 수 있는",
    "trap_meaning": "(형) 사랑스러운; (형) 귀여운",
    "trap_word": "adorable"
  },
  {
    "word": "valid",
    "meaning": "(형) 유효한; (형) 타당한",
    "trap_meaning": "(형) 고체의, 단단한; (형) 견고한",
    "trap_word": "solid"
  },
  {
    "word": "traffic",
    "meaning": "(명) 교통(량); (명) 왕래",
    "trap_meaning": "(형) 아주 멋진; (형) 훌륭한",
    "trap_word": "terrific"
  },
  {
    "word": "imperative",
    "meaning": "(형) 필수적인; (형) 긴급한",
    "trap_meaning": "(형) 제국의; (형) 황제의",
    "trap_word": "imperial"
  },
  {
    "word": "insurance",
    "meaning": "(명) 보험; (명) 보험금",
    "trap_meaning": "(명) 확언, 장담; (명) 보증",
    "trap_word": "assurance"
  },
  {
    "word": "ingredient",
    "meaning": "(명) 재료, 성분",
    "trap_meaning": "(명) 경사도; (명) 기울기, 비탈",
    "trap_word": "gradient"
  },
  {
    "word": "renovate",
    "meaning": "(동) 개조하다, 보수하다",
    "trap_meaning": "(동) 혁신하다; (동) 쇄신하다",
    "trap_word": "innovate"
  },
  {
    "word": "versatile",
    "meaning": "(형) 다재다능한; (형) 다용도의",
    "trap_meaning": "(형) 휘발성의; (형) 변덕스러운",
    "trap_word": "volatile"
  },
  {
    "word": "implement",
    "meaning": "(동) 실행하다; (명) 도구",
    "trap_meaning": "(동) 보충하다; (명) 부록",
    "trap_word": "supplement"
  },
  {
    "word": "commitment",
    "meaning": "(명) 헌신; (명) 약속, 책무",
    "trap_meaning": "(명) 위원회; (명) 위원",
    "trap_word": "committee"
  },
  {
    "word": "facilitate",
    "meaning": "(동) 용이하게 하다; (동) 촉진하다",
    "trap_meaning": "(동) 매혹하다; (동) 마음을 사로잡다",
    "trap_word": "fascinate"
  },
  {
    "word": "encourage",
    "meaning": "(동) 격려하다; (동) 권장하다",
    "trap_meaning": "(동) 격분하게 하다; (동) 화나게 하다",
    "trap_word": "enrage"
  },
  {
    "word": "persuade",
    "meaning": "(동) 설득하다",
    "trap_meaning": "(동) 추구하다; (동) 뒤쫓다",
    "trap_word": "pursue"
  },
  {
    "word": "launch",
    "meaning": "(동) 출시하다; (동) 시작하다",
    "trap_meaning": "(명) 점심 식사; (동) 점심을 먹다",
    "trap_word": "lunch"
  },
  {
    "word": "reliable",
    "meaning": "(형) 믿을 수 있는; (형) 확실한",
    "trap_meaning": "(형) 법적 책임이 있는; (형) ~하기 쉬운",
    "trap_word": "liable"
  },
  {
    "word": "strategy",
    "meaning": "(명) 전략, 계획",
    "trap_meaning": "(명) 비극; (명) 참사",
    "trap_word": "tragedy"
  },
  {
    "word": "remind",
    "meaning": "(동) 상기시키다; (동) 생각나게 하다",
    "trap_meaning": "(동) 되감다; (동) 다시 감다",
    "trap_word": "rewind"
  },
  {
    "word": "suitable",
    "meaning": "(형) 적합한, 알맞은",
    "trap_meaning": "(형) 안정적인; (형) 차분한",
    "trap_word": "stable"
  },
  {
    "word": "beverage",
    "meaning": "(명) 음료",
    "trap_meaning": "(형) 평균의; (명) 평균",
    "trap_word": "average"
  },
  {
    "word": "tentative",
    "meaning": "(형) 잠정적인, 임시의",
    "trap_meaning": "(형) 주의 깊은; (형) 세심한",
    "trap_word": "attentive"
  },
  {
    "word": "publicity",
    "meaning": "(명) 홍보, 광고; (명) 평판",
    "trap_meaning": "(명) 출판, 발행; (명) 출판물",
    "trap_word": "publication"
  },
  {
    "word": "procedure",
    "meaning": "(명) 절차, 순서",
    "trap_meaning": "(명) 제작자, PD; (명) 생산자",
    "trap_word": "producer"
  },
  {
    "word": "merchandise",
    "meaning": "(명) 상품, 물품",
    "trap_meaning": "(명) 상인, 무역상",
    "trap_word": "merchant"
  },
  {
    "word": "guarantee",
    "meaning": "(명) 보증; (동) 보장하다",
    "trap_meaning": "(명) 격리; (동) 격리하다",
    "trap_word": "quarantine"
  },
  {
    "word": "alleviate",
    "meaning": "(동) 완화하다; (동) 경감하다",
    "trap_meaning": "(동) (들어) 올리다; (동) 승진시키다",
    "trap_word": "elevate"
  },
  {
    "word": "solicit",
    "meaning": "(동) 요청하다; (동) 간청하다",
    "trap_meaning": "(형) 불법의; (형) 사회 통념에 어긋나는",
    "trap_word": "illicit"
  },
  {
    "word": "unprecedented",
    "meaning": "(형) 전례 없는",
    "trap_meaning": "(형) 예측할 수 없는; (형) 종잡을 수 없는",
    "trap_word": "unpredictable"
  },
  {
    "word": "deny",
    "meaning": "(동) 부인하다; (동) 거절하다",
    "trap_meaning": "(동) 반항하다; (동) 무시하다",
    "trap_word": "defy"
  },
  {
    "word": "recession",
    "meaning": "(명) 불경기, 침체",
    "trap_meaning": "(명) 접수처; (명) 환영회",
    "trap_word": "reception"
  }
];
