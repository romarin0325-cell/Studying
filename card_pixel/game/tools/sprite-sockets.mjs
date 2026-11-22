import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const assets = new URL('../assets/', import.meta.url);
const sprites = JSON.parse(await readFile(new URL('sprites.json', assets), 'utf8'));
const frames = Object.keys(sprites).filter(file => /-(idle|attack)\.png$/.test(file));

async function derive(file) {
  const meta = sprites[file];
  const { data, info: { width, height, channels } } = await sharp(fileURLToPath(new URL(file, assets)))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sign = meta.facing === 'left' ? -1 : 1;
  const opaque = (x, y) => data[(y * width + x) * channels + channels - 1] > 0;
  function leading(y0, y1) {
    for (let col = 0; col < width; col++) {
      const x = sign > 0 ? width - 1 - col : col;
      for (let y = Math.ceil(height * y0); y < height * y1; y++) {
        if (opaque(x, y)) return [x, y];
      }
    }
  }
  let top;
  for (let y = 0; y < height && !top; y++) {
    for (let x = 0; x < width; x++) if (opaque(x, y) &&
      (!top || Math.abs(x - meta.bodyCenterX) < Math.abs(top[0] - meta.bodyCenterX))) top = [x, y];
  }
  if (!top) throw new Error('No opaque pixels in ' + file);
  const clampX = x => Math.max(0, Math.min(width - 1, Math.round(x)));
  const clampY = y => Math.max(0, Math.min(height - 1, Math.round(y)));
  // Attack crops have no measured face box. Both poses share body and foot registration.
  const idle = sprites[file.replace('-attack.png', '-idle.png')];
  const face = meta.face ?? {
    x: idle.face.x + meta.bodyCenterX - idle.bodyCenterX,
    y: idle.face.y + meta.feetBaselineY - idle.feetBaselineY,
    size: idle.face.size
  };
  const mx = clampX(face.x + sign * face.size * 0.32), my = clampY(face.y + face.size * 0.72);
  let mouth;
  for (let dy = 0; dy < height && !mouth; dy++) {
    for (const y of dy === 0 ? [my] : [my - dy, my + dy]) {
      if (y < 0 || y >= height) continue;
      for (let dx = 0; dx < width && !mouth; dx++) {
        const forward = mx + dx * sign, back = mx - dx * sign;
        if (forward >= 0 && forward < width && opaque(forward, y)) mouth = [forward, y];
        else if (back >= 0 && back < width && opaque(back, y)) mouth = [back, y];
      }
      if (mouth) break;
    }
  }
  return {
    hand: leading(0.4, 0.75) ?? leading(0, 1), mouth,
    eye: [clampX(face.x + sign * face.size * 0.15), clampY(face.y + face.size * 0.45)],
    weaponTip: leading(0, 0.7) ?? leading(0, 1), top,
    foot: leading(0.85, 1) ?? leading(0, 1)
  };
}

const sockets = await Promise.all(frames.map(derive));
const rows = frames.map((file, i) => `  ${JSON.stringify(file.slice(0, -4))}: ${JSON.stringify(sockets[i])}`);
await writeFile(new URL('sprite-sockets.json', assets), '{\n' + rows.join(',\n') + '\n}\n');
console.log(`Derived sockets for ${frames.length} poses`);
