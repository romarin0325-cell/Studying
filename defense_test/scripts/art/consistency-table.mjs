// Axis grades for SD atlases and memorial paintings.
// Reads defense_test/docs/ASSET_CONSISTENCY_DATA.json (from consistency-report.mjs)
// and prints Korean GitHub Markdown. Does not write a file.
//   node defense_test/scripts/art/consistency-table.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(here, '../..');
const dataPath = path.join(game, 'docs/ASSET_CONSISTENCY_DATA.json');
const contentPath = path.join(game, 'src/content.js');

const SD_AXES = [
  ['크기', ['bboxW', 'bboxH', 'silhouetteArea', 'headCenterToFeet', 'feetY', 'cellMargin', 'viewAreaSpread', 'feetSpread', 'comXOffset']],
  ['선', ['rimLightness', 'rimThickness', 'rimNavy', 'edge']],
  ['광택', ['highlightPct', 'highlightBlobsPer10k', 'gradientSoftness', 'flatShare']],
  ['디테일', ['paletteSize', 'top5Share', 'edge']],
  ['화풍', ['lightness', 'saturation', 'dark']],
];
const MEM_AXES = [
  ['화풍', ['lightness', 'saturation', 'contrast', 'darkRatio', 'warmth', 'colourfulness']],
  ['선명도', ['edge', 'sharpness']],
  ['배경', ['bgBusy']],
  ['용량', ['fileKiB']],
];

const RANK = {ok: 0, warn: 1, out: 2};
const KO = {ok: '정상', warn: '주의', out: '이탈'};
const HEIGHT = {short: '작음', medium: '보통', tall: '큼'};

function heroIds(src) {
  const roster = src.match(/export const ROSTER = \{([\s\S]*?)\};/);
  const hidden = src.match(/export const HIDDEN = \[([\s\S]*?)\];/);
  if (!roster || !hidden) return null;
  const ids = block => [...block.matchAll(/'([^']+)'/g)].map(match => match[1]);
  return [...ids(roster[1]), ...ids(hidden[1])];
}

function worstGrade(block, metrics) {
  let worst = 'ok';
  for (const metric of metrics) {
    const grade = block?.[metric]?.grade;
    if (RANK[grade] > RANK[worst]) worst = grade;
  }
  return worst;
}

function fmtZ(z) {
  const text = (Math.round(z * 1000) / 1000).toFixed(3);
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function causes(block, axes) {
  const seen = new Map();
  for (const [, metrics] of axes) {
    for (const metric of metrics) {
      const entry = block?.[metric];
      if (!entry || (entry.grade !== 'warn' && entry.grade !== 'out')) continue;
      if (!seen.has(metric)) seen.set(metric, Number.isFinite(entry.z) ? entry.z : 0);
    }
  }
  return [...seen.entries()]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([metric, z]) => `${metric}(z=${fmtZ(z)})`)
    .join(', ');
}

function mdTable(headers, rows) {
  const esc = value => String(value ?? '').replace(/\|/g, '\\|');
  const line = cols => '| ' + cols.map(esc).join(' | ') + ' |';
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

function axisCells(block, axes) {
  return axes.map(([, metrics]) => KO[worstGrade(block, metrics)]);
}

function summaryRows(records, key, axes) {
  return axes.map(([name, metrics]) => {
    const counts = {정상: 0, 주의: 0, 이탈: 0};
    for (const record of records) counts[KO[worstGrade(record[key], metrics)]]++;
    return [name, counts.정상, counts.주의, counts.이탈];
  });
}

if (!fs.existsSync(dataPath)) {
  console.error('ASSET_CONSISTENCY_DATA.json 이 없다. 먼저 node defense_test/scripts/art/consistency-report.mjs 를 실행한다.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
if (!data.heroes || typeof data.heroes !== 'object') {
  console.error('ASSET_CONSISTENCY_DATA.json 에 heroes가 없다.');
  process.exit(1);
}

const parsedOrder = heroIds(fs.readFileSync(contentPath, 'utf8'));
const order = parsedOrder ?? Object.keys(data.heroes);
const seen = new Set();
const records = [];
for (const id of order) {
  if (!data.heroes[id] || seen.has(id)) continue;
  seen.add(id);
  records.push({id, ...data.heroes[id]});
}
for (const id of Object.keys(data.heroes)) {
  if (seen.has(id)) continue;
  records.push({id, ...data.heroes[id]});
}

const sdRows = records.map(record => {
  const cells = axisCells(record.sd, SD_AXES);
  const height = HEIGHT[record.heightGroup] ?? record.heightGroup ?? '';
  return {
    cells,
    row: [record.name, record.rarity, height, ...cells, causes(record.sd, SD_AXES)],
  };
});
const memRows = records.map(record => {
  const cells = axisCells(record.memorial, MEM_AXES);
  return {
    cells,
    row: [record.name, ...cells, causes(record.memorial, MEM_AXES)],
  };
});

const ranked = records.map((record, index) => {
  const cells = [...sdRows[index].cells, ...memRows[index].cells];
  let out = 0;
  let warn = 0;
  for (const cell of cells) {
    if (cell === '이탈') out++;
    else if (cell === '주의') warn++;
  }
  return {name: record.name, score: out * 2 + warn, out, warn, index};
}).sort((a, b) => b.score - a.score || b.out - a.out || b.warn - a.warn || a.index - b.index);

const lines = [
  '# 동료 에셋 일관성',
  '',
  '각 지표의 z는 캐스트 중앙값과 MAD로 구한 로버스트 z-score다. |z|가 2 이하이면 정상, 2를 넘어 3 이하이면 주의, 3을 넘으면 이탈이다. 축 칸은 그 축에 들어간 지표 가운데 가장 나쁜 등급이다.',
  '',
  '## SD',
  '',
  mdTable(['이름', '희귀도', '키', '크기', '선', '광택', '디테일', '화풍', '원인'], sdRows.map(row => row.row)),
  '',
  '## 메모리얼',
  '',
  mdTable(['이름', '화풍', '선명도', '배경', '용량', '원인'], memRows.map(row => row.row)),
  '',
  '## 축별 집계',
  '',
  '### SD',
  '',
  mdTable(['축', '정상', '주의', '이탈'], summaryRows(records, 'sd', SD_AXES)),
  '',
  '### 메모리얼',
  '',
  mdTable(['축', '정상', '주의', '이탈'], summaryRows(records, 'memorial', MEM_AXES)),
  '',
  '## 주의·이탈이 많은 동료',
  '',
  'SD와 메모리얼의 축 칸을 합친다. 이탈은 2점, 주의는 1점이다.',
  '',
  mdTable(['이름', '점수', '이탈', '주의'], ranked.slice(0, 10).map(row => [row.name, row.score, row.out, row.warn])),
];

console.log(lines.join('\n'));
