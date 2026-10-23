// Thickens only the OUTER outline of a packed unit atlas (four 512 cells) by a few pixels, in the sprite's own
// dark outline colour. Interior lines, faces and colours are untouched: the original pixels are drawn over a
// dilated silhouette. For GPT Image sheets whose outer line is thinner than the cast (consistency-report rimThickness).
//   node defense/scripts/art/thicken-outline.mjs <atlas.webp> <out.webp> <px> [--measure]
// --measure prints the median outer dark run (the report's rimThickness) of every cell before and after.
import sharp from 'sharp';
sharp.cache(false);
const [src, out, pxArg] = process.argv.slice(2);
const R = Number(pxArg);
if (!src || !out || !(R > 0 && R <= 4)) throw new Error('Usage: thicken-outline.mjs <atlas.webp> <out.webp> <px 0..4>');
const {data, info} = await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject: true});
const W = info.width, H = info.height, A = i => data[i * 4 + 3];
const lum = i => (.2126 * data[i * 4] + .7152 * data[i * 4 + 1] + .0722 * data[i * 4 + 2]) / 255;
// Outline colour: mean of opaque dark pixels right at the silhouette edge.
let r = 0, g = 0, b = 0, n = 0;
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  const i = y * W + x;
  if (A(i) < 200 || lum(i) > .3) continue;
  if (A(i - 1) < 40 || A(i + 1) < 40 || A(i - W) < 40 || A(i + W) < 40) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; n++; }
}
const ink = n ? [r / n, g / n, b / n].map(Math.round) : [20, 16, 44];
// Dilated silhouette with a soft one-pixel edge, painted in the outline colour, under the original.
const under = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let best = 0;
  const cy = Math.floor(y / 512), cx = Math.floor(x / 512);
  for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H || Math.floor(yy / 512) !== cy || Math.floor(xx / 512) !== cx) continue;
    const d = Math.hypot(dx, dy), cover = Math.max(0, Math.min(1, R + .5 - d));
    if (cover > 0) best = Math.max(best, A(yy * W + xx) / 255 * cover);
  }
  const o = (y * W + x) * 4;
  under[o] = ink[0]; under[o + 1] = ink[1]; under[o + 2] = ink[2]; under[o + 3] = Math.round(best * 255);
}
const base = await sharp(under, {raw: {width: W, height: H, channels: 4}}).png().toBuffer();
await sharp(base).composite([{input: await sharp(src).png().toBuffer()}]).webp({quality: 95, alphaQuality: 100, effort: 6}).toFile(out);
console.log('outline', ink.join(','), 'radius', R, '->', out);
if (process.argv.includes('--measure')) {
  const rim = async file => {
    const {data: d} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const res = [];
    for (let c = 0; c < 4; c++) {
      const ox = (c % 2) * 512, oy = Math.floor(c / 2) * 512, runs = [];
      for (let y = 0; y < 512; y++) {
        const row = x => ((oy + y) * W + ox + x) * 4, on = x => d[row(x) + 3] > 40, L = x => (.2126 * d[row(x)] + .7152 * d[row(x) + 1] + .0722 * d[row(x) + 2]) / 255;
        let first = -1, last = -1;
        for (let x = 0; x < 512; x++) if (on(x)) { if (first < 0) first = x; last = x; }
        if (first < 0) continue;
        let t = 0; for (let x = first; x <= last && on(x) && L(x) < .3; x++) t++; runs.push(t);
        t = 0; for (let x = last; x >= first && on(x) && L(x) < .3; x--) t++; runs.push(t);
      }
      runs.sort((a, b) => a - b); res.push(runs[Math.floor(runs.length / 2)]);
    }
    return res.join('/');
  };
  console.log('rim median per cell before', await rim(src), 'after', await rim(out));
}
