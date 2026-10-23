// Cast-wide visual consistency of every companion SD atlas and memorial painting.
// Measures geometry, style, outline, gloss, shading, palette and four-view spread on each
// 1024×1024 unit atlas, plus lightness/colour/sharpness stats on each 720×1080 memorial.
// Style metrics (lightness, saturation, dark, edge) copy the definitions in review-sd.mjs
// so the numbers are comparable — those four are not exported.
//   node defense/scripts/art/consistency-report.mjs
// Writes defense/docs/ASSET_CONSISTENCY_DATA.json and
// defense/test-results/consistency/{sd-contact,sd-heads,memorial-contact}.png
// and prints a markdown report. Missing files skip that metric instead of crashing.
import sharp from 'sharp';
sharp.cache(false);
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const game = path.join(repo, 'defense');
const UNITS = path.join(game, 'assets/merge/units');
const OUT_JSON = path.join(game, 'docs/ASSET_CONSISTENCY_DATA.json');
const OUT_DIR = path.join(game, 'test-results/consistency');
const JUA = pathToFileURL(path.join(game, 'assets/Jua-Regular.ttf')).href;
const CELL = 512;
const MASK_A = 40;

const {HEROES} = await import(pathToFileURL(path.join(game, 'src/content.js')).href);
const {MEMORIAL_WEBP_PATHS} = await import(pathToFileURL(path.join(game, 'src/memorial-media.js')).href);

const SD_METRICS = [
  'bboxW', 'bboxH', 'topY', 'feetY', 'silhouetteArea', 'headCenterToFeet', 'comXOffset', 'cellMargin',
  'lightness', 'saturation', 'dark', 'edge',
  'rimR', 'rimG', 'rimB', 'rimLightness', 'rimNavy', 'rimThickness',
  'highlightPct', 'highlightBlobsPer10k',
  'flatShare', 'gradientSoftness',
  'paletteSize', 'top5Share',
  'viewAreaSpread', 'feetSpread',
];
const MEM_METRICS = [
  'lightness', 'saturation', 'contrast', 'darkRatio', 'edge', 'sharpness', 'bgBusy', 'warmth', 'colourfulness', 'fileKiB',
];
const SD_TABLE = [
  ['figH', 'bboxH', 0], ['feetY', 'feetY', 0], ['light', 'lightness', 3], ['sat', 'saturation', 3],
  ['edge', 'edge', 3], ['rimL', 'rimLightness', 3], ['rimTh', 'rimThickness', 3], ['hl%', 'highlightPct', 3],
  ['flat', 'flatShare', 3], ['pal', 'paletteSize', 0], ['areaΔ', 'viewAreaSpread', 3], ['feetΔ', 'feetSpread', 1],
];
const MEM_TABLE = [
  ['light', 'lightness', 3], ['sat', 'saturation', 3], ['con', 'contrast', 3], ['dark', 'darkRatio', 3],
  ['edge', 'edge', 3], ['sharp', 'sharpness', 3], ['busy', 'bgBusy', 3], ['warm', 'warmth', 3],
  ['col', 'colourfulness', 1], ['KiB', 'fileKiB', 1],
];

const r3 = v => !Number.isFinite(v) ? v : Math.round(v * 1000) / 1000;
const hslLS = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  return {l, s};
};
const hueDeg = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
};
function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function madOf(arr, med) {
  return median(arr.map(x => Math.abs(x - med)));
}
function robustZ(x, med, mad) {
  if (mad === 0) return x === med ? 0 : x > med ? 99.999 : -99.999;
  return (x - med) / (1.4826 * mad);
}
function gradeOf(z) {
  const a = Math.abs(z);
  if (a <= 2) return 'ok';
  if (a <= 3) return 'warn';
  return 'out';
}

