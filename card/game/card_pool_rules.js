(function () {
    const EXTRA_LIMIT = 15;
    const PRESET_COUNT = 3;
    const NEW_SET_SIZE = 40;
    const GRADES = Object.freeze(['normal', 'rare', 'epic', 'legend']);
    const ALLOWED_SET_IDS = Object.freeze(['classic', 'ember_relay', 'twilight_liturgy', 'starlit_garden', 'midnight_tide', 'arena_company']);

    function cloneIds(ids) {
        return Array.isArray(ids) ? ids.slice() : [];
    }

    function uniquePreserve(ids) {
        const seen = new Set();
        const out = [];
        (ids || []).forEach(id => {
            if (typeof id !== 'string' || !id || seen.has(id)) return;
            if (id === '__proto__' || id === 'constructor' || id === 'prototype') return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function catalogueList(catalogue) {
        return Array.isArray(catalogue) ? catalogue : [];
    }

    function byId(catalogue) {
        const map = new Map();
        catalogueList(catalogue).forEach(card => {
            if (card && typeof card.id === 'string') map.set(card.id, card);
        });
        return map;
    }

    function isEligibleOriginalGrade(grade) {
        return GRADES.indexOf(grade) >= 0;
    }

    function isClassicBaseCard(card) {
        if (!card || card.battleOnly || card.hide_from_gacha) return false;
        if (card.unlockSource === 'bonus' || card.unlockSource === 'hidden' || card.unlockSource === 'special') return false;
        if (card.specialBaseId) return false;
        return isEligibleOriginalGrade(card.grade);
    }

    function flattenSetCards(set) {
        if (!set) return [];
        if (set.resolver === 'existing_original_base_card_predicate') return null;
        const out = [];
        GRADES.forEach(grade => {
            (set.cardsByGrade && set.cardsByGrade[grade] || []).forEach(id => out.push(id));
        });
        return out;
    }

    function emptyPresets() {
        return [
            { extraCardIds: [] },
            { extraCardIds: [] },
            { extraCardIds: [] }
        ];
    }

    function emptyProfile() {
        return {
            activePresetIndex: 0,
            presets: emptyPresets()
        };
    }

    const CardPoolRules = {
        EXTRA_LIMIT,
        PRESET_COUNT,
        NEW_SET_SIZE,
        GRADES,
        ALLOWED_SET_IDS,

        getSets() {
            return typeof BASIC_CARD_SETS !== 'undefined' ? BASIC_CARD_SETS : [];
        },

        getSet(setId) {
            return this.getSets().find(set => set.id === setId) || null;
        },

        getClassicBaseCardIds(catalogue) {
            const source = typeof CARDS !== 'undefined' ? CARDS : catalogueList(catalogue);
            return source.filter(isClassicBaseCard).map(card => card.id);
        },

        getSetBaseCardIds(set, catalogue) {
            if (!set) return [];
            if (set.resolver === 'existing_original_base_card_predicate') {
                return this.getClassicBaseCardIds(catalogue);
            }
            return flattenSetCards(set) || [];
        },

        validateSetDefinition(set, catalogue) {
            const errors = [];
            if (!set || !set.id) {
                return { ok: false, errors: ['missing_set'] };
            }
            if (set.resolver === 'existing_original_base_card_predicate') {
                const ids = this.getClassicBaseCardIds(catalogue);
                if (ids.length === 0) errors.push('classic_empty');
                return { ok: errors.length === 0, errors, ids };
            }
            const cards = set.cardsByGrade || {};
            const seen = new Set();
            GRADES.forEach(grade => {
                const list = cards[grade] || [];
                if (list.length !== 10) errors.push('grade_count:' + grade);
                list.forEach(id => {
                    if (seen.has(id)) errors.push('duplicate:' + id);
                    seen.add(id);
                    const card = byId(catalogue).get(id);
                    if (!card) errors.push('missing:' + id);
                    else if (card.battleOnly) errors.push('battleOnly:' + id);
                    else if (card.specialBaseId) errors.push('special:' + id);
                    else if (!isEligibleOriginalGrade(card.grade)) errors.push('ineligible:' + id);
                    else if (card.grade !== grade) errors.push('grade_mismatch:' + id);
                });
            });
            if (seen.size !== NEW_SET_SIZE) errors.push('size:' + seen.size);
            return { ok: errors.length === 0, errors, ids: Array.from(seen) };
        },

        inspectCardAvailability(card, context) {
            const unlocked = new Set(context && context.unlockedBonusIds || []);
            const released = new Set(context && context.releasedBonusIds || []);
            const hidden = new Set(context && context.hiddenBonusIds || []);
            const defaults = new Set(context && context.defaultUnlockedBonusIds || []);
            if (!card) return { status: 'definition_error', label: '세트 정의 오류' };
            if (card.battleOnly || card.specialBaseId || !isEligibleOriginalGrade(card.grade)) {
                return { status: 'definition_error', label: '세트 정의 오류' };
            }
            if (isClassicBaseCard(card)) {
                return { status: 'base', label: '기본 제공' };
            }
            if (card.unlockSource === 'hidden') {
                if (unlocked.has(card.id)) return { status: 'unlocked', label: '해금 완료' };
                return { status: 'locked', label: '미해금', path: '히든 보너스 미션' };
            }
            if (card.unlockSource === 'bonus') {
                if (card.releaseDate && !released.has(card.id) && !(context && context.ignoreReleaseDates)) {
                    return { status: 'unreleased', label: '공개 예정 ' + card.releaseDate, path: '일반 보너스 수집' };
                }
                if (defaults.has(card.id) || unlocked.has(card.id)) {
                    return { status: defaults.has(card.id) ? 'auto' : 'unlocked', label: defaults.has(card.id) ? '자동 제공' : '해금 완료' };
                }
                return { status: 'locked', label: '미해금', path: '일반 보너스 수집' };
            }
            if (hidden.has(card.id) && !unlocked.has(card.id)) {
                return { status: 'locked', label: '미해금', path: '히든 보너스 미션' };
            }
            return { status: 'unknown', label: '해금 방법 확인 필요', path: '해금 방법 확인 필요' };
        },

        isCardAvailable(card, context) {
            const info = this.inspectCardAvailability(card, context);
            return info.status === 'base' || info.status === 'unlocked' || info.status === 'auto';
        },

        getSetAvailability(set, context) {
            const catalogue = context && context.catalogue || [];
            const definition = this.validateSetDefinition(set, catalogue);
            if (!definition.ok) {
                return {
                    available: false,
                    definitionError: true,
                    readyCount: 0,
                    total: set && set.resolver === 'existing_original_base_card_predicate' ? definition.ids.length : NEW_SET_SIZE,
                    missingIds: [],
                    errors: definition.errors
                };
            }
            const ids = this.getSetBaseCardIds(set, catalogue);
            const map = byId(catalogue);
            const missingIds = [];
            let readyCount = 0;
            ids.forEach(id => {
                const card = map.get(id);
                if (this.isCardAvailable(card, context)) readyCount += 1;
                else missingIds.push(id);
            });
            return {
                available: missingIds.length === 0 && !definition.ok === false,
                definitionError: false,
                readyCount,
                total: ids.length,
                missingIds,
                errors: []
            };
        },

        getEligibleOriginalIds(catalogue, context) {
            const map = byId(catalogue);
            const ids = [];
            catalogueList(catalogue).forEach(card => {
                if (!card || !isEligibleOriginalGrade(card.grade)) return;
                if (card.battleOnly || card.specialBaseId || card.hide_from_gacha) return;
                if (this.isCardAvailable(card, context) || isClassicBaseCard(card)) {
                    if (isClassicBaseCard(card) || this.isCardAvailable(card, context)) ids.push(card.id);
                }
            });
            const unique = uniquePreserve(ids);
            return unique.filter(id => {
                const card = map.get(id);
                return card && this.isCardAvailable(card, context);
            });
        },

        getExtraCandidates(set, catalogue, context) {
            const base = new Set(this.getSetBaseCardIds(set, catalogue));
            return this.getEligibleOriginalIds(catalogue, context).filter(id => !base.has(id));
        },

        analyzeExtraSelection(ids, baseIds, availableIds, options) {
            const base = new Set(baseIds || []);
            const available = new Set(availableIds || []);
            const original = cloneIds(ids);
            const unique = uniquePreserve(ids);
            const duplicates = original.length - unique.length;
            const inBase = unique.filter(id => base.has(id));
            const unavailable = unique.filter(id => !base.has(id) && !available.has(id));
            const kept = unique.filter(id => !base.has(id) && available.has(id));
            const overLimit = kept.length > EXTRA_LIMIT;
            const reviewRequired = overLimit || unavailable.length > 0 || (options && options.legacyOverLimit);
            return {
                original,
                unique,
                kept,
                inBase,
                unavailable,
                duplicates,
                overLimit,
                reviewRequired,
                count: kept.length,
                limit: EXTRA_LIMIT
            };
        },

        validateNewRunSelection(selection, context) {
            const set = selection && this.getSet(selection.setId);
            if (!set) {
                return { ok: false, code: 'unknown_set', message: '알 수 없는 기본 세트입니다. 다른 세트를 선택해 주세요.' };
            }
            const definition = this.validateSetDefinition(set, context.catalogue);
            if (!definition.ok) {
                return { ok: false, code: 'definition_error', message: '이 세트 정의가 올바르지 않아 사용할 수 없습니다.' };
            }
            const availability = this.getSetAvailability(set, context);
            if (availability.definitionError || !availability.available) {
                return { ok: false, code: 'locked', message: '해금되지 않은 카드가 있어 이 세트로 새 런을 시작할 수 없습니다.', missingIds: availability.missingIds };
            }
            const extras = this.analyzeExtraSelection(
                selection.extraCardIds,
                this.getSetBaseCardIds(set, context.catalogue),
                this.getEligibleOriginalIds(context.catalogue, context)
            );
            if (extras.overLimit) {
                return { ok: false, code: 'over_limit', message: '추가 카드는 15장을 넘을 수 없습니다.', analysis: extras };
            }
            if (extras.unavailable.length || extras.inBase.length) {
                return { ok: false, code: 'review', message: '추가 카드 선택을 검토해야 합니다.', analysis: extras };
            }
            return {
                ok: true,
                set,
                baseCardIds: this.getSetBaseCardIds(set, context.catalogue),
                extraCardIds: extras.kept,
                analysis: extras
            };
        },

        validateSavedRunSnapshot(snapshot, catalogue) {
            if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
                return { ok: false, code: 'missing' };
            }
            if (snapshot.source === 'mode_owned') return { ok: true, snapshot };
            const base = uniquePreserve(snapshot.baseCardIds);
            const extra = uniquePreserve(snapshot.extraCardIds);
            const map = byId(catalogue);
            const missing = base.concat(extra).filter(id => !map.get(id));
            if (missing.length) return { ok: false, code: 'unknown_id', missing };
            if (base.length === 0) return { ok: false, code: 'empty_base' };
            return { ok: true, snapshot: { ...snapshot, baseCardIds: base, extraCardIds: extra } };
        },

        resolveSnapshotCardPool(snapshot, options, catalogue) {
            const map = byId(catalogue);
            const special = options && options.specialById;
            const ids = uniquePreserve([].concat(snapshot.baseCardIds || [], snapshot.extraCardIds || []));
            return ids.map(id => {
                const card = map.get(id);
                if (!card) return null;
                const selectedId = options && options.specialCardSelections && options.specialCardSelections[id];
                if (selectedId && special && special.get) {
                    const variant = special.get(selectedId);
                    if (variant && variant.specialBaseId === id) return variant;
                }
                return card;
            }).filter(Boolean);
        },

        createEmptyProfile() {
            return emptyProfile();
        },

        createEmptyConfig() {
            const profiles = {};
            ALLOWED_SET_IDS.forEach(id => {
                profiles[id] = emptyProfile();
            });
            return {
                version: 1,
                revision: 1,
                selectedSetId: 'classic',
                profiles
            };
        },

        cloneProfile(profile) {
            const source = profile || emptyProfile();
            const presets = Array.isArray(source.presets) ? source.presets : [];
            const cloned = [];
            for (let i = 0; i < PRESET_COUNT; i += 1) {
                const extra = presets[i] && Array.isArray(presets[i].extraCardIds)
                    ? uniquePreserve(presets[i].extraCardIds)
                    : [];
                cloned.push({ extraCardIds: extra });
            }
            const index = Number.isInteger(source.activePresetIndex) ? source.activePresetIndex : 0;
            return {
                activePresetIndex: Math.min(PRESET_COUNT - 1, Math.max(0, index)),
                presets: cloned,
                reviewFlags: Array.isArray(source.reviewFlags) ? source.reviewFlags.slice() : []
            };
        },

        cloneConfig(config) {
            const next = this.createEmptyConfig();
            if (!config || typeof config !== 'object') return next;
            if (ALLOWED_SET_IDS.indexOf(config.selectedSetId) >= 0) next.selectedSetId = config.selectedSetId;
            ALLOWED_SET_IDS.forEach(id => {
                next.profiles[id] = this.cloneProfile(config.profiles && config.profiles[id]);
            });
            next.version = 1;
            next.revision = Number.isInteger(config.revision) ? config.revision : 1;
            return next;
        },

        migrateLegacyBonusPresets(legacyPresets, activeIndex, unlockedBonusIds) {
            const config = this.createEmptyConfig();
            const max = PRESET_COUNT;
            const presets = Array.isArray(legacyPresets) ? legacyPresets.slice(0, max) : [];
            while (presets.length < max) presets.push(null);
            const migrated = [];
            const origins = [];
            presets.forEach(preset => {
                if (!Array.isArray(preset)) {
                    if (preset == null) {
                        origins.push('null_or_missing');
                        migrated.push({ extraCardIds: uniquePreserve(unlockedBonusIds), origin: 'null_or_missing', reviewRequired: false });
                    } else {
                        origins.push('invalid');
                        migrated.push({ extraCardIds: [], origin: 'invalid', reviewRequired: true });
                    }
                    return;
                }
                const unique = uniquePreserve(preset);
                origins.push(preset.length === 0 ? 'explicit_empty' : 'explicit_array');
                migrated.push({
                    extraCardIds: unique,
                    origin: preset.length === 0 ? 'explicit_empty' : 'explicit_array',
                    reviewRequired: unique.length > EXTRA_LIMIT
                });
            });
            config.profiles.classic.presets = migrated.map(item => ({ extraCardIds: item.extraCardIds.slice() }));
            config.profiles.classic.activePresetIndex = Math.min(max - 1, Math.max(0, Number.isInteger(activeIndex) ? activeIndex : 0));
            config.profiles.classic.legacyOrigins = origins;
            config.profiles.classic.reviewFlags = migrated.map(item => item.reviewRequired);
            return config;
        },

        pickRandomExtras(candidates, count, shuffleFn) {
            const pool = uniquePreserve(candidates);
            const take = Math.min(EXTRA_LIMIT, Math.max(0, count == null ? EXTRA_LIMIT : count), pool.length);
            const shuffled = typeof shuffleFn === 'function' ? shuffleFn(pool) : pool.slice();
            return shuffled.slice(0, take);
        },

        copyExtras(sourceIds, targetBaseIds, availableIds) {
            const analysis = this.analyzeExtraSelection(sourceIds, targetBaseIds, availableIds);
            return {
                extraCardIds: analysis.kept,
                excludedInBase: analysis.inBase,
                excludedUnavailable: analysis.unavailable,
                previewCount: analysis.kept.length
            };
        }
    };

    CardPoolRules.getSetAvailability = function (set, context) {
        const catalogue = context && context.catalogue || [];
        const definition = this.validateSetDefinition(set, catalogue);
        const ids = definition.ok ? this.getSetBaseCardIds(set, catalogue) : [];
        if (!definition.ok) {
            return {
                available: false,
                definitionError: true,
                readyCount: 0,
                total: set && set.resolver === 'existing_original_base_card_predicate' ? 0 : NEW_SET_SIZE,
                missingIds: [],
                errors: definition.errors
            };
        }
        const map = byId(catalogue);
        const missingIds = [];
        let readyCount = 0;
        ids.forEach(id => {
            if (this.isCardAvailable(map.get(id), context)) readyCount += 1;
            else missingIds.push(id);
        });
        return {
            available: missingIds.length === 0,
            definitionError: false,
            readyCount,
            total: ids.length,
            missingIds,
            errors: []
        };
    };

    window.CardPoolRules = CardPoolRules;
})();
