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
  ['data.js', 'logic.js', 'battle_runtime.js', 'rpg_features.js'].forEach(fileName => {
    const filePath = path.join(cardRoot, fileName);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), sandbox, { filename: filePath });
  });

  vm.runInContext(`
    const quiet = () => {};
    const getCard = id => GameUtils.getCardById(id);
    const makeUnit = (overrides = {}) => ({
      id: 'unit', name: 'unit', hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
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

    // The complete August–October wave is registered with deterministic release gates.
    const bonusWaveExpectations = [
      ['discipline_captain', '선도부장', 'normal', 'nature', 'balancer', '2026-08-01', [330, 65, 65, 60, 60]],
      ['supernova', '초신성', 'legend', 'fire', 'dealer', '2026-08-01', [500, 125, 105, 60, 60]],
      ['shooting_star_boy', '별똥별소년', 'normal', 'light', 'dealer', '2026-08-15', [290, 85, 60, 45, 55]],
      ['victoria', '빅토리아', 'legend', 'light', 'buffer', '2026-08-15', [540, 100, 95, 80, 75]],
      ['holy_night', '홀리밤', 'normal', 'light', 'dealer', '2026-09-01', [300, 85, 55, 45, 45]],
      ['paladin', '팔라딘', 'epic', 'light', 'balancer', '2026-09-01', [400, 105, 75, 70, 70]],
      ['mad_scientist', '매드사이언티스트', 'rare', 'nature', 'balancer', '2026-09-15', [350, 80, 80, 55, 55]],
      ['grand_merchant', '대상인', 'rare', 'light', 'balancer', '2026-09-15', [340, 75, 90, 55, 60]],
      ['comet_tracker', '혜성추적자', 'rare', 'fire', 'balancer', '2026-10-01', [345, 65, 100, 55, 60]],
      ['prophet', '예언자', 'legend', 'water', 'buffer', '2026-10-01', [500, 90, 110, 75, 85]],
      ['fireworks_girl', '폭죽소녀', 'epic', 'fire', 'dealer', '2026-10-15', [390, 100, 80, 55, 55]],
      ['astrologer', '점성술사', 'epic', 'water', 'dealer', null, [390, 90, 95, 60, 65]],
      ['sun_moon_sword_maiden', '일월검희', 'legend', 'light', 'dealer', null, [500, 130, 110, 65, 70]]
    ];
    const bonusWaveIds = bonusWaveExpectations.map(entry => entry[0]);
    bonusWaveExpectations.forEach(([id, name, grade, element, role, releaseDate, stats]) => {
      const card = getCard(id);
      assert(card, 'missing bonus card: ' + id);
      assert.deepStrictEqual(
        [card.name, card.grade, card.element, card.role, card.releaseDate || null],
        [name, grade, element, role, releaseDate]
      );
      assert.deepStrictEqual(
        [card.stats.hp, card.stats.atk, card.stats.matk, card.stats.def, card.stats.mdef],
        stats
      );
      assert.strictEqual(card.unlockSource, releaseDate ? 'bonus' : 'hidden');
      assert(card.trait.desc && card.trait.desc.trim());
      assert(card.skills.every(skill => skill.desc && skill.desc.trim()));
    });
    assert.strictEqual(
      GameUtils.getBonusCards().filter(card => bonusWaveIds.includes(card.id)).length,
      bonusWaveIds.length
    );

    const dragonClaw = getCard('gold_dragon').skills.find(skill => skill.name === '드래곤크로');
    const starfallDash = getCard('shooting_star_boy').skills.find(skill => skill.name === '스타폴대쉬');
    const comparableSkill = skill => JSON.stringify({
      type: skill.type,
      tier: skill.tier,
      cost: skill.cost,
      val: skill.val,
      desc: skill.desc,
      effects: skill.effects
    });
    assert.strictEqual(comparableSkill(starfallDash), comparableSkill(dragonClaw));

    const traitWiring = {
      discipline_captain: { type: 'vanguard_all_grade_party_def_mdef', gradeRequired: 'normal', val: 100 },
      supernova: { type: 'death_dmg_phy_debuff', val: 4, debuff: 'burn', stack: 3 },
      shooting_star_boy: { type: 'opening_self_atk_party_mdef_down', turns: 2, atkBoost: 100, mdefDown: 30 },
      victoria: { type: 'leader_field_stat_double', val: 2 },
      holy_night: { type: 'death_dmg_phy', val: 3 },
      paladin: { type: 'pos_stat_boost', pos: 1, stat: 'atk', val: 100 },
      mad_scientist: { type: 'party_all_stats_mana_cost', statVal: 30, costMult: 2 },
      grand_merchant: { type: 'death_next_ally_max_mana', val: 20 },
      comet_tracker: { type: 'vanguard_delayed_mana_restore', val: 10 },
      prophet: { type: 'field_kaleidoscope_each_turn' },
      fireworks_girl: { type: 'death_dmg_phy_same_grade', val: 8 },
      astrologer: { type: 'alternate_party_atk_matk_turn', val: 50 },
      sun_moon_sword_maiden: { type: 'alternate_skill_type_mana', val: 10 }
    };
    Object.entries(traitWiring).forEach(([cardId, expected]) => {
      const trait = getCard(cardId).trait;
      Object.entries(expected).forEach(([key, value]) => {
        assert.strictEqual(trait[key], value, cardId + ' trait.' + key);
      });
    });

    const expectedSkills = [
      ['discipline_captain', '잔소리', 'phy', 2, 20, 2, [{ type: 'debuff', id: 'silence' }]],
      ['discipline_captain', '기강확립', 'mag', 2, 20, 2, [{ type: 'debuff', id: 'weak' }]],
      ['supernova', '파이널버스트', 'phy', 3, 30, 6, [{ type: 'suicide' }]],
      ['supernova', '코어멜트다운', 'mag', 3, 30, 2.5, [{ type: 'consume_debuff_all', debuff: 'burn', multPerStack: 2 }]],
      ['shooting_star_boy', '슈팅플레어', 'mag', 2, 20, 1.5, [{ type: 'debuff', id: 'burn', stack: 1 }]],
      ['victoria', '디바인아머', 'sup', 2, 20, null, [{ type: 'buff', id: 'guard', duration: 3 }]],
      ['victoria', '에태르랜스', 'mag', 2, 20, 2, [{ type: 'debuff', id: 'corrosion' }]],
      ['victoria', '기적의증명', 'sup', 3, 30, null, [{ type: 'delayed_field_buffs', turns: 3, buffs: ['goddess_descent', 'twinkle_party'] }]],
      ['holy_night', '샤이닝팝', 'phy', 2, 20, 2, []],
      ['holy_night', '라스트캐럴', 'phy', 3, 30, 4, [{ type: 'consume_debuff_all', debuff: 'divine', multPerStack: 2 }, { type: 'suicide' }]],
      ['paladin', '디바인아머', 'sup', 2, 20, null, [{ type: 'buff', id: 'guard', duration: 3 }]],
      ['paladin', '홀리그라운드', 'mag', 3, 30, 1, [{ type: 'field_buff', id: 'sanctuary' }]],
      ['paladin', '듀얼브레이커', 'mag', 2, 20, 2, [{ type: 'consume_field_buff_dmg', buff: 'arena', mult: 3 }]],
      ['mad_scientist', '익스페리먼트', 'mag', 2, 20, 2, [{ type: 'dmg_boost', condition: 'target_debuff', debuff: 'silence', mult: 2 }]],
      ['mad_scientist', '다크인젝션', 'phy', 2, 20, 1.5, [{ type: 'debuff', id: 'darkness' }]],
      ['grand_merchant', '마나콜렉트', 'sup', 1, 10, null, [{ type: 'mana_restore', val: 30 }]],
      ['grand_merchant', '골드러쉬', 'mag', 3, 30, 2, [{ type: 'dmg_boost', condition: 'target_debuff', debuff: 'weak', mult: 2.5 }]],
      ['comet_tracker', '코멧트래킹', 'mag', 3, 30, 4, [{ type: 'delayed_attack', turns: 2 }]],
      ['comet_tracker', '코멧플레임', 'mag', 3, 30, 2.5, [{ type: 'debuff', id: 'burn', stack: 1 }]],
      ['prophet', '샤이닝오라클', 'sup', 2, 20, null, [{ type: 'random_field_buff' }]],
      ['prophet', '슈퍼내추럴', 'sup', 3, 30, null, [{ type: 'random_skill_trigger_from_list' }]],
      ['fireworks_girl', '스파클캐논', 'mag', 2, 20, 2, [{ type: 'debuff', id: 'burn', stack: 1 }]],
      ['astrologer', '스텔라리딩', 'sup', 3, 30, null, [{ type: 'moon_to_sun' }]],
      ['astrologer', '솔라브레이커', 'mag', 2, 20, 2, [{ type: 'consume_field_buff_dmg', buff: 'sun_bless', mult: 4 }]],
      ['sun_moon_sword_maiden', '솔라크레센토', 'phy', 3, 30, 2.5, [{ type: 'dmg_boost', condition: 'field_buff', buff: 'sun_bless', mult: 2 }]],
      ['sun_moon_sword_maiden', '루나크레센토', 'mag', 3, 30, 2.5, [{ type: 'dmg_boost', condition: 'field_buff', buff: 'moon_bless', mult: 2 }]]
    ];
    expectedSkills.forEach(([cardId, name, type, tier, cost, val, effects]) => {
      const skill = getCard(cardId).skills.find(candidate => candidate.name === name);
      assert(skill, cardId + ' is missing ' + name);
      assert.deepStrictEqual(
        [skill.type, skill.tier, skill.cost, Number.isFinite(skill.val) ? skill.val : null],
        [type, tier, cost, val]
      );
      assert.strictEqual(JSON.stringify(skill.effects), JSON.stringify(effects), cardId + ' ' + name);
    });
    const festivalWiring = getCard('fireworks_girl').skills.find(skill => skill.name === '페스티벌나이트');
    assert.deepStrictEqual(
      [
        festivalWiring.type,
        festivalWiring.tier,
        festivalWiring.cost,
        festivalWiring.val,
        JSON.stringify(festivalWiring.effects[0].turns),
        festivalWiring.effects[1].debuff,
        festivalWiring.effects[1].mult
      ],
      ['phy', 3, 30, 1.5, '[1,2,3]', 'burn', 2]
    );
    assert.strictEqual(getCard('paladin').skills.length, 4);
    assert.strictEqual(getCard('victoria').skills.length, 3);

    const featureHost = {
      global: { unlocked_special_cards: [] },
      getCardData: getCard
    };
    RPGFeatureModules.install(featureHost);
    const datedWaveIds = bonusWaveExpectations.filter(entry => entry[5]).map(entry => entry[0]);
    const releasedWaveIds = date => featureHost.getReleasedStandardBonusCards(date)
      .map(card => card.id)
      .filter(id => datedWaveIds.includes(id))
      .sort();
    const expectedReleasedIds = ids => [...ids].sort();
    assert.deepStrictEqual(releasedWaveIds(new Date(2026, 6, 31, 12)), []);
    assert.deepStrictEqual(
      releasedWaveIds(new Date(2026, 7, 1, 12)),
      expectedReleasedIds(['discipline_captain', 'supernova'])
    );
    assert.deepStrictEqual(
      releasedWaveIds(new Date(2026, 7, 15, 12)),
      expectedReleasedIds(['discipline_captain', 'supernova', 'shooting_star_boy', 'victoria'])
    );
    assert.deepStrictEqual(
      releasedWaveIds(new Date(2026, 8, 1, 12)),
      expectedReleasedIds([
        'discipline_captain', 'supernova', 'shooting_star_boy', 'victoria',
        'holy_night', 'paladin'
      ])
    );
    assert.deepStrictEqual(
      releasedWaveIds(new Date(2026, 8, 15, 12)),
      expectedReleasedIds([
        'discipline_captain', 'supernova', 'shooting_star_boy', 'victoria',
        'holy_night', 'paladin', 'mad_scientist', 'grand_merchant'
      ])
    );
    assert.deepStrictEqual(
      releasedWaveIds(new Date(2026, 9, 1, 12)),
      expectedReleasedIds([
        'discipline_captain', 'supernova', 'shooting_star_boy', 'victoria',
        'holy_night', 'paladin', 'mad_scientist', 'grand_merchant',
        'comet_tracker', 'prophet'
      ])
    );
    assert.deepStrictEqual(
      releasedWaveIds(new Date(2026, 9, 15, 12)),
      expectedReleasedIds(datedWaveIds)
    );
    assert(featureHost.getHiddenBonusCards().some(card => card.id === 'astrologer'));
    assert(featureHost.getHiddenBonusCards().some(card => card.id === 'sun_moon_sword_maiden'));
    assert.strictEqual(
      featureHost.getReleasedStandardBonusCards(new Date(2030, 0, 1))
        .some(card => ['astrologer', 'sun_moon_sword_maiden'].includes(card.id)),
      false
    );
    const allHiddenBonusIds = featureHost.getHiddenBonusCards().map(card => card.id);
    ['astrologer', 'sun_moon_sword_maiden'].forEach(targetId => {
      const monthlyMissionHost = {
        global: {
          unlocked_bonus_cards: allHiddenBonusIds.filter(id => id !== targetId)
        },
        getCardData: getCard
      };
      RPGFeatureModules.install(monthlyMissionHost);
      assert.strictEqual(
        monthlyMissionHost.createMonthlyMissionState().rewardCardId,
        targetId,
        targetId + ' must remain obtainable from the monthly mission'
      );
    });

    // Swimsuit Luna is reachable through the real beach mission reward selection.
    const beachHost = {
      global: {
        unlocked_special_cards: [
          'jasmine_swimsuit', 'rumi_swimsuit', 'zeke_swimsuit',
          'snow_rabbit_swimsuit', 'night_rabbit_swimsuit', 'silver_rabbit_swimsuit'
        ]
      },
      getCardData: getCard
    };
    RPGFeatureModules.install(beachHost);
    assert.deepStrictEqual(
      Array.from(beachHost.getRemainingSpecialRewardCards('beach'), card => card.id),
      ['luna_swimsuit']
    );
    const beachMission = beachHost.createSpecialMissionState({
      season: beachHost.getCurrentSpecialSeason(new Date(2026, 6, 15)),
      unlocked: true
    });
    assert.strictEqual(beachMission.rewardCardId, 'luna_swimsuit');

    // Beginner safety gives Factory/Restriction/Balance tickets instead of a free Rumi.
    ['factory', 'restriction', 'balance'].forEach((mode, index) => {
      const safetyHost = {
        global: { unlocked_bonus_cards: [] },
        state: { gameType: 'challenge', tickets: index === 0 ? 20 : 10, inventory: [] }
      };
      RPGFeatureModules.install(safetyHost);
      safetyHost.applyBeginnerChallengeSafety(mode);
      assert.strictEqual(safetyHost.state.tickets, index === 0 ? 23 : 13);
      assert.strictEqual(safetyHost.state.inventory.includes('rumi'), false);
    });

    // Divine artifact unlocks replace their base artifact in both new mode pools.
    const divineArtifactPool = GameUtils.getArtifactSelectionPool({ unlocked_divine_artifacts: ['divine_flora'] });
    assert(divineArtifactPool.some(artifact => artifact.id === 'divine_flora'));
    assert.strictEqual(divineArtifactPool.some(artifact => artifact.id === 'nature_blessing'), false);

    const reserveHost = {
      global: { unlocked_divine_artifacts: ['divine_flora'] },
      state: {
        mode: 'artifact_reserve',
        artifacts: [],
        artifactReservePool: [],
        artifactReserveDraft: { active: true, round: 1, maxRounds: 4, pool: [], currentBundles: [] }
      },
      showScreen: quiet,
      renderArtifactReserveDraftScreen: quiet,
      showAlert: quiet,
      toMenu: quiet
    };
    RPGFeatureModules.install(reserveHost);
    reserveHost.saveGame = quiet;
    for (let round = 0; round < 4; round++) {
      reserveHost.generateArtifactReserveBundles();
      const bundles = reserveHost.state.artifactReserveDraft.currentBundles;
      assert.deepStrictEqual(Array.from(bundles, bundle => bundle.length), [3, 3]);
      assert.strictEqual(new Set(bundles.flat()).size, 6);
      assert.strictEqual(
        bundles.flat().some(id => reserveHost.state.artifactReserveDraft.pool.includes(id)),
        false
      );
      reserveHost.selectArtifactReserveBundle(0);
    }
    assert.strictEqual(reserveHost.state.artifactReserveDraft.active, false);
    assert.strictEqual(reserveHost.state.artifactReservePool.length, 12);
    assert.strictEqual(new Set(reserveHost.state.artifactReservePool.map(entry => entry.id)).size, 12);
    assert(reserveHost.state.artifactReservePool.every(entry => entry.remainingUses === 2));
    const reserveIds = reserveHost.state.artifactReservePool.map(entry => entry.id);
    reserveIds.slice(0, 4).forEach(id => assert.strictEqual(reserveHost.toggleArtifactReserveArtifact(id), true));
    assert.strictEqual(reserveHost.state.artifacts.length, 4);
    assert.strictEqual(reserveHost.toggleArtifactReserveArtifact(reserveIds[4]), false);
    assert.deepStrictEqual(Array.from(reserveHost.consumeArtifactReserveUsesForBattle()).sort(), Array.from(reserveIds.slice(0, 4)).sort());
    assert(reserveHost.state.artifactReservePool.slice(0, 4).every(entry => entry.remainingUses === 1));
    assert.strictEqual(reserveHost.state.artifacts.length, 0);
    reserveHost.state.artifactReservePool[0].remainingUses = 0;
    assert.strictEqual(reserveHost.toggleArtifactReserveArtifact(reserveIds[0]), false);

    const artifactChaosHost = {
      global: { unlocked_divine_artifacts: ['divine_flora'], unlocked_bonus_cards: [] },
      state: {
        mode: 'artifact_chaos', artifacts: [], chaosPool: [], inventory: [], deck: [null, null, null],
        activeTranscendenceCards: [], activeBonusPoolIds: [], activeSpecialCardSelections: {}, activeEventCards: []
      }
    };
    RPGFeatureModules.install(artifactChaosHost);
    const artifactChaosIds = artifactChaosHost.resetArtifactChaosRound();
    const allowedArtifactIds = new Set(divineArtifactPool.map(artifact => artifact.id));
    assert.strictEqual(artifactChaosHost.state.chaosPool.length, GAME_CONSTANTS.CHAOS_POOL_SIZE);
    assert.deepStrictEqual(Array.from(artifactChaosHost.state.inventory), Array.from(artifactChaosHost.state.chaosPool));
    assert.strictEqual(artifactChaosIds.length, GAME_CONSTANTS.MAX_ARTIFACTS);
    assert.strictEqual(new Set(artifactChaosIds).size, GAME_CONSTANTS.MAX_ARTIFACTS);
    assert(artifactChaosIds.every(id => allowedArtifactIds.has(id)));

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

    const allCardData = GameUtils.getAllCards();
    const buildWaveUnit = (id, deck, idx) => {
      const proto = getCard(id);
      const init = Logic.calculateInitialStats(proto, deck, allCardData, idx);
      return makeUnit({
        id,
        name: proto.name,
        ...init.stats,
        proto,
        activeTrait: init.activeTrait,
        pos: idx,
        isDead: false,
        skills: JSON.parse(JSON.stringify(proto.skills)),
        buffs: {}
      });
    };

    // Time Magician's balance adjustment is reflected in its source stats.
    assert.deepStrictEqual(
      Object.values(getCard('time_magician').stats),
      [330, 70, 90, 50, 55]
    );

    // New positional, opening-turn, party-stat, and field-stat traits use engine conventions.
    const allNormalDeck = ['discipline_captain', 'marshmallow', 'kobold'];
    const disciplineFront = buildWaveUnit('discipline_captain', allNormalDeck, 0);
    const disciplinedPeer = buildWaveUnit('marshmallow', allNormalDeck, 1);
    assert.strictEqual(disciplineFront.activeTrait, 'vanguard_all_grade_party_def_mdef');
    assert.deepStrictEqual([disciplineFront.def, disciplineFront.mdef], [120, 120]);
    assert.deepStrictEqual([disciplinedPeer.def, disciplinedPeer.mdef], [100, 100]);
    const mixedDiscipline = buildWaveUnit(
      'discipline_captain',
      ['discipline_captain', 'marshmallow', 'paladin'],
      0
    );
    assert.strictEqual(mixedDiscipline.activeTrait, null);
    assert.deepStrictEqual([mixedDiscipline.def, mixedDiscipline.mdef], [60, 60]);

    const starDeck = ['shooting_star_boy', 'marshmallow', 'kobold'];
    const shootingStar = buildWaveUnit('shooting_star_boy', starDeck, 0);
    assert.strictEqual(shootingStar.mdef, 38);
    assert.strictEqual(Logic.calculateStats(shootingStar, [], 'default', [], 1).atk, 170);
    assert.strictEqual(Logic.calculateStats(shootingStar, [], 'default', [], 2).atk, 170);
    assert.strictEqual(Logic.calculateStats(shootingStar, [], 'default', [], 3).atk, 85);
    const lateShootingStar = { ...shootingStar, enteredAtTurn: 3 };
    assert.strictEqual(Logic.calculateStats(lateShootingStar, [], 'default', [], 3).atk, 170);
    assert.strictEqual(Logic.calculateStats(lateShootingStar, [], 'default', [], 4).atk, 170);
    assert.strictEqual(Logic.calculateStats(lateShootingStar, [], 'default', [], 5).atk, 85);
    const duplicateStarDeck = ['shooting_star_boy', 'shooting_star_boy', 'shooting_star_boy'];
    assert(Logic.calculateInitialStats(getCard('shooting_star_boy'), duplicateStarDeck, GameUtils.getAllCards(), 0).stats.mdef >= 0);
    const starSkillTarget = makeUnit({ hp: 5000, maxHp: 5000 });
    const fullHpStar = { ...shootingStar, hp: shootingStar.maxHp, baseCrit: -100 };
    const hurtStar = { ...shootingStar, hp: shootingStar.maxHp - 1, baseCrit: -100 };
    const fullHpStarDamage = Logic.calculateDamage(
      fullHpStar, starSkillTarget, starfallDash, [], [], quiet, 'default', starDeck, 3, []
    ).dmg;
    const hurtStarDamage = Logic.calculateDamage(
      hurtStar, starSkillTarget, starfallDash, [], [], quiet, 'default', starDeck, 3, []
    ).dmg;
    assert.strictEqual(fullHpStarDamage, hurtStarDamage * 2);

    const madDeck = ['mad_scientist', 'luna', 'paladin'];
    const madScientist = buildWaveUnit('mad_scientist', madDeck, 0);
    const madScientistPeer = buildWaveUnit('luna', madDeck, 1);
    assert.deepStrictEqual(
      [madScientist.atk, madScientist.matk, madScientist.def, madScientist.mdef],
      [104, 104, 71, 71]
    );
    assert.deepStrictEqual(
      [madScientistPeer.atk, madScientistPeer.matk, madScientistPeer.def, madScientistPeer.mdef],
      [169, 169, 78, 84]
    );
    const duplicateMadDeck = ['mad_scientist', 'mad_scientist', 'luna'];
    const duplicateMadScientist = buildWaveUnit('mad_scientist', duplicateMadDeck, 0);
    const duplicateMadPeer = buildWaveUnit('luna', duplicateMadDeck, 2);
    assert.deepStrictEqual(
      [duplicateMadScientist.atk, duplicateMadScientist.matk, duplicateMadScientist.def, duplicateMadScientist.mdef],
      [104, 104, 71, 71]
    );
    assert.deepStrictEqual(
      [duplicateMadPeer.atk, duplicateMadPeer.matk, duplicateMadPeer.def, duplicateMadPeer.mdef],
      [169, 169, 78, 84]
    );

    assert.strictEqual(
      buildWaveUnit('paladin', ['marshmallow', 'paladin', 'kobold'], 1).atk,
      210
    );
    assert.strictEqual(
      buildWaveUnit('paladin', ['paladin', 'marshmallow', 'kobold'], 0).atk,
      105
    );

    const victoriaLeader = buildWaveUnit('victoria', ['marshmallow', 'kobold', 'victoria'], 2);
    const victoriaFront = buildWaveUnit('victoria', ['victoria', 'marshmallow', 'kobold'], 0);
    assert.strictEqual(victoriaLeader.fieldBuffStatMult, 2);
    assert.strictEqual(victoriaFront.fieldBuffStatMult, undefined);
    assert.deepStrictEqual(
      [
        Logic.calculateStats(victoriaLeader, [{ name: 'sun_bless' }], 'default', [], 1).atk,
        Logic.calculateStats(victoriaFront, [{ name: 'sun_bless' }], 'default', [], 1).atk
      ],
      [160, 130]
    );
    const forcedCrit = { name: '검증용 치명타', type: 'phy', val: 1, effects: [{ type: 'force_crit' }] };
    const critTarget = makeUnit({ def: 0, mdef: 0 });
    assert.strictEqual(
      Logic.calculateDamage(victoriaLeader, critTarget, forcedCrit, [{ name: 'sun_bless' }], [], quiet, 'default', [], 1, []).dmg,
      432
    );
    assert.strictEqual(
      Logic.calculateDamage(victoriaFront, critTarget, forcedCrit, [{ name: 'sun_bless' }], [], quiet, 'default', [], 1, []).dmg,
      273
    );
    assert.strictEqual(
      Logic.calculateDamage(victoriaLeader, critTarget, forcedCrit, [{ name: 'sun_bless' }], [], quiet, 'flood', [], 1, []).dmg,
      858
    );

    const alternatingUnit = makeUnit({ atk: 100, matk: 100, alternatingAttackStatPercent: 50 });
    assert.deepStrictEqual(
      [
        Logic.calculateStats(alternatingUnit, [], 'default', [], 1).atk,
        Logic.calculateStats(alternatingUnit, [], 'default', [], 1).matk
      ],
      [50, 150]
    );
    assert.deepStrictEqual(
      [
        Logic.calculateStats(alternatingUnit, [], 'default', [], 2).atk,
        Logic.calculateStats(alternatingUnit, [], 'default', [], 2).matk
      ],
      [150, 50]
    );

    // New death effects preserve exact damage and stack conditions.
    const deathTarget = makeUnit({ hp: 10000, maxHp: 10000, baseCrit: -100 });
    const supernovaUnit = buildWaveUnit('supernova', ['supernova'], 0);
    supernovaUnit.baseCrit = -100;
    const supernovaDeath = Logic.handleDeathTraits(
      supernovaUnit, deathTarget, [], quiet, ['supernova'], 1, []
    );
    assert.strictEqual(supernovaDeath.damageToKiller, 500);
    assert.strictEqual(supernovaDeath.killerDebuffs.burn, 3);

    const fireworksUnit = buildWaveUnit(
      'fireworks_girl',
      ['fireworks_girl', 'astrologer', 'paladin'],
      0
    );
    fireworksUnit.baseCrit = -100;
    assert.strictEqual(
      Logic.handleDeathTraits(
        fireworksUnit,
        deathTarget,
        [],
        quiet,
        ['fireworks_girl', 'astrologer', 'paladin'],
        1,
        []
      ).damageToKiller,
      800
    );
    assert.strictEqual(
      Logic.handleDeathTraits(
        fireworksUnit,
        deathTarget,
        [],
        quiet,
        ['fireworks_girl', 'supernova'],
        1,
        []
      ).damageToKiller,
      0
    );

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

    // Transcendence Lumi restores 20 MP on normal attacks, capped at max MP.
    const dreamLumi = makeUnit({
      id: 'trans_lumi', name: '루미(꿈의형태)', mp: 90, maxMp: 100,
      proto: getCard('trans_lumi'), buffs: {}, baseCrit: -100
    });
    const dreamLumiRpg = makeRpg(dreamLumi, ['trans_lumi']);
    const originalEndPlayerTurn = BattleRuntime.TurnManager.endPlayerTurn;
    BattleRuntime.TurnManager.endPlayerTurn = quiet;
    BattleRuntime.executeSkill(
      dreamLumiRpg, dreamLumi, dreamLumiRpg.battle.enemy, dreamLumiRpg.NORMAL_ATTACK
    );
    BattleRuntime.TurnManager.endPlayerTurn = originalEndPlayerTurn;
    assert.strictEqual(dreamLumi.mp, 100);
    assert.deepStrictEqual(
      [dreamLumi.proto.trait.type, dreamLumi.proto.trait.val],
      ['normal_attack_mana_restore', 20]
    );

    // Destiny Roulette and Supernatural share the complete 14-skill pool.
    const roulettePool = [
      ['gold_dragon', '얼티밋브레스'],
      ['zeke', '라그나로크'],
      ['jasmine', '여신강림'],
      ['frozen_witch', '블리자드'],
      ['behemoth', '어스퀘이크'],
      ['gray', '차원절단'],
      ['rumi', '밀키웨이엑스터시'],
      ['phoenix', '메테오임팩트'],
      ['time_ruler', '섀도우트위스트'],
      ['cinderella', '미드나잇스펠'],
      ['luna', '다크메테오'],
      ['sakura', '봉인부'],
      ['cure_master', '레모네이드'],
      ['perfect_aurora', '퍼펙트플랜']
    ];
    const rouletteSource = makeUnit({ id: 'roulette-source', proto: getCard('trans_chaos_lord') });
    const rouletteRpg = makeRpg(rouletteSource, ['trans_chaos_lord']);
    const rouletteSkill = rouletteSource.proto.skills.find(skill => skill.name === '데스티니룰렛');
    const originalRouletteRandom = Math.random;
    const originalExecuteSkill = BattleRuntime.executeSkill;
    roulettePool.forEach(([cardId, skillName], index) => {
      const executedSkills = [];
      rouletteRpg.battle.delayedEffects = [];
      Math.random = () => (index + 0.1) / roulettePool.length;
      BattleRuntime.executeSkill = (rpg, source, target, triggeredSkill) => executedSkills.push(triggeredSkill.name);
      BattleRuntime.applySkillEffects(rouletteRpg, rouletteSource, rouletteRpg.battle.enemy, rouletteSkill);
      const expectedSkill = getCard(cardId).skills.find(skill => skill.name === skillName);
      assert(expectedSkill, 'roulette target is missing: ' + cardId + '/' + skillName);
      if (findDelayedSkillEffect(expectedSkill)) {
        assert.strictEqual(rouletteRpg.battle.delayedEffects.length, 1);
        assert.strictEqual(rouletteRpg.battle.delayedEffects[0].skill.name, skillName);
      } else {
        assert.deepStrictEqual(executedSkills, [skillName]);
      }
    });
    Math.random = originalRouletteRandom;
    BattleRuntime.executeSkill = originalExecuteSkill;

    // Battle initialization applies the scientist's cost penalty and astrologer's party cycle.
    const makeBattleInitRpg = deck => ({
      state: {
        deck,
        artifacts: [],
        chaosBuffs: [],
        mode: 'default',
        gameType: 'standard',
        enemyScale: 0,
        hardMode: false
      },
      battle: {},
      NORMAL_ATTACK: { name: '일반 공격', type: 'phy', tier: 1, cost: 0, val: 1, effects: [] },
      getCardData: getCard,
      getCurrentStageEnemyData: () => ENEMIES[0],
      hasArtifact: () => false,
      showBattleScreen: quiet,
      showAlert: message => { throw new Error(message); },
      clearBattleLog: quiet,
      log: quiet,
      renderBattleView: quiet,
      renderBattleControls: quiet,
      winBattle: quiet,
      loseBattle: quiet
    });
    const startPlayerTurnOriginal = BattleRuntime.TurnManager.startPlayerTurn;
    BattleRuntime.TurnManager.startPlayerTurn = quiet;
    const waveInitRpg = makeBattleInitRpg(['mad_scientist', 'astrologer', 'grand_merchant']);
    BattleRuntime.startBattleInit(waveInitRpg);
    BattleRuntime.TurnManager.startPlayerTurn = startPlayerTurnOriginal;
    assert.deepStrictEqual(
      Array.from(waveInitRpg.battle.players[0].skills, skill => skill.cost),
      [20, 40, 40]
    );
    assert(waveInitRpg.battle.players.every(unit => unit.alternatingAttackStatPercent === 50));
    assert(waveInitRpg.battle.players.every(unit => unit.maxMp === 100 && unit.mp === 100));

    const reserveBattleRpg = makeBattleInitRpg(['marshmallow', null, null]);
    reserveBattleRpg.state.mode = 'artifact_reserve';
    reserveBattleRpg.state.artifactReserveDraft = { active: false };
    let reserveUseCalls = 0;
    reserveBattleRpg.consumeArtifactReserveUsesForBattle = () => { reserveUseCalls++; return []; };
    BattleRuntime.TurnManager.startPlayerTurn = quiet;
    BattleRuntime.startBattleInit(reserveBattleRpg);
    BattleRuntime.TurnManager.startPlayerTurn = startPlayerTurnOriginal;
    assert.strictEqual(reserveUseCalls, 0);

    const buildScaledEnemy = (mode, gameType) => buildBattleEnemy({
      state: { mode, gameType, enemyScale: 0, hardMode: false },
      getCurrentStageEnemyData: () => ENEMIES[0]
    });
    assert.strictEqual(buildScaledEnemy('default', 'challenge').maxHp, ENEMIES[0].stats.hp);
    assert.strictEqual(buildScaledEnemy('artifact_chaos', 'challenge').maxHp, Math.floor(ENEMIES[0].stats.hp * 1.1));
    assert.strictEqual(buildScaledEnemy('artifact_reserve', 'endless').maxHp, Math.floor(ENEMIES[0].stats.hp * 1.1));

    // The merchant hands 20 maximum and current mana to the next living ally.
    const merchantVictim = buildWaveUnit('grand_merchant', ['grand_merchant', 'marshmallow', 'kobold'], 0);
    merchantVictim.isDead = true;
    const deadMiddle = makeUnit({ name: 'dead middle', pos: 1, isDead: true });
    const merchantSuccessor = makeUnit({ name: 'successor', pos: 2, isDead: false, mp: 100, maxMp: 100 });
    const merchantRpg = makeRpg(merchantVictim, ['grand_merchant', 'marshmallow', 'kobold']);
    merchantRpg.battle.players = [merchantVictim, deadMiddle, merchantSuccessor];
    BattleRuntime.handleDeathTraits(merchantRpg, merchantVictim, merchantRpg.battle.enemy);
    assert.deepStrictEqual([merchantSuccessor.mp, merchantSuccessor.maxMp], [120, 120]);
    BattleRuntime.applySkillEffects(
      merchantRpg,
      merchantSuccessor,
      merchantRpg.battle.enemy,
      getCard('grand_merchant').skills.find(skill => skill.name === '마나콜렉트')
    );
    assert.deepStrictEqual([merchantSuccessor.mp, merchantSuccessor.maxMp], [120, 120]);

    // The comet trait recovers mana only when a reserved delayed skill actually fires.
    scheduledCallbacks.length = 0;
    const cometSource = buildWaveUnit('comet_tracker', ['comet_tracker'], 0);
    const cometRpg = makeRpg(cometSource, ['comet_tracker']);
    cometRpg.battle.activeTraits = ['vanguard_delayed_mana_restore'];
    cometRpg.battle.enemy = makeUnit({ id: 'comet-target', hp: 5000, maxHp: 5000 });
    const cometTracking = cometSource.skills.find(skill => skill.name === '코멧트래킹');
    BattleRuntime.executeSkill(cometRpg, cometSource, cometRpg.battle.enemy, cometTracking);
    assert.strictEqual(cometSource.mp, 70);
    assert.strictEqual(cometRpg.battle.delayedEffects.length, 1);
    const reservedComet = cometRpg.battle.delayedEffects[0].skill;
    assert.strictEqual(reservedComet.isActualDelayedTrigger, true);
    assert.strictEqual(cometRpg.battle.delayedEffects[0].turn, 3);
    cometRpg.battle.turn = 3;
    cometRpg.battle.isNewTurn = false;
    BattleRuntime.TurnManager.startPlayerTurn(cometRpg);
    assert.strictEqual(cometSource.mp, 80);
    assert.strictEqual(cometRpg.battle.delayedEffects.length, 0);
    cometSource.mp = 50;
    BattleRuntime.executeSkill(
      cometRpg,
      cometSource,
      cometRpg.battle.enemy,
      { name: '즉시 랜덤 보조', type: 'sup', cost: 0, effects: [] },
      true
    );
    assert.strictEqual(cometSource.mp, 50);

    const instantTracker = buildWaveUnit(
      'comet_tracker',
      ['comet_tracker', 'time_ruler', 'time_magician'],
      0
    );
    const instantDelayedCaster = buildWaveUnit(
      'time_ruler',
      ['comet_tracker', 'time_ruler', 'time_magician'],
      1
    );
    const instantTimeMagician = buildWaveUnit(
      'time_magician',
      ['comet_tracker', 'time_ruler', 'time_magician'],
      2
    );
    const instantDelayRpg = makeRpg(
      instantTracker,
      ['comet_tracker', 'time_ruler', 'time_magician']
    );
    instantDelayRpg.battle.players = [instantTracker, instantDelayedCaster, instantTimeMagician];
    instantDelayRpg.battle.currentPlayerIdx = 1;
    instantDelayRpg.battle.activeTraits = ['vanguard_delayed_mana_restore', 'instant_delayed_skills'];
    instantDelayRpg.battle.enemy = makeUnit({ id: 'instant-delay-target', hp: 5000, maxHp: 5000 });
    BattleRuntime.executeSkill(
      instantDelayRpg,
      instantDelayedCaster,
      instantDelayRpg.battle.enemy,
      instantDelayedCaster.skills.find(skill => skill.name === '종언의예고')
    );
    assert.strictEqual(instantDelayedCaster.mp, 80);
    assert.strictEqual(instantDelayRpg.battle.delayedEffects.length, 0);

    // Victoria's proof resolves after three turns and creates both fixed field buffs.
    scheduledCallbacks.length = 0;
    const proofSource = buildWaveUnit('victoria', ['victoria'], 0);
    const proofRpg = makeRpg(proofSource, ['victoria']);
    proofRpg.battle.enemy = makeUnit({ id: 'proof-target', hp: 5000, maxHp: 5000 });
    const miracleProof = proofSource.skills.find(skill => skill.name === '기적의증명');
    BattleRuntime.executeSkill(proofRpg, proofSource, proofRpg.battle.enemy, miracleProof);
    assert.strictEqual(proofRpg.battle.delayedEffects[0].turn, 4);
    proofRpg.battle.turn = 4;
    proofRpg.battle.isNewTurn = false;
    BattleRuntime.TurnManager.startPlayerTurn(proofRpg);
    assert.strictEqual(proofRpg.battle.delayedEffects.length, 0);
    assert.deepStrictEqual(
      Array.from(proofRpg.battle.fieldBuffs, buff => buff.name).sort(),
      ['goddess_descent', 'twinkle_party']
    );

    // Festival Night schedules exactly three Phantom-style hits and checks burn on every hit.
    scheduledCallbacks.length = 0;
    const fireworksSource = buildWaveUnit('fireworks_girl', ['fireworks_girl'], 0);
    fireworksSource.baseCrit = -100;
    const fireworksRpg = makeRpg(fireworksSource, ['fireworks_girl']);
    fireworksRpg.battle.enemy = makeUnit({
      id: 'festival-target',
      hp: 10000,
      maxHp: 10000,
      buffs: { burn: 1 }
    });
    const festivalNight = fireworksSource.skills.find(skill => skill.name === '페스티벌나이트');
    BattleRuntime.executeSkill(fireworksRpg, fireworksSource, fireworksRpg.battle.enemy, festivalNight);
    assert.deepStrictEqual(
      Array.from(fireworksRpg.battle.delayedEffects, effect => effect.turn),
      [2, 3, 4]
    );
    BattleRuntime.executeSkill(
      fireworksRpg,
      fireworksSource,
      fireworksRpg.battle.enemy,
      fireworksRpg.battle.delayedEffects[0].skill,
      true
    );
    delete fireworksRpg.battle.enemy.buffs.burn;
    fireworksRpg.battle.delayedEffects.slice(1).forEach(effect => {
      BattleRuntime.executeSkill(fireworksRpg, fireworksSource, fireworksRpg.battle.enemy, effect.skill, true);
    });
    assert.strictEqual(fireworksRpg.battle.enemy.hp, 9400);

    // Stellar Reading alternates moon creation and moon-to-sun conversion.
    const astrologerSource = buildWaveUnit('astrologer', ['astrologer'], 0);
    const astrologerRpg = makeRpg(astrologerSource, ['astrologer']);
    const stellarReading = astrologerSource.skills.find(skill => skill.name === '스텔라리딩');
    BattleRuntime.applySkillEffects(astrologerRpg, astrologerSource, astrologerRpg.battle.enemy, stellarReading);
    assert.deepStrictEqual(
      Array.from(astrologerRpg.battle.fieldBuffs, buff => buff.name),
      ['moon_bless']
    );
    BattleRuntime.applySkillEffects(astrologerRpg, astrologerSource, astrologerRpg.battle.enemy, stellarReading);
    assert.deepStrictEqual(
      Array.from(astrologerRpg.battle.fieldBuffs, buff => buff.name),
      ['sun_bless']
    );

    // Prophet and the Kaleidoscope artifact share one replacement pass per turn.
    const prophetTraitSource = buildWaveUnit('prophet', ['prophet'], 0);
    const prophetTraitRpg = makeRpg(prophetTraitSource, ['prophet'], [{ name: 'sun_bless' }]);
    prophetTraitRpg.battle.activeTraits = ['field_kaleidoscope_each_turn'];
    prophetTraitRpg.battle.isNewTurn = true;
    let kaleidoscopeReplacementCount = 0;
    const replaceFieldBuffsOriginal = BattleRuntime.replaceFieldBuffsLikeKaleidoscope;
    BattleRuntime.replaceFieldBuffsLikeKaleidoscope = rpg => {
      kaleidoscopeReplacementCount++;
      return replaceFieldBuffsOriginal(rpg);
    };
    BattleRuntime.TurnManager.startPlayerTurn(prophetTraitRpg);
    assert.strictEqual(kaleidoscopeReplacementCount, 1);
    assert.strictEqual(prophetTraitRpg.battle.fieldBuffs.length, 1);

    const prophetCombinedSource = buildWaveUnit('prophet', ['prophet'], 0);
    const prophetCombinedRpg = makeRpg(
      prophetCombinedSource,
      ['prophet'],
      [{ name: 'sun_bless' }]
    );
    prophetCombinedRpg.battle.activeTraits = ['field_kaleidoscope_each_turn'];
    prophetCombinedRpg.battle.isNewTurn = true;
    prophetCombinedRpg.hasArtifact = id => id === 'kaleidoscope';
    kaleidoscopeReplacementCount = 0;
    BattleRuntime.TurnManager.startPlayerTurn(prophetCombinedRpg);
    BattleRuntime.replaceFieldBuffsLikeKaleidoscope = replaceFieldBuffsOriginal;
    assert.strictEqual(kaleidoscopeReplacementCount, 1);
    assert.strictEqual(prophetCombinedRpg.battle.fieldBuffs.length, 1);

    // Sun-Moon Sword Maiden restores mana only after a manual skill-type change.
    scheduledCallbacks.length = 0;
    const swordMaiden = buildWaveUnit('sun_moon_sword_maiden', ['sun_moon_sword_maiden'], 0);
    swordMaiden.mp = 60;
    const swordRpg = makeRpg(swordMaiden, ['sun_moon_sword_maiden']);
    swordRpg.battle.enemy = makeUnit({ id: 'sword-target', hp: 10000, maxHp: 10000 });
    const useSwordSkill = (name, type) => {
      swordRpg.battle.phase = 'player-ready';
      assert.strictEqual(
        BattleRuntime.executeSkill(
          swordRpg,
          swordMaiden,
          swordRpg.battle.enemy,
          { name, type, cost: 10, val: type === 'sup' ? undefined : 1, effects: [] }
        ),
        true
      );
      return swordMaiden.mp;
    };
    assert.strictEqual(useSwordSkill('첫 물리', 'phy'), 50);
    assert.strictEqual(useSwordSkill('같은 물리', 'phy'), 40);
    assert.strictEqual(useSwordSkill('마법 전환', 'mag'), 40);
    assert.strictEqual(useSwordSkill('보조 전환', 'sup'), 40);

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
