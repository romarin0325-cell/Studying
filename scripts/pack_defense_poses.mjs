import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Offline atlas authoring: keep connected painted silhouettes together even
// when a generated pose crosses its approximate cell. Scale each pair once.
export async function packPoses(input, output, rows, boundaries) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info, count = width * height;
  const visited = new Uint8Array(count), queue = new Int32Array(count);
  const masks = Array.from({ length: rows * 2 }, () => []);
  for (let seed = 0; seed < count; seed++) {
    if (visited[seed] || data[seed * 4 + 3] < 16) continue;
    let read = 0, tail = 1; queue[0] = seed; visited[seed] = 1;
    const votes = Array(rows * 2).fill(0);
    while (read < tail) {
      const at = queue[read++], x = at % width, y = Math.floor(at / width);
      const owner = boundaries.findIndex(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh);
      if (owner >= 0) votes[owner]++;
      for (const next of [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, at - width, at + width]) {
        if (next < 0 || next >= count || visited[next] || data[next * 4 + 3] < 16) continue;
        visited[next] = 1; queue[tail++] = next;
      }
    }
    if (tail < 10) continue;
    const owner = votes.indexOf(Math.max(...votes));
    for (let i = 0; i < tail; i++) masks[owner].push(queue[i]);
  }
  const poses = masks.map(indices => {
    const box = { left: width, top: height, right: 0, bottom: 0 };
    for (const at of indices) {
      const x = at % width, y = Math.floor(at / width);
      box.left = Math.min(box.left, x); box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y); box.bottom = Math.max(box.bottom, y);
    }
    box.width = box.right - box.left + 1; box.height = box.bottom - box.top + 1;
    const pixels = Buffer.alloc(box.width * box.height * 4);
    for (const at of indices) {
      const offset = ((Math.floor(at / width) - box.top) * box.width + at % width - box.left) * 4;
      data.copy(pixels, offset, at * 4, at * 4 + 4);
    }
    return { box, pixels };
  });
  const cell = 512, layers = [], pairs = [];
  for (let row = 0; row < rows; row++) {
    const pair = poses.slice(row * 2, row * 2 + 2);
    const scale = Math.min(cell * .94 / Math.max(...pair.map(p => p.box.width)), cell * .88 / Math.max(...pair.map(p => p.box.height)));
    pairs.push({ row, scale, sourceBounds: pair.map(p => p.box) });
    for (let column = 0; column < 2; column++) {
      const { box, pixels } = pair[column];
      const w = Math.round(box.width * scale), h = Math.round(box.height * scale);
      layers.push({ input: await sharp(pixels, { raw: { width: box.width, height: box.height, channels: 4 } }).resize(w, h).png().toBuffer(),
        left: column * cell + Math.round((cell - w) / 2), top: row * cell + Math.round(cell * .94) - h });
    }
  }
  const packed = await sharp({ create: { width: cell * 2, height: cell * rows, channels: 4, background: '#00000000' } }).composite(layers).webp({ quality: 94, alphaQuality: 100, effort: 6 }).toBuffer();
  await writeFile(output, packed);
  return pairs;
}

export async function exportFallbacks(atlasPath, ids, root) {
  const atlas = await readFile(atlasPath);
  for (let i = 0; i < ids.length; i++) {
    const cell = await sharp(atlas).extract({ left: 0, top: i * 512, width: 512, height: 512 }).resize(256, 256).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
    await mkdir(path.join(root, 'battle', ids[i]), { recursive: true });
    await mkdir(path.join(root, 'portraits'), { recursive: true });
    await writeFile(path.join(root, 'portraits', ids[i] + '.webp'), cell);
    for (const direction of ['front', 'back', 'left', 'right']) await writeFile(path.join(root, 'battle', ids[i], direction + '.webp'), cell);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output, config] = process.argv.slice(2);
  const { ids, boundaries, fallbackRoot } = JSON.parse(await readFile(config, 'utf8'));
  console.log(await packPoses(input, output, ids.length, boundaries));
  if (fallbackRoot) await exportFallbacks(output, ids, fallbackRoot);
}
