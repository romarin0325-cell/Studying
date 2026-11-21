import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const art = path.resolve(here, '../../art');
const output = path.resolve(here, '../assets');
const POSES = ['idle', 'attack', 'hurt'];
const ALLY_HEIGHTS = { small: 58, medium: 64, normal: 72, tall: 80 };
const CREATURE_HEIGHTS = { small: 48, medium: 64, large: 80 };
const MIN_PART_RATIO = 0.015;
const OUTLINE = [43, 33, 64];

function targetHeight(subject) {
  let height = subject.heightPx;
  if (height == null) {
    if (subject.kind === 'ally') height = ALLY_HEIGHTS[subject.height ?? 'normal'];
    else if (subject.kind === 'boss') height = 104;
    else height = CREATURE_HEIGHTS[subject.size];
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error('Invalid sprite height for ' + subject.id);
  }
  return height;
}

function image(width, height) {
  return { data: Buffer.alloc(width * height * 4), width, height };
}

function isMagenta(red, green, blue) {
  return (255 - red) ** 2 + green ** 2 + (255 - blue) ** 2 < 105 ** 2 ||
    (red > 190 && blue > 190 && green < 90);
}

function keyCell(strip, poseIndex) {
  const left = Math.floor(strip.width * poseIndex / POSES.length);
  const right = Math.floor(strip.width * (poseIndex + 1) / POSES.length);
  const cell = image(right - left, strip.height);
  const { data } = strip;
  for (let y = 0; y < cell.height; y++) {
    for (let x = 0; x < cell.width; x++) {
      const source = (y * strip.width + left + x) * 4;
      const target = (y * cell.width + x) * 4;
      if (data[source + 3] && !isMagenta(data[source], data[source + 1], data[source + 2])) {
        data.copy(cell.data, target, source, source + 3);
        cell.data[target + 3] = 255;
      }
    }
  }
  return cell;
}

function* opaquePixels({ data }) {
  for (let i = 0; i < data.length / 4; i++) {
    if (data[i * 4 + 3]) yield i;
  }
}

function boundsOf({ width, height }, pixels) {
  let left = width, top = height, right = -1, bottom = -1;
  for (const pixel of pixels) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function connectedParts({ data, width, height }) {
  const seen = new Uint8Array(width * height);
  const parts = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !data[start * 4 + 3]) continue;
    const part = [start];
    seen[start] = 1;
    for (let i = 0; i < part.length; i++) {
      const x = part[i] % width;
      const y = Math.floor(part[i] / width);
      // Diagonals keep one-pixel lines and corners connected.
      for (let row = Math.max(0, y - 1); row <= Math.min(height - 1, y + 1); row++) {
        for (let col = Math.max(0, x - 1); col <= Math.min(width - 1, x + 1); col++) {
          const neighbor = row * width + col;
          if (seen[neighbor] || !data[neighbor * 4 + 3]) continue;
          seen[neighbor] = 1;
          part.push(neighbor);
        }
      }
    }
    parts.push(part);
  }
  return parts.sort((a, b) => b.length - a.length);
}

function crop(source, bounds) {
  const result = image(bounds.width, bounds.height);
  for (let y = 0; y < result.height; y++) {
    const start = ((bounds.top + y) * source.width + bounds.left) * 4;
    source.data.copy(result.data, y * result.width * 4, start, start + result.width * 4);
  }
  return result;
}

function torsoCenter(cell, body, pixels) {
  // Use dense columns in the middle of the idle torso to align ordinary attack poses.
  const top = Math.floor(body.top + body.height * 0.4);
  const bottom = Math.floor(body.top + body.height * 0.75);
  const columns = new Array(cell.width).fill(0);
  for (const pixel of pixels) {
    const row = Math.floor(pixel / cell.width);
    if (row >= top && row < bottom) columns[pixel % cell.width]++;
  }
  const threshold = Math.max(...columns) * 0.7;
  const dense = columns.map((count, x) => count >= threshold ? x : -1).filter(x => x >= 0);
  return (dense[0] + dense.at(-1)) / 2;
}