// Copied from review-sd.mjs measure() (not exported). Cell is 512×512 RGBA.
// Mask A>=200; outline if A 2px away <40; dark is HSL L<0.16 on inner pixels;
// edge is Sobel hypot of Rec.709 lum >0.18 on inner pixels.
function styleMetrics(data) {
  const A = i => data[i * 4 + 3];
  const lum = i => (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  let n = 0, L = 0, S = 0, dark = 0, edge = 0, oln = 0;
  for (let y = 1; y < 511; y++) for (let x = 1; x < 511; x++) {
    const i = y * 512 + x;
    if (A(i) < 200) continue;
    n++;
    const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    L += l;
    S += mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    if ([i - 2, i + 2, i - 1024, i + 1024].some(j => A(j) < 40)) oln++;
    else {
      if (l < 0.16) dark++;
      if (Math.hypot(lum(i + 1) - lum(i - 1), lum(i + 512) - lum(i - 512)) > 0.18) edge++;
    }
  }
  const inner = n - oln;
  return {
    lightness: n ? L / n : 0,
    saturation: n ? S / n : 0,
    dark: inner ? dark / inner : 0,
    edge: inner ? edge / inner : 0,
  };
}

function extractCell(atlas, atlasW, view) {
  const ox = (view % 2) * CELL, oy = Math.floor(view / 2) * CELL;
  const cell = Buffer.allocUnsafe(CELL * CELL * 4);
  for (let y = 0; y < CELL; y++) {
    atlas.copy(cell, y * CELL * 4, ((oy + y) * atlasW + ox) * 4, ((oy + y) * atlasW + ox + CELL) * 4);
  }
  return cell;
}

function chebyshevDistToOutside(mask, w, h) {
  const INF = 4096;
  const d = new Int16Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = INF;
      if (x === 0 || y === 0) m = 1;
      if (y > 0) {
        m = Math.min(m, d[(y - 1) * w + x] + 1);
        if (x > 0) m = Math.min(m, d[(y - 1) * w + (x - 1)] + 1);
        if (x < w - 1) m = Math.min(m, d[(y - 1) * w + (x + 1)] + 1);
      }
      if (x > 0) m = Math.min(m, d[y * w + (x - 1)] + 1);
      d[i] = Math.min(d[i], m);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let m = d[i];
      if (x === w - 1 || y === h - 1) m = Math.min(m, 1);
      if (y < h - 1) {
        m = Math.min(m, d[(y + 1) * w + x] + 1);
        if (x > 0) m = Math.min(m, d[(y + 1) * w + (x - 1)] + 1);
        if (x < w - 1) m = Math.min(m, d[(y + 1) * w + (x + 1)] + 1);
      }
      if (x < w - 1) m = Math.min(m, d[y * w + (x + 1)] + 1);
      d[i] = m;
    }
  }
  return d;
}

function highlightBlobs(spec, w, h, maxArea) {
  const vis = new Uint8Array(w * h);
  let area = 0, count = 0;
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!spec[i] || vis[i]) continue;
    stack.length = 0;
    stack.push(i);
    vis[i] = 1;
    let a = 0;
    while (stack.length) {
      const j = stack.pop();
      a++;
      const x = j % w, y = (j / w) | 0;
      if (x > 0 && spec[j - 1] && !vis[j - 1]) { vis[j - 1] = 1; stack.push(j - 1); }
      if (x + 1 < w && spec[j + 1] && !vis[j + 1]) { vis[j + 1] = 1; stack.push(j + 1); }
      if (y > 0 && spec[j - w] && !vis[j - w]) { vis[j - w] = 1; stack.push(j - w); }
      if (y + 1 < h && spec[j + w] && !vis[j + w]) { vis[j + w] = 1; stack.push(j + w); }
    }
    if (a <= maxArea) { area += a; count++; }
  }
  return {area, count};
}

function viewGeom(data) {
  const W = CELL, H = CELL;
  let area = 0, feetY = -1, sumX = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > MASK_A) {
        area++;
        sumX += x;
        feetY = y;
      }
    }
  }
  return {area, feetY, comXOffset: area ? sumX / area - 256 : 0};
}

