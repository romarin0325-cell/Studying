import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// DeepSeek UI comparison build. `card/game` stays the single source of truth for
// data, rules and the controller; this folder owns only presentation.
const root = path.dirname(fileURLToPath(import.meta.url));
const card = path.resolve(root, '../card');
const cardClaude = path.resolve(root, '../card_claude');
const game = path.join(card, 'game');
const read = name => fs.readFile(path.join(root, name), 'utf8');

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

// Local art wins; shared art from card and card_claude may be reused as-is.
const assetRoots = [path.join(root, 'assets'), path.join(card, 'assets'), path.join(cardClaude, 'assets')];
async function assetPath(file) {
  if (path.basename(file) !== file) throw new Error(`Unsupported inline asset path: ${file}`);
  for (const dir of assetRoots) {
    const candidate = path.join(dir, file);
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`Inline asset not found in card_deepseek, card or card_claude: ${file}`);
}
const assetTypes = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};
const assetCache = new Map();
async function encodeAsset(file) {
  if (assetCache.has(file)) return assetCache.get(file);
  const mime = assetTypes[path.extname(file)];
  if (!mime) throw new Error(`Unsupported inline asset type: ${file}`);
  const bytes = await fs.readFile(await assetPath(file));
  // Git may check out SVG text with CRLF on Windows; normalize before encoding.
  const stable = mime === 'image/svg+xml' ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;
  const encoded = `data:${mime};base64,${stable.toString('base64')}`;
  assetCache.set(file, encoded);
  return encoded;
}
async function inlineCssAssets(text) {
  let out = text;
  for (const match of [...text.matchAll(/url\("\.\.\/assets\/([^"]+)"\)/g)]) {
    out = out.replaceAll(match[0], `url("${await encodeAsset(match[1])}")`);
  }
  return out;
}

const source = await fs.readFile(path.join(game, 'index.html'), 'utf8');
function between(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Card view contract changed: ${start}`);
  return source.slice(a, b);
}
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 2 || !scripts[1][1].includes('const RPG =')) {
  throw new Error('Card controller contract changed; review the DeepSeek builder.');
}
const dependencies = ['data.js', 'vocab_data.js', 'collocation_data.js', 'grammar_data.js',
  'toeic.js', 'toeic_explanations.js', 'api.js', 'logic.js', 'skill_display.js', 'card_pool_rules.js', 'battle_runtime.js',
  'rpg_features.js', 'card_pool_view.js', 'listening_data.js', 'fortune_cookie.js', 'music_data.js', 'music_player.js'];
const inline = code => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
const code = await Promise.all(dependencies.map(name => fs.readFile(path.join(game, name), 'utf8')));
const baseCss = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const musicCSS = await fs.readFile(path.join(game, 'music_player.css'), 'utf8');
const cardPoolCSS = await fs.readFile(path.join(game, 'card_pool_editor.css'), 'utf8');

// Shared Astra layout mechanics stay untouched; card/src/themes.css is replaced by
// the DeepSeek palette layer so light-theme !important rules cannot leak through.
let inherited = '';
for (const file of ['astra.css', 'mobile.css', 'polish.css']) inherited += await read(`../card/src/${file}`) + '\n';
const design = await inlineCssAssets(await read('src/deepseek.css'));
const font = await encodeAsset('dreamsans-subset.woff2');

const themeCards = {
  astra: await encodeAsset('card-back-astra.svg'),
  strawberry: await encodeAsset('card-back-strawberry.svg'),
  dreamsky: await encodeAsset('card-back-dreamsky.svg')
};

const parts = {
  STYLES: `<style>/* Bundled Noto Sans KR subset (Synapse Sans) license:\n${await fs.readFile(path.join(cardClaude, 'assets/NotoSansKR-OFL.txt'), 'utf8')}\n*/\n`
    + `@font-face{font-family:SynapseSans;src:url("${font}") format("woff2");font-style:normal;font-weight:400 900;font-display:swap;}\n`
    + `${baseCss}\n${musicCSS}\n${cardPoolCSS}\n${inherited}\n${design}</style>`,
  OTHER_SCREENS: between('<div id="screen-factory-draft"', '<div id="screen-collection"')
    + between('<div id="screen-chaos-roulette"', '<div id="screen-battle"'),
  MODALS: between('<div id="modal-mode-select"', '<script>')
    + between('<!-- Fortune Cookie Modal -->', '</body>'),
  SCRIPTS: inline(`window._scriptLoadErrors=[];window._scriptLoadComplete=true;window.DREAMWEAVER_THEME_CARDS=${JSON.stringify(themeCards)};window.DS_EDITION={name:'DeepSeek',ui:'Synapse'};`)
    + code.map(inline).join('\n') + inline(scripts[1][1]) + inline(await read('../card/src/astra.js')) + inline(await read('src/deepseek.js'))
};
let html = await read('src/shell.html');
for (const [key, value] of Object.entries(parts)) {
  if (!html.includes(`{{${key}}}`)) throw new Error(`Shell placeholder missing: ${key}`);
  html = html.replace(`{{${key}}}`, () => value);
}
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved build placeholder');
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
html = html.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
await fs.writeFile(path.join(root, 'dist/DREAMWEAVER-DeepSeek.html'), html);
console.log(`DREAMWEAVER (Synapse / DeepSeek): ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB -> card_deepseek/dist/DREAMWEAVER-DeepSeek.html`);
