import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { WILD } from '../src/content/wild.js';
import { createWidgets } from '../src/ui/widgets.js';
import { createCoreRoster } from './support/core.mjs';

const originals = new URL('../../art/pixel-v2/', import.meta.url);
const assets = new URL('../assets/', import.meta.url);
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sprites = readJson(new URL('sprites.json', assets));
const { characters } = readJson(new URL('manifest.json', originals));
const legacy = readJson(new URL('../../art/manifest.json', import.meta.url));
const effect = 'ash-fx.png';
const poses = ['idle', 'attack', 'hurt'];
const spriteFile = (id, pose) => id + '-' + pose + '.png';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const image = (dir, file) => sharp(fileURLToPath(new URL(file, dir)));

test('all playable allies, wild enemies, and bosses have three sprite poses', () => {
  const { roster } = createCoreRoster();
  const byKind = kind => characters.filter(entry => entry.kind === kind).map(entry => entry.id).sort();
  const allyIds = roster.pool('common');
  const wildIds = Object.keys(WILD).map(id => roster.wildOf(id).sprite);
  const bossIds = roster.bosses.map(id => roster.bossOf(id).sprite);

  assert.equal(allyIds.length, 130);
  assert.equal(wildIds.length, 9);
  assert.equal(bossIds.length, 11);
  assert.deepEqual([...allyIds].sort(), byKind('ally'));
  assert.deepEqual(wildIds.sort(), byKind('wild'));
  assert.deepEqual(bossIds.sort(), byKind('boss'));
  for (const { id, frames } of characters) {
    assert.deepEqual(Object.keys(frames), poses, id);
    for (const pose of poses) {
      const file = spriteFile(id, pose);
      assert.ok(Object.hasOwn(sprites, file), file);
      assert.ok(fs.existsSync(new URL(file, assets)), file);
      assert.ok(fs.existsSync(new URL(id + '/' + pose + '.png', originals)), file);
    }
  }
});

test('sprite keys follow both manifests in their original order and retain the Ash effect', () => {
  const keys = Object.keys(sprites);
  const oldKeys = legacy.filter(entry => entry.status === 'ok').flatMap(({ id }) =>
    id === 'ash' ? ['ash-idle.png', effect, 'ash-attack.png', 'ash-hurt.png'] :
      poses.map(pose => spriteFile(id, pose)));
  assert.deepEqual(keys, oldKeys);
  assert.deepEqual(keys.filter(key => key !== effect),
    characters.flatMap(({ id }) => poses.map(pose => spriteFile(id, pose))));
  assert.deepEqual(sprites[effect], { width: 20, height: 21, bodyCenterX: 9.5, feetBaselineY: 20, effect: true });
  assert.equal(hash(new URL(effect, assets)), '6738e1baea3aab8dd2a8604847d0b7b7b949011c1eb485b6a01687f5847d9042');
});

test('PNG dimensions, registration, and idle face boxes match the sprite metadata', async () => {
  for (const { id, frames } of characters) {
    const canvasBaselines = new Set();
    const canvasCenters = [];
    for (const pose of poses) {
      const file = spriteFile(id, pose);
      const data = sprites[file];
      const png = await image(assets, file).metadata();
      const { alphaBounds: crop, bodyCenterX, feetBaselineY } = frames[pose];
      assert.deepEqual([png.width, png.height], [data.width, data.height], file);
      assert.deepEqual([data.width, data.height], [crop.width, crop.height], file);
      assert.ok(Number.isInteger(data.bodyCenterX) && data.bodyCenterX >= 0 && data.bodyCenterX < data.width, file);
      assert.ok(Number.isInteger(data.feetBaselineY) && data.feetBaselineY >= 0, file);
      assert.equal(data.bodyCenterX, Math.round(bodyCenterX - crop.x), file);
      assert.equal(data.feetBaselineY, Math.round(feetBaselineY) - crop.y, file);
      canvasBaselines.add(data.feetBaselineY + crop.y);
      canvasCenters.push(data.bodyCenterX + crop.x);
      if (pose !== 'idle') {
        assert.equal(data.face, undefined, file);
        continue;
      }
      const { x, y, size, source } = data.face;
      assert.ok([x, y, size].every(Number.isInteger), file);
      assert.ok(x >= 0 && x < data.width && y >= 0 && size > 0 && y + size <= data.height, file);
      assert.ok(['marks', 'estimated'].includes(source), file);
    }
    assert.equal(canvasBaselines.size, 1, id + ' shares one canvas footline');
    assert.ok(Math.max(...canvasCenters) - Math.min(...canvasCenters) <= 1, id + ' shares a canvas center within one pixel');
  }
});

