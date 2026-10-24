// Build an offline ultimate/attack review page and paint contact sheets with the
// production renderer. Output stays in defense/test-results/ult-sheet (gitignored).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {assetFile} from './local-inputs.mjs';

const started = Date.now();
const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(game, 'test-results', 'ult-sheet');
const progressPath = path.join(outDir, 'progress.log');
await fsp.mkdir(outDir, {recursive: true});
fs.writeFileSync(progressPath, '');

function progress(line) {
  const text = `[${((Date.now() - started) / 1000).toFixed(1)}s] ${line}`;
  fs.appendFileSync(progressPath, text + '\n');
  console.log(text);
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  throw new Error('Unknown image type ' + file);
}

function escapeScript(text) {
  return text.replace(/<\/script/gi, '<\\/script');
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[ch]));
}

const CELL_W = 240;
const LABEL_W = 248;
const GAP = 4;
const cellH = cellW => Math.round(780 * cellW / 720);
const sheetW = (count, cellW) => LABEL_W + count * (cellW + GAP) + GAP;

async function loadImages() {
  const images = {};
  let bytes = 0;
  for (const [id, relative] of Object.entries(RUNTIME_ASSET_PATHS)) {
    const file = assetFile(relative);
    const data = await fsp.readFile(file);
    images[id] = `data:${mime(file)};base64,${data.toString('base64')}`;
    bytes += data.length;
  }
  const bright = assetFile('./assets/bright/garden.webp');
  const brightBytes = await fsp.readFile(bright);
  images['bright-garden'] = `data:${mime(bright)};base64,${brightBytes.toString('base64')}`;
  bytes += brightBytes.length;
  return {images, bytes, count: Object.keys(images).length};
}

function pageHtml() {
  return `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>별빛 정원 · 필살기 문양 시트</title>
<style>
*{box-sizing:border-box}
body{margin:0;color:#e8e4f2;background:#15151e;font:15px/1.55 "Malgun Gothic",system-ui,sans-serif}
main{max-width:1280px;margin:auto;padding:22px 16px 72px}
h1{font-size:24px;margin:0 0 8px;letter-spacing:-.4px}
h2{font-size:18px;margin:28px 0 8px}
p{margin:6px 0 12px}
.muted{color:#b6b0c7}
.warn{border-left:3px solid #c19d64;padding:8px 12px;background:#211f2a;color:#f3e6c8}
.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 0 14px}
label{display:flex;align-items:center;gap:6px}
select,button{color:#ede8f6;background:#2e2b3b;border:1px solid #615873;border-radius:8px;font:inherit;padding:8px 11px;min-height:42px}
button{cursor:pointer}
button:hover{background:#494052}
input[type=checkbox]{accent-color:#d9b979;width:18px;height:18px}
.stage{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.stage figure{margin:0;min-width:0}
.stage figcaption{margin:0 0 6px;color:#d9d0c2;min-height:2.6em}
canvas{display:block;width:100%;height:auto;border-radius:12px;background:#1c2632}
.timeline{display:flex;align-items:center;gap:12px;margin:14px 0}
input[type=range]{flex:1;min-width:120px;accent-color:#e6bc78}
#clock{font-variant-numeric:tabular-nums;min-width:64px}
#grid-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
#grid-board figure{margin:0}
#grid-board img{display:block;width:100%;height:auto;border-radius:8px;background:#1c2632}
#grid-board figcaption{font-size:12px;color:#d9d0c2}
#shared-motifs{white-space:pre-wrap;background:#12121a;border-radius:10px;padding:12px;overflow:auto;color:#f3e6c8;font:13px/1.45 ui-monospace,monospace}
@media(max-width:800px){
  main{padding:16px 12px 48px}
  h1{font-size:21px}
  .stage{grid-template-columns:minmax(0,1fr)}
  .timeline{flex-wrap:wrap}
}
</style>
<main>
<h1>별빛 정원 · 필살기와 일반 공격</h1>
<p class="warn">이 도구가 확인하지 않는 것: 소리(audio), 컷인 DOM 띠(cut-in DOM band), 실제 기기 FPS(real device FPS). 전장은 실제 전투 렌더러가 그립니다. 같은 문양(atlas+frame)을 여러 동료의 필살기가 쓰면 아래 표에 모입니다.</p>
<p class="muted">두 전장을 나란히 두고 같은 시각을 재생합니다. 접촉 시트 PNG는 이 파일과 같은 폴더에 있습니다. 밤·맑음·새벽은 0장 정원, 밝은 정원, 45장 새벽입니다.</p>
<section>
<div class="controls">
<label>A <select id="hero-a" aria-label="동료 A"></select></label>
<label>B <select id="hero-b" aria-label="동료 B"></select></label>
<select id="mode" aria-label="공격 종류"><option value="attack">일반 공격</option><option value="skill" selected>필살기</option></select>
<select id="theme" aria-label="배경"><option value="night" selected>밤</option><option value="bright">맑음</option><option value="dawn">새벽</option></select>
<select id="speed" aria-label="재생 속도"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option></select>
<label><input id="dense" type="checkbox" checked>적 분산</label>
<label><input id="reduced" type="checkbox">동작 줄이기</label>
</div>
<div class="stage">
<figure><figcaption id="cap-a">A</figcaption><canvas id="board-a" width="720" height="780" aria-label="동료 A 전장"></canvas></figure>
<figure><figcaption id="cap-b">B</figcaption><canvas id="board-b" width="720" height="780" aria-label="동료 B 전장"></canvas></figure>
</div>
<div class="timeline">
<button id="play" type="button">일시정지</button>
<button id="restart" type="button">처음부터</button>
<input id="seek" type="range" min="0" max="3" step="0.0166667" value="0" aria-label="재생 시각">
<output id="clock">0.00초</output>
</div>
</section>
<section>
<h2>같은 시각의 39명</h2>
<p class="muted">위 슬라이더의 시각으로 39명을 한 번에 그립니다. 재생 중에도 선택한 모드·배경·적 배치를 따릅니다.</p>
<button id="grid-go" type="button">이 시각으로 모두 그리기</button>
<p id="grid-status" class="muted"></p>
<div id="grid-board"></div>
</section>
<h2>같은 문양</h2>
<pre id="shared-motifs">@@MOTIFS@@</pre>
</main>
<script>/*__DATA__*/</script>
<script type="module">/*__SCRIPT__*/</script>
</html>
`;
}

