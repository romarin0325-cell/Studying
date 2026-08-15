import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ATTACK_ARCHETYPES,
  COMBAT_RULES,
  DIFFICULTIES,
  LEVEL_DAMAGE_MULTIPLIERS,
  MATCHUP_TABLE,
  WAVE_REWARDS,
} from '../../js/content/combat.js';
import {
  AURA_BUFF_BY_ID,
  BUFFS,
} from '../../js/content/buffs.js';
import {
  STATUSES,
  STATUS_BY_ID,
} from '../../js/content/statuses.js';
import {
  EFFECT_PRESETS,
  EFFECT_PRESET_BY_ID,
} from '../../js/content/effects.js';
import {
  DEFAULT_FORMATION,
  HEROES,
  HERO_BY_ID,
  MAIN_HEROES,
  NORMAL_HEROES,
} from '../../js/content/heroes.js';
import {
  ENEMIES,
  ENEMY_BY_ID,
} from '../../js/content/enemies.js';
import {
  STAGES,
  STAGE_BY_ID,
} from '../../js/content/stages.js';
import { ASSET_MANIFEST } from '../../js/content/assets.js';
import {
  ContentValidationError,
  validateContent,
} from '../../js/content/validateContent.js';
import { createBattleState } from '../../js/battle/BattleState.js';
import {
  startWave,
  updateWaveSpawning,
} from '../../js/battle/systems/WaveSystem.js';

const HERO_IDS = HEROES.map(({ id }) => id);

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

async function jsFilesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await jsFilesBelow(path));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

test('strict content validation covers every required V2 definition and optional launch asset', () => {
  const withoutAssets = validateContent({ throwOnError: true });
  assert.equal(withoutAssets.valid, true);
  assert.deepEqual(withoutAssets.counts, {
    heroes: 10,
    mainHeroes: 4,
    normalHeroes: 6,
    level4Traits: 20,
    level6Traits: 20,
    enemies: 14,
    normalEnemies: 10,
    bosses: 4,
    stages: 2,
    waves: 20,
    buffs: 7,
    statuses: 7,
    debuffs: 6,
    effectPresets: 9,
    assets: null,
  });

  const assets = ASSET_MANIFEST;
  assert.equal(assets.length, 66);
  const withAssets = validateContent({ assets, throwOnError: true });
  assert.equal(withAssets.counts.assets, 66);

  const missingDirection = validateContent({ assets: assets.slice(0, -1) });
  assert.equal(missingDirection.valid, false);
  assert.ok(missingDirection.errors.some((error) => error.includes('missing required logical id')));
  assert.throws(
    () => validateContent({ assets: assets.slice(0, -1), throwOnError: true }),
    ContentValidationError,
  );
});

test('public content collections, lookup tables and aliases are deeply immutable and coherent', () => {
  const collections = [
    COMBAT_RULES,
    ATTACK_ARCHETYPES,
    MATCHUP_TABLE,
    LEVEL_DAMAGE_MULTIPLIERS,
    WAVE_REWARDS,
    DIFFICULTIES,
    BUFFS,
    AURA_BUFF_BY_ID,
    STATUSES,
    STATUS_BY_ID,
    EFFECT_PRESETS,
    EFFECT_PRESET_BY_ID,
    HEROES,
    HERO_BY_ID,
    MAIN_HEROES,
    NORMAL_HEROES,
    ENEMIES,
    ENEMY_BY_ID,
    STAGES,
    STAGE_BY_ID,
  ];
  collections.forEach((collection) => assertDeepFrozen(collection));

  for (const hero of HEROES) assert.strictEqual(HERO_BY_ID[hero.id], hero);
  for (const enemy of ENEMIES) assert.strictEqual(ENEMY_BY_ID[enemy.id], enemy);
  for (const stage of STAGES) assert.strictEqual(STAGE_BY_ID[stage.id], stage);
  for (const buff of BUFFS) assert.strictEqual(AURA_BUFF_BY_ID[buff.id], buff);
  for (const status of STATUSES) assert.strictEqual(STATUS_BY_ID[status.id], status);
  for (const preset of EFFECT_PRESETS) assert.strictEqual(EFFECT_PRESET_BY_ID[preset.id], preset);
});

test('content creates finite deterministic wave state for both fixed stages', () => {
  for (const stage of STAGES) {
    const state = createBattleState({
      stageId: stage.id,
      difficultyId: 'easy',
      formation: {
        mainId: DEFAULT_FORMATION.mainId,
        heroIds: [...DEFAULT_FORMATION.heroIds],
      },
      seed: `architecture:${stage.id}`,
    });
    state.heroes.forEach((hero, index) => {
      hero.placed = true;
      hero.x = index + 1;
      hero.y = 2;
    });
    assert.equal(startWave(state), true);
    updateWaveSpawning(state, 1);
    const firstEnemy = [...state.enemies.values()][0];
    assert.ok(firstEnemy);
    assert.ok(Number.isFinite(firstEnemy.hp));
    assert.ok(firstEnemy.hp > 0);
    assert.equal(firstEnemy.x, stage.map.spawn.x + 0.5);
    assert.equal(firstEnemy.y, stage.map.spawn.y + 0.5);
  }
});

test('battle code contains no character-id dispatch and content keeps dependency direction inward', async () => {
  const battleRoot = fileURLToPath(new URL('../../js/battle', import.meta.url)).replaceAll('\\', '/');
  const battleFiles = await jsFilesBelow(battleRoot);
  assert.ok(battleFiles.length > 0);
  for (const path of battleFiles) {
    const source = await readFile(path, 'utf8');
    for (const heroId of HERO_IDS) {
      assert.equal(
        new RegExp(`['\"]${heroId}['\"]`).test(source),
        false,
        `${path} must not dispatch on character id '${heroId}'`,
      );
    }
  }

  const contentRoot = fileURLToPath(new URL('../../js/content', import.meta.url)).replaceAll('\\', '/');
  for (const path of await jsFilesBelow(contentRoot)) {
    const source = await readFile(path, 'utf8');
    const imports = [...source.matchAll(/from\s+['\"]([^'\"]+)['\"]/g)].map((match) => match[1]);
    assert.ok(
      imports.every((specifier) => specifier.startsWith('./')),
      `${path} may only depend on sibling content modules`,
    );
    assert.doesNotMatch(source, /(?:^|\/)assets\.js['\"]/m);
  }
});
