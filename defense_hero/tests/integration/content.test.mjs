import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  ASSET_MANIFEST,
  BOSS_DEFINITIONS,
  CHARACTER_DEFINITIONS,
  COMPANION_DEFINITIONS,
  DIFFICULTY_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  ELEMENT_DEFINITIONS,
  ELITE_PREFIX_DEFINITIONS,
  ENEMY_TYPE_DEFINITIONS,
  FIELD_BUFF_DEFINITIONS,
  FIXED_CHALLENGE_DEFINITIONS,
  HERO_DEFENSE_CONTENT,
  LEADER_DEFINITIONS,
  MAP_LAYOUT_DEFINITIONS,
  MUTATOR_DEFINITIONS,
  RELIC_DEFINITIONS,
  SPECIAL_TILE_DEFINITIONS,
  STAGE_DEFINITIONS,
  STARTING_BLESSING_DEFINITIONS,
  STATUS_DEFINITIONS,
  WAVE_PACKAGE_DEFINITIONS,
  validateContent,
} from '../../js/data/content.js';

const JS_ROOT = fileURLToPath(new URL('../../js/', import.meta.url));

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return listJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  }));
  return nested.flat().sort();
}

test('content validates and exposes the complete prototype roster', () => {
  const result = validateContent();

  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.counts, {
    elements: 5,
    leaders: 4,
    companions: 6,
    enemies: 9,
    elitePrefixes: 4,
    bosses: 2,
    statuses: 9,
    doctrines: 8,
    relics: 12,
    mutators: 8,
    startingBlessings: 3,
    fixedChallenges: 3,
    maps: 4,
    specialTiles: 3,
    wavePackages: 12,
    stages: 6,
    assets: 31,
  });

  assert.equal(ELEMENT_DEFINITIONS.length, 5);
  assert.equal(CHARACTER_DEFINITIONS.length, 10);
  assert.equal(LEADER_DEFINITIONS.length, 4);
  assert.equal(COMPANION_DEFINITIONS.length, 6);
  assert.equal(ENEMY_TYPE_DEFINITIONS.length, 9);
  assert.equal(ELITE_PREFIX_DEFINITIONS.length, 4);
  assert.equal(BOSS_DEFINITIONS.length, 2);
  assert.equal(STATUS_DEFINITIONS.length, 9);
  assert.equal(FIELD_BUFF_DEFINITIONS.length, 5);
  assert.equal(DIFFICULTY_DEFINITIONS.length, 3);
  assert.equal(DOCTRINE_DEFINITIONS.length, 8);
  assert.equal(RELIC_DEFINITIONS.length, 12);
  assert.equal(MUTATOR_DEFINITIONS.length, 8);
  assert.equal(STARTING_BLESSING_DEFINITIONS.length, 3);
  assert.equal(FIXED_CHALLENGE_DEFINITIONS.length, 3);
  assert.equal(MAP_LAYOUT_DEFINITIONS.length, 4);
  assert.equal(SPECIAL_TILE_DEFINITIONS.length, 3);
  assert.equal(WAVE_PACKAGE_DEFINITIONS.length, 12);
  assert.equal(STAGE_DEFINITIONS.length, 6);
  assert.equal(ASSET_MANIFEST.length, 31);

  assert.strictEqual(HERO_DEFENSE_CONTENT.characters, CHARACTER_DEFINITIONS);
  assert.strictEqual(HERO_DEFENSE_CONTENT.wavePackages, WAVE_PACKAGE_DEFINITIONS);
  assert.strictEqual(HERO_DEFENSE_CONTENT.stages, STAGE_DEFINITIONS);
  assert.strictEqual(HERO_DEFENSE_CONTENT.assets, ASSET_MANIFEST);
  assert.doesNotThrow(() => validateContent({ throwOnError: true }));
});

test('content validation rejects logical asset IDs missing from the manifest', () => {
  const manifestWithWrongId = ASSET_MANIFEST.map((entry) => (
    entry.id === 'portrait/rumi'
      ? { ...entry, id: 'portrait/not-rumi' }
      : entry
  ));

  const result = validateContent({ assetManifest: manifestWithWrongId });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((message) => message.includes('rumi.assetIds.portrait') && message.includes('portrait/rumi')),
    result.errors.join('\n'),
  );
  assert.throws(
    () => validateContent({ throwOnError: true, assetManifest: manifestWithWrongId }),
    /rumi\.assetIds\.portrait/,
  );
});

test('runtime JavaScript never calls Math.random directly', async () => {
  const files = await listJavaScriptFiles(JS_ROOT);
  assert.ok(files.length > 0, 'defense_hero/js 아래에 검사할 JavaScript 파일이 없습니다.');

  const violations = [];
  await Promise.all(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/\bMath\s*\.\s*random\s*\(/.test(line)) {
        violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }));

  assert.deepEqual(
    violations.sort(),
    [],
    `모든 무작위는 SeededRng를 사용해야 합니다.\n${violations.join('\n')}`,
  );
});
