import assert from 'node:assert/strict';
import test from 'node:test';

import { AssetManager } from '../../js/render/AssetManager.js';
import {
  drawResolvedSprite,
  SpriteResolver,
  spriteAssetId,
} from '../../js/render/SpriteResolver.js';
import { DIRECTION } from '../../js/core/enums.js';
import { spriteDestination } from '../../js/render/BattleRenderer.js';

const MANIFEST = Object.freeze([
  { id: 'battle/rumi/front', type: 'image', path: '/rumi-front.webp', preloadGroup: 'battle', pivotX: 0.5 },
  { id: 'battle/rumi/left', type: 'image', path: '/rumi-left.webp', preloadGroup: 'battle' },
  { id: 'battle/rumi/right', type: 'image', path: '/missing.webp', preloadGroup: 'battle' },
  { id: 'battle/rumi/right-alias', type: 'image', path: '/missing.webp', preloadGroup: 'later' },
  { id: 'portrait/rumi', type: 'img', path: '/rumi-portrait.webp', preloadGroup: 'menu' },
  { id: 'boss/flora/front', type: 'image', path: '/flora-front.webp', preloadGroup: 'battle' },
  { id: 'boss/flora/back', type: 'image', path: '/missing-boss.webp', preloadGroup: 'battle' },
  { id: 'sfx/hit', type: 'sfx', path: '/hit.ogg', preloadGroup: 'battle' },
]);

function createHarness() {
  const imageCalls = [];
  const audioCalls = [];
  const warnings = [];
  const images = new Map([
    ['/rumi-front.webp', { kind: 'front', naturalWidth: 128, naturalHeight: 128 }],
    ['/rumi-left.webp', { kind: 'left', naturalWidth: 128, naturalHeight: 128 }],
    ['/rumi-portrait.webp', { kind: 'portrait', naturalWidth: 128, naturalHeight: 128 }],
    ['/flora-front.webp', { kind: 'flora', naturalWidth: 256, naturalHeight: 256 }],
  ]);
  const audio = { kind: 'audio' };
  const manager = new AssetManager({
    manifest: MANIFEST,
    imageLoader: async (assetPath) => {
      imageCalls.push(assetPath);
      if (!images.has(assetPath)) throw new Error(`missing ${assetPath}`);
      return images.get(assetPath);
    },
    audioLoader: async (assetPath) => {
      audioCalls.push(assetPath);
      return audio;
    },
    logger: { warn: (...args) => warnings.push(args) },
  });
  return { manager, imageCalls, audioCalls, warnings, images, audio };
}

test('AssetManager preloads groups and serves typed resources synchronously', async () => {
  const { manager, imageCalls, audioCalls, images, audio } = createHarness();
  assert.equal(manager.getImage('battle/rumi/front'), null);
  assert.equal(manager.getAudio('battle/rumi/front'), null);
  assert.equal(manager.getEntry('portrait/rumi').type, 'image');
  assert.ok(Object.isFrozen(manager.getEntry('portrait/rumi')));

  const menu = await manager.preload('menu');
  assert.deepEqual(menu, {
    loaded: ['portrait/rumi'],
    failed: [],
    cached: [],
    missing: [],
  });
  assert.strictEqual(manager.getImage('portrait/rumi'), images.get('/rumi-portrait.webp'));

  const battle = await manager.preload(['battle/rumi/front', 'battle/rumi/left', 'sfx/hit']);
  assert.deepEqual(battle.loaded, ['battle/rumi/front', 'battle/rumi/left', 'sfx/hit']);
  assert.deepEqual(battle.failed, []);
  assert.strictEqual(manager.getImage('battle/rumi/front'), images.get('/rumi-front.webp'));
  assert.strictEqual(manager.getAudio('sfx/hit'), audio);
  assert.deepEqual(imageCalls.sort(), ['/rumi-front.webp', '/rumi-left.webp', '/rumi-portrait.webp'].sort());
  assert.deepEqual(audioCalls, ['/hit.ogg']);

  const cached = await manager.preload(['battle/rumi/front', 'battle/rumi/front', 'unknown']);
  assert.deepEqual(cached.cached, ['battle/rumi/front']);
  assert.deepEqual(cached.missing, ['unknown']);
});

test('AssetManager shares in-flight paths and caches failed URLs across aliases', async () => {
  let resolveImage;
  let calls = 0;
  const shared = { naturalWidth: 64, naturalHeight: 64 };
  const pendingManager = new AssetManager([
    { id: 'first', type: 'image', path: '/shared.webp' },
    { id: 'second', type: 'image', path: '/shared.webp' },
  ], {
    imageLoader: () => {
      calls += 1;
      return new Promise((resolve) => { resolveImage = resolve; });
    },
    audioLoader: async () => ({}),
    logger: { warn() {} },
  });
  const first = pendingManager.preload('first');
  const second = pendingManager.preload('second');
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveImage(shared);
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.deepEqual(firstResult.loaded, ['first']);
  assert.deepEqual(secondResult.cached, ['second']);
  assert.strictEqual(pendingManager.getImage('first'), shared);
  assert.strictEqual(pendingManager.getImage('second'), shared);

  const { manager, imageCalls, warnings } = createHarness();
  const failed = await manager.preload(['battle/rumi/right', 'battle/rumi/right-alias']);
  assert.deepEqual(failed.failed, ['battle/rumi/right', 'battle/rumi/right-alias']);
  assert.deepEqual(imageCalls, ['/missing.webp']);
  assert.equal(warnings.length, 1);
  const repeated = await manager.preload(['battle/rumi/right', 'battle/rumi/right-alias']);
  assert.deepEqual(repeated.failed, ['battle/rumi/right', 'battle/rumi/right-alias']);
  assert.deepEqual(imageCalls, ['/missing.webp']);
  assert.equal(warnings.length, 1);
});

