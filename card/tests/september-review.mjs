import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'review', 'september-patch');
await fs.mkdir(target, { recursive: true });
for (const scene of ['deck', 'words', 'battle', 'date', 'tutoring', 'records']) {
    const columns = [['before', 'strawberry'], ['after', 'strawberry'], ['before', 'dreamsky'], ['after', 'dreamsky']];
    const layers = [];
    for (let i = 0; i < columns.length; i++) {
        const [version, theme] = columns[i];
        const image = path.join(root, 'test-results', `patch-${version}-${theme}-${scene}.png`);
        layers.push({ input: await sharp(image).png().toBuffer(), left: i * 390, top: 58 });
    }
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="58"><rect width="1560" height="58" fill="#eaf0f4"/>${columns.map(([v,t],i) => `<text x="${i * 390 + 20}" y="34" font-family="Segoe UI,sans-serif" font-size="18" fill="#294659">${t === 'strawberry' ? 'Magical Girl' : 'Dream Sky'} / ${v.toUpperCase()} / ${scene}</text>`).join('')}</svg>`;
    layers.push({ input: Buffer.from(label), left: 0, top: 0 });
    await sharp({ create: { width: 1560, height: 902, channels: 4, background: '#eaf0f4' } }).composite(layers).png().toFile(path.join(target, `${scene}.png`));
}
console.log('Six four-column review comparisons written to card/review/september-patch');
