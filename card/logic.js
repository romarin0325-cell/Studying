/**
 * game.js — Game utilities, storage layer, and constants for Card RPG.
 *
 * Provides:
 *   - Storage: Centralized localStorage abstraction with safe JSON parsing
 *   - GAME_CONSTANTS: Named constants replacing magic numbers
 *   - GACHA_RATES: Gacha probability tables per mode
 *   - GameUtils.buildCardPool(): Unified card pool builder (replaces 6 duplicated patterns)
 *   - GameUtils.resolveGachaGrade(): Grade determination from GACHA_RATES table
 */

// ─── Storage Layer ────────────────────────────────────────────────────────────

const Storage = {
    keys: {
        SAVE: 'cardRpgSave',
        GLOBAL: 'cardRpgGlobal',
        VOCAB: 'cardRpgVocab',
        COLLOCATION: 'cardRpgCollocation',
        API_KEY: 'cardRpgApiKey',
        RECORDS: 'cardRpgRecords'
    },

    /**
     * Load and parse JSON from localStorage. Returns null on failure.
     * @param {string} key - localStorage key
     * @returns {*|null}
     */
    load(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error(`[Storage] Parse error for key "${key}":`, e);
            return null;
        }
    },

    /**
     * Save data as JSON to localStorage.
     * @param {string} key
     * @param {*} data
     */
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`[Storage] Save error for key "${key}":`, e);
        }
    },

    /**
     * Remove a key from localStorage.
     * @param {string} key
     */
    remove(key) {
        localStorage.removeItem(key);
    },

    /**
     * Get raw string value (for API key which doesn't need JSON).
     * @param {string} key
     * @returns {string|null}
     */
    getRaw(key) {
        return localStorage.getItem(key);
    },

    /**
     * Set raw string value.
     * @param {string} key
     * @param {string} value
     */
    setRaw(key, value) {
        localStorage.setItem(key, value);
    }
};

// ─── Game Constants ───────────────────────────────────────────────────────────

const GAME_CONSTANTS = {
    MAX_MP: 100,
    MAX_FIELD_BUFFS: 3,
    BASE_CRIT_MULT: 1.5,
    SUN_BLESS_CRIT_BONUS: 0.6,
    CHAOS_POOL_SIZE: 15,
    INITIAL_TICKETS: {
        default: 20,
        suffering: 10,
        overdrive: 10,
        restriction: 10,
        balance: 10,
        archive: 10,
        flood: 10,
        curse: 10,
        chaos: 0,
        draft: 5,
        artifact: 10
    },
    DECK_SIZE: 3,
    MAX_RECORDS: 5,
    MAX_ARTIFACTS: 4,
    SAGE_BLESSING_PICK_COUNT: 12,

    // Costs
    COSTS: {
        GACHA_SINGLE: 1,
        CHAOS_SHUFFLE: 1,
        DRAFT_REROLL_WITH_TICKET: 1
    },

    DRAFT: {
        INITIAL_REROLLS: 3
    },

    // Battle Settings
    BATTLE: {
        MANA_GAIN_TURN: 20,
        MANA_GAIN_HIT: 10,
        MANA_GAIN_ATTACK: 10,
        TRAIT_TRIGGER_CHANCE: 30 // For some traits
    },

    // Field Buff Stats (Moved from logic.js)
    FIELD_BUFF_STATS: {
        'sun_bless': { atk: 0.3, matk: 0.3 },
        'moon_bless': { matk: 0.3, evasion: 15 },
        'sanctuary': { matk: 0.3, mdef: 0.3 },
        'goddess_descent': { atk: 0.3, matk: 0.3, def: 0.3, mdef: 0.3 },
        'earth_bless': { atk: 0.25, matk: 0.25 },
        'twinkle_party': { atk: 0.2, crit: 15 },
        'star_powder': { def: 0.4, mdef: 0.4 },
        'reaper_realm': { crit: 40 },
        'gale': { crit: 20, evasion: 20 }
    }
};

// ─── Gacha Rate Tables ────────────────────────────────────────────────────────

/**
 * Gacha probability tables by mode.
 * Each mode has `normal` and `challenge` sub-tables.
 * Thresholds are cumulative: checked in order, remaining probability = 'normal' grade.
 *
 * Format: [ { grade, threshold }, ... ] checked from top to bottom.
 */
const GACHA_RATES = {
    restriction: {
        normal: [{ grade: 'rare', threshold: 0.20 }],
        challenge: [{ grade: 'rare', threshold: 0.40 }]
    },
    balance: {
        normal: [{ grade: 'epic', threshold: 0.10 }, { grade: 'rare', threshold: 0.30 }],
        challenge: [{ grade: 'epic', threshold: 0.20 }, { grade: 'rare', threshold: 0.50 }]
    },
    default: {
        normal: [{ grade: 'legend', threshold: 0.10 }, { grade: 'epic', threshold: 0.30 }, { grade: 'rare', threshold: 0.60 }],
        challenge: [{ grade: 'legend', threshold: 0.20 }, { grade: 'epic', threshold: 0.45 }, { grade: 'rare', threshold: 0.75 }]
    }
};

// ─── Artifact Definitions ─────────────────────────────────────────────────────

const ARTIFACT_LIST = [
    { id: 'nature_blessing', name: '대자연의 축복', desc: '대지의축복 효과 2배' },
    { id: 'reverse', name: '리버스', desc: '자연속성 카드 사망시 필드버프 대지의축복 부여' },
    { id: 'milkshake', name: '밀크쉐이크', desc: '스타파우더 효과 2배' },
    { id: 'buff_overload', name: '버프오버로드', desc: '필드버프 상한 5개로 변경' },
    { id: 'shadow_ball', name: '섀도우볼', desc: '암흑 효과가 마법방어도 감소하도록 변경' },
    { id: 'assassin_nail', name: '어쌔신네일', desc: '암흑 효과 2배 적용' },
    { id: 'veil_of_darkness', name: '베일오브다크니스', desc: '어둠속성 카드 치명타와 회피율 10% 증가' },
    { id: 'rabbit_hole', name: '래빗홀', desc: '눈토끼, 밤토끼, 은토끼의 치명타와 회피율 20% 증가' },
    { id: 'lucky_vicky', name: '럭키비키', desc: '치명타 혹은 회피 발생시 마나 10 회복' },
    { id: 'over_flame', name: '오버플레임', desc: '작열 최대 스택 5, 부여시 2스택씩 부여' },
    { id: 'over_divine', name: '오버디바인', desc: '디바인 최대 스택 5, 부여시 2스택씩 부여' },
    { id: 'holy_flame_burst', name: '홀리플레임버스트', desc: '작열/디바인 전소모 스킬의 추가위력 2배' },
    { id: 'flame_piercing', name: '플레임피어싱', desc: '작열 스택당 적의 방어력 10% 추가 관통' },
    { id: 'divine_piercing', name: '디바인피어싱', desc: '디바인 스택당 적의 마법방어력 10% 추가 관통' },
    { id: 'gale_storm', name: '질풍노도', desc: '전투 개시 후 3턴간 필드버프 질풍 부여 (치명타율/회피율 20% 증가)' },
    { id: 'frozen_body', name: '프로즌바디', desc: '물속성 카드 사망시 적에게 스턴 부여' },
    { id: 'ice_break', name: '아이스브레이크', desc: '스턴 중인 적에게 대미지 3배' },
    { id: 'support_boost', name: '서포트부스트', desc: '모든 보조스킬 마나 소비 0' },
    { id: 'double_attack', name: '더블어택', desc: '일반공격 위력 2.0배' },
    { id: 'death_roulette', name: '데스룰렛', desc: '모든 스킬 대미지 2배, 스킬 사용시 30% 확률로 사망' },
    { id: 'shadow_stab', name: '섀도우스탭', desc: '회피율 20%증가, 방어력과 마법방어력 30% 감소' },
    { id: 'dragon_heart', name: '드래곤하트', desc: '베이비드래곤/레드드래곤/골드드래곤 마공 50% 증가' },
    { id: 'big_bang', name: '빅뱅', desc: '전설/초월 카드 사망시 물리 3배율 자폭대미지' },
    { id: 'companion', name: '길동무', desc: '사망시 적에게 대미지를 주는 특성이나 아티팩트 대미지 2배' },
    { id: 'kaleidoscope', name: '만화경', desc: '매 턴 개시시 모든 필드버프를 변경한다' },
    { id: 'blue_moon', name: '블루문', desc: '스킬 사용시 30%확률로 마나를 소비하지 않는다' }
];

