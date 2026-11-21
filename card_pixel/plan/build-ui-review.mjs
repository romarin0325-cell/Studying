// Builds plan/ui-review.html: the UI renewal before/after page (one offline file).
// Usage: node card_pixel/plan/build-ui-review.mjs [<before shots dir> <after shots dir>]
// With the two directories it first refreshes plan/ui-review/{before,after}/*.jpg (390 px, quality 82).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const store = path.join(here, 'ui-review');
const [beforeDir, afterDir] = process.argv.slice(2);

const PAIRS = [
  ['opening-choices-title', '타이틀', '어두운 상자와 테두리 버튼 → 밝은 하늘의 로고, 남색 RELAYMARE 리본, 표어 알약, 숲길의 일행, 청록 시작 버튼'],
  ['next-goal', '관측소 홈', '버튼 다섯 줄 → 리더 말풍선(다음 목표), 오른쪽 원형 메뉴, 행선지 그림이 붙은 출발 티켓'],
  ['rift-first', '관측소 · 균열 열림', '오늘의 균열은 보라→분홍 배너, 날짜와 행동은 흰 알약'],
  ['difficulty-choice', '출발 준비 시트', '흰 하단 시트, 남색 제목 판, 반짝이 꼬리표, 고른 칸은 청록 고리와 ✓'],
  ['roster-table', '출현표', '도감 칸은 흰 카드, 얼굴은 등급 색 원'],
  ['run-lost-recruit', '동료 도감', '미조우 칸은 연보라 실루엣, 집계는 남색 알약'],
  ['relic-strip', '탐험 지도', '층 진행은 알약 트랙(지나온 층 남색, 지금 층 청록), 장면은 흰 테두리 창, 문 카드는 종류 색 띠'],
  ['door-sky', '문 정보 시트', '적 이름과 규칙을 꼬리표로 묶음'],
  ['formation-board', '출전 순서', '좌석마다 남색 자리 알약, 청록 계주 화살표, 대기 동료 카드'],
  ['event-values', '사건', '흰 테두리 장면, 남색 이름표가 걸친 대화창, 선택지 카드'],
  ['spring-commit', '소환의 샘', '등급 색 그림 타일, 등급 알약, 고른 카드는 청록 고리'],
  ['treasure-receipt', '보물방', '유물 받침과 비교 카드'],
  ['opening-choices', '첫 전투의 선택', '생존 후퇴는 청록 카드, 마지막 공격은 산호 카드와 ! 표식'],
  ['tile-range', '전투', '흰 적 정보판(종류 알약·의도 줄), 흰 동료 칩, 남색 자막 띠, 종류 색 기둥 + 큰 예측 숫자 타일'],
  ['field-support', '전투 · 필드 정보', '필드 칸은 흰 알약, 시트는 같은 구조'],
  ['last-hit', '전투 결과', '돌파 판에 BREAK THROUGH 키커와 금빛 반짝이, 유품 계승은 금색 상자'],
  ['battle-log', '전투 기록', '턴마다 연보라 상자와 남색 줄'],
  ['reinforcement-board', '증원', '후보 카드에 등급 색 띠, 고르면 떠오름'],
  ['return-stamp', '귀환', '계약 도장은 금색 알약, 영입 후보 카드'],
  ['missions-invitations', '수첩 · 초대', '장 목록과 도장'],
  ['ending-goal', '기록', '표는 흰 패널, 머리글은 회색 굵은 글자'],
  ['reading-settings', '읽기 설정', '토글은 알약 스위치(켜짐 청록)'],
  ['save-recovery', '기록 복구', '복구 버튼과 안내를 흰 패널로'],
  ['retreat-warning', '후퇴 경고', '후퇴 버튼이 금색 고리로 바뀌고 두 결과를 자막 띠에']
];

async function refresh() {
  for (const side of ['before', 'after']) fs.mkdirSync(path.join(store, side), { recursive: true });
  for (const [name] of PAIRS) {
    for (const [side, dir] of [['before', beforeDir], ['after', afterDir]]) {
      const source = path.join(dir, name + '.png');
      if (!fs.existsSync(source)) throw new Error('missing ' + source);
      await sharp(source).resize({ width: 390 }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(store, side, name + '.jpg'));
    }
  }
}

const dataUrl = file => 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

if (beforeDir && afterDir) await refresh();

