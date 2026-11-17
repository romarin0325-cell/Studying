/* Relay trial: screens and the battle event player.
   Flow: title → first awakening → map (7 floors, doors) → order → battle → result → map …
         springs (summons), chaos altar, the gate's free pick, boss, end.
   Rules live in bridge.js (battle) and run.js (expedition); this file only shows and asks.
   Battle screen (portrait phone): scene on top, the three-fighter relay strip, one message line,
   four command tiles and the heirloom / retreat row inside thumb reach. */
(function () {
  'use strict';
  const core = window.RelayCore, Bridge = window.RelayBridge, R = window.RelayRun, St = window.RelayStage, ASSETS = window.RELAY_ASSETS;
  const Roster = window.RelayRoster, roster = Roster.create(core, ASSETS);
  const { ELEMENT, GRADE, POSITION } = Roster;
  const { S, clock, wait, tween, sfx } = St;
  const $ = (q, r) => (r || document).querySelector(q);
  const $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const card = id => core.GameUtils.getCardById(id);
  const clone = o => JSON.parse(JSON.stringify(o));
  const same = (a, b) => !!a && !!b && a.side === b.side && a.idx === b.idx;
  const params = new URLSearchParams(location.search);
  const TYPE = { phy: '물리', mag: '마법', sup: '보조' };
  const GOOD = ['guard', 'evasion', 'barrier', 'magic_guard', 'damage_half'];
  const FIELD = {
    sun_bless: ['태양', '#ffb347'], moon_bless: ['달', '#7fb3ff'], sanctuary: ['성역', '#fff1a8'], goddess_descent: ['여신', '#ffd6f0'],
    destiny_oath: ['서약', '#ff8fb1'], earth_bless: ['대지', '#9ad06a'], twinkle_party: ['트윙', '#ffe07a'], star_powder: ['별', '#cfe3ff'],
    valentine: ['발렌', '#ff7aa8'], arena: ['투기', '#ff7a5a'], reaper_realm: ['사신', '#a678ff'], gale: ['질풍', '#7fe3c8']
  };
  const LINKED_TRAITS = ['ally_death_base_atk_phy', 'ally_light_death_base_matk_mag'];
  const DOOR = {
    wild: ['전투', '몽마가 기다린다'], elite: ['정예', '접두사 둘을 단 강적'], gate: ['문지기', '그림자의 릴레이 · 이기면 한 명이 동료가 된다'],
    boss: ['보스', '꿈의 주인'], spring: ['소환의 샘', '꿈의 결정으로 동료를 깨운다'], altar: ['혼돈의 제단', '무작위 동료에게 축복 · 세 번까지 굴린다']
  };

  /* ---------- sprites in the DOM ---------- */
  const spr = (id, pose) => ASSETS.sp[id + '-' + (pose || 'idle')] || ASSETS.sp[id + '-idle'];
  function sprite(id, o) {
    const m = spr(id, o && o.pose); if (!m) return '';
    const cls = ['px'].concat(o && o.cls ? [o.cls] : []).join(' ');
    const style = (o && o.flip ? 'transform:scaleX(-1);' : '') + (o && o.style ? o.style : '');
    return '<img class="' + cls + '" alt="" src="' + m.src + '" width="' + m.w + '" height="' + m.h + '"' + (style ? ' style="' + style + '"' : '') + '>';
  }
  const face = (id, box) => { const m = spr(id); return m ? sprite(id, { style: 'margin-left:' + Math.round((box || 40) / 2 - m.cx) + 'px;margin-top:-2px' }) : ''; };
  const foeFlip = def => (def.facing || 'right') === 'right';

  /* ---------- page skeleton ---------- */
  const titleLine = ['luna', 'ash', 'red_dragon'].filter(id => spr(id));
  document.getElementById('app').innerHTML =
    '<div id="frame">' +
    '<section id="title" class="screen on"><div class="logo">다음은 너<small>RELAYMARE · 가제</small></div>' +
    '<div class="line">' + titleLine.map(id => sprite(id)).join('<i>▶</i>') + '</div>' +
    '<p class="pitch">쓰러진 동료가 다음 동료의 힘이 된다.</p>' +
    '<button class="btn go" id="b-start">꿈길로 들어간다</button>' +
    '<p class="sm">도트 릴레이 시험판 · 일곱 층 · 약 10분<br>전투 수치는 카드 게임의 규칙 파일로 계산한다.</p></section>' +
    '<section id="awaken" class="screen"></section><section id="map" class="screen"></section><section id="order" class="screen"></section>' +
    '<section id="spring" class="screen"></section><section id="altar" class="screen"></section><section id="pick" class="screen"></section><section id="end" class="screen"></section>' +
    '<section id="battle" class="screen">' +
    '<header id="bar"><span id="room"></span><span id="turn"></span><button id="b-quirk" class="quirk"></button><span class="sp"></span><span id="gems"></span><button id="b-speed">1배</button><button id="b-sound" class="on">소리</button><button id="b-log">기록</button></header>' +
    '<div id="stage"><canvas id="cv"></canvas><div id="hud">' +
    '<div id="foebar"><div class="nm"><i id="pf-kind"></i><b id="pf-name"></b><em id="pf-el"></em><span id="pf-hpn"></span></div><div class="bar hp"><u id="pf-hp"></u></div><div class="row"><div class="chips" id="pf-chips"></div><div class="cd" id="pf-cd"></div></div></div>' +
    '<div class="sky" id="sky"><i></i><i></i><i></i><span id="skyname"></span></div>' +
    '<div class="chips" id="pa-chips"></div>' +
    '<div class="intent" id="intent"></div></div><div id="fx"></div><div id="skip">▶▶ 넘기는 중</div></div>' +
    '<div id="party"></div>' +
    '<div id="msg"><div id="ticker"></div><div id="tally"></div></div>' +
    '<div id="panel"><div id="acts"></div><div id="row2"><button id="b-heir"></button><button id="b-retreat"></button></div></div>' +
    '<div class="overlay" id="logbook"><div class="body" id="logbody"></div><button class="btn" id="b-logclose">닫기</button></div>' +
    '<div class="sheet" id="result"><div class="in win" id="result-in"></div></div>' +
    '</section>' +
    '<div class="sheet" id="sheet"><div class="in win"><h3 id="sh-title"></h3><p id="sh-body"></p><button class="btn" id="b-sheetclose">닫기</button></div></div>' +
    '</div>';
  const show = id => $$('.screen').forEach(s => { const on = s.id === id; if (!on && s.classList.contains('on') && !['title', 'battle'].includes(s.id)) s.innerHTML = ''; s.classList.toggle('on', on); });
  function sheet(title, body) { $('#sh-title').textContent = title; $('#sh-body').textContent = body; $('#sheet').classList.add('on'); }
  $('#b-sheetclose').addEventListener('click', () => $('#sheet').classList.remove('on'));
  $('#sheet').addEventListener('click', ev => { if (ev.target.id === 'sheet') $('#sheet').classList.remove('on'); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- shared bits of the non-battle screens ---------- */
  let run = null;
  const head = (title, sub) => '<header class="top"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '<span class="sp"></span><span class="gems">◆ ' + (run ? run.crystals : 0) + '</span></header>';
  function badges(id) {
    const out = [];
    if (run && run.blessings[id]) out.push('<i class="bless">축복 +' + Math.round(run.blessings[id] * 100) + '%</i>');
    if (run && run.heirlooms[id]) out.push('<i class="heir">유품 ' + esc(run.heirlooms[id].name) + '</i>');
    return out.join('');
  }
  function cardRow(id, o) {
    const c = card(id), opt = o || {};
    return '<button class="cardrow win g-' + c.grade + (opt.cls ? ' ' + opt.cls : '') + '" data-id="' + id + '"><span class="pic">' + sprite(id) + '</span><span class="txt">' +
      '<div class="nm">' + esc(c.name) + '<i class="grade">' + (GRADE[c.grade] || c.grade) + '</i><i class="el-' + c.element + '">' + ELEMENT[c.element] + '</i></div>' +
      '<div class="st">HP ' + c.stats.hp + ' · 공 ' + c.stats.atk + ' · 마공 ' + c.stats.matk + ' · 방 ' + c.stats.def + '/' + c.stats.mdef + '</div>' +
      '<div class="trait">' + esc(c.trait.desc) + '</div>' +
      (opt.skills !== false ? '<div class="sk">' + c.skills.map(s => esc(s.name) + '<small>' + TYPE[s.type] + (s.cost ? ' ' + s.cost : '') + '</small>').join(' · ') + '</div>' : '') +
      '<div class="badges">' + badges(id) + '</div></span></button>';
  }
  const affixChips = def => (def.affixes || []).map(a => '<i class="affix">' + esc(Bridge.AFFIXES[a].name) + '</i>').join('');

  /* ---------- first awakening ---------- */
  function awakenScreen() {
    const node = $('#awaken'), choices = R.pickChoices(run, roster, 3);
    node.innerHTML = head('첫 깨우기') + '<div class="scroll"><p class="lead">셋 가운데 한 명을 깨운다. 고르지 않은 둘은 악몽이 되어 4층 문지기로 설 수 있다.</p>' +
      '<div class="cards">' + choices.map(id => cardRow(id)).join('') + '</div></div>' +
      '<div class="footer"><button class="btn go" id="b-wake" disabled>한 명을 고른다</button></div>';
    show('awaken');
    let pickId = null;
    $$('.cardrow', node).forEach(b => b.addEventListener('click', () => {
      pickId = b.dataset.id; sfx.tap();
      $$('.cardrow', node).forEach(x => x.classList.toggle('sel', x === b));
      const go = $('#b-wake'); go.disabled = false; go.textContent = card(pickId).name + '을(를) 깨운다';
    }));
    $('#b-wake').addEventListener('click', async () => {
      if (!pickId) return;
      R.takePick(run, choices, pickId); sfx.awaken();
      const extra = [R.drawAwaken(run, roster, true), R.drawAwaken(run, roster, true)].filter(Boolean);
      node.innerHTML = head('첫 깨우기') + '<div class="scroll"><p class="lead">꿈이 두 명을 더 데려왔다. 이 셋이 출발 동료다.</p><div class="cards" id="reveal"></div></div>' +
        '<div class="footer"><button class="btn go" id="b-depart" disabled>꿈길로</button></div>';
      const box = $('#reveal');
      box.insertAdjacentHTML('beforeend', cardRow(pickId, { skills: false }));
      for (const id of extra) await reveal(box, id);
      const go = $('#b-depart'); go.disabled = false; go.addEventListener('click', () => { sfx.tap(); toMap(true); });
    });
  }
  /** Slot-style reveal of a woken character. */
  async function reveal(box, id) {
    const c = card(id), slot = document.createElement('div');
    slot.className = 'revealing win';
    box.appendChild(slot);
    const pool = run.pool;
    for (let i = 0; i < 9; i++) { slot.innerHTML = '<span class="pic">' + sprite(pool[Math.floor(Math.random() * pool.length)], { cls: 'sil' }) + '</span>'; sfx.roll(); await sleep(55 + i * 12); }
    slot.outerHTML = cardRow(id, { skills: false, cls: 'pop' });
    (c.grade === 'legend' ? sfx.jackpot : sfx.awaken)();
    await sleep(240);
  }

  /* ---------- map ---------- */
  function toMap(advance) {
    if (advance) R.nextFloor(run, roster);
    if (run.floor > R.FLOORS || run.result) return endScreen();
    const node = $('#map'), boss = roster.bossOf(run.boss);
    const track = Array.from({ length: R.FLOORS }, (_, i) => {
      const f = i + 1, cls = f < run.floor ? 'done' : f === run.floor ? 'cur' : '';
      return '<i class="' + cls + (f === 4 ? ' gate' : '') + (f === R.FLOORS ? ' boss' : '') + '">' + (f === R.FLOORS ? '★' : f) + '</i>';
    }).join('<u></u>');
    node.innerHTML = head('꿈길 ' + run.floor + '층', run.floor === R.FLOORS ? '꿈의 주인' : run.floor === 4 ? '문지기' : '') + '<div class="scroll">' +
      '<div class="track">' + track + '</div>' +
      '<div class="bosscard win"><span class="pic">' + sprite(boss.sprite, { flip: foeFlip(boss), cls: boss.look === 'boss' ? 'boss-tint' : '' }) + '</span><span class="txt"><small>이번 꿈의 주인</small><b>' + esc(boss.name) + '</b><p>' + esc(boss.note) + '</p></span></div>' +
      '<h3>문을 고른다</h3><div class="doors">' + run.doors.map(doorCard).join('') + '</div>' +
      '<h3>동료 <span class="sm">' + run.bench.length + '명' + (run.fallen.length ? ' · 쓰러짐 ' + run.fallen.length : '') + '</span></h3>' +
      '<div class="benchrow">' + run.bench.map(id => '<span class="mini g-' + card(id).grade + '">' + face(id, 40) + (run.heirlooms[id] ? '<i class="h">유</i>' : '') + (run.blessings[id] ? '<i class="b">축</i>' : '') + '</span>').join('') + '</div>' +
      '</div>';
    show('map');
    $$('.door', node).forEach(b => b.addEventListener('click', () => { St.unlockAudio(); sfx.tap(); enterDoor(run.doors[Number(b.dataset.i)]); }));
  }
  function doorCard(door, i) {
    const t = DOOR[door.type];
    let body = '';
    if (door.enemies.length) {
      body += '<div class="foes">' + door.enemies.map(e => '<span class="foe">' + sprite(e.sprite, { flip: foeFlip(e), cls: door.type === 'boss' ? (e.look === 'boss' ? 'boss-tint' : '') : 'sil' }) + '<i class="dot el-' + e.element + '">' + ELEMENT[e.element] + '</i>' + affixChips(e) + '</span>').join('') + '</div>';
      if (door.quirk) { const q = Bridge.QUIRKS[door.quirk]; body += '<div class="qbox"><b>꿈의 변덕 · ' + esc(q.name) + '</b><span>' + esc(q.desc) + '</span></div>'; }
      if (door.type === 'gate' && door.fromUnchosen) body += '<p class="sm">네가 깨우지 않은 꿈이 섞여 있다.</p>';
    }
    const reward = ['wild', 'elite', 'gate'].includes(door.type) ? '<span class="rw">◆ +' + door.reward + (door.type === 'gate' ? ' · 동료 1' : '') + '</span>' : '';
    return '<button class="door win t-' + door.type + '" data-i="' + i + '"><span class="dt"><b>' + t[0] + '</b><small>' + t[1] + '</small>' + reward + '</span>' + body + '</button>';
  }
  function enterDoor(door) {
    run.door = door;
    if (door.type === 'spring') return springScreen();
    if (door.type === 'altar') return altarScreen();
    orderScreen();
  }

  /* ---------- order ---------- */
  function orderScreen() {
    const door = run.door, node = $('#order'), all = core.GameUtils.getAllCards();
    let slots = run.bench.slice(0, 3);
    function draw() {
      const deck = [slots[0] || null, slots[1] || null, slots[2] || null];
      const slotHtml = [0, 1, 2].map(i => {
        const id = deck[i];
        if (!id) return '<button class="slot win" data-slot="' + i + '"><span class="pos">' + POSITION[i] + '</span><span class="empty">＋</span></button>';
        const c = card(id), init = core.Logic.calculateInitialStats(c, deck, all, i), notes = [];
        if (c.trait.type === 'pos_stat_boost') notes.push(c.trait.pos === i ? '자리 효과 발동' : POSITION[c.trait.pos] + ' 전용 효과');
        else if (/^syn_/.test(c.trait.type)) notes.push(init.activeTrait ? '시너지 발동' : '시너지 조건 부족');
        return '<button class="slot win" data-slot="' + i + '"><span class="pos">' + POSITION[i] + '</span><span class="pic">' + sprite(id) + '</span><span class="nm">' + esc(c.name) + '</span><span class="fx">' + esc(notes.join(' · ')) + '</span><span class="badges">' + badges(id) + '</span></button>';
      }).join('');
      const q = door.quirk && Bridge.QUIRKS[door.quirk];
      node.innerHTML = head(DOOR[door.type][0], '꿈길 ' + run.floor + '층') + '<div class="scroll">' +
        '<div class="foelist">' + door.enemies.map((e, k) => '<div class="foeline win"><span class="pic">' + sprite(e.sprite, { flip: foeFlip(e), cls: e.look === 'boss' ? 'boss-tint' : e.look === 'shadow' ? 'shadow-tint' : '' }) + '</span><span class="txt"><b>' + (door.enemies.length > 1 ? (k + 1) + '. ' : '') + esc(e.name) + ' <i class="el-' + e.element + '">' + ELEMENT[e.element] + '</i></b>' +
          (e.affixes && e.affixes.length ? '<span class="afx">' + e.affixes.map(a => '<i>' + esc(Bridge.AFFIXES[a].name) + '</i> ' + esc(Bridge.AFFIXES[a].desc)).join('<br>') + '</span>' : '') + (e.note ? '<span class="afx">' + esc(e.note) + '</span>' : '') + '</span></div>').join('') + '</div>' +
        (q ? '<div class="qbox"><b>꿈의 변덕 · ' + esc(q.name) + '</b><span>' + esc(q.desc) + '</span></div>' : '') +
        '<h3>출전 순서</h3><p class="sm">선봉부터 싸운다. 쓰러지면 다음 자리가 이어받고, 쓰러진 동료의 가장 강한 공격이 유품으로 넘어간다.</p>' +
        '<div class="slots">' + slotHtml + '</div>' +
        '<h3>동료 <span class="sm">누르면 빈 자리에 선다 · 자리를 누르면 내려온다</span></h3>' +
        '<div class="cards">' + run.bench.map(id => cardRow(id, { cls: slots.includes(id) ? 'used' : '' })).join('') + '</div></div>' +
        '<div class="footer"><button class="btn back" id="b-back">돌아가기</button><button class="btn go" id="b-go"' + (slots.length ? '' : ' disabled') + '>출전 (' + slots.length + '명)</button></div>';
      $$('.slot', node).forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.slot); if (slots[i]) { slots.splice(i, 1); sfx.tap(); draw(); } }));
      $$('.cardrow', node).forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.id; sfx.tap();
        if (slots.includes(id)) slots = slots.filter(x => x !== id); else if (slots.length < 3) slots.push(id);
        draw();
      }));
      $('#b-back').addEventListener('click', () => { sfx.tap(); toMap(false); });
      $('#b-go').addEventListener('click', () => { if (!slots.length) return; run.bench = slots.concat(run.bench.filter(id => !slots.includes(id))); St.unlockAudio(); startBattle(slots); });
    }
    draw(); show('order');
  }

  /* ---------- spring ---------- */
  function springScreen(fresh) {
    const node = $('#spring');
    const recent = fresh || [];
    node.innerHTML = head('소환의 샘', '꿈길 ' + run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">꿈의 결정을 바쳐 잠든 동료를 깨운다. 같은 동료는 둘 깨울 수 없다.</p>' +
      '<div class="svc"><button class="btn big" id="b-draw"' + (run.crystals >= R.COST.draw ? '' : ' disabled') + '><b>깨우기</b><small>◆ ' + R.COST.draw + ' · 무작위 한 명</small><small>노멀 40 · 레어 30 · 에픽 20 · 전설 10</small></button>' +
      '<button class="btn big" id="b-pick"' + (run.crystals >= R.COST.pick ? '' : ' disabled') + '><b>골라 깨우기</b><small>◆ ' + R.COST.pick + ' · 셋 중 하나</small><small>노멀 25 · 레어 30 · 에픽 25 · 전설 20</small></button></div>' +
      '<div class="cards" id="fresh">' + recent.map(id => cardRow(id, { skills: false, cls: 'pop' })).join('') + '</div>' +
      '<h3>동료 <span class="sm">' + run.bench.length + '명</span></h3><div class="benchrow">' + run.bench.map(id => '<span class="mini g-' + card(id).grade + '">' + face(id, 40) + '</span>').join('') + '</div></div>' +
      '<div class="footer"><button class="btn go" id="b-leave">샘을 떠난다</button></div>';
    show('spring');
    $('#b-draw').addEventListener('click', async () => {
      const id = R.drawAwaken(run, roster, false); if (!id) return;
      $$('#spring .btn').forEach(b => { b.disabled = true; });
      const box = $('#fresh'); box.innerHTML = '';
      await reveal(box, id);
      springScreen([id]);
    });
    $('#b-pick').addEventListener('click', () => {
      const choices = R.pickChoices(run, roster, 3);
      if (!choices.length || !R.payPick(run)) return;
      sfx.tap();
      node.innerHTML = head('골라 깨우기') + '<div class="scroll"><p class="lead">한 명을 고른다. 고르지 않은 꿈은 악몽이 되어 문지기로 설 수 있다.</p><div class="cards">' + choices.map(id => cardRow(id)).join('') + '</div></div>' +
        '<div class="footer"><button class="btn go" id="b-take" disabled>한 명을 고른다</button></div>';
      let sel = null;
      $$('.cardrow', node).forEach(b => b.addEventListener('click', () => { sel = b.dataset.id; sfx.tap(); $$('.cardrow', node).forEach(x => x.classList.toggle('sel', x === b)); const go = $('#b-take'); go.disabled = false; go.textContent = card(sel).name + '을(를) 깨운다'; }));
      $('#b-take').addEventListener('click', () => { if (!sel) return; R.takePick(run, choices, sel); (card(sel).grade === 'legend' ? sfx.jackpot : sfx.awaken)(); springScreen([sel]); });
    });
    $('#b-leave').addEventListener('click', () => { sfx.tap(); toMap(true); });
  }

  /* ---------- chaos altar ---------- */
  function altarScreen() {
    const node = $('#altar');
    let left = 3, current = null;
    function draw() {
      const c = current && card(current.id);
      node.innerHTML = head('혼돈의 제단', '꿈길 ' + run.floor + '층') + '<div class="scroll">' +
        '<p class="lead">무작위 동료 한 명이 축복을 받는다. 등급이 낮을수록 크게 받고(노멀 +40% … 전설 +10%), 드물게 대박(2.5배)이 터진다. 세 번까지 굴릴 수 있고 마지막 결과가 남는다. 축복은 원정이 끝날 때까지 간다.</p>' +
        '<div class="altarslot win' + (current && current.jackpot ? ' jackpot' : '') + '" id="slot">' + (c ? '<span class="pic">' + sprite(current.id) + '</span><span class="txt"><b>' + esc(c.name) + '</b><strong>+' + Math.round(current.mult * 100) + '%</strong><small>' + (current.jackpot ? '대박! ' : '') + (GRADE[c.grade] || '') + ' · 체력·공격·방어 모두</small></span>' : '<span class="empty">?</span>') + '</div>' +
        '</div><div class="footer"><button class="btn" id="b-roll"' + (left ? '' : ' disabled') + '>굴린다 (남은 ' + left + ')</button><button class="btn go" id="b-keep"' + (current ? '' : ' disabled') + '>' + (current ? (left ? '이걸로 정한다' : '받아들인다') : '먼저 굴린다') + '</button></div>';
      $('#b-roll').addEventListener('click', roll);
      $('#b-keep').addEventListener('click', () => { R.altarKeep(run, current); sfx.awaken(); toMap(true); });
    }
    async function roll() {
      if (!left) return;
      left--; $$('#altar .btn').forEach(b => { b.disabled = true; });
      const slot = $('#slot');
      for (let i = 0; i < 12; i++) { const id = run.bench[i % run.bench.length]; slot.innerHTML = '<span class="pic">' + sprite(id) + '</span><span class="txt"><b>…</b></span>'; sfx.roll(); await sleep(45 + i * 10); }
      current = R.altarRoll(run, roster);
      (current.jackpot ? sfx.jackpot : sfx.buff)();
      draw();
    }
    draw(); show('altar');
  }

  /* ---------- gate reward ---------- */
  function pickScreen(choices) {
    const node = $('#pick');
    node.innerHTML = head('그림자가 깨어났다') + '<div class="scroll"><p class="lead">쓰러뜨린 그림자가 꿈으로 돌아왔다. 한 명이 동료가 된다.</p><div class="cards">' + choices.map(id => cardRow(id)).join('') + '</div></div>' +
      '<div class="footer"><button class="btn back" id="b-gate-skip">데려가지 않는다</button><button class="btn go" id="b-gate-take" disabled>한 명을 고른다</button></div>';
    show('pick');
    let sel = null;
    $$('.cardrow', node).forEach(b => b.addEventListener('click', () => { sel = b.dataset.id; sfx.tap(); $$('.cardrow', node).forEach(x => x.classList.toggle('sel', x === b)); const go = $('#b-gate-take'); go.disabled = false; go.textContent = card(sel).name + '을(를) 데려간다'; }));
    $('#b-gate-take').addEventListener('click', () => { if (!sel) return; run.bench.push(sel); sfx.awaken(); toMap(true); });
    $('#b-gate-skip').addEventListener('click', () => { sfx.tap(); toMap(true); });
  }

  /* ---------- end ---------- */
  function endScreen() {
    const node = $('#end'), won = run.result === 'win', st = run.stats;
    const rows = [['도달한 층', Math.min(run.floor, R.FLOORS) + ' / ' + R.FLOORS], ['전투', st.battles + '회 · ' + st.turns + '턴'], ['최고 피해', st.best ? st.best.toLocaleString('en-US') + (st.bestBy ? ' (' + st.bestBy + ')' : '') : '-'],
      ['쓰러진 동료', run.fallen.map(id => card(id).name).join(', ') || '없음'], ['유품 사용', st.heirloomsUsed + '회'], ['최후의 일인', st.lastStands + '회'], ['대박 축복', st.jackpots + '회']];
    node.innerHTML = head(won ? '원정 성공' : '꿈에서 깨어났다') + '<div class="scroll">' +
      '<p class="lead">' + (won ? '꿈의 주인을 쓰러뜨렸다. 살아 돌아온 동료 가운데 한 명을 영입한다.' : '모두 쓰러졌다. 출전 순서와 유품, 물러나기를 바꿔 다시 들어가 보자.') + '</p>' +
      (won ? '<div class="cards">' + run.bench.map(id => cardRow(id, { skills: false })).join('') + '</div><p class="gain" id="recruited"></p>' : '') +
      '<table class="sumtable">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + esc(String(r[1])) + '</td></tr>').join('') + '</table>' +
      '<p class="note">시험판이라 영입과 결정은 저장되지 않는다. 본편에서는 영입한 동료를 다른 던전에 데려간다.</p></div>' +
      '<div class="footer"><button class="btn go" id="b-again">다시 들어간다</button></div>';
    show('end');
    if (won) $$('.cardrow', node).forEach(b => b.addEventListener('click', () => { sfx.awaken(); $$('.cardrow', node).forEach(x => x.classList.toggle('sel', x === b)); $('#recruited').textContent = card(b.dataset.id).name + ' 영입 — 살려서 데려온 동료다.'; }));
    $('#b-again').addEventListener('click', () => { St.unlockAudio(); newRun(); });
  }

  /* =====================================================================================
     Battle
     ===================================================================================== */
  const B = { bridge: null, door: null, party: [], allies: [], foe: null, D: null, pending: null, busy: false, log: [], all: [], relayBanner: null, armed: false, intent: null, fallSpot: null, options: [], seen: new Set() };

  function layout() {
    const frame = $('#frame'), w = Math.floor(Math.min(430, frame.clientWidth) / 2) * 2, h = frame.clientHeight;
    const W = w / 2, H = Math.max(150, Math.min(214, Math.floor((h - (h < 700 ? 320 : 396)) / 2)));
    St.resize(W, H);
    $('#stage').style.height = H * 2 + 'px';
    if (B.allies.length) placeActors(false);
  }

  /* the party stands in a diagonal line, front fighter lowest and closest */
  const LANE = [[0.37, 0], [0.235, -14], [0.11, -27]];
  const slotPos = k => { const l = LANE[Math.min(k, 2)]; return { x: Math.round(S.W * l[0]), y: l[1] }; };
  const foePos = () => ({ x: Math.round(S.W * 0.76), y: -4 });
  const FY = a => St.footY(a), HY = a => St.headY(a), CY = a => St.chestY(a);
  function lineup(D) {
    const out = [];
    for (let i = D.cur; i < 3; i++) if (D.allies[i] && !D.allies[i].dead && !D.allies[i].out) out.push(i);
    return out;
  }
  function placeActors(animate) {
    const line = lineup(B.D), jobs = [];
    line.forEach((idx, k) => {
      const a = B.allies[idx]; if (!a) return;
      const pos = slotPos(k);
      a.wait = k === 0 ? 0 : 1;
      if (animate && (Math.abs(a.x - pos.x) > 0.5 || Math.abs(a.y - pos.y) > 0.5)) jobs.push(tween(a, pos, 0.3)); else { a.x = pos.x; a.y = pos.y; }
    });
    if (B.foe && !animate) Object.assign(B.foe, foePos());
    return Promise.all(jobs);
  }
  const actorOf = ref => (ref.side === 'enemy' ? B.foe : B.allies[ref.idx]);
  const unitOf = ref => (ref.side === 'enemy' ? B.D.enemy : B.D.allies[ref.idx]);
  function foeDef(idx) { return B.door.enemies[idx == null ? B.D.enemy.idx : idx]; }
  function makeFoe(def) {
    return St.makeActor(Object.assign({ sprite: def.sprite, look: def.look === 'shadow' ? 'shadow' : def.look === 'boss' ? 'boss' : 'base', aura: def.look === 'shadow' ? 'violet' : def.boss ? 'cyan' : (def.elite ? 'red' : null), flip: foeFlip(def) }, foePos()));
  }
  const elementOf = ref => (ref.side === 'enemy' ? foeDef().element : card(B.party[ref.idx]).element);
  const colorsOf = ref => St.ELEMENT_COLORS[elementOf(ref)] || St.ELEMENT_COLORS.none;

  /* ---------- HUD ---------- */
  function chips(node, unit, isFoe) {
    const out = [];
    for (const id of Object.keys(unit.buffs)) {
      const v = unit.buffs[id]; if (!v) continue;
      const name = core.BUFF_NAMES[id] || id;
      if (id === 'burn') out.push('<i class="burn">작열 ' + v + '</i>');
      else if (id === 'divine') out.push('<i class="div">디바인 ' + v + '</i>');
      else if (id === 'defProtocolPhy') out.push('<i class="good">물리방어↑</i>');
      else if (id === 'defProtocolMag') out.push('<i class="good">마법방어↑</i>');
      else out.push('<i class="' + (GOOD.includes(id) ? 'good' : 'bad') + '">' + esc(name) + (GOOD.includes(id) && v > 1 ? ' ' + v : '') + '</i>');
    }
    if (isFoe) {
      if (unit.charging) out.push('<i class="bad">차징</i>');
      for (const a of unit.affixes || []) out.push('<i class="affix' + (a === 'frenzy' && unit.frenzied ? ' on' : '') + '">' + esc(Bridge.AFFIXES[a].name) + '</i>');
    } else if (unit.lastStand) out.push('<i class="last">최후의 일인</i>');
    node.innerHTML = out.join('');
  }
  function bar(u, hp, max, instant) {
    const k = Math.max(0, Math.min(1, hp / max));
    if (instant) { u.style.transition = 'none'; u.style.width = k * 100 + '%'; void u.offsetWidth; u.style.transition = ''; }
    u.style.width = k * 100 + '%'; u.className = k <= 0.25 ? 'low' : k <= 0.5 ? 'mid' : '';
  }
  function buildParty() {
    $('#party').innerHTML = B.party.map((id, i) => {
      if (!id) return '<div class="pm none"></div>';
      return '<div class="pm" data-i="' + i + '"><span class="face">' + face(id, 40) + '<i>' + POSITION[i] + '</i></span><span class="info">' +
        '<span class="top"><b>' + esc(card(id).name) + '</b>' + (run.heirlooms[id] ? '<i class="h">유</i>' : '') + '</span>' +
        '<span class="bar hp"><u></u><span class="n"></span></span><span class="bar mp"><u></u><span class="n"></span></span></span><em class="st"></em></div>';
    }).join('');
  }
  function render(fresh) {
    const D = B.D; if (!D) return;
    $('#turn').textContent = D.turn + '턴';
    $('#gems').textContent = '◆ ' + run.crystals;
    D.allies.forEach((a, i) => {
      const node = $('#party .pm[data-i="' + i + '"]'); if (!a || !node) return;
      node.className = 'pm ' + (a.dead ? 'dead' : a.out ? 'out' : i === D.cur ? 'cur' : 'wait') + (a.lastStand ? ' last' : '');
      bar($('.hp u', node), a.hp, a.maxHp, fresh); $('.hp .n', node).textContent = a.hp + '/' + a.maxHp;
      $('.mp u', node).style.width = Math.max(0, Math.min(1, a.mp / a.maxMp)) * 100 + '%'; $('.mp .n', node).textContent = a.mp;
      $('.st', node).textContent = a.dead ? '쓰러짐' : a.out ? '물러남' : '';
    });
    const me = D.allies[Math.min(D.cur, 2)];
    chips($('#pa-chips'), me && !me.dead && !me.out ? me : { buffs: {} }, false);
    const foe = D.enemy, def = foeDef(foe.idx), many = B.door.enemies.length > 1, kind = $('#pf-kind');
    kind.textContent = many ? (foe.idx + 1) + '/' + B.door.enemies.length : def.kind; kind.className = def.boss ? 'boss' : def.look === 'shadow' ? 'shadow' : def.elite ? 'elite' : '';
    $('#pf-name').textContent = foe.name;
    const el = $('#pf-el'); el.textContent = ELEMENT[def.element] || ''; el.className = 'el-' + def.element;
    bar($('#pf-hp'), foe.hp, foe.maxHp, fresh); $('#pf-hpn').textContent = foe.hp.toLocaleString('en-US') + ' / ' + foe.maxHp.toLocaleString('en-US');
    chips($('#pf-chips'), foe, true);
    S.beads.burn = foe.buffs.burn || 0; S.beads.divine = foe.buffs.divine || 0;
    if (B.foe) { S.beads.x = B.foe.x; S.beads.y = FY(B.foe); }
    const sky = $('#sky').children;
    for (let i = 0; i < 3; i++) {
      const id = D.field[i], f = id && (FIELD[id] || [id.slice(0, 2), '#ccc']);
      sky[i].className = f ? 'on' : ''; sky[i].style.background = f ? f[1] : ''; sky[i].textContent = f ? f[0].slice(0, 1) : '';
    }
    $('#skyname').textContent = D.field.map(id => core.BUFF_NAMES[id] || id).join(' · ');
    const newest = D.field[D.field.length - 1];
    S.tint = newest ? (FIELD[newest] || [0, '#ccc'])[1] : S.tint; S.tintA = newest ? 1 : 0;
  }
  function ticker(text) { $('#ticker').textContent = text; }
  function logLine(text) { B.log.push(text); if (!/^(===|---)/.test(text)) ticker(text); }
  function showIntent(intent, cd) {
    const n = $('#intent'); B.intent = intent;
    if (!intent || !B.foe) { n.className = 'intent'; return; }
    let html;
    if (intent.kind === 'stun') html = '<small>이번 턴</small><b>기절 · 행동 불가</b>';
    else if (intent.kind === 'charge') html = '<small>다음 행동</small><b class="sup">힘을 모은다</b>';
    else if (intent.kind === 'sup') html = '<small>다음 행동</small><b class="sup">' + esc(intent.name) + '</b>';
    else {
      const range = intent.dmg[0] === intent.dmg[1] ? intent.dmg[0] : intent.dmg[0] + '~' + intent.dmg[1];
      html = '<small>' + (intent.ult ? '필살 · ' : '다음 · ') + esc(intent.name) + '</small><b class="' + intent.kind + '">' + TYPE[intent.kind] + '</b><strong>' + range + '</strong>' + (intent.lethal ? '<u>치명</u>' : '');
    }
    n.innerHTML = html; n.className = 'intent on' + (intent.ult ? ' ult' : '');
    n.style.left = Math.round(Math.min(S.W - 40, Math.max(40, B.foe.x)) * 2) + 'px';
    n.style.top = Math.max($('#foebar').offsetHeight + 14 + n.offsetHeight, (HY(B.foe) - 4) * 2) + 'px';
    const c = $('#pf-cd');
    if (cd) {
      c.textContent = cd.inTurns === 0 ? '이번 턴 ' + cd.name + '!' : cd.name + '까지 ' + cd.inTurns + '턴';
      c.className = 'cd on' + (cd.inTurns === 0 ? ' now' : '');
      S.danger = cd.inTurns === 0 ? 1 : cd.inTurns <= 2 ? 0.45 : 0;
      if (cd.inTurns <= 1) sfx.warn();
    } else { c.className = 'cd'; S.danger = 0; }
  }

  /* ---------- command tiles ---------- */
  function supportLine(o, intent) {
    const buffs = o.effects.filter(e => e.type === 'buff').map(e => e.id);
    const hi = intent && intent.dmg ? intent.dmg[1] : null;
    if (buffs.includes('guard') || buffs.includes('damage_half')) return hi != null ? [hi + ' → ' + Math.floor(hi * 0.5), '받는 피해 절반'] : ['절반', '받는 피해 절반'];
    if (buffs.includes('barrier')) return intent && intent.kind === 'phy' ? [hi + ' → 0', '물리 공격을 지운다'] : ['—', '이번 공격은 못 막는다'];
    if (buffs.includes('magic_guard')) return intent && intent.kind === 'mag' ? [hi + ' → 0', '마법 공격을 지운다'] : ['—', '이번 공격은 못 막는다'];
    if (buffs.includes('evasion')) return ['회피 +50%', '맞지 않을 수도 있다'];
    const field = o.effects.find(e => e.type === 'field_buff');
    if (field) return [core.BUFF_NAMES[field.id] || field.id, '하늘에 건다'];
    return ['', ''];
  }
  const fullText = (o, me) => (o.index === 0 ? '마나를 쓰지 않는 기본 공격.' : core.SkillDisplay.body({ name: o.name, type: o.type, val: o.val, cost: o.cost, tier: o.tier, effects: o.effects }, { entity: me }));
  function brief(o, me) {
    if (o.index === 0) return '마나 0';
    return fullText(o, me).replace(/^위력 [\d.~]+배\.\s*/, '').replace(/(자신에게|적에게|자신의|적의) /g, '')
      .replace(/ \((다음 턴 행동 불가|받는 피해 50% 감소|마법 피해 무효|물리 피해 무효|회피율 \+50%p|최소 1 HP)\)/g, '')
      .replace(/필드 버프 /g, '').replace(/\.$/, '').replace(/\. /g, ' · ');
  }
  function renderActions() {
    const options = B.bridge.options(), D = B.D, me = card(B.party[D.cur]);
    const adv = core.Logic.getElementalMultiplier(me.element, foeDef().element) > 1;
    B.options = options;
    const tile = o => {
      const p = o.preview; let r2, r3 = brief(o, me);
      if (p && p.delayed) r2 = '<strong class="txt">예약</strong>';
      else if (p) r2 = '<strong>' + p.dmg + '</strong>' + (adv ? '<small>▲상성</small>' : '') + (p.forcedCrit ? '<small>치명</small>' : '') + (p.kill ? '<u>처치</u>' : '');
      else { const s = supportLine(o, B.intent); r2 = '<strong class="txt' + (s[0] === '—' ? ' no' : '') + '">' + esc(s[0]) + '</strong>'; if (s[1]) r3 = s[1]; }
      return '<button class="act ' + o.type + '" data-i="' + o.index + '"' + (o.usable ? '' : ' disabled') + '>' +
        '<span class="ic">' + TYPE[o.type].slice(0, 1) + '</span><span class="tx">' +
        '<span class="r1"><b>' + esc(o.name) + '</b><em>' + (o.cost ? 'MP ' + o.cost : '') + '</em></span>' +
        '<span class="r2">' + r2 + '</span><span class="r3">' + esc(r3) + '</span></span></button>';
    };
    const plain = options.filter(o => !o.heirloom), heir = options.find(o => o.heirloom);
    $('#acts').innerHTML = [1, 2, 3, 0].map(k => plain[k]).filter(Boolean).map(tile).join('');
    const h = $('#b-heir');
    if (heir) {
      const p = heir.preview;
      h.className = 'on'; h.dataset.i = heir.index; h.disabled = false;
      h.innerHTML = '<small>유품 · ' + esc(heir.heirFromName || '') + '</small><b>' + esc(heir.name) + '</b><strong>' + (p && p.dmg ? p.dmg : p && p.delayed ? '예약' : '') + '</strong>' + (p && p.kill ? '<u>처치</u>' : '');
    } else { h.className = ''; h.innerHTML = ''; h.disabled = true; delete h.dataset.i; }
    const r = $('#b-retreat'), can = B.bridge.canRetreat();
    B.armed = false; r.className = ''; r.disabled = !can;
    r.innerHTML = '↩ 물러나기<small>' + (B.bridge.retreatUsed ? '이미 썼다' : can ? '살려서 뺀다 · 턴 소모' : '뒤에 남은 동료 없음') + '</small>';
  }
  function lockPanel() { $$('.act').forEach(b => { b.disabled = true; }); $('#b-retreat').disabled = true; $('#b-heir').disabled = true; }
  let pressTimer = null, pressed = false;
  function detail(index) {
    const o = (B.options || [])[index]; if (!o) return;
    const me = card(B.party[B.D.cur]);
    sheet(o.name + ' · ' + TYPE[o.type] + (o.cost ? ' · MP ' + o.cost : '') + (o.heirloom ? ' · 유품' : ''),
      (o.heirloom ? (o.heirFromName || '') + '에게서 물려받은 기술. 위력 1.5배, MP 0, 이 전투에서 한 번. ' : '') + fullText(o, me) + '  특성 — ' + me.trait.desc);
  }
  const acts = $('#acts');
  acts.addEventListener('pointerdown', ev => {
    const b = ev.target.closest('.act'); if (!b) return;
    pressed = false; clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressed = true; detail(Number(b.dataset.i)); }, 480);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => acts.addEventListener(t, () => clearTimeout(pressTimer)));
  acts.addEventListener('contextmenu', ev => { const b = ev.target.closest('.act'); if (b) { ev.preventDefault(); detail(Number(b.dataset.i)); } });
  acts.addEventListener('click', ev => {
    const b = ev.target.closest('.act'); if (!b || b.disabled || B.busy) return;
    if (pressed) { pressed = false; return; }
    St.unlockAudio(); sfx.tap();
    play(B.bridge.act(Number(b.dataset.i)));
  });
  $('#b-heir').addEventListener('click', function () {
    if (B.busy || this.disabled || this.dataset.i == null) return;
    St.unlockAudio(); sfx.tap(); run.stats.heirloomsUsed++;
    play(B.bridge.act(Number(this.dataset.i)));
  });
  $('#b-retreat').addEventListener('click', () => {
    if (B.busy || !B.bridge.canRetreat()) return;
    const r = $('#b-retreat');
    if (!B.armed) { B.armed = true; r.className = 'armed'; r.innerHTML = '↩ 한 번 더<small>누르면 물러난다</small>'; sfx.tap(); return; }
    play(B.bridge.retreat());
  });
  $('#b-quirk').addEventListener('click', () => { const q = B.bridge && B.bridge.quirk && Bridge.QUIRKS[B.bridge.quirk]; if (q) sheet('꿈의 변덕 · ' + q.name, q.desc); });
  $('#stage').addEventListener('click', () => { if (B.busy) { clock.fast = true; $('#skip').className = 'on'; } });
  $('#b-speed').addEventListener('click', function () { clock.speed = clock.speed === 1 ? 2 : 1; this.textContent = clock.speed + '배'; this.classList.toggle('on', clock.speed === 2); });
  $('#b-sound').addEventListener('click', function () { St.soundOn = !St.soundOn; this.classList.toggle('on', St.soundOn); St.unlockAudio(); });
  $('#b-log').addEventListener('click', () => {
    $('#logbody').innerHTML = B.log.map(t => '<div class="' + (/^===/.test(t) ? 't' : /피해|쓰러|특성|필드/.test(t) ? 'k' : '') + '">' + esc(t) + '</div>').join('');
    $('#logbook').classList.add('on'); const body = $('#logbody'); body.scrollTop = body.scrollHeight;
  });
  $('#b-logclose').addEventListener('click', () => $('#logbook').classList.remove('on'));

  /* ---------- small stage helpers ---------- */
  const label = (text, actor, cls, dy) => St.number(text, St.X(actor), HY(actor) - 4 + (dy || 0), 'tag ' + (cls || ''));
  async function showBanner(tag, text, cls, sec) { const b = St.banner(tag, text, cls); await wait(sec || 0.7); b.remove(); }
  function shortLine(line) {
    if (/상성 우위/.test(line)) return '상성 ×1.2';
    if (/HP 100%/.test(line)) return 'HP 100% ×2';
    if (/랜덤 배율/.test(line)) return line.replace(/랜덤 배율! ?/, '무작위 ');
    let t = line.replace(/^\[[^\]]+\]\s*/, '').replace(/[!.]+$/, '');
    const colon = t.indexOf(': '); if (colon > 0 && colon < 12) t = t.slice(colon + 2);
    return t.length > 18 ? t.slice(0, 17) + '…' : t;
  }
  const tallyWorthy = e => !!e.calc && ((e.calc.lines.length + (e.calc.crit ? 1 : 0)) >= 2 || (e.amount > run.stats.best && e.amount >= 250));
  async function tally(calc, amount) {
    const barNode = $('#tally'); barNode.innerHTML = '';
    const steps = [(calc.stat === 'atk' ? '공격 ' : '마공 ') + calc.base, '×' + calc.val].concat(calc.lines.map(shortLine));
    if (calc.crit) steps.push('치명타');
    for (let i = 0; i < steps.length; i++) { const s = document.createElement('span'); s.textContent = steps[i]; barNode.appendChild(s); sfx.tick(i); await wait(0.12); }
    const sum = document.createElement('span'); sum.className = 'sum'; sum.textContent = '= ' + amount.toLocaleString('en-US'); barNode.appendChild(sum); sfx.tick(steps.length + 2);
    if (amount > run.stats.best && run.stats.best > 0) { const r = document.createElement('span'); r.className = 'rec'; r.textContent = '신기록'; barNode.appendChild(r); }
    await wait(0.2);
  }

  /* ---------- hits ---------- */
  function applyHp(e) { const u = unitOf(e.who); if (u) u.hp = Math.max(0, Math.min(u.maxHp, u.hp + e.delta)); render(); }
  function impact(e, o) {
    const actor = actorOf(e.who), unit = unitOf(e.who), isAlly = e.who.side === 'ally';
    applyHp(e);
    if (!actor) return;
    const ratio = e.amount / unit.maxHp, big = ratio >= 0.3 || o.crit || o.big;
    actor.pose = 'hurt'; actor.white = 0.09; actor.ox = (isAlly ? -1 : 1) * 4;
    tween(actor, { ox: 0 }, 0.25);
    S.shake = Math.max(S.shake, Math.min(7, 1 + ratio * 12 + (o.crit ? 2 : 0)));
    if (o.crit) S.flash = Math.max(S.flash, 0.5);
    St.sparks(St.X(actor), CY(actor), big ? 22 : 8, o.colors || St.ELEMENT_COLORS.none, big ? 100 : 50);
    const text = (o.prefix || '') + e.amount.toLocaleString('en-US') + (o.adv ? ' ▲' : '');
    St.number(text, St.X(actor), HY(actor) - (big ? 8 : 2), (o.crit ? 'crit ' : big ? 'big ' : '') + (isAlly ? 'foe' : ''));
    sfx.hit(big); if (o.crit) sfx.crit();
    if (!isAlly && e.amount > run.stats.best) { run.stats.best = e.amount; run.stats.bestBy = o.by || ''; }
  }

  /* B. Big common move: name plate, wind-up with a 2x camera punch on the caster, then one
     of six shapes chosen from the skill's own data, then one impact. Quiet moves (A) skip all of it. */
  const isBig = (p, e) => !!p.e.ult || !!p.e.heirloom || (!p.isFoe && (p.e.skill.tier || 1) >= 3 && (!e || !e.calc || e.calc.val >= 2));
  function shapeOf(skill) {
    const fx = skill.effects || [];
    if (fx.includes('random_mult') || fx.includes('multi_hit')) return skill.type === 'phy' ? 'flurry' : 'rain';
    if (fx.includes('consume_debuff_all') || fx.includes('consume_field_all')) return 'burst';
    if (fx.includes('self_hp_cost_ratio') || (skill.val || 0) >= 4) return 'meteor';
    return skill.type === 'phy' ? 'dash' : 'beam';
  }
  /* What each sprite's attack frame shows. A move of the other kind lunges or casts from the idle frame. */
  const ATTACK_FRAME = { red_dragon: 'mag', ash: 'mag', flame_sage: 'mag', luna: 'phy', zeke: 'phy', cherry_prince: 'phy', golem: 'phy' };
  const poseFor = (actor, kind) => (!ATTACK_FRAME[actor.sprite] || ATTACK_FRAME[actor.sprite] === kind ? 'attack' : 'idle');
  async function bigMove(p) {
    const { actor, target, isFoe } = p, dir = isFoe ? -1 : 1, colors = colorsOf(p.e.who), skill = p.e.skill;
    const key = (isFoe ? 'f:' : 'a:') + skill.name, first = !B.seen.has(key);
    B.seen.add(key);
    const who = isFoe ? (p.e.ult ? '필살' : unitOf(p.e.who).name) : p.e.heirloom ? '유품 · ' + unitOf(p.e.who).name : unitOf(p.e.who).name;
    actor.front = 1;
    $$('#fx .num').forEach(n => n.remove());
    const plate = St.plate(who, skill.name, isFoe && p.e.ult ? '#ff6b5e' : p.e.heirloom ? '#ffc857' : colors[1], dir);
    tween(S, { dark: isFoe ? 0.45 : 0.35 }, 0.12);
    sfx.charge();
    actor.pose = poseFor(actor, p.kind); actor.white = 0.06;
    if (first) {
      St.converge(St.X(actor) + dir * 10, CY(actor), 18, colors, 34, 0.3);
      await St.punch(St.X(actor) + dir * 14, CY(actor) - 6, 0.18);
    } else await wait(0.12);
    const tx = St.X(target), ty = CY(target), shape = shapeOf(skill);
    if (shape === 'beam') {
      const x0 = St.X(actor) + dir * 16, y = CY(actor) - 4;
      const orb = St.prop({ kind: 'orb', x: x0, y, r: 2, colors });
      await tween(orb, { r: 6 }, 0.12); St.dropProp(orb);
      const bm = St.prop({ kind: 'beam', x0, x1: x0, y, h: 1, colors, flare: true });
      sfx.beam(); await tween(bm, { x1: tx, h: 6 }, 0.1, 'in');
      for (let i = 0; i < 26; i++) St.fly(x0, y + (Math.random() - 0.5) * 8, tx + (Math.random() - 0.5) * 10, ty + (Math.random() - 0.5) * 16, 0.12 + Math.random() * 0.12, colors[i % 3], 2, i % 4 ? 1 : 2);
      await tween(bm, { h: 8 }, 0.18);
      tween(bm, { h: 0, a: 0 }, 0.14).then(() => St.dropProp(bm));
    } else if (shape === 'meteor') {
      const m = St.prop({ kind: 'meteor', x: tx - dir * 110, y: -20, r: 11, colors, trail: [] });
      sfx.beam(); await tween(m, { x: tx, y: ty }, 0.38, 'in'); St.dropProp(m);
      const bu = St.prop({ kind: 'burst', x: tx, y: ty, r: 4, colors });
      tween(bu, { r: 22, a: 0 }, 0.32).then(() => St.dropProp(bu)); sfx.boom();
    } else if (shape === 'rain') {
      for (let i = 0; i < 5; i++) {
        const m = St.prop({ kind: 'meteor', x: tx - dir * (60 + i * 10), y: -16 - i * 6, r: 5, colors, trail: [] });
        const job = tween(m, { x: tx - 14 + i * 7, y: ty - 6 + (i % 2) * 12 }, 0.22, 'in').then(() => { St.dropProp(m); St.sparks(m.x, m.y, 6, colors, 50); sfx.hit(false); S.shake = 3; });
        if (i === 4) await job; else await wait(0.07);
      }
    } else if (shape === 'burst') {
      for (let i = 0; i < 12; i++) St.fly(tx + (Math.random() - 0.5) * 40, ty - 30 - Math.random() * 20, tx, ty, 0.2 + Math.random() * 0.1, colors[i % 3], 6, 2);
      await wait(0.24);
      const bu = St.prop({ kind: 'burst', x: tx, y: ty, r: 3, colors });
      sfx.boom(); await tween(bu, { r: 20 }, 0.16); tween(bu, { r: 24, a: 0 }, 0.2).then(() => St.dropProp(bu));
    } else {                                     // dash / flurry: afterimages, a pass through the target, clean cuts
      const x0 = St.X(actor), through = tx + dir * 26, n = shape === 'flurry' ? 4 : 2;
      for (let i = 0; i < 4; i++) {
        const g = St.prop({ kind: 'ghost', sprite: actor.sprite, key: actor.sprite + '-' + actor.pose, look: actor.look === 'base' ? 'white' : actor.look, flip: actor.flip, x: x0 + (through - x0) * (i / 4), footY: FY(actor), a: 0.15 + i * 0.1 });
        tween(g, { a: 0 }, 0.35).then(() => St.dropProp(g));
      }
      sfx.swing(); await tween(actor, { ox: through - actor.x, oy: (FY(target) - FY(actor)) }, 0.08, 'in');
      for (let i = 0; i < n; i++) {
        const c = St.prop({ kind: 'cut', x: tx, y: ty - 4 + i * 5, len: 46 - i * 4, ang: (i % 2 ? -0.55 : 0.55) * dir + (i * 0.2), t: 0, a: 1, color: colors[i % 3] });
        tween(c, { t: 1 }, 0.07).then(() => tween(c, { a: 0 }, 0.18)).then(() => St.dropProp(c));
        sfx.swing(); await wait(shape === 'flurry' ? 0.07 : 0.06);
      }
    }
    S.flash = 0.6; S.shake = 7;
    St.ring(tx, ty, colors[0], 40); St.sparks(tx, ty, 34, colors, 130);
    tween(S, { dark: 0 }, 0.3);
    setTimeout(() => plate.remove(), 450);
    p.stage = 'hit';
  }
  async function quietMove(p) {
    const { actor, target, isFoe } = p, dir = isFoe ? -1 : 1, colors = colorsOf(p.e.who);
    actor.pose = poseFor(actor, p.kind);
    if (p.kind === 'phy') {
      sfx.swing(); await tween(actor, { ox: dir * (actor.pose === 'attack' ? 14 : 22), oy: (FY(target) - FY(actor)) * 0.5 }, 0.1, 'in');
      St.slash(St.X(target) - dir * 6, CY(target) - 8, colors[0], dir);
    } else {
      sfx.cast();
      const fromX = St.X(actor) + dir * 18, fromY = CY(actor) - 6;
      for (let i = 0; i < 12; i++) St.fly(fromX, fromY, St.X(target) - 8 + Math.random() * 16, CY(target) - 10 + Math.random() * 24, 0.16 + Math.random() * 0.1, colors[i % 3], 6, i % 4 ? 1 : 2);
      await wait(0.22);
    }
    p.stage = 'hit';
  }
  async function strikeAndHit(p, e) {
    p.actor.front = 1;
    if (p.stage === 'ready') { if (isBig(p, e)) await bigMove(p); else await quietMove(p); }
    const calc = e.calc || {};
    impact(e, { crit: !!calc.crit, adv: !!calc.adv, colors: colorsOf(p.e.who), big: isBig(p, e), by: p.isFoe ? '' : unitOf(p.e.who).name });
    await wait(0.14);
  }
  async function strikeMiss(p, why) {
    const { actor, target, isFoe } = p, dir = isFoe ? -1 : 1;
    actor.front = 1;
    if (isBig(p, null)) await bigMove(p); else await quietMove(p);
    if (why === 'evasion') { tween(target, { ox: dir * 10 }, 0.08).then(() => tween(target, { ox: 0 }, 0.2)); label('회피!', target, 'good'); sfx.miss(); }
    else { St.ring(St.X(target), CY(target), why === 'barrier' ? '#ffc857' : '#8ea2ff', 28); label(why === 'barrier' ? '배리어! 무효' : '매직가드! 무효', target, 'good'); sfx.guard(); }
    await wait(0.3);
  }
  async function settlePending() {
    const p = B.pending; if (!p) return;
    B.pending = null;
    if (p.stage === 'ready') { p.actor.pose = poseFor(p.actor, p.kind); await wait(0.12); }
    await tween(p.actor, { ox: 0, oy: 0 }, 0.1);
    p.actor.pose = 'idle'; p.actor.front = 0;
    const t = p.target, tu = p.e.target && unitOf(p.e.target);
    if (t && tu && tu.hp > 0 && t.pose === 'hurt') t.pose = 'idle';
    if (S.dark > 0.01) tween(S, { dark: 0 }, 0.2);
  }

  /* ---------- event handlers ---------- */
  async function intro(e) {
    B.D = clone(e.s); B.allies = []; B.foe = null;
    St.clear(); St.setRoom(B.door.bg || 'cave');
    B.party.forEach((id, i) => { if (id) B.allies[i] = St.makeActor({ sprite: id, x: -60 - i * 26, y: slotPos(i).y, wait: i ? 1 : 0, flip: (spr(id).facing || 'right') === 'left' }); });
    const def = foeDef(0);
    B.foe = makeFoe(def); B.foe.x = S.W + 70;
    buildParty(); render(true); showIntent(null);
    $('#room').textContent = run.floor + '층 · ' + DOOR[B.door.type][0]; $('#tally').innerHTML = '';
    const q = B.door.quirk && Bridge.QUIRKS[B.door.quirk], qb = $('#b-quirk');
    qb.textContent = q ? '변덕 · ' + q.name : ''; qb.style.display = q ? '' : 'none';
    const jobs = lineup(B.D).map((idx, k) => wait(k * 0.08).then(() => tween(B.allies[idx], slotPos(k), 0.4)));
    jobs.push(wait(0.25).then(() => tween(B.foe, { x: foePos().x }, 0.4)).then(() => { St.dust(B.foe.x, FY(B.foe)); sfx.enter(); }));
    await Promise.all(jobs);
    await showBanner(def.kind, B.door.enemies.map(d => d.name).join(' → '), def.boss ? 'ult' : '', 0.8);
    if (q) await showBanner('꿈의 변덕', q.name + ' — ' + q.desc, 'gold', 0.95);
  }
  async function onAct(e) {
    const actor = actorOf(e.who), isFoe = e.who.side === 'enemy';
    if (!actor) return;
    $('#tally').innerHTML = '';
    $('#intent').className = 'intent';
    if (e.charge) {
      S.dark = 0.3; sfx.warn(); St.converge(St.X(actor), CY(actor), 24, colorsOf(e.who), 40, 0.5); label('힘을 모은다…', actor, 'bad');
      await wait(0.6); tween(S, { dark: 0 }, 0.3); return;
    }
    if (e.skill.type === 'sup') {
      actor.front = 1; label(e.skill.name, actor, 'good');
      sfx.buff(); St.ring(St.X(actor), CY(actor), '#5fd4a8', 24); St.rise(St.X(actor), FY(actor) - 8, 12, ['#5fd4a8', '#d6fff7', '#ffc857'], 30);
      await tween(actor, { oy: -4 }, 0.08); await tween(actor, { oy: 0 }, 0.1, 'in'); await wait(0.1);
      actor.front = 0; return;
    }
    B.pending = { e, actor, target: e.target ? actorOf(e.target) : null, kind: e.skill.type, isFoe, stage: 'ready' };
    if (e.ult) { sfx.warn(); await wait(0.12); }
    else if (e.skill.name !== '일반 공격' && !isBig(B.pending, null)) St.number(e.skill.name, St.X(actor), HY(actor) - 12, 'call');
    else if (e.delayed) label(e.skill.name + ' 발동', actor, 'good');
  }
  async function onHp(e) {
    const p = B.pending;
    if (p && e.cause.kind === 'act' && same(e.cause.by, p.e.who) && e.delta < 0 && !same(e.who, p.e.who)) {
      let sum = null;
      if (p.stage === 'ready' && !p.isFoe && tallyWorthy(e)) { sum = tally(e.calc, e.amount); if (!isBig(p, e)) await sum; }
      await strikeAndHit(p, e);
      if (sum) await sum;
      return;
    }
    if (e.cause.kind === 'relay' && e.who.side === 'enemy' && e.delta < 0) { await relayHit(e); return; }
    const actor = actorOf(e.who);
    applyHp(e);
    if (!actor) return;
    if (e.delta > 0) { St.number('+' + e.amount, St.X(actor), HY(actor) - 2, 'heal'); sfx.buff(); }
    else if (e.cause.kind === 'self') { St.number('-' + e.amount + ' 대가', St.X(actor), HY(actor) + 8, 'self'); actor.white = 0.06; }
    else { actor.white = 0.08; St.number(String(e.amount), St.X(actor), HY(actor) - 2, e.who.side === 'ally' ? 'foe' : ''); sfx.hit(false); }
    await wait(0.16);
  }
  function responder() {
    for (const idx of lineup(B.D)) { const t = card(B.party[idx]).trait; if (t && LINKED_TRAITS.includes(t.type)) return idx; }
    return -1;
  }
  async function relayHit(e) {
    const foe = B.foe, linked = e.cause.linked, idx = linked ? responder() : -1, from = idx >= 0 ? B.allies[idx] : null;
    const colors = from ? colorsOf({ side: 'ally', idx }) : ['#4fd8c8', '#ffc857', '#ffffff'];
    if (from) {
      from.front = 1; from.pose = 'attack'; from.white = 0.06; sfx.cast();
      const fx = St.IMG[from.sprite + '-fx'] ? St.variant(from.sprite + '-fx', 'base') : null;
      St.fly(St.X(from) + 14, CY(from), St.X(foe), CY(foe), 0.3, colors[1], 16, 2, null, fx);
      for (let i = 0; i < 10; i++) St.fly(St.X(from) + 14, CY(from), St.X(foe) - 8 + Math.random() * 16, CY(foe) - 10 + Math.random() * 24, 0.24 + Math.random() * 0.12, colors[i % 3], 14, 1);
    } else {
      const sx = B.fallSpot ? B.fallSpot.x : slotPos(0).x, sy = B.fallSpot ? B.fallSpot.y : S.BASE;
      for (let i = 0; i < 20; i++) St.fly(sx - 10 + Math.random() * 20, sy - 16 - Math.random() * 40, St.X(foe), CY(foe), 0.26 + Math.random() * 0.14, colors[i % 3], 24, i % 4 ? 1 : 2);
    }
    await wait(0.32);
    impact(e, { crit: !!(e.calc && e.calc.crit), adv: !!(e.calc && e.calc.adv), colors, prefix: '반격 ', by: from ? unitOf({ side: 'ally', idx }).name + ' 반격' : '계승' });
    await wait(0.28);
    if (from) { from.pose = 'idle'; from.front = 0; }
    if (foe && B.D.enemy.hp > 0) foe.pose = 'idle';
  }
  async function onBuff(e) {
    const u = unitOf(e.who), actor = actorOf(e.who); if (!u) return;
    if (e.to) u.buffs[e.id] = e.to; else delete u.buffs[e.id];
    render();
    if (!actor || e.to <= e.from) return;
    const name = core.BUFF_NAMES[e.id] || e.id, good = GOOD.includes(e.id);
    if (/^defProtocol/.test(e.id)) { label(e.id === 'defProtocolPhy' ? '물리 방어 상승' : '마법 방어 상승', actor, 'bad', 10); await wait(0.2); return; }
    label(name + (e.id === 'burn' || e.id === 'divine' ? ' ' + e.to : ''), actor, good ? 'good' : 'bad', 10);
    if (good) { St.ring(St.X(actor), CY(actor), '#5fd4a8', 22); sfx.guard(); }
    else { St.sparks(St.X(actor), CY(actor), 7, e.id === 'burn' ? ['#ff5a3c', '#ffe07a'] : ['#b999ff', '#6b2433'], 40); sfx.debuff(); }
    await wait(0.12);
  }
  async function onField(e) {
    B.D.field = e.list.slice(); render();
    for (const id of e.add) {
      const f = FIELD[id] || [id, '#ccc'];
      for (let i = 0; i < 22; i++) St.rise(Math.random() * S.W, 34 + Math.random() * 24, 1, [f[1], '#ffffff'], 0);
      sfx.buff(); S.flash = 0.2;
      await showBanner('하늘', (core.BUFF_NAMES[id] || id) + ' — 전장을 덮는다', 'gold', 0.45);
    }
  }
  async function onDown(e) {
    const a = actorOf(e.who), u = unitOf(e.who); if (u) { u.dead = true; u.hp = 0; }
    render();
    if (!a) return;
    B.fallSpot = { x: St.X(a), y: FY(a) };
    const next = lineup(Object.assign({}, B.D, { cur: e.who.idx + 1 }))[0], heir = next != null ? B.allies[next] : null;
    clock.slow = 0.45; a.pose = 'hurt'; a.white = 0.14; a.front = 1; sfx.fall();
    await wait(0.16);
    sfx.shatter();
    const w = St.meta(a, 'hurt').w;
    for (let i = 0; i < 40; i++) {
      const sx = St.X(a) - w / 3 + Math.random() * w * 0.66, sy = FY(a) - 4 - Math.random() * St.tall(a) * 0.9, c = ['#4fd8c8', '#ffc857', '#ffffff'][i % 3];
      if (heir) St.fly(sx, sy, St.X(heir), CY(heir), 0.5 + Math.random() * 0.4, c, 20 + Math.random() * 26, i % 5 ? 1 : 2);
      else St.sparks(sx, sy, 1, [c], 50, -30);
    }
    await tween(a, { alpha: 0 }, 0.2); a.vis = false; clock.slow = 1;
    await wait(heir ? 0.5 : 0.35);
  }
  async function onHeirloom(e) {
    const to = actorOf(e.to), from = unitOf(e.from), heir = unitOf(e.to);
    if (!to) return;
    to.white = 0.12; St.ring(St.X(to), CY(to), '#ffc857', 30); St.ring(St.X(to), CY(to), '#ffffff', 18); St.rise(St.X(to), FY(to), 16, ['#ffc857', '#fff1a8', '#ffffff'], 26);
    sfx.heirloom();
    const bn = St.banner('유품', (from ? from.name : '') + '의 ' + e.skill.name + ' → ' + (heir ? heir.name : '') + ' · 위력 1.5배 · MP 0', 'gold');
    await wait(0.8); bn.remove();
  }
  async function onRelay(e) {
    if (e.phase === 'end') { await wait(0.2); if (B.relayBanner) { B.relayBanner.remove(); B.relayBanner = null; } return; }
    const victim = unitOf(e.victim), idx = e.linked ? responder() : -1;
    const text = e.linked && idx >= 0 ? B.D.allies[idx].name + ' — ' + card(B.party[idx]).trait.desc : (victim ? victim.name : '') + ' — ' + e.trait;
    if (B.relayBanner) B.relayBanner.remove();
    B.relayBanner = St.banner('계승', text, 'low');
    sfx.relay();
    await wait(0.42);
  }
  async function onLastStand(e) {
    const a = actorOf(e.who), u = unitOf(e.who); if (u) u.lastStand = true;
    render();
    if (a) { a.aura = 'red'; a.white = 0.12; St.ring(St.X(a), CY(a), '#ff6b5e', 34); St.rise(St.X(a), FY(a), 18, ['#ff6b5e', '#ffc857', '#ffffff'], 30); }
    sfx.warn(); S.flash = 0.3;
    run.stats.lastStands++;
    await showBanner('최후의 일인', (u ? u.name : '') + ' — 공격력·마법공격력 ×1.5, 치명타율 +25%', 'ult', 0.85);
  }
  async function onRule(e) {
    const who = e.who && !Array.isArray(e.who) ? actorOf(e.who) : null;
    switch (e.rule) {
      case 'echo': if (who) { label('메아리', who, 'good', -10); St.ring(St.X(who), CY(who), '#a8ffe0', 34); sfx.cast(); } await wait(0.18); break;
      case 'thorns': if (who) label('가시 -' + e.amount, who, 'bad', 6); await wait(0.12); break;
      case 'leech': if (who) { label('흡혈', who, 'bad', -10); St.rise(St.X(who), FY(who), 10, ['#ff6b5e', '#ffb0a8'], 24); } await wait(0.12); break;
      case 'frenzy': if (who) { who.aura = 'red'; label('광폭 — 공격력 1.5배', who, 'bad', -10); sfx.warn(); } await wait(0.45); break;
      case 'overflow': if (who) label('넘침 ' + e.amount, who, 'good', -10); await wait(0.2); break;
      case 'starfall': await wait(0.05); break;
      case 'martyr': await showBanner('순교', '남은 아군의 공격력 +40%', 'gold', 0.7); break;
    }
  }
  async function onEnter(e) {
    B.D.cur = e.who.idx; render();
    const a = actorOf(e.who);
    await placeActors(true);
    if (a) { St.dust(St.X(a), FY(a)); sfx.enter(); label(POSITION[e.who.idx] + ' ' + unitOf(e.who).name, a, 'good'); }
    await wait(0.22);
  }
  async function onRetreat(e) {
    const a = actorOf(e.who), u = unitOf(e.who); if (u) u.out = true;
    render();
    const b = St.banner('물러나기', (u ? u.name : '') + ' — 살아서 빠진다', 'gold');
    if (a) { sfx.miss(); await tween(a, { oy: -8 }, 0.1); await tween(a, { oy: 0, x: -80, alpha: 0.2 }, 0.4, 'in'); a.vis = false; }
    await wait(0.3); b.remove();
  }
  async function foeDeath(e) {
    const foe = B.foe; if (!foe) return;
    B.D.enemy.hp = 0; render(); showIntent(null);
    foe.pose = 'hurt'; foe.white = 0.16; foe.front = 1; S.flash = 0.4; S.shake = 6; sfx.hit(true);
    St.sparks(St.X(foe), CY(foe), 40, ['#3a2f58', '#8b6cff', '#ffffff'], 100);
    if (e.treasure) { label('보물! ◆+2', foe, 'good', -14); sfx.gem(); }
    clock.slow = 0.5; await wait(0.2); clock.slow = 1;
    await tween(foe, { alpha: 0, oy: 6 }, 0.45, 'in');
    St.removeActor(foe); B.foe = null; S.beads.burn = S.beads.divine = 0; S.danger = 0;
  }
  async function foeEnter(e) {
    B.D.enemy = clone(e.s.enemy);
    const def = foeDef(e.who.idx);
    B.foe = makeFoe(def); B.foe.x = S.W + 70;
    render(true);
    await tween(B.foe, { x: foePos().x }, 0.4); St.dust(B.foe.x, FY(B.foe)); sfx.enter();
    await showBanner((e.who.idx + 1) + '/' + B.door.enemies.length, e.name + ' — 이어서 나선다', def.boss ? 'ult' : '', 0.6);
  }
  async function victory() {
    showIntent(null); S.danger = 0; tween(S, { dark: 0 }, 0.2);
    sfx.win();
    const b = St.banner('승리', run.floor + '층 · ' + DOOR[B.door.type][0], 'gold big');
    const n = Math.max(1, B.door.reward || 0), fp = foePos();
    for (let i = 0; i < n; i++) St.gem(fp.x - 10 + i * 8, S.BASE - 30, S.W - 60, 2, 0.6 + i * 0.12, () => sfx.gem());
    for (const idx of lineup(B.D)) { const a = B.allies[idx]; tween(a, { oy: -6 }, 0.12).then(() => tween(a, { oy: 0 }, 0.14, 'in')); }
    await wait(1.2 + n * 0.1); b.remove();
  }
  async function defeat() {
    showIntent(null); sfx.lose(); tween(S, { dark: 0.6 }, 0.6);
    const b = St.banner('전멸', '꿈길이 끊겼다', 'ult big');
    await wait(1.4); b.remove();
  }

  /* ---------- the event player ---------- */
  async function handle(e) {
    switch (e.t) {
      case 'log': logLine(e.text); break;
      case 'begin': await intro(e); break;
      case 'turn': await settlePending(); B.D.turn = e.n; render(); break;
      case 'act': await settlePending(); await onAct(e); break;
      case 'mp': { const u = unitOf(e.who); if (u) { u.mp += e.delta; render(); } break; }
      case 'hp': await onHp(e); break;
      case 'buff': await onBuff(e); break;
      case 'field': await onField(e); break;
      case 'miss': if (B.pending && B.pending.stage === 'ready') { await strikeMiss(B.pending, e.why); B.pending.stage = 'hit'; } break;
      case 'stunned': { await settlePending(); const a = actorOf(e.who); if (a) { label('기절! 행동 불가', a, 'bad'); sfx.debuff(); await wait(0.42); } break; }
      case 'down': await settlePending(); await onDown(e); break;
      case 'heirloom': await settlePending(); await onHeirloom(e); break;
      case 'laststand': await settlePending(); await onLastStand(e); break;
      case 'rule': await onRule(e); break;
      case 'relay': await settlePending(); await onRelay(e); break;
      case 'enter': await settlePending(); await onEnter(e); break;
      case 'retreat': await settlePending(); await onRetreat(e); break;
      case 'enemyTurn': await settlePending(); await wait(0.08); break;
      case 'enemyDown': await settlePending(); await foeDeath(e); break;
      case 'enemyEnter': await foeEnter(e); break;
      case 'form': { const u = unitOf(e.who); if (u) { u.name = e.name; render(); } break; }
      case 'alert': ticker(e.text); break;
      case 'await': await settlePending(); B.D = clone(e.s); await placeActors(true); render(); showIntent(e.intent, e.countdown); renderActions(); break;
      case 'win': await settlePending(); await victory(); break;
      case 'lose': await settlePending(); await defeat(); break;
    }
  }
  async function play(events) {
    if (!events.length) return;
    B.busy = true; lockPanel();
    B.all = B.all.concat(events);
    for (const e of events) await handle(e);
    await settlePending();
    B.busy = false; clock.fast = false; $('#skip').className = '';
    if (B.bridge.outcome) finishBattle();
  }

  /* ---------- battle in and out ---------- */
  function startBattle(order) {
    const door = run.door;
    B.door = door; B.party = order.slice(0, 3); B.log = []; B.all = []; B.pending = null; B.relayBanner = null; B.seen = new Set();
    while (B.party.length < 3) B.party.push(null);
    const opts = R.battleOptions(run, door, order);
    opts.party = B.party;
    B.bridge = Bridge.create(core, opts);
    $('#result').classList.remove('on');
    show('battle'); layout(); ticker('');
    play(B.bridge.start());
  }
  function finishBattle() {
    const res = R.applyBattle(run, roster, B.door, B.party, B.bridge, B.all);
    const gained = B.bridge.heirloomsGained().filter(g => run.bench.includes(g.to));
    const rows = [];
    if (res.win) rows.push('<p class="gain">꿈의 결정 ◆ +' + res.crystals + ' <small>(지금 ◆ ' + run.crystals + ')</small></p>');
    if (res.fallen.length) rows.push('<div class="fallen"><small>쓰러진 동료 — 이 원정에서 돌아오지 않는다</small><div>' + res.fallen.map(id => '<span class="mini dead">' + face(id, 40) + '<b>' + esc(card(id).name) + '</b></span>').join('') + '</div></div>');
    for (const g of gained) rows.push('<p class="heirline"><b>유품</b> ' + esc(card(g.to).name) + ' ← ' + esc(card(g.from).name) + '의 ' + esc(g.name) + '<small>다음 전투부터도 한 번씩 쓸 수 있다</small></p>');
    const box = $('#result-in');
    box.innerHTML = '<h3>' + (res.win ? (B.door.type === 'boss' ? '꿈의 주인을 쓰러뜨렸다' : '돌파') : '전멸') + '</h3>' + rows.join('') + '<button class="btn go" id="b-next">' + (res.win && B.door.type !== 'boss' ? '다음으로' : '결과 보기') + '</button>';
    $('#result').classList.add('on');
    $('#b-next').addEventListener('click', () => {
      sfx.tap(); $('#result').classList.remove('on');
      if (!res.win || run.result) return endScreen();
      if (B.door.type === 'gate') { const c = R.gateChoices(run, B.door); if (c.length) return pickScreen(c); }
      toMap(true);
    });
  }

  /* ---------- run start ---------- */
  function newRun() {
    const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
    run = R.newRun(core, roster, seed, {});
    awakenScreen();
  }

  /* ---------- boot ---------- */
  St.init($('#cv'), $('#fx'));
  window.addEventListener('resize', layout);
  $('#b-start').addEventListener('click', () => { St.unlockAudio(); sfx.awaken(); newRun(); });
  St.loadSprites().then(() => { layout(); St.start(); });

  /** Review hooks for checking the page when it is not animating on its own. */
  window.__slice = {
    advance: St.advance, B, clock, R, roster,
    get run() { return run; },
    get busy() { return B.busy; },
    state: () => (B.bridge ? B.bridge.state() : null),
    async settle(max) { let t = 0; while (B.busy && t < (max || 60)) { await St.advance(0.5); t += 0.5; } return t; }
  };
})();
