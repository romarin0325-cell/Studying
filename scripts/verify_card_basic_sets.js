const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function run() {
  const sandbox = { assert, console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
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
      ember_relay: ['kobold','mimic','marshmallow','jack_o_lantern','desert_fox','candy_boy','sunflower','flare_ribbon','executor','werebear','baby_dragon','hellhound','mirage','light_elemental','void_knight','sphinx','forget_me_not','chaos_mage','siren','cream_maid','red_dragon','flame_sage','dragon_miko','ash','sun_priestess','mawang','storm_sage','pudding_princess','lightning_sage','shadow_stalker','gold_dragon','zeke','phoenix','cherry_prince','ancient_dragon','supernova','sakura','cinderella','sun_moon_sword_maiden','queen'],
      twilight_liturgy: ['kobold','mimic','fairy','blessing_tail','holy_night','vampire','shadow_cat','snow_rabbit','silver_rabbit','black_swan','aurora','night_rabbit','fallen_angel','cream_maid','tinker_bell','silent_librarian','light_elemental','forget_me_not','void_knight','sphinx','archangel','fairy_queen','ghost_king','lightning_sage','unicorn','eclipse_queen','gumiho','mawang','santa','priest_of_end','jasmine','galaxy_whale','cinderella','luna','doom_luther','time_ruler','ancient_soul','frozen_witch','deep_lord','victoria'],
      starlit_garden: ['kobold','mimic','candy_boy','marshmallow','sugar_powder','sunflower','slime','mummy','flare_ribbon','fairy','aurora','cream_maid','cotton_candy_sheep','siren','light_elemental','forget_me_not','golem','entropy','fenrir','prism_twin','unicorn','pudding_princess','storm_sage','mushroom_king','sun_priestess','flame_sage','santa','miracle_larva','fairy_queen','avalanche_maid','queen','rumi','world_tree','jasmine','deep_lord','victoria','dainichi_nyorai','sun_moon_sword_maiden','sylphid','zeke'],
      midnight_tide: ['kobold','mimic','sunflower','snow_penguin','shadow_cat','vampire','slime','snow_rabbit','silver_rabbit','marshmallow','aurora','siren','fenrir','silent_librarian','legendary_captain','cotton_candy_sheep','prism_twin','night_rabbit','light_elemental','sphinx','priest_of_end','guardian','great_detective','crystal_dancer','jellyfish_princess','fairy_queen','avalanche_maid','pudding_princess','sun_priestess','shadow_stalker','time_ruler','phantom','venom','perfect_aurora','cure_master','deep_lord','frozen_witch','rumi','world_tree','doom_luther'],
      arena_company: ['kobold','mimic','executor','discipline_captain','werebear','shadow_cat','black_swan','candy_boy','slime','mummy','baby_dragon','ember_tiger','prism_twin','legendary_captain','golem','void_knight','fenrir','hellhound','cream_maid','forget_me_not','paladin','guardian','eclipse_queen','crystal_dancer','red_dragon','flame_sage','pudding_princess','gumiho','mushroom_king','unicorn','doom_luther','cherry_prince','phoenix','cure_master','gray','sylphid','gold_dragon','zeke','world_tree','red_moon']
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
      unlockedBonusIds: unlocked.concat(['miracle_larva']),
      releasedBonusIds: catalogue.filter(card => !card.releaseDate || card.releaseDate <= '2026-12-31').map(card => card.id),
      hiddenBonusIds: catalogue.filter(card => card.unlockSource === 'hidden').map(card => card.id),
      defaultUnlockedBonusIds: unlocked
    };
    const garden = rules.getSet('starlit_garden');
    const gardenAvail = rules.getSetAvailability(garden, Object.assign({}, context, { unlockedBonusIds: unlocked }));
    assert.strictEqual(gardenAvail.available, false);
    assert(gardenAvail.missingIds.includes('miracle_larva'));
    const gardenReady = rules.getSetAvailability(garden, context);
    assert.ok(gardenReady.total === 40);

    const extras = rules.getExtraCandidates(garden, catalogue, context);
    assert.ok(extras.includes('behemoth'));
    assert.strictEqual(extras.includes('miracle_larva'), false);
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
  `, sandbox);

  console.log('Card basic set verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
