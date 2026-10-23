import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Authoring only. Key a reserved hue, never white luminance: pale hair and
// costumes are opaque. Edge alpha removes magenta contamination, not detail.
export function keySpritePixels(data, width, height) {
  const info = { width, height };
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const excess = Math.min(r, b) - g;
    if (excess > 85 && r > g * 2 + 20 && b > g * 2 + 20 && Math.abs(r - b) < 80) {
      data[i + 3] = 0;
    } else if (excess > 85 && Math.abs(r - b) < 65 && g < 125) {
      const alpha = Math.max(0, Math.min(1, (145 - excess) / 60));
      data[i + 3] = Math.round(alpha * data[i + 3]);
      // Edge colors use neighboring paint instead of retaining keyed pink.
      const neighbors = [i - 4, i + 4, i - info.width * 4, i + info.width * 4]
        .filter(j => j >= 0 && j < data.length && Math.min(data[j], data[j + 2]) - data[j + 1] < 70);
      if (neighbors.length) for (let c = 0; c < 3; c++) data[i + c] = Math.round(neighbors.reduce((sum, j) => sum + data[j + c], 0) / neighbors.length);
    }
  }
  const painted = Buffer.from(data);
  for (let y = 2; y < info.height - 2; y++) for (let x = 2; x < info.width - 2; x++) {
    const i = (y * info.width + x) * 4;
    if (!painted[i + 3] || Math.min(painted[i], painted[i + 2]) - painted[i + 1] < 15) continue;
    const neighbors = [];
    let touchesKey = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const j = ((y + dy) * info.width + x + dx) * 4;
      if (!painted[j + 3]) touchesKey = true;
      else if (painted[j + 3] === 255 && Math.min(painted[j], painted[j + 2]) - painted[j + 1] < 15) neighbors.push(j);
    }
    if (touchesKey && neighbors.length) for (let c = 0; c < 3; c++)
      data[i + c] = Math.round(neighbors.reduce((sum, j) => sum + painted[j + c], 0) / neighbors.length);
  }
  return data;
}
export async function importSprite(input, output) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  keySpritePixels(data, info.width, info.height);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 94, alphaQuality: 100, effort: 6 }).toFile(output);
  return { width: info.width, height: info.height };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/import_defense_sprite.mjs input.png output.webp');
  console.log(await importSprite(process.argv[2], process.argv[3]));
}
