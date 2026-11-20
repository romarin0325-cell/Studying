// Builds card_pixel/plan/v1-review.html: the owner's offline review page for the full game (v1).
// Inputs: fixed images in plan/v1-review/ and the Chrome play-through screenshots in game/tests/shots/
// (run `node card_pixel/game/tests/play.mjs` first). Usage: node card_pixel/plan/build-v1-review.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const here = path.dirname(fileURLToPath(import.meta.url));
const fixed = path.join(here, 'v1-review');
const shots = path.resolve(here, '../game/tests/shots');

async function dataUrl(file, width) {
  const buffer = width ? await sharp(file).resize({ width }).jpeg({ quality: 74 }).toBuffer() : fs.readFileSync(file);
  return 'data:image/jpeg;base64,' + buffer.toString('base64');
}
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// One campaign's screens in play order: [shot name, caption]
const TOUR = [
  ['01-title', '제목. 한 번 누르면 바로 대여 전투'],
  ['02-borrowed-battle', '첫 30초: 빈사의 애쉬, 쓰러지면 눈토끼가 아마겟돈을 물려받는다'],
  ['04-big-move', '큰 기술: 이름판과 2배 카메라'],
  ['05-first-awakening', '첫 깨우기: 살아남은 대여 동료가 먼저'],
  ['06-map', '지도: 동료가 서 있고, 문 카드에 적의 실루엣·속성·물리/마법'],
  ['07-order', '출전 순서: 쓰러지면 누구에게 무엇이 넘어가는지'],
  ['14-event', '사건: 기간과 값이 보이는 선택지'],
  ['09-treasure', '보물: 유물 96px, 장착 네 칸'],
  ['08-gate-reward', '문지기 보상: 그림자 한 명 또는 유물'],
  ['15-boss', '보스: 필살 카운트다운'],
  ['10-recruit', '생환: 영입 근거와 함께 한 명'],
  ['11-hub', '꿈의 관측소: 영입한 동료가 선다'],
  ['12-destinations', '행선지: 던전 그림, 지역 규칙, 보스'],
  ['13-preparation', '준비: 대표·동행·봉인·난이도'],
  ['16-collection', '동료 도감'],
  ['17-notebook', '꿈길 수첩 7장'],
  ['18-records', '기록']
];

const DECISIONS = [
  ['구조', '입문 5층 + 테마 던전 5 + 창조의 탑(엔딩). 원정 8층·전투 5회·문 1-2-3-1-2-2-2-1', 'Astra + 기획서'],
  ['첫 30초', '빈사의 애쉬를 살릴지, 버텨서 눈토끼에게 아마겟돈을 물려줄지 고르는 대여 전투', 'Astra'],
  ['영입', '문지기·보스전에 출전해 끝까지 산 동료만. 여정 1명, 악몽 2명. 지면 한 명을 다음 원정 후보로 예약', 'Astra'],
  ['지역 규칙', '홍련 작열 이월 · 황혼 종소리 디바인 · 별빛 시작 하늘 · 심야 조류 주기(4턴째 받는 피해 1.5배) · 투기장 평타 충전', 'Astra, 심야 4턴째는 Claude'],
  ['뺀 것', '기억의 샘(부활), 상점·시련 별도 화면(사건으로 통합), 무한 던전(미룸)', 'Astra'],
  ['메타', '대표 1, 동행 1→3칸, 봉인, 수첩 7장, 인연', 'Astra'],
  ['도트', '일러스트에서 직접 생성(88명 추가), 키 등급별 높이 58/64/72/80px, 떨어진 이펙트·소품 보존', 'Claude'],
  ['화면', '메뉴를 장면으로: 배경 8장과 도트로 관측소·지도·사건·생환을 무대로 만든다', 'Astra + Claude'],
  ['소스', 'engine / content / ui / stage / audio 분리, 원정 상태는 엔진 명령만 바꾼다, 방 사이 저장', 'Claude + Astra']
];

const QUESTIONS = [
  'Galmuri 글꼴 세 개(약 1.5MB)를 내려받아 내장해도 되는지. 지금은 인터넷이 있어야 글꼴이 나온다.',
  '에인션트소울 도트: 컨셉은 남성인데 일러스트를 따라 여성스럽게 나왔다. 다시 만들지.',
  '배경음 12곡: 아무도 들어 보지 않았다. game/tools/music-preview.html 에서 곡별로 들을 수 있다.',
  '시작 숫자(골라 2 + 무작위 3, 결정 1)와 윤곽선 기본 켜짐은 Claude 판단이다.',
  '본편 첫 던전의 난이도: 시뮬레이션은 클리어 60~70%인데, 순서를 바꾸지 않는 단순 봇은 Chrome에서 네 번 다 보스에서 졌다. 실제로 해 보고 판단이 필요하다.'
];