function measureDown(data, portrait) {
  const W = CELL, H = CELL, N = W * H;
  const mask = new Uint8Array(N);
  const lum = new Float32Array(N);
  let count = 0, xMin = W, xMax = -1, yMin = H, yMax = -1, sumX = 0, margin = W;
  let rimR = 0, rimG = 0, rimB = 0, rimN = 0, rimLsum = 0;
  const hist = new Uint32Array(4096);
  const spec = new Uint8Array(N);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4;
      const r8 = data[o], g8 = data[o + 1], b8 = data[o + 2], a = data[o + 3];
      const r = r8 / 255, g = g8 / 255, b = b8 / 255;
      lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (a <= MASK_A) continue;
      mask[i] = 1;
      count++;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
      sumX += x;
      const m = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (m < margin) margin = m;
      hist[((r8 >> 4) << 8) | ((g8 >> 4) << 4) | (b8 >> 4)]++;
      const {s} = hslLS(r, g, b);
      if (lum[i] > 0.93 && s < 0.25) spec[i] = 1;
    }
  }
  if (!count) return null;

  const dist = chebyshevDistToOutside(mask, W, H);
  const thick = [];
  for (let y = 0; y < H; y++) {
    let first = -1, last = -1;
    const row = y * W;
    for (let x = 0; x < W; x++) if (mask[row + x]) { if (first < 0) first = x; last = x; }
    if (first < 0) continue;
    let firstEnd = first;
    while (firstEnd + 1 <= last && mask[row + firstEnd + 1]) firstEnd++;
    let lastStart = last;
    while (lastStart - 1 >= first && mask[row + lastStart - 1]) lastStart--;
    let t = 0;
    for (let x = first; x <= firstEnd && lum[row + x] < 0.30; x++) t++;
    thick.push(t);
    t = 0;
    for (let x = last; x >= lastStart && lum[row + x] < 0.30; x--) t++;
    thick.push(t);
  }

  for (let i = 0; i < N; i++) {
    if (!mask[i] || dist[i] > 3) continue;
    const o = i * 4;
    rimR += data[o]; rimG += data[o + 1]; rimB += data[o + 2]; rimN++;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    rimLsum += hslLS(r, g, b).l;
  }

  let flatN = 0, flat = 0, grad = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!mask[i] || dist[i] <= 4) continue;
      let s = 0, s2 = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const v = lum[i + dy * W + dx];
        s += v; s2 += v * v;
      }
      const mean = s / 9, std = Math.sqrt(Math.max(0, s2 / 9 - mean * mean));
      grad += std;
      if (std < 0.02) flat++;
      flatN++;
    }
  }

  let distinct = 0;
  const counts = [];
  for (let k = 0; k < 4096; k++) if (hist[k]) { distinct++; counts.push(hist[k]); }
  counts.sort((a, b) => b - a);
  const top5 = counts.slice(0, 5).reduce((a, b) => a + b, 0);

  const hl = highlightBlobs(spec, W, H, 150);
  const meanR = rimN ? rimR / rimN : 0, meanG = rimN ? rimG / rimN : 0, meanB = rimN ? rimB / rimN : 0;
  const style = styleMetrics(data);
  const py = portrait?.y;

  return {
    bboxW: xMax - xMin + 1,
    bboxH: yMax - yMin + 1,
    topY: yMin,
    feetY: yMax,
    silhouetteArea: count,
    headCenterToFeet: py == null ? null : yMax - py,
    comXOffset: sumX / count - 256,
    cellMargin: margin === W ? 0 : margin,
    ...style,
    rimR: meanR, rimG: meanG, rimB: meanB,
    rimLightness: rimN ? rimLsum / rimN : 0,
    rimNavy: meanB - meanR,
    rimThickness: median(thick),
    highlightPct: 100 * hl.area / count,
    highlightBlobsPer10k: 10000 * hl.count / count,
    flatShare: flatN ? flat / flatN : 0,
    gradientSoftness: flatN ? grad / flatN : 0,
    paletteSize: distinct,
    top5Share: top5 / count,
  };
}

