const CARDS = [
    // --- 전설 (Legend) ---
    {
        id: 'deep_lord', name: '심해의주인', grade: 'legend', element: 'water', role: 'dealer',
        stats: { hp: 520, atk: 110, matk: 120, def: 70, mdef: 70 },
        trait: { type: 'syn_water_3_atk_matk', val: 50, desc: '덱에 물 3장일시 물리공격력 마법공격력 50% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '월광해류', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '필드버프 1개 제거하고 위력 2배', effects: [{type: 'remove_field_buff_dmg', mult: 2.0}] },
            { name: '심연의포옹', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '적이 디버프 3개 이상일 때 위력 2배', effects: [{type: 'cond_target_debuff_3_dmg', mult: 2.0}] }
        ]
    },
    {
        id: 'ancient_soul', name: '에인션트소울', grade: 'legend', element: 'fire', role: 'dealer',
        stats: { hp: 510, atk: 115, matk: 130, def: 60, mdef: 60 },
        trait: { type: 'normal_attack_burn_divine', desc: '일반공격시 적에게 작열, 디바인 부여' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '성염', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '필드버프 성역 상태에서 대미지 2배', effects: [{type: 'dmg_boost', condition: 'field_buff', buff: 'sanctuary', mult: 2.0}] },
            { name: '영혼수확', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '적 디버프 1개당 배율 1.5 증가, 사용 후 적 디버프 해제', effects: [{type: 'dmg_boost', condition: 'target_debuff_count_scale', multPerDebuff: 1.5}, {type: 'clear_target_debuffs'}] }
        ]
    },
    {
        id: 'queen', name: '여왕', grade: 'legend', element: 'nature', role: 'looter',
        stats: { hp: 440, atk: 90, matk: 95, def: 55, mdef: 55 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '피날레', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '필드버프를 제거하고 제거한 수 x3.0 만큼 위력 증가', effects: [{type: 'consume_field_all', multPerStack: 3.0}] },
            { name: '로열블룸', type: 'sup', tier: 2, cost: 20, desc: '필드버프 대지의축복 발동', effects: [{type: 'field_buff', id: 'earth_bless'}] }
        ]
    },
    {
        id: 'luna', name: '루나', grade: 'legend', element: 'dark', role: 'dealer',
        stats: { hp: 480, atk: 130, matk: 130, def: 60, mdef: 65 },
        trait: { type: 'cond_no_field_buff_eva_crit', val: 25, desc: '필드버프가 없을 시 회피율/치명타 25%증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '이클립스', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: '암흑 상태의 적에게 대미지 2배', effects: [{type: 'dmg_boost', condition: 'target_debuff', debuff: 'darkness', mult: 2.0}] },
            { name: '다크메테오', type: 'mag', tier: 3, cost: 30, val: 4.5, desc: '다음 턴 행동 불가', effects: [{type: 'self_debuff', id: 'stun', duration: 1}] }
        ]
    },
    {
        id: 'gold_dragon', name: '골드드래곤', grade: 'legend', element: 'light', role: 'dealer',
        stats: { hp: 540, atk: 125, matk: 95, def: 60, mdef: 60 },
        trait: { type: 'pos_stat_boost', pos: 2, stat: ['atk', 'matk'], val: 30, desc: '대장 배치시 공격력 마법공격력 30%증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '얼티밋브레스', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '작열스택 부여, 작열스택 하나당 1.0배율 추가', effects: [{type: 'debuff', id: 'burn', stack: 1}, {type: 'dmg_boost', condition: 'target_stack', debuff: 'burn', multPerStack: 1.0}] },
            { name: '드래곤크로', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리 피해 (자신의 생명력이 100%일시 위력 2배)', effects: [{type: 'dmg_boost', condition: 'hp_full', mult: 2.0, log: 'HP 100% 특수 효과! 위력 2배!'}] }
        ]
    },
    {
        id: 'rumi', name: '루미', grade: 'legend', element: 'water', role: 'buffer',
        stats: { hp: 500, atk: 90, matk: 120, def: 80, mdef: 90 },
        trait: { type: 'syn_water_nature', desc: '덱에 물 자연이 있을 경우, 문라이트세레나에 트윙클파티 필드버프 추가발동' },
        skills: [
            { name: '밀키웨이엑스터시', type: 'mag', tier: 3, cost: 30, val: 3.0, desc: '필드버프 스타파우더 발동', effects: [{type: 'field_buff', id: 'star_powder'}] },
            { name: '문라이트세레나', type: 'sup', tier: 2, cost: 20, desc: '필드버프 달의축복 발동', effects: [{type: 'field_buff', id: 'moon_bless'}] },
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] }
        ]
    },
    {
        id: 'jasmine', name: '자스민', grade: 'legend', element: 'light', role: 'buffer',
        stats: { hp: 500, atk: 90, matk: 125, def: 70, mdef: 80 },
        trait: { type: 'cond_divine_3_dmg', val: 2.0, desc: '디바인 3스택 이상인 적에게 대미지 2배' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '더홀리', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '디바인 스택이 있을 시, 필드버프 성역 발동', effects: [{type: 'conditional_field_buff', condition: 'target_has_debuff', debuff: 'divine', id: 'sanctuary'}] },
            { name: '여신강림', type: 'sup', tier: 3, cost: 30, desc: '필드버프 여신강림 발동', effects: [{type: 'field_buff', id: 'goddess_descent'}] }
        ]
    },
    {
        id: 'world_tree', name: '세계수', grade: 'legend', element: 'nature', role: 'buffer',
        stats: { hp: 600, atk: 90, matk: 90, def: 60, mdef: 60 },
        trait: { type: 'syn_nature_3_all', val: 30, desc: '덱이 전부 자연일 시 공격/마공/방어/마방 30%증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '대지의분노', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '필드버프 대지의축복 발동', effects: [{type: 'field_buff', id: 'earth_bless'}] },
            { name: '가이아포스', type: 'phy', tier: 3, cost: 30, val: 2.0, desc: '필드버프 달의축복 발동', effects: [{type: 'field_buff', id: 'moon_bless'}] }
        ]
    },
    {
        id: 'zeke', name: '지크', grade: 'legend', element: 'fire', role: 'balancer',
        stats: { hp: 550, atk: 120, matk: 100, def: 65, mdef: 45 },
        trait: { type: 'death_field_sun', desc: '사망시 태양의축복 부여' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '이그니스스매시', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '작열스택을 전부 소모하고 소모당 2.0배율 추가', effects: [{type: 'consume_debuff_all', debuff: 'burn', multPerStack: 2.0}] },
            { name: '라그나로크', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: '생명력 50% 아래에서 대미지 2배', effects: [{type: 'dmg_boost', condition: 'hp_below', val: 0.5, mult: 2.0}] }
        ]
    },
    {
        id: 'time_ruler', name: '시간의지배자', grade: 'legend', element: 'dark', role: 'debuffer',
        stats: { hp: 510, atk: 115, matk: 115, def: 65, mdef: 60 },
        trait: { type: 'pos_stat_boost', pos: 1, stat: 'matk', val: 30, desc: '중견 배치시 마공 30%증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '종언의예고', type: 'mag', tier: 3, cost: 30, val: 5.0, desc: '사용 후 3턴 뒤에 공격', effects: [{type: 'delayed_attack', turns: 3}] },
            { name: '섀도우트위스트', type: 'sup', tier: 3, cost: 30, desc: '저주, 침묵, 암흑 부여', effects: [{type: 'debuff', id: 'curse'}, {type: 'debuff', id: 'silence'}, {type: 'debuff', id: 'darkness'}] }
        ]
    },
    {
        id: 'frozen_witch', name: '혹한의마녀', grade: 'legend', element: 'water', role: 'debuffer',
        stats: { hp: 480, atk: 85, matk: 135, def: 70, mdef: 95 },
        trait: { type: 'death_dmg_debuff', val: 1.0, desc: '사망시 적에게 걸려있는 디버프 수 곱하기 1배율 대미지' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '블리자드', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '부식, 침묵, 약화, 저주 부여, 다음 턴 행동 불가', effects: [{type: 'debuff', id: 'corrosion'}, {type: 'debuff', id: 'silence'}, {type: 'debuff', id: 'weak'}, {type: 'debuff', id: 'curse'}, {type: 'self_debuff', id: 'stun', duration: 1}] },
            { name: '프로스트', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '상대에게 적용된 디버프가 5개 이상일 시, 상대 스턴', effects: [{type: 'conditional_debuff', condition: 'target_debuff_count', count: 5, debuff: 'stun'}] }
        ]
    },
    {
        id: 'behemoth', name: '베히모스', grade: 'legend', element: 'nature', role: 'balancer',
        stats: { hp: 560, atk: 115, matk: 90, def: 75, mdef: 55 },
        trait: { type: 'behemoth_trait', val: 1.5, desc: '적이 디버프 3개 이상일 때 대미지 1.5배 / 스킬 사용시 20%확률로 적에게 스턴부여' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '대지분쇄', type: 'phy', tier: 3, cost: 30, val: 3.5, desc: '다음 턴 휴식 (대지의축복 시 위력 2배)', effects: [{type: 'self_debuff', id: 'stun', duration: 1}, {type: 'dmg_boost', condition: 'field_buff', buff: 'earth_bless', mult: 2.0, customLog: "대지의 축복으로 대지분쇄의 위력이 강력해집니다!"}] },
            { name: '어스퀘이크', type: 'mag', tier: 3, cost: 30, val: 3.5, desc: '다음 턴에 공격 (시전자 사망 시 취소)', effects: [{type: 'delayed_attack', turns: 1}] }
        ]
    },

    // --- 에픽 (Epic) ---
    {
        id: 'sun_priestess', name: '태양의무녀', grade: 'epic', element: 'nature', role: 'buffer',
        stats: { hp: 400, atk: 75, matk: 100, def: 65, mdef: 75 },
        trait: { type: 'death_field_buff_count_dmg', val: 2.0, desc: '사망시 적용중인 필드버프수 x2배율 대미지' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '풍요의축제', type: 'sup', tier: 3, cost: 30, desc: '작열스택 소모시 태양의축복, 없을시 대지의축복', effects: [{type: 'consume_all_burn_cond_buff'}] },
            { name: '태양의춤', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '작열 1스택 소모하여 대미지 2배', effects: [{type: 'consume_debuff_fixed', debuff: 'burn', count: 1, mult: 2.0}] }
        ]
    },
    {
        id: 'storm_sage', name: '폭풍의현자', grade: 'epic', element: 'nature', role: 'debuffer',
        stats: { hp: 380, atk: 75, matk: 110, def: 60, mdef: 75 },
        trait: { type: 'syn_nature_3_matk', val: 50, desc: '자연속성 3덱일시 마법공격력 50%증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '러스트브리즈', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '적에게 약화 혹은 부식 부여', effects: [{type: 'random_debuff', count: 1, pool: ['weak', 'corrosion']}] },
            { name: '팬텀게일', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '필드버프 대지의축복이 있을시 적에게 저주와 침묵 부여', effects: [{type: 'conditional_field_debuff', field: 'earth_bless', debuffs: ['curse', 'silence']}] }
        ]
    },
    {
        id: 'shadow_stalker', name: '그림자추적자', grade: 'epic', element: 'dark', role: 'looter',
        stats: { hp: 340, atk: 100, matk: 70, def: 60, mdef: 60 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '암살', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '암흑 부여', effects: [{type: 'debuff', id: 'darkness'}] },
            { name: '어쌔신네일', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: '2.5배 물리', effects: [] }
        ]
    },
    {
        id: 'mawang', name: '마왕', grade: 'epic', element: 'fire', role: 'dealer',
        stats: { hp: 400, atk: 95, matk: 95, def: 60, mdef: 60 },
        trait: { type: 'cond_debuff_3_dmg', val: 1.5, desc: '적이 디버프 3개 이상시 주는 대미지 1.5배' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '데스핸드', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '적에게 걸린 디버프 1종당 0.5배율 추가', effects: [{type: 'dmg_boost', condition: 'target_debuff_count_scale', multPerDebuff: 0.5}] },
            { name: '데몬브레스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '암흑 부여', effects: [{type: 'debuff', id: 'darkness'}] }
        ]
    },
    {
        id: 'red_dragon', name: '레드드래곤', grade: 'epic', element: 'fire', role: 'dealer',
        stats: { hp: 420, atk: 105, matk: 80, def: 60, mdef: 50 },
        trait: { type: 'pos_stat_boost', pos: 0, stat: 'atk', val: 50, desc: '선봉일시 공격력 50%증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '파이어브레스', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '작열스택 부여', effects: [{type: 'debuff', id: 'burn', stack: 1}] },
            { name: '드래곤크로', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리 피해 (자신의 생명력이 100%일시 위력 2배)', effects: [{type: 'dmg_boost', condition: 'hp_full', mult: 2.0, log: 'HP 100% 특수 효과! 위력 2배!'}] }
        ]
    },
    {
        id: 'lightning_sage', name: '번개의현자', grade: 'epic', element: 'light', role: 'dealer',
        stats: { hp: 370, atk: 80, matk: 115, def: 60, mdef: 80 },
        trait: { type: 'death_dmg_mag', val: 3.0, desc: '사망시 마법공격력 300%대미지' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '레인오브썬더', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '디바인스택 전부 소모하고 1개당 2배율 추가', effects: [{type: 'consume_debuff_all', debuff: 'divine', multPerStack: 2.0}] },
            { name: '썬더스톰', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '적 디버프 1종당 0.5배율 추가', effects: [{type: 'dmg_boost', condition: 'target_debuff_count_scale', multPerDebuff: 0.5}] }
        ]
    },
    {
        id: 'flame_sage', name: '화염의현자', grade: 'epic', element: 'fire', role: 'buffer',
        stats: { hp: 380, atk: 75, matk: 105, def: 65, mdef: 80 },
        trait: { type: 'syn_fire_3_crit', val: 30, desc: '덱에 불 3장일시 치명타 확률 30%증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '프로미넌스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '작열스택 추가', effects: [{type: 'debuff', id: 'burn', stack: 1}] },
            { name: '태양의축복', type: 'sup', tier: 3, cost: 30, desc: '필드버프 태양의축복 부여', effects: [{type: 'field_buff', id: 'sun_bless'}] }
        ]
    },
    {
        id: 'avalanche_maid', name: '아발란체메이드', grade: 'epic', element: 'water', role: 'balancer',
        stats: { hp: 410, atk: 95, matk: 90, def: 60, mdef: 60 },
        trait: { type: 'syn_water_3_ice_age', val: 0, desc: '덱에 물 3장일시 아이스에이지 최대배율 대폭 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '빙하의일격', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '부식 부여', effects: [{type: 'debuff', id: 'corrosion'}] },
            { name: '아이스에이지', type: 'mag', tier: 3, cost: 30, val: 3.0, desc: '1~5배율 사이로 랜덤공격 (특성 발동시 1~10배율)', effects: [{type: 'random_mult', min: 1.0, max: 5.0}] }
        ]
    },
    {
        id: 'archangel', name: '대천사', grade: 'epic', element: 'light', role: 'balancer',
        stats: { hp: 400, atk: 70, matk: 95, def: 65, mdef: 80 },
        trait: { type: 'syn_water_light_matk_mdef', val: 30, desc: '덱에 물, 빛이 있을 경우 마법공격력, 마법방어력 30%증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '성역전개', type: 'sup', tier: 2, cost: 20, desc: '필드버프 성역 발동 및 적에게 디바인 1스택 부여', effects: [{type: 'field_buff', id: 'sanctuary'}, {type: 'debuff', id: 'divine', stack: 1}] },
            { name: '홀리레이', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '디바인 부여', effects: [{type: 'debuff', id: 'divine', stack: 1}] }
        ]
    },
    {
        id: 'pudding_princess', name: '푸딩프린세스', grade: 'epic', element: 'water', role: 'balancer',
        stats: { hp: 420, atk: 85, matk: 85, def: 60, mdef: 60 },
        trait: { type: 'cond_silence_dmg', val: 1.5, desc: '침묵 걸린 적에게 대미지 1.5배' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '푸딩러쉬', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '약화 혹은 침묵 부여', effects: [{type: 'random_debuff', count: 1, pool: ['weak', 'silence']}] },
            { name: '푸딩파라다이스', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '필드버프 스타파우더 부여', effects: [{type: 'field_buff', id: 'star_powder'}] }
        ]
    },
    {
        id: 'ghost_king', name: '고스트킹', grade: 'epic', element: 'dark', role: 'debuffer',
        stats: { hp: 390, atk: 80, matk: 100, def: 60, mdef: 75 },
        trait: { type: 'syn_dark_3_matk', val: 50, desc: '덱에 3장 어둠일시 마법공격력 50%증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '고스트소울', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '디바인, 암흑 부여', effects: [{type: 'debuff', id: 'divine', stack: 1}, {type: 'debuff', id: 'darkness'}] },
            { name: '네더커스', type: 'sup', tier: 2, cost: 20, desc: '저주 침묵 약화 부식 중 랜덤 2종 부여', effects: [{type: 'random_debuff', count: 2, pool: ['curse', 'silence', 'weak', 'corrosion']}] }
        ]
    },
    {
        id: 'fairy_queen', name: '페어리퀸', grade: 'epic', element: 'light', role: 'debuffer',
        stats: { hp: 395, atk: 70, matk: 110, def: 60, mdef: 75 },
        trait: { type: 'death_debuff', debuff: 'stun', desc: '사망시 적에게 기절 부여' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '스피릿왈츠', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '적이 디바인 3스택이면 스턴, 아니면 디바인 부여', effects: [{type: 'check_divine_3_stun_else_add'}] },
            { name: '이터널위스퍼', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '랜덤 디버프 1개 (디바인 소모 시 2개)', effects: [{type: 'random_debuff_consume_divine'}] }
        ]
    },

    // --- 레어 (Rare) ---
    {
        id: 'cloud_sheep', name: '구름양', grade: 'rare', element: 'water', role: 'balancer',
        stats: { hp: 350, atk: 85, matk: 85, def: 65, mdef: 55 },
        trait: { type: 'death_debuff', debuff: 'stun', desc: '사망시 상대에게 스턴 부여' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '자장가', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '30%확률로 적에게 스턴 부여', effects: [{type: 'chance_debuff', id: 'stun', chance: 0.3, duration: 1}] },
            { name: '솜사탕', type: 'mag', tier: 3, cost: 30, val: 1.5, desc: '필드버프 트윙클파티 부여', effects: [{type: 'field_buff', id: 'twinkle_party'}] }
        ]
    },
    {
        id: 'baby_dragon', name: '베이비드래곤', grade: 'rare', element: 'fire', role: 'looter',
        stats: { hp: 310, atk: 80, matk: 70, def: 55, mdef: 45 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '베이비브레스', type: 'mag', tier: 1, cost: 10, val: 1.5, desc: '작열부여', effects: [{type: 'debuff', id: 'burn', stack: 1}] },
            { name: '드래곤크로', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리 피해 (자신의 생명력이 100%일시 위력 2배)', effects: [{type: 'dmg_boost', condition: 'hp_full', mult: 2.0, log: 'HP 100% 특수 효과! 위력 2배!'}] }
        ]
    },
    {
        id: 'chaos_mage', name: '혼돈의마법사', grade: 'rare', element: 'dark', role: 'dealer',
        stats: { hp: 320, atk: 75, matk: 105, def: 50, mdef: 70 },
        trait: { type: 'pos_stat_boost', pos: 0, stat: 'matk', val: 50, desc: '선봉배치시 마법공격력 50%증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '카오스카니발', type: 'mag', tier: 3, cost: 30, val: 6.0, desc: '이 카드는 사망한다', effects: [{type: 'suicide'}] },
            { name: '다크니스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '2배 마법', effects: [] }
        ]
    },
    {
        id: 'fenrir', name: '펜리르', grade: 'rare', element: 'water', role: 'dealer',
        stats: { hp: 360, atk: 100, matk: 70, def: 55, mdef: 40 },
        trait: { type: 'pos_stat_boost', pos: 2, stat: ['def', 'mdef'], val: 30, desc: '대장 배치시 방어력/마법방어력 30%증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '프로스트팽', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '부식부여', effects: [{type: 'debuff', id: 'corrosion'}] },
            { name: '윈터하울링', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '달의축복 상태에서 대미지 2.5배', effects: [{type: 'dmg_boost', condition: 'field_buff', buff: 'moon_bless', mult: 2.5, customLog: "윈터하울링: 달의 축복 조건 만족! 대미지 증가!"}] }
        ]
    },
    {
        id: 'night_rabbit', name: '밤토끼', grade: 'rare', element: 'dark', role: 'dealer',
        stats: { hp: 330, atk: 90, matk: 80, def: 55, mdef: 60 },
        trait: { type: 'syn_snow_rabbit', val: 50, desc: '눈토끼 혹은 은토끼가 덱에 있을시 물공 물방 50% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '깡총깡총', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '어둠 상태시 대미지 2배', effects: [{type: 'dmg_boost', condition: 'target_debuff', debuff: 'darkness', mult: 2.0}] },
            { name: '문라이트', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '달의축복 상태에서 대미지 2.5배', effects: [{type: 'dmg_boost', condition: 'field_buff', buff: 'moon_bless', mult: 2.5}] }
        ]
    },
    {
        id: 'light_elemental', name: '라이트엘리멘탈', grade: 'rare', element: 'light', role: 'buffer',
        stats: { hp: 350, atk: 65, matk: 90, def: 55, mdef: 60 },
        trait: { type: 'pos_stat_boost', pos: 1, stat: 'matk', val: 30, desc: '중견 배치시 마법공격력 30%증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '문라이트세레나', type: 'sup', tier: 2, cost: 20, desc: '필드버프 달의축복 부여', effects: [{type: 'field_buff', id: 'moon_bless'}] },
            { name: '선라이트플레임', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '작열스택 부여', effects: [{type: 'debuff', id: 'burn', stack: 1}] }
        ]
    },
    {
        id: 'cream_maid', name: '생크림메이드', grade: 'rare', element: 'light', role: 'buffer',
        stats: { hp: 340, atk: 75, matk: 85, def: 60, mdef: 60 },
        trait: { type: 'cond_twinkle_all', val: 30, desc: '트윙클파티 상태에서 물리/마법공격력 30%증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '크림샷', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '디바인 부여', effects: [{type: 'debuff', id: 'divine', stack: 1}] },
            { name: '크림익스플로전', type: 'mag', tier: 2, cost: 20, val: 1.0, desc: '필드버프 스타파우더 부여', effects: [{type: 'field_buff', id: 'star_powder'}] }
        ]
    },
    {
        id: 'golem', name: '골렘', grade: 'rare', element: 'nature', role: 'balancer',
        stats: { hp: 385, atk: 75, matk: 55, def: 80, mdef: 40 },
        trait: { type: 'syn_nature_3_golem', val: 30, desc: '덱에 자연 3장일시 공격력 방어력 30%증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '차지어택', type: 'phy', tier: 2, cost: 20, val: 2.5, desc: '다음턴 휴식 (대지의축복 시 2배)', effects: [{type: 'self_debuff', id: 'stun', duration: 1}, {type: 'dmg_boost', condition: 'field_buff', buff: 'earth_bless', mult: 2.0}] },
            { name: '록스매시', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '약화 부여', effects: [{type: 'debuff', id: 'weak'}] }
        ]
    },
    {
        id: 'void_knight', name: '공허의기사', grade: 'rare', element: 'dark', role: 'balancer',
        stats: { hp: 360, atk: 100, matk: 50, def: 60, mdef: 55 },
        trait: { type: 'cond_corrosion_dmg', val: 1.5, desc: '부식상태의 적에게 대미지 1.5배' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리', effects: [] },
            { name: '급소베기', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '저주 부여', effects: [{type: 'debuff', id: 'curse'}] }
        ]
    },
    {
        id: 'sphinx', name: '스핑크스', grade: 'rare', element: 'nature', role: 'debuffer',
        stats: { hp: 350, atk: 80, matk: 80, def: 50, mdef: 60 },
        trait: { type: 'pos_van_atk', val: 30, desc: '선봉 배치시 공격력 30%증가' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '샌드스톰', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '부식 저주 중 하나 부여', effects: [{type: 'random_debuff', count: 1, pool: ['corrosion', 'curse']}] },
            { name: '수수께끼', type: 'sup', tier: 1, cost: 10, desc: '침묵 부여', effects: [{type: 'debuff', id: 'silence'}] }
        ]
    },
    {
        id: 'silent_librarian', name: '침묵의사서', grade: 'rare', element: 'water', role: 'debuffer',
        stats: { hp: 330, atk: 70, matk: 95, def: 55, mdef: 75 },
        trait: { type: 'death_dmg_mag', val: 2.0, desc: '사망시 적에게 200% 마법대미지' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '사일런트', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '침묵 부여', effects: [{type: 'debuff', id: 'silence'}] },
            { name: '위크니스', type: 'sup', tier: 1, cost: 10, desc: '약화 부여', effects: [{type: 'debuff', id: 'weak'}] }
        ]
    },
    {
        id: 'mirage', name: '신기루', grade: 'rare', element: 'fire', role: 'debuffer',
        stats: { hp: 345, atk: 80, matk: 80, def: 55, mdef: 65 },
        trait: { type: 'death_debuff', debuff: 'darkness', desc: '사망시 암흑 부여' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '미라지프레임', type: 'mag', tier: 3, cost: 30, val: 1.5, desc: '작열, 약화 부여', effects: [{type: 'debuff', id: 'burn', stack: 1}, {type: 'debuff', id: 'weak'}] },
            { name: '팬텀러쉬', type: 'phy', tier: 3, cost: 30, val: 1.5, desc: '작열, 저주 부여', effects: [{type: 'debuff', id: 'burn', stack: 1}, {type: 'debuff', id: 'curse'}] }
        ]
    },

    // --- 일반 (Normal) ---
    {
        id: 'marshmallow', name: '마시멜로', grade: 'normal', element: 'fire', role: 'balancer',
        stats: { hp: 310, atk: 75, matk: 70, def: 50, mdef: 50 },
        trait: { type: 'death_sun_bless_chance', val: 0.3, desc: '사망시 30%확률로 태양의축복 부여' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '기습', type: 'phy', tier: 1, cost: 10, val: 1.5, desc: '1.5배 물리', effects: [] },
            { name: '멜팅허그', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '적에게 작열 부여', effects: [{type: 'debuff', id: 'burn', stack: 1}] }
        ]
    },
    {
        id: 'kobold', name: '코볼트', grade: 'normal', element: 'nature', role: 'looter',
        stats: { hp: 270, atk: 75, matk: 55, def: 40, mdef: 40 },
        trait: { type: 'looter', desc: '이 카드로 승리시 추가 드로우' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '기습', type: 'phy', tier: 1, cost: 10, val: 1.5, desc: '1.5배 물리', effects: [] },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리', effects: [] }
        ]
    },
    {
        id: 'werebear', name: '웨어베어', grade: 'normal', element: 'nature', role: 'dealer',
        stats: { hp: 330, atk: 80, matk: 50, def: 55, mdef: 35 },
        trait: { type: 'pos_rear_atk', val: 30, desc: '대장 배치시 공격력 30%증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '베어러쉬', type: 'phy', tier: 1, cost: 10, val: 1.0, desc: '상대가 약화시 3배', effects: [{type: 'dmg_boost', condition: 'target_debuff', debuff: 'weak', mult: 3.0}] },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리', effects: [] }
        ]
    },
    {
        id: 'vampire', name: '뱀파이어', grade: 'normal', element: 'dark', role: 'dealer',
        stats: { hp: 300, atk: 55, matk: 80, def: 45, mdef: 55 },
        trait: { type: 'cond_silence_dmg', val: 1.5, desc: '침묵상태 적에게 대미지 1.5배' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '블러드드레인', type: 'mag', tier: 1, cost: 10, val: 1.0, desc: '상대가 저주시 3배', effects: [{type: 'dmg_boost', condition: 'target_debuff', debuff: 'curse', mult: 3.0}] },
            { name: '다크니스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '2배 마법', effects: [] }
        ]
    },
    {
        id: 'snow_rabbit', name: '눈토끼', grade: 'normal', element: 'water', role: 'dealer',
        stats: { hp: 290, atk: 60, matk: 85, def: 40, mdef: 60 },
        trait: { type: 'syn_night_rabbit', val: 50, desc: '밤토끼 혹은 은토끼가 덱에 있을시 마공 마방 50% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '스노우샷', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '부식 부여', effects: [{type: 'debuff', id: 'corrosion'}] },
            { name: '실버스톰', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '밤토끼/은토끼 시너지 발동 중 대미지 2배', effects: [{type: 'dmg_boost', condition: 'synergy_active', trait: 'syn_night_rabbit', mult: 2.0}] }
        ]
    },
    {
        id: 'silver_rabbit', name: '은토끼', grade: 'normal', element: 'light', role: 'dealer',
        stats: { hp: 300, atk: 70, matk: 70, def: 60, mdef: 60 },
        trait: { type: 'syn_silver_rabbit', val: 50, desc: '눈토끼 혹은 밤토끼가 덱에 있을시 물공 마공 50% 증가' },
        skills: [
            { name: '헤븐리루어', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '특성 발동 중 대미지 2배', effects: [{type: 'dmg_boost', condition: 'synergy_active', trait: 'syn_silver_rabbit', mult: 2.0}] },
            { name: '깡총깡총', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '어둠 상태시 대미지 2배', effects: [{type: 'dmg_boost', condition: 'target_debuff', debuff: 'darkness', mult: 2.0}] },
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] }
        ]
    },
    {
        id: 'fairy', name: '페어리', grade: 'normal', element: 'light', role: 'buffer',
        stats: { hp: 300, atk: 55, matk: 75, def: 45, mdef: 60 },
        trait: { type: 'pos_stat_boost', pos: 0, stat: 'mdef', val: 20, desc: '선봉 배치시 마방 20%증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '에너지볼', type: 'mag', tier: 1, cost: 10, val: 1.5, desc: '디바인 부여', effects: [{type: 'debuff', id: 'divine', stack: 1}] },
            { name: '스타파우더', type: 'sup', tier: 2, cost: 20, desc: '필드버프 스타파우더 발동', effects: [{type: 'field_buff', id: 'star_powder'}] }
        ]
    },
    {
        id: 'candy_boy', name: '캔디보이', grade: 'normal', element: 'light', role: 'buffer',
        stats: { hp: 310, atk: 65, matk: 70, def: 50, mdef: 50 },
        trait: { type: 'syn_light_fire_atk', val: 30, desc: '덱에 빛 불이 있을시 공격 30%증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '캔디버스트', type: 'mag', tier: 1, cost: 10, val: 1.5, desc: '작열 부여', effects: [{type: 'debuff', id: 'burn', stack: 1}] },
            { name: '캔디파라다이스', type: 'sup', tier: 2, cost: 20, desc: '필드버프 트윙클파티 발동', effects: [{type: 'field_buff', id: 'twinkle_party'}] }
        ]
    },
    {
        id: 'slime', name: '슬라임', grade: 'normal', element: 'water', role: 'balancer',
        stats: { hp: 340, atk: 60, matk: 60, def: 45, mdef: 45 },
        trait: { type: 'pos_stat_boost', pos: 1, stat: 'def', val: 30, desc: '중견 배치시 방어 30%증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '산성액', type: 'mag', tier: 1, cost: 10, val: 1.0, desc: '부식부여', effects: [{type: 'debuff', id: 'corrosion'}] },
            { name: '강타', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '2배 물리', effects: [] }
        ]
    },
    {
        id: 'mummy', name: '미이라', grade: 'normal', element: 'nature', role: 'balancer',
        stats: { hp: 320, atk: 70, matk: 50, def: 65, mdef: 40 },
        trait: { type: 'pos_stat_boost', pos: 1, stat: 'mdef', val: 30, desc: '중견 배치시 마방 30%증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '기습', type: 'phy', tier: 1, cost: 10, val: 1.5, desc: '1.5배 물리', effects: [] },
            { name: '바인드', type: 'sup', tier: 1, cost: 10, desc: '저주 부여', effects: [{type: 'debuff', id: 'curse'}] }
        ]
    },
    {
        id: 'mimic', name: '미믹', grade: 'normal', element: 'dark', role: 'debuffer',
        stats: { hp: 310, atk: 70, matk: 70, def: 50, mdef: 45 },
        trait: { type: 'looter', desc: '이 카드로 승리 시 추가 드로우' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '기습', type: 'phy', tier: 1, cost: 10, val: 1.5, desc: '1.5배 물리', effects: [] },
            { name: '다크니스', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '2배 마법', effects: [] }
        ]
    },
    {
        id: 'jack_o_lantern', name: '잭오랜턴', grade: 'normal', element: 'fire', role: 'debuffer',
        stats: { hp: 290, atk: 55, matk: 75, def: 50, mdef: 60 },
        trait: { type: 'pos_stat_boost', pos: 0, stat: 'matk', val: 20, desc: '선봉 배치시 마공 20%증가' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '저주의불꽃', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '저주 부여', effects: [{type: 'debuff', id: 'curse'}] },
            { name: '침묵의불꽃', type: 'sup', tier: 1, cost: 10, desc: '침묵, 작열 부여', effects: [{type: 'debuff', id: 'silence'}, {type: 'debuff', id: 'burn', stack: 1}] }
        ]
    },
    {
        id: 'joker', name: '조커', grade: 'normal', element: 'nature', role: 'balancer',
        stats: { hp: 280, atk: 70, matk: 70, def: 45, mdef: 45 },
        trait: { type: 'joker_wild', desc: '이 카드는 모든 속성, 모든 이름으로 취급' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '레인보우룰렛', type: 'sup', tier: 10, cost: 100, desc: '모든 필드버프 교체', effects: [{type: 'roulette_field'}] },
            { name: '와일드카드', type: 'sup', tier: 10, cost: 100, desc: '적의 디버프를 모두 제거하고 랜덤 디버프 2종 부여', effects: [{type: 'wild_card_debuff'}] }
        ]
    }
];

