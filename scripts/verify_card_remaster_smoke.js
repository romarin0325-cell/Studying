const assert = require('assert');
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
  return content;
}

function assertPng(filePath, width, height, maxBytes) {
  const data = fs.readFileSync(filePath);
  assert.deepStrictEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.strictEqual(data.readUInt32BE(16), width, `${filePath} width`);
  assert.strictEqual(data.readUInt32BE(20), height, `${filePath} height`);
  assert(data.length <= maxBytes, `${filePath} exceeds its size budget`);
}

function run() {
  const remasterRoot = path.join(process.cwd(), 'card_remaster');
  const htmlPath = path.join(remasterRoot, 'index.html');
  const html = mustContain(htmlPath, [
    'id="screen-title"',
    'id="screen-menu"',
    'id="screen-battle"',
    'id="next-enemy-img"',
    'id="battle-controls"',
    'id="battle-fx-layer"',
    'id="battle-announcer"',
    '<link rel="stylesheet" href="ui_theme.css">',
    "{ src: 'ui_runtime.js', label: 'UI 런타임' }",
    "titleBackground: 'ui_title_bg.png'",
    "hubBackground: 'ui_hub_bg.png'",
    "battleBackground: 'ui_battle_bg.png'",
    "panelFrame: 'ui_panel_9slice.png'",
    'applyUIAssets(UI_ASSETS);',
    'RPGFeatureModules.install(this);',
    'CardUI.install(this);'
  ]);

  [
    'api.js',
    'battle_runtime.js',
    'data.js',
    'fortune_cookie.js',
    'logic.js',
    'rpg_features.js',
    'toeic.js',
    'toeic_explanations.js',
    'ui_runtime.js',
    'ui_theme.css'
  ].forEach(fileName => {
    assert(fs.existsSync(path.join(remasterRoot, fileName)), `Missing remaster file: ${fileName}`);
  });

  mustContain(path.join(remasterRoot, 'ui_theme.css'), [
    '--ui-title-bg: none;',
    '--ui-hub-bg: none;',
    '--ui-battle-bg: none;',
    '--ui-panel-frame: none;',
    'border-image-source: var(--ui-panel-frame);'
  ]);
  mustContain(path.join(remasterRoot, 'ui_runtime.js'), [
    'const CardUI = {',
    'renderHub(rpg)',
    'renderBattleState(rpg)',
    'renderControls(rpg, player)',
    'celebrate(kind)',
    'window.CardUI = CardUI;'
  ]);

  assertPng(path.join(remasterRoot, 'ui_title_bg.png'), 720, 1280, 900 * 1024);
  assertPng(path.join(remasterRoot, 'ui_hub_bg.png'), 720, 1280, 700 * 1024);
  assertPng(path.join(remasterRoot, 'ui_battle_bg.png'), 720, 1280, 700 * 1024);
  assertPng(path.join(remasterRoot, 'ui_panel_9slice.png'), 192, 192, 150 * 1024);

  const inlineScripts = [...html.matchAll(/<script(?:\s+defer)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]);
  assert(inlineScripts.length >= 2, `${htmlPath} does not contain the expected inline scripts`);
  inlineScripts.forEach((script, index) => {
    new vm.Script(script, { filename: `${htmlPath}#script${index + 1}` });
  });

  console.log('Card remaster smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