function measureMemorial(data, w, h, bytes) {
  const N = w * h;
  const lum = new Float32Array(N);
  let L = 0, S = 0, dark = 0, warmN = 0, warm = 0;
  let srg = 0, syb = 0, srg2 = 0, syb2 = 0, lumSum = 0, lumSum2 = 0;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    const r8 = data[o], g8 = data[o + 1], b8 = data[o + 2];
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lumSum += lum[i]; lumSum2 += lum[i] * lum[i];
    const hs = hslLS(r, g, b);
    L += hs.l; S += hs.s;
    if (lum[i] < 0.2) dark++;
    if (hs.s > 0.2) {
      warmN++;
      const hue = hueDeg(r, g, b);
      if (hue <= 70 || hue >= 300) warm++;
    }
    const rg = r8 - g8, yb = 0.5 * (r8 + g8) - b8;
    srg += rg; syb += yb; srg2 += rg * rg; syb2 += yb * yb;
  }
  const meanLum = lumSum / N;
  const contrast = Math.sqrt(Math.max(0, lumSum2 / N - meanLum * meanLum));
  const mrg = srg / N, myb = syb / N;
  const colourfulness = Math.sqrt(Math.max(0, srg2 / N - mrg * mrg) + Math.max(0, syb2 / N - myb * myb))
    + 0.3 * Math.sqrt(mrg * mrg + myb * myb);

  let edgeN = 0, edge = 0, bandN = 0, bandEdge = 0;
  let lapN = 0, lapS = 0, lapS2 = 0;
  const bx = 0.15 * w, by = 0.15 * h;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const isEdge = Math.hypot(lum[i + 1] - lum[i - 1], lum[i + w] - lum[i - w]) > 0.18;
      edgeN++;
      if (isEdge) edge++;
      const inBand = x < bx || x >= w - bx || y < by || y >= h - by;
      if (inBand) { bandN++; if (isEdge) bandEdge++; }
      const lap = lum[i - w - 1] + lum[i - w] + lum[i - w + 1] + lum[i - 1]
        + lum[i + 1] + lum[i + w - 1] + lum[i + w] + lum[i + w + 1] - 8 * lum[i];
      lapS += lap; lapS2 += lap * lap; lapN++;
    }
  }
  const lapMean = lapN ? lapS / lapN : 0;
  return {
    lightness: L / N,
    saturation: S / N,
    contrast,
    darkRatio: dark / N,
    edge: edgeN ? edge / edgeN : 0,
    sharpness: lapN ? Math.max(0, lapS2 / lapN - lapMean * lapMean) : 0,
    bgBusy: bandN ? bandEdge / bandN : 0,
    warmth: warmN ? warm / warmN : 0,
    colourfulness,
    fileKiB: bytes / 1024,
  };
}

function graded(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null || !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}

function attachCast(rows, key, metrics) {
  const stats = {};
  for (const m of metrics) {
    const vals = rows.map(r => r[key]?.[m]).filter(v => Number.isFinite(v));
    if (!vals.length) continue;
    const med = median(vals), mad = madOf(vals, med);
    stats[m] = {median: r3(med), mad: r3(mad), min: r3(Math.min(...vals)), max: r3(Math.max(...vals))};
    for (const r of rows) {
      const v = r[key]?.[m];
      if (!Number.isFinite(v)) continue;
      const z = robustZ(v, med, mad);
      r[key][m] = {value: r3(v), z: r3(z), grade: gradeOf(z)};
    }
  }
  return stats;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]));
}

function nameOverlay(names, cols, tileW, tileH) {
  const rows = Math.ceil(names.length / cols);
  const W = cols * tileW, H = rows * tileH;
  const fs = tileW >= 240 ? 15 : tileW >= 190 ? 13 : 11;
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs><style>@font-face{font-family:Jua;src:url('${JUA}');}</style></defs>`;
  for (let i = 0; i < names.length; i++) {
    const x = (i % cols) * tileW + tileW / 2;
    const y = Math.floor(i / cols) * tileH + tileH - 8;
    const t = escapeXml(names[i] || '');
    svg += `<text x="${x}" y="${y}" text-anchor="middle" font-family="Jua,'Malgun Gothic',sans-serif" font-size="${fs}" fill="#fff" stroke="#000" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round">${t}</text>`;
  }
  return Buffer.from(svg + '</svg>');
}

async function writeContact(tiles, names, cols, tileW, tileH, dest) {
  const rows = Math.ceil(names.length / cols);
  const W = cols * tileW, H = rows * tileH;
  const layers = [];
  for (let i = 0; i < tiles.length; i++) {
    if (!tiles[i]) continue;
    layers.push({input: tiles[i], left: (i % cols) * tileW, top: Math.floor(i / cols) * tileH});
  }
  layers.push({input: nameOverlay(names, cols, tileW, tileH), left: 0, top: 0});
  await sharp({create: {width: W, height: H, channels: 3, background: '#88aaaa'}})
    .composite(layers)
    .png()
    .toFile(dest);
}