const BONUS_CARDS = [
    {
        id: 'phoenix', name: '피닉스', grade: 'legend', element: 'fire', role: 'buffer',
        stats: { hp: 510, atk: 130, matk: 90, def: 75, mdef: 70 },
        trait: { type: 'syn_fire_3_crit_burn', val: 50, desc: '덱에 불 3장 이상 시 치명타율 50% 증가 / 일반 공격 시 작열 부여' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '메테오임팩트', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: '필드버프 트윙클파티 발동', effects: [{type: 'field_buff', id: 'twinkle_party'}] },
            { name: '샤이닝플레임', type: 'mag', tier: 3, cost: 30, val: 1.0, desc: '필드버프 태양의축복 발동', effects: [{type: 'field_buff', id: 'sun_bless'}] }
        ]
    },
    {
        id: 'priest_of_end', name: '종말의사제', grade: 'epic', element: 'dark', role: 'buffer',
        stats: { hp: 400, atk: 55, matk: 105, def: 80, mdef: 80 },
        trait: { type: 'syn_dark_3_matk_boost', val: 100, desc: '덱에 어둠 3장 이상 시 마법공격력 100% 증가' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '사신강림', type: 'mag', tier: 3, cost: 30, val: 5.0, desc: '5턴 뒤 발동, 발동 시 필드버프 사신강림 부여', effects: [{type: 'delayed_attack_field', turns: 5, field: 'reaper_realm'}] }
        ]
    },
    {
        id: 'gray', name: '그레이', grade: 'legend', element: 'dark', role: 'dealer',
        stats: { hp: 480, atk: 145, matk: 125, def: 65, mdef: 65 },
        trait: { type: 'crit_ignore_def_add', val: 0.5, desc: '치명타 시 적 방어력 50% 추가 무시' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '영혼절단', type: 'mag', tier: 3, cost: 30, val: 2.0, desc: '2~4배율 랜덤 (달의축복 시 2~10배율)', effects: [{type: 'random_mult_moon_boost', min: 2.0, max: 4.0, boostMax: 10.0}] },
            { name: '차원절단', type: 'phy', tier: 3, cost: 30, val: 3.0, desc: '2턴 뒤 발동, 3~6배율 랜덤 공격', effects: [{type: 'delayed_random_attack', turns: 2, min: 3.0, max: 6.0}] }
        ]
    },
    {
        id: 'unicorn', name: '유니콘', grade: 'epic', element: 'light', role: 'looter',
        stats: { hp: 360, atk: 90, matk: 65, def: 65, mdef: 70 },
        trait: { type: 'looter', desc: '이 카드로 승리 시 추가 드로우' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '홀리차지', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '디바인 부여', effects: [{type: 'debuff', id: 'divine', stack: 1}] },
            { name: '실버문베일', type: 'sup', tier: 3, cost: 30, desc: '필드버프 달의축복 발동', effects: [{type: 'field_buff', id: 'moon_bless'}] }
        ]
    },
    {
        id: 'hellhound', name: '헬하운드', grade: 'rare', element: 'fire', role: 'balancer',
        stats: { hp: 370, atk: 100, matk: 75, def: 45, mdef: 55 },
        trait: { type: 'death_twinkle', desc: '사망 시 필드버프 트윙클파티 발동' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '섀도우러쉬', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '약화 부여', effects: [{type: 'debuff', id: 'weak'}] },
            { name: '헬바이트', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '작열 모두 소모, 소모한 개수당 2.0배율 추가', effects: [{type: 'consume_debuff_all', debuff: 'burn', multPerStack: 2.0}] }
        ]
    },
    {
        id: 'siren', name: '세이렌', grade: 'rare', element: 'water', role: 'buffer',
        stats: { hp: 345, atk: 60, matk: 95, def: 60, mdef: 75 },
        trait: { type: 'syn_water_2_moon_twinkle', desc: '덱에 물 2장 이상 시, 실버문베일 발동 시 트윙클파티 추가 발동' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '실버문베일', type: 'sup', tier: 3, cost: 30, desc: '필드버프 달의축복 발동', effects: [{type: 'field_buff', id: 'moon_bless'}] },
            { name: '타이달스크림', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '침묵 부여', effects: [{type: 'debuff', id: 'silence'}] }
        ]
    },
    {
        id: 'shadow_cat', name: '섀도우캣', grade: 'normal', element: 'dark', role: 'debuffer',
        stats: { hp: 300, atk: 85, matk: 50, def: 55, mdef: 55 },
        trait: { type: 'death_debuff', debuff: 'darkness', desc: '사망 시 암흑 부여' },
        skills: [
            { name: '회피태세', type: 'sup', tier: 1, cost: 10, desc: '회피율 50% 증가', effects: [{type: 'buff', id: 'evasion', duration: 1}] },
            { name: '사일런트스텝', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '반드시 치명타로 적중', effects: [{type: 'force_crit'}] },
            { name: '베놈슬래시', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '부식 부여', effects: [{type: 'debuff', id: 'corrosion'}] }
        ]
    },
    {
        id: 'mushroom_king', name: '머쉬룸킹', grade: 'epic', element: 'nature', role: 'dealer',
        stats: { hp: 400, atk: 100, matk: 80, def: 80, mdef: 60 },
        trait: { type: 'cond_earth_def_mdef', val: 50, desc: '대지의축복 상태에서 방어력/마법방어력 50% 증가' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '그랜드슬램', type: 'phy', tier: 3, cost: 30, val: 2.5, desc: '적 생명력이 50% 이하일 때 위력 2배', effects: [{type: 'dmg_boost', condition: 'target_hp_below', val: 0.5, mult: 2.0}] },
            { name: '스포어미스트', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '자신의 생명력이 25% 이하일 때 위력 4배', effects: [{type: 'dmg_boost', condition: 'hp_below', val: 0.25, mult: 4.0}] }
        ]
    },
    {
        id: 'fallen_angel', name: '타천사', grade: 'rare', element: 'dark', role: 'dealer',
        stats: { hp: 340, atk: 65, matk: 100, def: 55, mdef: 60 },
        trait: { type: 'cond_darkness_dmg', val: 1.5, desc: '암흑 상태의 적에게 대미지 1.5배' },
        skills: [
            { name: '배리어', type: 'sup', tier: 1, cost: 10, desc: '물리공격 무효', effects: [{type: 'buff', id: 'barrier', duration: 1}] },
            { name: '다크레이', type: 'mag', tier: 2, cost: 20, val: 2.0, desc: '디바인 1스택 소모하여 대미지 2배', effects: [{type: 'consume_debuff_fixed', debuff: 'divine', count: 1, mult: 2.0}] },
            { name: '타락의낙인', type: 'phy', tier: 2, cost: 20, val: 1.5, desc: '디바인 1스택 소모하고 암흑 부여', effects: [{type: 'consume_divine_add_darkness'}] }
        ]
    },
    {
        id: 'cinderella', name: '신데렐라', grade: 'legend', element: 'light', role: 'debuffer',
        stats: { hp: 490, atk: 110, matk: 120, def: 75, mdef: 75 },
        trait: { type: 'ignore_def_mdef_by_stack', val: 0.1, desc: '작열 1스택당 방어력 10% 무시 / 디바인 1스택당 마법방어력 10% 무시' },
        skills: [
            { name: '매직가드', type: 'sup', tier: 1, cost: 10, desc: '마법공격 무효', effects: [{type: 'buff', id: 'magic_guard', duration: 1}] },
            { name: '크리스탈킥', type: 'phy', tier: 2, cost: 20, val: 2.0, desc: '작열 부여 및 약화/부식 중 하나 추가 부여', effects: [{type: 'debuff', id: 'burn', stack: 1}, {type: 'random_debuff', count: 1, pool: ['weak', 'corrosion']}] },
            { name: '미드나잇스펠', type: 'mag', tier: 3, cost: 30, val: 2.5, desc: '디바인 부여 및 침묵/저주 중 하나 추가 부여', effects: [{type: 'debuff', id: 'divine', stack: 1}, {type: 'random_debuff', count: 1, pool: ['silence', 'curse']}] }
        ]
    },
    {
        id: 'snow_penguin', name: '눈꽃펭귄', grade: 'normal', element: 'water', role: 'debuffer',
        stats: { hp: 300, atk: 80, matk: 70, def: 50, mdef: 50 },
        trait: { type: 'death_debuff', debuff: 'weak', desc: '사망 시 적에게 약화 부여' },
        skills: [
            { name: '가드', type: 'sup', tier: 1, cost: 10, desc: '대미지 반감', effects: [{type: 'buff', id: 'guard', duration: 1}] },
            { name: '제트슬라이드', type: 'phy', tier: 3, cost: 30, val: 2.0, desc: '기절한 적에게 대미지 5배', effects: [{type: 'dmg_boost', condition: 'target_debuff', debuff: 'stun', mult: 5.0}] },
            { name: '콜드웨이크', type: 'mag', tier: 2, cost: 20, val: 1.5, desc: '저주 혹은 침묵 부여', effects: [{type: 'random_debuff', count: 1, pool: ['curse', 'silence']}] }
        ]
    }
];

