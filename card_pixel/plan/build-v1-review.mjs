// Builds card_pixel/plan/v1-review.html: the owner's offline review page for the full game (v1).
// Inputs: fixed images in plan/v1-review/ and optional Chrome play-through screenshots in game/tests/shots/
// (from `node card_pixel/game/tests/play.mjs`). Usage: node card_pixel/plan/build-v1-review.mjs
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
const figure = ({ src, caption }) => `<figure><img src="${src}" alt=""><figcaption>${esc(caption)}</figcaption></figure>`;

// One campaign's screens in play order: [shot name, caption]
const TOUR = [
  ['01-title', '제목. 릴레이 안내를 읽고 첫 대여 전투로 들어간다'],
  ['03-borrowed-battle', '첫 30초에 애쉬가 쓰러지고 눈토끼가 아마겟돈을 물려받았다'],
  ['04-big-move', '큰 기술: 이름판과 2배 카메라'],
  ['05-first-awakening', '첫 깨우기에서 눈토끼를 첫 동행으로 두고 함께 갈 동료를 고른다'],
  ['06-map', '지도에서는 갈림길 끝에 문이 서고, 문 아래에 적의 공격 유형과 보상이 보인다'],
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

// JPEGs exported at 390 px wide, quality 82, from tests/shots/screens and screens-map.
const REDESIGN = [
  ['redesign-opening-choices-title', '제목 화면에 쓰러진 동료가 다음 동료의 힘이 된다는 릴레이 규칙이 나온다.'],
  ['redesign-opening-choices', '첫 대여 전투에서 애쉬를 살리거나, 애쉬로 마지막 공격을 해 눈토끼에게 아마겟돈을 넘길 수 있다.'],
  ['redesign-opening-choices-rescue', '애쉬를 살려 승리하면 결과 화면에 애쉬가 첫 동행으로 표시된다.'],
  ['redesign-opening-awaken-companion', '첫 동행 눈토끼와 유품 아마겟돈을 위에 두고 함께 갈 동료 한 명을 고른다.'],
  ['redesign-opening-awaken', '첫 동행과 고른 동료 아래에 새로 깨어난 세 명을 공개하고 결정 1개를 받는다.'],
  ['redesign-formation-board', '선봉·중견·대장을 가로로 놓고 자리 사이에 계승 화살표를, 위에 이번 전투의 축복을 표시한다.'],
  ['redesign-order-hint', '첫 본편 보스의 편성 제안에 선봉과 대장의 맞교대, 대기 중인 동료의 투입을 표시한다.'],
  ['redesign-reinforcement-board', '동료가 6명일 때 후보를 데려오려면 같은 화면에서 보낼 동료를 고른다.'],
  ['redesign-tempo-telegraph', '전투 화면에 적의 다음 공격과 예상 마법 피해 274, 배리어가 막는 공격 유형이 표시된다.'],
  ['redesign-last-hit-impact', '눈토끼의 아마겟돈이 마지막 일격으로 350 피해를 주고 유품 원주인 애쉬와 생환자가 표시된다.'],
  ['redesign-battle-log', '턴별 전투 기록에서 판게아리버스의 5턴 발동과 피해를 보고 1턴 예약으로 돌아갈 수 있다.'],
  ['redesign-two-doors', '새벽의 숲 3층 갈림길에 물리 강공과 마법 강공을 예고하는 문 두 개가 서 있다.'],
  ['redesign-three-doors', '홍련 화산 3층 장면에 소환의 샘, 혼돈의 제단, 사건으로 통하는 문 세 개가 서 있다.'],
  ['redesign-mid-walk', '문을 고르면 선봉이 먼저 방향을 틀고 중견과 대장이 뒤따라 걷는다.']
];

const FUN_CHANGES = [
  ['order-hint', '첫 본편 보스의 다른 순서. 첫 승 전까지 보이고 ‘이 순서로’를 눌러야 바뀐다'],
  ['retreat-outcomes', '물러나기 첫 탭에 다음 동료가 대신 맞고 남을 HP와, 쓰러질 때 넘길 유품 ×1.5를 함께 표시'],
  ['spring-count', '7층 샘·제단에 실제 인원 표시. 현재 2명이면 결정 1개로 셋째 깨우기 또는 둘 중 한 명 축복'],
  ['contract-sheet', '악몽 준비에서 계약 셋 중 하나를 고른다. 기본은 계약 없음. 계약을 고르면 문지기 보상에서 결정 1개를 맡긴다'],
  ['contract-battle-sheet', '전장·유물에서 ‘둘이 돌아온 정예전’의 조건과 달성 여부를 본다'],
  ['contract-payout', '6층까지 계약을 달성하면 7층 앞에서 결정 3개'],
  ['return-stamp', '생환하면 달성한 악몽 계약의 지역 도장을 받는다'],
  ['return-stamp-records', '기록에서 지역별 계약 도장을 본다. 6곳에 3개씩, 모두 18개']
];

const REVIEW_FIXES = [
  ['tile-range-kill', '무작위 기술은 피해 범위를 보여 주고, 최저 피해로도 쓰러뜨릴 때만 ‘처치’'],
  ['tile-instant', '시간의마술사와 출전하면 판게아리버스 타일에 ‘즉시’와 피해량 표시'],
  ['retreat-warning', '물러나기 첫 탭에 예약한 일루미네이션도 취소된다고 알림'],
  ['door-sky-card', '별빛 정원 문에 사건에서 고른 스타파우더를 시작 하늘로 표시'],
  ['door-hp', '위험 문 상세에 메아리를 적용한 용암 갑충 HP 546 표시'],
  ['bet-text', '별판 내기는 정해진 턴에 적 하나를 쓰러뜨리고 전투에서 이기면 성공'],
  ['save-fail', '저장에 실패하면 새로고침 때 지금부터의 진행이 사라진다고 알림'],
  ['record-fallen', '쓰러진 눈토끼의 기록에 ‘원정 승리 · 미귀환’'],
  ['field-cap', '버프오버로드를 장착하면 하늘 상세에 필드 ‘최대 5개’'],
  ['form-sheet', '동료 상세에 변신 후 오로라윙의 기술 표시'],
  ['resume-seats', '전투 중 새로고침해도 출전 순서의 빈 자리 위치까지 복원'],
  ['countdown-charge', '창조신 카운트다운에 차징 뒤 쓸 디바인블레이드 예고']
];

const DAILY_RIFT = [
  ['rift-first', '첫 본편 생환으로 수첩 4장을 열면 관측소에 오늘의 균열이 나타난다.'],
  ['rift-preparation', '날짜마다 같은 동료 5명(출전 3명·대기 2명)을 빌려 7층에서 전투 4회를 치른다.'],
  ['rift-battle', '전장·유물을 열면 전투가 멈추고 도전 종류와 끝낸 전투의 누적 턴 수를 볼 수 있다.'],
  ['rift-result-win', '하루 한 번의 기록 도전에서 돌파하면 날짜 도장을 받고, 같은 편성으로 횟수 제한 없이 연습할 수 있다.'],
  ['rift-yesterday', '어제 균열이 남아 있으면 이어가거나 포기한 뒤 오늘 균열을 시작할 수 있다.'],
  ['rift-records', '기록의 지역별 생환 아래에 균열 기록이 최신 날짜순으로 7개씩 표시된다.'],
  ['rift-record-detail', '날짜별 상세에는 첫 기록과 연습 최고가 각각 남아, 첫 도전 실패 뒤 연습으로 돌파한 경우도 볼 수 있다.']
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
const fixedTour = async entries => {
  const figures = await Promise.all(entries.map(async ([name, caption]) =>
    figure({ src: await img(name + '.jpg'), caption })
  ));
  return figures.join('');
};
const redesign = await fixedTour(REDESIGN);
const funChanges = await fixedTour(FUN_CHANGES);
const reviewFixes = await fixedTour(REVIEW_FIXES);
const dailyRift = await fixedTour(DAILY_RIFT);
const { results: audioLevels } = JSON.parse(fs.readFileSync(path.resolve(here, '../game/tools/music-levels.json'), 'utf8'));
const musicLevels = audioLevels.filter(track => track.kind === 'music');
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
.music-levels { max-width: 420px; font-size: 13px; }
.music-levels td, .music-levels th { padding: 4px 6px; }
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
<header><h1>「다음은 너」 정식판 v1 <small>검토 페이지 · 2026-11-21</small></h1>
<p>게임 전체를 만들었다. GPT 6.2 Astra(max)가 설계·화면·사건을 자문하고, GPT 6.2 Sol(high~xhigh)이 구현했고, Claude가 계획·지시·검수를 맡았다. 아래에서 화면, 바꾼 것, Claude가 정한 것, 확인이 필요한 것을 볼 수 있다.</p></header>
<main>
<section aria-labelledby="redesign-title">
<h2 id="redesign-title">피드백 반영 재설계 (11월 21일 아침)</h2>
<div class="panel">
<p>소유자는 첫 전투와 깨우기가 이해하기 어렵고, 편성과 로그가 불편하며, 갈림길이 단순한 선택 화면처럼 느껴진다고 했다. 일반전은 길고 MP가 남아 좋은 조합이 굳었으며, 마지막 보스에 난도가 몰리고 승리 연출도 약하다고 봤다. 첫 전투의 선택을 첫 동행으로 이어 주고, 가로 편성 보드와 걷는 지도를 도입했다. 일반전은 예고가 있는 짧고 강한 전투로 조정하고, 무료 보충과 전투별 축복, 마지막 일격 연출과 턴별 기록을 넣었다.</p>
<table>
<thead><tr><th scope="col">시뮬레이션 지표</th><th scope="col">재설계 전</th><th scope="col">재설계 후</th></tr></thead>
<tbody>
<tr><th colspan="3" scope="rowgroup">결정 기록 9장 · 같은 1,152시드의 메모리 실험</th></tr>
<tr><td>일반전 평균 턴</td><td>6.78턴</td><td>4.37턴</td></tr>
<tr><td>일반전 종료 시 잔여 MP</td><td>70.3%</td><td>47.4%</td></tr>
<tr><td>모든 전투 종료 시 잔여 MP</td><td>61%</td><td>40%</td></tr>
<tr><td>세 명 생존 후 자발적 멤버 교체</td><td>25%</td><td>72%</td></tr>
<tr><td>전체 패배 중 마지막 보스 비중</td><td>99.5%</td><td>55.8%</td></tr>
<tr><td>본편 원정 클리어율</td><td>67.7%</td><td>67.0%</td></tr>
</tbody>
<tbody>
<tr><th colspan="3" scope="rowgroup">구현 커밋 a2037df · 지역·난이도당 384시드</th></tr>
<tr><td>일반전 평균 턴 · 잔여 MP</td><td>—</td><td>3.8~5.8턴 · 45~49%</td></tr>
<tr><td>세 명 생존 후 자발적 멤버 교체</td><td>19~32%</td><td>72~80%</td></tr>
<tr><td>전체 패배 중 마지막 보스 비중</td><td>94~100%</td><td>38~68%</td></tr>
<tr><td>클리어율 · 여정 / 악몽</td><td>—</td><td>61~74% / 41~46%</td></tr>
<tr><td>첫 본편 · 문지기 통과율</td><td>—</td><td>89~91%</td></tr>
<tr><td>첫 본편 · 클리어율</td><td>10~13%</td><td>47~54%</td></tr>
</tbody>
</table>
<p>구현 수치는 신중하게 플레이하는 정책으로 측정했다. 첫 본편은 홍련·황혼에서 기본 편성을 유지하는 초행 플레이를 모의했다.</p>
</div>
<h3>재설계 화면</h3>
<div class="tour">${redesign}</div>
<h3>규칙 질문과 답</h3>
<div class="panel"><ul class="q">
<li>더블어택은 일반 공격만 두 배로 만든다. 가디언의 일반 공격은 143 → 286, 판게아리버스는 적용 여부와 관계없이 455다.</li>
<li>배틀필드는 아군의 일반 공격 피해를 두 배로 만든다. 콜로세움은 같은 효과에 적 약화를 더한다.</li>
<li>적에게는 선봉·중견·대장 자리 특성이 없다.</li>
<li>버프 오버로드가 적용되면 전장 표시와 하늘 상세에 필드 칸 5개가 표시된다.</li>
<li>계승한 스킬은 원래 주인의 이펙트로 재생된다.</li>
</ul></div>
</section>

<h2>한눈에</h2>
<div class="stats">
  <div><b>7</b>던전 (입문 + 테마 5 + 창조의 탑)</div>
  <div><b>130</b>아군 도트 (일러스트에서 88명 새로)</div>
  <div><b>28</b>사건</div><div><b>14</b>유물</div>
  <div><b>12</b>배경음</div><div><b>144</b>자동 테스트</div>
</div>
<div class="panel">플레이: <code>C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel\\card_pixel\\game\\dist\\Relaymare.html</code><br>
배경음 듣기: <code>C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel\\card_pixel\\game\\tools\\music-preview.html</code><br>
결정 전체: <code>card_pixel\\plan\\v1-decisions.md</code> · 작업 기록: <code>card_pixel\\history\\2026-11-20.md</code> · GPT 평가: <code>card_pixel\\history\\model-log.md</code></div>

<section>
<h2>11월 21일에 바뀐 것</h2>
<h3>재미 감사 뒤 새로 넣은 것</h3>
<div class="tour">${funChanges}</div>
<h3>검증 리뷰로 고친 것</h3>
<div class="tour">${reviewFixes}</div>
<h3>오늘의 균열</h3>
<div class="tour">${dailyRift}</div>
<h3>실행 파일과 소리</h3>
<div class="panel">
<p><code>card_pixel/game/dist/Relaymare.exe</code>를 열면 Chrome 앱 창에서 실행된다. Chrome이 없으면 Edge를 쓴다. 저장은 게임 전용 프로필에 남는다.</p>
<p>소유자 승인으로 내려받은 Galmuri 9·11·14를 게임에 내장해 인터넷이 없어도 같은 글꼴로 보인다.</p>
<p>음량을 잰 뒤 음악 마스터를 −14 dB에서 −10 dB로 올렸다. 아래는 조정 뒤 배경음 12곡의 측정값.</p>
<table class="music-levels"><tr><th>곡</th><th>최고 (dBFS)</th><th>RMS (dBFS)</th></tr>
${musicLevels.map(({ name, peakDbfs, rmsDbfs }) => `<tr><td>${esc(name)}</td><td>${peakDbfs.toFixed(1)}</td><td>${rmsDbfs.toFixed(1)}</td></tr>`).join('')}
</table></div>
</section>

<h2>화면 (Chrome 자동 플레이, 390×844)</h2>
<div class="tour">${tour.map(figure).join('')}
<figure><img src="${titleBack}" alt=""><figcaption>다시 켠 제목: 대표가 선다</figcaption></figure>
<figure><img src="${ending}" alt=""><figcaption>엔딩: 꿈길의 끝 (실제 원정으로 탑 보스를 이긴 뒤)</figcaption></figure>
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
