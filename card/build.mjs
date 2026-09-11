import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const game = path.join(root, 'game');
const read = name => fs.readFile(path.join(root, name), 'utf8');
const source = await fs.readFile(path.join(game, 'index.html'), 'utf8');
// The original data and mechanics remain the single source of truth. No runtime
// fetch, dynamic loader, CDN or ES module is required by the exported file.
function between(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Card view contract changed: ${start}`);
  return source.slice(a, b);
}
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 2 || !scripts[1][1].includes('const RPG =')) {
  throw new Error('Card controller contract changed; review the DREAMWEAVER builder.');
}
const dependencies = ['data.js', 'vocab_data.js', 'collocation_data.js', 'grammar_data.js',
  'toeic.js', 'toeic_explanations.js', 'api.js', 'logic.js', 'battle_runtime.js',
  'rpg_features.js', 'listening_data.js', 'fortune_cookie.js', 'music_data.js', 'music_player.js'];
const inline = code => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
const code = await Promise.all(dependencies.map(name => fs.readFile(path.join(game, name), 'utf8')));
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const musicCSS = await fs.readFile(path.join(game, 'music_player.css'), 'utf8');
let theme = await read('src/astra.css');
const art = await fs.readFile(path.join(root, 'assets/observatory.png'));
theme = theme.replaceAll('url("../assets/observatory.png")', `url("data:image/png;base64,${art.toString('base64')}")`);
const parts = {
  STYLES: `<style>${css}\n${musicCSS}\n${theme}</style>`,
  OTHER_SCREENS: between('<div id="screen-factory-draft"', '<div id="screen-collection"')
    + between('<div id="screen-chaos-roulette"', '<div id="screen-battle"'),
  MODALS: between('<div id="modal-mode-select"', '<script>')
    + between('<!-- Fortune Cookie Modal -->', '</body>'),
  SCRIPTS: inline('window._scriptLoadErrors=[];window._scriptLoadComplete=true;')
    + code.map(inline).join('\n') + inline(scripts[1][1]) + inline(await read('src/astra.js'))
};
let html = await read('src/shell.html');
for (const [key, value] of Object.entries(parts)) html = html.replace(`{{${key}}}`, () => value);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved build placeholder');
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
html = html.replace(/[ \t]+$/gm, '');
await fs.writeFile(path.join(root, 'dist/DREAMWEAVER.html'), html);
console.log(`DREAMWEAVER: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB. Open dist/DREAMWEAVER.html; portraits/audio stay beside the HTML.`);
