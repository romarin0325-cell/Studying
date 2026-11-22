import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { AFFIXES } from '../src/content/affixes.js';
import { makeBossLesson } from '../src/content/boss-lessons.js';
import { BOSSES } from '../src/content/bosses.js';
import { CONTRACTS } from '../src/content/contracts.js';
import * as daily from '../src/content/daily-rift.js';
import { DUNGEONS } from '../src/content/dungeons.js';
import { EVENTS } from '../src/content/events.js';
import { LAYOUTS, ROOM_NAMES } from '../src/content/layouts.js';
import { MISSIONS } from '../src/content/missions.js';
import { NOTEBOOK } from '../src/content/notebook.js';
import { QUIRKS } from '../src/content/quirks.js';
import { REGIONS } from '../src/content/regions.js';
import { RELICS } from '../src/content/relics.js';
import { RULEBOOK } from '../src/content/rulebook.js';
import * as tempo from '../src/content/tempo.js';
import { WILD } from '../src/content/wild.js';
import { createCategories, renderPage } from '../../plan/build-changes-review.mjs';

const root = new URL('../../../', import.meta.url);
const size = record => Object.keys(record).length;
const floors = Object.values(LAYOUTS).reduce((total, layout) => total + layout.length, 0);
const lessons = Object.keys(BOSSES).flatMap(id => [2, 6].filter(floor => makeBossLesson(id, floor, 0))).length;
const groupSize = group => RULEBOOK.filter(rule => rule.group === group).length;

function scaleCount(table) {
  return Object.values(table).reduce((count, value) => count + (Array.isArray(value) ? 1 : size(value)), 0);
}

const tempoScales = [
  tempo.ROOM_MULTIPLIERS, tempo.REGION_MULTIPLIERS, tempo.NIGHTMARE_MULTIPLIERS,
  tempo.LESSON_NIGHTMARE_MULTIPLIERS, tempo.FIRST_MAIN_ASSIST, tempo.INTRO_MULTIPLIERS
];
// The entry HP multiplier appears in the first-main battle rule.
const tempoFields = Object.entries(tempo).filter(([key, value]) => key !== 'ENTRY_FIRST_MAIN_ENEMY_HP' && typeof value !== 'function').length;
const tempoRows = tempoFields - tempoScales.length - 2 + tempoScales.reduce((count, table) => count + scaleCount(table), 0)
  + size(tempo.BLESSING_MULTIPLIERS) + size(tempo.TEMPO_SEEDS);

test('rulebook entries have all fields, unique IDs and existing implementation files', () => {
  const ids = new Set();
  const groups = ['전투 규칙 추가', '깨우기·제단', '영입·시작 동료·샘 초대·출현 제외', '결정·보상', '저장'];
  for (const entry of RULEBOOK) {
    assert.deepEqual(Object.keys(entry).sort(), ['group', 'id', 'name', 'rule', 'since', 'where']);
    assert.ok(Object.values(entry).every(value => typeof value === 'string' && value.trim()), entry.id);
    assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(groups.includes(entry.group), entry.group);
    assert.match(entry.rule, /\d/, entry.id);
    assert.ok(!ids.has(entry.id), entry.id);
    ids.add(entry.id);
    const [file, fn] = entry.where.split(':');
    assert.ok(fn && existsSync(new URL(file, root)), entry.where);
  }
  assert.ok(groups.every(group => groupSize(group) > 0));
});

const categories = createCategories();
const html = renderPage(categories, { generatedAt: '2026-11-21T00:00:00.000Z', commit: 'test-commit' });