// ─── Game Utilities ───────────────────────────────────────────────────────────

const GameUtils = {
    /**
     * Build a card pool with bonus and transcendence cards.
     * Replaces 6 duplicated card pool construction patterns throughout the codebase.
     *
     * @param {Object} globalData - RPG.global object
     * @param {Object} [options]
     * @param {boolean} [options.includeTranscendence=false] - Include active transcendence cards
     * @param {string[]} [options.activeTranscendenceCards=[]] - IDs of active transcendence cards
     * @param {boolean} [options.excludeTranscendence=false] - Filter out transcendence grade cards
     * @param {string}  [options.maxGrade] - Max grade filter: 'rare' or 'epic'
     * @returns {Array} Array of card objects
     */
    buildCardPool(globalData, options = {}) {
        let pool = [...CARDS];

        // Add unlocked bonus cards
        if (globalData.unlocked_bonus_cards && globalData.unlocked_bonus_cards.length > 0) {
            const bonus = BONUS_CARDS.filter(c => globalData.unlocked_bonus_cards.includes(c.id));
            pool = pool.concat(bonus);
        }

        // Add transcendence cards if requested
        if (options.includeTranscendence && options.activeTranscendenceCards && options.activeTranscendenceCards.length > 0) {
            const transObjs = TRANSCENDENCE_CARDS.filter(c => options.activeTranscendenceCards.includes(c.id));
            pool = pool.concat(transObjs);
        }

        // Exclude transcendence grade
        if (options.excludeTranscendence) {
            pool = pool.filter(c => c.grade !== 'transcendence');
        }

        // Apply max grade filter
        if (options.maxGrade === 'rare') {
            pool = pool.filter(c => c.grade === 'rare' || c.grade === 'normal');
        } else if (options.maxGrade === 'epic') {
            pool = pool.filter(c => c.grade === 'epic' || c.grade === 'rare' || c.grade === 'normal');
        }

        return pool;
    },

    /**
     * Get the max grade filter string for a given mode.
     * @param {string} mode
     * @returns {string|undefined}
     */
    getMaxGradeForMode(mode) {
        if (mode === 'restriction') return 'rare';
        if (mode === 'balance') return 'epic';
        return undefined;
    },

    /**
     * Resolve gacha grade from the rate tables.
     * @param {string} mode - Game mode
     * @param {boolean} isChallenge - Whether this is a challenge pull
     * @returns {string} Grade string ('normal', 'rare', 'epic', 'legend')
     */
    resolveGachaGrade(mode, isChallenge) {
        const rateTable = GACHA_RATES[mode] || GACHA_RATES['default'];
        const rates = isChallenge ? rateTable.challenge : rateTable.normal;
        const rand = Math.random();

        for (const entry of rates) {
            if (rand < entry.threshold) return entry.grade;
        }
        return 'normal';
    },

    /**
     * Get initial ticket count for a mode.
     * @param {string} mode
     * @returns {number}
     */
    getInitialTickets(mode) {
        return GAME_CONSTANTS.INITIAL_TICKETS[mode] !== undefined
            ? GAME_CONSTANTS.INITIAL_TICKETS[mode]
            : GAME_CONSTANTS.INITIAL_TICKETS.default;
    }
};



// FIELD_BUFF_STATS moved to GAME_CONSTANTS in game.js

// Helper for Buff Names (Moved out to be accessible)
function getBuffName(key) {
    if (typeof BUFF_NAMES !== 'undefined') {
        return BUFF_NAMES[key] || key;
    }
    return key;
}

