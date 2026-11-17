// Archives the generated strips at their real pixel-art resolution for git.
// The image tool draws on a grid of about 3x3 screen pixels per art pixel (measured in
// plan/pixel-pilot/r4b/report.md), so each 3x3 cell is replaced by its most common colour.
// The full-size originals stay on disk in art/strips/ and are not committed (see .gitignore).
// Run: node card_pixel/art/tools/shrink-strips.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'strips'), out = path.join(here, '..', 'strips-1x');
const CELL = 3;
fs.mkdirSync(out, { recursive: true });
let n = 0, before = 0, after = 0;
for (const file of fs.readdirSync(src).filter(f => /-strip\.png$/.test(f))) {
  const { data, info } = await sharp(path.join(src, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = Math.floor(info.width / CELL), h = Math.floor(info.height / CELL), dst = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const votes = new Map();
    for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) {
      const i = ((y * CELL + dy) * info.width + (x * CELL + dx)) * 4;
      const key = data.readUInt32BE(i);
      votes.set(key, (votes.get(key) || 0) + 1);
    }
    let best = 0, bestN = -1;
    for (const [k, v] of votes) if (v > bestN) { best = k; bestN = v; }
    dst.writeUInt32BE(best >>> 0, (y * w + x) * 4);
  }
  const target = path.join(out, file);
  await sharp(dst, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9, palette: false }).toFile(target);
  before += fs.statSync(path.join(src, file)).size; after += fs.statSync(target).size; n++;
}
console.log(`${n} strips: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB in art/strips-1x/`);
