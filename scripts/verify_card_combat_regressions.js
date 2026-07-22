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

function run() {
  const scheduledCallbacks = [];
  const sandbox = {
    assert,
    console,
    localStorage: createStorage(),
    scheduledCallbacks,
    setTimeout: callback => {
      scheduledCallbacks.push(callback);
      return scheduledCallbacks.length;
    },
    clearTimeout: () => {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const cardRoot = path.join(process.cwd(), 'card');
  assert.strictEqual(fs.readFileSync(path.join(cardRoot, 'index.html'), 'utf8').includes('#448af f'), false);
  ['data.js', 'logic.js', 'battle_runtime.js'].forEach(fileName => {
    const filePath = path.join(cardRoot, fileName);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
  });

  vm.runInContext(`
    const quiet = () => {};
    const getCard = id => GameUtils.getCardById(id);
    const makeUnit = (overrides = {}) => ({
      id: 'unit', name: 'unit', hp: 1000, maxHp: 1000, mp: 100,
      atk: 100, matk: 100, def: 0, mdef: 0,
      baseCrit: -100, baseEva: 0, buffs: {}, element: null,
      ...overrides
    });

    // Approved data changes and explicit exclusions.
    const golem = getCard('golem');
    const colosseum = golem.skills.find(skill => skill.name === '콜로세움');
    assert(colosseum && colosseum.type === 'sup' && colosseum.tier === 3 && colosseum.cost === 30);
    assert.deepStrictEqual(Array.from(colosseum.effects, effect => effect.type), ['field_buff', 'debuff']);
    assert.strictEqual(golem.skills.find(skill => skill.name === '차지어택').val, 3.0);
    assert.strictEqual(getCard('prism_twin').skills.find(skill => skill.name === '프리즘셔플').effects[0].type, 'prism_shuffle_field');
    assert.strictEqual(getCard('joker').skills.find(skill => skill.name === '레인보우룰렛').effects[0].type, 'roulette_field');

    // One Joker can fill only one missing slot in a conjunctive card requirement.
    assert.strictEqual(
      GameUtils.buildDeckContext(['snow_rabbit_christmas', 'joker', 'marshmallow'])
        .matchesRequiredCardSlots(['night_rabbit', 'silver_rabbit']),
      false
    );
    assert.strictEqual(
      GameUtils.buildDeckContext(['snow_rabbit_christmas', 'night_rabbit', 'joker'])
        .matchesRequiredCardSlots(['night_rabbit', 'silver_rabbit']),
      true
    );
    const christmasSnow = getCard('snow_rabbit_christmas');
    assert.strictEqual(
      Logic.calculateInitialStats(christmasSnow, ['snow_rabbit_christmas', 'joker', 'marshmallow'], GameUtils.getAllCards(), 0).activeTrait,
      null
    );
    assert.strictEqual(
      Logic.calculateInitialStats(christmasSnow, ['snow_rabbit_christmas', 'night_rabbit', 'joker'], GameUtils.getAllCards(), 0).activeTrait,
      'christmas_rabbit_trio'
    );

    // Variant rabbit copies follow the active trait of their actual source card.
    [
      'snow_rabbit_valentine', 'silver_rabbit_valentine',
      'snow_rabbit_halloween', 'silver_rabbit_halloween',
      'snow_rabbit_christmas', 'silver_rabbit_christmas'
    ]
      .forEach(id => {
        const conditionalCopy = getCard(id).skills.find(skill =>
          ['실버스톰', '헤븐리루어'].includes(skill.name)
        );
        assert(conditionalCopy);
        assert.strictEqual(conditionalCopy.effects[0].condition, 'source_trait_active');
      });

    // Positive statuses are neither counted nor removed as debuffs.
    const statusTarget = makeUnit({ buffs: { guard: 1, weak: 1, burn: 2 } });
    assert.strictEqual(StatusRules.countNegativeKinds(statusTarget.buffs), 2);
    SideEffects.apply({ target: statusTarget, source: makeUnit(), logFn: quiet }, { type: 'clear_target_debuffs' });
    assert.deepStrictEqual({ ...statusTarget.buffs }, { guard: 1 });

    // Delayed presence-only statuses never become artificial stacks.
    const delayedEffect = { type: 'delayed_attack_debuffs', turns: 3, debuffs: ['weak', 'burn', 'stun'] };
    const resolvedDelayed = buildResolvedDelayedSkill(
      { name: 'test', type: 'mag', val: 1, effects: [delayedEffect] },
      delayedEffect,
      1
    );
    assert.strictEqual(Object.hasOwn(resolvedDelayed.effects.find(effect => effect.id === 'weak'), 'stack'), false);
    assert.strictEqual(resolvedDelayed.effects.find(effect => effect.id === 'burn').stack, 1);
    assert.strictEqual(Object.hasOwn(resolvedDelayed.effects.find(effect => effect.id === 'stun'), 'stack'), false);

    const christmasStats = Logic.calculateInitialStats(
      christmasSnow,
      ['snow_rabbit_christmas', 'night_rabbit', 'joker'],
      GameUtils.getAllCards(),
      0
    );
    const activeChristmasSnow = makeUnit({ ...christmasStats.stats, proto: christmasSnow, activeTrait: christmasStats.activeTrait, baseCrit: -100 });
    const inactiveChristmasSnow = { ...activeChristmasSnow, activeTrait: null, buffs: {} };
    const copiedSilverStorm = christmasSnow.skills.find(skill => skill.name === '실버스톰');
    const copiedSkillTarget = makeUnit();
    const activeCopyDamage = Logic.calculateDamage(activeChristmasSnow, copiedSkillTarget, copiedSilverStorm, [], [], quiet, 'default', [], 1, []).dmg;
    const inactiveCopyDamage = Logic.calculateDamage(inactiveChristmasSnow, makeUnit(), copiedSilverStorm, [], [], quiet, 'default', [], 1, []).dmg;
    assert.strictEqual(activeCopyDamage, inactiveCopyDamage * 2);

    // Every stack grant uses the artifact-aware cap and increment rule.
    const stackTarget = makeUnit();
    SideEffects.apply(
      { target: stackTarget, source: makeUnit(), artifacts: ['over_flame'], logFn: quiet },
      { type: 'debuff', id: 'burn', stack: 1 }
    );
    assert.strictEqual(stackTarget.buffs.burn, 2);
    const divineTarget = makeUnit();
    SideEffects.apply(
      { target: divineTarget, source: makeUnit(), artifacts: ['over_divine'], logFn: quiet },
      { type: 'check_divine_3_stun_else_add' }
    );
    assert.strictEqual(divineTarget.buffs.divine, 2);

    // Zero is a valid multiplier, and guard applies on the player-to-enemy path.
    const attacker = makeUnit();
    const zeroTarget = makeUnit();
    assert.strictEqual(
      Logic.calculateDamage(attacker, zeroTarget, { name: 'zero', type: 'phy', val: 0, effects: [] }, [], [], quiet, 'default', [], 1, []).dmg,
      0
    );
    const guardedTarget = makeUnit({ buffs: { guard: 1 } });
    assert.strictEqual(
      Logic.calculateDamage(attacker, guardedTarget, { name: 'hit', type: 'phy', val: 1, effects: [] }, [], [], quiet, 'default', [], 1, []).dmg,
      50
    );

    // Enemy debuffs use the same mode-aware stat calculation as player attacks.
    const weakenedEnemy = makeUnit({ buffs: { weak: 1 } });
    assert.strictEqual(Logic.calculateStats(weakenedEnemy, [], 'default', [], 1).atk, 80);
    assert.strictEqual(Logic.calculateStats(weakenedEnemy, [], 'curse', [], 1).atk, 60);

    // Gray's random multiplier reaches all declared values.
    const graySkill = ENEMIES.find(enemy => enemy.id === 'gray').skills.find(skill => skill.name === '영혼절단');
    const originalRandom = Math.random;
    Math.random = () => 0;
    assert.strictEqual(Logic.resolveSkillMultiplier(graySkill, ENEMIES.find(enemy => enemy.id === 'gray'), quiet), 2);
    Math.random = () => 0.4;
    assert.strictEqual(Logic.resolveSkillMultiplier(graySkill, ENEMIES.find(enemy => enemy.id === 'gray'), quiet), 3);
    Math.random = () => 0.999;
    assert.strictEqual(Logic.resolveSkillMultiplier(graySkill, ENEMIES.find(enemy => enemy.id === 'gray'), quiet), 4);
    const santa = makeUnit({ proto: getCard('santa'), activeTrait: null });
    const santaSkill = santa.proto.skills.find(skill => skill.name === '징글벨');
    assert.strictEqual(Logic.resolveSkillMultiplier(santaSkill, santa, quiet), 5);
    Math.random = originalRandom;

    // Thor swaps the already-scaled current/base pairs instead of restoring constants.
    const thor = makeUnit({ atk: 140, matk: 70, def: 126, mdef: 63, baseAtk: 140, baseMatk: 70, baseDef: 126, baseMdef: 63 });
    SideEffects.apply({ source: thor, logFn: quiet }, { type: 'swap_self_stats' });
    assert.deepStrictEqual(
      [thor.atk, thor.matk, thor.def, thor.mdef, thor.baseAtk, thor.baseMatk, thor.baseDef, thor.baseMdef],
      [70, 140, 63, 126, 70, 140, 63, 126]
    );

    // Black Swan's party critical bonus is applied once to its owner.
    const blackSwan = getCard('black_swan');
    const blackSwanInit = Logic.calculateInitialStats(blackSwan, ['black_swan', 'vampire', 'vampire'], GameUtils.getAllCards(), 0);
    assert.strictEqual(blackSwanInit.stats.baseCrit, GAME_CONSTANTS.BASE_CRIT + 20);

    const makeRpg = (source, deck, fieldBuffs = []) => ({
      state: { deck, artifacts: [], mode: 'default' },
      battle: { players: [source], enemy: makeUnit({ id: 'enemy' }), fieldBuffs, activeTraits: [], delayedEffects: [], turn: 1, currentPlayerIdx: 0, phase: 'player-ready', isFinished: false },
      NORMAL_ATTACK: { name: '일반 공격', type: 'phy', tier: 1, cost: 0, val: 1, effects: [] },
      getCardData: getCard,
      hasArtifact: () => false,
      log: quiet,
      winBattle: quiet,
      loseBattle: quiet,
      renderBattleView: quiet,
      renderBattleControls: quiet
    });

    // The complete effect context lets Flare Ribbon inspect special-card grades.
    const flare = makeUnit({ id: 'flare_ribbon', proto: getCard('flare_ribbon') });
    const flareRpg = makeRpg(flare, ['flare_ribbon', 'snow_rabbit_christmas', 'silver_rabbit_christmas']);
    BattleRuntime.applySkillEffects(flareRpg, flare, flareRpg.battle.enemy, flare.proto.skills.find(skill => skill.name === '리듬하이'));
    assert(flareRpg.battle.fieldBuffs.some(buff => buff.name === 'twinkle_party'));
    assert(flareRpg.battle.fieldBuffs.some(buff => buff.name === 'sun_bless'));

    // Prism Shuffle preserves count, keeps replacements unique, and never rolls destiny_oath.
    const prism = makeUnit({ id: 'prism_twin', proto: getCard('prism_twin') });
    const prismRpg = makeRpg(prism, ['prism_twin'], [
      { name: 'sun_bless' }, { name: 'moon_bless' }, { name: 'destiny_oath' }
    ]);
    BattleRuntime.applySkillEffects(prismRpg, prism, prismRpg.battle.enemy, prism.proto.skills.find(skill => skill.name === '프리즘셔플'));
    assert.strictEqual(prismRpg.battle.fieldBuffs.length, 3);
    assert.strictEqual(new Set(prismRpg.battle.fieldBuffs.map(buff => buff.name)).size, 3);
    assert.strictEqual(prismRpg.battle.fieldBuffs.some(buff => buff.name === 'destiny_oath'), false);
    const emptyPrismRpg = makeRpg(prism, ['prism_twin']);
    BattleRuntime.applySkillEffects(emptyPrismRpg, prism, emptyPrismRpg.battle.enemy, prism.proto.skills.find(skill => skill.name === '프리즘셔플'));
    assert.strictEqual(emptyPrismRpg.battle.fieldBuffs.length, 0);

    // A same-named skill cannot trigger another owner's active trait.
    const impostor = makeUnit({ proto: { trait: { type: 'unrelated' } }, activeTrait: null });
    const impostorRpg = makeRpg(impostor, []);
    impostorRpg.battle.activeTraits = ['syn_water_nature'];
    BattleRuntime.applySkillEffects(impostorRpg, impostor, impostorRpg.battle.enemy, { name: '문라이트세레나', effects: [] });
    assert.strictEqual(impostorRpg.battle.fieldBuffs.length, 0);
    const rumi = makeUnit({ proto: getCard('rumi'), activeTrait: 'syn_water_nature' });
    const rumiRpg = makeRpg(rumi, ['rumi', 'golem']);
    rumiRpg.battle.activeTraits = ['syn_water_nature'];
    BattleRuntime.applySkillEffects(rumiRpg, rumi, rumiRpg.battle.enemy, { name: '문라이트세레나', effects: [] });
    assert.strictEqual(rumiRpg.battle.fieldBuffs.some(buff => buff.name === 'twinkle_party'), true);

    // A dedicated enemy policy consumes only its own decision roll.
    let randomCalls = 0;
    Math.random = () => { randomCalls++; return 0.9; };
    const iris = ENEMIES.find(enemy => enemy.id === 'iris_love');
    assert.strictEqual(Logic.decideEnemyAction(iris, 1).name, '일반 공격');
    assert.strictEqual(randomCalls, 1);
    Math.random = originalRandom;

    // Synchronous duplicate commands spend mana and schedule the enemy once.
    scheduledCallbacks.length = 0;
    const player = makeUnit({ proto: { element: null, trait: { type: 'none' } }, skills: [] });
    const actionRpg = makeRpg(player, []);
    const action = { name: 'test support', type: 'sup', cost: 10, effects: [] };
    assert.strictEqual(BattleRuntime.executeSkill(actionRpg, player, actionRpg.battle.enemy, action), true);
    assert.strictEqual(BattleRuntime.executeSkill(actionRpg, player, actionRpg.battle.enemy, action), false);
    assert.strictEqual(player.mp, 90);
    assert.strictEqual(scheduledCallbacks.length, 1);
    assert.strictEqual(actionRpg.battle.phase, 'enemy-pending');
  `, sandbox, { filename: 'card-combat-regressions' });

  console.log('Card combat regression verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
