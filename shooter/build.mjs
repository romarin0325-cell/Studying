import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareAssets } from './prepare-assets.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const tmpAssets = path.join(root, '.build-assets');
const assetReport = await prepareAssets({ outputDirectory: tmpAssets });

let embeddedAssets = 'globalThis.ASTRAL_EMBEDDED_ASSETS = {\n';
for (const fileInfo of assetReport.output.files) {
  const filePath = path.join(tmpAssets, fileInfo.file);
  const data = await fs.readFile(filePath);
  const b64 = data.toString('base64');
  embeddedAssets += `  "assets/${fileInfo.file}": "data:image/webp;base64,${b64}",\n`;
}
embeddedAssets += '};\n';

// These five local modules are deliberately bundled without resolving parent directories,
// keeping the offline exporter portable in restricted Windows folders as well.
const modules = [
  ['content.js', ['HEROES', 'STAGES', 'DUNGEONS', 'EVENT_DUNGEONS', 'LIMITS', 'clamp']],
  ['meta.js', ['ARTIFACTS','artifactText','DIFFICULTIES','BASE_HEROES','ACHIEVEMENTS','normalizeDifficulty','randomHero','consumeRandom','randomRemaining','dayKey','weekKey','weeklyEvent','dailyHeroes','createProfile','recordDungeonClear','achievementProgress','heroAvailable','unlockHero','claimDungeon','drawArtifact','loadoutStats']],
  ['art-manifest.js', ['createArtUrls']],
  ['learning/data.js',['LEARNING_DATA']], ['learning.js',['LIBRARY','makeQuestion','recordAnswer']], ['menus.js',['CampaignUI']],
  ['engine.js', ['Game']], ['render.js', ['Renderer', 'loadArt', 'BOSS_PRESENTATION']],
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
  .replace('<script type="module" src="app.js"></script>', `<script>${embeddedAssets}globalThis.ASTRAL_ASSET_ROOT='assets';</script><script>${script.replaceAll('</script', '<\\/script')}</script>`);
await fs.mkdir(dist, { recursive: true });
const destination = path.join(dist, 'AstralBloom.html'); await fs.writeFile(destination, html);

await fs.rm(tmpAssets, { recursive: true, force: true });

console.log(`Offline game: ${destination} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB HTML, ${(assetReport.output.bytes / 1024 / 1024).toFixed(2)} MiB WebP assets)`);
