import { $, esc, show } from '../dom.js';
import { foeFlip, hasFinalConsonant, logButton, traitText, TYPE } from '../widgets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { TERMS } from '../glossary.js';
import { POSITION } from '../../engine/roster.js';
import * as R from '../../engine/run.js';
import { INTRO } from '../../content/intro.js';
import { ROOM_NAMES } from '../../content/layouts.js';
import { QUIRKS } from '../../content/quirks.js';
import { REGIONS } from '../../content/regions.js';
import { CONTRACT_ESCROW } from '../../content/contracts.js';
import { create as createBattle } from '../../engine/bridge.js';
import * as Opening from '../../engine/opening.js';
import { syncBattleSpeed, tools } from '../settings.js';
import { createHud } from './hud.js';
import { createTiles } from './tiles.js';
import { createMoves } from './moves.js';
import { actionEnd, planEffects } from './effect-plan.js';
import { battleLog, openBattleLog } from './log.js';

export function contractSettlement(floor, contract) {
  if (!contract) return [];
  const rows = [];
  if (contract.metNow) rows.push('<p class="contract-met">계약 달성</p>');
  if (floor === 6) {
    if (contract.paid) rows.push('<p class="gain">7층 앞에서 ◆' + contract.paid + '</p>');
    else if (contract.failed) rows.push('<p class="contract-failed">계약 실패 · 맡긴 ◆' +
      (contract.escrowed || CONTRACT_ESCROW) + ' 사라짐</p>');
  }
  return rows;
}

export function battleMarkup() {
  return (
    '<section id="battle" class="screen">' +
    '<header id="bar"><span id="room"></span><span id="turn"></span><span class="sp"></span><button id="b-field">전장·유물</button><button id="b-speed">1배</button>' + logButton('id="b-log"') + tools() + '</header>' +
    '<div id="stage"><canvas id="cv"></canvas><div id="hud">' +
    '<div id="foebar"><div id="pf-kind"></div><div class="nm"><b id="pf-name"></b><em id="pf-el"></em><span id="pf-hpn"></span><u class="ii">i</u></div>' +
    '<div class="intent" id="intent"></div><div class="cd" id="pf-cd"></div><div class="bar hp"><u id="pf-hp"></u></div>' +
    '<div class="chips" id="pf-chips"></div></div>' +
    '<button class="sky" id="sky" aria-label="필드 정보"><span id="sky-slots"></span><span id="skyname"></span><small id="region-next"></small></button>' +
    '<div class="chips" id="pa-chips"></div></div><div id="fx"></div><div id="skip">▶▶ 고속 진행</div></div>' +
    '<div id="party"></div>' +
    '<div id="msg"><p id="relay-hint" hidden>' + esc(INTRO.relayHint) + '</p><div id="ticker"></div><div id="tally"></div></div>' +
    '<div id="panel"><div id="opening-face" class="win"></div><div id="acts"></div><div id="row2"><button id="b-heir" data-coach="heirloom"></button><button id="b-retreat" data-coach="retreat"></button></div></div>' +
    '<div class="sheet" id="result"><div class="in win" id="result-in"></div></div>' +
    '</section>'
  );
}

