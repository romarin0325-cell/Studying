const VOCAB_SOURCE = [
    { w: 'amenities', m: '(명) 편의시설; (명) 예의, 기품', tm: '(명) 적, 앙숙; (명) 반대 세력', tw: 'enemies' },
    { w: 'banquet', m: '(명) 연회, 만찬', tm: '(명) 꽃다발; (명) 칭찬하는 말', tw: 'bouquet' },
    { w: 'reserve', m: '(동) 예약하다; (동) 보유하다', tm: '(동) 뒤집다; (동) 후진하다', tw: 'reverse' },
    { w: 'revenue', m: '(명) 수익, 수입; (명) 세입', tm: '(명) 장소, 개최지; (명) 현장', tw: 'venue' },
    { w: 'decline', m: '(동) 감소하다; (동) 거절하다', tm: '(동) 비스듬히 눕다; (동) (의자를) 젖히다', tw: 'recline' },
    { w: 'experiment', m: '(명) 실험; (동) 실험하다', tm: '(명) 경험, 경력; (동) 겪다', tw: 'experience' },
    { w: 'renowned', m: '(형) 유명한, 명성 있는', tm: '(형) 갱신된; (형) 재개된, 새로워진', tw: 'renewed' },
    { w: 'enhance', m: '(동) 향상시키다; (동) 강화하다', tm: '(동) 매혹하다; (동) 마법을 걸다', tw: 'enchant' },
    { w: 'premises', m: '(명) 건물과 토지, 부지', tm: '(명) 약속, 서약; (명) 장래성', tw: 'promise' },
    { w: 'relevant', m: '(형) 관련 있는; (형) 적절한', tm: '(명) 친척; (형) 비교상의, 상대적인', tw: 'relative' },
    { w: 'portable', m: '(형) 휴대할 수 있는', tm: '(형) 마셔도 되는, 식수로 적합한', tw: 'potable' },
    { w: 'refuse', m: '(동) 거절하다; (명) 쓰레기', tm: '(명) 피난처, 은신처; (명) 보호', tw: 'refuge' },
    { w: 'tenant', m: '(명) 임차인, 세입자', tm: '(명) 교리, 주의; (명) 원칙', tw: 'tenet' },
    { w: 'expense', m: '(명) 비용, 지출', tm: '(명) 넓게 트인 지역; (명) 팽창', tw: 'expanse' },
    { w: 'flaw', m: '(명) 결함, 흠', tm: '(명) 흐름; (동) 흐르다', tw: 'flow' },
    { w: 'destination', m: '(명) 목적지, 행선지', tm: '(명) 운명, 숙명', tw: 'destiny' },
    { w: 'district', m: '(명) 구역, 지역', tm: '(형) 뚜렷한, 분명한; (형) 별개의', tw: 'distinct' },
    { w: 'inclement', m: '(형) (날씨가) 궂은, 혹독한', tm: '(명) 증가, 인상; (명) 이익', tw: 'increment' },
    { w: 'exclusively', m: '(부) 단독으로, 오로지', tm: '(부) 지나치게, 과도하게', tw: 'excessively' },
    { w: 'convert', m: '(동) 변환하다; (동) 개종하다', tm: '(형) 비밀의, 은밀한; (명) 은신처', tw: 'covert' },
    { w: 'curb', m: '(동) 억제하다; (명) 제한', tm: '(명) 곡선, 커브; (동) 구부리다', tw: 'curve' },
    { w: 'deduct', m: '(동) 공제하다, 차감하다', tm: '(동) 추론하다, 연역하다', tw: 'deduce' },
    { w: 'repair', m: '(동) 수리하다; (명) 수리', tm: '(동) 손상시키다, 해치다', tw: 'impair' },
    { w: 'emphasis', m: '(명) 강조, 주안점', tm: '(명) 공감, 감정이입', tw: 'empathy' },
    { w: 'popular', m: '(형) 인기 있는; (형) 대중의', tm: '(형) 인구가 많은; (형) 붐비는', tw: 'populous' },
    { w: 'transfer', m: '(동) 이동하다; (동) 전근하다', tm: '(동) 변형시키다; (동) 성질을 바꾸다', tw: 'transform' },
    { w: 'estimate', m: '(동) 추산하다; (명) 견적서', tm: '(동) 존경하다; (명) 존경, 존중', tw: 'esteem' },
    { w: 'laboratory', m: '(명) 실험실, 연구소', tm: '(명) 화장실, 세면장', tw: 'lavatory' },
    { w: 'expire', m: '(동) 만료되다, 끝나다', tm: '(동) 고무하다, 영감을 주다', tw: 'inspire' },
    { w: 'consent', m: '(명) 동의, 허락; (동) 동의하다', tm: '(명) 내용물, 목차; (형) 만족하는', tw: 'content' },
    { w: 'retail', m: '(명) 소매; (형) 소매의', tm: '(명) 세부사항; (동) 상세히 알리다', tw: 'detail' },
    { w: 'affordable', m: '(형) 가격이 알맞은; (형) 감당할 수 있는', tm: '(형) 사랑스러운; (형) 귀여운', tw: 'adorable' },
    { w: 'valid', m: '(형) 유효한; (형) 타당한', tm: '(형) 고체의, 단단한; (형) 견고한', tw: 'solid' },
    { w: 'traffic', m: '(명) 교통(량); (명) 왕래', tm: '(형) 아주 멋진; (형) 훌륭한', tw: 'terrific' },
    { w: 'imperative', m: '(형) 필수적인; (형) 긴급한', tm: '(형) 제국의; (형) 황제의', tw: 'imperial' },
    { w: 'insurance', m: '(명) 보험; (명) 보험금', tm: '(명) 확언, 장담; (명) 보증', tw: 'assurance' },
    { w: 'ingredient', m: '(명) 재료, 성분', tm: '(명) 경사도; (명) 기울기, 비탈', tw: 'gradient' },
    { w: 'renovate', m: '(동) 개조하다, 보수하다', tm: '(동) 혁신하다; (동) 쇄신하다', tw: 'innovate' },
    { w: 'versatile', m: '(형) 다재다능한; (형) 다용도의', tm: '(형) 휘발성의; (형) 변덕스러운', tw: 'volatile' },
    { w: 'implement', m: '(동) 실행하다; (명) 도구', tm: '(동) 보충하다; (명) 부록', tw: 'supplement' },
    { w: 'commitment', m: '(명) 헌신; (명) 약속, 책무', tm: '(명) 위원회; (명) 위원', tw: 'committee' },
    { w: 'facilitate', m: '(동) 용이하게 하다; (동) 촉진하다', tm: '(동) 매혹하다; (동) 마음을 사로잡다', tw: 'fascinate' },
    { w: 'encourage', m: '(동) 격려하다; (동) 권장하다', tm: '(동) 격분하게 하다; (동) 화나게 하다', tw: 'enrage' },
    { w: 'persuade', m: '(동) 설득하다', tm: '(동) 추구하다; (동) 뒤쫓다', tw: 'pursue' },
    { w: 'launch', m: '(동) 출시하다; (동) 시작하다', tm: '(명) 점심 식사; (동) 점심을 먹다', tw: 'lunch' },
    { w: 'reliable', m: '(형) 믿을 수 있는; (형) 확실한', tm: '(형) 법적 책임이 있는; (형) ~하기 쉬운', tw: 'liable' },
    { w: 'strategy', m: '(명) 전략, 계획', tm: '(명) 비극; (명) 참사', tw: 'tragedy' },
    { w: 'remind', m: '(동) 상기시키다; (동) 생각나게 하다', tm: '(동) 되감다; (동) 다시 감다', tw: 'rewind' },
    { w: 'suitable', m: '(형) 적합한, 알맞은', tm: '(형) 안정적인; (형) 차분한', tw: 'stable' },
    { w: 'beverage', m: '(명) 음료', tm: '(형) 평균의; (명) 평균', tw: 'average' },
    { w: 'tentative', m: '(형) 잠정적인, 임시의', tm: '(형) 주의 깊은; (형) 세심한', tw: 'attentive' },
    { w: 'publicity', m: '(명) 홍보, 광고; (명) 평판', tm: '(명) 출판, 발행; (명) 출판물', tw: 'publication' },
    { w: 'procedure', m: '(명) 절차, 순서', tm: '(명) 제작자, PD; (명) 생산자', tw: 'producer' },
    { w: 'merchandise', m: '(명) 상품, 물품', tm: '(명) 상인, 무역상', tw: 'merchant' },
    { w: 'guarantee', m: '(명) 보증; (동) 보장하다', tm: '(명) 격리; (동) 격리하다', tw: 'quarantine' },
    { w: 'alleviate', m: '(동) 완화하다; (동) 경감하다', tm: '(동) (들어) 올리다; (동) 승진시키다', tw: 'elevate' },
    { w: 'solicit', m: '(동) 요청하다; (동) 간청하다', tm: '(형) 불법의; (형) 사회 통념에 어긋나는', tw: 'illicit' },
    { w: 'unprecedented', m: '(형) 전례 없는', tm: '(형) 예측할 수 없는; (형) 종잡을 수 없는', tw: 'unpredictable' },
    { w: 'deny', m: '(동) 부인하다; (동) 거절하다', tm: '(동) 반항하다; (동) 무시하다', tw: 'defy' },
    { w: 'recession', m: '(명) 불경기, 침체', tm: '(명) 접수처; (명) 환영회', tw: 'reception' }
];

const VOCAB_DATA = [];

VOCAB_SOURCE.forEach(item => {
    // Add Original
    VOCAB_DATA.push({
        word: item.w,
        meaning: item.m,
        trap_meaning: item.tm,
        trap_word: item.tw
    });
    // Add Trap Pair
    VOCAB_DATA.push({
        word: item.tw,
        meaning: item.tm,
        trap_meaning: item.m,
        trap_word: item.w
    });
});