const GPT = [
  ['Astra 6.2 max · 설계·화면·사건 자문 3회', '매우 쓸만함', '엔진을 직접 돌려 근거를 대고, 390px 배치를 px로, 사건은 캐릭터의 실제 스킬로. 대부분 그대로 채택'],
  ['Sol 6.2 xhigh · 구조 개편, 엔진, 화면 A·B', '쓸만함', '테스트를 스스로 쓰고 계약을 지킴. 브라우저를 못 띄워서 놓친 것 넷(클릭 끊김, 입문 생존자 누락, 빈 거점, 의미 없는 보상)을 Claude가 Chrome에서 찾아 고침'],
  ['Sol 6.2 high · 균형, 배경음, 테스트, 다듬기', '쓸만함', '균형은 원인별 기여까지 잼. 자동 플레이 테스트는 코드만 읽고 써서 첫 실행에 통과'],
  ['Sol 6.2 low · 이미지 도구 호출(도트 89, 배경 8, 아이콘 시트 7)', '쓸만함', '장당 40~50초, 재시도 0. 성별 지시보다 일러스트 인상을 따를 때가 있음']
];

const tour = [];
for (const [name, caption] of TOUR) {
  const file = path.join(shots, '7-' + name + '.png');
  if (fs.existsSync(file)) tour.push({ src: await dataUrl(file, 360), caption });
}
const img = name => dataUrl(path.join(fixed, name));
const ending = await img('ending.jpg'), procession = await img('ending-procession.jpg'), titleBack = await img('title-returning.jpg');
const before = { screens: await img('trial-screens.jpg'), battle: await img('trial-battle.jpg') };
const after = {
  map: tour.find(t => t.caption.startsWith('지도'))?.src,
  order: tour.find(t => t.caption.startsWith('출전'))?.src,
  battle: tour.find(t => t.caption.startsWith('첫 30초'))?.src
};
const lineup = await img('sprites-lineup.jpg'), pilot = await img('illustration-pilot.jpg');
const backgrounds = await img('backgrounds.jpg'), icons = await img('icons.jpg');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>다음은 너 · 정식판 검토</title>
<style>
:root { --bg: #120e22; --panel: #1d1736; --ink: #f3e9d2; --dim: #b9aecb; --teal: #4fd8c8; --brass: #ffc857; --coral: #ff6b5e; --line: #3b3060; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.65 system-ui, 'Malgun Gothic', sans-serif; }
header { padding: 28px 20px 12px; max-width: 1080px; margin: auto; }
h1 { margin: 0; font-size: 26px; } h1 small { color: var(--teal); font-size: 14px; margin-left: 8px; }
h2 { font-size: 19px; margin: 34px 0 12px; color: var(--brass); }
main { max-width: 1080px; margin: auto; padding: 0 20px 60px; }
.panel { background: var(--panel); border: 2px solid var(--line); box-shadow: 0 2px 0 #0a0814; padding: 14px 16px; margin: 10px 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.stats div { background: var(--panel); border: 2px solid var(--line); padding: 10px 12px; }
.stats b { display: block; font-size: 24px; color: var(--teal); }
code { background: #0c0a18; padding: 1px 6px; border: 1px solid var(--line); font-size: 13px; word-break: break-all; }
.tour { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.tour figure { margin: 0; background: var(--panel); border: 2px solid var(--line); }
.tour img { width: 100%; display: block; cursor: zoom-in; }
.tour figcaption { padding: 6px 8px; font-size: 13px; color: var(--dim); }
table { width: 100%; border-collapse: collapse; } td, th { border-bottom: 1px solid var(--line); padding: 8px 6px; text-align: left; vertical-align: top; }
th { color: var(--teal); font-weight: 600; }
.wide { width: 100%; display: block; border: 2px solid var(--line); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
.pair img { width: 100%; border: 2px solid var(--line); }
.toggle button { background: var(--panel); color: var(--ink); border: 2px solid var(--line); padding: 6px 12px; margin-right: 6px; cursor: pointer; font: inherit; }
.toggle button.on { border-color: var(--teal); color: var(--teal); }
.ba img { max-width: 100%; border: 2px solid var(--line); display: block; }
.q li { margin: 6px 0; }
dialog { padding: 0; border: 2px solid var(--teal); background: #000; max-width: 96vw; }
dialog img { max-height: 92vh; max-width: 96vw; display: block; }
@media (max-width: 640px) { .pair { grid-template-columns: 1fr; } }
</style></head><body>
<header><h1>「다음은 너」 정식판 v1 <small>검토 페이지 · 2026-11-20</small></h1>
<p>게임 전체를 만들었다. GPT 6.2 Astra(max)가 설계·화면·사건을 자문하고, GPT 6.2 Sol(high~xhigh)이 구현했고, Claude가 계획·지시·검수를 맡았다. 아래에서 화면, 바꾼 것, Claude가 정한 것, 확인이 필요한 것을 볼 수 있다.</p></header>
<main>
<h2>한눈에</h2>
<div class="stats">
  <div><b>7</b>던전 (입문 + 테마 5 + 창조의 탑)</div>
  <div><b>130</b>아군 도트 (일러스트에서 88명 새로)</div>
  <div><b>28</b>사건</div><div><b>14</b>유물</div>
  <div><b>12</b>배경음</div><div><b>88</b>자동 테스트</div>
</div>
<div class="panel">플레이: <code>C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel\\card_pixel\\game\\dist\\Relaymare.html</code><br>
배경음 듣기: <code>C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel\\card_pixel\\game\\tools\\music-preview.html</code><br>
결정 전체: <code>card_pixel\\plan\\v1-decisions.md</code> · 작업 기록: <code>card_pixel\\history\\2026-11-20.md</code> · GPT 평가: <code>card_pixel\\history\\model-log.md</code></div>

<h2>화면 (Chrome 자동 플레이, 390×844)</h2>
<div class="tour">${tour.map(t => `<figure><img src="${t.src}" alt=""><figcaption>${esc(t.caption)}</figcaption></figure>`).join('')}
<figure><img src="${titleBack}" alt=""><figcaption>다시 켠 제목: 대표가 선다</figcaption></figure>
<figure><img src="${ending}" alt=""><figcaption>엔딩: 꿈길의 끝 (창조의 탑 첫 격파)</figcaption></figure>
<figure><img src="${procession}" alt=""><figcaption>엔딩: 영입한 동료들의 행진</figcaption></figure></div>

<h2>시험판 → 정식판</h2>
<div class="panel"><div class="toggle" id="ba-toggle"><button data-v="before" class="on">시험판</button><button data-v="after">정식판</button></div>
<div class="ba" id="ba-before"><img src="${before.screens}" alt=""><img src="${before.battle}" alt="" style="margin-top:8px"></div>
<div class="ba" id="ba-after" hidden><div class="pair">${[after.map, after.order, after.battle].filter(Boolean).map(s => `<img src="${s}" alt="">`).join('')}</div></div></div>

<h2>그림</h2>
<div class="panel"><p>일러스트 → 도트 시험: 위 두 줄이 기존(디펜스 SD 기반)과 새(일러스트 기반) 가디언·지크, 아래 셋이 새로 만든 캐릭터.</p><img class="wide" src="${pilot}" alt=""></div>
<div class="panel"><p>키 등급 반영(작음 58 · 중간 64 · 보통 72 · 큼 80px)과 떨어진 소품 보존(초신성의 요정 인형, 애쉬의 불꽃).</p><img class="wide" src="${lineup}" alt=""></div>
<div class="pair"><div class="panel"><p>배경 8장</p><img class="wide" src="${backgrounds}" alt=""></div><div class="panel"><p>유물·방 아이콘 28종 (32px 원본, 4배로 보기)</p><img class="wide" src="${icons}" alt=""></div></div>

<h2>Claude가 정한 것 (확인 전)</h2>
<div class="panel"><table><tr><th>항목</th><th>결정</th><th>출처</th></tr>
${DECISIONS.map(d => `<tr><td>${esc(d[0])}</td><td>${esc(d[1])}</td><td>${esc(d[2])}</td></tr>`).join('')}</table>
<p>근거와 되돌리는 위치까지 모두: <code>card_pixel\\plan\\v1-decisions.md</code></p></div>

<h2>확인이 필요한 것</h2>
<div class="panel"><ol class="q">${QUESTIONS.map(q => `<li>${esc(q)}</li>`).join('')}</ol></div>

<h2>GPT 6.2 평가</h2>
<div class="panel"><table><tr><th>일</th><th>판정</th><th>무엇이 좋고 무엇이 문제였나</th></tr>
${GPT.map(g => `<tr><td>${esc(g[0])}</td><td>${esc(g[1])}</td><td>${esc(g[2])}</td></tr>`).join('')}</table></div>
</main>
<dialog id="zoom"><img alt=""></dialog>
<script>
const zoom = document.getElementById('zoom');
document.querySelectorAll('.tour img, .wide, .ba img').forEach(image => image.addEventListener('click', () => { zoom.querySelector('img').src = image.src; zoom.showModal(); }));
zoom.addEventListener('click', () => zoom.close());
document.querySelectorAll('#ba-toggle button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('#ba-toggle button').forEach(b => b.classList.toggle('on', b === button));
  document.getElementById('ba-before').hidden = button.dataset.v !== 'before';
  document.getElementById('ba-after').hidden = button.dataset.v !== 'after';
}));
</script></body></html>
`;
fs.writeFileSync(path.join(here, 'v1-review.html'), html);
console.log('v1-review.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB', tour.length + ' screens');
