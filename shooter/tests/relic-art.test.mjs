import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { createArtUrls } from '../art-manifest.js';
import { COLLECTIBLE_ARTIFACTS } from '../meta.js';

test('collectible relic art has transparent margins and centered, consistently sized silhouettes', async () => {
  const urls = createArtUrls(fileURLToPath(new URL('../generated-assets', import.meta.url))).relics;
  for (let index = 0; index < COLLECTIBLE_ARTIFACTS.length; index++) {
    const id = COLLECTIBLE_ARTIFACTS[index].id;
    const { data, info: { width, height } } = await sharp(urls[index]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (id === 'magnet') assert.equal(data[(Math.floor(height / 3) * width + Math.floor(width / 2)) * 4 + 3], 0, 'magnet: the opening must also have a transparent background');
    let left = width, right = -1, top = height, bottom = -1, visible = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4) assert.equal(alpha, 0, `${id}: transparent border`);
      if (alpha <= 30) continue;
      visible++;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    assert.ok(visible > width * height * .02, `${id}: artwork must remain visible, including narrow swords and chains`);
    assert.ok(Math.abs(left - (width - 1 - right)) <= 2, `${id}: horizontal centering`);
    assert.ok(Math.abs(top - (height - 1 - bottom)) <= 2, `${id}: vertical centering`);
    const extent = Math.max(right - left + 1, bottom - top + 1) / width;
    assert.ok(extent >= .88 && extent <= .95, `${id}: consistent visual size (${extent})`);
  }
});
