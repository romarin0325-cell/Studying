/* =========================================
   1. 데이터베이스 (Content Data)
   ========================================= */

const EQUIP_COSTS = [1000, 3000, 5000, 10000, 20000, 30000, 70000];

const EQUIP_STATS = {
    zeke: {
        weapon: [
            {atk:20,matk:15}, {atk:30,matk:25}, {atk:45,matk:35},
            {atk:70,matk:55}, {atk:100,matk:80}, {atk:130,matk:100}, {atk:180,matk:125}
        ],
        armor: [
            {def:10,mdef:5}, {def:20,mdef:10}, {def:40,mdef:20},
            {def:60,mdef:30}, {def:90,mdef:50}, {def:110,mdef:80}, {def:130,mdef:95}
        ]
    },
    jasmine: {
        weapon: [
            {atk:15,matk:20}, {atk:25,matk:40}, {atk:35,matk:60},
            {atk:50,matk:90}, {atk:70,matk:120}, {atk:90,matk:160}, {atk:125,matk:210}
        ],
        armor: [
            {def:5,mdef:10}, {def:5,mdef:10}, {def:15,mdef:30},
            {def:25,mdef:50}, {def:45,mdef:90}, {def:55,mdef:120}, {def:65,mdef:170}
        ]
    },
    luna: {
        weapon: [
            {atk:15,matk:15}, {atk:30,matk:20}, {atk:35,matk:40},
            {atk:60,matk:55}, {atk:90,matk:85}, {atk:120,matk:115}, {atk:175,matk:160}
        ],
        armor: [
            {def:5,mdef:5}, {def:20,mdef:15}, {def:25,mdef:25},
            {def:40,mdef:45}, {def:60,mdef:70}, {def:80,mdef:90}, {def:100,mdef:100}
        ]
    },
    queen: {
        weapon: [
            {atk:15,matk:15}, {atk:30,matk:30}, {atk:45,matk:45},
            {atk:70,matk:70}, {atk:95,matk:95}, {atk:140,matk:140}, {atk:190,matk:190}
        ],
        armor: [
            {def:10,mdef:10}, {def:25,mdef:25}, {def:35,mdef:35},
            {def:50,mdef:50}, {def:65,mdef:65}, {def:80,mdef:80}, {def:110,mdef:110}
        ]
    },
    rumi: {
        weapon: [
            {atk:15,matk:20}, {atk:25,matk:35}, {atk:35,matk:50},
            {atk:55,matk:75}, {atk:80,matk:110}, {atk:110,matk:145}, {atk:145,matk:185}
        ],
        armor: [
            {def:10,mdef:10}, {def:20,mdef:20}, {def:30,mdef:30},
            {def:50,mdef:50}, {def:70,mdef:70}, {def:95,mdef:95}, {def:120,mdef:120}
        ]
    }
};

