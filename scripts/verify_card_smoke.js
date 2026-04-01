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
    "{ src: 'rpg_features.js'",
    '_featuresInstalled: false',
    'hydrateModules() {',
    'RPGFeatureModules.install(this);',
    'startToeicPractice()',
    'finishToeicSession()',
    'openToeicReview()',
    'id="btn-bonus-pool-editor"',
    'id="modal-bonus-pool-editor"',
    'id="bonus-pool-preset-list"',
    'pendingActiveBonusPoolIds:',
    'openBonusPoolEditor()',
    'bonusPoolPresets:',
    'activeBonusPoolPresetIndex:',
    "name: 'RPGFeatureModules'"
  ]);

  mustContain(path.join(cardRoot, 'rpg_features.js'), [
    'window.RPGFeatureModules = {',
    'initNewGame(mode =',
    'buildChaosRoulettePool()',
    'buildChaosPoolCardIds(pool)',
    'drawRunPoolCards(pool, count, options = {})',
    'startGame(mode, retryCount = 0)',
    'claimMonthlyMissionReward()',
    'activeBonusPoolIds: this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds)'
  ]);

  mustContain(path.join(cardRoot, 'logic.js'), [
    'const Storage',
    'activeBonusPoolIds',
    'MAX_BONUS_POOL_PRESETS',
    'buildTranscendencePool(globalData, options = {})',
    'drawWeightedCards(pool, count, weightFn = () => 1, options = {})',
    'dmg_boost_turn_limit'
  ]);
  mustContain(path.join(cardRoot, 'data.js'), [
    'const CARDS',
    'const BONUS_TRANSCENDENCE_CARDS = [',
    "id: 'trans_thor'",
    "id: 'trans_ares'",
    "id: 'trans_poseidon'",
    "bonusTranscendenceReward: 'trans_thor'",
    "bonusTranscendenceReward: 'trans_ares'",
    "bonusTranscendenceReward: 'trans_poseidon'"
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

  console.log('Card smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