const ENEMIES = [
    {
        id: 'artificial_demon_god', name: '인조 마신', element: 'water',
        stats: { hp: 600, atk: 50, matk: 50, def: 60, mdef: 60 },
        skills: [
            { name: '아이스빔', type: 'mag', rate: 0.3, val: 1.5, desc: '1.5배 마법 피해', effects: [] },
            { name: '파괴의형태', type: 'mag', rate: 0.0, val: 4.0, desc: '10턴째 4배 마법', effects: [] }
        ]
    },
    {
        id: 'iris_love', name: '사랑의 여신 아이리스', element: 'light',
        stats: { hp: 800, atk: 40, matk: 70, def: 50, mdef: 80 },
        skills: [
            { name: '홀리레이', type: 'mag', rate: 0.3, val: 2.0, desc: '2배 마법 피해', effects: [] },
            { name: '더홀리', type: 'mag', rate: 0.1, val: 3.5, desc: '3.5배 마법 피해', effects: [] },
            { name: '소울드레인', type: 'mag', rate: 0.0, val: 0, desc: '7턴째 마나 제거', effects: [{type: 'mana_burn', val: 100}] }
        ]
    },
    {
        id: 'iris_curse', name: '저주의 여신 아이리스', element: 'fire',
        stats: { hp: 1000, atk: 90, matk: 60, def: 90, mdef: 60 },
        skills: [
            { name: '프레임샷', type: 'mag', rate: 0.3, val: 2.0, desc: '2배 마법 피해', effects: [] },
            { name: '아포칼립스', type: 'phy', rate: 0.0, val: 5.0, desc: '10턴째 5배 물리', effects: [] }
        ]
    },
    {
        id: 'pharaoh', name: '고대신 파라오', element: 'nature',
        stats: { hp: 1200, atk: 90, matk: 90, def: 90, mdef: 90 },
        skills: [
            { name: '고대의힘', type: 'mag', rate: 0.3, val: 2.0, desc: '2배 마법 피해', effects: [] },
            { name: '고대의저주', type: 'mag', rate: 0.0, val: 1.0, desc: '5턴 주기 공격', effects: [] }
        ]
    },
    {
        id: 'demon_god', name: '마신', element: 'dark',
        stats: { hp: 1400, atk: 110, matk: 110, def: 100, mdef: 100 },
        skills: [
            { name: '다크니스', type: 'mag', rate: 0.2, val: 2.0, desc: '2배 마법 피해', effects: [] },
            { name: '데스핸드', type: 'phy', rate: 0.0, val: 2.0, desc: '기본 2배 (디버프 비례)', effects: [] },
            { name: '제노사이드', type: 'phy', rate: 0.0, val: 3.5, desc: '7/14턴 3.5배 물리', effects: [] }
        ]
    },
    {
        id: 'creator_god', name: '창조신 아스테아', element: 'light',
        stats: { hp: 1600, atk: 120, matk: 140, def: 110, mdef: 110 },
        skills: [
            { name: '저지먼트', type: 'mag', rate: 0.0, val: 3.5, desc: '강력한 마법', effects: [] },
            { name: '디바인블레이드', type: 'phy', rate: 0.0, val: 4.0, desc: '1턴 차지 후 4배 물리', effects: [] },
            { name: '홀리레이', type: 'mag', rate: 0.2, val: 2.0, desc: '2배 마법', effects: [] }
        ]
    }
];