const BASE_ARTIFACTS = [
    { id: 'vit_stone', name: "생명의 돌", desc: "최대 HP +20%", effect: 'stat_hp', val: 0.2 },
    { id: 'mana_crys', name: "마나 수정", desc: "최대 MP +20%", effect: 'stat_mp', val: 0.2 },
    { id: 'str_ring', name: "전사의 반지", desc: "물리 공격 +10%", effect: 'stat_atk', val: 0.1 },
    { id: 'wis_ring', name: "현자의 반지", desc: "마법 공격 +10%", effect: 'stat_matk', val: 0.1 },
    { id: 'iron_shield', name: "강철 방패", desc: "물리 방어 +10%", effect: 'stat_def', val: 0.1 },
    { id: 'magic_cloak', name: "마법 망토", desc: "마법 방어 +10%", effect: 'stat_mdef', val: 0.1 },
    { id: 'eagle_eye', name: "매의 눈", desc: "치명타 확률 +15%", effect: 'stat_crit', val: 0.15 },
    { id: 'wind_boots', name: "바람의 장화", desc: "회피율 +5%", effect: 'stat_eva', val: 0.05 },
    { id: 'gold_pocket', name: "황금 주머니", desc: "골드 획득 +20%", effect: 'gold_up', val: 0.2 },
    { id: 'mana_gem', name: "시작의 보석", desc: "시작 MP +30", effect: 'start_mp', val: 30 },
    { id: 'cursed_sword', name: "저주받은 검", desc: "피해량 +30%, 받는 피해 +20%", effect: 'high_risk_dmg', val: 0.3 },
    { id: 'blood_pact', name: "피의 계약", desc: "최대 HP -20%, ATK/MATK +20%", effect: 'blood_pact', val: 0.2 },
    { id: 'reckless', name: "무모한 돌진", desc: "방어 -30%, 치명타 피해 +80%", effect: 'reckless', val: 0.8 },
    { id: 'mask_madness', name: "광기의 가면", desc: "주는 피해 +100%, 받는 피해 +50%", effect: 'high_risk_dmg_ex', val: 1.0 },
    { id: 'vampire', name: "흡혈의 이빨", desc: "가한 피해의 5% 회복", effect: 'vampire', val: 0.05 },
    { id: 'mana_engine', name: "마나 엔진", desc: "턴 종료 시 MP +10", effect: 'mana_engine', val: 10 },
    { id: 'thorns', name: "가시 갑옷", desc: "받은 물리 피해 10% 반사", effect: 'reflect_phy', val: 0.1 },
    { id: 'guardian_angel', name: "수호천사의 깃털", desc: "사망 시 1회 부활 (HP 50%)", effect: 'revive_once', val: 0.5, rarity: 'epic' },
    { id: 'dragon_heart', name: "용의 심장", desc: "최대 HP +40%, 물리공격 +20%", effect: 'dragon_heart', val: 0.4 },
    { id: 'ancient_book', name: "고대의 마도서", desc: "최대 MP +40%, 마법공격 +20%", effect: 'ancient_book', val: 0.4 },
    { id: 'golden_sun', name: "황금의 태양", desc: "공/마공 +30%, 마법방어 -20%", effect: 'golden_sun', val: 0.30, rarity: 'epic' },
    { id: 'beelzebub', name: "마신기 벨제뷔트", desc: "공격/치명피해 +50%, 방어 -30%", effect: 'beelzebub', val: 0.5, rarity: 'epic' },
    { id: 'iris', name: "신기 아이리스", desc: "마공/마방 +50%", effect: 'iris', val: 0.5, rarity: 'epic' },
    { id: 'royal_crown', name: "로열 크라운", desc: "모든 능력치 +20% (여왕: 시작시 장미+5)", effect: 'all_stat', val: 0.2, rarity: 'epic' }
];

const NEW_ARTIFACTS = {
    zeke: { id: 'will_protect', name: "수호의 의지", desc: "방어력/마법방어력 +30%", effect: 'stat_def_mdef', val: 0.3 },
    luna: { id: 'moon_neck', name: "월광의 목걸이", desc: "치명타율 +10%, 치명타피해 +30%", effect: 'crit_critdmg', val: 0.3 },
    jasmine: { id: 'old_diary', name: "오래된 일기장", desc: "마법공격력/최대MP +30%", effect: 'matk_mp', val: 0.3 },
    queen: { id: 'queen_crest', name: "여왕의 문양", desc: "공격력/마법공격력 +30%", effect: 'atk_matk', val: 0.3 },
    rumi: { id: 'precious_dream', name: "소중한 꿈", desc: "공격력/생명력 +30%", effect: 'atk_hp', val: 0.3 }
};

