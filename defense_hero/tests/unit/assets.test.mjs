import test from 'node:test';
import assert from 'node:assert/strict';

import { AssetManager } from '../../js/render/AssetManager.js';
import { ASSET_MANIFEST } from '../../js/data/assets.js';
import { BattleRenderer } from '../../js/render/BattleRenderer.js';

const MANIFEST = Object.freeze([
  { id: 'portrait/rumi', type: 'image', path: '/assets/rumi.webp', preloadGroup: 'menu', pivotX: 0.5 },
  { id: 'battle/rumi', type: 'image', path: '/assets/rumi.webp', preloadGroup: ['battle', 'menu'] },
  { id: 'enemy/missing', type: 'image', path: '/assets/missing.webp', preloadGroup: 'battle' },
  { id: 'enemy/missing-alias', type: 'image', path: '/assets/missing.webp', preloadGroup: 'later' },
  { id: 'sfx/hit', type: 'audio', path: '/assets/hit.ogg', preloadGroup: 'battle' },
  { id: 'sfx/missing', type: 'audio', path: '/assets/missing.ogg', preloadGroup: 'battle' },
]);

function createHarness() {
  const calls = { image: [], audio: [] };
  const warnings = [];
  const image = { kind: 'image', src: '/assets/rumi.webp' };
  const audio = { kind: 'audio', src: '/assets/hit.ogg' };
  const manager = new AssetManager({
    manifest: MANIFEST,
    imageLoader: async (path) => {
      calls.image.push(path);
      if (path.includes('missing')) throw new Error(`missing ${path}`);
      return image;
    },
    audioLoader: async (path) => {
      calls.audio.push(path);
      if (path.includes('missing')) throw new Error(`missing ${path}`);
      return audio;
    },
    logger: { warn(...args) { warnings.push(args); } },
  });
  return { manager, calls, warnings, image, audio };
}

test('AssetManager preloads groups and serves cached image/audio resources synchronously', async () => {
  const { manager, calls, image, audio } = createHarness();

  assert.equal(manager.has('portrait/rumi'), false);
  assert.equal(manager.getImage('portrait/rumi'), null);
  assert.equal(manager.getAudio('portrait/rumi'), null);
  assert.equal(manager.getEntry('portrait/rumi').pivotX, 0.5);

  const menu = await manager.preload('menu');
  assert.deepEqual(menu.loaded, ['portrait/rumi']);
  assert.deepEqual(menu.cached, ['battle/rumi']);
  assert.deepEqual(menu.failed, []);
  assert.equal(calls.image.length, 1, 'aliases sharing one URL must share one in-flight request');
  assert.strictEqual(manager.getImage('portrait/rumi'), image);
  assert.strictEqual(manager.getImage('battle/rumi'), image);
  assert.equal(manager.has('battle/rumi'), true);

  const battle = await manager.preload('battle');
  assert.deepEqual(battle.loaded, ['sfx/hit']);
  assert.deepEqual(battle.cached, ['battle/rumi']);
  assert.deepEqual(battle.failed.sort(), ['enemy/missing', 'sfx/missing']);
  assert.strictEqual(manager.getAudio('sfx/hit'), audio);
  assert.equal(manager.getImage('enemy/missing'), null);
  assert.equal(manager.getAudio('sfx/missing'), null);
});

test('AssetManager caches failed URLs for the session and never rejects preload', async () => {
  const { manager, calls, warnings } = createHarness();

  let first;
  await assert.doesNotReject(async () => { first = await manager.preload(['enemy/missing', 'sfx/missing']); });
  assert.deepEqual(first.failed, ['enemy/missing', 'sfx/missing']);
  assert.deepEqual(calls.image, ['/assets/missing.webp']);
  assert.deepEqual(calls.audio, ['/assets/missing.ogg']);
  assert.equal(warnings.length, 2);

  let second;
  await assert.doesNotReject(async () => { second = await manager.preload(['enemy/missing', 'enemy/missing-alias', 'sfx/missing']); });
  assert.deepEqual(second.failed, ['enemy/missing', 'enemy/missing-alias', 'sfx/missing']);
  assert.deepEqual(calls.image, ['/assets/missing.webp'], 'a failed image URL must not be requested again');
  assert.deepEqual(calls.audio, ['/assets/missing.ogg'], 'a failed audio URL must not be requested again');
  assert.equal(warnings.length, 2, 'cached failures must not emit duplicate warnings');
});

