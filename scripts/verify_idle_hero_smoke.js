const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mustContain(content, snippets, filePath) {
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      throw new Error(`${filePath} is missing expected snippet: ${snippet}`);
    }
  }
}

function extractInlineScript(html, filePath) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!matches.length) {
    throw new Error(`${filePath} does not contain an inline script block.`);
  }
  return matches[matches.length - 1][1];
}

function run() {
  const filePath = path.join(process.cwd(), 'idle_hero', 'index.html');
  const html = fs.readFileSync(filePath, 'utf8');

  mustContain(
    html,
    [
      'id="stageBadge"',
      'id="skillBtn"',
      'id="upgradeList"',
      'id="gearSlots"',
      'id="talentList"',
      'id="bossList"',
      'const STORAGE_KEY = \'lumi_idle_single_html_v1\'',
      '고스트 킹',
      '창조신 아스테아',
      '루미의 공명',
      '밀키웨이 엑스터시',
      '전투',
      '공방',
      '장비',
      '성좌',
      '기록'
    ],
    filePath
  );

  if (html.includes('src="game.js"') || html.includes('href="style.css"')) {
    throw new Error(`${filePath} still references external idle_hero assets.`);
  }

  const script = extractInlineScript(html, filePath);
  new vm.Script(script, { filename: filePath });

  console.log('Idle hero smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
