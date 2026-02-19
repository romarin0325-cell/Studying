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
        draft: 5
    },
    DECK_SIZE: 3,
    MAX_RECORDS: 5,
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
        'reaper_realm': { crit: 40 }
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
