const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createStorage() {
    const values = new Map();
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

function loadGrammarData(filePath) {
    const source = fs.readFileSync(filePath, 'utf8');
    return vm.runInNewContext(`${source}\nGRAMMAR_DATA;`, {}, { filename: filePath });
}

function run() {
    const cardRoot = path.join(process.cwd(), 'card');
    const remasterRoot = path.join(process.cwd(), 'card_remaster');
    const indexSource = fs.readFileSync(path.join(cardRoot, 'index.html'), 'utf8');
    const logicSource = fs.readFileSync(path.join(cardRoot, 'logic.js'), 'utf8');
    const fortuneSource = fs.readFileSync(path.join(cardRoot, 'fortune_cookie.js'), 'utf8');

    assert(indexSource.includes('class ImageAssetManager'));
    assert(indexSource.includes('class MissionView'));
    assert(logicSource.includes('class SaveDataMigrator'));
    assert.strictEqual(fs.existsSync(path.join(cardRoot, 'lumi-portrait.svg')), false);
    assert.strictEqual(indexSource.includes('lumi-portrait.svg'), false);
    assert.strictEqual(indexSource.includes('onerror="this.src=\'\'"'), false);
    assert.strictEqual(indexSource.includes('src=""'), false);
    assert.strictEqual(indexSource.includes('id="menu-artifact-area"'), false);
    assert.strictEqual(fortuneSource.includes('localStorage.'), false);

    const grammarPath = path.join(cardRoot, 'grammar_data.js');
    const remasterGrammarPath = path.join(remasterRoot, 'grammar_data.js');
    const grammarSource = fs.readFileSync(grammarPath, 'utf8');
    const remasterGrammarSource = fs.readFileSync(remasterGrammarPath, 'utf8');
    const grammarData = loadGrammarData(grammarPath);
    const expectedLectureIds = Array.from({ length: 35 }, (_, index) => index + 1);

    assert.strictEqual(remasterGrammarSource, grammarSource, 'card and card_remaster grammar data must stay aligned');
    assert.deepStrictEqual([...grammarData.map(lecture => lecture.id)], expectedLectureIds);
    grammarData.forEach(lecture => {
        assert(
            lecture.content.startsWith(`[제${lecture.id}강]`),
            `${lecture.id}강 content heading is out of sync`
        );
        const embeddedHeadingIds = [...lecture.content.matchAll(/\[제(\d+)강\]/g)]
            .map(match => Number(match[1]));
        assert.deepStrictEqual(
            embeddedHeadingIds,
            [lecture.id],
            `${lecture.id}강 must contain exactly one matching content heading`
        );
        assert.strictEqual((lecture.content.match(/\*/g) || []).length, 0, `${lecture.id}강 contains markdown asterisks`);
        assert.strictEqual((lecture.content.match(/^\s*>/gm) || []).length, 0, `${lecture.id}강 contains markdown quotes`);
        assert.strictEqual((lecture.content.match(/`/g) || []).length, 0, `${lecture.id}강 contains markdown code marks`);
        assert.strictEqual(
            (lecture.content.match(/\p{Extended_Pictographic}/gu) || []).length,
            0,
            `${lecture.id}강 contains pictographic emoji`
        );
        assert.strictEqual(
            (lecture.content.match(/[\u200B\uFE0E\uFE0F\u200D]/g) || []).length,
            0,
            `${lecture.id}강 contains invisible emoji formatting characters`
        );
        const quizzes = lecture.quizzes || [];
        assert.strictEqual(quizzes.length, 5, `${lecture.id}강 must contain exactly five quizzes`);
        quizzes.forEach(quiz => {
            assert.strictEqual(quiz.lecture_id, lecture.id, `${lecture.id}강 quiz reference is out of sync`);
            assert(quiz.options.includes(quiz.answer), `${lecture.id}강 quiz answer must exist in its options`);
        });
    });

    const loaderBlock = indexSource.match(/var scripts = \[([\s\S]*?)\n\s*\];/);
    assert(loaderBlock, 'sequential loader list not found');
    const loadedFiles = [...loaderBlock[1].matchAll(/src: '([^']+)'/g)].map(match => match[1]);
    assert.deepStrictEqual(loadedFiles, [
        'data.js',
        'vocab_data.js',
        'collocation_data.js',
        'grammar_data.js',
        'toeic.js',
        'toeic_explanations.js',
        'api.js',
        'logic.js',
        'battle_runtime.js',
        'rpg_features.js',
        'listening_data.js',
        'fortune_cookie.js',
        'music_player.js'
    ]);
    ['SaveDataMigrator', 'LISTENING_DATA', 'FortuneCookie', 'MusicPlayer'].forEach(name => {
        assert(indexSource.includes(`{ name: '${name}'`), `${name} is missing from initial readiness checks`);
    });
    assert(indexSource.includes('if (!window._scriptLoadComplete)'));

    const sandbox = {
        assert,
        console,
        localStorage: createStorage(),
        setTimeout: () => 1,
        clearTimeout: () => {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);

    ['data.js', 'logic.js', 'rpg_features.js'].forEach(fileName => {
        const filePath = path.join(cardRoot, fileName);
        vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
    });

    vm.runInContext(`
        const expectedStorageKeys = {
            SAVE: 'cardRpgSave',
            GLOBAL: 'cardRpgGlobal',
            VOCAB: 'cardRpgVocab',
            COLLOCATION: 'cardRpgCollocation',
            COLLOCATION_DETAILS: 'cardRpgCollocationDetails',
            API_KEY: 'cardRpgApiKey',
            RECORDS: 'cardRpgRecords',
            MUSIC_PREFS: 'cardRpgMusicPrefs',
            FORTUNE_LAST_USED: 'fortuneCookieLastUsedDate',
            FORTUNE_LAST_RESULT: 'fortuneCookieLastResult'
        };
        assert.deepStrictEqual({ ...Storage.keys }, expectedStorageKeys);

        const defaults = {
            mode: 'origin',
            tickets: 20,
            deck: [null, null, null],
            inventory: [],
            currentToeicSession: null
        };
        const legacy = {
            tickets: 7,
            deck: 'broken-old-value',
            inventory: null,
            artifactReserveDraft: {
                active: true,
                pool: 'broken-old-value',
                futureReserveFlag: 'keep-me'
            },
            draft: {
                active: true,
                currentOptions: 'broken-old-value',
                futureDraftFlag: 'keep-me'
            },
            factoryDraft: null,
            chaosPool: 'broken-old-value',
            factoryPool: null,
            activeEventCards: {},
            quiz_stats: { correct: 'broken', total: null, futureQuizFlag: 'keep-me' },
            activeBonusPoolIds: ['known', null],
            currentToeicSession: { temporary: true },
            futureSaveField: { keep: true }
        };
        const legacySnapshot = JSON.stringify(legacy);
        const normalized = SaveDataMigrator.normalizeRunState(legacy, defaults, {
            defaultBlessingUses: 5,
            defaultDraftRerolls: 7,
            normalizeBonusPoolIds: ids => ids.filter(Boolean),
            normalizeSpecialSelections: selections => ({ ...selections }),
            defaultSpecialSelections: { jasmine: 'jasmine' }
        });

        assert.strictEqual(normalized.tickets, 7);
        assert.deepStrictEqual(normalized.deck, [null, null, null]);
        assert.deepStrictEqual(normalized.inventory, []);
        assert.deepStrictEqual(normalized.activeBonusPoolIds, ['known']);
        assert.deepStrictEqual(normalized.activeSpecialCardSelections, { jasmine: 'jasmine' });
        assert.strictEqual(normalized.chaosBlessingUses, 5);
        assert.strictEqual(normalized.greatSageBlessingUses, 5);
        assert.strictEqual(normalized.artifactReserveDraft.active, true);
        assert.deepStrictEqual(normalized.artifactReserveDraft.pool, []);
        assert.deepStrictEqual(normalized.artifactReserveDraft.currentBundles, []);
        assert.strictEqual(normalized.artifactReserveDraft.futureReserveFlag, 'keep-me');
        assert.strictEqual(normalized.draft.active, true);
        assert.strictEqual(normalized.draft.rerolls, 7);
        assert.deepStrictEqual(normalized.draft.currentOptions, []);
        assert.strictEqual(normalized.draft.futureDraftFlag, 'keep-me');
        assert.strictEqual(normalized.factoryDraft.active, false);
        assert.strictEqual(normalized.factoryDraft.round, 1);
        assert.strictEqual(normalized.factoryDraft.maxRounds, 10);
        assert.deepStrictEqual(normalized.factoryDraft.pool, []);
        assert.deepStrictEqual(normalized.factoryDraft.seenCards, []);
        assert.deepStrictEqual(normalized.factoryDraft.currentBundles, []);
        assert.deepStrictEqual(normalized.chaosPool, []);
        assert.deepStrictEqual(normalized.factoryPool, []);
        assert.deepStrictEqual(normalized.activeEventCards, []);
        assert.deepStrictEqual(normalized.quiz_stats, {
            correct: 0,
            total: 0,
            futureQuizFlag: 'keep-me'
        });
        assert.deepStrictEqual(normalized.futureSaveField, { keep: true });
        assert.strictEqual(normalized.saveSchemaVersion, SaveDataMigrator.CURRENT_VERSION);
        assert.strictEqual(JSON.stringify(legacy), legacySnapshot, 'normalization mutated the loaded object');

        const serialized = SaveDataMigrator.serializeRunState(normalized);
        assert.strictEqual(Object.hasOwn(serialized, 'currentToeicSession'), false);
        assert.strictEqual(Object.hasOwn(normalized, 'currentToeicSession'), true);
        assert.deepStrictEqual(serialized.futureSaveField, { keep: true });
        assert.strictEqual(SaveDataMigrator.normalizeRunState([], defaults), null);
        assert.strictEqual(
            SaveDataMigrator.normalizeRunState(
                { saveSchemaVersion: SaveDataMigrator.CURRENT_VERSION + 1, futureSaveField: true },
                defaults
            ),
            null
        );
        assert.strictEqual(
            SaveDataMigrator.serializeRunState({
                saveSchemaVersion: SaveDataMigrator.CURRENT_VERSION + 1
            }).saveSchemaVersion,
            SaveDataMigrator.CURRENT_VERSION + 1,
            'serialization must never downgrade a future schema version'
        );
        assert.strictEqual(SaveDataMigrator.normalizeRunState({ saveSchemaVersion: 'broken' }, defaults), null);
        assert.deepStrictEqual(
            SaveDataMigrator.normalizeRunState({ quiz_stats: [] }, defaults).quiz_stats,
            { correct: 0, total: 0 }
        );
        assert.strictEqual(Logic._SYNERGY_TABLE.syn_dark_3_matk_boost, undefined);

        const backupGlobal = {
            unlocked_modes: ['origin'],
            unlocked_bonus_cards: [],
            achievements: { origin: false },
            marker: 'backup'
        };
        Storage.save(Storage.keys.GLOBAL + '_backup', backupGlobal);
        const restoreAlerts = [];
        const restoreHost = {
            global: {
                unlocked_modes: ['origin'],
                unlocked_bonus_cards: [],
                achievements: { origin: false },
                marker: 'memory'
            },
            showAlert: message => restoreAlerts.push(message)
        };
        RPGFeatureModules.install(restoreHost);
        const originalStorageSave = Storage.save;
        Storage.save = (key, data) => key === Storage.keys.GLOBAL
            ? false
            : originalStorageSave.call(Storage, key, data);
        assert.strictEqual(restoreHost._tryRestoreFromBackup(), false);
        assert.strictEqual(restoreHost.global.marker, 'memory');
        assert.deepStrictEqual(restoreAlerts, []);
        Storage.save = originalStorageSave;
        assert.strictEqual(restoreHost._tryRestoreFromBackup(), true);
        assert.strictEqual(restoreHost.global.marker, 'backup');
        assert.strictEqual(restoreAlerts.length, 1);

        assert.throws(
            () => RPGFeatureModules.install({ saveGame() {} }),
            /RPG feature method collision: saveGame/
        );
    `, sandbox, { filename: 'card-refactor-regressions' });

    const effectCoverage = vm.runInContext(`
        (() => {
            const cards = [
                ...CARDS,
                ...BONUS_CARDS,
                ...SPECIAL_CARDS,
                ...TRANSCENDENCE_CARDS,
                ...BONUS_TRANSCENDENCE_CARDS
            ];
            const entities = [...cards, ...ENEMIES];
            const used = [...new Set(entities.flatMap(entity =>
                (entity.skills || []).flatMap(skill => (skill.effects || []).map(effect => effect.type))
            ))].sort();
            const handled = new Set([
                ...Object.keys(DAMAGE_EFFECT_HANDLERS),
                ...Object.keys(SideEffects.handlers),
                ...DELAYED_SKILL_EFFECT_TYPES,
                // These participate directly in the critical/enemy-turn phases.
                'force_crit',
                'force_crit_chance',
                'mana_burn'
            ]);
            return { used, missing: used.filter(type => !handled.has(type)) };
        })()
    `, sandbox);
    assert.deepStrictEqual(
        Array.from(effectCoverage.missing),
        [],
        `unhandled card effect types: ${effectCoverage.missing.join(', ')}`
    );

    console.log('Card refactor regression verification passed.');
}

try {
    run();
} catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
}