const BOSS_DROP_ARTIFACTS = {
    mashin: { id: 'demon_eye', name: "마안", desc: "전투 개시 후 4턴간 물공/마공 +100%", effect: 'demon_eye', val: 1.0, rarity: 'epic' },
    witch: { id: 'heart_ice', name: "얼음의 심장", desc: "체력 50% 미만에서 물방/마방 +100%", effect: 'heart_ice', val: 1.0, rarity: 'epic' },
    goddess: { id: 'hestia', name: "신기 에스티아", desc: "모든 스탯 +100%", effect: 'hestia', val: 1.0, rarity: 'legend' },
    pudding: { id: 'dream_choco', name: "드림 초콜릿", desc: "공격력/마법공격력 +70%", effect: 'dream_choco', val: 0.7, rarity: 'legend' },
    artificial: { id: 'blue_moon', name: "신기 블루문", desc: "최대 MP +20%, 전투 시작시 MP +100", effect: 'blue_moon', val: 0.2, rarity: 'legend' }
};

let ARTIFACTS = JSON.parse(JSON.stringify(BASE_ARTIFACTS));

const CHAR_DATA = {
    luna: {
        name: "루나", hp: 540, mp: 100, mpRegen: 10, atk: 65, matk: 55, def: 30, mdef: 35, baseCrit: 0.15, baseCritDmg: 1.5, baseEva: 0.1, fixedMp: true,
        skills: {
            'basic': { name: "기본 공격", type: 'phy', cost: 0, power: 1.0, price: 0, desc: "기본 물리 공격", effect: '' },
            'genocide': { name: "제노사이드 스탭", type: 'phy', cost: 10, power: 0.5, price: 0, desc: "이번 턴 회피율 +50%", effect: 'evasion_50' },
            'crosscut': { name: "크로스 컷", type: 'phy', cost: 20, power: 1.3, price: 1000, desc: "치명타 시 암흑 3스택", effect: 'darkness' },
            'assassin': { name: "어쌔신 네일", type: 'phy', cost: 30, power: 1.5, price: 5000, desc: "암흑 스택당 치명타율 증가", effect: 'finisher' },
            'phantom': { name: "팬텀 레이드", type: 'phy', cost: 20, power: 1.4, price: 1000, desc: "다음 턴 적 마방 감소", effect: 'mdef_down' },
            'dancing': { name: "댄싱 대거", type: 'phy', cost: 30, power: 0.6, price: 5000, desc: "회피 횟수만큼 추가타", effect: 'multi_hit' },
            'shadow': { name: "섀도우 볼", type: 'mag', cost: 20, power: 1.1, price: 1000, desc: "암흑 부여", effect: 'darkness' },
            'veil': { name: "베일 오브 다크니스", type: 'mag', cost: 30, power: 1.0, price: 5000, desc: "3턴 회피 +40%", effect: 'eva_buff' },
            'meteor': { name: "다크 메테오", type: 'mag', cost: 40, power: 3.5, price: 10000, desc: "다음 턴 행동불가", effect: 'self_stun' },
            'evasion': { name: "회피 태세", type: 'sup', cost: 10, power: 0, price: 0, desc: "다음 턴 회피 +50%", effect: 'next_eva' },
            'instinct': { name: "인스팅트", type: 'sup', cost: 10, power: 0, price: 5000, desc: "5턴 회피+25%/피해+20%", effect: 'instinct' },
            'adrenaline': { name: "아드레날린", type: 'sup', cost: 20, power: 0, price: 5000, desc: "4턴 치명댐/피해 증가", effect: 'adrenaline' },
            'eclipse': { name: "이클립스", type: 'phy', isUlt: true, cost: 50, power: 2.9, price: 20000, desc: "확정 치명타 (물리)", effect: 'guarantee_crit' },
            'lunablade': { name: "루나 블레이드", type: 'mag', isUlt: true, cost: 50, power: 3.2, price: 20000, desc: "이번 턴 완전회피", effect: 'perfect_eva' }
        }
    },
    zeke: {
        name: "지크", hp: 620, mp: 120, mpRegen: 10, atk: 60, matk: 45, def: 60, mdef: 50, baseCrit: 0.1, baseCritDmg: 1.5, baseEva: 0.05, fixedMp: true,
        skills: {
            'basic': { name: "기본 공격", type: 'phy', cost: 0, power: 1.0, price: 0, desc: "기본 물리 공격", effect: '' },
            'heavy': { name: "헤비 임팩트", type: 'phy', cost: 20, power: 1.2, price: 1000, desc: "잃은 체력 비례 피해", effect: 'hp_reverse_mid' },
            'carnage': { name: "카니지", type: 'phy', cost: 0, power: 1.4, price: 1000, desc: "HP 10% 소모", effect: 'hp_cost' },
            'flameshot': { name: "플레임 샷", type: 'mag', cost: 10, power: 1.1, price: 1000, desc: "3턴 물방 20% 감소", effect: 'def_down' },
            'undying': { name: "언다잉", type: 'sup', cost: 10, power: 0, price: 5000, desc: "불사 / 성공시 공2배", effect: 'immortal' },
            'wild': { name: "와일드 쓰래쉬", type: 'phy', cost: 30, power: 2.8, price: 5000, desc: "다음 턴 내 방어력 0", effect: 'self_def_zero' },
            'divine': { name: "디바인 아머", type: 'sup', cost: 20, power: 0, price: 5000, desc: "4턴 방어+30% / 피격시 스택", effect: 'divine_buff' },
            'ignis': { name: "이그니스 스매시", type: 'phy', cost: 30, power: 1.7, price: 5000, desc: "화염 인챈트 시 1.4배", effect: 'fire_combo_new' },
            'enchant': { name: "파이어 인챈트", type: 'sup', cost: 30, power: 0, price: 5000, desc: "5턴 물공 시 마법 추가타", effect: 'enchant_buff' },
            'guard': { name: "가드", type: 'sup', cost: 10, power: 0, price: 0, desc: "이번 턴 피해 70% 감소", effect: 'guard_70' },
            'divineblade': { name: "디바인 블레이드", type: 'phy', cost: 40, power: 4.2, price: 10000, desc: "2턴 차지/스택소모", effect: 'charge_divine' },
            'prominence': { name: "프로미넌스", type: 'mag', cost: 40, power: 2.1, price: 10000, desc: "3턴 물방 20% 감소", effect: 'def_down' },
            'ragnarok': { name: "라그나로크", type: 'phy', isUlt: true, cost: 50, power: 2.0, price: 20000, desc: "잃은 체력 비례 댐(물리)", effect: 'hp_reverse' },
            'castle': { name: "기간틱 캐슬", type: 'mag', isUlt: true, cost: 50, power: 1.8, price: 20000, desc: "사용 횟수만큼 강화 / 방어+100%", effect: 'stack_ult_new' }
        }
    },
    jasmine: {
        name: "자스민", hp: 480, mp: 300, mpRegen: 15, atk: 30, matk: 85, def: 40, mdef: 60, baseCrit: 0.1, baseCritDmg: 1.5, baseEva: 0.1, fixedMp: true,
        skills: {
            'basic': { name: "기본 공격", type: 'phy', cost: 0, power: 1.0, price: 0, desc: "기본 물리 공격", effect: '' },
            'smite': { name: "홀리 스마이트", type: 'phy', cost: 10, power: 1.3, price: 1000, desc: "저비용 물리", effect: '' },
            'rod': { name: "저지먼트 로드", type: 'phy', cost: 20, power: 1.4, price: 5000, desc: "3턴 물방 감소", effect: 'def_down' },
            'lance': { name: "에테르 랜스", type: 'phy', cost: 30, power: 1.7, price: 10000, desc: "3턴 마방 감소", effect: 'mdef_down' },
            'holyball': { name: "홀리 볼", type: 'mag', cost: 30, power: 1.4, price: 0, desc: "기본 마법", effect: '' },
            'holyray': { name: "홀리 레이", type: 'mag', cost: 60, power: 2.4, price: 1000, desc: "순간 누킹", effect: '' },
            'sunfire': { name: "선파이어", type: 'mag', cost: 50, power: 2.8, price: 5000, desc: "HP 20% 소모", effect: 'hp_cost_20' },
            'judgment': { name: "저지먼트", type: 'mag', cost: 70, power: 3.5, price: 5000, desc: "명중률 70%", effect: 'miss_chance' },
            'sanctuary': { name: "생츄어리", type: 'sup', cost: 70, power: 0, price: 5000, desc: "3턴 마법 반사", effect: 'reflect' },
            'absolute': { name: "앱솔루트 라이트", type: 'mag', cost: 70, power: 1.5, price: 10000, desc: "연속 사용시 강화", effect: 'stack_dmg' },
            'magicguard': { name: "매직 가드", type: 'sup', cost: 30, power: 0, price: 0, desc: "이번 턴 마법무효", effect: 'null_mag' },
            'barrier': { name: "배리어", type: 'sup', cost: 30, power: 0, price: 5000, desc: "이번 턴 물리무효", effect: 'null_phy' },
            'meditation': { name: "메디테이션", type: 'sup', cost: 30, power: 0, price: 10000, desc: "리젠UP/마법공격DOWN (4턴)", effect: 'medi' },
            'theholy': { name: "더 홀리", type: 'mag', isUlt: true, cost: 100, power: 5.5, price: 20000, desc: "다음 턴 행동불가 / 여신강림 시 극딜", effect: 'self_stun' },
            'goddess': { name: "여신 강림", type: 'sup', isUlt: true, cost: 200, power: 0, price: 25000, desc: "HP/상태 리셋, 버프", effect: 'reset_buff' }
        }
    },
    queen: {
        name: "여왕", hp: 550, mp: 120, mpRegen: 12, atk: 55, matk: 55, def: 35, mdef: 45, baseCrit: 0.10, baseCritDmg: 1.5, baseEva: 0.05, fixedMp: true,
        skills: {
            'basic': { name: "기본 공격", type: 'phy', cost: 0, power: 1.0, price: 0, desc: "기본 물리 공격", effect: '' },
            'thornwhip': { name: "바인 휩", type: 'phy', cost: 10, power: 1.2, price: 1000, desc: "장미 1스택", effect: 'add_rose_1' },
            'roseseed': { name: "로즈 샷", type: 'mag', cost: 10, power: 1.1, price: 1000, desc: "장미 1스택", effect: 'add_rose_1' },
            'petaldance': { name: "플라워 댄스", type: 'phy', cost: 20, power: 1.3, price: 3000, desc: "3턴 회피 +20%", effect: 'eva_buff' },
            'sharpness': { name: "로열 포커스", type: 'mag', cost: 20, power: 1.4, price: 3000, desc: "3턴 치명 +25%", effect: 'crit_buff' },
            'thornarmor': { name: "쏜 가드", type: 'sup', cost: 10, power: 0, price: 0, desc: "이번 턴 피해 50% 감소", effect: 'dmg_red_50' },
            'withering': { name: "크루얼 쏜", type: 'phy', cost: 30, power: 1.7, price: 5000, desc: "3턴 적 마방 감소", effect: 'mdef_down' },
            'wildgrowth': { name: "와일드 루트", type: 'mag', cost: 30, power: 3.1, price: 10000, desc: "장미 2스택 / 다음 턴 불가", effect: 'rose_2_self_stun' },
            'blooming': { name: "퀵 그로우", type: 'sup', cost: 20, power: 0, price: 5000, desc: "장미 3스택 충전", effect: 'add_rose_3' },
            'overwhelm': { name: "로즈 프리즌", type: 'sup', cost: 20, power: 0, price: 5000, desc: "장미3 소모: 적 스턴", effect: 'stun_rose_3' },
            'fatalrose': { name: "하트 피어스", type: 'phy', cost: 40, power: 2.0, price: 10000, desc: "치명타 시 장미 6스택", effect: 'crit_rose_6' },
            'royalbloom': { name: "로열 블룸", type: 'sup', cost: 30, power: 0, price: 5000, desc: "3턴 공격/마공 50% 증가 (종료시 소멸)", effect: 'royal_bloom' },
            'queensgarden': { name: "퀸즈 도메인", type: 'mag', isUlt: true, cost: 50, power: 2.5, price: 20000, desc: "3턴 패시브 피해 2배", effect: 'passive_boost' },
            'funeral': { name: "피날레", type: 'mag', isUlt: true, cost: 50, power: 5.0, price: 20000, desc: "스택 폭발", effect: 'rose_finisher' }
        }
    },
    rumi: {
        name: "루미", hp: 550, mp: 240, mpRegen: 10, atk: 50, matk: 60, def: 40, mdef: 60, baseCrit: 0.05, baseCritDmg: 1.5, baseEva: 0.05, fixedMp: true,
        skills: {
            'basic': { name: "기본 공격", type: 'phy', cost: 0, power: 1.0, price: 0, desc: "기본 물리 공격", effect: '' },
            'starbarrier': { name: "스타 배리어", type: 'sup', cost: 10, power: 0, price: 0, desc: "피해 50% 감소 (별: 70%)", effect: 'sage_barrier' },
            'pangpang': { name: "팡팡 펀치", type: 'phy', cost: 10, power: 1.2, price: 0, desc: "3턴 적 마방 20% 감소", effect: 'mdef_down' },
            'twinkle': { name: "트윙클", type: 'mag', cost: 20, power: 1.0, price: 1000, desc: "하이브리드 / 치명타시 마나회복", effect: 'sage_hybrid_mana' },
            'form_star': { name: "별의 형태", type: 'sup', cost: 10, power: 0, price: 1000, desc: "[결정1] 방어/마방 50% 증가", effect: 'form_change_star' },
            'milkyway': { name: "밀키웨이 엑스터시", type: 'mag', cost: 40, power: 2.2, price: 5000, desc: "1턴 차징 / (물공+마공)x2.2", effect: 'charge_milkyway' },
            'moonveil': { name: "문라이트 베일", type: 'mag', cost: 20, power: 1.3, price: 3000, desc: "달: 3턴 회피 40%", effect: 'sage_moon_veil' },
            'form_moon': { name: "달의 형태", type: 'sup', cost: 10, power: 0, price: 3000, desc: "[결정1] 마공50%↑ 물공50%↓", effect: 'form_change_moon' },
            'godhand': { name: "갓 핸드", type: 'phy', cost: 30, power: 1.7, price: 5000, desc: "태양: 추가타 (0.4배)", effect: 'sage_god_hand' },
            'silentserena': { name: "사일런트 세레나", type: 'mag', cost: 40, power: 2.0, price: 5000, desc: "달: 추가타 (0.4배)", effect: 'sage_silent' },
            'meteorsmash': { name: "메테오 스매시", type: 'phy', cost: 40, power: 2.2, price: 10000, desc: "태양: 3턴 치명 40%", effect: 'sage_meteor' },
            'milkshake': { name: "스타파우더 밀크쉐이크", type: 'sup', cost: 100, power: 0, price: 15000, desc: "HP30%회복/별:10턴 방어30%", effect: 'milkshake_heal' },
            'form_sun': { name: "태양의 형태", type: 'mag', isUlt: true, cost: 50, power: 0, price: 20000, desc: "[결정1] 물공100%↑ 방어50%↓", effect: 'form_change_sun' },
            'dreamform': { name: "꿈의 형태", type: 'mag', isUlt: true, cost: 50, power: 2.5, price: 20000, desc: "형태 소모하여 강력한 효과", effect: 'sage_dream_ult' }
        }
    }
};

