import test from 'node:test';
import assert from 'node:assert/strict';
import { josa, keepSeparators } from '../src/ui/text.js';

test('josa chooses particles for Hangul endings, rieul and numbers', () => {
  for (const [word, pair, expected] of [
    ['애쉬', '과/와', '애쉬와'],
    ['골렘', '과/와', '골렘과'],
    ['눈토끼', '이/가', '눈토끼가'],
    ['아마겟돈', '을/를', '아마겟돈을'],
    ['눈토끼', '을/를', '눈토끼를'],
    ['골렘', '은/는', '골렘은'],
    ['애쉬', '은/는', '애쉬는'],
    ['홍련 화산', '으로/로', '홍련 화산으로'],
    ['달', '으로/로', '달로'],
    ['눈토끼', '으로/로', '눈토끼로'],
    [40, '이야/야', '40이야'],
    [42, '이야/야', '42야'],
    [41, '으로/로', '41로']
  ]) assert.equal(josa(word, pair), expected);
});

test('keepSeparators keeps the word before each " · " with the dot and leaves the text unchanged', () => {
  const html = keepSeparators('황혼 성당 8층 · 결과 확인');
  assert.equal(html, '황혼 성당 <span class="nobr">8층 ·</span> 결과 확인');
  assert.equal(html.replace(/<[^>]+>/g, ''), '황혼 성당 8층 · 결과 확인');
  assert.equal(keepSeparators('홍련 화산 · 꿈결 · 바로 출발'),
    '홍련 <span class="nobr">화산 ·</span> <span class="nobr">꿈결 ·</span> 바로 출발');
  assert.equal(keepSeparators('눈토끼와 홍련 화산으로'), '눈토끼와 홍련 화산으로');
});

// Workspace rule D4: a player-facing wording that the glossary owns is imported, never typed again in a screen.
// The 11-22 audit found "다음 동료가 공격 대상" written beside TERMS.retreat.detail; this catches verbatim copies.
test('screens use glossary wording instead of retyping it', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const glossary = await import('../src/ui/glossary.js');
  const phrases = new Set();
  (function collect(value) {
    if (typeof value === 'string') { if (value.replace(/\s/g, '').length >= 6) phrases.add(value); }
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  })([glossary.TERMS, glossary.RESUME, glossary.EPISODE, glossary.RIFT_PUZZLE]);
  const root = new URL('../src/ui/', import.meta.url);
  const files = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.js') && path.basename(file) !== 'glossary.js');
  const copies = [];
  for (const file of files) {
    // Comments may quote a wording to explain why it is not shown; only code counts.
    const source = fs.readFileSync(new URL(file.split(path.sep).join('/'), root), 'utf8').replace(/\/\/.*$/gm, '');
    for (const phrase of phrases) if (source.includes(phrase)) copies.push(`${file}: "${phrase}"`);
  }
  assert.deepEqual(copies, [], 'Import these from ui/glossary.js');
});
