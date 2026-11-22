// Builds plan/skill-motion.html: every skill whose name reads one way while the battle shows another.
// Data: history/consults/2026-11-22-astra-skill-motion.json (audit by GPT-6.2 Astra). Decisions and design: Claude.
// Sprites come from game/assets (the cropped frames the game draws), embedded once each as CSS backgrounds.
// Usage: node card_pixel/plan/build-skill-motion.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, pageShell, pixelIcon } from './page-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const audit = JSON.parse(fs.readFileSync(path.join(root, 'history/consults/2026-11-22-astra-skill-motion.json'), 'utf8'));
const assets = path.join(root, 'game/assets');
const spriteMeta = JSON.parse(fs.readFileSync(path.join(assets, 'sprites.json'), 'utf8'));

// ---------- labels ----------
const CONTEXT = {
  ally: '동료', boss: '보스', wild: '야생', form: '변신형', heirloom: '유품', shadow: '그림자',
  basic: '기본 공격', roulette: '룰렛', lesson: '보스 예행', bossCharge: '보스 충전', tempo: '지역 박자'
};
const CONTEXT_ROWS = [
  ['ally', '출전 동료 고유 슬롯'], ['form', '변신형 고유 슬롯'], ['boss', '보스 고유 슬롯'], ['wild', '야생 고유 슬롯'],
  ['heirloom', '유품으로 쓸 때'], ['shadow', '그림자가 따라 쓸 때'], ['basic', '시전자별 기본 공격'],
  ['roulette', '룰렛이 부르는 기술'], ['lesson', '보스 예행'], ['bossCharge', '보스 충전'], ['tempo', '지역 박자']
];
const GROUPS = [
  ['native', '고유 기술', e => ['ally', 'boss', 'wild', 'form'].includes(e.context)],
  ['heirloom', '유품', e => e.context === 'heirloom'],
  ['shadow', '그림자', e => e.context === 'shadow'],
  ['basic', '기본 공격', e => e.context === 'basic'],
  ['other', '룰렛·예행·박자', e => ['roulette', 'lesson', 'bossCharge', 'tempo'].includes(e.context)]
];
const TYPE = { phy: '물리', mag: '마법', sup: '보조' };
const VERDICT = { mismatch: ['불일치', 'coral'], ambiguous: ['애매', 'gold'], ok: ['일치', 'aqua'] };
const families = audit.design.families;
const familyName = Object.fromEntries(families.map(f => [f.id, f.name]));
const PHASE_ONE = new Set(audit.design.firstWave.families);

