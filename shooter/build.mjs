import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareAssets } from './prepare-assets.mjs';
import { createArtUrls } from './art-manifest.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const tmpAssets = path.join(root, '.build-assets');

// 1. Preprocess raw assets into optimized WebPs in an isolated temporary build directory.
const assetReport = await prepareAssets({ outputDirectory: tmpAssets, writeReport: false });

// 2. Build-time integrity & self-checks (Requirement 11).
const manifest = createArtUrls('assets');
const requiredUrls = new Set();
for (const [key, val] of Object.entries(manifest)) {
  if (key === 'urls') continue;
  if (Array.isArray(val)) {
    for (const item of val) requiredUrls.add(item);
  } else if (typeof val === 'string') {
    requiredUrls.add(val);
  }
}

if (assetReport.output.files.length !== 94) {
  throw new Error(`Asset preprocessing mismatch: expected 94 files, got ${assetReport.output.files.length}`);
}
if (requiredUrls.size !== 94) {
  throw new Error(`Manifest mismatch: expected 94 unique URLs, got ${requiredUrls.size}`);
}

const embeddedMap = {};
for (const fileInfo of assetReport.output.files) {
  const normFile = fileInfo.file.replace(/\\/g, '/');
  const logicalPath = `assets/${normFile}`;
  if (!requiredUrls.has(logicalPath)) {
    throw new Error(`Generated asset not present in manifest: ${logicalPath}`);
  }
  const filePath = path.join(tmpAssets, fileInfo.file);
  const data = await fs.readFile(filePath);

  // Validate that the file is strictly WebP format (RIFF....WEBP).
  if (data.length < 12 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`Asset ${normFile} is not a valid WebP image`);
  }

  const b64 = data.toString('base64');
  const dataUrl = `data:image/webp;base64,${b64}`;
  // Store each asset exactly once to avoid redundant payload duplication (Requirement 11).
  embeddedMap[logicalPath] = dataUrl;
}

if (Object.keys(embeddedMap).length !== 94) {
  throw new Error(`Expected exactly 94 embedded assets, but got ${Object.keys(embeddedMap).length}`);
}

for (const url of requiredUrls) {
  if (!embeddedMap[url]) {
    throw new Error(`Missing embedded mapping for required manifest URL: ${url}`);
  }
}

// 3. Serialize embedded asset map.
const embeddedAssetsScript = `globalThis.ASTRAL_EMBEDDED_ASSETS=${JSON.stringify(embeddedMap)};\n`;

// 4. Bundle JavaScript modules.
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

// 5. Assemble single-file HTML document.
let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const css = await fs.readFile(path.join(root, 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="app.js"></script>', `<script>${embeddedAssetsScript}globalThis.ASTRAL_ASSET_ROOT='assets';</script><script>${script.replaceAll('</script', '<\\/script')}</script>`);

// Verify no raw PNG images leaked into the distribution build.
if (html.includes('data:image/png')) {
  throw new Error('Detected unoptimized PNG data URL in distribution HTML');
}

const htmlBytes = Buffer.byteLength(html, 'utf8');
const maxBytes = 20 * 1024 * 1024; // 20 MiB limit
if (htmlBytes >= maxBytes) {
  throw new Error(`Distribution HTML (${(htmlBytes / 1024 / 1024).toFixed(2)} MiB) exceeds the 20 MiB limit!`);
}

// 6. Write final AstralBloom.html and clean up temporary / legacy assets.
await fs.mkdir(dist, { recursive: true });
const destination = path.join(dist, 'AstralBloom.html');
await fs.writeFile(destination, html);

// Remove intermediate build directory.
await fs.rm(tmpAssets, { recursive: true, force: true });

// Ensure legacy dist/assets and dist/asset-report.json are cleaned up from the output directory.
await fs.rm(path.join(dist, 'assets'), { recursive: true, force: true });
await fs.rm(path.join(dist, 'asset-report.json'), { force: true });

console.log(`Offline single-file game: ${destination} (${(htmlBytes / 1024 / 1024).toFixed(2)} MiB HTML, 94 WebP assets embedded)`);