const cards = PAIRS.map(([name, title, note], index) => `
  <article class="pair" id="p${index}">
    <header><b>${index + 1}. ${esc(title)}</b><span>${esc(note)}</span></header>
    <div class="shots">
      <figure class="before"><figcaption>이전</figcaption><img loading="lazy" alt="${esc(title)} 이전" src="${dataUrl(path.join(store, 'before', name + '.jpg'))}"></figure>
      <figure class="after"><figcaption>이후</figcaption><img loading="lazy" alt="${esc(title)} 이후" src="${dataUrl(path.join(store, 'after', name + '.jpg'))}"></figure>
    </div>
  </article>`).join('');

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RELAYMARE UI 전후 비교</title>
<style>
  :root { --navy: #29266a; --aqua: #1fc6c1; --ink: #26244f; --ink2: #5e5b8c; --paper: #fff; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.6 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: var(--ink);
    background: linear-gradient(180deg, #d8ebff, #e9e4ff 40%, #ffe6ef); min-height: 100vh; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 60px; }
  h1 { display: inline-block; margin: 0 0 8px; padding: 8px 36px 10px 16px; color: #fff; background: var(--navy); font-size: 24px;
    clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%); }
  .lead { max-width: 780px; color: var(--ink2); }
  .bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 16px 0; padding: 10px 0;
    background: linear-gradient(180deg, #e3e6ff, rgba(227, 230, 255, .9)); }
  .bar button { padding: 8px 16px; border: 1.5px solid #cdc4f0; border-radius: 999px; background: #fff; color: var(--navy); font: inherit; font-weight: 700; cursor: pointer; }
  .bar button[aria-pressed="true"] { background: var(--aqua); border-color: var(--aqua); color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }
  .pair { background: var(--paper); border-radius: 16px; padding: 12px; box-shadow: 0 6px 18px rgba(41, 38, 106, .12); }
  .pair header b { display: block; font-size: 16px; }
  .pair header span { display: block; color: var(--ink2); font-size: 13px; min-height: 42px; }
  .shots { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  figure { margin: 0; }
  figcaption { font-size: 12px; font-weight: 700; color: var(--ink2); margin-bottom: 4px; }
  .after figcaption { color: #0f9aaa; }
  img { display: block; width: 100%; border-radius: 10px; box-shadow: 0 0 0 1px rgba(41, 38, 106, .12); cursor: zoom-in; }
  body.only-after .before, body.only-before .after { display: none; }
  body.only-after .shots, body.only-before .shots { grid-template-columns: 1fr; }
  .zoom { position: fixed; inset: 0; z-index: 5; display: none; align-items: center; justify-content: center; gap: 16px; padding: 20px; background: rgba(30, 26, 78, .82); }
  .zoom.on { display: flex; }
  .zoom img { width: auto; max-width: 45vw; max-height: 92vh; cursor: zoom-out; }
  .zoom p { position: absolute; top: 8px; left: 16px; color: #fff; margin: 0; }
</style></head>
<body><main>
  <h1>RELAYMARE UI 전후 비교</h1>
  <p class="lead">2026-11-21 Claude 직접 작업. 밝은 일본 트렌디 서브컬처 UI(스텔라 소라·학원 아이돌마스터·도트 어비스 등 실제 화면 확인)를 도트 그림에 접목했다. 규칙·수치·문구는 그대로이고, 같은 게임 상태를 390×844 Chrome에서 찍었다. 그림을 누르면 이전·이후를 크게 나란히 본다. 근거와 규칙은 <code>plan/ui-direction.md</code>.</p>
  <div class="bar" role="group" aria-label="보기">
    <button data-view="both" aria-pressed="true">나란히</button>
    <button data-view="only-after" aria-pressed="false">이후만</button>
    <button data-view="only-before" aria-pressed="false">이전만</button>
  </div>
  <section class="grid">${cards}</section>
</main>
<div class="zoom" role="dialog" aria-label="크게 보기"><p></p></div>
<script>
  const buttons = document.querySelectorAll('[data-view]');
  buttons.forEach(button => button.addEventListener('click', () => {
    document.body.className = button.dataset.view === 'both' ? '' : button.dataset.view;
    buttons.forEach(other => other.setAttribute('aria-pressed', other === button));
  }));
  const zoom = document.querySelector('.zoom');
  document.querySelectorAll('.pair').forEach(pair => pair.addEventListener('click', event => {
    if (!event.target.matches('img')) return;
    zoom.querySelectorAll('img').forEach(img => img.remove());
    pair.querySelectorAll('img').forEach(img => zoom.append(img.cloneNode()));
    zoom.querySelector('p').textContent = pair.querySelector('header b').textContent + ' · 왼쪽 이전 / 오른쪽 이후';
    zoom.classList.add('on');
  }));
  zoom.addEventListener('click', () => zoom.classList.remove('on'));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') zoom.classList.remove('on'); });
</script>
</body></html>
`;
fs.writeFileSync(path.join(here, 'ui-review.html'), html);
console.log('ui-review.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB', PAIRS.length, 'pairs');