// ---------- pixel icons for the 14 shared effects (16×16, drawn on a navy tile) ----------
const ICON_COLOR = {
  blade: '#9fe8ff', claw: '#ffd27a', thrust: '#c9f2ff', impact: '#ffc23a', bite: '#ff8fa3', shot: '#7ef0c8', orb: '#b9a4ff',
  breath: '#ff9b5c', ray: '#7ff3ff', fall: '#ffb36b', blast: '#ff7a8f', field: '#a99bff', drift: '#8ff0d6', mark: '#ffe27a'
};
const DRAW = {
  blade: ({ ring, set }) => { ring(3, 13, 11, 'a', -86, 2); ring(3, 13, 10, 'a', -72, -8); ring(3, 13, 9, 'b', -60, -24); set(14, 14, 'b'); },
  claw: ({ line }) => { for (const dx of [0, 4, 8]) { line(2 + dx, 2, 6 + dx, 13, 'a'); line(3 + dx, 5, 5 + dx, 10, 'b'); } },
  thrust: ({ line, set }) => {
    line(1, 8, 10, 8, 'a'); line(4, 7, 9, 7, 'a'); line(4, 9, 9, 9, 'a');
    for (const [x, y] of [[11, 8], [12, 7], [12, 8], [12, 9], [13, 6], [13, 7], [13, 8], [13, 9], [13, 10], [14, 7], [14, 8], [14, 9], [15, 8]]) set(x, y, 'b');
    line(2, 4, 6, 4, 'a'); line(3, 12, 7, 12, 'a');
  },
  impact: ({ line, disc }) => {
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4, r = i % 2 ? 4 : 7; line(8, 8, 8 + Math.cos(t) * r, 8 + Math.sin(t) * r, 'a'); }
    disc(8, 8, 2, 'b');
  },
  bite: ({ line, set }) => {
    line(1, 2, 14, 2, 'c'); line(1, 13, 14, 13, 'c');
    for (let t = 0; t < 4; t++) {
      const x = 1 + t * 4;
      for (const dx of [0, 1, 2]) { set(x + dx, 3, 'b'); set(x + dx, 12, 'b'); }
      set(x + 1, 4, 'b'); set(x + 1, 5, 'b'); set(x + 1, 11, 'b'); set(x + 1, 10, 'b');
    }
    set(7, 7, 'a'); set(8, 8, 'a'); set(9, 7, 'a'); set(7, 8, 'a');
  },
  shot: ({ set, disc }) => {
    for (let x = 1; x <= 10; x += 1.5) { const y = 12 - (x - 1) * 1.3 + (x - 1) * (x - 1) * 0.1; set(x, y, 'a'); }
    disc(12, 7, 2, 'a'); set(12, 6, 'b'); set(11, 6, 'b');
  },
  orb: ({ disc, set }) => { disc(8, 8, 4, 'a'); disc(8, 8, 2, 'b'); set(6, 6, 'b'); for (const [x, y] of [[2, 3], [14, 4], [3, 13], [13, 13]]) set(x, y, 'a'); },
  breath: ({ set }) => {
    for (let x = 1; x <= 15; x++) { const h = Math.floor(x / 2.6); for (let y = -h; y <= h; y++) set(x, 8 + y, Math.abs(y) < h - 1 ? 'b' : 'a'); }
    set(15, 3, null); set(14, 13, 'a'); set(13, 2, 'a');
  },
  ray: ({ line, disc }) => { line(3, 6, 15, 6, 'a'); line(3, 9, 15, 9, 'a'); line(3, 7, 15, 7, 'b'); line(3, 8, 15, 8, 'b'); disc(2, 7, 2, 'a'); disc(2, 8, 1, 'b'); },
  fall: ({ line, disc, set }) => {
    line(1, 1, 8, 8, 'a'); line(3, 1, 9, 7, 'a'); line(1, 3, 7, 9, 'a');
    disc(11, 11, 3, 'a'); set(10, 10, 'b'); set(11, 10, 'b'); set(10, 11, 'b');
  },
  blast: ({ ring, line }) => {
    ring(8, 8, 5, 'a', 0, 360, 2);
    for (let i = 0; i < 4; i++) { const t = Math.PI / 4 + i * Math.PI / 2; line(8 + Math.cos(t) * 6, 8 + Math.sin(t) * 6, 8 + Math.cos(t) * 8, 8 + Math.sin(t) * 8, 'b'); }
  },
  field: ({ set, line }) => {
    for (let a = 0; a < 360; a += 4) { const t = a * Math.PI / 180; set(8 + Math.cos(t) * 7, 11 + Math.sin(t) * 3, 'a'); }
    for (const [x, y] of [[1, 8], [15, 8], [1, 14], [15, 14]]) set(x, y, 'b');
    line(8, 2, 8, 8, 'b'); line(6, 4, 10, 4, 'a');
  },
  drift: ({ set }) => {
    for (let x = 0; x < 16; x++) { set(x, 9 + Math.round(2 * Math.sin(x / 2)), 'a'); set(x, 12 + Math.round(1.5 * Math.sin(x / 2 + 1.5)), 'a'); }
    for (const [x, y] of [[3, 4], [8, 3], [12, 5], [6, 6]]) set(x, y, 'b');
  },
  mark: ({ ring, line }) => { ring(8, 8, 6, 'a', 40, 320, 2); line(8, 8, 8, 4, 'b'); line(8, 8, 11, 8, 'b'); }
};
const icon = (id, scale = 3) => pixelIcon(16, { a: ICON_COLOR[id] ?? '#fff', b: '#ffffff', c: '#8c88d6' }, DRAW[id] ?? (() => {}), scale);

