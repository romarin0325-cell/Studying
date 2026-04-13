const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mustContain(filePath, snippets) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      throw new Error(`${filePath} is missing expected snippet: ${snippet}`);
    }
  }
}

function run() {
  const cardRoot = path.join(process.cwd(), 'card');

  mustContain(path.join(cardRoot, 'index.html'), [
    'id="modal-toeic-practice"',
    'id="toeic-review-hub"',
    'window._scriptRuntimeErrors = [];',
    '<script src="rpg_config.js" charset="utf-8"',
    '<script src="rpg_flow_modules.js" charset="utf-8"',
    'RPGConfig.BOOT_MODULES',
    "window._scriptLoadErrors.push('rpg_flow_modules.js')",
    "el.charset = 'utf-8';",
    '_featuresInstalled: false',
    'hydrateModules() {',
    'RPGFeatureModules.install(this);',
    'RPGFlowModules.install(this);',
    'startToeicPractice()',
    'finishToeicSession()',
    'openToeicReview()',
    'id="btn-bonus-pool-editor"',
    'id="btn-special-card-editor"',
    'id="modal-bonus-pool-editor"',
    'id="modal-mission-hub"',
    'id="special-mission-section"',
    'id="modal-special-card-editor"',
    'id="btn-title-mission"',
    'id="bonus-pool-preset-list"',
    'pendingActiveBonusPoolIds:',
    'activeSpecialCardSelections:',
    'openMissionHub()',
    'openSpecialMission()',
    'openSpecialCardEditor()',
    'openBonusPoolEditor()',
    'bonusPoolPresets:',
    'activeBonusPoolPresetIndex:',
    'getBootModules() {',
    'createMissionProgressItem({'
  ]);

  mustContain(path.join(cardRoot, 'rpg_config.js'), [
    'window.RPGConfig =',
    'MODE_META',
    'FIELD_BUFF_INFO',
    'TOEIC_TYPE_LABELS',
    'BOOT_MODULES',
    "src: 'rpg_features.js'"
  ]);

  mustContain(path.join(cardRoot, 'rpg_flow_modules.js'), [
    'window.RPGFlowModules = {',
    'startTutoringQuiz()',
    'runGacha(isChallenge)',
    'finishWinBattle(deadMsg, gameClear, quizResult)',
    'startToeicPractice(options = {})',
    'checkToeicAnswer(btn, selected, correct)',
    'finishToeicSession()',
    'async startDate()'
  ]);

  mustContain(path.join(cardRoot, 'rpg_features.js'), [
    'window.RPGFeatureModules = {',
    'initNewGame(mode =',
    'buildChaosRoulettePool()',
    'buildChaosPoolCardIds(pool)',
    'drawRunPoolCards(pool, count, options = {})',
    'startGame(mode, retryCount = 0)',
    'claimMonthlyMissionReward()',
    'claimSpecialMissionReward()',
    'tryUnlockSpecialMissionFromDreamCorridor(stageNumber)',
    'getCurrentSpecialSeason(date = new Date())',
    'activeBonusPoolIds: this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds)'
  ]);

  mustContain(path.join(cardRoot, 'logic.js'), [
    'const Storage',
    'activeBonusPoolIds',
    'MAX_BONUS_POOL_PRESETS',
    'getSpecialCards()',
    'buildTranscendencePool(globalData, options = {})',
    'drawWeightedCards(pool, count, weightFn = () => 1, options = {})',
    'dmg_boost_turn_limit',
    "'valentine': { def: 0.5, mdef: 0.5 }",
    'death_multi_debuff_custom'
  ]);
  mustContain(path.join(cardRoot, 'data.js'), [
    'const CARDS',
    'const SPECIAL_CARDS = SPECIAL_CARD_VARIANTS.map',
    "id: 'flora_valentine'",
    "id: 'thor_swimsuit'",
    "id: 'ares_halloween'",
    "id: 'astea_christmas'",
    'const BONUS_TRANSCENDENCE_CARDS = [',
    "id: 'trans_thor'",
    "id: 'trans_ares'",
    "id: 'trans_poseidon'",
    "bonusTranscendenceReward: 'trans_thor'",
    "bonusTranscendenceReward: 'trans_ares'",
    "bonusTranscendenceReward: 'trans_poseidon'",
    "type: 'syn_water_light_heart_star'",
    "type: 'syn_water_light_midnight_twinkle'",
    "'temptation': '유혹'",
    "'valentine': '발렌타인'"
  ]);
  mustContain(path.join(cardRoot, 'battle_runtime.js'), [
    "syn_water_light_heart_star",
    "skill.name === '하트오버드라이브'",
    "syn_water_light_midnight_twinkle",
    "skill.name === '미드나잇판타지'"
  ]);
  mustContain(path.join(cardRoot, 'toeic.js'), ['const TOEIC_DATA']);

  const htmlPath = path.join(cardRoot, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const inlineScripts = [...html.matchAll(/<script(?:\s+defer)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  if (inlineScripts.length < 2) {
    throw new Error(`${htmlPath} does not contain the expected inline script blocks.`);
  }
  inlineScripts.forEach((script, index) => {
    new vm.Script(script, { filename: `${htmlPath}#script${index + 1}` });
  });

  for (const scriptPath of ['rpg_config.js', 'rpg_flow_modules.js']) {
    const absolutePath = path.join(cardRoot, scriptPath);
    new vm.Script(fs.readFileSync(absolutePath, 'utf8'), { filename: absolutePath });
  }

  console.log('Card smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
