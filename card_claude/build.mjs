import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const card = path.resolve(root, '../card');
const game = path.join(card, 'game');
const read = name => fs.readFile(path.join(root, name), 'utf8');
// card/game stays the single source of truth for data and rules. Three small
// controller changes are applied here so the shared source is not forked.
function patch(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Card controller contract changed: ${label}`);
  return text.replace(from, () => to);
}
let source = (await fs.readFile(path.join(game, 'index.html'), 'utf8')).replace(/\r\n/g, '\n');
source = patch(source,
  "btn.innerHTML = `덱 편집<br><span id=\"btn-bonus-pool-editor-sub\" style=\"font-size:0.8rem; color:#b3e5fc;\">${set.name} · 추가 ${extras}/15</span>`;",
  "const sub = document.getElementById('btn-bonus-pool-editor-sub');\n                if (sub) sub.textContent = `${set.name} · 추가 ${extras}/15`;\n                else btn.innerHTML = `덱 편집<br><span id=\"btn-bonus-pool-editor-sub\">${set.name} · 추가 ${extras}/15</span>`;",
  'deck editor summary');
source = patch(source,
  "                MODES.forEach(m => {\n                    const btn = document.createElement('button');\n                    btn.className = \"menu-btn\";",
  "                // Presentation layers read names, descriptions and goals from here.\n                this.modeDefinitions = MODES.map(m => ({ ...m }));\n\n                MODES.forEach(m => {\n                    const btn = document.createElement('button');\n                    btn.className = \"menu-btn\";",
  'mode definitions');
source = patch(source,
  `                    this.showDoubleConfirm(
                        \`\${mName} 모드로 시작하시겠습니까?\`,
                        \`정말 시작하시겠습니까?<br>현재 진행 중인 엔드리스 게임 데이터는 초기화됩니다.<br>(게임 시작 시 자동 저장됩니다)\`,
                        () => {
                            if (this.initNewGame(this.selectedModeId) === false) return;
                            modal.classList.remove('active');
                            if (!['factory', 'artifact_reserve', 'perfect_plan'].includes(this.selectedModeId)) {
                                this.toMenu();
                            }
                        }
                    );`,
  `                    const begin = () => {
                        if (this.initNewGame(this.selectedModeId) === false) return;
                        modal.classList.remove('active');
                        if (!['factory', 'artifact_reserve', 'perfect_plan'].includes(this.selectedModeId)) {
                            this.toMenu();
                        }
                    };
                    // Only a run that would actually be overwritten needs a confirmation.
                    if (Storage.loadDetailed(Storage.keys.SAVE).reason === 'missing') return begin();
                    this.showConfirm(
                        \`<b>\${mName}</b> 모드로 새 여정을 시작할까요?<br>저장된 여정은 새 여정으로 덮어씁니다.\`,
                        begin
                    );`,
  'new journey confirmation');
function between(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Card view contract changed: ${start}`);
  return source.slice(a, b);
}
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 2 || !scripts[1][1].includes('const RPG =')) {
  throw new Error('Card controller contract changed; review the card_claude builder.');
}
const dependencies = ['data.js', 'vocab_data.js', 'collocation_data.js', 'grammar_data.js',
  'toeic.js', 'toeic_explanations.js', 'api.js', 'logic.js', 'skill_display.js', 'card_pool_rules.js', 'battle_runtime.js',
  'rpg_features.js', 'card_pool_view.js', 'listening_data.js', 'fortune_cookie.js', 'music_data.js', 'music_player.js'];
const inline = code => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
const code = await Promise.all(dependencies.map(name => fs.readFile(path.join(game, name), 'utf8')));
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const musicCSS = await fs.readFile(path.join(game, 'music_player.css'), 'utf8');
const cardPoolCSS = await fs.readFile(path.join(game, 'card_pool_editor.css'), 'utf8');
// tokens.css defines the themes, legacy.css skins the game's own dialogs, ui.css owns the primary screens.
let theme = '';
for (const file of ['tokens.css', 'legacy.css', 'ui.css']) theme += await read(`src/${file}`) + '\n';
// The only embedded asset is the typeface. Card art stays in the player's own portrait files.
const font = (await fs.readFile(path.join(root, 'assets/dreamsans-subset.woff2'))).toString('base64');
theme = `@font-face { font-family:DreamSans; src:url("data:font/woff2;base64,${font}") format("woff2"); font-style:normal; font-weight:400 900; font-display:swap; }\n` + theme;
const parts = {
  STYLES: `<style>/* Bundled Noto Sans KR subset (DreamSans) license:\n${await fs.readFile(path.join(root, 'assets/NotoSansKR-OFL.txt'), 'utf8')}\n*/\n${css}\n${musicCSS}\n${cardPoolCSS}\n${theme}</style>`,
  OTHER_SCREENS: between('<div id="screen-factory-draft"', '<div id="screen-collection"')
    + between('<div id="screen-chaos-roulette"', '<div id="screen-battle"'),
  MODALS: between('<div id="modal-mode-select"', '<script>')
    + between('<!-- Fortune Cookie Modal -->', '</body>'),
  SCRIPTS: inline('window._scriptLoadErrors=[];window._scriptLoadComplete=true;')
    + code.map(inline).join('\n') + inline(scripts[1][1]) + inline(await read('src/sfx.js')) + inline(await read('src/astra.js'))
};
let html = await read('src/shell.html');
for (const [key, value] of Object.entries(parts)) html = html.replace(`{{${key}}}`, () => value);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved build placeholder');
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
html = html.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
await fs.writeFile(path.join(root, 'dist/DREAMWEAVER-Claude.html'), html);
console.log(`DREAMWEAVER (Claude UI): ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB -> card_claude/dist/DREAMWEAVER-Claude.html`);
