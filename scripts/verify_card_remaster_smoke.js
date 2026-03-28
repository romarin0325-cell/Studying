const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mustContain(content, snippets, filePath) {
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      throw new Error(`${filePath} is missing expected snippet: ${snippet}`);
    }
  }
}

function run() {
  const remasterRoot = path.join(process.cwd(), 'card_remaster');
  const htmlPath = path.join(remasterRoot, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  mustContain(
    html,
    [
      'class="app-backdrop"',
      'id="header-mode-pill"',
      'id="menu-mode-chip"',
      'id="battle-mode-chip"',
      'id="p-hp-text"',
      'id="e-hp-text"',
      'const RemasterUI = {',
      'buildCardTileHtml(data, options = {})',
      'syncRemasterUi()',
      'RemasterUI.bindImages(modal);',
      'RemasterUI.spawnBurst(content, color);',
      "document.addEventListener('DOMContentLoaded', () => {",
      'RemasterUI.init(RPG);'
    ],
    htmlPath
  );

  ['battle_runtime.js', 'toeic.js', 'toeic_explanations.js'].forEach((fileName) => {
    const filePath = path.join(remasterRoot, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing synced remaster file: ${filePath}`);
    }
  });

  const inlineScripts = [...html.matchAll(/<script(?:\s+defer)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  if (inlineScripts.length < 2) {
    throw new Error(`${htmlPath} does not contain the expected inline script blocks.`);
  }

  inlineScripts.forEach((script, index) => {
    new vm.Script(script, { filename: `${htmlPath}#script${index + 1}` });
  });

  console.log('Card remaster smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
