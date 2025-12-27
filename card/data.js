const CARDS = [
    // --- 전설 (Legend) ---
    {
        id: 'queen', name: '여왕', grade: 'legend', element: 'nature', role: 'looter',
        stats: { hp: 520, atk: 100, matk: 120, def: 65, mdef: 60 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '피날레', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '필드버프제거x2.5배' },
            { name: '로열블룸', type: 'sup', tier: 2, cost: 20, desc: '대지의축복(물공/마공 20%↑)' }
        ]
    },
    {
        id: 'luna', name: '루나', grade: 'legend', element: 'dark', role: 'dealer',
        stats: { hp: 480, atk: 130, matk: 130, def: 60, mdef: 65 },
        trait: { type: 'cond_no_field_buff_eva', val: 30, desc: '필드버프 없을시 회피율 30% 증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '이클립스', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: '암흑 상태 적 2배 피해' },
            { name: '다크메테오', type: 'mag', tier: 3, cost: 30, val: 3.0, desc: '다음 턴 행동 불가' }
        ]
    },
    {
        id: 'gold_dragon', name: '골드드래곤', grade: 'legend', element: 'light', role: 'dealer',
        stats: { hp: 540, atk: 115, matk: 95, def: 60, mdef: 60 },
        trait: { type: 'pos_rear_def_mdef', val: 20, desc: '대장 배치시 방어/마방 20% 증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감' },
            { name: '얼티밋브레스', type: 'mag', tier: 3, cost: 30, val: 1.5, desc: '작열스택당 0.5배 추가' },
            { name: '드래곤크로', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리 피해' }
        ]
    },
    {
        id: 'rumi', name: '루미', grade: 'legend', element: 'water', role: 'buffer',
        stats: { hp: 500, atk: 80, matk: 115, def: 80, mdef: 90 },
        trait: { type: 'syn_fire_water_nature', desc: '불/물/자연 덱일시 트윙클파티 추가발동' },
        skills: [
            { name: '밀키웨이엑스터시', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '필드버프 스타파우더 발동' },
            { name: '문라이트세레나', type: 'sup', tier: 2, cost: 20, desc: '필드버프 달의축복 발동' }
        ]
    },
    {
        id: 'jasmine', name: '자스민', grade: 'legend', element: 'light', role: 'buffer',
        stats: { hp: 500, atk: 90, matk: 125, def: 70, mdef: 80 },
        trait: { type: 'cond_divine_3_dmg', val: 2.0, desc: '디바인 3스택 적에게 대미지 2배' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '더홀리', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '디바인시 성역 발동' },
            { name: '여신강림', type: 'sup', tier: 3, cost: 30, desc: '필드버프 여신강림 발동' }
        ]
    },
    {
        id: 'world_tree', name: '세계수', grade: 'legend', element: 'nature', role: 'buffer',
        stats: { hp: 600, atk: 90, matk: 90, def: 45, mdef: 45 },
        trait: { type: 'syn_nature_3_def', val: 50, desc: '자연 3장시 방어 50% 증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감' },
            { name: '대지의분노', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '필드버프 대지의축복 발동' },
            { name: '가이아포스', type: 'phy', tier: 2, cost: 20, val: 1.0, desc: '아군 디버프 해제' }
        ]
    },
    {
        id: 'zeke', name: '지크', grade: 'legend', element: 'fire', role: 'balancer',
        stats: { hp: 550, atk: 120, matk: 100, def: 55, mdef: 45 },
        trait: { type: 'death_field_sun', desc: '사망시 태양의축복 부여' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감' },
            { name: '이그니스스매시', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '작열소모당 1.5배 추가' },
            { name: '라그나로크', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: 'HP 50%이하 2배' }
        ]
    },
    {
        id: 'time_ruler', name: '시간의지배자', grade: 'legend', element: 'dark', role: 'debuffer',
        stats: { hp: 510, atk: 115, matk: 115, def: 65, mdef: 60 },
        trait: { type: 'pos_mid_matk', val: 30, desc: '중견 배치시 마공 30% 증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 2, cost: 20, desc: '마법공격 무효' },
            { name: '종언의예고', type: 'phy', tier: 3, cost: 30, val: 5.0, desc: '3턴 뒤 공격' },
            { name: '섀도우트위스트', type: 'sup', tier: 3, cost: 30, desc: '저주, 침묵, 암흑 부여' }
        ]
    },
    {
        id: 'frozen_witch', name: '혹한의마녀', grade: 'legend', element: 'water', role: 'debuffer',
        stats: { hp: 480, atk: 85, matk: 135, def: 70, mdef: 95 },
        trait: { type: 'death_dmg_debuff', val: 1.0, desc: '사망시 적 디버프 수 x 1배 대미지' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 2, cost: 20, desc: '마법공격 무효' },
            { name: '블리자드', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '4종디버프, 다음턴불가' },
            { name: '프로스트', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '디버프 5개 이상시 스턴' }
        ]
    },

    // --- 에픽 (Epic) ---
    {
        id: 'shadow_stalker', name: '그림자추적자', grade: 'epic', element: 'dark', role: 'looter',
        stats: { hp: 380, atk: 110, matk: 80, def: 65, mdef: 65 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '암살', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '암흑 부여' },
            { name: '어쌔신네일', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: '2.5배 물리' }
        ]
    },
    {
        id: 'mawang', name: '마왕', grade: 'epic', element: 'fire', role: 'dealer',
        stats: { hp: 400, atk: 95, matk: 95, def: 60, mdef: 60 },
        trait: { type: 'cond_debuff_3_dmg', val: 1.5, desc: '적 디버프 3개 이상 뎀 1.5배' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '데스핸드', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '디버프당 +0.5배' },
            { name: '데몬브레스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '암흑 부여' }
        ]
    },
    {
        id: 'red_dragon', name: '레드드래곤', grade: 'epic', element: 'fire', role: 'dealer',
        stats: { hp: 420, atk: 100, matk: 80, def: 60, mdef: 50 },
        trait: { type: 'pos_van_atk', val: 30, desc: '선봉 배치시 공격력 30% 증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감' },
            { name: '파이어브레스', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '작열스택 부여' },
            { name: '드래곤크로', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리' }
        ]
    },
    {
        id: 'lightning_sage', name: '번개의현자', grade: 'epic', element: 'light', role: 'dealer',
        stats: { hp: 370, atk: 80, matk: 115, def: 60, mdef: 80 },
        trait: { type: 'death_dmg_mag', val: 2.0, desc: '사망시 마법공격력 200% 대미지' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '레인오브썬더', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '디바인소모 개당 2배 추가' },
            { name: '썬더스톰', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '적 디버프당 0.5배 추가' }
        ]
    },
    {
        id: 'flame_sage', name: '화염의현자', grade: 'epic', element: 'fire', role: 'buffer',
        stats: { hp: 380, atk: 75, matk: 105, def: 65, mdef: 80 },
        trait: { type: 'syn_fire_3_crit', val: 20, desc: '불 3장시 치명타 20% 증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 2, cost: 20, desc: '마법공격 무효' },
            { name: '프로미넌스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '작열스택 추가' },
            { name: '태양의축복', type: 'sup', tier: 3, cost: 30, desc: '필드버프 태양의축복 부여' }
        ]
    },
    {
        id: 'avalanche_maid', name: '아발란체메이드', grade: 'epic', element: 'water', role: 'balancer',
        stats: { hp: 410, atk: 90, matk: 90, def: 60, mdef: 60 },
        trait: { type: 'syn_water_3_atk', val: 50, desc: '물 3장시 공격 50% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '빙하의일격', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '부식 부여' },
            { name: '아이스에이지', type: 'mag', tier: 3, cost: 30, val: 3.0, desc: '1~5배 랜덤 공격' }
        ]
    },
    {
        id: 'archangel', name: '대천사', grade: 'epic', element: 'light', role: 'balancer',
        stats: { hp: 400, atk: 70, matk: 95, def: 65, mdef: 80 },
        trait: { type: 'syn_water_light_mdef', val: 50, desc: '물+빛 보유시 마방 50% 증가' },
        skills: [
            { name: '성역전개', type: 'sup', tier: 1, cost: 10, desc: '필드버프 성역 발동' },
            { name: '홀리레이', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '디바인 부여' }
        ]
    },
    {
        id: 'pudding_princess', name: '푸딩프린세스', grade: 'epic', element: 'water', role: 'balancer',
        stats: { hp: 420, atk: 85, matk: 85, def: 60, mdef: 55 },
        trait: { type: 'cond_silence_dmg', val: 1.2, desc: '침묵 대상 대미지 1.2배' },
        skills: [
            { name: '푸딩러쉬', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '약화 부여' },
            { name: '푸딩파라다이스', type: 'mag', tier: 3, cost: 30, val: 1.5, desc: '스타파우더 부여' }
        ]
    },
    {
        id: 'ghost_king', name: '고스트킹', grade: 'epic', element: 'dark', role: 'debuffer',
        stats: { hp: 390, atk: 80, matk: 100, def: 60, mdef: 75 },
        trait: { type: 'syn_dark_3_matk', val: 50, desc: '어둠 3장시 마공 50% 증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '고스트소울', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '디바인+암흑 부여' },
            { name: '네더커스', type: 'sup', tier: 2, cost: 20, desc: '랜덤 디버프 2종' }
        ]
    },

    // --- 레어 (Rare) ---
    {
        id: 'baby_dragon', name: '베이비드래곤', grade: 'rare', element: 'fire', role: 'looter',
        stats: { hp: 340, atk: 90, matk: 80, def: 60, mdef: 50 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '베이비브레스', type: 'mag', tier: 1, cost: 10, val: 1.5, desc: '작열 부여' },
            { name: '드래곤크로', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리' }
        ]
    },
    {
        id: 'chaos_mage', name: '혼돈의마법사', grade: 'rare', element: 'dark', role: 'dealer',
        stats: { hp: 320, atk: 75, matk: 105, def: 50, mdef: 70 },
        trait: { type: 'pos_van_matk', val: 50, desc: '선봉 배치시 마공 50% 증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 2, cost: 20, desc: '마법공격 무효' },
            { name: '카오스카니발', type: 'mag', tier: 3, cost: 30, val: 6.0, desc: '이 카드는 사망한다' },
            { name: '다크니스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '2배 마법' }
        ]
    },
    {
        id: 'fenrir', name: '펜리르', grade: 'rare', element: 'water', role: 'dealer',
        stats: { hp: 360, atk: 95, matk: 70, def: 55, mdef: 40 },
        trait: { type: 'pos_rear_def', val: 30, desc: '대장 배치시 방어 30% 증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '프로스트팽', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '부식 부여' },
            { name: '버서크바이트', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '달의축복시 2배' }
        ]
    },
    {
        id: 'night_rabbit', name: '밤토끼', grade: 'rare', element: 'dark', role: 'dealer',
        stats: { hp: 330, atk: 90, matk: 80, def: 55, mdef: 60 },
        trait: { type: 'cond_silence_dmg', val: 1.2, desc: '침묵 대상 대미지 1.2배' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '깡총깡총', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '어둠 상태시 +0.5배' },
            { name: '문라이트', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '달의축복시 2배' }
        ]
    },
    {
        id: 'light_elemental', name: '라이트엘리멘탈', grade: 'rare', element: 'light', role: 'buffer',
        stats: { hp: 350, atk: 65, matk: 90, def: 55, mdef: 60 },
        trait: { type: 'pos_mid_matk', val: 30, desc: '중견 배치시 마공 30% 증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 2, cost: 20, desc: '마법공격 무효' },
            { name: '문라이트세레나', type: 'sup', tier: 2, cost: 20, desc: '필드버프 달의축복 부여' },
            { name: '선라이트플레임', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '작열스택 부여' }
        ]
    },
    {
        id: 'cream_maid', name: '생크림메이드', grade: 'rare', element: 'light', role: 'buffer',
        stats: { hp: 340, atk: 85, matk: 75, def: 60, mdef: 60 },
        trait: { type: 'cond_twinkle_atk', val: 40, desc: '트윙클파티시 물공 40% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '크림샷', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '디바인 부여' },
            { name: '크림익스플로전', type: 'mag', tier: 2, cost: 20, val: 1.0, desc: '스타파우더 부여' }
        ]
    },
    {
        id: 'golem', name: '골렘', grade: 'rare', element: 'nature', role: 'balancer',
        stats: { hp: 385, atk: 75, matk: 55, def: 70, mdef: 35 },
        trait: { type: 'syn_nature_3_def', val: 50, desc: '자연 3장시 방어 50% 증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감' },
            { name: '차지어택', type: 'phy', tier: 2, cost: 20, val: 2.5, desc: '다음 턴 휴식' },
            { name: '록스매기', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '약화 부여' }
        ]
    },
    {
        id: 'void_knight', name: '공허의기사', grade: 'rare', element: 'dark', role: 'balancer',
        stats: { hp: 360, atk: 90, matk: 70, def: 50, mdef: 50 },
        trait: { type: 'cond_corrosion_dmg', val: 1.2, desc: '부식 대상 대미지 1.2배' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리' },
            { name: '급소베기', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '저주 부여' }
        ]
    },
    {
        id: 'sphinx', name: '스핑크스', grade: 'rare', element: 'nature', role: 'debuffer',
        stats: { hp: 350, atk: 70, matk: 90, def: 50, mdef: 60 },
        trait: { type: 'pos_van_atk', val: 30, desc: '선봉 배치시 공격 30% 증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 2, cost: 20, desc: '마법공격 무효' },
            { name: '샌드스톰', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '부식 or 저주' },
            { name: '수수께끼', type: 'sup', tier: 1, cost: 10, desc: '침묵 부여' }
        ]
    },
    {
        id: 'silent_librarian', name: '침묵의사서', grade: 'rare', element: 'water', role: 'debuffer',
        stats: { hp: 330, atk: 70, matk: 95, def: 55, mdef: 75 },
        trait: { type: 'death_dmg_mag', val: 2.0, desc: '사망시 적 200% 마법뎀' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '사일런트', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '침묵 부여' },
            { name: '위크니스', type: 'sup', tier: 1, cost: 10, desc: '약화 부여' }
        ]
    },

    // --- 일반 (Normal) ---
    {
        id: 'kobold', name: '코볼트', grade: 'normal', element: 'nature', role: 'looter',
        stats: { hp: 300, atk: 85, matk: 60, def: 45, mdef: 45 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '기습', type: 'phy', tier: 1, cost: 10, val: 1.5, desc: '1.5배 물리' },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리' }
        ]
    },
    {
        id: 'werebear', name: '웨어베어', grade: 'normal', element: 'nature', role: 'dealer',
        stats: { hp: 330, atk: 75, matk: 50, def: 55, mdef: 35 },
        trait: { type: 'pos_rear_atk', val: 20, desc: '대장 배치시 공 20% 증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '베어러쉬', type: 'phy', tier: 1, cost: 10, val: 1.0, desc: '약화시 2배' },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리' }
        ]
    },
    {
        id: 'vampire', name: '뱀파이어', grade: 'normal', element: 'dark', role: 'dealer',
        stats: { hp: 300, atk: 55, matk: 80, def: 45, mdef: 55 },
        trait: { type: 'cond_silence_dmg', val: 1.1, desc: '침묵 대상 대미지 1.1배' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '블러드드레인', type: 'mag', tier: 1, cost: 10, val: 1.0, desc: '저주시 2배' },
            { name: '다크니스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '2배 마법' }
        ]
    },
    {
        id: 'snow_rabbit', name: '눈토끼', grade: 'normal', element: 'water', role: 'dealer',
        stats: { hp: 290, atk: 60, matk: 85, def: 40, mdef: 60 },
        trait: { type: 'pos_rear_matk', val: 20, desc: '대장 배치시 마공 20% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '스노우샷', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '부식 부여' },
            { name: '아이스빔', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '2배 마법' }
        ]
    },
    {
        id: 'fairy', name: '페어리', grade: 'normal', element: 'light', role: 'buffer',
        stats: { hp: 300, atk: 55, matk: 75, def: 45, mdef: 60 },
        trait: { type: 'pos_van_mdef', val: 20, desc: '선봉 배치시 마방 20% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 2, cost: 20, desc: '물리공격 무효' },
            { name: '에너지볼', type: 'mag', tier: 1, cost: 10, val: 1.5, desc: '디바인 부여' },
            { name: '스타파우더', type: 'sup', tier: 2, cost: 20, desc: '필드버프 스타파우더' }
        ]
    },
    {
        id: 'candy_boy', name: '캔디보이', grade: 'normal', element: 'light', role: 'buffer',
        stats: { hp: 310, atk: 65, matk: 70, def: 50, mdef: 50 },
        trait: { type: 'syn_light_fire_atk', val: 20, desc: '빛+불 보유시 공 20% 증가' },
        skills: [
            { name: '캔디버스트', type: 'mag', tier: 1, cost: 10, val: 1.5, desc: '작열 부여' },
            { name: '캔디파라다이스', type: 'sup', tier: 2, cost: 20, desc: '필드버프 트윙클파티 발동' }
        ]
    },
    {
        id: 'slime', name: '슬라임', grade: 'normal', element: 'water', role: 'balancer',
        stats: { hp: 340, atk: 60, matk: 60, def: 40, mdef: 40 },
        trait: { type: 'pos_mid_def', val: 10, desc: '중견 배치시 방어 10% 증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '산성액', type: 'mag', tier: 1, cost: 10, val: 1.0, desc: '부식 부여' },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리' }
        ]
    },
    {
        id: 'mummy', name: '미이라', grade: 'normal', element: 'nature', role: 'balancer',
        stats: { hp: 320, atk: 70, matk: 50, def: 60, mdef: 40 },
        trait: { type: 'pos_mid_mdef', val: 10, desc: '중견 배치시 마방 10% 증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '기습', type: 'phy', tier: 1, cost: 10, val: 1.5, desc: '1.5배 물리' },
            { name: '바인드', type: 'sup', tier: 1, cost: 10, desc: '저주 부여' }
        ]
    },
    {
        id: 'mimic', name: '미믹', grade: 'normal', element: 'dark', role: 'debuffer',
        stats: { hp: 310, atk: 70, matk: 70, def: 50, mdef: 45 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감' },
            { name: '기습', type: 'phy', tier: 1, cost: 10, val: 1.5, desc: '1.5배 물리' },
            { name: '다크니스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '2배 마법' }
        ]
    },
    {
        id: 'jack_o_lantern', name: '잭오랜턴', grade: 'normal', element: 'fire', role: 'debuffer',
        stats: { hp: 290, atk: 55, matk: 75, def: 50, mdef: 60 },
        trait: { type: 'pos_van_matk', val: 20, desc: '선봉 배치시 마공 20% 증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가' },
            { name: '저주의불꽃', type: 'mag', tier: 2, cost: 20, val: 1.0, desc: '저주 부여' },
            { name: '침묵의불꽃', type: 'sup', tier: 1, cost: 10, desc: '침묵, 작열 부여' }
        ]
    }
];

const ENEMIES = [
    {
        id: 'demon_god', name: '마신',
        stats: { hp: 1000, atk: 100, matk: 100, def: 70, mdef: 70 },
        skills: [
            { name: '다크니스', type: 'mag', rate: 0.3, val: 2.0, desc: '2배 마법 피해' },
            { name: '기습', type: 'phy', rate: 0.2, val: 1.5, desc: '1.5배 물리 피해' }
        ]
    }
];