const DAMAGE_EFFECT_HANDLERS = {
    'consume_field_all': (ctx, eff) => {
        let c = ctx.fieldBuffs.length;
        if (c > 0) {
            ctx.mult += (c * eff.multPerStack);
            ctx.fieldBuffs.length = 0;
            ctx.logFn(`필드 버프 ${c}개 제거! 위력 폭발!`);
        }
    },
    'consume_debuff_all': (ctx, eff) => {
        if (ctx.target.buffs[eff.debuff]) {
            let c = ctx.target.buffs[eff.debuff];
            let mps = eff.multPerStack;
            // Artifact: holy_flame_burst — double consume multiplier for burn/divine
            const artifacts = (typeof RPG !== 'undefined' && RPG.state && RPG.state.artifacts) ? RPG.state.artifacts : [];
            if (artifacts.includes('holy_flame_burst') && (eff.debuff === 'burn' || eff.debuff === 'divine')) {
                mps *= 2.0;
                ctx.logFn('[아티팩트] 홀리플레임버스트: 전소모 배율 2배!');
            }
            ctx.mult += (c * mps);
            delete ctx.target.buffs[eff.debuff];
            ctx.logFn(`${getBuffName(eff.debuff)} ${c}스택 소모!`);
        }
    },
    'dmg_boost': (ctx, eff) => {
        let matched = false;
        if (eff.condition === 'target_debuff' && ctx.target.buffs[eff.debuff]) {
            ctx.mult *= eff.mult;
            matched = true;
            if (!eff.customLog) ctx.logFn(`[특성] ${getBuffName(eff.debuff)} 대상 추가 피해! (배율 x${eff.mult})`);
        }
        else if (eff.condition === 'synergy_active' && ctx.activeTraits.includes(eff.trait)) {
            ctx.mult *= eff.mult;
            matched = true;
            if (!eff.customLog) ctx.logFn(`[시너지] 조건 만족! 위력 ${eff.mult}배 증가!`);
        }
        else if (eff.condition === 'target_stack' && ctx.target.buffs[eff.debuff]) {
            ctx.mult += (ctx.target.buffs[eff.debuff] * eff.multPerStack);
        }
        else if (eff.condition === 'target_debuff_count_scale') {
            let bonus = (Object.keys(ctx.target.buffs).length * eff.multPerDebuff);
            ctx.mult += bonus;
            if (bonus > 0 && !eff.customLog) ctx.logFn(`[특성] 디버프 대상 추가 피해! (배율 +${bonus.toFixed(1)})`);
        }
        else if (eff.condition === 'hp_below' && (ctx.source.hp / ctx.source.maxHp) <= eff.val) {
            ctx.mult *= eff.mult;
            matched = true;
            if (!eff.customLog && ctx.skill.name === '라그나로크') ctx.logFn("라그나로크: 생명력 조건 만족! 대미지 증가!");
        }
        else if (eff.condition === 'target_hp_below' && (ctx.target.hp / ctx.target.maxHp) <= eff.val) {
            ctx.mult *= eff.mult;
            matched = true;
            if (!eff.customLog) ctx.logFn(`[약점 포착] 적 체력 ${eff.val * 100}% 이하! 위력 증가!`);
        }
        else if (eff.condition === 'hp_full' && ctx.source.hp === ctx.source.maxHp) {
            ctx.mult *= eff.mult;
            matched = true;
            if (eff.log) ctx.logFn(eff.log);
        }
        else if (eff.condition === 'field_buff' && ctx.fieldBuffs.some(b => b.name === eff.buff)) {
            ctx.mult *= eff.mult;
            matched = true;
        }

        if (matched && eff.customLog) {
            ctx.logFn(eff.customLog);
        }
    },
    'consume_debuff_fixed': (ctx, eff) => {
        const debuff = eff.debuff;
        const count = eff.count || 1;
        if ((ctx.target.buffs[debuff] || 0) >= count) {
            ctx.target.buffs[debuff] -= count;
            if (ctx.target.buffs[debuff] <= 0) delete ctx.target.buffs[debuff];
            let m = eff.mult;
            // Artifact: holy_flame_burst — double consume multiplier for burn/divine
            const artifacts = (typeof RPG !== 'undefined' && RPG.state && RPG.state.artifacts) ? RPG.state.artifacts : [];
            if (artifacts.includes('holy_flame_burst') && (debuff === 'burn' || debuff === 'divine')) {
                m *= 2.0;
                ctx.logFn('[아티팩트] 홀리플레임버스트: 전소모 배율 2배!');
            }
            ctx.mult *= m;

            if (eff.customLog) ctx.logFn(eff.customLog);
            else ctx.logFn(`${getBuffName(debuff)} ${count}스택 소모! 위력 ${m}배!`);
        }
    },
    'consume_divine_add_darkness': (ctx, eff) => {
        if ((ctx.target.buffs['divine'] || 0) >= 1) {
            ctx.target.buffs['divine']--;
            if (ctx.target.buffs['divine'] <= 0) delete ctx.target.buffs['divine'];
            ctx.target.buffs['darkness'] = 1;
            ctx.logFn("신성력을 오염시켜 암흑을 부여합니다!");
        } else {
            ctx.logFn("소모할 디바인이 없어 효과가 발동하지 않았습니다.");
        }
    },
    'remove_field_buff_dmg': (ctx, eff) => {
        if (ctx.fieldBuffs.length > 0) {
            const rm = ctx.fieldBuffs.shift();
            ctx.mult *= eff.mult;
            ctx.logFn(`필드버프 [${getBuffName(rm.name)}] 제거! 대미지 ${eff.mult}배!`);
        }
    },
    'cond_target_debuff_3_dmg': (ctx, eff) => {
        if (Object.keys(ctx.target.buffs).length >= 3) {
            ctx.mult *= eff.mult;
            ctx.logFn("적 디버프 3개 이상! 위력 2배!");
        }
    },
    'random_mult': (ctx, eff) => {
        let max = eff.max;
        if (ctx.activeTraits.includes('syn_water_3_ice_age')) max = 10.0;
        ctx.mult = eff.min + Math.floor(Math.random() * (max - eff.min + 1));
        ctx.logFn(`무작위 위력! x${ctx.mult.toFixed(1)}`);
    },
    'random_mult_moon_boost': (ctx, eff) => {
        let min = eff.min;
        let max = eff.max;
        if (ctx.fieldBuffs.some(b => b.name === 'moon_bless')) {
            max = eff.boostMax;
            ctx.logFn("달의 축복으로 최대 배율 증가!");
        }
        ctx.mult = min + Math.floor(Math.random() * (max - min + 1));
        ctx.logFn(`무작위 위력! x${ctx.mult.toFixed(1)}`);
    },
    'delayed_random_attack': (ctx, eff) => {
        ctx.mult = eff.min + Math.floor(Math.random() * (eff.max - eff.min + 1));
        ctx.logFn(`무작위 위력! x${ctx.mult.toFixed(1)}`);
    },
    'field_buff_combo_dmg': (ctx, eff) => {
        let buffs = ctx.fieldBuffs.map(b => b.name);
        let hasSun = buffs.includes('sun_bless');
        let hasMoon = buffs.includes('moon_bless');

        if (hasSun) {
            let count = ctx.fieldBuffs.length;
            ctx.mult += count * 1.0;
            ctx.logFn(`태양의 축복: 필드버프 ${count}개! 배율 +${count.toFixed(1)}`);
        }
        if (hasMoon) {
            ctx.ignoreMdefRate = (ctx.ignoreMdefRate || 0) + 0.2;
            ctx.logFn("달의 축복: 마법방어력 20% 관통!");
        }
    },
    'count_deck_attr_dmg': (ctx, eff) => {
        // Need access to deck or active traits to count attributes?
        // Logic.calculateDamage receives activeTraits.
        // But deck content isn't directly passed.
        // However, `ctx.activeTraits` contains synergy strings, not deck info.
        // Logic.calculateDamage is called with `activeTraits`.
        // We might need to pass `deck` to calculateDamage or check `source.proto.element` etc.
        // Workaround: We can't easily count deck attributes inside Logic without deck data.
        // BUT, we can pass the count as a param when calling calculateDamage?
        // OR, we assume `activeTraits` or `fieldBuffs` implies something? No.
        // We should update `Logic.calculateDamage` to accept `deck` or `attrCount`.
        // OR, for now, use a hack: Look at `activeTraits` if it has specific markers? No.
        // Best approach: Add `deck` to the `calculateDamage` signature in the next step,
        // or handle this in index.html and pass the multiplier?
        // Index.html `calcDamage` calls `Logic.calculateDamage`.
        // I will update `Logic` to accept `deck` in the next step.
        // For now, I'll write the handler assuming `ctx.deck` exists.
        if (ctx.deck) {
            const cards = ctx.deck.map(id => id ? (CARDS.find(c => c.id === id) || BONUS_CARDS.find(c => c.id === id) || TRANSCENDENCE_CARDS.find(c => c.id === id)) : null).filter(c => c);
            let attrs = new Set();
            let hasJoker = false;
            cards.forEach(c => {
                if (c.id === 'joker') hasJoker = true;
                else attrs.add(c.element);
            });
            let count = hasJoker ? 5 : attrs.size;
            ctx.mult += count * 1.0;
            ctx.logFn(`덱 속성 ${count}종! 위력 +${count.toFixed(1)}배!`);
        }
    },
    'turn_modulo_dmg': (ctx, eff) => {
        // Need current turn. ctx does not have turn.
        // Add turn to ctx in calculateDamage.
        if (ctx.turn && ctx.turn % eff.mod === 0) {
            ctx.mult *= eff.mult;
            ctx.logFn(`4의 배수 턴(${ctx.turn})! 위력 ${eff.mult}배!`);
        }
    },
    'dmg_boost_turn_scale': (ctx, eff) => {
        if (ctx.turn) {
            let bonus = ctx.turn * eff.scale;
            ctx.mult += bonus;
            ctx.logFn(`인과역전: ${ctx.turn}턴 경과! 배율 +${bonus.toFixed(1)}`);
        }
    }
};

