// Offline art preparation for card_claude. Not part of the build.
// node card_claude/tools/prepare-art.mjs <raw-dir>
// <raw-dir> holds the original generator PNGs plus <id>.json metadata (prompt, model).
// Outputs small WebPs into card_claude/assets and records hashes in assets/art-manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const raw = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(raw)) throw new Error('Usage: node card_claude/tools/prepare-art.mjs <raw-dir>');
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const manifest = { note: 'Generated with Gemini image models; originals are not committed. Prompts are recorded per asset.', assets: {} };
const meta = id => { try { return JSON.parse(fs.readFileSync(path.join(raw, `${id}.json`), 'utf8')); } catch { return {}; } };
const record = (file, ids, extra = {}) => {
  const out = fs.readFileSync(path.join(assets, file));
  manifest.assets[file] = { bytes: out.length, sha256: sha(out), sources: ids.map(id => ({ id, sha256: sha(fs.readFileSync(path.join(raw, `${id}.png`))), model: meta(id).model, prompt: meta(id).prompt })), ...extra };
};

// Theme scenes: one phone-sized frame each. Cover-crop to 9:16 keeps the generated composition.
for (const theme of ['astra', 'strawberry', 'dreamsky']) {
  for (const scene of ['title', 'lobby', 'battle', 'summon']) {
    const id = `${theme}-${scene}`;
    await sharp(path.join(raw, `${id}.png`)).resize(720, 1280, { fit: 'cover' })
      .webp({ quality: 74, effort: 6, smartSubsample: true }).toFile(path.join(assets, `${id}.webp`));
    record(`${id}.webp`, [id], { size: '720x1280' });
  }
}

// Effects: 4x2 atlas of 256px cells. The generator draws glow on black; brightness becomes alpha
// (colour unpremultiplied) so sprites need no blend mode and read on light and dark themes alike.
const fx = ['slash', 'magic', 'heal', 'crit', 'rays', 'circle', 'guard', 'hit'];
const cells = await Promise.all(fx.map(async name => {
  const { data, info } = await sharp(path.join(raw, `fx-${name}.png`)).resize(256, 256, { fit: 'cover' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const peak = Math.max(r, g, b);
    const alpha = peak < 14 ? 0 : Math.min(255, Math.round((peak - 14) * 255 / 241));
    const scale = peak ? 255 / peak : 0;
    rgba[q] = Math.min(255, Math.round(r * scale));
    rgba[q + 1] = Math.min(255, Math.round(g * scale));
    rgba[q + 2] = Math.min(255, Math.round(b * scale));
    rgba[q + 3] = alpha;
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}));
await sharp({ create: { width: 1024, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells.map((input, i) => ({ input, left: (i % 4) * 256, top: Math.floor(i / 4) * 256 })))
  .webp({ quality: 82, alphaQuality: 85, effort: 6 }).toFile(path.join(assets, 'fx.webp'));
record('fx.webp', fx.map(name => `fx-${name}`), { layout: '4x2 cells of 256px, luminance alpha', order: fx });

// Logo and result banners: remove the chroma-key green, despill, trim.
async function keyed(id, width, file) {
  const { data, info } = await sharp(path.join(raw, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const spill = g - Math.max(r, b);
    if (spill > 20) {
      const alpha = Math.max(0, Math.min(1, 1 - (spill - 20) / 90));
      data[i + 3] = Math.round(data[i + 3] * alpha);
      data[i + 1] = Math.max(r, b); // remove green fringe
    }
  }
  await sharp(data, { raw: info }).trim({ threshold: 1 }).resize({ width, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(path.join(assets, file));
  record(file, [id], { keyed: 'chroma green' });
}
// One logo per theme: classical serif for the observatory, rounded lettering for the light themes.
await keyed('logo', 880, 'logo-astra.webp');
await keyed('logo-strawberry-a', 880, 'logo-strawberry.webp');
await keyed('logo-dreamsky-a', 880, 'logo-dreamsky.webp');
for (const name of ['victory', 'defeat', 'clear']) await keyed(`banner-${name}`, 760, `banner-${name}.webp`);

// The magical card back from card/assets, at the largest size the UI draws it (2x of 180px).
const back = path.resolve(root, '../card/assets/magical-card.png');
await sharp(back).resize(360, 600, { fit: 'cover' }).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(path.join(assets, 'card-back-strawberry.webp'));
manifest.assets['card-back-strawberry.webp'] = { bytes: fs.statSync(path.join(assets, 'card-back-strawberry.webp')).size, sha256: sha(fs.readFileSync(path.join(assets, 'card-back-strawberry.webp'))), sources: [{ id: 'card/assets/magical-card.png', sha256: sha(fs.readFileSync(back)) }] };

fs.writeFileSync(path.join(assets, 'art-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(Object.entries(manifest.assets).map(([file, entry]) => `${file} ${(entry.bytes / 1024).toFixed(0)} KiB`).join('\n'));
