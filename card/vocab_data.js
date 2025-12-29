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
    { w: 'consent', m: '(명) 동의, 허락; (동) 동의하다', tm: '(명) 내용물, 목차; (형) 만족하는', tw: 'content' }
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