const ENEMIES = [
    // Tier 1: 속삭이는 동굴
    { name: "슬라임", img:"", hp: 435, atk: 40, matk: 40, def: 40, mdef: 40, exp: 100, gold: 2000, tier: 1, skillName: "산성액", skillType: 'mag', skillPower: 1.5, ai: 'basic' },
    { name: "코볼트", img:"", hp: 540, atk: 70, matk: 50, def: 40, mdef: 40, exp: 120, gold: 2500, tier: 1, skillName: "강타", skillType: 'phy', skillPower: 1.2, ai: 'basic' },
    { name: "페어리", img:"", hp: 620, atk: 55, matk: 75, def: 45, mdef: 55, exp: 150, gold: 3000, tier: 1, skillName: "에너지볼", skillType: 'mag', skillPower: 1.6, ai: 'basic' },
    { name: "고스트 킹", img:"", hp: 1195, atk: 55, matk: 70, def: 50, mdef: 60, exp: 600, gold: 3500, tier: 1, skillName: "에너지볼", skillType: 'mag', skillPower: 1.6, ai: 'ghost_king', desc: "1티어 보스" },

    // Tier 2: 검은 안개 숲
    { name: "미믹", img:"", hp: 785, atk: 85, matk: 85, def: 90, mdef: 90, exp: 300, gold: 4000, tier: 2, skillName: "차지어택", skillType: 'phy', skillPower: 2.5, ai: 'charge' },
    { name: "잭오랜턴", img:"", hp: 865, atk: 95, matk: 115, def: 80, mdef: 85, exp: 350, gold: 4500, tier: 2, skillName: "파이어볼", skillType: 'mag', skillPower: 1.7, ai: 'basic' },
    { name: "웨어베어", img:"", hp: 945, atk: 120, matk: 100, def: 100, mdef: 85, exp: 400, gold: 5000, tier: 2, skillName: "강타", skillType: 'phy', skillPower: 1.2, ai: 'basic' },
    { name: "마왕", img:"", hp: 1745, atk: 105, matk: 105, def: 95, mdef: 95, exp: 1200, gold: 5500, tier: 2, skillName: "다크니스", skillType: 'mag', skillPower: 1.8, ai: 'mawang', desc: "2티어 보스" },

    // Tier 3: 잊혀진 고성
    { name: "골렘", img:"", hp: 1210, atk: 150, matk: 120, def: 155, mdef: 125, exp: 700, gold: 6000, tier: 3, skillName: "차지어택", skillType: 'phy', skillPower: 2.5, ai: 'charge' },
    { name: "뱀파이어", img:"", hp: 1390, atk: 145, matk: 175, def: 130, mdef: 160, exp: 800, gold: 6500, tier: 3, skillName: "다크니스", skillType: 'mag', skillPower: 1.8, ai: 'basic' },
    { name: "세계수", img:"", hp: 2560, atk: 135, matk: 175, def: 175, mdef: 135, exp: 2500, gold: 7500, tier: 3, skillName: "산성액", skillType: 'mag', skillPower: 1.5, ai: 'tree', desc: "3티어 보스" },

    // Tier 4: 혼돈의 틈
    { name: "공허의 기사", img:"", hp: 2800, atk: 205, matk: 125, def: 180, mdef: 80, exp: 1300, gold: 7000, tier: 4, skillName: "강타", skillType: 'phy', skillPower: 1.5, ai: 'basic' },
    { name: "혼돈의 마법사", img:"", hp: 3600, atk: 145, matk: 285, def: 80, mdef: 180, exp: 1800, gold: 9500, tier: 4, skillName: "메테오", skillType: 'mag', skillPower: 1.7, ai: 'basic' },
    { name: "그림자 추적자", img:"", hp: 5000, atk: 365, matk: 225, def: 130, mdef: 130, exp: 2500, gold: 12000, tier: 4, skillName: "기습", skillType: 'phy', skillPower: 2.0, ai: 'basic' },
    { name: "마신", img:"", hp: 9000, atk: 480, matk: 480, def: 250, mdef: 250, exp: 12000, gold: 25000, tier: 4, skillName: "다크니스", skillType: 'mag', skillPower: 1.8, ai: 'mashin', desc: "이벤트 보스" },

    // Tier 5: 영겁의 빙하
    {
        name: "펜리르", img:"",
        hp: 6800, atk: 370, matk: 200, def: 220, mdef: 200,
        exp: 3500, gold: 14000, tier: 5,
        skillName: "블리자드", skillType: 'mag', skillPower: 3.0,
        ai: 'basic', desc: "빙하의 늑대"
    },
    {
        name: "눈토끼", img:"",
        hp: 6000, atk: 270, matk: 370, def: 200, mdef: 220,
        exp: 3500, gold: 14000, tier: 5,
        skillName: "아이스빔", skillType: 'mag', skillPower: 2.0,
        ai: 'basic', desc: "사나운 토끼"
    },
    {
        name: "아발란체 메이드", img:"",
        hp: 5500, atk: 450, matk: 450, def: 180, mdef: 180,
        exp: 4000, gold: 14500, tier: 5,
        skillName: "블리자드", skillType: 'mag', skillPower: 3.0,
        ai: 'basic', desc: "공격형 메이드"
    },
    {
        name: "혹한의 마녀", img:"",
        hp: 13000, atk: 550, matk: 550, def: 300, mdef: 300,
        exp: 20000, gold: 30000, tier: 5,
        skillName: "아이스빔", skillType: 'mag', skillPower: 2.0,
        ai: 'witch', desc: "빙하의 지배자"
    },

    // Tier 6: 천상의 계단 (아스테아 상향 적용)
    {
        name: "대천사", img:"대천사.png",
        hp: 8000, atk: 510, matk: 300, def: 270, mdef: 250,
        exp: 6500, gold: 20000, tier: 6,
        skillName: "저지먼트", skillType: 'mag', skillPower: 3.5,
        ai: 'basic', desc: "천상의 문지기"
    },
    {
        name: "라이트 엘리멘탈", img:"라이트 엘리멘탈.png",
        hp: 8500, atk: 400, matk: 580, def: 230, mdef: 300,
        exp: 8000, gold: 23000, tier: 6,
        skillName: "홀리 레이", skillType: 'mag', skillPower: 2.0,
        ai: 'basic', desc: "천상의 정령"
    },
    {
        name: "창조신 아스테아", img:"",
        hp: 27000, atk: 700, matk: 750, def: 330, mdef: 330,
        exp: 100000, gold: 100000, tier: 6,
        ai: 'goddess', desc: "★ 진 최종보스 ★"
    },

    // Event: 디저트 킹덤
    {
        name: "생크림 메이드", img:"",
        hp: 10000, atk: 500, matk: 700, def: 250, mdef: 300,
        exp: 10000, gold: 30000, tier: 'dessert',
        skillName: "크림 익스플로전", skillType: 'mag', skillPower: 2.5,
        ai: 'cream_maid'
    },
    {
        name: "캔디 보이", img:"",
        hp: 11000, atk: 650, matk: 650, def: 300, mdef: 300,
        exp: 12000, gold: 32000, tier: 'dessert',
        skillName: "캔디 캐논", skillType: 'phy', skillPower: 1.5,
        ai: 'candy_boy'
    },
    {
        name: "푸딩 프린세스", img:"",
        hp: 16000, atk: 500, matk: 500, def: 200, mdef: 200,
        exp: 30000, gold: 50000, tier: 'dessert',
        skillName: "크림 익스플로전", skillType: 'mag', skillPower: 2.5,
        ai: 'pudding_princess', desc: "디저트 킹덤의 공주"
    },

    // Event: 마도 제국
    {
        name: "화염의 현자", img:"",
        hp: 9000, atk: 450, matk: 750, def: 200, mdef: 400,
        exp: 11000, gold: 30000, tier: 'magic',
        skillName: "익스플로전", skillType: 'mag', skillPower: 3.0,
        ai: 'flame_sage'
    },
    {
        name: "번개의 현자", img:"",
        hp: 10000, atk: 500, matk: 700, def: 250, mdef: 350,
        exp: 11000, gold: 30000, tier: 'magic',
        skillName: "썬더 레인", skillType: 'mag', skillPower: 3.0,
        ai: 'lightning_sage'
    },
    {
        name: "인조 마신", img:"",
        hp: 20000, atk: 600, matk: 600, def: 300, mdef: 300,
        exp: 40000, gold: 60000, tier: 'magic',
        skillName: "익스플로전", skillType: 'mag', skillPower: 3.0,
        ai: 'artificial_god', desc: "제국의 병기"
    }
];