// ---------- sprites: one CSS class per frame, natural pixels, scaled down only when larger than the box ----------
const BOX = 84;
const FORM_ART = { mirror_cocoon: 'miracle_larva', aurora_wing: 'miracle_larva', abyss_wing: 'miracle_larva' };
const spriteRules = new Map();
function spriteId(ownerId) {
  const candidates = [ownerId, ownerId.replace(/^(wild_|shadow_|lesson_)/, ''), FORM_ART[ownerId]].filter(Boolean);
  return candidates.find(id => fs.existsSync(path.join(assets, `${id}-idle.png`))) ?? null;
}
function frame(id, pose, box = BOX) {
  const file = `${id}-${pose}.png`;
  const meta = spriteMeta[file];
  if (!meta) return '';
  const key = `s-${id}-${pose}-${box}`.replace(/[^a-z0-9_-]/gi, '_');
  if (!spriteRules.has(key)) {
    // Whole-pixel 2× when the box allows it (the two highlighted cases), otherwise natural size or a plain shrink.
    const fit = box / Math.max(meta.width, meta.height);
    const scale = fit >= 2 ? 2 : Math.min(1, fit);
    const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
    const data = fs.readFileSync(path.join(assets, file)).toString('base64');
    spriteRules.set(key, `.${key}{width:${w}px;height:${h}px;background:url(data:image/png;base64,${data}) 0 0/${w}px ${h}px no-repeat}`);
  }
  return `<i class="spr ${key}" role="img" aria-label="${esc(id)} ${pose === 'idle' ? '대기' : '공격'} 그림"></i>`;
}
function thumbs(entry, box = BOX) {
  const id = spriteId(entry.ownerId);
  if (!id) return `<div class="thumbs none"><span>그림 없음</span></div>`;
  const shadow = entry.context === 'shadow' ? ' shadow' : '';
  const used = entry.currentFrame === 'idle' ? 'idle' : 'attack';
  return `<div class="thumbs${shadow}">${['idle', 'attack'].map(pose => `
    <figure class="${pose === used ? 'used' : ''}">${frame(id, pose, box)}<figcaption>${pose === 'idle' ? '대기' : '공격'}${pose === used ? ' · 지금 씀' : ''}</figcaption></figure>`).join('')}</div>`;
}

// ---------- entry cards ----------
const verdictTag = v => `<span class="tag ${VERDICT[v]?.[1] ?? 'grey'}">${esc(VERDICT[v]?.[0] ?? v)}</span>`;
function chips(entry) {
  const type = TYPE[entry.type] ?? entry.type;
  return `${verdictTag(entry.verdict)} <span class="tag navy">${esc(CONTEXT[entry.context] ?? entry.context)}</span>
    ${type ? `<span class="tag grey">${esc(type)}${entry.tier ? ` ${esc(entry.tier)}티어` : ''}</span>` : ''}${entry.big ? ' <span class="tag violet">큰 연출</span>' : ''}`;
}
function entryCard(entry, { big = false } = {}) {
  const fam = entry.family;
  return `<article class="entry${big ? ' big' : ''}" data-group="${esc(GROUPS.find(([, , test]) => test(entry))?.[0] ?? 'other')}" data-verdict="${esc(entry.verdict)}"
      data-family="${esc(fam)}" data-text="${esc([entry.ownerName, entry.skill, entry.ownerId, entry.reads].join(' ').toLowerCase())}">
    ${thumbs(entry, big ? 200 : BOX)}
    <div class="body">
      <h3>${esc(entry.ownerName)} · <b>${esc(entry.skill)}</b></h3>
      <p class="chips">${chips(entry)}</p>
      <dl>
        <dt>이름이 말하는 동작</dt><dd><b>${esc(entry.reads)}</b> ${esc(entry.readDetail)}</dd>
        <dt>지금 화면</dt><dd>${esc(entry.shows)}</dd>
        <dt>고칠 방향</dt><dd><span class="fam"><i class="fi fi-${esc(fam)}"></i>${esc(familyName[fam] ?? fam)}${entry.variant ? ` · ${esc(entry.variant)}` : ''}</span> ${esc(entry.fix)}</dd>
      </dl>
      <details><summary>원인과 규칙</summary><p>${esc(entry.cause)}</p>${entry.rule ? `<p class="dim">기술 규칙: ${esc(entry.rule)}</p>` : ''}${entry.pose ? `<p class="dim">공격 그림: ${esc(entry.pose)}</p>` : ''}</details>
    </div></article>`;
}

