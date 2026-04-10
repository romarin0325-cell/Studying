const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = pathToFileURL(path.join(process.cwd(), 'card', 'index.html')).href;

  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error(error);
    }
  });

  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const loading = document.getElementById('title-loading');
    return !!loading && loading.classList.contains('hidden');
  }, { timeout: 15000 });

  const results = await page.evaluate(() => {
    const output = [];
    const record = (name, detail) => output.push({ name, result: 'PASS', detail });
    const assert = (condition, name, detail) => {
      if (!condition) {
        throw new Error(`${name}: ${detail}`);
      }
      record(name, detail);
    };

    localStorage.clear();
    RPG.loadGlobalData();

    const titleButtons = [...document.querySelectorAll('.title-screen-actions button')].map(btn => btn.innerText.trim());
    assert(
      JSON.stringify(titleButtons) === JSON.stringify(['새로하기', '이어하기', '질문하기', '미션확인']),
      'title_menu',
      titleButtons.join(', ')
    );

    RPG.openMissionHub();
    const missionButtons = [...document.querySelectorAll('#mission-hub-list button')].map(btn => btn.innerText.replace(/\s+/g, ' ').trim());
    assert(
      missionButtons.some(text => text.includes('월간 미션')) &&
      missionButtons.some(text => text.includes('주간 미션')) &&
      !missionButtons.some(text => text.includes('스페셜미션')),
      'mission_hub_default',
      missionButtons.join(' | ')
    );
    RPG.closeMissionHub();

    RPG.startGame('new');
    const typeButtons = [...document.querySelectorAll('#modal-type-select .menu-btn')].map(btn => btn.innerText.replace(/\s+/g, ' ').trim());
    assert(
      typeButtons.some(text => text.includes('무한 모드')) &&
      typeButtons.some(text => text.includes('도전 모드')) &&
      typeButtons.some(text => text.includes('덱 편집')) &&
      !typeButtons.some(text => text.includes('월간 미션')) &&
      !typeButtons.some(text => text.includes('주간 미션')),
      'type_select_menu',
      typeButtons.join(' | ')
    );
    const specialEditorDisplayBefore = window.getComputedStyle(document.getElementById('btn-special-card-editor')).display;
    assert(specialEditorDisplayBefore === 'none', 'special_editor_hidden_before_reward', `display=${specialEditorDisplayBefore}`);

    const originalRandom = Math.random;
    const season = RPG.getCurrentSpecialSeason();
    Math.random = () => 0;
    const unlockMsg = RPG.tryUnlockSpecialMissionFromDreamCorridor(6);
    Math.random = originalRandom;
    assert(!!unlockMsg && RPG.isSpecialMissionVisible(), 'special_unlock', unlockMsg);
    RPG.renderMissionHub();
    const missionButtonsAfterUnlock = [...document.querySelectorAll('#mission-hub-list button')].map(btn => btn.innerText.replace(/\s+/g, ' ').trim());
    assert(
      missionButtonsAfterUnlock.some(text => text.includes(season.title)),
      'mission_hub_special_visible',
      missionButtonsAfterUnlock.join(' | ')
    );

    RPG.state.gameType = 'endless';
    RPG.state.mode = 'origin';
    RPG.state.enemyScale = 5;
    RPG.clearPendingEnemySelection();
    Math.random = () => 0;
    const stage6Enemy = RPG.getCurrentStageEnemyData();
    Math.random = originalRandom;
    assert(stage6Enemy.id === season.bossId, 'special_boss_spawn', `${stage6Enemy.id} @ stage 6`);

    RPG.state.inventory = ['luna'];
    RPG.state.deck = ['luna', null, null];
    RPG.state.enemyScale = 5;
    RPG.clearPendingEnemySelection();
    Math.random = () => 0;
    RPG.startBattleInit();
    Math.random = originalRandom;
    assert(
      RPG.battle.enemy.id === season.bossId &&
      RPG.battle.enemy.bonusRewardTickets === 0 &&
      RPG.battle.enemy.bonusTranscendenceReward === null,
      'special_boss_rewards',
      `tickets=${RPG.battle.enemy.bonusRewardTickets}, trans=${RPG.battle.enemy.bonusTranscendenceReward}`
    );

    RPG.winBattle();
    assert(
      RPG.global.specialMission.missions.boss.progress === 1,
      'special_mission_boss_progress',
      `boss=${RPG.global.specialMission.missions.boss.progress}`
    );

    RPG.state.inventory = ['luna'];
    RPG.state.deck = ['luna', null, null];
    RPG.state.enemyScale = 11;
    RPG.clearPendingEnemySelection();
    const specialEnemyBase = RPG.getEnemyDataById(season.bossId);
    const expectedScaledHp = Math.floor(specialEnemyBase.stats.hp * 1.2);
    Math.random = () => 0;
    RPG.startBattleInit();
    Math.random = originalRandom;
    assert(
      RPG.battle.enemy.id === season.bossId && RPG.battle.enemy.maxHp === expectedScaledHp,
      'special_boss_scaling',
      `hp=${RPG.battle.enemy.maxHp}`
    );

    RPG.openLumiQuestion();
    assert(
      document.getElementById('modal-lumi-question').classList.contains('active'),
      'question_modal_open',
      '루미 질문 모달 활성화'
    );
    RPG.closeLumiQuestion();

    const worldTree = GameUtils.getCardById('world_tree');
    const natureStats = Logic.calculateInitialStats(worldTree, ['world_tree', 'mushroom_king', 'sunflower'], GameUtils.getAllCards(), 0);
    assert(
      natureStats.stats.atk === 117 && natureStats.stats.def === 78,
      'trait_stat_boost',
      `atk=${natureStats.stats.atk}, def=${natureStats.stats.def}`
    );

    const ancientDragon = GameUtils.getCardById('ancient_dragon');
    const previousArtifacts = [...(RPG.state.artifacts || [])];
    RPG.state.artifacts = ['dragon_heart'];
    const dragonStats = Logic.calculateInitialStats(ancientDragon, ['ancient_dragon', 'rumi', 'jasmine'], GameUtils.getAllCards(), 0);
    RPG.state.artifacts = previousArtifacts;
    assert(dragonStats.stats.matk === 190, 'artifact_apply', `matk=${dragonStats.stats.matk}`);

    const jasmine = GameUtils.getCardById('jasmine');
    const jasmineInit = Logic.calculateInitialStats(jasmine, ['jasmine', 'rumi', 'zeke'], GameUtils.getAllCards(), 0);
    const jasmineChar = { proto: jasmine, ...jasmineInit.stats, buffs: {} };
    const jasmineBuffed = Logic.calculateStats(jasmineChar, [{ name: 'sanctuary' }], null, [], 1);
    assert(Math.round(jasmineBuffed.matk) === 162, 'buff_apply', `matk=${Math.round(jasmineBuffed.matk)}`);

    const luna = GameUtils.getCardById('luna');
    const lunaInit = Logic.calculateInitialStats(luna, ['luna', 'jasmine', 'rumi'], GameUtils.getAllCards(), 0);
    const lunaChar = { proto: luna, ...lunaInit.stats, buffs: { weak: 1, darkness: 1, corrosion: 1 } };
    const lunaDebuffed = Logic.calculateStats(lunaChar, [], null, [], 1);
    assert(
      Math.round(lunaDebuffed.atk) === 104 && Math.round(lunaDebuffed.def) === 36,
      'debuff_apply',
      `atk=${Math.round(lunaDebuffed.atk)}, def=${Math.round(lunaDebuffed.def)}`
    );

    RPG.global.specialMission.missions.toeic3.progress = 0;
    RPG.saveGlobalData();
    RPG.registerToeicPracticeAttempt();
    RPG.registerToeicPracticeAttempt();
    RPG.registerToeicPracticeAttempt();
    assert(
      RPG.global.specialMission.missions.toeic3.progress === 3,
      'special_mission_toeic_progress',
      `toeic=${RPG.global.specialMission.missions.toeic3.progress}`
    );

    RPG.state.gameType = 'challenge';
    const beforeChallenge = RPG.global.specialMission.missions.challenge3.progress;
    RPG.finishWinBattle('', true, null);
    assert(
      RPG.global.specialMission.missions.challenge3.progress === beforeChallenge + 1,
      'challenge_clear_progress',
      `challenge=${RPG.global.specialMission.missions.challenge3.progress}`
    );

    const rewardId = RPG.global.specialMission.rewardCardId;
    RPG.global.specialMission.missions.challenge3.progress = 3;
    RPG.global.specialMission.missions.toeic3.progress = 3;
    RPG.global.specialMission.missions.boss.progress = 1;
    RPG.claimSpecialMissionReward();
    assert(
      RPG.global.unlocked_special_cards.includes(rewardId),
      'special_reward_claim',
      rewardId
    );

    RPG.openTypeSelect();
    const specialEditorDisplay = window.getComputedStyle(document.getElementById('btn-special-card-editor')).display;
    assert(specialEditorDisplay !== 'none', 'special_editor_button', `display=${specialEditorDisplay}`);

    const rewardCard = GameUtils.getCardById(rewardId);
    RPG.activateSpecialCardVersion(rewardCard.specialBaseId, rewardId);
    RPG.initNewGame('origin');
    const runPool = GameUtils.buildCardPool(RPG.global, {
      activeBonusPoolIds: RPG.state.activeBonusPoolIds,
      specialCardSelections: RPG.state.activeSpecialCardSelections
    });
    assert(
      runPool.some(card => card.id === rewardId) &&
      !runPool.some(card => card.id === rewardCard.specialBaseId),
      'special_card_replacement',
      `${rewardId} replaces ${rewardCard.specialBaseId}`
    );

    return output;
  });

  await browser.close();

  results.forEach(item => {
    console.log(`${item.result} ${item.name}: ${item.detail}`);
  });
}

run().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
