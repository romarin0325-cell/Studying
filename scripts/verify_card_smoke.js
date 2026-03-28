const fs = require('fs');
const path = require('path');

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
    'initNewGame(mode =',
    'startToeicPractice()',
    'finishToeicSession()',
    'openToeicReview()',
    'id="btn-bonus-pool-editor"',
    'id="modal-bonus-pool-editor"',
    'id="bonus-pool-preset-list"',
    'pendingActiveBonusPoolIds:',
    'activeBonusPoolIds: this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds)',
    'openBonusPoolEditor()',
    'bonusPoolPresets:',
    'activeBonusPoolPresetIndex:',
    'buildChaosRoulettePool()',
    'buildChaosPoolCardIds(pool)',
    'drawRunPoolCards(pool, count, options = {})'
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

  console.log('Card smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
