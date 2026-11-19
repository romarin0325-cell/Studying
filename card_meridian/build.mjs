import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.join(root, '../card');
const astra = path.join(root, '../card_astra');
const game = path.join(shared, 'game');
const readShared = name => fs.readFile(path.join(shared, name), 'utf8');
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
// Use the same ordered manifest as the original UI, including future datasets.
const dependencies = [...scripts[0][1].matchAll(/\{\s*src:\s*'([^']+)'/g)].map(match => match[1]);
if (!dependencies.length || dependencies.some(file => path.basename(file) !== file || !file.endsWith('.js'))) {
  throw new Error('Invalid shared game dependency list.');
}
const inline = code => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
const code = await Promise.all(dependencies.map(name => fs.readFile(path.join(game, name), 'utf8')));
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const musicCSS = await fs.readFile(path.join(game, 'music_player.css'), 'utf8');
const cardPoolCSS = await fs.readFile(path.join(game, 'card_pool_editor.css'), 'utf8');
const chainCSS = await fs.readFile(path.join(game, 'chain_challenge.css'), 'utf8');
let theme = (await Promise.all([
  ...['astra.css', 'mobile.css', 'themes.css', 'polish.css'].map(name => readShared('src/' + name)),
  fs.readFile(path.join(astra, 'src/edition.css'), 'utf8'), read('src/meridian.css')
])).join('\n');
// Replace the decorative Jua face with the local, licensed variable body face.
theme = theme.replace(/@font-face\s*\{[^}]*DreamJua[^}]*\}/g, '');
const themeCards = {};
const assetTypes = {'.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.webp':'image/webp','.woff2':'font/woff2'};
const encodeAsset = async file => {
  file = ({'observatory.png':'observatory.webp','magical-sanctuary.png':'magical-sanctuary.webp','magical-card.png':'magical-card.webp'})[file] || file;
  const mime = assetTypes[path.extname(file)];
  if (!mime || path.basename(file) !== file) throw new Error(`Unsupported inline asset: ${file}`);
  let bytes;
  for (const base of [root, astra, shared]) {
    try { bytes = await fs.readFile(path.join(base, 'assets', file)); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!bytes) throw new Error('Missing art: ' + file);
  // Git may check out SVG text with CRLF on Windows; normalize before encoding.
  const stableBytes = mime === 'image/svg+xml' ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;
  return `data:${mime};base64,${stableBytes.toString('base64')}`;
};
for (const [key,file] of [['astra','passage-back.svg'],['strawberry','magical-card.png'],['dreamsky','dreamsky-card.svg']]) themeCards[key] = await encodeAsset(file);
for (const [reference,file] of theme.matchAll(/url\("\.\.\/assets\/([^"]+)"\)/g)) {
  theme = theme.replaceAll(reference, `url("${await encodeAsset(file)}")`);
}
// The portable build includes locally available card drawings. Only resized
// derivatives enter the HTML. A checkout without the optional art folder can
// still load full-size portraits beside the HTML or from the player's folder.
const artDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(root, '../../일러스트');
const files = await fs.readdir(artDir).catch(error => {
  if (!process.argv[2] && error.code === 'ENOENT') return [];
  throw error;
});
const portraits = {};
for (const file of files.filter(name => /\.png$/i.test(name)).sort()) {
  const bytes = await sharp(path.join(artDir, file)).rotate().resize({
    width: 408, height: 680, fit: 'inside', withoutEnlargement: true
  }).webp({ quality: 79, effort: 3 }).toBuffer();
  portraits[file.normalize('NFC')] = 'data:image/webp;base64,' + bytes.toString('base64');
}
const parts = {
  STYLES: `<style>/* Bundled Noto Sans KR font license:\n${await fs.readFile(path.join(astra, 'assets/NotoSansKR-OFL.txt'), 'utf8')}\n*/\n${css}\n${musicCSS}\n${cardPoolCSS}\n${chainCSS}\n${theme}</style>`,
  OTHER_SCREENS: between('<div id="screen-factory-draft"', '<div id="screen-collection"')
    + between('<div id="screen-chaos-roulette"', '<div id="screen-battle"'),
  MODALS: between('<div id="modal-type-select"', '<script>')
    .replace(between('<div id="modal-card"', '<div id="modal-form-choice"'), '')
    .replace(between('<div id="modal-type-select"', '<div id="modal-mission-hub"'), '')
    .replace(between('<div id="modal-gacha"', '<div id="modal-library"'), '')
    + between('<!-- Fortune Cookie Modal -->', '</body>'),
  SCRIPTS: inline(`window._scriptLoadErrors=[];window._scriptLoadComplete=true;window.DREAMWEAVER_THEME_CARDS=${JSON.stringify(themeCards)};`)
    + inline('window.MERIDIAN_PORTRAITS=' + JSON.stringify(portraits) + ';')
    + code.map(inline).join('\n') + inline(scripts[1][1]) + inline(await read('src/interface.js'))
    + inline(await read('src/catalog.js')) + inline(await read('src/journey.js'))
};
let html = await read('src/shell.html');
for (const [key, value] of Object.entries(parts)) html = html.replace(`{{${key}}}`, () => value);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved build placeholder');
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
html = html.replace(/[ \t]+$/gm, '');
await fs.writeFile(path.join(root, 'dist/DREAMWEAVER-Meridian.html'), html);
console.log(`DREAMWEAVER · 새벽 항로 (${Object.keys(portraits).length} portraits, ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB)`);