test('AssetManager deduplicates concurrent success loads and reports unknown selections', async () => {
  let resolveImage;
  let calls = 0;
  const resource = { kind: 'deferred-image' };
  const manager = new AssetManager(MANIFEST, {
    imageLoader: () => {
      calls += 1;
      return new Promise((resolve) => { resolveImage = resolve; });
    },
    audioLoader: async () => ({ kind: 'audio' }),
    logger: { warn() {} },
  });

  const first = manager.preload('portrait/rumi');
  const second = manager.preload('battle/rumi');
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveImage(resource);
  await Promise.all([first, second]);
  assert.strictEqual(manager.getImage('portrait/rumi'), resource);
  assert.strictEqual(manager.getImage('battle/rumi'), resource);

  const unknown = await manager.preload(['not/in/manifest']);
  assert.deepEqual(unknown, {
    loaded: [],
    failed: [],
    cached: [],
    missing: ['not/in/manifest'],
  });
});

test('AssetManager remains usable in Node when browser media globals are absent', async () => {
  const manager = new AssetManager([
    { id: 'image', type: 'image', path: '/image.png' },
    { id: 'audio', type: 'audio', path: '/audio.ogg' },
  ], { logger: { warn() {} } });

  let result;
  await assert.doesNotReject(async () => { result = await manager.preload(); });
  assert.deepEqual(result.failed, ['image', 'audio']);
  assert.equal(manager.getImage('image'), null);
  assert.equal(manager.getAudio('audio'), null);
  assert.equal(manager.has('image'), false);
});

test('AssetManager rejects invalid manifests as programming errors', () => {
  assert.throws(() => new AssetManager([{ id: 'x', type: 'video', path: '/x.webm' }]), /Unsupported asset type/);
  assert.throws(() => new AssetManager([
    { id: 'same', type: 'image', path: '/a.png' },
    { id: 'same', type: 'image', path: '/b.png' },
  ]), /Duplicate asset id/);
});

test('roster manifest declares 31 optional image fallbacks with paths and pivots', async () => {
  assert.equal(ASSET_MANIFEST.length, 31);
  assert.equal(new Set(ASSET_MANIFEST.map(({ id }) => id)).size, 31);
  for (const entry of ASSET_MANIFEST) {
    assert.equal(entry.type, 'image');
    assert.ok(entry.path.startsWith('./assets/'));
    assert.ok(Number.isFinite(entry.pivotX));
    assert.ok(Number.isFinite(entry.pivotY));
    assert.equal(entry.optional, true);
    assert.equal(entry.fallbackAllowed, true);
  }

  const manager = new AssetManager(ASSET_MANIFEST, {
    imageLoader: async (path) => { throw new Error(`not shipped: ${path}`); },
    logger: { warn() {} },
  });
  let summary;
  await assert.doesNotReject(async () => { summary = await manager.preload(); });
  assert.equal(summary.failed.length, 31);
  assert.equal(manager.getImage('battle/rumi'), null);
});

test('BattleRenderer draws a loaded manifest image and keeps token fallback support', () => {
  let drawCalls = 0;
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    drawImage: () => { drawCalls += 1; },
    measureText: () => ({ width: 10 }),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    clientWidth: 844,
    clientHeight: 390,
    getBoundingClientRect: () => ({ width: 844, height: 390 }),
    getContext: () => context,
  };
  const assets = {
    getImage: (id) => id === 'battle/rumi' ? { width: 64, height: 64 } : null,
    getEntry: () => ({ pivotX: 0.5, pivotY: 0.88 }),
  };
  const renderer = new BattleRenderer(canvas, { assets });
  renderer.render({
    phase: 'preparation',
    paused: false,
    time: 0,
    allies: [{ id: 'ally_rumi', characterId: 'rumi', name: '루미', kind: 'leader', x: 1, y: 3, element: 'water', statuses: {} }],
    enemies: [], projectiles: [], areaEffects: [], barricades: [], events: [], core: { hp: 100, maxHp: 100, shield: 0 },
  }, {
    cols: 13, rows: 8, core: { col: 10, row: 3 }, paths: [], obstacles: [], specialTiles: [], leaderNodes: [],
  });
  assert.ok(drawCalls > 0);
});
