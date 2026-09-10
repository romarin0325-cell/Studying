import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardRoot = path.join(root, '..', 'card');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');
const assetDir = path.join(root, 'assets');

const GAME_SCRIPTS = [
  'data.js', 'vocab_data.js', 'collocation_data.js', 'grammar_data.js',
  'toeic.js', 'toeic_explanations.js', 'api.js', 'logic.js',
  'battle_runtime.js', 'rpg_features.js', 'listening_data.js',
  'fortune_cookie.js', 'music_data.js', 'music_player.js'
];

function dataUrl(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);
  const mime = ext === 'png' ? 'image/png' : ext === 'css' ? 'text/css' : 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function wrapScript(code) {
  return `<script>${code.replaceAll('</script', '<\\/script')}</script>`;
}

let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(srcDir, 'theme.css'), 'utf8');
for (const name of ['sky-title.png', 'sky-hub.png', 'sky-battle.png', 'panel-frame.png']) {
  css = css.replaceAll(`url("${name}")`, `url("${dataUrl(path.join(assetDir, name))}")`);
}
const musicCss = fs.readFileSync(path.join(cardRoot, 'music_player.css'), 'utf8');

html = html
  .replace('<link rel="stylesheet" href="theme.css">', `<style>${css}</style>`)
  .replace('<link rel="stylesheet" href="music_player.css">', `<style>${musicCss}</style>`);

for (const file of ['portraits.js', 'sky.js', 'shell.js']) {
  const code = fs.readFileSync(path.join(srcDir, file), 'utf8');
  html = html.replace(`<script src="${file}"></script>`, wrapScript(code));
}

const modules = GAME_SCRIPTS.map(name => ({
  name,
  code: fs.readFileSync(path.join(cardRoot, name), 'utf8')
}));
const boot = wrapScript(`${modules.map(m => m.code).join('\n;\n')}
window._scriptLoadErrors = [];
window._scriptLoadComplete = true;`);

html = html.replace(
  /<script>\s*window\._scriptLoadErrors = \[\];[\s\S]*?<\/script>/,
  boot
);

fs.mkdirSync(distDir, { recursive: true });
const dest = path.join(distDir, 'AzureArchive.html');
fs.writeFileSync(dest, html);
console.log(`Offline game: ${dest} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB)`);