// ---------- sections ----------
const byCase = new Map(audit.entries.map(entry => [entry.caseId, entry]));
const pick = ids => ids.map(id => byCase.get(id) ?? console.warn('missing case', id)).filter(Boolean);
const ownerCases = pick(['ally/ancient_dragon/2', 'ally/executor/3']);
const guillotineHeirloom = audit.entries.find(e => e.context === 'heirloom' && e.skill === '섀도우길로틴');
const priority = pick(['ally/red_dragon/3', 'ally/red_dragon/2', 'ally/zeke/2', 'ally/underdog/3', 'ally/trans_yeon_rabbit/2', 'boss/ares/2',
  'boss/creator_god/2', 'boss/gray/1', 'ally/sugar_powder/3', 'ally/phoenix/2', 'ally/fireworks_girl/2', 'boss/iris_love/3', 'ally/snow_rabbit/2', 'wild/wild_night_bat/1']);

const native = audit.counts.nativeSlots;
const pct = n => (100 * n / native.total).toFixed(1);
const summary = `
  <div class="stack" role="img" aria-label="고유 기술 ${native.total}개 중 불일치 ${native.mismatch}, 애매 ${native.ambiguous}, 일치 ${native.ok}">
    <span class="mis" style="width:${pct(native.mismatch)}%">불일치 ${native.mismatch}</span><span class="amb" style="width:${pct(native.ambiguous)}%">애매 ${native.ambiguous}</span><span class="okk" style="width:${pct(native.ok)}%">일치 ${native.ok}</span>
  </div>
  <p class="dim">동료 130명·변신 3형태·보스 11종·야생 9종이 가진 고유 기술 슬롯 ${native.total}개 기준입니다. 같은 기술을 유품·그림자·룰렛으로 쓰면 화면이 또 달라서, 아래 표처럼 사용 문맥별로 따로 셌습니다.</p>
  <div class="split">
    <div class="table"><table><thead><tr><th>조사 단위</th><th>전체</th><th>불일치</th><th>애매</th><th>일치</th></tr></thead><tbody>
      ${CONTEXT_ROWS.map(([key, label]) => { const c = audit.counts.byContext[key]; return c ? `<tr><td>${esc(label)}</td><td>${c.total}</td><td class="n-mis">${c.mismatch}</td><td>${c.ambiguous}</td><td>${c.ok}</td></tr>` : ''; }).join('')}
    </tbody></table></div>
    <div class="cards">
      <article class="card slim"><h3>왜 어긋나는가 — 원인 네 가지</h3><ol class="causes">
        <li><b>모양을 기술 이름이 아니라 위력·부가효과로 고릅니다.</b> 위력 4 이상이면 운석, 무작위 배율이면 작은 운석 다섯 개가 되는 식이라 어퍼컷·대검·낫질이 하늘에서 떨어집니다.</li>
        <li><b>근접 공격이 적에게 닿지 않습니다.</b> 거리와 관계없이 14px나 22px만 나아가서, 기본 공격 자세 153개 중 139개는 적과 틈이 남은 채 허공을 벱니다.</li>
        <li><b>공격 그림 한 장을 모든 기술이 같이 씁니다.</b> 에인션트드래곤의 공격 그림에는 브레스가 그려져 있어서 발톱 기술도 입김을 뿜습니다.</li>
        <li><b>변신형·유품은 다른 몸으로 시전합니다.</b> 변신해도 미라클라바 그림이 남고, 일부 유품은 물려받은 동료의 몸으로 나갑니다.</li>
      </ol></article>
    </div>
  </div>`;

const ownerSection = `
  <div class="cards">${ownerCases.map(entry => entryCard(entry, { big: true })).join('')}</div>
  ${guillotineHeirloom ? `<p class="dim">섀도우길로틴을 유품으로 쓰면 같은 함성 자세에서 큰 수평 광선이 나갑니다. 어느 경로든 수직으로 내리치는 그림자 날 하나로 맞춥니다.</p>` : ''}`;

