// One-off asset preparation for DREAMWEAVER · Lumen. Not part of the build.
// Re-encodes existing repository art into the WebP files kept in card_lumen/assets.
// Run from the repository root: node card_lumen/tools/prepare-assets.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const lumen = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(lumen, '..');
const out = name => path.join(lumen, 'assets', name);
const src = name => path.join(repo, name);

// Card key art: the original observatory and magical-girl art, compressed once.
await sharp(src('card/assets/observatory.png')).webp({ quality: 80 }).toFile(out('observatory.webp'));
await sharp(src('card/assets/magical-sanctuary.png')).resize({ width: 900 }).webp({ quality: 80 }).toFile(out('magical-sanctuary.webp'));
await sharp(src('card/assets/magical-card.png')).resize({ width: 480 }).webp({ quality: 82 }).toFile(out('magical-card.webp'));
// Shared-universe art already used by Star Garden: the summon altar and Lumi's study.
await fs.copyFile(src('defense/assets/optimized/bright/summon-altar.webp'), out('summon-altar.webp'));
await fs.copyFile(src('defense/assets/optimized/library/window.webp'), out('lumi-study.webp'));
// Licensed Noto Sans KR variable subset, copied independently from the Astra edition.
await fs.copyFile(src('card_astra/assets/dreamsans-subset.woff2'), out('dreamsans-subset.woff2'));
await fs.copyFile(src('card_astra/assets/NotoSansKR-OFL.txt'), out('NotoSansKR-OFL.txt'));
for (const file of await fs.readdir(path.join(lumen, 'assets'))) {
  const stat = await fs.stat(out(file));
  console.log(`${file}: ${(stat.size / 1024).toFixed(0)} KiB`);
}