function downsample(cell, bounds, scale) {
  // Compensate for rounding error when a scaled edge lands on a whole pixel.
  const result = image(
    Math.ceil(bounds.width * scale - 1e-9),
    Math.ceil(bounds.height * scale - 1e-9)
  );
  for (let y = 0; y < result.height; y++) {
    const top = Math.floor(bounds.top + y / scale);
    const bottom = sampleEnd(bounds.top, bounds.bottom, y, scale, top);
    for (let x = 0; x < result.width; x++) {
      const left = Math.floor(bounds.left + x / scale);
      const right = sampleEnd(bounds.left, bounds.right, x, scale, left);
      samplePixel(cell, result, (y * result.width + x) * 4, left, right, top, bottom);
    }
  }
  return result;
}

function sampleEnd(origin, last, index, scale, start) {
  const end = Math.floor(origin + (index + 1) / scale);
  // An override can scale a small source up. Sample at least one source pixel.
  return Math.min(last + 1, scale > 1 ? Math.max(start + 1, end) : end);
}

function samplePixel(source, target, offset, left, right, top, bottom) {
  const colors = new Map();
  const { data } = source;
  let opaque = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * source.width + x) * 4;
      if (!data[i + 3]) continue;
      opaque++;
      // Choose the modal colour on a five-bit RGB grid.
      const color = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      colors.set(color, (colors.get(color) || 0) + 1);
    }
  }
  // Ignore samples with too little foreground to make a solid output pixel.
  if (opaque <= (right - left) * (bottom - top) * 0.35) return;
  const [color] = [...colors].sort((a, b) => b[1] - a[1])[0];
  target.data[offset] = ((color >> 10) & 31) * 8 + 4;
  target.data[offset + 1] = ((color >> 5) & 31) * 8 + 4;
  target.data[offset + 2] = (color & 31) * 8 + 4;
  target.data[offset + 3] = 255;
}

function removeFringe({ data, width, height }) {
  const changes = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!data[i + 3]) continue;
      const touchesEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
        !data[i - 4 + 3] || !data[i + 4 + 3] || !data[i - width * 4 + 3] || !data[i + width * 4 + 3];
      if (!touchesEdge) continue;
      const red = data[i], green = data[i + 1], blue = data[i + 2];
      const pink = red > green * 1.4 && blue > green * 1.4 && Math.max(red, blue) - green > 70;
      const magentaDistance = (red - 255) ** 2 + green ** 2 + (blue - 255) ** 2;
      const outlineDistance = (red - OUTLINE[0]) ** 2 + (green - OUTLINE[1]) ** 2 + (blue - OUTLINE[2]) ** 2;
      if (pink && magentaDistance < outlineDistance) changes.push(i);
    }
  }
  for (const i of changes) data.set(OUTLINE, i);
}

function keepComponents(source, parts) {
  const keep = new Uint8Array(source.width * source.height);
  for (const part of parts) {
    for (const pixel of part) keep[pixel] = 1;
  }
  for (let i = 0; i < keep.length; i++) {
    if (!keep[i]) source.data[i * 4 + 3] = 0;
  }
}

function ashEffect(source, detachedParts) {
  const effect = image(source.width, source.height);
  for (const part of detachedParts) {
    if (part.length < 2) continue;
    for (const pixel of part) {
      const i = pixel * 4;
      source.data.copy(effect.data, i, i, i + 4);
    }
  }
  const bounds = boundsOf(effect, opaquePixels(effect));
  if (bounds.right < 0) return null;
  return {
    name: 'ash-fx.png', ...crop(effect, bounds),
    centerX: (bounds.width - 1) / 2, feetY: bounds.height - 1, effect: true
  };
}

function bodyCenter(id, pose, body, torsoX) {
  if (pose !== 'attack' || id === 'ash') return body.left + Math.round((body.width - 1) * 0.5);
  // These attack frames extend asymmetrically around the fighter.
  if (id === 'red_dragon' || id === 'luna') return body.left + Math.round((body.width - 1) * 0.4);
  if (id === 'golem') return body.left + Math.round((body.width - 1) * 0.58);
  return Math.max(body.left, Math.min(body.right, Math.round(torsoX)));
}

