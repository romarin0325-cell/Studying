import { $, $$, esc, show } from '../dom.js';
import { DOOR, foeFlip } from '../widgets.js';
import { POSITION } from '../../engine/roster.js';
import * as R from '../../engine/run.js';
import { QUIRKS } from '../../content/quirks.js';
import { create as createBattle } from '../../engine/bridge.js';
import { tools } from '../settings.js';
import { createHud, FIELD, GOOD } from './hud.js';
import { createTiles } from './tiles.js';
import { createMoves } from './moves.js';

export function battleMarkup() {
  return (
    '<section id="battle" class="screen">' +
    '<header id="bar"><span id="room"></span><span id="turn"></span><button id="b-quirk" class="quirk"></button><span class="sp"></span><button id="b-speed">1배</button><button id="b-log">기록</button>' + tools() + '</header>' +
    '<div id="stage"><canvas id="cv"></canvas><div id="hud">' +
    '<div id="foebar"><div class="nm"><i id="pf-kind"></i><b id="pf-name"></b><em id="pf-el"></em><span id="pf-hpn"></span><u class="ii">i</u></div><div class="bar hp"><u id="pf-hp"></u></div><div class="row"><div class="chips" id="pf-chips"></div><div class="cd" id="pf-cd"></div></div></div>' +
    '<div class="sky" id="sky"><i></i><i></i><i></i><span id="skyname"></span></div>' +
    '<div class="chips" id="pa-chips"></div>' +
    '<div class="intent" id="intent"></div></div><div id="fx"></div><div id="skip">▶▶ 넘기는 중</div></div>' +
    '<div id="party"></div>' +
    '<div id="msg"><div id="ticker"></div><div id="tally"></div></div>' +
    '<div id="panel"><div id="acts"></div><div id="row2"><button id="b-heir"></button><button id="b-retreat"></button></div></div>' +
    '<div class="overlay" id="logbook"><div class="body" id="logbody"></div><button class="btn" id="b-logclose">닫기</button></div>' +
    '<div class="sheet" id="result"><div class="in win" id="result-in"></div></div>' +
    '</section>'
  );
}