export function createBattleView({ core, roster, widgets, stage: St, audio, sheets, details, music }) {
  const { S, clock, wait, tween, footY: FY, headY: HY, chestY: CY } = St;
  const { sfx } = audio;
  const { card, face, faceBadge, spr } = widgets;
  const clone = o => JSON.parse(JSON.stringify(o));
  const same = (a, b) => !!a && !!b && a.side === b.side && a.idx === b.idx;
  const LINKED_TRAITS = ['ally_death_base_atk_phy', 'ally_light_death_base_matk_mag'];
  const relayHint = $('#relay-hint');

  const B = { bridge: null, door: null, party: [], allies: [], foe: null, D: null, pending: null, busy: false, log: [], all: [], relayBanner: null, armed: false, intent: null, fallSpot: null, options: [] };
  const errors = [];
  let battleContext = null;
  let run = null, onResult, onContinue, onDecision;

  function layout() {
    const frame = $('#frame'), w = Math.floor(Math.min(430, frame.clientWidth) / 2) * 2, h = frame.clientHeight;
    const top = $('#bar').offsetHeight || 48;
    const bottom = parseFloat(window.getComputedStyle($('#panel')).paddingBottom) || 8;
    const reserved = top + bottom + (h < 700 ? 270 : 365);
    const W = w / 2, H = Math.max(132, Math.min(214, Math.floor((h - reserved) / 2)));
    St.resize(W, H);
    $('#stage').style.height = H * 2 + 'px';
    if (B.allies.length) placeActors(false);
  }

  /* the party stands in a diagonal line, front fighter lowest and closest */
  const LANE = [[0.37, 0], [0.235, -14], [0.11, -27]];
  const slotPos = (k, actor) => {
    const [x, y] = LANE[Math.min(k, 2)];
    return { x: Math.round(S.W * x), y: actor ? Math.max(y, St.tall(actor) + 5 - S.BASE) : y };
  };
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
      const pos = slotPos(k, a);
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
  const { brief, renderActions, lockPanel } = createTiles({ core, widgets, audio, sheets, B, foeDef, play, ticker });
  const { beginMove, isBig, label, impact, strikeAndHit, strikeMiss, settleMove, showEffects } = createMoves({
    stage: St, sfx, actorOf, unitOf, colorsOf, applyHp, card, spr
  });
  const foeSheet = () => details.foeSheet(B);
  const allySheet = index => details.allySheet(run, B, index);
  const fieldSheet = () => details.fieldSheet(B);
  const render = fresh => hud.render(B, fresh);

  function showIntent(intent, countdown) {
    const kind = intent?.kind ?? intent?.type;
    B.intent = intent && { ...intent, kind, dmg: intent.dmg ?? (['phy', 'mag'].includes(kind) ? intent.damageRange : undefined) };
    B.countdown = countdown;
    hud.showIntent(B, countdown);
  }
  function warnEnemy() {
    const key = (B.D?.enemy?.idx ?? 0) + '/' + B.D?.turn;
    if (B.lastWarning === key) return;
    B.lastWarning = key;
    sfx.warn();
  }

  const isOpening = () => B.door.type === 'borrowed' && run.tempoVersion === 2;
  function renderReady() {
    const opening = isOpening() && B.D.turn === 1 && B.party[B.D.cur] === 'ash'
      ? Opening.openingModel?.(B.bridge) : null;
    renderActions(Number.isInteger(opening?.stand?.optionIndex) && opening?.rescue ? opening : null);
  }

  function showRegion(event) {
    const node = $('#region-next');
    const region = B.door.region;
    const bellIn = event?.region?.bellIn;
    let message = '';
    if (region?.id === 'twilight_bell' && bellIn != null) {
      message = bellIn + '턴 뒤 적 디바인 +' + (region.stacks ?? REGIONS.twilight_bell.stacks);
    } else if (region?.id === 'tide_cycle' && event && !foeDef().boss) {
      const tide = event.region?.tide ?? (B.intent?.kind === 'rest' ? B.intent : event.countdown);
      if (tide?.kind === 'rest') {
        message = '조류 · 적 휴식' + (tide.vulnerable ? ' · 받는 피해 ×' + tide.vulnerable : '');
      } else if (tide?.name && tide.inTurns != null) {
        const when = tide.inTurns === 0 ? '이번 턴' : tide.inTurns === 1 ? '다음 턴' : tide.inTurns + '턴 뒤';
        const classic = tide.name === REGIONS.tide_cycle.hit;
        const power = tide.power ?? (classic ? 2.5 : null);
        const type = TYPE[tide.kind] ?? (classic ? TYPE.mag : '');
        const attack = [type, power != null ? '×' + power : ''].filter(Boolean).join(' ');
        message = '조류 · ' + [when + ' ' + tide.name, attack].filter(Boolean).join(' · ');
      }
    } else if (region?.id === 'arena_charge' && event?.region && !B.chargeSpent) {
      message = event.region.ready ? '기세 2/2 · 다음 공격 스킬 ×2' : '기세 ' + event.region.charge + '/2';
    } else if (region?.id === 'ember_carry' && event && B.D.enemy.idx < B.door.enemies.length - 1) {
      message = '교대 시 작열 최대 2 계승';
    } else if (region?.id === 'starlit_sky' && event && B.D.turn === 1) {
      message = B.D.field.length ? '시작 필드 · ' + B.D.field.length + '개' : '시작 필드 · 비어 있음';
    }
    node.textContent = message;
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
  $('#b-field').addEventListener('click', () => {
    sfx.tap();
    details.battlefieldSheet(run, B);
  });
  $('#pa-chips').addEventListener('click', ev => { ev.stopPropagation(); if (B.D) { sfx.tap(); allySheet(Math.min(B.D.cur, 2)); } });
  $('#party').addEventListener('click', ev => { const p = ev.target.closest('.pm[data-i]'); if (p && B.D) { sfx.tap(); allySheet(Number(p.dataset.i)); } });
  syncBattleSpeed(St);
  const currentLog = () => B.bridge ? battleLog(B.all.slice(0, B.played), B.party, B.door.enemies) : run?.lastBattleLog;
  function showLog() {
    sfx.tap();
    openBattleLog(sheets, widgets, $('#result').classList.contains('on') ? run.lastBattleLog : currentLog());
  }
  $('#b-log').addEventListener('click', showLog);
  $('#result').addEventListener('click', event => {
    const id = event.target.closest('[data-sheet]')?.dataset.sheet;
    if (id) {
      sfx.tap();
      details.charSheet(run, id);
    }
  });

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
    St.clear();
    St.setRoom(B.door.bg, B.door.type === 'boss' || !!B.door.final);
    B.allies = B.party.map((id, i) => {
      const u = B.D.allies[i];
      if (!id || !u) return null;
      const actor = St.makeActor({
        sprite: id, wait: i ? 1 : 0, flip: (spr(id)?.facing || 'right') === 'left',
        vis: !u.dead && !u.out, aura: u.lastStand ? 'red' : null
      });
      return Object.assign(actor, slotPos(i, actor));
    });
    B.foe = B.D.enemy.hp > 0 ? makeFoe(foeDef()) : null;
    if (B.foe && B.D.enemy.frenzied) B.foe.aura = 'red';
    hud.buildParty(run, B.party); showIntent(null); showRegion();
    $('#room').textContent = roomLabel();
    $('#tally').innerHTML = '';
    return QUIRKS[B.door.quirk];
  }
  async function intro(e) {
    B.D = clone(e.s);
    const q = setupBattleStage(), def = foeDef();
    if (isOpening() && Opening.openingModel || B.fromMap && !def.boss && !B.door.final) {
      render(true);
      return;
    }
    B.allies.forEach((a, i) => { if (a) a.x = -60 - i * 26; });
    B.foe.x = S.W + 70;
    render(true);
    const jobs = lineup(B.D).map((idx, k) => wait(k * 0.08).then(() => tween(B.allies[idx], slotPos(k, B.allies[idx]), 0.4)));
    jobs.push(wait(0.25).then(() => tween(B.foe, { x: foePos().x }, 0.4)).then(() => { St.dust(B.foe.x, FY(B.foe)); sfx.enter(); }));
    await Promise.all(jobs);
    await showBanner(def.kind, B.door.enemies.map(d => d.name).join(' → '), def.boss ? 'ult' : '', 0.8);
    if (q) await showBanner('꿈의 변덕', q.name + ' · ' + q.desc, 'gold', 0.95);
  }
  async function onAct(e, effects) {
    const actor = actorOf(e.who), isFoe = e.who.side === 'enemy';
    if (!actor) return;
    $('#tally').innerHTML = '';
    const strong = isFoe && e.salience === 'strong';
    showIntent(null);
    if (e.charge) {
      if (strong) {
        warnEnemy();
        await highlightStrong(e, actor);
        return;
      }
      S.dark = 0.3; warnEnemy(); St.converge(St.X(actor), CY(actor), 24, colorsOf(e.who), 40, 0.5); label('힘 충전 중…', actor, 'bad');
      await wait(0.6); tween(S, { dark: 0 }, 0.3); return;
    }
    if (strong) {
      warnEnemy();
      await highlightStrong(e, actor);
    }
    if (e.skill.type === 'sup') {
      actor.front = 1;
      if (!effects.some(effect => effect.at === 'caster')) label(e.skill.name, actor, 'good');
      if (!effects.length) {
        sfx.buff();
        St.ring(St.X(actor), CY(actor), '#5fd4a8', 24, 0.3, reducedMotion());
        if (!reducedMotion()) St.rise(St.X(actor), FY(actor) - 8, 12, ['#5fd4a8', '#d6fff7', '#ffc857'], 30);
      }
      if (!reducedMotion()) { await tween(actor, { oy: -4 }, 0.08); await tween(actor, { oy: 0 }, 0.1, 'in'); }
      await wait(0.1);
      actor.front = 0; return;
    }
    B.pending = beginMove(e, actor, isFoe);
    if (e.ult || e.salience === 'boss') { warnEnemy(); await wait(0.12); }
    else if (!strong && e.skill.name !== '일반 공격' && !isBig(B.pending) && !effects.some(effect => effect.kind === 'delay')) {
      B.pending.call = St.number(e.skill.name + (e.delayed ? ' 발동' : ''), St.X(actor), HY(actor) - 12, 'call');
    }
  }
  async function highlightStrong(e, actor) {
    actor.white = 0.15;
    const name = label(e.skill.name, actor, 'strong-call', -8);
    await wait(0.15);
    name.remove();
  }
  async function onHp(e, action) {
    const p = B.pending;
    const step = action?.hp.get(e);
    if (e.who.side === 'enemy' && e.delta < 0 && e.cause?.by?.side === 'ally') {
      const source = e.cause.by;
      B.lastStriker = { id: unitOf(source)?.form || B.party[source.idx], name: unitOf(source)?.name,
        donor: p && same(source, p.e.who) ? p.e.heirFrom : null };
    }
    const finisher = e === B.finalHit;
    if (p && step?.strike) {
      let sum = null;
      if (!finisher && p.stage === 'ready' && !p.isFoe && tallyWorthy(e, B.hitRecord)) {
        sum = tally(e.calc, e.amount, B.hitRecord);
        if (!isBig(p)) await sum;
      }
      await strikeAndHit(p, step, B.hitRecord, action.effects.length > 0, finisher ? finishHit : null);
      if (sum && action.effects.length) action.tally = sum;
      else if (sum) await sum;
      return;
    }
    if (e.cause?.kind === 'relay' && e.who.side === 'enemy' && e.delta < 0) { await relayHit(e); return; }
    if (finisher) return finishHit(e);
    const actor = actorOf(e.who);
    applyHp(e);
    if (!actor) return;
    if (e.delta > 0) { St.number(step?.label ?? '+' + e.amount, St.X(actor), HY(actor) - 2, 'heal'); sfx.buff(); }
    else if (e.cause?.kind === 'self') { St.number('-' + e.amount + ' 반동', St.X(actor), HY(actor) + 8, 'self'); actor.white = 0.06; }
    else { actor.white = 0.08; St.number(step?.label ?? String(e.amount), St.X(actor), HY(actor) - 2, e.who.side === 'ally' ? 'foe' : ''); sfx.hit(false); }
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
    if (e === B.finalHit) {
      const finisher = B.D.allies[idx >= 0 ? idx : e.cause.victim?.idx];
      await finishHit(e, finisher && { id: finisher.form, name: finisher.name });
    } else {
      impact(e, { crit: !!e.calc?.crit, adv: !!e.calc?.adv, colors, prefix: '반격 ' }, B.hitRecord);
      await wait(0.28);
    }
    if (from) { from.pose = 'idle'; from.front = 0; }
    if (foe && B.D.enemy.hp > 0) foe.pose = 'idle';
  }
  function applyBuff(e) {
    const u = unitOf(e.who); if (!u) return;
    if (e.to) u.buffs[e.id] = e.to; else delete u.buffs[e.id];
  }
  function applyEffects(events) {
    for (const e of events) {
      if (e.t === 'buff') applyBuff(e);
      else B.D.field = e.list.slice();
    }
    if (events.length) render();
  }
  async function finishActionEffects(action) {
    if (action.effects.length) {
      const move = B.pending;
      if (action.effects.some(effect => effect.at === 'caster')) move?.call?.remove();
      const elapsed = move?.hitAt == null ? null : clock.t - move.hitAt;
      const pause = elapsed == null ? 0 : Math.max(0, 0.18 - elapsed);
      await Promise.all([settlePending(), pause > 0 ? wait(pause) : null]);
    }
    applyEffects(action.changes);
    await showEffects(action.effects, $('#sky'));
    await action.tally;
    for (const down of action.downs) await handle(down);
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
    const text = e.linked && idx >= 0 ? B.D.allies[idx].name + ' · ' + traitText(card(B.party[idx]).trait) : (victim ? victim.name : '') + ' · ' + traitText(e.trait);
    if (B.relayBanner) B.relayBanner.remove();
    B.relayBanner = St.banner('계승', text, 'low');
    sfx.relay();
    await wait(0.42);
  }
  async function onLastStand(e) {
    const a = actorOf(e.who), u = unitOf(e.who); if (u) u.lastStand = true;
    render();
    if (a) {
      a.aura = 'red';
      St.ring(St.X(a), CY(a), '#ff6b5e', 24);
    }
    if (B.showLastStand) {
      B.showLastStand = false;
      sfx.warn();
      const plate = St.plate(u?.name || '', '최후의 일인', '#ff6b5e', 1);
      await wait(0.85);
      plate.remove();
    }
  }
  async function onRule(e) {
    const who = e.who && !Array.isArray(e.who) ? actorOf(e.who) : null;
    switch (e.rule) {
      case 'echo': if (who) { label('메아리', who, 'good', -10); St.ring(St.X(who), CY(who), '#a8ffe0', 34); sfx.cast(); } await wait(0.18); break;
      case 'thorns': if (who) label('가시 -' + e.amount, who, 'bad', 6); await wait(0.12); break;
      case 'leech': if (who) { label('흡혈', who, 'bad', -10); St.rise(St.X(who), FY(who), 10, ['#ff6b5e', '#ffb0a8'], 24); } await wait(0.12); break;
      case 'frenzy': if (who) { who.aura = 'red'; label('광폭 · 공·마공 ×1.5', who, 'bad', -10); warnEnemy(); } await wait(0.45); break;
      case 'overflow': if (who) label('초과 피해 ' + e.amount, who, 'good', -10); await wait(0.2); break;
      case 'starfall': await wait(0.05); break;
      case 'martyr': await showBanner('순교', '남은 아군 공격·마공 +40%', 'gold', 0.7); break;
      case 'twilight_bell': {
        const bell = St.bellPosition();
        if (bell) St.ring(bell.x, bell.y, '#ffc857', 34);
        ticker(e.stacks ? '종이 울렸다 · 적 디바인 +' + e.stacks : '종이 울렸다');
        sfx.buff();
        break;
      }
      case 'ember_carry': if (who) label('작열 계승 +' + e.stacks, who, 'bad'); break;
      case 'tide_cycle':
        ticker(e.vulnerable ? e.name + ' · 적이 받는 피해 ×' + e.vulnerable : '조류가 물러났다 · 적 휴식');
        break;
      case 'arena_charge':
        B.chargeSpent = true;
        showRegion();
        if (who) label('기세 ×' + e.multiplier, who, 'good');
        break;
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
    const b = St.banner('후퇴', (u ? u.name : '') + ' · 안전 이탈', 'gold');
    if (a) { sfx.miss(); await tween(a, { oy: -8 }, 0.1); await tween(a, { oy: 0, x: -80, alpha: 0.2 }, 0.4, 'in'); a.vis = false; }
    await wait(0.3); b.remove();
  }
  async function foeDeath(e) {
    const foe = B.foe; if (!foe) return;
    B.D.enemy.hp = 0; render(); showIntent(null);
    if (B.finalHit && same(B.finalHit.who, e.who) && B.finishNumber) {
      St.removeActor(foe);
      B.foe = null;
      S.beads.burn = S.beads.divine = 0;
      return;
    }
    foe.pose = 'hurt'; foe.white = 0.16; foe.front = 1; S.flash = 0.4; S.shake = 6; sfx.hit(true);
    St.sparks(St.X(foe), CY(foe), 40, ['#3a2f58', '#8b6cff', '#ffffff'], 100);
    if (e.treasure) label('보물 발견', foe, 'good', -14);
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
    await showBanner((e.who.idx + 1) + '/' + B.door.enemies.length, e.name + ' 출현', def.boss ? 'ult' : '', 0.6);
  }
  const bossRoom = () => B.door.type === 'boss' || !!B.door.final;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frames = count => wait(count / 60);

  async function finishHit(e, striker) {
    const foe = B.foe;
    applyHp(e);
    if (!foe) return;
    const reduced = reducedMotion();
    B.finisher = striker ?? (e.cause?.by?.side === 'ally' || e.cause?.rule === 'overflow' ? B.lastStriker : null);
    showIntent(null);
    foe.pose = 'hurt';
    foe.front = 1;
    if (!reduced) {
      clock.slow = 0.05;
      try { await frames((bossRoom() ? 6 : 3) * clock.slow); }
      finally { clock.slow = 1; }
    }
    B.finishNumber = St.number(e.amount.toLocaleString('en-US'), St.X(foe), HY(foe) - 6, 'finish-damage');
    sfx.hit(true);
    if (!reduced) {
      foe.white = 0.08;
      S.shake = bossRoom() ? 6 : 3;
      St.ring(St.X(foe), CY(foe), '#ffc857', 32);
      await frames(6);
      foe.look = 'shadow';
      await tween(foe, { alpha: 0, oy: 14 }, 8 / 60, 'in');
    } else {
      foe.vis = false;
    }
  }

  function finishPortrait(survivors, amount) {
    const faceFrom = B.finisher?.id && faceBadge(B.finisher.id, B.finisher.name);
    const donor = B.finisher?.donor;
    const strike = amount == null ? '마지막 일격' : '마지막 일격 · ' + amount.toLocaleString('en-US') + ' 피해';
    return '<div class="finish-portrait">' + (faceFrom || amount != null ? '<div><small>' + strike + '</small>' + (faceFrom || '') + '</div>' : '') +
      (donor ? '<div><small>유품 원주인</small>' + faceBadge(donor) + '</div>' : '') +
      (survivors.length ? '<div><small>생환</small><div class="finish-survivors">' + survivors.map(id => faceBadge(id)).join('') + '</div></div>' : '') +
      '</div>';
  }

  function outcomeCue(track, fallback) {
    const status = music?.playOutcome(track, B.outcomeKey);
    if (!status || status === 'unavailable') fallback();
  }

  async function victory() {
    outcomeCue('victory', sfx.win);
    showIntent(null); S.danger = 0; tween(S, { dark: 0 }, 0.2);
    if (B.finishNumber) {
      const living = B.bridge.survivors();
      const survivors = B.party.filter((id, index) => id && living[index]);
      const plate = document.createElement('div');
      plate.className = 'finish-cast win';
      plate.innerHTML = '<b>승리</b>' + finishPortrait(survivors);
      $('#fx').append(plate);
      await frames(reducedMotion() ? 2 : bossRoom() ? 44 : 18);
      plate.remove();
      B.finishNumber.remove();
      return;
    }
    const b = St.banner('승리', run.floor + '층 · ' + ROOM_NAMES[B.door.type], 'gold big');
    const fp = foePos();
    if (B.door.reward) St.gem(fp.x, S.BASE - 30, S.W - 60, 2, 0.65);
    for (const idx of lineup(B.D)) { const a = B.allies[idx]; tween(a, { oy: -6 }, 0.12).then(() => tween(a, { oy: 0 }, 0.14, 'in')); }
    await wait(1.2); b.remove();
  }
  async function defeat() {
    outcomeCue('defeat', sfx.lose);
    showIntent(null); tween(S, { dark: 0.6 }, 0.6);
    const b = St.banner('전멸', '꿈길이 끊겼다', 'ult big');
    await wait(1.4); b.remove();
  }

  /* ---------- the event player ---------- */
  async function handle(e, action) {
    switch (e.t) {
      case 'log': logLine(e.text); break;
      case 'begin': await intro(e); break;
      case 'turn': await settlePending(); B.D.turn = e.n; render(); break;
      case 'act': await settlePending(); await onAct(e, action.effects); break;
      case 'mp': { const u = unitOf(e.who); if (u) { u.mp += e.delta; render(); } break; }
      case 'hp': await onHp(e, action); break;
      case 'buff':
      case 'field':
        applyEffects([e]);
        await showEffects(planEffects([e], { core, artifacts: B.artifacts }), $('#sky'));
        break;
      case 'miss': if (B.pending?.stage === 'ready') await strikeMiss(B.pending, e.why); break;
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
        await settlePending(); B.D = clone(e.s); await placeActors(true); render(); showIntent(e.intent, e.countdown);
        if (['strong', 'boss'].includes(e.intent?.salience) || !e.intent?.salience && e.countdown?.inTurns <= 1) warnEnemy();
        showRegion(e); renderReady();
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
      showRegion(ready);
    } finally {
      if (B.bridge.awaiting) {
        renderReady();
      }
    }
  }
  async function play(events) {
    if (!events.length) return;
    const bridge = B.bridge;
    B.busy = true; lockPanel();
    const start = B.all.length;
    if (start && !relayHint.hidden) {
      relayHint.hidden = true;
      ticker('');
    }
    B.all = B.all.concat(events);
    if (events.some(e => e.t === 'win')) {
      B.finalHit = events.findLast(e => e.t === 'hp' && e.who?.side === 'enemy' &&
        e.who.idx === B.door.enemies.length - 1 && e.delta < 0 && e.amount > 0 && (e.s?.enemy?.hp ?? 0) === 0);
    }
    let i = 0, action;
    try {
      for (; i < events.length; i++) {
        if (bridge !== B.bridge || !$('#battle').classList.contains('on')) return;
        B.played = start + i + 1;
        const e = events[i];
        if (e.t === 'act') {
          const end = actionEnd(events, i);
          const plan = planEffects(events.slice(i, end), { core, artifacts: B.artifacts, next: events[end]?.s });
          action = {
            end,
            hp: new Map(plan.filter(step => step.event).map(step => [step.event, step])),
            effects: plan.filter(step => !step.event),
            changes: [],
            downs: []
          };
        }
        if (action && (e.t === 'buff' || e.t === 'field')) action.changes.push(e);
        else if (action && e.t === 'down') action.downs.push(e);
        else await handle(e, action);
        if (action?.end === i + 1) {
          await finishActionEffects(action);
          action = null;
        }
      }
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
      B.played = B.all.length;
    } finally {
      if (bridge === B.bridge) {
        B.busy = false; clock.fast = false; $('#skip').className = '';
      }
    }
    if (bridge !== B.bridge || !$('#battle').classList.contains('on')) return;
    if (bridge.outcome) finishBattle();
    else if (bridge.awaiting) B.onReady?.(B);
  }

  /* ---------- battle in and out ---------- */
  function roomLabel() {
    // The bar is narrow: plain kind only ('보스', not '보스 · 꿈의 주인'); the door card carries the flavour name.
    const plain = TERMS[B.door.type]?.short?.split(' · ')[0];
    return run.daily ? '균열 ' + run.floor + '층' : run.floor + '층 · ' + (plain ?? ROOM_NAMES[B.door.type]);
  }

  function startBattle(expedition, options, settle, advance, {
    fromMap = false, decision, simpleOpening = false, onAction, onReady, replay = []
  } = {}) {
    run = expedition;
    onResult = settle;
    onContinue = advance;
    onDecision = decision;
    const door = run.room;
    B.onAction = onAction;
    B.onReady = onReady;
    B.door = door; B.party = options.party; B.log = []; B.all = []; B.pending = null; B.relayBanner = null;
    B.played = 0;
    B.fromMap = fromMap;
    B.lastWarning = null;
    B.blessingViews = new Map();
    B.finalHit = B.finishNumber = B.finisher = B.lastStriker = null;
    B.outcomeKey = Symbol();
    B.artifacts = options.artifacts;
    B.temporaryRelic = run.nextBattle?.relic;
    B.chargeSpent = false;
    B.hitRecord = { best: run.stats.best };
    B.showLastStand = run.stats.lastStands === 0 || door.type === 'boss' || !!door.final;
    B.D = B.foe = null; B.allies = []; B.fallSpot = null;
    battleContext = { seed: run.seed, floor: run.floor, doorType: door.type, enemyIds: door.enemies.map(e => e.id), party: B.party.slice() };
    B.bridge = createBattle(core, options);
    $('#result').classList.remove('on');
    $('#battle').classList.remove('resumed-result', 'opening-decision');
    for (const id of ['b-field', 'b-speed', 'b-log']) $('#' + id).hidden = simpleOpening;
    $('#acts').innerHTML = '';
    $('#b-heir').className = '';
    relayHint.hidden = door.type !== 'borrowed' || isOpening() && !!Opening.openingModel;
    music?.play(door.type === 'boss' || door.final ? 'boss' : 'battle', run.dungeonId);
    show('battle'); layout(); ticker('');
    // The run codec restores a fighting room at its pre-battle checkpoint.
    const events = B.bridge.start();
    for (const action of replay) {
      const accepted = action === 'retreat' ? B.bridge.retreat() : B.bridge.act(action);
      if (!accepted.length) break;
      events.push(...accepted);
    }
    play(events);
  }
  function finishBattle() {
    const res = onResult(B.bridge.summary(), currentLog());
    if (res?.ok) {
      showResult(onContinue, onDecision, false);
      B.onReady?.(B);
    }
  }

  function showResult(advance, decision, restored) {
    const result = run.lastBattleResult ?? {
      floor: run.floor, roomType: run.room.type, outcome: 'win', wiped: false,
      fallenIds: [], survivorIds: [], transfers: [],
      rewardDelta: { crystals: 0, relicIds: run.lastBattleRelic ? [run.lastBattleRelic] : [] }
    };
    const { floor, roomType, outcome, wiped, fallenIds, transfers, rewardDelta } = result;
    const won = outcome === 'win';
    const final = roomType === 'boss' || run.room.final;
    const name = id => card(id)?.name ?? id;
    const rows = [];
    if (fallenIds.length) {
      const list = fallenIds.map(name).join('·');
      rows.push('<p class="result-fallen">' + esc(list + (hasFinalConsonant(list) ? '이' : '가') + ' 쓰러졌습니다.') + '</p>');
    }
    if (transfers.length) {
      const lines = transfers.map(({ toId, skillName }) => {
        const target = name(toId);
        return '<p>' + esc(target + (hasFinalConsonant(target) ? '이 ' : '가 ')) +
          '<b>' + esc(skillName) + '</b>' + (hasFinalConsonant(skillName) ? '을' : '를') + ' 물려받았습니다.</p>';
      });
      rows.push('<div class="heirline"><span class="run-face">' + face(transfers[0].toId, 40) + '</span>' +
        '<div>' + lines.join('') + '</div></div>');
    }
    if (rewardDelta.crystals > 0) {
      rows.push('<p class="gain">' + TERMS.crystal.short + ' +' + rewardDelta.crystals + ' · 보유 ' + run.crystals + '개</p>');
    }
    const contract = run.contract && { ...run.contract, metNow: run.contract.metAtFloor === floor };
    if (!run.awaitingRetryResult) rows.push(...contractSettlement(floor, contract));
    const wager = (run.lastBattleLog?.at(-1)?.rows ?? []).find(row => row.kind === 'wager');
    if (run.features?.bets !== false && wager) rows.push('<p>' + esc(wager.text) + '</p>');
    if (won && wiped && final) rows.push('<p class="result-return">보스 격파 · 돌아온 동료 0명</p>');
    else if (won && wiped) rows.push('<p>돌아온 동료가 없어 원정이 끝났습니다.</p>');

    let label = (floor + 1) + '층으로';
    if (run.awaitingRetryResult) label = '편성 바꿔 재도전';
    else if (run.result && !run.pending) {
      const rewards = R.runRewards(run);
      label = run.daily ? '균열 기록 보기' : rewards.recruitable.length ? '영입할 동료 고르기' :
        rewards.shardCandidates.length ? '다음 원정 후보 고르기' : '관측소로';
    } else if (roomType === 'borrowed') label = '다음 동료 고르기';
    else if (run.pending?.kind === 'reinforcement') label = '동료 보충하기';
    else if (run.pending?.kind === 'gate') label = '문지기 보상 고르기';
    else if (run.pending?.kind === 'relic') label = '유물 보상 고르기';

    const title = won ? (run.daily ? '균열' : DUNGEONS[run.dungeonId].name) + ' ' + floor + '층 돌파' : '전멸';
    const box = $('#result-in');
    box.innerHTML = '<header class="result-heading ' + (won ? 'won' : 'lost') + '"><h3>' + esc(title) + '</h3>' +
      logButton('id="b-result-log"') + '</header>' + rows.join('') +
      '<div class="result-decision"></div><button class="btn go" id="b-next" data-coach="result-next">' + esc(label) + '</button>';
    $('#result').classList.add('on');
    if (!restored) {
      if (rewardDelta.crystals > 0) sfx.credit();
      if (rewardDelta.relicIds.length) sfx.gem();
    }
    $('#b-result-log').addEventListener('click', showLog);
    const next = $('#b-next', box);
    const reward = won && run.phase === 'reward' && roomType !== 'borrowed';
    const pending = () => reward && ['reinforcement', 'gate', 'relic'].includes(run.pending?.kind);
    const content = $('.result-decision', box);
    if (reward) decision?.(content, result, next);
    if (pending() && !restored) music?.holdReward(run.dungeonId);
    box.scrollTop = 0;
    next.addEventListener('click', () => {
      sfx.tap();
      if (pending()) decision(content, result, next, true);
      else {
        next.disabled = true;
        $('#result').classList.remove('on');
        advance();
      }
    });
  }

  function attach(expedition) {
    if (run === expedition) return;
    if (B.busy) {
      clock.waiters.length = clock.tweens.length = 0;
      clock.fast = false;
      clock.slow = 1;
      B.busy = false;
    }
    B.bridge = null;
    run = expedition;
    battleContext = null;
    B.all = [];
  }

  function restoreResult(expedition, advance, decision) {
    attach(expedition);
    B.D = B.foe = B.bridge = null;
    B.allies = [];
    B.log = [];
    B.finalHit = B.finisher = null;
    B.door = run.room;
    B.artifacts = run.relics;
    B.temporaryRelic = null;
    relayHint.hidden = true;
    music?.holdReward(run.dungeonId);
    St.clear();
    St.setRoom(run.room.bg, !!run.room.final);
    $('#battle').classList.remove('opening-decision');
    $('#battle').classList.add('resumed-result');
    $('#room').textContent = roomLabel();
    $('#turn').textContent = '';
    show('battle');
    layout();
    lockPanel();
    showResult(advance, decision, true);
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
  return { layout, startBattle, attach, restoreResult, review, get expedition() { return run; } };
}