function fmtCell(entry, digits) {
  if (!entry || !Number.isFinite(entry.value)) return '—';
  const s = digits === 0 ? String(Math.round(entry.value)) : entry.value.toFixed(digits);
  if (entry.grade === 'warn') return s + '⚠';
  if (entry.grade === 'out') return s + '✕';
  return s;
}

function mdTable(headers, rows) {
  const line = cols => '| ' + cols.join(' | ') + ' |';
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

const t0 = process.hrtime.bigint();
const problems = [];
const rows = [];
const sdTiles = [];
const headTiles = [];
const memTiles = [];
const names = [];

await fs.mkdir(OUT_DIR, {recursive: true});

for (const hero of HEROES) {
  const rec = {id: hero.id, name: hero.name, rarity: hero.rarity, heightGroup: hero.heightGroup, sd: {}, memorial: {}};
  names.push(hero.name);
  const atlasPath = path.join(UNITS, hero.id + '.webp');
  try {
    await fs.access(atlasPath);
    const {data, info} = await sharp(atlasPath).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    if (info.width !== 1024 || info.height !== 1024) {
      problems.push(`${hero.id}: SD atlas is ${info.width}×${info.height}, expected 1024×1024`);
      sdTiles.push(null);
      headTiles.push(null);
    } else {
      const down = extractCell(data, info.width, 0);
      const measured = measureDown(down, hero.art?.portrait);
      if (!measured) {
        problems.push(`${hero.id}: SD down cell has no pixels with alpha > ${MASK_A}`);
      } else {
        const ratios = [], feet = [];
        for (let v = 0; v < 4; v++) {
          const g = viewGeom(v === 0 ? down : extractCell(data, info.width, v));
          if (!g.area) {
            problems.push(`${hero.id}: SD view ${['down', 'up', 'left', 'right'][v]} has empty mask`);
            continue;
          }
          ratios.push(g.area / measured.silhouetteArea);
          feet.push(g.feetY);
        }
        if (ratios.length) measured.viewAreaSpread = Math.max(...ratios) - Math.min(...ratios);
        if (feet.length) measured.feetSpread = Math.max(...feet) - Math.min(...feet);
        rec.sd = graded(measured);
      }
      try {
        sdTiles.push(await sharp(down, {raw: {width: CELL, height: CELL, channels: 4}}).resize(256, 256).png().toBuffer());
      } catch (err) {
        sdTiles.push(null);
        problems.push(`${hero.id}: SD contact tile failed (${err.message})`);
      }
      const px = hero.art?.portrait?.x, py = hero.art?.portrait?.y;
      if (px == null || py == null) {
        headTiles.push(null);
        problems.push(`${hero.id}: missing art.portrait`);
      } else {
        try {
          const left = Math.max(0, Math.min(CELL - 200, Math.round(px - 100)));
          const top = Math.max(0, Math.min(CELL - 200, Math.round(py - 100)));
          headTiles.push(await sharp(down, {raw: {width: CELL, height: CELL, channels: 4}})
            .extract({left, top, width: 200, height: 200}).png().toBuffer());
        } catch (err) {
          headTiles.push(null);
          problems.push(`${hero.id}: head crop failed (${err.message})`);
        }
      }
    }
  } catch (err) {
    problems.push(`missing SD atlas: ${hero.id} (${path.relative(repo, atlasPath)}; ${err.message})`);
    sdTiles.push(null);
    headTiles.push(null);
  }

  const rel = MEMORIAL_WEBP_PATHS[hero.id];
  const memPath = rel ? path.resolve(game, rel) : path.join(game, 'assets/memorial-webp', hero.id + '.webp');
  try {
    const st = await fs.stat(memPath);
    const {data, info} = await sharp(memPath).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    if (info.width !== 720 || info.height !== 1080) {
      problems.push(`${hero.id}: memorial is ${info.width}×${info.height}, expected 720×1080`);
    }
    rec.memorial = graded(measureMemorial(data, info.width, info.height, st.size));
    try {
      memTiles.push(await sharp(memPath).resize(180, 270).png().toBuffer());
    } catch (err) {
      memTiles.push(null);
      problems.push(`${hero.id}: memorial contact tile failed (${err.message})`);
    }
  } catch {
    problems.push(`missing memorial: ${hero.id} (${path.relative(repo, memPath)})`);
    memTiles.push(null);
  }
  rows.push(rec);
}

const castStats = {
  sd: attachCast(rows, 'sd', SD_METRICS),
  memorial: attachCast(rows, 'memorial', MEM_METRICS),
};

const now = new Date();
const generated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const heroesOut = {};
for (const r of rows) {
  heroesOut[r.id] = {name: r.name, rarity: r.rarity, heightGroup: r.heightGroup, sd: r.sd, memorial: r.memorial};
}
await fs.writeFile(OUT_JSON, JSON.stringify({generated, castStats, heroes: heroesOut}, null, 2) + '\n');

await writeContact(sdTiles, names, 7, 256, 256, path.join(OUT_DIR, 'sd-contact.png'));
await writeContact(headTiles, names, 7, 200, 200, path.join(OUT_DIR, 'sd-heads.png'));
await writeContact(memTiles, names, 8, 180, 270, path.join(OUT_DIR, 'memorial-contact.png'));

const flags = [];
for (const r of rows) {
  for (const [group, metrics] of [['sd', SD_METRICS], ['memorial', MEM_METRICS]]) {
    for (const m of metrics) {
      const e = r[group]?.[m];
      if (!e || e.grade === 'ok') continue;
      flags.push({abs: Math.abs(e.z), grade: e.grade, name: r.name, id: r.id, group, metric: m, value: e.value, z: e.z});
    }
  }
}
flags.sort((a, b) => b.abs - a.abs || a.name.localeCompare(b.name) || a.metric.localeCompare(b.metric));

const rangeRows = (stats, metrics, prefix) => metrics.filter(m => stats[m]).map(m => {
  const s = stats[m];
  return [`${prefix}${m}`, s.median.toFixed(3), s.min.toFixed(3), s.max.toFixed(3)];
});

const sdHeroRows = rows.map(r => [
  r.name,
  ...SD_TABLE.map(([, key, d]) => fmtCell(r.sd[key], d)),
]);
const memHeroRows = rows.map(r => [
  r.name,
  ...MEM_TABLE.map(([, key, d]) => fmtCell(r.memorial[key], d)),
]);

const out = [];
out.push('# Asset consistency');
out.push('');
if (problems.length) {
  out.push('## Parse problems');
  for (const p of problems) out.push(`- ${p}`);
  out.push('');
} else {
  out.push('Parse problems: none');
  out.push('');
}
out.push(`Heroes measured: ${rows.length} (HEROES order). Unusual silhouettes are included; the reviewer decides what is by-design.`);
out.push('');
out.push('## 1. Cast ranges');
out.push('');
out.push('### SD');
out.push(mdTable(['metric', 'median', 'min', 'max'], rangeRows(castStats.sd, SD_METRICS, '')));
out.push('');
out.push('### Memorial');
out.push(mdTable(['metric', 'median', 'min', 'max'], rangeRows(castStats.memorial, MEM_METRICS, '')));
out.push('');
out.push('## 2. SD per hero');
out.push('');
out.push('ok = no marker, ⚠ = warn (|z|≤3), ✕ = out (|z|>3).');
out.push('');
out.push(mdTable(['name', ...SD_TABLE.map(([h]) => h)], sdHeroRows));
out.push('');
out.push('## 3. Memorial per hero');
out.push('');
out.push(mdTable(['name', ...MEM_TABLE.map(([h]) => h)], memHeroRows));
out.push('');
out.push('## 4. Out and warn cells');
out.push('');
if (!flags.length) out.push('None.');
else {
  out.push(mdTable(['|z|', 'grade', 'hero', 'metric', 'value'], flags.map(f => [
    f.abs.toFixed(3),
    f.grade === 'out' ? '✕ out' : '⚠ warn',
    f.name,
    `${f.group}.${f.metric}`,
    Number.isInteger(f.value) ? String(f.value) : f.value.toFixed(3),
  ])));
}
out.push('');
const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
out.push(`Elapsed ${ (elapsedMs / 1000).toFixed(2) }s.`);
console.log(out.join('\n'));