export function createBattleView({ core, roster, widgets, stage: St, audio, sheets, details, toMap, onEnd, onGatePick }) {
  const { S, clock, wait, tween, footY: FY, headY: HY, chestY: CY } = St;
  const { sfx } = audio;
  const { card, face, spr } = widgets;
  const clone = o => JSON.parse(JSON.stringify(o));
  const same = (a, b) => !!a && !!b && a.side === b.side && a.idx === b.idx;
  const LINKED_TRAITS = ['ally_death_base_atk_phy', 'ally_light_death_base_matk_mag'];

  const B = { bridge: null, door: null, party: [], allies: [], foe: null, D: null, pending: null, busy: false, log: [], all: [], relayBanner: null, armed: false, intent: null, fallSpot: null, options: [], seen: new Set() };
  const errors = [];
  let battleContext = null;
  let run = null;

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

  const hud = createHud(core, St, sfx, widgets);
  const { ticker, tally, tallyWorthy } = hud;
  const { brief, renderActions, lockPanel } = createTiles({
    core, card, audio, sheets, B, foeDef, play,
    markHeirloomUsed: () => { run.stats.heirloomsUsed++; }
  });
  const { isBig, label, impact, strikeAndHit, strikeMiss, settleMove } = createMoves({
    stage: St, sfx, actorOf, unitOf, colorsOf, applyHp
  });
  const foeSheet = () => details.foeSheet(B);
  const allySheet = index => details.allySheet(run, B, index);
  const fieldSheet = () => details.fieldSheet(B);
  const render = fresh => hud.render(B, fresh);

  function showIntent(intent, countdown) {
    B.intent = intent;
    hud.showIntent(intent, countdown, B.foe);
  }

  /* Tap the scene: while moves play it fast-forwards; on your turn a tap on a fighter opens its sheet. */
  function actorAt(px, py) {
    const list = [B.foe].concat(B.allies).filter(a => a && a.vis !== false && a.alpha > 0.2);
    for (const a of list) { const m = St.meta(a, a.pose || 'idle'); if (m && Math.abs(px - St.X(a)) <= m.w / 2 + 3 && py >= HY(a) - 4 && py <= FY(a) + 3) return a; }
    return null;
  }
  $('#stage').addEventListener('click', ev => {
    if (B.busy) { clock.fast = true; $('#skip').className = 'on'; return; }
    if (!B.D) return;
    const r = $('#cv').getBoundingClientRect(), a = actorAt((ev.clientX - r.left) * S.W / r.width, (ev.clientY - r.top) * S.H / r.height);
    if (!a) return;
    sfx.tap();
    if (a === B.foe) foeSheet(); else allySheet(B.allies.indexOf(a));
  });
  /* The HUD pieces open their sheets even mid-animation; the battle waits while a sheet is open. */
  $('#foebar').addEventListener('click', ev => { ev.stopPropagation(); sfx.tap(); foeSheet(); });
  $('#sky').addEventListener('click', ev => { ev.stopPropagation(); sfx.tap(); fieldSheet(); });
  $('#pa-chips').addEventListener('click', ev => { ev.stopPropagation(); if (B.D) { sfx.tap(); allySheet(Math.min(B.D.cur, 2)); } });
  $('#party').addEventListener('click', ev => { const p = ev.target.closest('.pm[data-i]'); if (p && B.D) { sfx.tap(); allySheet(Number(p.dataset.i)); } });
  $('#b-speed').addEventListener('click', function () { clock.speed = clock.speed === 1 ? 2 : 1; this.textContent = clock.speed + '배'; this.classList.toggle('on', clock.speed === 2); });
  $('#b-log').addEventListener('click', () => {
    $('#logbody').innerHTML = B.log.map(t => '<div class="' + (/^===/.test(t) ? 't' : /피해|쓰러|특성|필드/.test(t) ? 'k' : '') + '">' + esc(t) + '</div>').join('');
    $('#logbook').classList.add('on'); const body = $('#logbody'); body.scrollTop = body.scrollHeight;
  });
  $('#b-logclose').addEventListener('click', () => $('#logbook').classList.remove('on'));

  function logLine(text) { B.log.push(text); if (!/^(===|---)/.test(text)) ticker(text); }
  async function showBanner(tag, text, cls, sec) { const b = St.banner(tag, text, cls); await wait(sec || 0.7); b.remove(); }
  function applyHp(e) { const u = unitOf(e.who); if (u) u.hp = Math.max(0, Math.min(u.maxHp, u.hp + e.delta)); render(); }

  function settlePending() {
    const move = B.pending;
    if (!move) return;
    B.pending = null;
    return settleMove(move);
  }

  function setupBattleStage() {
    St.clear(); St.setRoom(B.door.bg || 'cave');
    B.allies = B.party.map((id, i) => {
      const u = B.D.allies[i];
      if (!id || !u) return null;
      return St.makeActor({
        sprite: id, ...slotPos(i), wait: i ? 1 : 0, flip: (spr(id).facing || 'right') === 'left',
        vis: !u.dead && !u.out, aura: u.lastStand ? 'red' : null
      });
    });
    B.foe = B.D.enemy.hp > 0 ? makeFoe(foeDef()) : null;
    if (B.foe && B.D.enemy.frenzied) B.foe.aura = 'red';
    hud.buildParty(run, B.party); showIntent(null);
    $('#room').textContent = run.floor + '층 · ' + DOOR[B.door.type][0]; $('#tally').innerHTML = '';
    const q = B.door.quirk && QUIRKS[B.door.quirk], qb = $('#b-quirk');
    qb.textContent = q ? '변덕 · ' + q.name : ''; qb.style.display = q ? '' : 'none';
    return q;
  }
  async function intro(e) {
    B.D = clone(e.s);
    const q = setupBattleStage(), def = foeDef();
    B.allies.forEach((a, i) => { if (a) a.x = -60 - i * 26; });
    B.foe.x = S.W + 70;
    render(true);
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
    else if (e.skill.name !== '일반 공격' && !isBig(B.pending)) St.number(e.skill.name, St.X(actor), HY(actor) - 12, 'call');
    else if (e.delayed) label(e.skill.name + ' 발동', actor, 'good');
  }
  async function onHp(e) {
    const p = B.pending;
    if (p && e.cause.kind === 'act' && same(e.cause.by, p.e.who) && e.delta < 0 && !same(e.who, p.e.who)) {
      let sum = null;
      if (p.stage === 'ready' && !p.isFoe && tallyWorthy(e, run.stats)) { sum = tally(e.calc, e.amount, run.stats); if (!isBig(p)) await sum; }
      await strikeAndHit(p, e, run.stats, B.seen);
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
    impact(e, { crit: !!(e.calc && e.calc.crit), adv: !!(e.calc && e.calc.adv), colors, prefix: '반격 ', by: from ? unitOf({ side: 'ally', idx }).name + ' 반격' : '계승' }, run.stats);
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
      case 'miss': if (B.pending && B.pending.stage === 'ready') { await strikeMiss(B.pending, e.why, B.seen); B.pending.stage = 'hit'; } break;
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
      case 'await':
        await settlePending(); B.D = clone(e.s); await placeActors(true); render(); showIntent(e.intent, e.countdown); renderActions();
        if (!run.hintShown) { run.hintShown = true; ticker('적·동료·하늘 칸을 누르면 자세히 본다 · 보는 동안 멈춘다'); }
        break;
      case 'win': await settlePending(); await victory(); break;
      case 'lose': await settlePending(); await defeat(); break;
    }
  }
  function resyncBattle(events) {
    // The bridge has already applied this batch. Rebuild from its final state without replaying deltas.
    B.D = B.bridge.state();
    B.pending = B.relayBanner = B.fallSpot = null;
    clock.slow = 1;
    clock.waiters.length = clock.tweens.length = 0;
    const ready = B.bridge.awaiting ? events.findLast(e => e.t === 'await') : null;
    try {
      setupBattleStage();
      placeActors(false);
      render(true);
      showIntent(ready?.intent, ready?.countdown);
    } finally {
      if (B.bridge.awaiting) {
        B.intent = ready?.intent;
        renderActions();
      }
    }
  }
  async function play(events) {
    if (!events.length) return;
    B.busy = true; lockPanel();
    const start = B.all.length;
    B.all = B.all.concat(events);
    let i = 0;
    try {
      for (; i < events.length; i++) await handle(events[i]);
      await settlePending();
    } catch (error) {
      const entry = {
        ...battleContext, eventIndex: start + i, type: events[i]?.t ?? 'settle',
        message: String(error), stack: error?.stack ?? null
      };
      errors.push(entry);
      console.error('Relay screen event failed', entry, error);
      try {
        resyncBattle(events);
      } catch (recoveryError) {
        entry.recoveryError = String(recoveryError);
        console.error('Relay screen recovery failed', entry, recoveryError);
      }
      logLine('화면 오류를 기록했다.');
    } finally {
      B.busy = false; clock.fast = false; $('#skip').className = '';
    }
    if (B.bridge.outcome) finishBattle();
  }

  /* ---------- battle in and out ---------- */
  function startBattle(expedition, order) {
    run = expedition;
    const door = run.door;
    B.door = door; B.party = order.slice(0, 3); B.log = []; B.all = []; B.pending = null; B.relayBanner = null; B.seen = new Set();
    while (B.party.length < 3) B.party.push(null);
    B.D = B.foe = null; B.allies = []; B.fallSpot = null;
    battleContext = { seed: run.seed, floor: run.floor, doorType: door.type, enemyIds: door.enemies.map(e => e.id), party: B.party.slice() };
    const opts = R.battleOptions(run, door, order);
    opts.party = B.party;
    B.bridge = createBattle(core, opts);
    $('#result').classList.remove('on');
    show('battle'); layout(); ticker('');
    play(B.bridge.start());
  }
  function finishBattle() {
    const res = R.applyBattle(run, roster, B.door, B.party, B.bridge, B.all);
    const ended = !res.win || res.wiped || run.result;
    const gained = B.bridge.heirloomsGained().filter(g => run.bench.includes(g.to));
    const rows = [];
    if (res.wiped) rows.push('<p>마지막 동료가 적과 함께 쓰러졌다. 원정은 여기서 끝난다.</p>');
    if (res.win) rows.push('<p class="gain">꿈의 결정 ◆ +' + res.crystals + ' <small>(지금 ◆ ' + run.crystals + ')</small></p>');
    if (res.fallen.length) rows.push('<div class="fallen"><small>쓰러진 동료 — 이 원정에서 돌아오지 않는다</small><div>' + res.fallen.map(id => '<span class="mini dead">' + face(id, 40) + '<b>' + esc(card(id).name) + '</b></span>').join('') + '</div></div>');
    for (const g of gained) rows.push('<p class="heirline"><b>유품</b> ' + esc(card(g.to).name) + ' ← ' + esc(card(g.from).name) + '의 ' + esc(g.name) + '<small>다음 전투부터도 한 번씩 쓸 수 있다</small></p>');
    const box = $('#result-in');
    box.innerHTML = '<h3>' + (res.win ? (B.door.type === 'boss' ? '꿈의 주인을 쓰러뜨렸다' : '돌파') : '전멸') + '</h3>' + rows.join('') + '<button class="btn go" id="b-next">' + (ended ? '결과 보기' : '다음으로') + '</button>';
    $('#result').classList.add('on');
    $('#b-next').addEventListener('click', () => {
      sfx.tap(); $('#result').classList.remove('on');
      if (ended) return onEnd(res.wiped);
      if (B.door.type === 'gate') { const c = R.gateChoices(run, B.door); if (c.length) return onGatePick(c); }
      toMap(true);
    });
  }

  function reset(expedition) {
    run = expedition;
    battleContext = null;
    B.all = [];
  }

  /** Review hooks for the live page and hidden preview panes. */
  const review = {
    advance: St.advance, B, clock, R, roster, brief, foeSheet, allySheet, fieldSheet, errors,
    state: () => (B.bridge ? B.bridge.state() : null),
    report() {
      const context = battleContext || { seed: run?.seed ?? null, floor: run?.floor ?? null, doorType: null, enemyIds: [], party: [] };
      const events = B.all.slice(-60).map(e => ({ type: e.t, who: e.who ?? null }));
      return clone({ ...context, errors, events });
    },
    async settle(max) { let t = 0; while (B.busy && t < (max || 60)) { await St.advance(0.5); t += 0.5; } return t; }
  };
  return { layout, startBattle, reset, review };
}