const SideEffects = {
    handlers: {
        'buff': (ctx, eff) => {
            ctx.source.buffs[eff.id] = (eff.duration || 1);
        },
        'debuff': (ctx, eff) => {
            let t = ctx.target;
            if (eff.stack) {
                let maxStack = 3;
                let addStack = 1;
                // Artifact: over_flame / over_divine
                const artifacts = (typeof RPG !== 'undefined' && RPG.state && RPG.state.artifacts) ? RPG.state.artifacts : [];
                if (eff.id === 'burn' && artifacts.includes('over_flame')) { maxStack = 5; addStack = 2; }
                if (eff.id === 'divine' && artifacts.includes('over_divine')) { maxStack = 5; addStack = 2; }

                t.buffs[eff.id] = Math.min((t.buffs[eff.id] || 0) + addStack, maxStack);
                ctx.logFn(`${t === ctx.source ? '자신' : '적'}에게 [${getBuffName(eff.id)}] ${t.buffs[eff.id]}스택.`);
            } else {
                t.buffs[eff.id] = 1;
                ctx.logFn(`${t === ctx.source ? '자신' : '적'}에게 [${getBuffName(eff.id)}] 부여.`);
            }
        },
        'self_debuff': (ctx, eff) => {
            let s = ctx.source;
            if (eff.stack) {
                s.buffs[eff.id] = (s.buffs[eff.id] || 0) + 1;
                if (s.buffs[eff.id] > 3) s.buffs[eff.id] = 3;
                ctx.logFn(`자신에게 [${getBuffName(eff.id)}] ${s.buffs[eff.id]}스택.`);
            } else {
                s.buffs[eff.id] = 1;
                ctx.logFn(`자신에게 [${getBuffName(eff.id)}] 부여.`);
            }
        },
        'field_buff': (ctx, eff) => {
            ctx.applyFieldBuff(eff.id);
        },
        'conditional_field_buff': (ctx, eff) => {
            if (eff.condition === 'target_has_debuff' && ctx.target.buffs[eff.debuff]) ctx.applyFieldBuff(eff.id);
        },
        'random_debuff': (ctx, eff) => {
            let pool = [...eff.pool].sort(() => 0.5 - Math.random());
            for (let i = 0; i < eff.count; i++) {
                if (pool[i]) {
                    ctx.target.buffs[pool[i]] = 1;
                    ctx.logFn(`적에게 [${getBuffName(pool[i])}] 부여.`);
                }
            }
        },
        'conditional_debuff': (ctx, eff) => {
            if (eff.condition === 'target_debuff_count' && Object.keys(ctx.target.buffs).length >= eff.count) {
                ctx.target.buffs[eff.debuff] = 1;
                ctx.logFn(`조건 만족! 적에게 [${getBuffName(eff.debuff)}] 부여.`);
            }
        },
        'suicide': (ctx, eff) => {
            ctx.source.hp = 0;
        },
        'chance_debuff': (ctx, eff) => {
            if (Math.random() < eff.chance) {
                ctx.target.buffs[eff.id] = eff.duration || 1;
                ctx.logFn(`<b>성공!</b> ${ctx.target === ctx.source ? '자신' : '적'}에게 [${getBuffName(eff.id)}] 부여.`);
            } else {
                ctx.logFn(`[${getBuffName(eff.id)}] 부여 <b>실패</b>.`);
            }
        },
        'conditional_field_debuff': (ctx, eff) => {
            if (ctx.battle.fieldBuffs.some(b => b.name === eff.field)) {
                eff.debuffs.forEach(d => {
                    ctx.target.buffs[d] = 1;
                    ctx.logFn(`조건 만족! [${getBuffName(d)}] 부여.`);
                });
            }
        },
        'clear_target_debuffs': (ctx, eff) => {
            const count = Object.keys(ctx.target.buffs).length;
            ctx.target.buffs = {};
            if (count > 0) ctx.logFn(`적의 모든 디버프를 제거했습니다! (${count}개)`);
        },
        'consume_all_burn_cond_buff': (ctx, eff) => {
            if (ctx.target.buffs['burn']) {
                delete ctx.target.buffs['burn'];
                ctx.applyFieldBuff('sun_bless');
                ctx.logFn("작열 스택을 모두 소모하여 태양의 축복을 불러옵니다!");
            } else {
                ctx.applyFieldBuff('earth_bless');
                ctx.logFn("소모할 작열이 없어 대지의 축복을 불러옵니다.");
            }
        },
        'check_divine_3_stun_else_add': (ctx, eff) => {
            if ((ctx.target.buffs['divine'] || 0) >= 3) {
                ctx.target.buffs['stun'] = 1;
                ctx.logFn("디바인 3스택 확인! 적을 기절시킵니다!");
            } else {
                ctx.target.buffs['divine'] = (ctx.target.buffs['divine'] || 0) + 1;
                if (ctx.target.buffs['divine'] > 3) ctx.target.buffs['divine'] = 3;
                ctx.logFn("디바인 스택 추가.");
            }
        },
        'random_debuff_consume_divine': (ctx, eff) => {
            let pool = ['curse', 'darkness', 'silence', 'weak', 'corrosion'];
            let count = 1;
            if (ctx.target.buffs['divine'] > 0) {
                ctx.target.buffs['divine']--;
                if (ctx.target.buffs['divine'] <= 0) delete ctx.target.buffs['divine'];
                count = 2;
                ctx.logFn("디바인을 소모하여 효과 강화! (디버프 2개 부여)");
            }

            pool.sort(() => 0.5 - Math.random());
            for (let i = 0; i < count; i++) {
                ctx.target.buffs[pool[i]] = 1;
                ctx.logFn(`적에게 [${getBuffName(pool[i])}] 부여.`);
            }
        },
        'roulette_field': (ctx, eff) => {
            ctx.battle.fieldBuffs = [];
            ctx.logFn("모든 필드 버프가 제거되었습니다!");

            const buffs = ['sun_bless', 'moon_bless', 'sanctuary', 'goddess_descent', 'earth_bless', 'twinkle_party', 'star_powder'];
            const pick = buffs[Math.floor(Math.random() * buffs.length)];
            ctx.applyFieldBuff(pick);
        },
        'wild_card_debuff': (ctx, eff) => {
            const badBuffs = ['curse', 'darkness', 'silence', 'weak', 'corrosion', 'burn', 'divine', 'stun'];
            let cleansed = 0;
            badBuffs.forEach(b => {
                if (ctx.target.buffs[b]) {
                    delete ctx.target.buffs[b];
                    cleansed++;
                }
            });
            if (cleansed > 0) ctx.logFn(`적의 디버프를 모두 해제했습니다! (${cleansed}개)`);

            let pool = ['curse', 'darkness', 'silence', 'weak', 'corrosion', 'burn', 'divine'];
            pool.sort(() => 0.5 - Math.random());

            for (let i = 0; i < 2; i++) {
                if (pool[i] === 'burn' || pool[i] === 'divine') {
                    ctx.target.buffs[pool[i]] = (ctx.target.buffs[pool[i]] || 0) + 1;
                    if (ctx.target.buffs[pool[i]] > 3) ctx.target.buffs[pool[i]] = 3;
                    ctx.logFn(`적에게 [${getBuffName(pool[i])}] 스택 추가.`);
                } else {
                    ctx.target.buffs[pool[i]] = 1;
                    ctx.logFn(`적에게 [${getBuffName(pool[i])}] 부여.`);
                }
            }
        },
        'delayed_attack_field': (ctx, eff) => {
            if (eff.field) ctx.applyFieldBuff(eff.field);
        },
        'delayed_turn_scale_attack': (ctx, eff) => {
            ctx.battle.delayedEffects.push({
                turn: ctx.battle.turn + eff.turns,
                source: ctx.source,
                skill: { ...ctx.skill, effects: [...(ctx.skill.effects || []), { type: 'dmg_boost_turn_scale', scale: eff.scale, startTurn: ctx.battle.turn }] }
            });
            ctx.logFn(`인과역전! ${eff.turns}턴 후 발동합니다!`);
        },
        'delayed_attack_debuff_scale': (ctx, eff) => {
            ctx.battle.delayedEffects.push({
                turn: ctx.battle.turn + eff.turns,
                source: ctx.source,
                skill: { ...ctx.skill, effects: [...(ctx.skill.effects || []), { type: 'dmg_boost', condition: 'target_debuff_count_scale', multPerDebuff: eff.multPerDebuff }] }
            });
            ctx.logFn(`제로그라비티! ${eff.turns}턴 후 발동합니다!`);
        },
        'random_skill_trigger_from_list': (ctx, eff) => {
            const skillMap = [
                { id: 'gold_dragon', skill: '얼티밋브레스' },
                { id: 'zeke', skill: '라그나로크' },
                { id: 'jasmine', skill: '여신강림' },
                { id: 'frozen_witch', skill: '블리자드' },
                { id: 'behemoth', skill: '어스퀘이크' },
                { id: 'gray', skill: '차원절단' },
                { id: 'rumi', skill: '밀키웨이엑스터시' },
                { id: 'phoenix', skill: '메테오임팩트' },
                { id: 'time_ruler', skill: '섀도우트위스트' }
            ];

            const pick = skillMap[Math.floor(Math.random() * skillMap.length)];
            const card = ctx.getCardData(pick.id);
            if (!card) return;
            const skill = card.skills.find(s => s.name === pick.skill);

            if (skill) {
                const delayedEff = skill.effects && skill.effects.find(e => e.type === 'delayed_attack' || e.type === 'delayed_attack_field' || e.type === 'delayed_random_attack');

                if (delayedEff) {
                    ctx.logFn(`[데스티니룰렛] ${card.name}의 ${skill.name} 발동!`);
                    ctx.battle.delayedEffects.push({
                        turn: ctx.battle.turn + delayedEff.turns,
                        source: ctx.source,
                        skill: skill
                    });
                    ctx.logFn(`(지연 발동) ${delayedEff.turns}턴 뒤에 공격합니다.`);
                } else {
                    ctx.logFn(`[데스티니룰렛] ${card.name}의 ${skill.name} 발동!`);
                    ctx.executeSkill(ctx.source, ctx.target, skill, true);
                }
            }
        },
        'apply_lumi_guard': (ctx, eff) => {
            let buffs = ctx.battle.fieldBuffs.map(b => b.name);
            if (buffs.includes('star_powder')) {
                ctx.source.buffs['guard'] = 1;
                ctx.logFn("스타파우더: 가드 효과(버프) 적용!");
            }
        },
        'random_field_buff_lumi': (ctx, eff) => {
            const buffs = ['sun_bless', 'moon_bless', 'star_powder'];
            const pick = buffs[Math.floor(Math.random() * buffs.length)];
            ctx.applyFieldBuff(pick);
            ctx.logFn(`코스믹 하모니: [${getBuffName(pick)}] 생성!`);
        },
        'dream_form_execute': (ctx, eff) => {
            if (ctx.battle.fieldBuffs.length > 0) {
                let logMsg = [];
                ctx.battle.fieldBuffs.forEach(b => {
                    switch (b.name) {
                        case 'earth_bless':
                            ctx.source.hp = ctx.source.maxHp;
                            logMsg.push("대지(완전회복)");
                            break;
                        case 'star_powder':
                            ctx.source.mp = Math.min(GAME_CONSTANTS.MAX_MP, ctx.source.mp + 30);
                            logMsg.push("스타(MP+30)");
                            break;
                        case 'sanctuary':
                            ctx.source.mp = Math.min(GAME_CONSTANTS.MAX_MP, ctx.source.mp + 20);
                            logMsg.push("성역(MP+20)");
                            break;
                        case 'goddess_descent':
                            ctx.target.buffs['stun'] = 1;
                            logMsg.push("여신(기절)");
                            break;
                    }
                });
                if (logMsg.length > 0) ctx.logFn(`[꿈의형태] 초월 효과 발동! (${logMsg.join(', ')})`);
                ctx.logFn(`[꿈의형태] 모든 필드 버프가 소모되었습니다.`);
                ctx.battle.fieldBuffs.length = 0;
            }
        }
    },
    apply: function (ctx, eff) {
        const handler = this.handlers[eff.type];
        if (handler) handler(ctx, eff);
    }
};

