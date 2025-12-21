const PM_DATA = {
    initialStats: {
        hp: 50,
        atk: 10,
        matk: 10,
        def: 5,
        money: 1000,
        // Primary
        vit: 20,    // 체력
        str: 20,    // 근력
        int: 20,    // 지능
        charm: 20,  // 매력
        stress: 0,  // 스트레스
        // Hidden
        morality: 20,  // 도덕심
        faith: 20,     // 신앙심
        intimacy: 20,  // 친밀함
        elegance: 20   // 기품
    },

    // Growth ratios
    growth: {
        hpPerVit: 1, // Max 50 cap added in logic
        atkPerStr: 0.1, // 1 per 10
        matkPerInt: 0.1 // 1 per 10
    },

    // 10~17 years old = 8 years? Prompt says "10살부터 17살까지 7년 진행".
    // Usually 10, 11, 12, 13, 14, 15, 16. (7 years).
    // Ends at 17th birthday (start of 17).
    // Or 10,11,12,13,14,15,16,17(end).
    // Prompt says "17세 종료시 특수이벤트". So 10,11,12,13,14,15,16,17. That's 8 years.
    // But prompt says "총 28턴". 28 / 4 seasons = 7 years.
    // So likely 10 to 16 inclusive (7 years), then 17 is the ending/final event year.
    gameDuration: {
        startAge: 10,
        endAge: 17, // The moment you turn 17, final events trigger
        seasons: ['봄', '여름', '가을', '겨울']
    },

    stars: [
        { id: 'scholar', name: '학문의별', desc: '지능, 신앙 성장시 +1' },
        { id: 'warrior', name: '전사의별', desc: '체력, 근력 성장시 +1' },
        { id: 'rest', name: '휴식의별', desc: '휴식시 스트레스 추가 -10' },
        { id: 'charm', name: '매혹의별', desc: '매력, 기품 성장시 +1' },
        { id: 'money', name: '금전의별', desc: '아르바이트 보상 +20%' },
        { id: 'chaos', name: '혼돈의별', desc: '알바 대성공/실패 확률 2배' },
        { id: 'king', name: '왕의별', desc: '수업/알바 대성공 확률 2배' },
        { id: 'black', name: '검은별', desc: '술집알바 스탯변화 2배, 골드 2배' },
        { id: 'gold', name: '황금별', desc: '스트레스를 소모하지 않음' }
    ],

    personalities: {
        'heat': { name: '열혈', desc: '초기 체력/근력 +10, 수업시 근력 +1', bonusStat: 'str' },
        'wisdom': { name: '지혜', desc: '초기 지능 +10, 수업시 지능 +1', bonusStat: 'int' },
        'kindness': { name: '다정', desc: '초기 매력 +10, 수업시 매력 +1', bonusStat: 'charm' },
        'freedom': { name: '자유', desc: '아르바이트 골드 +10%', bonusGold: 0.1 }
    },

    actions: {
        study: {
            basic: [
                { id: 's_sword', name: '검술수업', stats: {str: 3, vit: 2, stress: 5}, cost: 100 },
                { id: 's_magic', name: '마법수업', stats: {int: 4, faith: 1, stress: 5}, cost: 100 },
                { id: 's_etiquette', name: '예절수업', stats: {elegance: 3, charm: 2, morality: 1, str: -1, stress: 5}, cost: 100 }
            ],
            advanced: [ // Unlocked after 6 times
                { id: 's_sword_adv', name: '고급검술', stats: {str: 6, vit: 4, charm: -2, stress: 10}, cost: 200 },
                { id: 's_magic_adv', name: '고급마법', stats: {int: 7, faith: 1, stress: 10}, cost: 200 },
                { id: 's_etiquette_adv', name: '고급예절', stats: {elegance: 5, charm: 4, morality: 1, str: -2, stress: 10}, cost: 200 }
            ]
        },
        job: {
            basic: [
                { id: 'j_church', name: '성당봉사', stats: {faith: 3, morality: 1, stress: 5}, income: 100 },
                { id: 'j_smithy', name: '대장간', stats: {vit: 2, stress: 15}, income: 200 },
                { id: 'j_scribe', name: '서기', stats: {int: 1, stress: 10}, income: 200 },
                { id: 'j_pub', name: '술집', stats: {charm: 1, morality: -2, stress: 10}, income: 300 }
            ],
            advanced: [ // Unlocked after 6 times
                { id: 'j_church_adv', name: '성당봉사(고급)', stats: {faith: 3, morality: 1, stress: 5}, income: 200 },
                { id: 'j_smithy_adv', name: '대장간(고급)', stats: {vit: 2, stress: 15}, income: 400 },
                { id: 'j_scribe_adv', name: '서기(고급)', stats: {int: 1, stress: 10}, income: 400 },
                { id: 'j_pub_adv', name: '술집(고급)', stats: {charm: 2, morality: -3, stress: 10}, income: 600 }
            ]
        },
        rest: [
            { id: 'r_basic', name: '휴식', stressHeal: 30, cost: 0 },
            { id: 'r_adv', name: '고급휴식', stressHeal: 40, cost: 100 },
            { id: 'r_vacation', name: '바캉스', stressHeal: 40, stats: {intimacy: 10}, cost: 300 }
        ]
    },

    shop: {
        items: [
            { id: 'calm_incense', name: '진정의향초', type: 'consumable', effect: {stress: -30}, cost: 300 },
            { id: 'sword_iron', name: '강철검', type: 'equip', slot: 'weapon', stats: {atk: 5}, cost: 100 },
            { id: 'sword_knight', name: '기사의검', type: 'equip', slot: 'weapon', stats: {atk: 10}, cost: 300 },
            { id: 'book_magic', name: '마법서', type: 'equip', slot: 'weapon', stats: {matk: 5}, cost: 100 },
            { id: 'book_ancient', name: '고대의마법서', type: 'equip', slot: 'weapon', stats: {matk: 10}, cost: 300 },
            { id: 'armor_leather', name: '가죽갑옷', type: 'equip', slot: 'armor', stats: {def: 5}, cost: 200 },
            { id: 'robe_magic', name: '마법로브', type: 'equip', slot: 'armor', stats: {mdef: 5}, cost: 200 }, // mdef handled as def in prompt? "장비의 공격이나 마공 방어는 그대로 합산" -> Maybe universal def
            { id: 'indulgence', name: '면죄부', type: 'consumable', effect: {morality: 10}, cost: 1000 },
            { id: 'dress_silk', name: '실크드레스', type: 'equip', slot: 'armor', stats: {charm: 10}, cost: 2000, special: 'costume' }, // 16+ only
            { id: 'book_str', name: '힘의책', type: 'consumable', effect: {str: 10}, cost: 500 },
            { id: 'book_int', name: '지식의책', type: 'consumable', effect: {int: 10}, cost: 500 },
            { id: 'book_charm', name: '매력의책', type: 'consumable', effect: {charm: 10}, cost: 500 }
        ]
    },

    events: {
        locations: [
            { id: 'arena', name: '대련장' },
            { id: 'lake', name: '호수' },
            { id: 'bar', name: '바:블랙래빗' },
            { id: 'tower', name: '마녀의탑' }
        ]
    },

    enemies: {
        // Tournament
        knight: { name: '왕궁기사', hp: 70, atk: 30, def: 5, type: 'phy' },
        kane: { name: '케인', hp: 90, atk: 35, def: 10, type: 'phy' },
        apprentice: { name: '견습마법사', hp: 70, atk: 30, def: 0, type: 'mag' }, // "atk" here is matk for dmg calc
        royalmage: { name: '왕궁마법사', hp: 90, atk: 35, def: 5, type: 'mag' },
        // Exploration
        slime: { name: '슬라임', hp: 50, atk: 20, def: 0, type: 'phy' },
        goblin: { name: '고블린', hp: 70, atk: 30, def: 5, type: 'phy' },
        demonking: { name: '마왕', hp: 100, atk: 40, def: 10, type: 'phy' }
    },

    endings: [
        { id: 'king', name: '왕', priority: 1, req: {elegance: 110, morality: 50, charm: 60, vit: 50}, flag: 'noble_ledger' },
        { id: 'hero', name: '용사', priority: 2, req: {str: 130, vit: 60, morality: 30}, flag: 'demon_king_dead' },
        { id: 'demon_king', name: '마왕', priority: 3, req: {str: 130, vit: 70}, maxMorality: 0, flag: 'demon_king_dead' }, // morality <= 0
        { id: 'knight_captain', name: '왕궁기사단장', priority: 4, req: {str: 120, vit: 60, morality: 20, elegance: 40}, flag: 'sword_win' },
        { id: 'archmage', name: '대현자', priority: 5, req: {int: 140, vit: 50, elegance: 30, morality: 30}, flag: 'magic_win' },
        { id: 'court_musician', name: '궁정음악가', priority: 6, req: {charm: 110, elegance: 70, morality: 30}, flag: 'noah_event' },
        { id: 'princess', name: '공주', priority: 7, req: {charm: 100, intimacy: 50}, flag: 'silk_dress_equipped' },
        { id: 'pope', name: '교황', priority: 8, req: {faith: 100, morality: 50} },
        { id: 'royal_guard', name: '왕실근위병', priority: 9, req: {str: 100, morality: 20} },
        { id: 'bard', name: '음유시인', priority: 10, req: {charm: 100, morality: 20} },
        { id: 'teacher', name: '교사', priority: 11, req: {int: 120, morality: 20} },
        { id: 'warlock', name: '흑마법사', priority: 12, req: {int: 120}, maxMorality: 9 }, // morality < 10
        { id: 'farmer', name: '농부', priority: 13, req: {str: 80, vit: 60, morality: 10} },
        { id: 'bunnyboy', name: '바니보이', priority: 14, req: {charm: 90}, maxMorality: 9 },
        { id: 'thug', name: '건달', priority: 15, req: {str: 80}, maxMorality: 9 },
        { id: 'househusband', name: '가정주부', priority: 16, req: {morality: 40, charm: 40} },
        { id: 'jobless', name: '백수', priority: 99, req: {} } // Fallback
    ]
};
