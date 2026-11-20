import { $, esc } from '../dom.js';
import { TYPE, formatRange } from '../widgets.js';
import { relicMarks } from '../relics.js';
import { ELEMENT, POSITION } from '../../engine/roster.js';
import { AFFIXES } from '../../content/affixes.js';
import * as Bridge from '../../engine/bridge.js';

export const GOOD = ['guard', 'evasion', 'barrier', 'magic_guard', 'damage_half'];
export const FIELD = {
  sun_bless: ['태양', '#ffb347'], moon_bless: ['달', '#7fb3ff'], sanctuary: ['성역', '#fff1a8'], goddess_descent: ['여신', '#ffd6f0'],
  destiny_oath: ['서약', '#ff8fb1'], earth_bless: ['대지', '#9ad06a'], twinkle_party: ['트윙', '#ffe07a'], star_powder: ['별', '#cfe3ff'],
  valentine: ['발렌', '#ff7aa8'], arena: ['투기', '#ff7a5a'], reaper_realm: ['사신', '#a678ff'], gale: ['질풍', '#7fe3c8']
};
export const fieldCap = (core, artifacts) => artifacts?.includes('buff_overload') ? 5 : core.GAME_CONSTANTS.MAX_FIELD_BUFFS;
export const skyRelics = B => (B.artifacts || []).filter(id => id === 'buff_overload' ||
  (id === 'gale_storm' && B.D?.turn <= 3 && B.D.field.includes('gale')));

const INTENT_TYPE = { ...TYPE, charge: '충전', stun: '기절' };
export const BLOCKED_BY = { magic_guard: '매직가드', barrier: '배리어', evasion: '회피', stun: '기절' };
export const mpLossText = effect => effect?.kind === 'mp'
  ? effect.mode === 'all' ? '현재 MP 전부 소멸' : Number.isFinite(effect.amount) ? '현재 MP −' + effect.amount : '현재 MP 감소'
  : '';

export function intentLines(intent, countdown, hp, buffNames = {}) {
  if (!intent) return [];
  const { kind, resourceEffect, vulnerable } = intent;
  const range = intent.damageRange ?? intent.dmg;
  const hits = intent.conditions?.find?.(condition => condition.kind === 'enemyHitThisTurn');
  const attack = kind === 'phy' || kind === 'mag';
  const falls = intent.lethalText ?? (intent.lethal && Array.isArray(range) && hp != null
    ? range[0] >= hp ? '명중 시 쓰러짐' : '쓰러질 수 있음' : '');
  const damage = attack && range != null ? (Number.isFinite(hits?.whenMet) && Number.isFinite(hits?.otherwise) && hits.met == null
    ? '때리면 ' + hits.whenMet + ' / 안 때리면 ' + hits.otherwise
    : 'HP ' + formatRange(range) + (hits?.met ? ' · 이미 피격' : '')) : '';
  const resource = kind === 'stun' ? '' : mpLossText(resourceEffect) ||
    (intent.extra?.includes('mana_burn') ? '현재 MP 전부 소멸' : '');
  const clean = kind !== 'stun' && intent.rule === 'cleanse'
    ? '자기 약화 전부 해제 · 지금 ' + (Object.entries(intent.debuffs ?? {}).map(([id, value]) =>
      (buffNames[id] ?? id) + ' ' + value).join(' · ') || '약화 없음') : '';
  const modifier = kind === 'stun' ? '행동 불가' : vulnerable ? '받는 피해 ×' + vulnerable :
    kind === 'charge' ? '충전' : intent.reduction ? '다음 턴 받는 피해 ' + Math.round(intent.reduction * 100) + '% 감소' :
      intent.rule === 'swap_stats' ? '명중 뒤 공·마공, 물방·마방 교환' : clean;
  const block = resourceEffect?.preventedBy ?? intent.preventedBy;
  const name = (kind === 'charge' ? intent.name?.replace(/ 차징$/, ' 충전') : intent.name) || INTENT_TYPE[kind];
  const blocked = kind !== 'stun' && BLOCKED_BY[block] ? BLOCKED_BY[block] + '로 차단' : '';
  const current = ['내 행동 뒤', [name, modifier && !name?.includes(modifier) ? modifier : ''].filter(Boolean).join(' · '),
    blocked ? [attack ? damage : '', blocked].filter(Boolean).join(' / ') : [damage, resource].filter(Boolean).join(' / '), falls].filter(Boolean).join(' · ');
  const next = Object.hasOwn(intent, 'nextDistinct') ? intent.nextDistinct : countdown && { ...countdown,
    inTurns: (countdown.inTurns ?? 0) + (countdown.charge ? 1 : 0) };
  const sameName = next?.name === intent.name && kind !== 'charge';
  const future = next?.name && next.inTurns > 0 && !sameName ?
    (next.inTurns === 1 ? '다음 턴 ' : next.inTurns + '턴 뒤 ') + [next.name, next.alt].filter(Boolean).join(' 또는 ') +
    (TYPE[next.kind] ? ' · ' + TYPE[next.kind] + (next.power ? ' ×' + next.power : '') : '') : '';
  return [current, future];
}

