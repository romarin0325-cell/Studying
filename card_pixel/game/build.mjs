// Builds one offline RELAYMARE page. Run: node card_pixel/game/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { coreBundle } from './tools/core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const read = file => fs.readFileSync(path.join(here, file), 'utf8');
const inline = code => '<script>' + code.replace(/<\/script/gi, '<\\/script') + '</script>';

const meta = JSON.parse(read('assets/sprites.json'));
const pngUrl = file => 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
const sp = {};
for (const [file, m] of Object.entries(meta)) {
  sp[file.replace('.png', '')] = { src: pngUrl(path.join(here, 'assets', file)), w: m.width, h: m.height, cx: m.bodyCenterX, fy: m.feetBaselineY, facing: m.facing, kind: m.kind };
}

function pngDirectory(name) {
  const directory = path.join(here, 'assets', name);
  return Object.fromEntries(fs.readdirSync(directory).filter(file => file.endsWith('.png')).sort().map(file =>
    [path.basename(file, '.png'), pngUrl(path.join(directory, file))]
  ));
}

const bg = pngDirectory('backgrounds');
const icons = pngDirectory('icons');

const { outputFiles: [bundle] } = await build({
  entryPoints: [path.join(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false
});
const css = ['base', 'battle', 'screens', 'meta'].map(name => read(`src/styles/${name}.css`)).join('\n');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>다음은 너 — RELAYMARE</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css">
<style>${css}</style></head>
<body><div id="app"></div>
${inline('window.RELAY_ASSETS=' + JSON.stringify({ sp, bg, icons }) + ';')}
${inline(coreBundle(repo))}
${inline(bundle.text)}
</body></html>
`;
fs.mkdirSync(path.join(here, 'dist'), { recursive: true });
fs.writeFileSync(path.join(here, 'dist/Relaymare.html'), html);
console.log('Relaymare.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB', 'sprites', Object.keys(sp).length);