function cutPose(subject, pose, cell, scale, torso, sprites) {
  const original = boundsOf(cell, opaquePixels(cell));
  if (original.right < 0) throw new Error('Empty pose: ' + subject.id + ' ' + pose);
  const scaled = downsample(cell, original, scale);
  const [main, ...detached] = connectedParts(scaled);
  if (!main) throw new Error('No component: ' + subject.id + ' ' + pose);
  const body = boundsOf(scaled, main);
  if (subject.id === 'ash' && pose === 'attack') {
    const effect = ashEffect(scaled, detached);
    if (effect) sprites.push(effect);
  }
  const minimumArea = main.length * MIN_PART_RATIO;
  const keep = subject.keepParts === false ? [main] : [main, ...detached.filter(part => part.length >= minimumArea)];
  keepComponents(scaled, keep);
  const bounds = boundsOf(scaled, opaquePixels(scaled));
  const sprite = crop(scaled, bounds);
  removeFringe(sprite);
  const centerX = bodyCenter(subject.id, pose, body, (torso - original.left) * scale);
  sprites.push({
    name: subject.id + '-' + pose + '.png', ...sprite,
    centerX: centerX - bounds.left, feetY: body.bottom - bounds.top
  });
}

async function cutSubject(subject) {
  const filename = path.join(art, 'strips', subject.id + '-strip.png');
  const { data, info } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const strip = { data, width: info.width, height: info.height };
  const cells = POSES.map((_, index) => keyCell(strip, index));
  const idle = cells[0];
  // The compatibility option uses the old scale and torso estimate from the entire keyed cell.
  const main = subject.keepParts === false ? null : connectedParts(idle)[0];
  const body = boundsOf(idle, main ?? opaquePixels(idle));
  if (body.right < 0) throw new Error('Empty pose: ' + subject.id + ' idle');
  const scale = targetHeight(subject) / body.height;
  const torso = torsoCenter(idle, body, main ?? opaquePixels(idle));
  const sprites = [];
  for (const [index, pose] of POSES.entries()) {
    cutPose(subject, pose, cells[index], scale, torso, sprites);
  }
  return sprites;
}

async function saveSprites(subject, sprites, metadata) {
  const width = Math.max(...sprites.map(sprite => sprite.width));
  const height = sprites.reduce((total, sprite) => total + sprite.height, 0);
  const joined = image(width, height);
  let offsetY = 0;
  for (const sprite of sprites) {
    for (let y = 0; y < sprite.height; y++) {
      const rowBytes = sprite.width * 4;
      sprite.data.copy(joined.data, (offsetY + y) * width * 4, y * rowBytes, (y + 1) * rowBytes);
    }
    offsetY += sprite.height;
  }
  // Quantize the poses together so a subject keeps one palette.
  const quantized = await sharp(joined.data, { raw: { width, height, channels: 4 } })
    .png({ palette: true, colours: 32, dither: 0 }).toBuffer();
  joined.data = await sharp(quantized).ensureAlpha().raw().toBuffer();

  const { id, kind, size = kind === 'ally' ? 'ally' : kind === 'boss' ? 'boss' : undefined } = subject;
  offsetY = 0;
  for (const sprite of sprites) {
    const cut = crop(joined, { left: 0, top: offsetY, width: sprite.width, height: sprite.height });
    offsetY += sprite.height;
    for (let i = 3; i < cut.data.length; i += 4) cut.data[i] = cut.data[i] >= 128 ? 255 : 0;
    await sharp(cut.data, { raw: { width: cut.width, height: cut.height, channels: 4 } })
      .png().toFile(path.join(output, sprite.name));
    metadata[sprite.name] = {
      width: sprite.width, height: sprite.height, bodyCenterX: sprite.centerX, feetBaselineY: sprite.feetY,
      ...(sprite.effect ? { effect: true } : {}),
      ...(sprite.name === id + '-idle.png' ? { kind, size, facing: subject.facing } : {})
    };
  }
}

const manifest = JSON.parse(await fs.readFile(path.join(art, 'manifest.json'), 'utf8'));
const metadata = {};
await fs.mkdir(output, { recursive: true });
for (const subject of manifest.filter(entry => entry.status === 'ok')) {
  const sprites = await cutSubject(subject);
  await saveSprites(subject, sprites, metadata);
  console.log(subject.id, sprites.map(sprite => sprite.name + ':' + sprite.width + 'x' + sprite.height).join(' '));
}
await fs.writeFile(path.join(output, 'sprites.json'), JSON.stringify(metadata, null, 2) + '\n');
for (const name of await fs.readdir(output)) {
  if (name.endsWith('.png') && !Object.hasOwn(metadata, name)) await fs.unlink(path.join(output, name));
}