test('generated page has one entry for every source item and unique review keys', () => {
  const counts = {
    battle: groupSize('전투 규칙 추가'),
    quirks: size(QUIRKS), affixes: size(AFFIXES), regions: size(REGIONS), events: EVENTS.length,
    relics: size(RELICS), bosses: size(BOSSES), lessons, wild: size(WILD), dungeons: size(DUNGEONS),
    floors, 'room-names': size(ROOM_NAMES), intro: LAYOUTS.intro.length,
    contracts: size(CONTRACTS), notebook: NOTEBOOK.length, missions: size(MISSIONS), daily: size(daily),
    tempo: tempoRows, awakenings: groupSize('깨우기·제단'), recruitment: groupSize('영입·시작 동료·샘 초대·출현 제외'),
    economy: groupSize('결정·보상'), save: groupSize('저장')
  };
  const sections = [...html.matchAll(/<section id="([^"]+)" data-total="(\d+)">([\s\S]*?)<\/section>/g)];
  const ids = new Set();
  assert.deepEqual(categories.map(section => section.id), Object.keys(counts));
  assert.equal(sections.length, size(counts));
  for (const [, category, total, markup] of sections) {
    const items = [...markup.matchAll(/data-item="([^"]+)"/g)].map(match => match[1]);
    assert.equal(items.length, counts[category], category);
    assert.equal(Number(total), items.length, category);
    assert.match(html, new RegExp(`href="#${category}"[^>]*>[^<]*<strong>${total}</strong>`));
    for (const id of items) {
      assert.ok(id.startsWith(category + '/') && !ids.has(id), id);
      ids.add(id);
    }
  }
  const perSource = { quirks: QUIRKS, affixes: AFFIXES, regions: REGIONS, relics: RELICS, bosses: BOSSES, wild: WILD, dungeons: DUNGEONS, contracts: CONTRACTS, missions: MISSIONS };
  for (const [category, entries] of Object.entries(perSource)) {
    for (const id of Object.keys(entries)) assert.ok(ids.has(`${category}/${id}`));
  }
  for (const { id } of EVENTS) assert.ok(ids.has('events/' + id), id);
  for (const { rows } of categories) {
    for (const row of rows) {
      assert.ok(row.name && row.where && row.effect && row.sources.length, row.id);
      assert.ok(['새로 생김', '원본 값을 바꿈', '원본 그대로를 다른 곳에서 씀'].includes(row.relation), row.id);
      for (const source of row.sources) assert.ok(existsSync(new URL(source.split(':')[0], root)), source);
    }
  }
  assert.ok(html.includes(`총 ${ids.size}개`));
});

test('review content resolves replay variants and uses an offline script with no external assets', () => {
  const row = (category, id) => categories.find(section => section.id === category).rows.find(item => item.id === category + '/' + id);
  assert.match(row('regions', 'ember_carry').effect, /다음 적.*작열을 최대 2스택/);
  assert.ok(row('events', 'sun_moon_whetstone').details.some(line => /결정 2개.*태양의축복.*달의축복/.test(line)));
  assert.ok(row('events', 'venom_five_knots').details.some(line => /예행 v1 · 5층.*결정 1개/.test(line)));
  assert.ok(row('events', 'mimic_paybox').details.some(line => /예행 v1.*결정 \+1.*첫 출전.*결정 \+1/.test(line)));
  assert.match(row('relics', 'over_flame').effect, /최대 스택 5/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.doesNotMatch(html, /<(?:script|img)[^>]*\bsrc=|<link\b|@import\b/i);
  const script = html.match(/<script>([\s\S]+?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
});

test('the review covers entry unlocks, the current HP multiplier, repeat draws and recruitment', () => {
  const effect = (category, id) => categories.find(section => section.id === category).rows
    .find(item => item.id === category + '/' + id).effect;
  const entry = effect('battle', 'first-main-assist');
  assert.ok(entry.includes(`기존 HP 배율에 ×${tempo.ENTRY_FIRST_MAIN_ENEMY_HP}`));
  assert.match(entry, /꿈결.*유료 거래.*5층부터 무료 즉시 선택/);
  assert.match(effect('recruitment', 'companions'), /입문을 클리어하면.*첫 본편 클리어로.*오늘의 균열/);
  assert.match(effect('battle', 'roster-limit'), /강화됩니다.*기억.*가장 먼저 합류.*10%/);
  assert.match(effect('recruitment', 'recruit-after-clear'), /미영입.*대기하거나 물러난.*인연 \+1/);
});