export function affixLines(unit) {
  return (unit.affixes ?? []).map(id => (AFFIXES[id] && Bridge.affixView?.(id, unit)) ??
    (AFFIXES[id] && { id, name: AFFIXES[id].name, text: AFFIXES[id].desc })).filter(Boolean);
}

export function createHud(core, stage, sfx, widgets) {
  const { S, wait, footY: FY } = stage;
  const { face, card } = widgets;

  function chips(node, unit, isFoe) {
    const out = [];
    for (const id of Object.keys(unit.buffs)) {
      const v = unit.buffs[id]; if (!v) continue;
      const name = core.BUFF_NAMES[id] || id;
      if (id === 'burn') out.push('<i class="burn">작열 ' + v + '</i>');
      else if (id === 'divine') out.push('<i class="div">디바인 ' + v + '</i>');
      else if (isFoe && id === 'damage_half' && unit.affixes?.includes('tough')) continue;
      else if (id === 'defProtocolPhy') out.push('<i class="good">물리방어↑</i>');
      else if (id === 'defProtocolMag') out.push('<i class="good">마법방어↑</i>');
      else out.push('<i class="' + (GOOD.includes(id) ? 'good' : 'bad') + '">' + esc(name) + (GOOD.includes(id) && v > 1 ? ' ' + v : '') + '</i>');
    }
    if (isFoe) {
      if (unit.charging) out.push('<i class="bad">차징</i>');
      for (const affix of affixLines(unit)) out.push('<i class="affix' + (affix.id === 'frenzy' && affix.active ? ' on' : '') +
        '">' + esc([affix.name, affix.text].filter(Boolean).join(' · ')) + '</i>');
    } else if (unit.lastStand) out.push('<i class="last">최후의 일인</i>');
    node.innerHTML = out.join('');
  }
  function bar(u, hp, max, instant) {
    const k = Math.max(0, Math.min(1, hp / max));
    if (instant) { u.style.transition = 'none'; u.style.width = k * 100 + '%'; void u.offsetWidth; u.style.transition = ''; }
    u.style.width = k * 100 + '%'; u.className = k <= 0.25 ? 'low' : k <= 0.5 ? 'mid' : '';
  }
  function buildParty(run, party) {
    $('#party').innerHTML = party.map((id, i) => {
      if (!id) return '<div class="pm none"></div>';
      return '<div class="pm" data-i="' + i + '"><span class="face">' + face(id, 40) + '<i>' + POSITION[i] + '</i></span><span class="info">' +
        '<span class="top"><b>' + esc(card(id).name) + '</b>' + (run.heirlooms[id] ? '<i class="h">유</i>' : '') + '</span>' +
        '<span class="bar hp"><u></u><span class="n"></span></span><span class="bar mp"><u></u><span class="n"></span></span></span><em class="st"></em></div>';
    }).join('');
  }
  function render(B, fresh) {
    const D = B.D; if (!D) return;
    $('#turn').textContent = D.turn + '턴';
    D.allies.forEach((a, i) => {
      const node = $('#party .pm[data-i="' + i + '"]'); if (!a || !node) return;
      node.className = 'pm ' + (a.dead ? 'dead' : a.out ? 'out' : i === D.cur ? 'cur' : 'wait') + (a.lastStand ? ' last' : '');
      bar($('.hp u', node), a.hp, a.maxHp, fresh); $('.hp .n', node).textContent = a.hp + '/' + a.maxHp;
      $('.mp u', node).style.width = Math.max(0, Math.min(1, a.mp / a.maxMp)) * 100 + '%'; $('.mp .n', node).textContent = a.mp;
      $('.st', node).textContent = a.dead ? '쓰러짐' : a.out ? '물러남' : '';
    });
    const me = D.allies[Math.min(D.cur, 2)];
    chips($('#pa-chips'), me && !me.dead && !me.out ? me : { buffs: {} }, false);
    const foe = D.enemy, def = B.door.enemies[foe.idx];
    enemyHeading(B);
    $('#pf-name').textContent = foe.name;
    const el = $('#pf-el'); el.textContent = ELEMENT[def.element] || ''; el.className = 'el-' + def.element;
    bar($('#pf-hp'), foe.hp, foe.maxHp, fresh); $('#pf-hpn').textContent = foe.hp.toLocaleString('en-US') + ' / ' + foe.maxHp.toLocaleString('en-US');
    chips($('#pf-chips'), foe, true);
    placeSky();
    S.beads.burn = foe.buffs.burn || 0; S.beads.divine = foe.buffs.divine || 0;
    if (B.foe) { S.beads.x = B.foe.x; S.beads.y = FY(B.foe); }
    $('#sky-slots').innerHTML = relicMarks(core, skyRelics(B)) + Array.from({ length: fieldCap(core, B.artifacts) }, (_, i) => {
      const id = D.field[i], f = id && (FIELD[id] || [id.slice(0, 2), '#ccc']);
      return f ? '<i class="on" style="background:' + f[1] + '">' + esc(f[0].slice(0, 1)) + '</i>' : '<i></i>';
    }).join('');
    $('#skyname').textContent = D.field.map(id => core.BUFF_NAMES[id] || id).join(' · ');
    const newest = D.field[D.field.length - 1];
    S.tint = newest ? (FIELD[newest] || [0, '#ccc'])[1] : S.tint; S.tintA = newest ? 1 : 0;
  }
  function ticker(text, retreat = false) {
    const node = $('#ticker');
    node.textContent = text;
    node.classList.toggle('retreat-preview', retreat);
    node.classList.toggle('retreat-outcomes', retreat && text.includes('\n'));
  }

  function placeSky() {
    $('#sky').style.top = ($('#foebar').offsetHeight + 12) + 'px';
  }

  function enemyHeading(B) {
    const idx = B.D?.enemy?.idx ?? 0;
    const def = B.door?.enemies[idx];
    if (!def) return;
    const kind = $('#pf-kind');
    const number = B.door.enemies.length > 1 ? ' ' + (idx + 1) + '/' + B.door.enemies.length : '';
    const type = INTENT_TYPE[B.intent?.kind];
    kind.textContent = (def.kind || '') + number + (type ? ' · 다음 ' + type : '');
    kind.className = def.boss ? 'boss' : def.look === 'shadow' ? 'shadow' : def.elite ? 'elite' : '';
  }

  function showIntent(B, countdown) {
    const n = $('#intent'), c = $('#pf-cd');
    const { intent, D } = B;
    const [current, future] = intentLines(intent, countdown, D?.allies[D?.cur]?.hp, core.BUFF_NAMES);
    const boss = intent?.salience === 'boss' || intent?.salience == null && intent?.ult;
    const danger = boss || intent?.salience === 'strong' || /쓰러/.test(current ?? '');
    n.textContent = current ?? '';
    n.className = 'intent' + (current ? ' on' : '') + (boss ? ' ult' : '') + (danger ? ' danger' : '');
    c.textContent = future ?? '';
    c.className = 'cd' + (future ? ' on' : '');
    S.danger = boss ? 1 : 0;
    enemyHeading(B);
    placeSky();
  }

  function shortLine(line) {
    if (/상성 우위/.test(line)) return '상성 ×1.2';
    if (/HP 100%/.test(line)) return 'HP 100% ×2';
    if (/랜덤 배율/.test(line)) return line.replace(/랜덤 배율! ?/, '무작위 ');
    let t = line.replace(/^\[[^\]]+\]\s*/, '').replace(/[!.]+$/, '');
    const colon = t.indexOf(': '); if (colon > 0 && colon < 12) t = t.slice(colon + 2);
    return t.length > 18 ? t.slice(0, 17) + '…' : t;
  }
  const tallyWorthy = (e, stats) => !!e.calc && ((e.calc.lines.length + (e.calc.crit ? 1 : 0)) >= 2 || (e.amount > stats.best && e.amount >= 250));
  async function tally(calc, amount, stats) {
    const barNode = $('#tally'); barNode.innerHTML = '';
    const steps = [(calc.stat === 'atk' ? '공격 ' : '마공 ') + calc.base, '×' + calc.val].concat(calc.lines.map(shortLine));
    if (calc.crit) steps.push('치명타');
    for (let i = 0; i < steps.length; i++) { const s = document.createElement('span'); s.textContent = steps[i]; barNode.appendChild(s); sfx.tick(i); await wait(0.12); }
    const sum = document.createElement('span'); sum.className = 'sum'; sum.textContent = '= ' + amount.toLocaleString('en-US'); barNode.appendChild(sum); sfx.tick(steps.length + 2);
    if (amount > stats.best && stats.best > 0) { const r = document.createElement('span'); r.className = 'rec'; r.textContent = '신기록'; barNode.appendChild(r); }
    await wait(0.2);
  }


  return { buildParty, render, ticker, showIntent, tallyWorthy, tally };
}
