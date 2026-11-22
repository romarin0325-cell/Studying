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
