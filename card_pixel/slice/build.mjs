// Builds card_pixel/slice/dist/RelaySlice.html: one offline page with the card game's rule files,
// the bridge, the pixel stage and the sprites inlined. Run: node card_pixel/slice/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreBundle } from './tools/core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const read = file => fs.readFileSync(path.join(here, file), 'utf8');
const inline = code => '<script>' + code.replace(/<\/script/gi, '<\\/script') + '</script>';

const meta = JSON.parse(read('assets/sprites.json'));
const sp = {};
for (const [file, m] of Object.entries(meta)) {
  const png = fs.readFileSync(path.join(here, 'assets', file));
  sp[file.replace('.png', '')] = { src: 'data:image/png;base64,' + png.toString('base64'), w: m.width, h: m.height, cx: m.bodyCenterX, fy: m.feetBaselineY, facing: m.facing, kind: m.kind };
}

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>다음은 너 — 도트 릴레이 시험판</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css">
<style>${read('src/style.css')}</style></head>
<body><div id="app"></div>
${inline('window.RELAY_ASSETS=' + JSON.stringify({ sp }) + ';')}
${inline(coreBundle(repo))}
${['bridge.js', 'roster.js', 'run.js', 'stage.js', 'game.js'].map(file => inline(read('src/' + file))).join('\n')}
</body></html>
`;
fs.mkdirSync(path.join(here, 'dist'), { recursive: true });
fs.writeFileSync(path.join(here, 'dist/RelaySlice.html'), html);
console.log('RelaySlice.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB', 'sprites', Object.keys(sp).length);