async function stitch(buffers, file) {
  const metas = await Promise.all(buffers.map(buf => sharp(buf).metadata()));
  const width = metas[0].width;
  for (const meta of metas) {
    if (meta.width !== width) throw new Error(`Sheet width ${meta.width} does not match ${width}`);
  }
  const height = metas.reduce((sum, meta) => sum + meta.height, 0);
  let top = 0;
  const layers = buffers.map((input, index) => {
    const layer = {input, top, left: 0};
    top += metas[index].height;
    return layer;
  });
  await sharp({
    create: {width, height, channels: 4, background: {r: 12, g: 12, b: 18, alpha: 1}},
    limitInputPixels: false,
  }).composite(layers).png({compressionLevel: 6}).toFile(file);
  return {width, height, bytes: (await fsp.stat(file)).size};
}

async function regionStdev(file, left, top, width, height) {
  const {data, info} = await sharp(file, {limitInputPixels: false}).extract({left, top, width, height}).raw().toBuffer({resolveWithObject: true});
  const ch = info.channels;
  let n = 0, sum = 0, sum2 = 0;
  const pixels = width * height;
  const stride = Math.max(1, Math.floor(pixels / 4000));
  for (let p = 0; p < pixels; p += stride) {
    const i = p * ch;
    const y = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    sum += y;
    sum2 += y * y;
    n += 1;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sum2 / n - mean * mean));
}

function table(shared, names) {
  const rows = shared.map(group => ({
    atlas: group.atlas,
    frame: String(group.frame),
    heroes: String(group.heroes.length),
    maxWidth: group.maxWidth.toFixed(2),
    calls: String(group.calls),
    companions: group.heroes.map(id => `${id} ${names[id] || ''}`).join(', '),
  }));
  const header = {atlas: 'atlas', frame: 'frame', heroes: 'heroes', maxWidth: 'maxWidth', calls: 'calls', companions: 'companions'};
  const cols = ['atlas', 'frame', 'heroes', 'maxWidth', 'calls'];
  const width = {};
  for (const col of cols) width[col] = Math.max(header[col].length, ...rows.map(row => row[col].length));
  const line = row => cols.map(col => row[col].padEnd(width[col])).join('  ') + '  ' + row.companions;
  return [line(header), ...rows.map(line)].join('\n');
}

