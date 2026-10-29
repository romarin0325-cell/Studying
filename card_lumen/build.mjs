import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.join(root, '../card');
const game = path.join(shared, 'game');
const readShared = name => fs.readFile(path.join(shared, name), 'utf8');
const read = name => fs.readFile(path.join(root, name), 'utf8');
const source = await fs.readFile(path.join(game, 'index.html'), 'utf8');
// card/game stays the single source of truth for rules, data and legacy dialogs.
// The exported file needs no runtime fetch, loader, CDN or ES module.
function between(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Card view contract changed: ${start}`);
  return source.slice(a, b);
}
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 2 || !scripts[1][1].includes('const RPG =')) {
  throw new Error('Card controller contract changed; review the Lumen builder.');
}
const dependencies = ['data.js', 'vocab_data.js', 'collocation_data.js', 'grammar_data.js',
  'toeic.js', 'toeic_explanations.js', 'api.js', 'logic.js', 'skill_display.js', 'card_pool_rules.js', 'battle_runtime.js',
  'rpg_features.js', 'card_pool_view.js', 'listening_data.js', 'fortune_cookie.js', 'music_data.js', 'music_player.js'];
const inline = code => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
const code = await Promise.all(dependencies.map(name => fs.readFile(path.join(game, name), 'utf8')));
const legacyCSS = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const musicCSS = await fs.readFile(path.join(game, 'music_player.css'), 'utf8');
const cardPoolCSS = await fs.readFile(path.join(game, 'card_pool_editor.css'), 'utf8');
let theme = await read('src/lumen.css');

const assetTypes = { '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2' };
const encodeAsset = async file => {
  const mime = assetTypes[path.extname(file)];
  if (!mime || path.basename(file) !== file) throw new Error(`Unsupported inline asset: ${file}`);
  const bytes = await fs.readFile(path.join(root, 'assets', file)).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return fs.readFile(path.join(shared, 'assets', file));
  });
  // Git may check out SVG text with CRLF on Windows; normalize before encoding.
  const stable = mime === 'image/svg+xml' ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;
  return `data:${mime};base64,${stable.toString('base64')}`;
};
const themeCards = {};
for (const [key, file] of [['astra','card-back-lumen.svg'], ['strawberry','magical-card.webp'], ['dreamsky','card-back-lumen.svg']]) {
  themeCards[key] = await encodeAsset(file);
}
for (const [reference, file] of theme.matchAll(/url\("\.\.\/assets\/([^"]+)"\)/g)) {
  theme = theme.replaceAll(reference, `url("${await encodeAsset(file)}")`);
}

// Legacy headings carry emoji and decorative arrows. They are copy only: ids, handlers and
// order stay untouched, and a missing string is skipped so rule edits never block the build.
const copy = [
  ['🥠 오늘의 포춘쿠키', '오늘의 포춘쿠키'], ['📝 해설', '해설'], ['🥠 운세 보기', '운세 보기'],
  ['💡 담화를 듣고 이어지는 질문에 답하세요.', '담화를 듣고 이어지는 질문에 답하세요.'],
  ['🎧 듣기 (재생/일시정지)', '듣기 · 재생/일시정지'], ['📝 문제 풀기 (1/2)', '문제 풀기 (1/2)'],
  ['▶ 다시 듣기', '다시 듣기'], ['💕 루미와의 데이트', '루미와의 데이트'],
  ['📖 지문보기', '지문 보기'], ['📝 문제보기', '문제 보기'], ['↩ 돌아가기', '돌아가기'],
  ['리롤 (새로고침)', '리롤'], ['>실전\n                마법연습<', '>실전 마법연습<']
];
const tidy = html => copy.reduce((text, [from, to]) => text.replaceAll(from, to), html);

const parts = {
  STYLES: `<style>/* Bundled Noto Sans KR font license:\n${await read('assets/NotoSansKR-OFL.txt')}\n*/\n${legacyCSS}\n${musicCSS}\n${cardPoolCSS}\n${theme}</style>`,
  OTHER_SCREENS: tidy(between('<div id="screen-factory-draft"', '<div id="screen-collection"')
    + between('<div id="screen-chaos-roulette"', '<div id="screen-battle"')),
  // The card detail dialog is rebuilt in the shell with the same ids.
  MODALS: tidy(between('<div id="modal-mode-select"', '<script>').replace(between('<div id="modal-card"', '<div id="modal-form-choice"'), '')
    + between('<!-- Fortune Cookie Modal -->', '</body>')),
  SCRIPTS: inline(`window._scriptLoadErrors=[];window._scriptLoadComplete=true;window.DREAMWEAVER_THEME_CARDS=${JSON.stringify(themeCards)};`)
    + code.map(inline).join('\n') + inline(scripts[1][1]) + inline(await readShared('src/astra.js')) + inline(await read('src/lumen.js'))
};
let html = await read('src/shell.html');
for (const [key, value] of Object.entries(parts)) html = html.replace(`{{${key}}}`, () => value);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved build placeholder');
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
html = html.replace(/[ \t]+$/gm, '');
await fs.writeFile(path.join(root, 'dist/DREAMWEAVER-Lumen.html'), html);
console.log(`DREAMWEAVER Lumen: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB. Open dist/DREAMWEAVER-Lumen.html; portraits/audio stay beside the HTML.`);
