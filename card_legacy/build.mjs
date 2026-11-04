import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(root, '../card/game');
let html = await fs.readFile(path.join(game, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 2 || !scripts[0][1].includes('var scripts = [') || !scripts[1][1].includes('const RPG =')) {
  throw new Error('Legacy source contract changed; review the standalone builder.');
}

// Read the game's own ordered loader, so new datasets and mechanics reach Legacy
// with the same source as the other editions instead of becoming a frozen copy.
const dependencies = [...scripts[0][1].matchAll(/\{\s*src:\s*'([^']+)'/g)].map(match => match[1]);
if (!dependencies.length || dependencies.some(file => path.basename(file) !== file || !file.endsWith('.js'))) {
  throw new Error('Invalid shared game dependency list.');
}
const inline = code => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
const code = await Promise.all(dependencies.map(file => fs.readFile(path.join(game, file), 'utf8')));
html = html.replace(scripts[0][0], () => inline('window._scriptLoadErrors=[];window._scriptLoadComplete=true;') + '\n' + code.map(inline).join('\n'));

// Local CSS is bundled; the original optional Google font request is removed.
for (const match of [...html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)]) {
  const file = match[1];
  if (file.startsWith('https://fonts.googleapis.com/')) {
    html = html.replace(match[0], '');
  } else if (path.basename(file) === file && file.endsWith('.css')) {
    const css = await fs.readFile(path.join(game, file), 'utf8');
    html = html.replace(match[0], () => `<style>${css}</style>`);
  } else {
    throw new Error(`Unexpected external dependency in legacy source: ${file}`);
  }
}

const fullscreen = html.match(/<button\b[^>]*id="btn-game-fullscreen"[^>]*>[\s\S]*?<\/button>/)?.[0];
if (!fullscreen || !html.includes('<div class="header">Card RPG</div>')) throw new Error('Legacy header contract changed.');
html = html.replace(fullscreen, '');
html = html.replace('<div class="header">Card RPG</div>', () => `<div class="header">Card RPG · Legacy${fullscreen}</div>`);
html = html.replace('<title>Card RPG</title>', '<title>DREAMWEAVER · Legacy</title>');
html = html.replace('<body>', '<body class="legacy">');
const css = await fs.readFile(path.join(root, 'src/legacy.css'), 'utf8');
html = html.replace('</head>', () => `<style>${css}</style>\n</head>`);

const transferEntry = '<button class="menu-btn" type="button" onclick="Legacy.openTransfer()">기록 옮기기</button>';
html = html.replace(/<button\b[^>]*id="btn-title-music"[^>]*>[\s\S]*?<\/button>/, music => music + transferEntry);
html = html.replace('<h3>메뉴</h3>', () => '<h3>메뉴</h3>' + transferEntry);
const transfer = await fs.readFile(path.join(root, 'src/transfer.html'), 'utf8');
const adapter = await fs.readFile(path.join(root, 'src/legacy.js'), 'utf8');
html = html.replace('</body>', () => `${transfer}\n${inline(adapter)}\n</body>`);
if (/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis|\{\{[A-Z_]+\}\}/.test(html)) {
  throw new Error('Unresolved legacy standalone dependency.');
}
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
await fs.writeFile(path.join(root, 'dist/DREAMWEAVER-Legacy.html'), html.replace(/[ \t]+$/gm, ''));
console.log(`DREAMWEAVER Legacy: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB; ${dependencies.length} shared modules. Portraits/audio stay beside the HTML.`);
