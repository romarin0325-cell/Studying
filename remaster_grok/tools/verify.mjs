import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'dist', 'AzureArchive.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function must(snippets) {
  for (const snippet of snippets) {
    assert(html.includes(snippet), `missing: ${snippet}`);
  }
}

must([
  '창공 서고',
  'AZURE ARCHIVE',
  'id="screen-title"',
  'id="screen-menu"',
  'id="screen-battle"',
  'id="btn-start-new"',
  'id="btn-start-load"',
  'id="btn-game-fullscreen"',
  'id="next-enemy-img"',
  'id="battle-controls"',
  'id="hub-party-strip"',
  'AzurePortraits',
  'AzureShell',
  'window._scriptLoadComplete = true',
  '--kick: #2ec4ff',
  'STARLIGHT ARCANE LIBRARY'
]);

assert(!html.includes('<script src="data.js">'), 'game scripts should be inlined');
assert(!html.includes('href="theme.css"'), 'theme should be inlined');
assert(!/\uB8E8\uBBF8\.png;base64/.test(html) && !html.includes('루미.png;base64'), 'portraits must stay external');
assert(html.includes('../../card/') || html.includes('AzurePortraits'), 'portrait resolver present');

for (const name of ['sky-title.png', 'sky-hub.png', 'sky-battle.png', 'panel-frame.png']) {
  const file = path.join(root, 'assets', name);
  const buf = fs.readFileSync(file);
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${name} is not png`);
}

const syntax = ['src/portraits.js', 'src/sky.js', 'src/shell.js', 'tools/build.mjs', 'tools/compose.mjs', 'tools/serve.mjs'];
for (const file of syntax) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || file);
}

const theme = fs.readFileSync(path.join(root, 'src', 'theme.css'), 'utf8');
assert(theme.includes('#screen-title') && theme.includes('overflow-y: auto'), 'title must scroll on short screens');
assert(theme.includes('.skill-btn.phy') && theme.includes('.card-item.legend') && theme.includes('.battle-actor.dead'));
assert(html.includes('getCurrentStageEnemyData') || fs.readFileSync(path.join(root, 'src', 'shell.js'), 'utf8').includes('getCurrentStageEnemyData'));
assert(fs.readFileSync(path.join(root, 'src', 'shell.js'), 'utf8').includes('after(rpg)'));
assert(fs.readFileSync(path.join(root, 'tools', 'serve.mjs'), 'utf8').includes("listen(4177, '127.0.0.1'"));

assert(html.includes('id="modal-library"') && html.includes('id="modal-toeic-practice"'));
assert(html.includes('RPGFeatureModules.install') || html.includes('hydrateModules'));

const tests = spawnSync(process.execPath, [path.join(root, 'tests', 'runtime.test.mjs')], { encoding: 'utf8' });
assert.equal(tests.status, 0, tests.stderr || tests.stdout);
console.log('Azure Archive verification passed.');
