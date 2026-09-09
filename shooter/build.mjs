import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const assets = {};
for (const name of ['heroes', 'bosses', 'enemies', 'worlds']) {
  const ext = name === 'worlds' ? 'jpg' : 'png';
  assets[name] = `data:image/${ext === 'jpg' ? 'jpeg' : 'png'};base64,${(await fs.readFile(path.join(root, 'assets', `${name}.${ext}`))).toString('base64')}`;
}
// These five local modules are deliberately bundled without resolving parent directories,
// keeping the offline exporter portable in restricted Windows folders as well.
const modules = [
  ['content.js', ['HEROES', 'STAGES', 'UPGRADES', 'LIMITS', 'clamp']],
  ['engine.js', ['Game']], ['render.js', ['Renderer', 'loadArt']],
  ['audio.js', ['AudioDirector']], ['app.js', []]
];
let script = '(() => {\n"use strict";\n';
for (const [file, names] of modules) {
  const code = (await fs.readFile(path.join(root, file), 'utf8'))
    .replace(/^import .+ from ['"].+['"];\r?\n/gm, '')
    .replace(/^export /gm, '');
  script += names.length ? `const {${names.join(',')}} = (() => {\n${code}\nreturn {${names.join(',')}};})();\n` : `(() => {\n${code}\n})();\n`;
}
script += '})();';
let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const css = await fs.readFile(path.join(root, 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="app.js"></script>', `<script>globalThis.ASTRAL_ASSETS=${JSON.stringify(assets)};</script><script>${script.replaceAll('</script', '<\\/script')}</script>`);
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
const destination = path.join(root, 'dist', 'AstralBloom.html'); await fs.writeFile(destination, html);
console.log(`Offline game: ${destination} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB)`);
