// Cuts the generated 2x2 icon sheets (transparent PNG, art/icons/*-sheet.png) into square native pixel icons.
// Usage: node card_pixel/game/tools/cut-icons.mjs card_pixel/art/icons/sheets.tsv card_pixel/art/icons card_pixel/game/assets/icons 32
// sheets.tsv: <sheet name>	<four icon ids, comma separated>	<prompt>. A sheet file is <dir>/<sheet name>-sheet.png.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const [tsv, dir, out, sizeArg] = process.argv.slice(2); const SIZE = Number(sizeArg || 32);
fs.mkdirSync(out, { recursive: true });
for (const line of fs.readFileSync(tsv, 'utf8').split(/\r?\n/).filter(Boolean)) {
  const [sheet, names] = line.split('\t'); const ids = names.split(',');
  const img = sharp(path.join(dir, sheet + '-sheet.png'));
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const half = [Math.floor(info.width / 2), Math.floor(info.height / 2)];
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * half[0], oy = Math.floor(q / 2) * half[1];
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = oy; y < oy + half[1]; y++) for (let x = ox; x < ox + half[0]; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.max(w, h), pad = Math.round(side * 0.06), box = side + pad * 2;
    const left = Math.max(0, x0 - Math.floor((box - w) / 2)), top = Math.max(0, y0 - Math.floor((box - h) / 2));
    const crop = await sharp(path.join(dir, sheet + '-sheet.png')).extract({ left, top, width: Math.min(box, info.width - left), height: Math.min(box, info.height - top) }).toBuffer();
    const small = await sharp(crop).resize(SIZE, SIZE, { kernel: 'nearest', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = small.data; for (let i = 3; i < px.length; i += 4) px[i] = px[i] >= 128 ? 255 : 0;   // hard pixel edges
    await sharp(px, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toFile(path.join(out, ids[q] + '.png'));
  }
  console.log(sheet, ids.join(' '));
}
