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
    { id: 'double_attack', name: '더블어택', desc: '일반공격 위력 1.5배' },
    { id: 'death_roulette', name: '데스룰렛', desc: '모든 스킬 대미지 2배, 스킬 사용시 30% 확률로 사망' },
    { id: 'shadow_stab', name: '섀도우스탭', desc: '회피율 20%증가, 방어력과 마법방어력 30% 감소' },
    { id: 'dragon_heart', name: '드래곤하트', desc: '베이비드래곤/레드드래곤/골드드래곤 마공 50% 증가' },
    { id: 'big_bang', name: '빅뱅', desc: '전설/초월 카드 사망시 물리 3배율 자폭대미지' }
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