test('AssetManager contains optional browser-media failures and rejects malformed manifests', async () => {
  const manager = new AssetManager([
    { id: 'image', type: 'image', path: '/image.webp' },
    { id: 'audio', type: 'audio', path: '/audio.ogg' },
  ], { logger: { warn() {} } });
  const summary = await manager.preload();
  assert.deepEqual(summary.failed, ['image', 'audio']);
  assert.equal(manager.has('image'), false);

  assert.throws(() => new AssetManager(null), /array or object/);
  assert.throws(() => new AssetManager([{ id: '', type: 'image', path: '/x' }]), /non-empty id/);
  assert.throws(() => new AssetManager([{ id: 'x', type: 'video', path: '/x' }]), /Unsupported asset type/);
  assert.throws(() => new AssetManager([{ id: 'x', type: 'image', path: '' }]), /non-empty path/);
  assert.throws(() => new AssetManager([
    { id: 'same', type: 'image', path: '/a' },
    { id: 'same', type: 'image', path: '/b' },
  ]), /Duplicate asset id/);
});

test('SpriteResolver chooses directional art, then front art, then the renderer token fallback', async () => {
  const { manager, images } = createHarness();
  await manager.preload(['battle/rumi/front', 'battle/rumi/left', 'battle/rumi/right', 'boss/flora/front', 'boss/flora/back', 'portrait/rumi']);
  const resolver = new SpriteResolver(manager);

  const left = resolver.resolve({ kind: 'hero', id: 'rumi', direction: DIRECTION.LEFT });
  assert.equal(left.id, 'battle/rumi/left');
  assert.strictEqual(left.image, images.get('/rumi-left.webp'));

  const rightFallback = resolver.resolve({ kind: 'hero', id: 'rumi', direction: DIRECTION.RIGHT });
  assert.equal(rightFallback.id, 'battle/rumi/front');
  assert.strictEqual(rightFallback.image, images.get('/rumi-front.webp'));

  const bossFallback = resolver.resolve({ kind: 'boss', id: 'flora', direction: DIRECTION.BACK });
  assert.equal(bossFallback.id, 'boss/flora/front');
  assert.strictEqual(bossFallback.image, images.get('/flora-front.webp'));

  assert.equal(resolver.resolve({ kind: 'hero', id: 'unknown', direction: DIRECTION.FRONT }), null);
  const portrait = resolver.resolvePortrait('rumi');
  assert.equal(portrait.id, 'portrait/rumi');
  assert.strictEqual(portrait.image, images.get('/rumi-portrait.webp'));
  assert.equal(resolver.resolvePortrait('unknown'), null);

  assert.equal(spriteAssetId('hero', 'rumi', DIRECTION.BACK), 'battle/rumi/back');
  assert.equal(spriteAssetId('boss', 'flora', DIRECTION.LEFT), 'boss/flora/left');
  assert.equal(spriteAssetId('hero', 'rumi', 'diagonal'), 'battle/rumi/front');
});

test('drawResolvedSprite applies normalized source frames and refuses unusable images', () => {
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  const image = { naturalWidth: 200, naturalHeight: 100 };
  const destination = { x: 10, y: 20, width: 30, height: 40 };
  assert.equal(drawResolvedSprite(context, {
    image,
    frame: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
  }, destination), true);
  assert.deepEqual(calls[0], [image, 20, 20, 100, 40, 10, 20, 30, 40]);

  assert.equal(drawResolvedSprite(context, { image, frame: null }, destination), true);
  assert.deepEqual(calls[1], [image, 10, 20, 30, 40]);
  assert.equal(drawResolvedSprite(context, null, destination), false);
  assert.equal(drawResolvedSprite(context, { image: { width: 0, height: 0 } }, destination), false);
  assert.equal(calls.length, 2);
});

test('battle sprite destination anchors the manifest pivot on the logical entity point', () => {
  assert.deepEqual(
    spriteDestination({ x: 100, y: 200 }, 80, { pivotX: 0.5, pivotY: 0.88 }),
    { x: 60, y: 129.6, width: 80, height: 80 },
  );
  assert.deepEqual(
    spriteDestination({ x: 100, y: 200 }, 80),
    { x: 60, y: 140, width: 80, height: 80 },
  );
});