try {
  const {images, bytes, count} = await loadImages();
  progress(`textures ${count} files, ${bytes} bytes`);
  if (!images['bright-garden'] || !images.garden || !images.ultimates || !images.effects) {
    throw new Error('Battle atlases did not load');
  }
  const bundle = await build({
    entryPoints: [path.join(game, 'scripts', 'ult-sheet-view.js')],
    bundle: true,
    write: false,
    format: 'esm',
    target: ['es2022'],
    charset: 'utf8',
    legalComments: 'none',
  });
  const htmlPath = path.join(outDir, 'index.html');
  let html = pageHtml()
    .replace('/*__DATA__*/', () => escapeScript(`window.ULT_DATA=${JSON.stringify({images})};`))
    .replace('/*__SCRIPT__*/', () => escapeScript(bundle.outputFiles[0].text));
  await fsp.writeFile(htmlPath, html);
  progress(`wrote ${htmlPath} (${Buffer.byteLength(html)} bytes)`);

  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext({viewport: {width: 1400, height: 900}, deviceScaleFactor: 1});
  const page = await context.newPage();
  const pageErrors = [];
  page.setDefaultTimeout(180000);
  page.on('pageerror', error => {pageErrors.push(error.message); progress('PAGEERROR ' + error.message);});
  page.on('console', msg => {if (msg.type() === 'error') {pageErrors.push(msg.text()); progress('CONSOLE ' + msg.text());}});
  await page.route('**/*', route => /^https?:/.test(route.request().url()) ? route.abort() : route.continue());
  await page.goto(pathToFileURL(htmlPath).href, {waitUntil: 'load', timeout: 180000});
  await page.waitForFunction(() => window.ULT_SHEET && window.ULT_SHEET.ready, null, {timeout: 180000});
  await page.evaluate(() => window.ULT_SHEET.hold(true));
  const ready = await page.evaluate(() => ({images: window.ULT_SHEET.images, heroes: window.ULT_SHEET.heroes}));
  if (ready.images !== count) throw new Error(`Page loaded ${ready.images} images, expected ${count}`);
  if (ready.heroes.length !== 39) throw new Error(`Expected 39 companions, found ${ready.heroes.length}`);
  progress(`viewer ready, ${ready.heroes.length} companions`);

  const headers = await page.evaluate(() => window.ULT_SHEET.headers());
  const ultHeader = Buffer.from(headers.ult, 'base64');
  const attackHeader = Buffer.from(headers.attack, 'base64');
  const ultRows = [];
  const attackRows = [];
  const results = [];
  for (const hero of ready.heroes) {
    const row = await page.evaluate(id => window.ULT_SHEET.capture(id), hero.id);
    const close = Buffer.from(row.close, 'base64');
    const ult = Buffer.from(row.ult, 'base64');
    const attack = Buffer.from(row.attack, 'base64');
    if (close.length < 1000 || ult.length < 1000 || attack.length < 500) throw new Error(hero.id + ' returned an empty sheet');
    if (results.length === 0) {
      const meta = await sharp(close).metadata();
      if (meta.width !== sheetW(6, 360) || meta.height !== 32 + cellH(360)) {
        throw new Error(`Close sheet is ${meta.width}x${meta.height}, expected ${sheetW(6, 360)}x${32 + cellH(360)}`);
      }
    }
    const closePath = path.join(outDir, `ult-${hero.id}.png`);
    await fsp.writeFile(closePath, close);
    ultRows.push(ult);
    attackRows.push(attack);
    const top = row.motifs?.[0];
    results.push({
      id: hero.id,
      name: hero.name,
      rarity: hero.rarity,
      skill: hero.skill,
      type: hero.type,
      error: row.error,
      attackError: row.attackError,
      tweaked: row.tweaked,
      variance: row.variance,
      attackVariance: row.attackVariance,
      motifs: row.motifs || [],
    });
    progress(`${hero.id} skillVar=${Number(row.variance).toFixed(1)} attackVar=${Number(row.attackVariance).toFixed(1)} motifs=${(row.motifs || []).length} top=${top ? top.atlas + '#' + top.frame + '@' + top.maxWidth : '-'} tweak=${row.tweaked || '-'} err=${row.error || row.attackError || '-'}`);
  }

  const ultAll = path.join(outDir, 'ult-all.png');
  const attackAll = path.join(outDir, 'attack-all.png');
  const ultMeta = await stitch([ultHeader, ...ultRows], ultAll);
  const attackMeta = await stitch([attackHeader, ...attackRows], attackAll);
  progress(`stitched ult-all ${ultMeta.width}x${ultMeta.height} attack-all ${attackMeta.width}x${attackMeta.height}`);

  const expectedUltW = sheetW(6, CELL_W);
  const expectedAttackW = sheetW(3, CELL_W);
  const expectedCloseW = sheetW(6, 360);
  if (ultMeta.width !== expectedUltW || attackMeta.width !== expectedAttackW) {
    throw new Error(`Unexpected sheet width ult ${ultMeta.width} attack ${attackMeta.width}`);
  }
  const rowH = cellH(CELL_W) + GAP;
  const blanks = [];
  for (const [index, hero] of results.entries()) {
    if (hero.error) continue;
    const stdev = await regionStdev(ultAll, LABEL_W + GAP, 32 + index * rowH, CELL_W, cellH(CELL_W));
    hero.fileStdev = Math.round(stdev * 10) / 10;
    if (stdev < 4) blanks.push(`${hero.id} ult cell stdev ${stdev.toFixed(2)}`);
    const closeStdev = await regionStdev(path.join(outDir, `ult-${hero.id}.png`), LABEL_W + GAP, 32, 360, cellH(360));
    if (closeStdev < 4) blanks.push(`${hero.id} close cell stdev ${closeStdev.toFixed(2)}`);
  }
  for (const [index, hero] of results.entries()) {
    if (hero.attackError) continue;
    const stdev = await regionStdev(attackAll, LABEL_W + GAP, 32 + index * rowH, CELL_W, cellH(CELL_W));
    if (stdev < 4) blanks.push(`${hero.id} attack cell stdev ${stdev.toFixed(2)}`);
  }
  if (blanks.length) progress('BLANK ' + blanks.join(' | '));

  progress('smoke start');
  const samples = await page.evaluate(() => {
    const cases = [
      {heroA: 'toffee_apple', heroB: 'ash', mode: 'skill', theme: 'night', dense: true, reduced: false, speed: 1, t: 0.5},
      {heroA: 'queen', heroB: 'cherry_prince', mode: 'skill', theme: 'bright', dense: true, reduced: false, speed: 0.5, t: 1.2},
      {heroA: 'storm_sage', heroB: 'zeke', mode: 'attack', theme: 'dawn', dense: false, reduced: true, speed: 0.25, t: 0.25},
    ];
    return cases.map(item => {
      const {t, ...patch} = item;
      window.ULT_SHEET.select(patch);
      window.ULT_SHEET.seek(t);
      return window.ULT_SHEET.sample();
    });
  });
  await page.evaluate(() => {
    window.ULT_SHEET.select({heroA: 'luna', heroB: 'phantom', mode: 'skill', theme: 'night', dense: true, reduced: false, speed: 1});
    window.ULT_SHEET.seek(0.3);
  });
  const grid = await page.evaluate(() => window.ULT_SHEET.renderGrid());
  const layout = {};
  for (const width of [1400, 390]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 900});
    layout[width] = await page.evaluate(() => {
      const box = id => {const r = document.getElementById(id).getBoundingClientRect(); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};};
      return {a: box('board-a'), b: box('board-b')};
    });
  }
  await page.setViewportSize({width: 1400, height: 900});
  await page.evaluate(() => window.ULT_SHEET.hold(false));
  const beforePlay = await page.evaluate(() => window.ULT_SHEET.sample().time);
  await page.click('#play');
  await page.waitForTimeout(600);
  const duringPlay = await page.evaluate(() => window.ULT_SHEET.sample().time);
  await page.click('#play');
  await page.evaluate(() => window.ULT_SHEET.hold(true));
  await browser.close();
  progress(`smoke done play ${beforePlay.toFixed(2)} -> ${duringPlay.toFixed(2)} grid ${grid.n}`);

  const names = Object.fromEntries(results.map(hero => [hero.id, hero.name]));
  const groups = new Map();
  for (const hero of results) {
    if (hero.error) continue;
    for (const motif of hero.motifs) {
      const key = motif.atlas + '\0' + motif.frame;
      let group = groups.get(key);
      if (!group) {
        group = {atlas: motif.atlas, frame: motif.frame, heroes: [], maxWidth: 0, calls: 0};
        groups.set(key, group);
      }
      group.heroes.push(hero.id);
      group.maxWidth = Math.max(group.maxWidth, motif.maxWidth);
      group.calls += motif.calls;
    }
  }
  const shared = [...groups.values()]
    .filter(group => group.heroes.length > 1)
    .sort((a, b) => b.heroes.length - a.heroes.length || b.maxWidth - a.maxWidth || a.atlas.localeCompare(b.atlas) || a.frame - b.frame);
  const codeOnly = results.filter(hero => !hero.error && hero.motifs.length === 0);
  const failures = results.filter(hero => hero.error || hero.attackError);
  const tweaks = results.filter(hero => hero.tweaked);
  const motifs = {};
  for (const hero of results) motifs[hero.id] = hero.motifs;
  await fsp.writeFile(path.join(outDir, 'motifs.json'), JSON.stringify(motifs, null, 2) + '\n');

  const lines = [];
  lines.push('SHARED MOTIFS');
  lines.push(shared.length ? table(shared, names) : '(none)');
  lines.push('');
  lines.push('CODE-ONLY ULTIMATES');
  lines.push(codeOnly.length ? codeOnly.map(hero => `${hero.id}  ${hero.name}  ${hero.type}`).join('\n') : '(none)');
  lines.push('');
  lines.push('CAST FAILURES');
  lines.push(failures.length ? failures.map(hero => `${hero.id}  skill=${hero.error || '-'}  attack=${hero.attackError || '-'}`).join('\n') : '(none)');
  lines.push('');
  lines.push('FIXTURE TWEAKS');
  lines.push(tweaks.length ? tweaks.map(hero => `${hero.id}  ${hero.tweaked}`).join('\n') : '(none)');
  lines.push('');
  lines.push('BLANK CELLS');
  lines.push(blanks.length ? blanks.join('\n') : '(none)');
  lines.push('');
  lines.push('SMOKE');
  for (const sample of samples) {
    lines.push(JSON.stringify(sample));
  }
  lines.push('layout ' + JSON.stringify(layout));
  lines.push(`play ${beforePlay.toFixed(3)} -> ${duringPlay.toFixed(3)} grid ${JSON.stringify(grid)}`);
  lines.push('pageErrors ' + (pageErrors.length ? pageErrors.join(' | ') : '(none)'));
  lines.push('');
  lines.push(`runtime ${((Date.now() - started) / 1000).toFixed(1)}s`);
  lines.push(`html ${htmlPath}`);
  lines.push(`ult-all ${ultAll}`);
  lines.push(`attack-all ${attackAll}`);
  lines.push(`motifs ${path.join(outDir, 'motifs.json')}`);
  lines.push(`close-ups ${results.length} ult-<id>.png`);
  const report = lines.join('\n');
  const finding = [
    'SHARED MOTIFS',
    shared.length ? table(shared, names) : '(none)',
    '',
    'CODE-ONLY ULTIMATES',
    codeOnly.length ? codeOnly.map(hero => `${hero.id}  ${hero.name}  ${hero.type}`).join('\n') : '(none)',
    '',
    'CAST FAILURES',
    failures.length ? failures.map(hero => `${hero.id}  skill=${hero.error || '-'}  attack=${hero.attackError || '-'}`).join('\n') : '(none)',
  ].join('\n');
  html = html.replace('@@MOTIFS@@', () => escapeHtml(finding));
  await fsp.writeFile(htmlPath, html);
  await fsp.writeFile(path.join(outDir, 'report.txt'), report + '\n');
  console.log('\n' + report);
  const smokeBad = samples.some(sample => sample.boards.some(board => board.error || board.variance < 4))
    || grid.cancelled || grid.n !== 39
    || !(layout[1400].b.x > layout[1400].a.x + 100)
    || !(layout[390].b.y > layout[390].a.y + 40)
    || !(duringPlay > beforePlay + 0.05)
    || pageErrors.length > 0
    || blanks.length > 0;
  if (smokeBad) {
    progress('FAILED smoke or blank cells');
    process.exitCode = 1;
  } else {
    progress('DONE');
  }
} catch (error) {
  progress('FAILED ' + (error.stack || error.message));
  process.exitCode = 1;
}
