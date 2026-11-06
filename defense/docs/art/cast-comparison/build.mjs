import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { HEROES, ASSET_PATHS, TRANSFORM_ART } from '../../../src/content.js';
import { BOARD, cellPoint } from '../../../src/combat/engine.js';
import { VISUAL_HEROES } from '../../../scripts/image-policy.mjs';
import { imageHash, loadImagePack } from '../../../scripts/image-pack.mjs';
import { assetFile, gameRoot } from '../../../scripts/local-inputs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(gameRoot, 'test-results/cast-comparison/index.html'));
const pack = await loadImagePack();
const visual = new Map(VISUAL_HEROES.map(h => [h.id, h]));
const roster = [...HEROES, ...Object.entries(TRANSFORM_ART)
  .filter(([id]) => !HEROES.some(h => h.id === id))
  .map(([id, art]) => ({ id, name: visual.get(id)?.name ?? '트라우마 변신', rarity: 'form', art }))];
const atlases = {};
const atlasRecords = new Map(pack.manifest.images.map(entry => [entry.id, entry]));
const portraits = new Set(pack.manifest.derived.filter(row => row.id.startsWith('portrait:')).map(row => row.id));

async function frameHeights(bytes, art) {
  const { width, height } = await sharp(bytes).metadata();
  const size = width / art.columns;
  assert.ok(Number.isInteger(size), art.atlas);
  const heights = [];
  for (let index = 0; index < 4; index++) {
    const left = (art.directional ? index % art.columns : 0) * size;
    const top = (art.directional ? Math.floor(index / art.columns) : art.row) * size;
    assert.ok(top + size <= height, art.atlas);
    const pixels = await sharp(bytes).extract({ left, top, width: size, height: size })
      .ensureAlpha().raw().toBuffer();
    let first = size, last = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (pixels[(y * size + x) * 4 + 3] < 40) continue;
        first = Math.min(first, y);
        last = y;
        break;
      }
    }
    assert.ok(last >= first, art.atlas + ' has an empty direction');
    heights.push(Math.round((last - first + 1) * 512 / size));
  }
  return heights;
}

const units = [];
for (const { id, name, rarity, art } of roster) {
  const source = ASSET_PATHS[art.atlas];
  const record = atlasRecords.get('atlas:' + art.atlas);
  assert.ok(record?.output, art.atlas);
  const battle = pack.read(source);
  const { width, height } = record.output.metadata;
  atlases[art.atlas] ??= { bytes: battle.toString('base64'), rows: height / (width / art.columns),
    sha256: record.output.sha256 };
  const portrait = portraits.has('portrait:' + id) ? pack.readDerived('portrait:' + id) : null;
  units.push({ id, name, rarity, atlas: art.atlas, columns: art.columns, row: art.row,
    directional: art.directional, foot: art.foot, scale: art.scale,
    heights: await frameHeights(await fs.readFile(assetFile(source)), art),
    portrait: portrait?.toString('base64') ?? null, portraitSha256: portrait && imageHash(portrait) });
}

const dimension = 5;
const padding = { x: 26, y: 47, bottom: 15 };
const board = { dimension, pitch: BOARD.cell,
  width: dimension * BOARD.cell + padding.x * 2,
  height: dimension * BOARD.cell + padding.y + padding.bottom,
  frame: 126, footOffset: 31,
  cells: Array.from({ length: dimension ** 2 }, (_, i) => {
    const point = cellPoint(i);
    return [point.x - BOARD.x + padding.x, point.y - BOARD.y + padding.y];
  })
};
const assetHash = imageHash(Buffer.from(JSON.stringify(units.map(({ id, atlas, portraitSha256 }) => [
  id, atlases[atlas].sha256, portraitSha256
]))));
const data = { units, atlases, board, collectibleCount: HEROES.length, assetHash };
const template = await fs.readFile(path.join(here, 'template.html'), 'utf8');
const html = template.replace('/*__CAST_DATA__*/', () => JSON.stringify(data).replaceAll('<', '\\u003c'));
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, html);
console.log(JSON.stringify({ file: out, bytes: Buffer.byteLength(html), companions: HEROES.length,
  forms: units.length - HEROES.length, assetHash }));
