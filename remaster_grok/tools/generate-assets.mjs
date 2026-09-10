import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets');

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function writePng(filePath, w, h, sample) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = sample(x / (w - 1), y / (h - 1), x, y);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
  return png.length;
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function sky(t, dusk) {
  const zenith = dusk ? [88, 142, 196, 255] : [126, 198, 236, 255];
  const horizon = dusk ? [255, 214, 168, 255] : [236, 248, 255, 255];
  const floor = dusk ? [46, 92, 138, 255] : [154, 206, 232, 255];
  if (t < 0.42) return mix(zenith, horizon, t / 0.42);
  return mix(horizon, floor, (t - 0.42) / 0.58);
}

function noise(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function cloud(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return clamp01(1 - (dx * dx + dy * dy));
}

function titleSample(u, v) {
  let c = sky(v, false);
  const sun = clamp01(1 - Math.hypot((u - 0.72) * 1.6, (v - 0.18) * 2.1));
  c = mix(c, [255, 248, 220, 255], sun * 0.55);
  const glow = clamp01(1 - Math.hypot((u - 0.72) * 0.7, (v - 0.22) * 0.9));
  c = mix(c, [255, 236, 186, 255], glow * 0.22);
  let clouds = 0;
  clouds += cloud(u, v, 0.18, 0.22, 0.28, 0.07) * 0.55;
  clouds += cloud(u, v, 0.38, 0.28, 0.22, 0.06) * 0.4;
  clouds += cloud(u, v, 0.08, 0.34, 0.18, 0.05) * 0.35;
  clouds += cloud(u, v, 0.82, 0.58, 0.3, 0.08) * 0.28;
  c = mix(c, [255, 255, 255, 255], clouds);
  const grain = (noise(u * 90, v * 160) - 0.5) * 8;
  return [
    clamp01((c[0] + grain) / 255) * 255,
    clamp01((c[1] + grain) / 255) * 255,
    clamp01((c[2] + grain) / 255) * 255,
    255
  ];
}

function hubSample(u, v) {
  let c = sky(v * 0.92 + 0.04, false);
  c = mix(c, [186, 224, 244, 255], clamp01((v - 0.55) * 1.4) * 0.35);
  const shaft = clamp01(1 - Math.abs(u - 0.5) * 3.2) * clamp01(1 - v * 0.7) * 0.18;
  c = mix(c, [255, 252, 240, 255], shaft);
  let clouds = cloud(u, v, 0.22, 0.16, 0.34, 0.08) * 0.42;
  clouds += cloud(u, v, 0.7, 0.12, 0.26, 0.06) * 0.32;
  return mix(c, [255, 255, 255, 255], clouds);
}

function battleSample(u, v) {
  let c = sky(v, true);
  const corona = clamp01(1 - Math.hypot((u - 0.5) * 1.1, (v - 0.08) * 2.4));
  c = mix(c, [255, 210, 140, 255], corona * 0.45);
  const floor = clamp01((v - 0.62) / 0.38);
  c = mix(c, [36, 74, 118, 255], floor * 0.55);
  return c;
}

function panelSample(u, v) {
  const edge = Math.min(u, v, 1 - u, 1 - v);
  const frame = edge < 0.08 ? 1 : edge < 0.14 ? (0.14 - edge) / 0.06 : 0;
  const base = mix([236, 248, 255, 220], [186, 222, 242, 200], v);
  const gold = [212, 176, 92, 255];
  const line = mix(base, [90, 168, 214, 255], clamp01((0.04 - edge) * 18));
  return mix(line, gold, frame * 0.85);
}

fs.mkdirSync(outDir, { recursive: true });
const files = [
  ['sky-title.png', 720, 1280, titleSample],
  ['sky-hub.png', 720, 1280, hubSample],
  ['sky-battle.png', 720, 1280, battleSample],
  ['panel-frame.png', 192, 192, panelSample]
];
for (const [name, w, h, fn] of files) {
  const size = writePng(path.join(outDir, name), w, h, fn);
  console.log(`${name} ${(size / 1024).toFixed(1)} KiB`);
}