const Logic = {
    // 1. Stats Calculation
    calculateStats: function (char, fieldBuffs, mode, artifacts) {
        if (!artifacts) artifacts = [];
        // Base stats
        let stats = {
            atk: char.atk,
            matk: char.matk,
            def: char.def,
            mdef: char.mdef,
            crit: (char.baseCrit || 10),
            evasion: (char.baseEva || 0) + 5
        };

        // Blessings
        if (char.blessing) {
            stats.crit += 10;
            stats.evasion += 5;
        }

        // Check if character is Player (has proto)
        const isPlayer = !!char.proto;

        // Traits
        const trait = char.proto ? char.proto.trait : null;
        if (trait) {
            if (trait.type === 'cond_no_field_buff_eva_crit' && fieldBuffs.length === 0) {
                stats.evasion += trait.val;
                stats.crit += trait.val;
            }
            if (trait.type === 'luna_jasmine_trait' && fieldBuffs.some(b => b.name === 'goddess_descent')) {
                stats.evasion += 25;
                stats.crit += 25;
            }
        }

        // Multipliers
        let m = { atk: 1.0, matk: 1.0, def: 1.0, mdef: 1.0 };

        // Handle Mushroom King here properly
        if (trait && trait.type === 'cond_earth_def_mdef' && fieldBuffs.some(b => b.name === 'earth_bless')) {
            m.def += 0.5;
            m.mdef += 0.5;
        }

        // Field Buffs (Only apply to Allies)
        if (isPlayer) {
            let buffMult = (mode === 'flood') ? 2.0 : 1.0;
            fieldBuffs.forEach(fb => {
                const bonus = GAME_CONSTANTS.FIELD_BUFF_STATS[fb.name];
                if (bonus) {
                    // Artifact: nature_blessing — double earth_bless effect
                    let artifactBuffMult = 1.0;
                    if (fb.name === 'earth_bless' && artifacts.includes('nature_blessing')) artifactBuffMult = 2.0;
                    // Artifact: milkshake — double star_powder effect
                    if (fb.name === 'star_powder' && artifacts.includes('milkshake')) artifactBuffMult = 2.0;

                    if (bonus.atk) m.atk += (bonus.atk * buffMult * artifactBuffMult);
                    if (bonus.matk) m.matk += (bonus.matk * buffMult * artifactBuffMult);
                    if (bonus.def) m.def += (bonus.def * buffMult * artifactBuffMult);
                    if (bonus.mdef) m.mdef += (bonus.mdef * buffMult * artifactBuffMult);
                    if (bonus.crit) stats.crit += (bonus.crit * buffMult * artifactBuffMult);
                    if (bonus.evasion) stats.evasion += (bonus.evasion * buffMult * artifactBuffMult);
                }
            });
        }

        // Trait Multipliers
        if (trait) {
            if (trait.type === 'cond_twinkle_all' && fieldBuffs.some(b => b.name === 'twinkle_party')) {
                m.atk += 0.3; m.matk += 0.3;
            }
        }

        // Char Buffs/Debuffs
        let debuffMult = (mode === 'curse') ? 2.0 : 1.0;

        if (char.buffs['weak']) m.atk -= (0.2 * debuffMult);
        if (char.buffs['silence']) m.matk -= (0.2 * debuffMult);
        if (char.buffs['evasion']) stats.evasion += 50;
        if (char.buffs['curse']) m.mdef -= (0.2 * debuffMult);

        let defRed = 0.0;
        if (char.buffs['darkness'] && char.buffs['corrosion']) defRed = 0.4;
        else if (char.buffs['darkness'] || char.buffs['corrosion']) defRed = 0.2;
        // Artifact: assassin_nail — double darkness def reduction
        if (artifacts.includes('assassin_nail') && (char.buffs['darkness'] || char.buffs['corrosion'])) {
            defRed *= 2.0;
        }
        m.def -= (defRed * debuffMult);

        // Artifact: shadow_ball — darkness also reduces mdef
        if (artifacts.includes('shadow_ball') && char.buffs['darkness']) {
            let mdefRed = 0.2;
            if (artifacts.includes('assassin_nail')) mdefRed *= 2.0;
            m.mdef -= (mdefRed * debuffMult);
        }

        // Artifact: veil_of_darkness — dark element crit/eva +10%
        if (isPlayer && artifacts.includes('veil_of_darkness') && char.proto && char.proto.element === 'dark') {
            stats.crit += 10;
            stats.evasion += 10;
        }

        // Artifact: rabbit_hole — specific rabbits crit/eva +20%
        if (isPlayer && artifacts.includes('rabbit_hole') && char.proto) {
            const rabbitIds = ['snow_rabbit', 'night_rabbit', 'silver_rabbit'];
            if (rabbitIds.includes(char.proto.id)) {
                stats.crit += 20;
                stats.evasion += 20;
            }
        }

        // Artifact: shadow_stab — eva +20%, def/mdef -30%
        if (isPlayer && artifacts.includes('shadow_stab')) {
            stats.evasion += 20;
            m.def -= 0.3;
            m.mdef -= 0.3;
        }

        // Apply Multipliers
        stats.atk = Math.floor(stats.atk * Math.max(0, m.atk));
        stats.matk = Math.floor(stats.matk * Math.max(0, m.matk));
        stats.def = Math.floor(stats.def * Math.max(0, m.def));
        stats.mdef = Math.floor(stats.mdef * Math.max(0, m.mdef));

        return stats;
    },

    // 2. Evasion Check
    checkEvasion: function (target, skillType, fieldBuffs, mode, artifacts) {
        const stats = this.calculateStats(target, fieldBuffs, mode, artifacts);
        return Math.random() * 100 < stats.evasion;
    },

    // 3. Damage Calculation
    calculateDamage: function (source, target, skill, fieldBuffs, activeTraits, logFn, mode, deck, turn, artifacts) {
        if (!logFn) logFn = function () { };
        if (!artifacts) artifacts = [];

        if (skill.type !== 'phy' && skill.type !== 'mag') return { dmg: 0, isCrit: false };

        const srcStats = this.calculateStats(source, fieldBuffs, mode, artifacts);
        const tgtStats = this.calculateStats(target, fieldBuffs, mode, artifacts);

        // 1. Critical
        let isCrit = Math.random() * 100 < srcStats.crit;
        if (skill.effects && skill.effects.some(e => e.type === 'force_crit')) isCrit = true;
        // Check force_crit_chance
        const forceCritChance = skill.effects ? skill.effects.find(e => e.type === 'force_crit_chance') : null;
        if (forceCritChance && Math.random() * 100 < forceCritChance.val) isCrit = true;

        let critDmg = 1.5;
        if (source.proto && fieldBuffs.some(b => b.name === 'sun_bless')) critDmg += GAME_CONSTANTS.SUN_BLESS_CRIT_BONUS;
        if (source.proto && fieldBuffs.some(b => b.name === 'reaper_realm')) critDmg += 0.4;

        let val = (skill.type === 'phy') ? srcStats.atk : srcStats.matk;
        if (isCrit) val *= critDmg;

        // 2. Skill Multiplier & Bonuses

        // Context for Handlers
        let ctx = {
            source: source,
            target: target,
            skill: skill,
            fieldBuffs: fieldBuffs, // handlers may modify this array
            activeTraits: activeTraits,
            logFn: logFn,
            mode: mode,
            deck: deck,
            turn: turn,
            mult: skill.val || 1.0,
            ignoreMdefRate: 0
        };

        // Elemental
        if (source.proto && source.proto.element && target.element) {
            let elMult = this.getElementalMultiplier(source.proto.element, target.element);
            if (source.proto.trait && source.proto.trait.type === 'all_advantage') elMult = 1.2;

            if (elMult > 1.0) {
                val *= elMult;
                logFn("상성 우위! 대미지 20% 증가.");
            }
        }

        // Skill Effects affecting Multiplier
        if (skill.effects) {
            skill.effects.forEach(eff => {
                const handler = DAMAGE_EFFECT_HANDLERS[eff.type];
                if (handler) {
                    handler(ctx, eff);
                } else {
                    // Fallback for types not in DAMAGE_EFFECT_HANDLERS (side effects)
                    // Do nothing here, handled in RPG.applySkillEffects
                }
            });
        }

        let mult = ctx.mult;
        let dmgBonus = 0.0;

        // Trait Multipliers
        const t = source.proto ? source.proto.trait : null;
        if (t) {
            if (t.type === 'cond_darkness_dmg' && target.buffs.darkness) {
                dmgBonus += (t.val - 1.0);
                logFn(`[특성] 타천사: 암흑 속에서 힘이 솟구칩니다!`);
            }
            if (t.type === 'cond_silence_dmg' && target.buffs.silence) {
                dmgBonus += (t.val - 1.0);
                logFn(`[특성] ${source.name}: 침묵 대상 추가 피해!`);
            }
            if (t.type === 'cond_corrosion_dmg' && target.buffs.corrosion) {
                dmgBonus += (t.val - 1.0);
                logFn(`[특성] ${source.name}: 부식 대상 추가 피해!`);
            }
            if (t.type === 'cond_debuff_3_dmg' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 디버프 3개 이상 대상 추가 피해!");
            }
            if (t.type === 'cond_divine_3_dmg' && (target.buffs.divine || 0) >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 디바인 3스택 이상 대상 추가 피해!");
            }
            if (t.type === 'behemoth_trait' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 베히모스: 디버프 3개 이상 대상 파괴적 일격!");
            }
            if (t.type === 'cond_target_debuff_3_dmg' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 심해의 주인: 적 디버프 3개 이상! 위력 폭발!");
            }
            if (t.type === 'luna_jasmine_trait' && (target.buffs['divine'] || 0) >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 루나&자스민: 디바인 3스택 이상! 위력 2배!");
            }
            if (t.type === 'behemoth_liberated_trait' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 해방된 베히모스: 디버프 3개 이상! 파괴적 일격!");
            }
        }

        // Defense
        let def = (skill.type === 'phy') ? tgtStats.def : tgtStats.mdef;

        if (ctx.ignoreMdefRate > 0 && skill.type === 'mag') {
            let ignore = Math.floor(tgtStats.mdef * ctx.ignoreMdefRate);
            def = Math.max(0, def - ignore);
            logFn(`[효과] 마법방어력 ${Math.round(ctx.ignoreMdefRate * 100)}% 관통!`);
        }

        // Artifact: flame_piercing — burn stacks x 10% physical defense penetration
        if (artifacts.includes('flame_piercing') && skill.type === 'phy' && target.buffs['burn']) {
            let burnPen = target.buffs['burn'] * 0.1;
            let ignore = Math.floor(tgtStats.def * burnPen);
            def = Math.max(0, def - ignore);
            logFn(`[아티팩트] 플레임피어싱: 작열 ${target.buffs['burn']}스택! 방어력 ${Math.round(burnPen * 100)}% 관통!`);
        }

        // Artifact: divine_piercing — divine stacks x 10% magic defense penetration
        if (artifacts.includes('divine_piercing') && skill.type === 'mag' && target.buffs['divine']) {
            let divinePen = target.buffs['divine'] * 0.1;
            let ignore = Math.floor(tgtStats.mdef * divinePen);
            def = Math.max(0, def - ignore);
            logFn(`[아티팩트] 디바인피어싱: 디바인 ${target.buffs['divine']}스택! 마법방어력 ${Math.round(divinePen * 100)}% 관통!`);
        }

        // Artifact: ice_break — triple damage to stunned targets
        if (artifacts.includes('ice_break') && target.buffs['stun']) {
            mult *= 3.0;
            logFn(`[아티팩트] 아이스브레이크: 스턴 중인 적에게 대미지 3배!`);
        }

        // [추가] 신데렐라: 스택 비례 방어 무시
        if (t && t.type === 'ignore_def_mdef_by_stack') {
            let ignoreRate = 0;
            if (skill.type === 'phy' && target.buffs['burn']) {
                ignoreRate = target.buffs['burn'] * t.val;
                logFn(`[특성] 유리구두: 작열 ${target.buffs['burn']}스택! 방어력 ${Math.round(ignoreRate * 100)}% 무시!`);
            }
            else if (skill.type === 'mag' && target.buffs['divine']) {
                ignoreRate = target.buffs['divine'] * t.val;
                logFn(`[특성] 유리구두: 디바인 ${target.buffs['divine']}스택! 마법방어력 ${Math.round(ignoreRate * 100)}% 무시!`);
            }

            if (ignoreRate > 0) {
                let baseDef = (skill.type === 'phy') ? target.def : target.mdef;
                def = Math.max(0, def - Math.floor(baseDef * ignoreRate));
            }
        }

        // Gray Trait: Ignore Def
        if (t && t.type === 'crit_ignore_def_add' && isCrit) {
            let ignore = t.val;
            let baseDef = (skill.type === 'phy') ? target.def : target.mdef;
            def = Math.max(0, def - Math.floor(baseDef * ignore));
            logFn("[특성] 치명타! 적 방어력 50% 추가 무시!");
        }

        // [초월 루미: 꿈의형태 리워크 로직]
        if (skill.name === '꿈의형태' && fieldBuffs.length > 0) {
            let logMsg = [];

            // 1. 효과 적립
            fieldBuffs.forEach(b => {
                switch (b.name) {
                    case 'sun_bless': // 태양: 2배율 + 확정 치명타
                        mult += 2.0;
                        isCrit = true;
                        logMsg.push("태양(2.0배/치명)");
                        break;
                    case 'moon_bless': // 달: 마방 30% 관통 + 1배율
                        {
                            let ignore = Math.floor(tgtStats.mdef * 0.3);
                            def = Math.max(0, def - ignore);
                            mult += 1.0;
                            logMsg.push(`달(관통 ${ignore}/1.0배)`);
                        }
                        break;
                    case 'star_powder': // 스타파우더: 1배율
                        mult += 1.0;
                        logMsg.push("스타(1.0배)");
                        break;
                    case 'earth_bless': // 대지: 2배율
                        mult += 2.0;
                        logMsg.push("대지(2.0배)");
                        break;
                    case 'sanctuary': // 성역: 2배율
                        mult += 2.0;
                        logMsg.push("성역(2.0배)");
                        break;
                    case 'goddess_descent': // 여신강림: 4배율
                        mult += 4.0;
                        logMsg.push("여신(4.0배)");
                        break;
                    case 'reaper_realm': // 사신강림: 마방 50% 관통 + 1배율
                        {
                            let ignore = Math.floor(tgtStats.mdef * 0.5);
                            def = Math.max(0, def - ignore);
                            mult += 1.0;
                            logMsg.push(`사신(관통 ${ignore}/1.0배)`);
                        }
                        break;
                    case 'twinkle_party': // 트윙클: 3배율
                        mult += 3.0;
                        logMsg.push("트윙클(3.0배)");
                        break;
                }
            });

            // 2. 로그 출력 (버프 소모 제거 -> SideEffect로 이동)
            logFn(`[꿈의형태] 필드 버프 ${fieldBuffs.length}개 융합 계산! (${logMsg.join(', ')})`);
        }

        // Artifact: death_roulette — double all skill damage
        if (artifacts.includes('death_roulette')) {
            mult *= 2.0;
        }

        // Final Calculation
        let finalMult = mult * (1.0 + dmgBonus);
        let finalDmg = Math.floor(val * finalMult * (100 / (100 + def)));

        return { dmg: finalDmg, isCrit: isCrit, luckyVicky: artifacts.includes('lucky_vicky') && isCrit };
    },

    // 4. Initial Stats Calculation
    calculateInitialStats: function (playerProto, deck, allCards, idx) {
        // Base stats copy
        let p = {
            maxHp: playerProto.stats.hp, hp: playerProto.stats.hp, mp: 100,
            atk: playerProto.stats.atk, matk: playerProto.stats.matk,
            def: playerProto.stats.def, mdef: playerProto.stats.mdef,
            baseCrit: 10, baseEva: 0
        };

        // Filter active cards
        const activeCards = deck.map(id => id ? allCards.find(c => c.id === id) : null).filter(c => c);
        const jokerInDeck = deck.includes('joker');

        const countEl = (el) => activeCards.filter(c => c.element === el || c.id === 'joker').length;
        const hasEl = (el) => activeCards.some(c => c.element === el || c.id === 'joker');

        // Traits
        const t = playerProto.trait;
        let active = false;

        // Synergy Traits
        if (t.type.startsWith('syn_')) {
            if (t.type === 'syn_nature_3_all' && countEl('nature') >= 3) active = true;
            else if (t.type === 'syn_nature_3_golem' && countEl('nature') >= 3) active = true;
            else if (t.type === 'syn_water_3_ice_age' && countEl('water') >= 3) active = true;
            else if (t.type === 'syn_fire_3_crit' && countEl('fire') >= 3) active = true;
            else if (t.type === 'syn_dark_3_matk' && countEl('dark') >= 3) active = true;
            else if (t.type === 'syn_light_fire_atk' && hasEl('light') && hasEl('fire')) active = true;
            else if (t.type === 'syn_light_dark_matk_mdef' && hasEl('light') && hasEl('dark')) active = true;
            else if (t.type === 'syn_water_nature' && hasEl('water') && hasEl('nature')) active = true;
            else if (t.type === 'syn_nature_3_matk' && countEl('nature') >= 3) active = true;
            else if (t.type === 'syn_night_rabbit' && (deck.includes('night_rabbit') || deck.includes('silver_rabbit') || jokerInDeck)) active = true;
            else if (t.type === 'syn_snow_rabbit' && (deck.includes('snow_rabbit') || deck.includes('silver_rabbit') || jokerInDeck)) active = true;
            else if (t.type === 'syn_silver_rabbit' && (deck.includes('snow_rabbit') || deck.includes('night_rabbit') || jokerInDeck)) active = true;
            else if (t.type === 'syn_water_3_atk_matk' && countEl('water') >= 3) active = true;
            else if (t.type === 'syn_fire_3_crit_burn' && countEl('fire') >= 3) active = true;
            else if (t.type === 'syn_dark_3_matk_boost' && countEl('dark') >= 3) active = true;
            else if (t.type === 'syn_water_2_moon_twinkle' && countEl('water') >= 2) active = true;

            if (active) {
                if (t.type === 'syn_nature_3_all') { p.atk *= 1.3; p.matk *= 1.3; p.def *= 1.3; p.mdef *= 1.3; }
                if (t.type === 'syn_nature_3_golem') { p.atk *= 1.3; p.def *= 1.3; }
                if (t.type === 'syn_nature_3_matk') p.matk *= 1.5;
                if (t.type === 'syn_fire_3_crit') p.baseCrit += 30;
                if (t.type === 'syn_dark_3_matk') p.matk *= 1.5;
                if (t.type === 'syn_light_fire_atk') p.atk *= 1.3;
                if (t.type === 'syn_light_dark_matk_mdef') { p.matk *= 1.3; p.mdef *= 1.3; }
                if (t.type === 'syn_night_rabbit') { p.matk *= 1.5; p.mdef *= 1.5; }
                if (t.type === 'syn_snow_rabbit') { p.atk *= 1.5; p.def *= 1.5; }
                if (t.type === 'syn_silver_rabbit') { p.atk *= 1.5; p.matk *= 1.5; }
                if (t.type === 'syn_water_3_atk_matk') { p.atk *= 1.5; p.matk *= 1.5; }
                if (t.type === 'syn_fire_3_crit_burn') p.baseCrit += t.val;
                if (t.type === 'syn_dark_3_matk_boost') p.matk *= (1 + t.val / 100);

                p.atk = Math.floor(p.atk); p.matk = Math.floor(p.matk);
                p.def = Math.floor(p.def); p.mdef = Math.floor(p.mdef);
            }
        }

        // Positional Traits (Generalized)
        if (t.type === 'pos_stat_boost' && idx !== undefined) {
            if (t.pos === idx) {
                let stats = Array.isArray(t.stat) ? t.stat : [t.stat];
                stats.forEach(s => {
                    if (s === 'atk') p.atk *= (1 + t.val / 100);
                    if (s === 'matk') p.matk *= (1 + t.val / 100);
                    if (s === 'def') p.def *= (1 + t.val / 100);
                    if (s === 'mdef') p.mdef *= (1 + t.val / 100);
                });
                p.atk = Math.floor(p.atk); p.matk = Math.floor(p.matk);
                p.def = Math.floor(p.def); p.mdef = Math.floor(p.mdef);
            }
        }

        if (t.type === 'rabbit_synergy_boost') {
            const rabbits = ['night_rabbit', 'snow_rabbit', 'silver_rabbit', 'trans_yeon_rabbit', 'joker'];
            let count = 0;
            deck.forEach(id => { if (id && rabbits.includes(id)) count++; });
            if (count > 0) {
                let boost = count * (t.val / 100);
                p.atk = Math.floor(p.atk * (1 + boost));
                p.matk = Math.floor(p.matk * (1 + boost));
            }
        }

        // Artifact: dragon_heart — dragon cards matk +50%
        const artifacts = (typeof RPG !== 'undefined' && RPG.state && RPG.state.artifacts) ? RPG.state.artifacts : [];
        if (artifacts.includes('dragon_heart')) {
            const dragonIds = ['baby_dragon', 'red_dragon', 'gold_dragon'];
            if (dragonIds.includes(playerProto.id)) {
                p.matk = Math.floor(p.matk * 1.5);
            }
        }

        return { stats: p, activeTrait: active ? t.type : null };
    },

    // 5. Enemy AI
    decideEnemyAction: function (enemy, turn) {
        let skill = null;
        let r = Math.random();

        if (enemy.id === 'artificial_demon_god') {
            if (turn === 10) skill = enemy.skills.find(s => s.name === '파괴의형태');
            else if (r < 0.3) skill = enemy.skills.find(s => s.name === '아이스빔');
        }
        else if (enemy.id === 'iris_love') {
            if (turn === 7) skill = enemy.skills.find(s => s.name === '소울드레인');
            else if (r < 0.1) skill = enemy.skills.find(s => s.name === '더홀리');
            else if (r < 0.4) skill = enemy.skills.find(s => s.name === '홀리레이');
        }
        else if (enemy.id === 'iris_curse') {
            if (turn === 10) skill = enemy.skills.find(s => s.name === '아포칼립스');
            else if (r < 0.3) skill = enemy.skills.find(s => s.name === '프레임샷');
        }
        else if (enemy.id === 'pharaoh') {
            if (turn % 5 === 0) skill = enemy.skills.find(s => s.name === '고대의저주');
            else if (r < 0.3) skill = enemy.skills.find(s => s.name === '고대의힘');
        }
        else if (enemy.id === 'demon_god') {
            if (turn === 7 || turn === 14) skill = enemy.skills.find(s => s.name === '제노사이드');
            else if (r < 0.2) skill = enemy.skills.find(s => s.name === '다크니스');
        }
        else if (enemy.id === 'creator_god') {
            if (enemy.isCharging) {
                const chargedSkill = enemy.skills.find(s => s.name === '디바인블레이드');
                return { ...chargedSkill, chargeReset: true };
            }
            else if (turn === 1) {
                return { type: 'phy', val: 1.0, name: '일반 공격' };
            }
            else if (turn === 2) {
                skill = enemy.skills.find(s => s.name === '저지먼트');
            }
            else {
                if (r < 0.3) {
                    if (turn > 15) skill = enemy.skills.find(s => s.name === '저지먼트');
                    else skill = enemy.skills.find(s => s.name === '홀리레이');
                }
                else if (r < 0.5) {
                    return { type: 'phy', val: 0, name: '차지', isChargeStart: true };
                }
                else {
                    return { type: 'phy', val: 1.0, name: '일반 공격' };
                }
            }
        }

        if (!skill && Math.random() < 0.3 && enemy.skills.length > 0) {
            const validSkills = enemy.skills.filter(s => s.rate > 0);
            if (validSkills.length > 0) {
                skill = validSkills[Math.floor(Math.random() * validSkills.length)];
            }
        }
        return skill || { type: 'phy', val: 1.0, name: '일반 공격' };
    },

    // 6. Handle Death Traits
    handleDeathTraits: function (victim, killer, fieldBuffs, logFn, deck, turn, artifacts) {
        if (!logFn) logFn = function () { };
        if (!artifacts) artifacts = [];

        let result = { damageToKiller: 0, fieldBuffsToAdd: [], killerDebuffs: {} };
        const t = victim.proto.trait;

        if (t.type === 'death_dmg_mag') {
            let dummySkill = { name: '사망 반격', type: 'mag', val: t.val, effects: [] };
            let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn, null, deck, turn);
            // Artifact: companion
            if (artifacts.includes('companion')) {
                 dmgResult.dmg *= 2;
                 logFn('[아티팩트] 길동무: 사망 반격 대미지 2배!');
            }
            if (dmgResult.dmg > 0) {
                result.damageToKiller += dmgResult.dmg;
                logFn(`[특성] 사망 반격! ${dmgResult.isCrit ? 'Critical! ' : ''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
            }
        }
        else if (t.type === 'death_dmg_debuff') {
            let cnt = Object.keys(killer.buffs).length;
            let dummySkill = { name: '저주 반격', type: 'mag', val: cnt * t.val, effects: [] };
            let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn, null, deck, turn);
            // Artifact: companion
            if (artifacts.includes('companion')) {
                 dmgResult.dmg *= 2;
                 logFn('[아티팩트] 길동무: 사망 반격 대미지 2배!');
            }
            if (dmgResult.dmg > 0) {
                result.damageToKiller += dmgResult.dmg;
                logFn(`[특성] 저주 반격! ${dmgResult.isCrit ? 'Critical! ' : ''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
            }
        }
        else if (t.type === 'death_field_sun') {
            result.fieldBuffsToAdd.push('sun_bless');
        }
        else if (t.type === 'death_debuff') {
            if (killer) {
                result.killerDebuffs[t.debuff] = 1;
                logFn(`[특성] 사망 효과 발동! 적에게 [${getBuffName(t.debuff)}] 부여.`);
            }
        }
        else if (t.type === 'death_sun_bless_chance') {
            if (Math.random() < t.val) {
                result.fieldBuffsToAdd.push('sun_bless');
                logFn(`[특성] 마시멜로가 녹으며 태양의 축복을 남깁니다!`);
            } else {
                logFn(`[특성] 마시멜로가 흔적도 없이 사라졌습니다... (축복 실패)`);
            }
        }
        else if (t.type === 'death_field_buff_count_dmg') {
            let count = fieldBuffs.length;
            let dummySkill = { name: '사망 반격', type: 'mag', val: count * t.val, effects: [] };
            let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn, null, deck, turn);
            // Artifact: companion
            if (artifacts.includes('companion')) {
                 dmgResult.dmg *= 2;
                 logFn('[아티팩트] 길동무: 사망 반격 대미지 2배!');
            }
            if (dmgResult.dmg > 0) {
                result.damageToKiller += dmgResult.dmg;
                logFn(`[특성] 사망 반격! (필드버프 ${count}개) ${dmgResult.isCrit ? 'Critical! ' : ''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
            }
        }
        else if (t.type === 'death_twinkle') {
            result.fieldBuffsToAdd.push('twinkle_party');
            logFn(`[특성] 헬하운드 사망! 트윙클 파티 발동!`);
        }

        // ─── Artifact Death Effects ─────────────────────────────

        // Artifact: reverse — nature element death -> earth_bless field buff
        if (artifacts.includes('reverse') && victim.proto && victim.proto.element === 'nature') {
            result.fieldBuffsToAdd.push('earth_bless');
            logFn(`[아티팩트] 리버스: 자연속성 카드 사망! 대지의 축복 부여!`);
        }

        // Artifact: frozen_body — water element death -> stun on killer
        if (artifacts.includes('frozen_body') && victim.proto && victim.proto.element === 'water') {
            if (killer) {
                result.killerDebuffs['stun'] = 1;
                logFn(`[아티팩트] 프로즌바디: 물속성 카드 사망! 적에게 스턴 부여!`);
            }
        }

        // Artifact: big_bang — legend/transcendence death -> 3x physical self-destruct
        if (artifacts.includes('big_bang') && victim.proto) {
            const grade = victim.proto.grade;
            if (grade === 'legend' || grade === 'transcendence') {
                let dummySkill = { name: '빅뱅', type: 'phy', val: 3.0, effects: [] };
                let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn, null, deck, turn);
                // Artifact: companion
                if (artifacts.includes('companion')) {
                     dmgResult.dmg *= 2;
                     logFn('[아티팩트] 길동무: 빅뱅 자폭 대미지 2배!');
                }
                if (dmgResult.dmg > 0) {
                    result.damageToKiller += dmgResult.dmg;
                    logFn(`[아티팩트] 빅뱅! 전설/초월 카드 자폭! <span class="log-dmg">${dmgResult.dmg}</span> 피해!`);
                }
            }
        }

        return result;
    },

    getElementalMultiplier: function (atkEl, defEl) {
        if (atkEl === 'water' && defEl === 'fire') return 1.2;
        if (atkEl === 'fire' && defEl === 'nature') return 1.2;
        if (atkEl === 'nature' && defEl === 'water') return 1.2;
        if ((atkEl === 'light' && defEl === 'dark') || (atkEl === 'dark' && defEl === 'light')) return 1.2;
        return 1.0;
    },

    getBuffName: getBuffName
};