// SHA-256 values from the review bundle's repairs-20261121/manifest.json, in pose order.
const repairHashes = {
  light_elemental: [
    '7576676e2a29da50ee5acdf5ee3627e80d8d0ffa31868885bbd2408fb360a567',
    'b55ce8c49ce8c688740016faf5bf6644fb4671cad26ca6a9b28e039972110898',
    '0ed40b5b915ed8b482b96eab032074ec30311a336715dcc78f9359eaabd2ea15'
  ],
  sugar_powder: [
    'd495fceb2a8a600db490bb0869b8b6adaed8e375bd45a2faef80c08c0a5cc3bd',
    '606408cb126dc1fbfa082ce6bbcc725a70368970a18a33465a55b3ef6e6c6c76',
    '9e14cb50b7ae28157cd830aae934141b4e6f9faa3ed2bef5d47aefe16f8858a1'
  ],
  grand_merchant: [
    '868d0d6535e673df75b082de5eda77662fd17d6e5b1a43441b96164ff0b2886a',
    'f00755688f3526dcad956144a11528e525ace8a3f6e0f3763546dfa6ac3a06cc',
    '48dcd34a5fdc1d8df047522ff5de5f412e00cbdff96dcb98fb5b51d4a5c228de'
  ],
  legendary_captain: [
    'e5be2c5ebe6ce053c9e1f26e6079b3fb8d9471018bfae831fa37b3cc2fe3eca9',
    '8df3a0c60cb9f5d7752b7e72d79638b8319f32259d9a0990d6e15dacc337143d',
    '0daaf74d070458df898ba25628042c2e9e91d9a9e80dab662e84c1b7c0df5b99'
  ],
  gold_dragon: [
    '94bf3947c1b41e10ceaad7a63f9152dd1062ff6c464f9da30750777e2f020d92',
    'a025444b007f672e9699629315ce4d89aab17e4fe3823430038660d884e8f094',
    '1089aff9a5aef1be71a78ffc3b44ac697f3c69bdf7a693aabf1e5ea9ae638bfe'
  ],
  dainichi_nyorai: [
    'da731f68ad560fd5d74a53e259f46e33bf9730825213e321ef0bcdd7178bc306',
    'f5bb6cc4f203528876a089b1abfabf0e76dd35284f6755cf2e7281add6c62b62',
    '191bda7702211248d5aaa0bbe7312078f98a800b6e0ca37e414c1fea82ae7c5a'
  ]
};

test('the six revised characters use all 18 published repair frames', () => {
  for (const [id, hashes] of Object.entries(repairHashes)) {
    const { frames, marksSource } = characters.find(entry => entry.id === id);
    const revision = 'repairs-20261121/' + id + '/';
    assert.equal(marksSource, revision + 'marks-final.json');
    for (const [index, pose] of poses.entries()) {
      const file = id + '/' + pose + '.png';
      assert.equal(frames[pose].source, revision + 'pixel/' + pose + '.png');
      assert.equal(frames[pose].sha256, hashes[index], file);
      assert.equal(hash(new URL(file, originals)), hashes[index], file);
    }
  }
});

test('selected sprite crops preserve the original RGBA values', async () => {
  const samples = [
    ['ash', 'attack'], ['silver_rabbit', 'idle'], ['golem', 'hurt'],
    ['artificial_demon_god', 'attack'], ['dainichi_nyorai', 'idle']
  ];
  for (const [id, pose] of samples) {
    const file = spriteFile(id, pose);
    const { frames } = characters.find(entry => entry.id === id);
    const { width: originalWidth, alphaBounds: { x, y, width, height } } = frames[pose];
    const original = await image(originals, id + '/' + pose + '.png').ensureAlpha().raw().toBuffer();
    const actual = await image(assets, file).ensureAlpha().raw().toBuffer();
    const expected = Buffer.alloc(width * height * 4);
    for (let row = 0; row < height; row++) {
      const start = ((y + row) * originalWidth + x) * 4;
      original.copy(expected, row * width * 4, start, start + width * 4);
    }
    assert.ok(actual.equals(expected), file);
  }
});

test('face widgets use the measured offsets at native size and retain the legacy fallback', () => {
  const sprite = { src: 'test.png', w: 55, h: 73, cx: 39 };
  const { face } = createWidgets({ sp: {
    'ash-idle': { ...sprite, face: { x: 31, y: 8, size: 30, source: 'marks' } },
    'legacy-idle': sprite
  } });
  assert.match(face('ash', 40), /width="55" height="73".*margin-left:calc\(50% - 31px\);margin-top:-8px/);
  assert.match(face('legacy', 40), /margin-left:-19px;margin-top:-2px/);
});