const familyCount = audit.counts.nativeMismatchByProposedFamily;
const familySection = `
  <p class="dim">“조용함”은 기본 공격·보조용(프레임 3~4장), “큼”은 필살·유품용(5~6장)입니다. 큰 연출도 얼굴과 몸통 중심은 비우고, 접점의 획·잔상·소리로 세기를 냅니다.</p>
  <div class="cards fams">${families.map(f => `
    <article class="card fam-card${PHASE_ONE.has(f.id) ? ' first' : ''}">
      <div class="fam-head"><span class="tile">${icon(f.id, 3)}</span><div><h3>${esc(f.name)}</h3>
        <p class="chips">${PHASE_ONE.has(f.id) ? '<span class="tag aqua">1단계</span>' : '<span class="tag grey">2단계</span>'} <span class="tag navy">조용 ${f.frames.quiet} · 큼 ${f.frames.big}장</span> <span class="tag coral">불일치 ${familyCount[f.id] ?? 0}</span></p></div></div>
      <p>${esc(f.pixels)}</p><p class="dim">소리: ${esc(f.sound)}</p><p class="dim">움직임: ${esc(f.movement)}</p>
    </article>`).join('')}</div>`;

const deferredCalls = {
  'ally/fenrir/2': '발톱으로 갑니다. 그림이 얼음 발톱을 교차해 긁고 있어서, 송곳니 효과를 내면 드래곤크로와 같은 어긋남이 생깁니다. 접점은 적 몸에 닿게 고칩니다.',
  'ally/hellhound/3': '배트를 휘두르는 그림을 따릅니다. 굽은 배트 궤적(타격 계열) 끝에 송곳니 모양 섬광 하나를 붙여 이름도 살립니다.',
  'ally/ash/2': '운석을 유지합니다. 장르에서 아마겟돈은 운석이 표준이라 가장 잘 읽힙니다. 대신 시전 때 애쉬의 몸에서 불길이 솟아 HP를 태우는 대가를 먼저 보여 줍니다(2단계).',
  'boss/gray/2': '낫을 낮게 한 번 크게 휘두르고 잔상 두 겹을 남깁니다. 피해는 한 번 정산하므로 획도 한 번이고, 무작위 배율은 숫자로만 보여 줍니다.'
};
const stageStatus = { 1: ['이번 작업', 'aqua'], 2: ['다음 작업', 'gold'], 3: ['다음 작업', 'gold'], 4: ['Claude 검수', 'violet'] };
const planSection = `
  <div class="split">
    <div class="cards">
      <article class="card slim"><h3>구조 결정 — 채택</h3>
        <p><b>“어떤 몸짓으로 치는가”는 기술 자료가, “언제 맞고 무엇이 바뀌었나”는 기존 효과 계획이 정합니다.</b></p>
        <p>기술마다 계열·변형·거리·쓸 그림·출발점을 적은 표 한 곳(<code>game/src/content/skill-motions.js</code>)을 두고, 유품·그림자·룰렛도 원래 기술의 칸을 찾아가게 합니다. 지금처럼 위력 숫자로 모양을 고르지 않습니다.</p>
        <p class="dim">이름 일부만 보고 고르는 방식(소울드레인에서 ‘레인’을 찾는 식)은 쓰지 않습니다.</p></article>
      <article class="card slim"><h3>품질 기준 — Claude 추가</h3><ul>
        <li>상용 도트 게임에서 흔히 보는 모양을 기준으로 합니다. 베기는 가운데가 두껍고 끝이 가늘어지는 두 톤 초승달과 짧은 잔상, 타격은 각진 충격별과 작은 파편으로 그립니다. 1px 선 하나나 점 몇 개로 끝내지 않습니다.</li>
        <li>기본 공격은 짧게 다가가 한 번 닿고 작은 소리만 냅니다. 이름판·화면 확대·전체 섬광은 쓰지 않습니다.</li>
        <li>어떤 연출도 대기 동료와 싸우는 캐릭터의 얼굴을 가리지 않습니다.</li>
        <li>근접은 적의 몸에 실제로 닿아야 합니다. 목표 오차는 논리 0~2px입니다.</li></ul></article>
    </div>
    <div class="cards">
      <article class="card slim"><h3>단계</h3><ol class="stages">${audit.design.stages.map(s => `
        <li><span class="tag ${stageStatus[s.stage]?.[1] ?? 'grey'}">${esc(stageStatus[s.stage]?.[0] ?? '')}</span> <b>${s.stage}단계</b> · ${esc(s.effort)}<p>${esc(s.deliver)}</p></li>`).join('')}</ol></article>
      <article class="card slim"><h3>보류 4건 — Claude 판정</h3><ul class="calls">${audit.design.deferred.map(([key, skill]) => `
        <li><b>${esc(byCase.get(key)?.ownerName ?? key)} · ${esc(skill)}</b><p>${esc(deferredCalls[key] ?? '')}</p></li>`).join('')}</ul></article>
    </div>
  </div>`;

