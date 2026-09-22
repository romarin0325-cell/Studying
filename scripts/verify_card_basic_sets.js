const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function run() {
  const values = new Map();
  const sandbox = {
    assert,
    console,
    localStorage: {
      getItem: key => (values.has(key) ? values.get(key) : null),
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const cardRoot = path.join(process.cwd(), 'card', 'game');
  ['data.js', 'logic.js', 'card_pool_rules.js'].forEach(fileName => {
    vm.runInContext(fs.readFileSync(path.join(cardRoot, fileName), 'utf8'), sandbox, { filename: fileName });
  });

  vm.runInContext(`
    const catalogue = GameUtils.getAllCards();
    const rules = CardPoolRules;
    const approved = {
      ember_relay: ['kobold','mimic','marshmallow','jack_o_lantern','desert_fox','candy_boy','sunflower','shooting_star_boy','executor','werebear','baby_dragon','hellhound','mirage','light_elemental','void_knight','sphinx','forget_me_not','chaos_mage','siren','cream_maid','red_dragon','flame_sage','dragon_miko','ash','sun_priestess','mawang','storm_sage','pudding_princess','lightning_sage','shadow_stalker','gold_dragon','zeke','phoenix','cherry_prince','ancient_dragon','supernova','sakura','cinderella','sun_moon_sword_maiden','queen'],
      twilight_liturgy: ['kobold','mimic','fairy','blessing_tail','holy_night','vampire','shadow_cat','snow_rabbit','silver_rabbit','black_swan','aurora','night_rabbit','fallen_angel','cream_maid','tinker_bell','silent_librarian','light_elemental','forget_me_not','void_knight','sphinx','archangel','fairy_queen','ghost_king','lightning_sage','unicorn','eclipse_queen','gumiho','mawang','santa','priest_of_end','jasmine','galaxy_whale','cinderella','luna','doom_luther','time_ruler','ancient_soul','frozen_witch','deep_lord','victoria'],
      starlit_garden: ['kobold','mimic','candy_boy','marshmallow','sugar_powder','sunflower','slime','mummy','joker','fairy','aurora','cream_maid','cotton_candy_sheep','siren','light_elemental','forget_me_not','golem','sphinx','fenrir','prism_twin','unicorn','pudding_princess','storm_sage','mushroom_king','sun_priestess','flame_sage','santa','astrologer','fairy_queen','avalanche_maid','queen','rumi','world_tree','jasmine','deep_lord','victoria','dainichi_nyorai','sun_moon_sword_maiden','sylphid','zeke'],
      midnight_tide: ['kobold','mimic','sunflower','snow_penguin','shadow_cat','vampire','slime','snow_rabbit','silver_rabbit','marshmallow','aurora','siren','fenrir','silent_librarian','legendary_captain','cotton_candy_sheep','prism_twin','night_rabbit','light_elemental','sphinx','priest_of_end','red_dragon','santa','crystal_dancer','jellyfish_princess','fairy_queen','avalanche_maid','pudding_princess','sun_priestess','shadow_stalker','time_ruler','phantom','venom','perfect_aurora','cure_master','deep_lord','frozen_witch','rumi','world_tree','doom_luther'],
      arena_company: ['kobold','mimic','executor','discipline_captain','werebear','shadow_cat','black_swan','candy_boy','slime','mummy','baby_dragon','ember_tiger','prism_twin','legendary_captain','golem','void_knight','fenrir','hellhound','cream_maid','forget_me_not','paladin','guardian','eclipse_queen','crystal_dancer','red_dragon','flame_sage','pudding_princess','gumiho','mushroom_king','unicorn','ancient_soul','cherry_prince','phoenix','luna','gray','sylphid','gold_dragon','zeke','world_tree','red_moon']
    };

    const classic = rules.getClassicBaseCardIds(catalogue);
    assert.strictEqual(classic.length, 45);
    assert.strictEqual(classic.includes('time_magician'), false);
    ['ember_relay','twilight_liturgy','starlit_garden','midnight_tide','arena_company'].forEach(id => {
      const set = rules.getSet(id);
      const flat = rules.getSetBaseCardIds(set, catalogue);
      assert.deepStrictEqual(flat, approved[id]);
      const check = rules.validateSetDefinition(set, catalogue);
      assert.strictEqual(check.ok, true, id + ' ' + check.errors.join(','));
      assert.strictEqual(new Set(flat).size, 40);
    });
    const midnight = rules.getSetBaseCardIds(rules.getSet('midnight_tide'), catalogue);
    assert.strictEqual(midnight.includes('time_magician'), false);
    assert.strictEqual(midnight.includes('comet_tracker'), false);

    const unlocked = GameUtils.getDefaultUnlockedBonusCardIds();
    const released = catalogue.filter(card => card.unlockSource === 'bonus' && card.unlockSource !== 'hidden').map(card => card.id);
    const context = {
      catalogue,
      unlockedBonusIds: unlocked.concat(['astrologer', 'miracle_larva']),
      releasedBonusIds: catalogue.filter(card => !card.releaseDate || card.releaseDate <= '2026-12-31').map(card => card.id),
      hiddenBonusIds: catalogue.filter(card => card.unlockSource === 'hidden').map(card => card.id),
      defaultUnlockedBonusIds: unlocked
    };
    const garden = rules.getSet('starlit_garden');
    const gardenAvail = rules.getSetAvailability(garden, Object.assign({}, context, { unlockedBonusIds: unlocked }));
    assert.strictEqual(gardenAvail.available, false);
    assert(gardenAvail.missingIds.includes('astrologer'));
    const gardenReady = rules.getSetAvailability(garden, context);
    assert.ok(gardenReady.total === 40);

    const extras = rules.getExtraCandidates(garden, catalogue, context);
    assert.ok(extras.includes('behemoth'));
    assert.strictEqual(extras.includes('astrologer'), false);
    assert.strictEqual(extras.includes('miracle_larva'), true);
    assert.strictEqual(extras.includes('mirror_cocoon'), false);
    assert.strictEqual(extras.includes('rumi_halloween'), false);

    const over = rules.analyzeExtraSelection(new Array(16).fill('behemoth').concat(['queen']), rules.getSetBaseCardIds(garden, catalogue), extras);
    assert.strictEqual(over.kept.includes('queen'), false);
    assert.ok(over.kept.length <= 1);
    const sixteen = rules.analyzeExtraSelection(extras.slice(0, 16), rules.getSetBaseCardIds(garden, catalogue), extras);
    assert.strictEqual(sixteen.overLimit, true);

    const emptyOk = rules.validateNewRunSelection({ setId: 'classic', extraCardIds: [] }, Object.assign({}, context, {
      unlockedBonusIds: unlocked
    }));
    assert.strictEqual(emptyOk.ok, true);

    const pool = GameUtils.buildCardPool({}, {
      baseCardIds: rules.getSetBaseCardIds(garden, catalogue),
      extraCardIds: ['behemoth']
    });
    const ids = pool.map(card => card.id);
    assert.strictEqual(ids.includes('behemoth'), true);
    assert.strictEqual(ids.filter(id => id === 'sun_priestess').length <= 1, true);
    assert.strictEqual(ids.includes('mirror_cocoon'), false);
    assert.strictEqual(pool.length, 41);

    const classicPool = GameUtils.buildCardPool({}, {
      baseCardIds: classic,
      extraCardIds: []
    });
    assert.strictEqual(classicPool.length, 45);

    const limitedEmpty = GameUtils.buildCardPool({}, { limitedPoolMode: true, factoryPool: [] });
    assert.deepStrictEqual(limitedEmpty, []);

    const specialOnly = GameUtils.buildCardPool({}, {
      baseCardIds: rules.getSetBaseCardIds(garden, catalogue),
      extraCardIds: [],
      specialCardSelections: { luna: 'luna_halloween' }
    });
    assert.strictEqual(specialOnly.some(card => card.id === 'luna' || card.id === 'luna_halloween'), false);

    const withLuna = GameUtils.buildCardPool({}, {
      baseCardIds: classic,
      extraCardIds: ['luna'],
      specialCardSelections: { luna: 'luna_halloween' }
    });
    assert.strictEqual(withLuna.filter(card => card.id === 'luna' || card.specialBaseId === 'luna').length, 1);

    const migrated = rules.migrateLegacyBonusPresets([null, [], ['joker','joker','phoenix']], 1, unlocked);
    assert.strictEqual(migrated.profiles.classic.presets[1].extraCardIds.length, 0);
    assert.ok(migrated.profiles.classic.presets[0].extraCardIds.length > 0);
    assert.deepStrictEqual(migrated.profiles.classic.presets[2].extraCardIds, ['joker','phoenix']);
    const again = rules.migrateLegacyBonusPresets([null, [], ['joker','phoenix']], 1, unlocked);
    assert.deepStrictEqual(again.profiles.classic.presets[2].extraCardIds, migrated.profiles.classic.presets[2].extraCardIds);

    const overLegacy = rules.migrateLegacyBonusPresets([extras.slice(0, 16)], 0, unlocked);
    assert.strictEqual(overLegacy.profiles.classic.presets[0].extraCardIds.length, 16);
    assert.strictEqual(overLegacy.profiles.classic.reviewFlags[0], true);

    const a = rules.cloneConfig(rules.createEmptyConfig());
    a.profiles.ember_relay.presets[0].extraCardIds.push('behemoth');
    const b = rules.cloneConfig(a);
    b.selectedSetId = 'starlit_garden';
    assert.deepStrictEqual(a.profiles.ember_relay.presets[0].extraCardIds, ['behemoth']);
    assert.deepStrictEqual(b.profiles.starlit_garden.presets[0].extraCardIds, []);
    a.profiles.ember_relay.presets[0].extraCardIds.push('mimic');
    assert.strictEqual(b.profiles.ember_relay.presets[0].extraCardIds.includes('mimic'), false);

    const snap = {
      schemaVersion: 1, source: 'basic_set', setId: 'starlit_garden', setRevision: 1,
      baseCardIds: rules.getSetBaseCardIds(garden, catalogue), extraCardIds: ['behemoth']
    };
    const restored = rules.validateSavedRunSnapshot(snap, catalogue);
    assert.strictEqual(restored.ok, true);
    const resolved = rules.resolveSnapshotCardPool(restored.snapshot, {}, catalogue);
    assert.strictEqual(resolved.length, 41);
    const missingSnap = rules.validateSavedRunSnapshot({
      source: 'basic_set',
      baseCardIds: ['not_a_real_card_id'],
      extraCardIds: []
    }, catalogue);
    assert.strictEqual(missingSnap.ok, false);
    assert.strictEqual(missingSnap.code, 'unknown_id');
    const badSource = rules.validateSavedRunSnapshot({ source: 'classic', baseCardIds: classic, extraCardIds: [] }, catalogue);
    assert.strictEqual(badSource.ok, false);
  `, sandbox);

  const featuresPath = path.join(cardRoot, 'rpg_features.js');
  vm.runInContext(fs.readFileSync(featuresPath, 'utf8'), sandbox, { filename: 'rpg_features.js' });
  vm.runInContext(`
    const alerts = [];
    const rpg = {
      _globalLoaded: true,
      _globalStorageBroken: false,
      _cardPoolEditorBusy: false,
      pendingActiveBonusPoolIds: [],
      global: {
        unlocked_bonus_cards: GameUtils.getDefaultUnlockedBonusCardIds(),
        cardPoolConfig: CardPoolRules.createEmptyConfig()
      },
      showAlert(message) { alerts.push(String(message)); }
    };
    RPGFeatureModules.install(rpg);
    rpg.validateGlobalData = function () { return true; };
    rpg.renderCardPoolEditor = function () {};
    rpg.updateBonusPoolEditorButton = function () {};
    rpg.getCardPoolAvailabilityContext = function () {
      return {
        catalogue: GameUtils.getAllCards(),
        unlockedBonusIds: GameUtils.getDefaultUnlockedBonusCardIds(),
        releasedBonusIds: GameUtils.getAllCards().map(card => card.id),
        hiddenBonusIds: [],
        defaultUnlockedBonusIds: GameUtils.getDefaultUnlockedBonusCardIds()
      };
    };
    const oldConfig = CardPoolRules.createEmptyConfig();
    delete oldConfig.setRevisions; // v1 saves did not record individual set revisions.
    oldConfig.selectedSetId = 'starlit_garden';
    const movedToBase = {
      ember_relay: ['shooting_star_boy'],
      starlit_garden: ['joker', 'sphinx', 'astrologer'],
      midnight_tide: ['red_dragon', 'santa'],
      arena_company: ['ancient_soul', 'luna']
    };
    Object.entries(movedToBase).forEach(([setId, ids]) => {
      oldConfig.profiles[setId].activePresetIndex = 2;
      oldConfig.profiles[setId].presets.forEach(preset => {
        preset.extraCardIds = ids.concat(['behemoth']);
      });
    });
    oldConfig.profiles.twilight_liturgy.presets[1].extraCardIds = ['behemoth'];
    rpg.global.cardPoolConfig = oldConfig;
    assert.strictEqual(rpg.ensureCardPoolConfigState(), true);
    const upgraded = rpg.global.cardPoolConfig;
    const allUnlocked = catalogue.map(card => card.id);
    const allAvailable = {
      catalogue, unlockedBonusIds: allUnlocked, releasedBonusIds: allUnlocked,
      hiddenBonusIds: [], defaultUnlockedBonusIds: allUnlocked
    };
    Object.entries(movedToBase).forEach(([setId, ids]) => {
      assert.strictEqual(upgraded.setRevisions[setId], rules.getSet(setId).revision);
      assert.strictEqual(upgraded.profiles[setId].activePresetIndex, 2);
      upgraded.profiles[setId].presets.forEach(preset => {
        assert.deepStrictEqual(preset.extraCardIds, ['behemoth']);
        assert.strictEqual(rules.validateNewRunSelection({ setId, extraCardIds: preset.extraCardIds }, allAvailable).ok, true);
      });
      assert.deepStrictEqual(oldConfig.profiles[setId].presets[0].extraCardIds, ids.concat(['behemoth']));
    });
    assert.deepStrictEqual(upgraded.profiles.twilight_liturgy.presets[1].extraCardIds, ['behemoth']);
    assert.strictEqual(rpg.ensureCardPoolConfigState(), false);
    assert.strictEqual(rpg.saveGlobalData(), true);
    assert.deepStrictEqual(JSON.parse(localStorage.getItem(Storage.keys.GLOBAL)).cardPoolConfig.profiles.starlit_garden.presets[2].extraCardIds, ['behemoth']);
    assert.ok(rpg.global._storageStamp);
    const firstStamp = rpg.global._storageStamp;
    localStorage.setItem(Storage.keys.GLOBAL, JSON.stringify(Object.assign({}, rpg.global, { _storageStamp: 'other-tab' })));
    rpg._cardPoolEditorDraft = CardPoolRules.cloneConfig(rpg.global.cardPoolConfig);
    rpg._cardPoolEditorDraft.selectedSetId = 'classic';
    assert.strictEqual(rpg.commitCardPoolEditorDraft(), false);
    assert.ok(alerts.some(message => message.indexOf('다른 탭') >= 0));
    assert.strictEqual(rpg.global._storageStamp, firstStamp);

    alerts.length = 0;
    localStorage.setItem(Storage.keys.GLOBAL, JSON.stringify(rpg.global));
    const originalSave = Storage.save;
    Storage.save = function () { return false; };
    rpg._cardPoolEditorDraft = CardPoolRules.cloneConfig(rpg.global.cardPoolConfig);
    rpg._cardPoolEditorDraft.profiles.classic.presets[0].extraCardIds = ['behemoth'];
    const before = JSON.stringify(rpg.global.cardPoolConfig);
    assert.strictEqual(rpg.commitCardPoolEditorDraft(), false);
    assert.strictEqual(JSON.stringify(rpg.global.cardPoolConfig), before);
    assert.deepStrictEqual(rpg.pendingActiveBonusPoolIds, []);
    Storage.save = originalSave;
  `, sandbox);

  console.log('Card basic set verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
