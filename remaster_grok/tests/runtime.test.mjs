import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { locate } from '../tools/serve.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function runBrowser(code) {
  const context = { window: {}, location: { search: '' } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

function testPortraits() {
  const code = fs.readFileSync(path.join(root, 'src', 'portraits.js'), 'utf8');
  const { AzurePortraits } = runBrowser(code);
  const img = {};
  assert.equal(AzurePortraits.resolve('A.png', img), 'A.png');
  while (AzurePortraits.noteFailure(img, 'A.png')) { /* exhaust */ }
  assert.equal(AzurePortraits.resolve('B.png', img).endsWith('B.png'), true);
  assert.equal(AzurePortraits.resolve('B.png', img), 'B.png');
}

function testHubThis() {
  const code = fs.readFileSync(path.join(root, 'src', 'shell.js'), 'utf8');
  const document = {
    body: { dataset: {} },
    getElementById(id) {
      return this.nodes[id] || null;
    },
    querySelector() { return { id: 'screen-menu' }; },
    nodes: {
      'hub-mode-name': { textContent: '오리진' },
      'hub-run-meta': { textContent: '일반 · Stage 1' },
      'hub-stage-text': { textContent: 'Stage 1' },
      app: { dataset: {} },
      'hub-party-slot-0': { name: { textContent: '비어 있음' }, querySelector() { return this.name; }, classList: { toggle() {} } },
      'hub-party-slot-1': { name: { textContent: '비어 있음' }, querySelector() { return this.name; }, classList: { toggle() {} } },
      'hub-party-slot-2': { name: { textContent: '비어 있음' }, querySelector() { return this.name; }, classList: { toggle() {} } },
      'next-enemy-img': { style: {}, parentElement: { style: {} } }
    }
  };
  document.nodes['hub-party-img-0'] = null;
  document.nodes['hub-party-img-1'] = null;
  document.nodes['hub-party-img-2'] = null;
  const context = {
    window: {},
    document,
    ImageAssets: { load() {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context);
  const rpg = {
    state: { mode: 'draft', gameType: 'endless', enemyScale: 8, deck: ['rumi', null, null] },
    getCardData: id => id === 'rumi' ? { name: '루미' } : null,
    getCurrentStageEnemyData: () => ({ name: '슬라임' }),
    showScreen() {},
    toMenu() {},
    confirmDeck() {}
  };
  context.AzureShell.install(rpg, null);
  rpg.confirmDeck();
  assert.equal(document.nodes['hub-mode-name'].textContent, '드래프트');
  assert.equal(document.nodes['hub-run-meta'].textContent, '엔드리스 · Stage 9');
  assert.equal(document.nodes['hub-party-slot-0'].name.textContent, '루미');
  assert.equal(document.nodes['next-enemy-img'].style.display, '');
}

function testServe() {
  assert.equal(locate('/theme.css') && locate('/theme.css').endsWith('theme.css'), true);
  assert.equal(locate('/../../package.json'), null);
  assert.equal(locate('/%2e%2e/%2e%2e/package.json'), null);
}

testPortraits();
testHubThis();
testServe();
console.log('Azure Archive runtime tests passed.');