const groupCounts = Object.fromEntries(GROUPS.map(([id, , test]) => [id, audit.entries.filter(test).length]));
const listSection = `
  <div class="filters" id="groups">${GROUPS.map(([id, label], i) => `<button type="button" data-group="${id}" aria-pressed="${i === 0}">${esc(label)} ${groupCounts[id]}</button>`).join('')}</div>
  <div class="filters"><input type="search" id="q" placeholder="동료·기술 이름 검색">
    <button type="button" data-verdict="" aria-pressed="true" class="v">전체</button><button type="button" data-verdict="mismatch" aria-pressed="false" class="v">불일치만</button><button type="button" data-verdict="ambiguous" aria-pressed="false" class="v">애매만</button>
    <select id="fam"><option value="">모든 계열</option>${families.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select>
    <span id="shown" class="dim"></span></div>
  <div class="entries">${audit.entries.map(entry => entryCard(entry)).join('')}</div>`;

// A function so the sprite rules are read after every section has rendered its thumbnails.
const css = () => `
.stack { display: flex; height: 34px; margin: 4px var(--u) 8px; box-shadow: 0 0 0 var(--u) var(--navy); font-size: 13px; font-weight: 700; color: #fff; }
.stack span { display: flex; align-items: center; justify-content: center; white-space: nowrap; overflow: hidden; }
.stack .mis { background: var(--coral); } .stack .amb { background: var(--gold); color: var(--gold-ink); } .stack .okk { background: var(--aqua-lo); }
td.n-mis { color: var(--coral); font-weight: 700; }
.causes { margin: 4px 0; padding-left: 20px; } .causes li { margin: 6px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0 6px; }
.entries, #owner .cards, #priority .cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); }
.entry { display: grid; grid-template-columns: auto 1fr; gap: 10px; background: #fff; padding: 10px; margin: var(--u);
  box-shadow: 0 0 0 var(--u) var(--navy), 0 calc(3 * var(--u)) 0 var(--u) rgba(41,38,106,.18); }
.entry[data-verdict="mismatch"] { box-shadow: inset calc(2 * var(--u)) 0 0 var(--coral), 0 0 0 var(--u) var(--navy), 0 calc(3 * var(--u)) 0 var(--u) rgba(41,38,106,.18); }
.entry h3 { margin: 0; font-size: 15px; color: var(--ink); } .entry h3 b { color: var(--navy2); }
.entry dl { margin: 0; font-size: 13.5px; } .entry dt { margin-top: 4px; color: var(--ink2); font-size: 12px; font-weight: 700; } .entry dd { margin: 0; }
.entry details { margin-top: 6px; font-size: 13px; } .entry summary { cursor: pointer; color: var(--navy2); font-weight: 700; }
.entry.big { grid-template-columns: 1fr; } .entry > .thumbs { align-self: start; } .entry.big dl { font-size: 14.5px; }
#owner .cards { grid-template-columns: repeat(auto-fill, minmax(min(100%, 560px), 1fr)); }
.thumbs { display: flex; flex-wrap: wrap; gap: 4px; align-items: flex-end; }
.thumbs figure { margin: 0; display: grid; justify-items: center; gap: 2px; padding: 4px 4px 2px; background: linear-gradient(#e9f2ff, #f4efff);
  box-shadow: 0 0 0 var(--u) var(--line); }
.thumbs figure.used { box-shadow: 0 0 0 var(--u) var(--aqua-lo); background: linear-gradient(#dffaf7, #f0fbff); }
.thumbs figcaption { font-size: 11px; color: var(--ink2); white-space: nowrap; } .thumbs figure.used figcaption { color: var(--aqua-lo); font-weight: 700; }
.thumbs.shadow .spr { filter: brightness(.18) saturate(0) drop-shadow(0 0 1px #6c5cff); }
.thumbs.none { width: 84px; height: 84px; display: grid; place-items: center; background: var(--paper2); color: var(--ink2); font-size: 12px; box-shadow: 0 0 0 var(--u) var(--line); }
.spr { display: block; image-rendering: pixelated; }
.fam { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px 0 0; margin-right: 4px; font-weight: 700; color: var(--navy2); background: var(--paper2); white-space: nowrap; }
.fi { display: inline-block; width: 16px; height: 16px; background-color: var(--navy); background-size: 16px 16px; image-rendering: pixelated; }
${families.map(f => `.fi-${f.id}{background-image:url("data:image/svg+xml,${encodeURIComponent(icon(f.id, 1))}")}`).join(' ')}
.fams { grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.fam-card.first { box-shadow: 0 0 0 var(--u) var(--aqua-lo), 0 calc(3 * var(--u)) 0 var(--u) rgba(15,154,170,.25); }
.fam-head { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
.tile { display: grid; place-items: center; width: 60px; height: 60px; flex: none; background: var(--navy); box-shadow: inset 0 0 0 var(--u) #4b46a8; }
.stages, .calls { margin: 4px 0; padding-left: 18px; } .stages li, .calls li { margin: 6px 0; } .calls { list-style: square; }
#fam { padding: 5px 6px; font: inherit; font-size: 13px; border: 0; background: #fff; color: var(--navy); box-shadow: 0 0 0 var(--u) var(--navy); }
${[...spriteRules.values()].join('\n')}
@media (max-width: 560px) { .entry { grid-template-columns: 1fr; } .thumbs { justify-content: flex-start; } }
`;

const body = `
<section id="summary"><h2>한눈에</h2>${summary}</section>
<section id="owner"><h2>짚어 주신 두 사례</h2>${ownerSection}</section>
<section id="priority"><h2>먼저 고칠 사례</h2><div class="cards">${priority.map(entry => entryCard(entry)).join('')}</div></section>
<section id="families"><h2>공용 이펙트 14종</h2>${familySection}</section>
<section id="plan"><h2>결정과 진행</h2>${planSection}</section>
<section id="list"><h2>전체 목록 (불일치·애매 ${audit.entries.length}건)</h2>${listSection}</section>`;

const script = `
const state = { group: 'native', verdict: '', family: '', term: '' };
const entries = [...document.querySelectorAll('#list .entry')];
const shown = document.querySelector('#shown');
function apply() {
  let n = 0;
  for (const el of entries) {
    const hide = el.dataset.group !== state.group || (state.verdict && el.dataset.verdict !== state.verdict) ||
      (state.family && el.dataset.family !== state.family) || (state.term && !el.dataset.text.includes(state.term));
    el.hidden = hide; if (!hide) n++;
  }
  shown.textContent = n + '건 표시';
}
function press(selector, button) { for (const other of document.querySelectorAll(selector)) other.setAttribute('aria-pressed', String(other === button)); }
for (const b of document.querySelectorAll('#groups button')) b.addEventListener('click', () => { state.group = b.dataset.group; press('#groups button', b); apply(); });
for (const b of document.querySelectorAll('button.v')) b.addEventListener('click', () => { state.verdict = b.dataset.verdict; press('button.v', b); apply(); });
document.querySelector('#fam').addEventListener('change', e => { state.family = e.target.value; apply(); });
document.querySelector('#q').addEventListener('input', e => { state.term = e.target.value.trim().toLowerCase(); apply(); });
apply();
`;

const html = pageShell({
  title: '다음은 너 · 스킬 연출 전수조사',
  subtitle: '기술 이름이 말하는 동작과 전투 화면이 다른 곳 · 2026-11-22 · 조사 GPT‑6.2 Astra, 판정·디자인 Claude',
  toc: [['summary', '한눈에'], ['owner', '짚어 주신 사례'], ['priority', '먼저 고칠 것'], ['families', '공용 이펙트'], ['plan', '결정·진행'], ['list', '전체 목록']],
  body,
  css: css(),
  script
});
fs.writeFileSync(path.join(here, 'skill-motion.html'), html);
console.log('skill-motion.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB', 'sprites', spriteRules.size, 'entries', audit.entries.length);
