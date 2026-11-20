import { $, esc } from '../dom.js';
import { TYPE, foeFlip, statGrid } from '../widgets.js';
import { ELEMENT, POSITION } from '../../engine/roster.js';
import { AFFIXES } from '../../content/affixes.js';
import { QUIRKS } from '../../content/quirks.js';
import { REGIONS } from '../../content/regions.js';
import { RELIC_LIMIT } from '../../engine/rooms.js';
import { HEIRLOOM_POWER, heirloomSkill } from '../../engine/bridge.js';
import { FIELD, GOOD } from './hud.js';

/* What each status and field blessing does. Numbers follow the card rules
   (logic.js GAME_CONSTANTS.DEBUFF_REDUCTIONS, FIELD_BUFF_STATS, calculateStats; battle_runtime defProtocol). */
const STATUS_INFO = {
  weak: '공격력 -20%', silence: '마법공격력 -20%', curse: '마법방어력 -20%', temptation: '마법방어력 -20%',
  darkness: '방어력 -20% · 부식과 함께면 -40%', corrosion: '방어력 -20% · 암흑과 함께면 -40%',
  stun: '다음 행동을 건너뛴다', evasion: '회피율 +50%p', barrier: '물리 공격 한 번을 무효로 한다', magic_guard: '마법 공격 한 번을 무효로 한다',
  guard: '받는 피해 50% 감소', damage_half: '받는 피해 50% 감소',
  defProtocolPhy: '방어력 +50% (방어 프로토콜)', defProtocolMag: '마법방어력 +50% (방어 프로토콜)'
};
const FIELD_INFO = {
  sun_bless: '공격력·마법공격력 +30%, 치명타 피해 +60%', moon_bless: '마법공격력 +30%, 회피율 +15%', sanctuary: '마법공격력·마법방어력 +30%',
  goddess_descent: '공격력·마법공격력·방어력·마법방어력 +30%', destiny_oath: '공격력·마법공격력·방어력·마법방어력 +30%', earth_bless: '공격력·마법공격력 +25%',
  twinkle_party: '공격력 +20%, 치명타율 +15%', star_powder: '방어력·마법방어력 +40%', valentine: '방어력·마법방어력 +50%',
  arena: '일반 공격 위력 2배', gale: '치명타율 +20%, 회피율 +20%', reaper_realm: '치명타율 +40%, 치명타 피해 +40%'
};

export function createDetails(core, widgets, openSheet) {
  const { card, sprite, cardHead } = widgets;

  function skillBlock(s, entity, note) {
    let text = '';
    try { text = core.SkillDisplay.body(s, { entity }); } catch (e) { text = ''; }
    return '<div class="skl ' + s.type + '"><b>' + esc(s.name) + '</b><small>' + (TYPE[s.type] || '') + ' · MP ' + (s.cost || 0) + (note ? ' · ' + esc(note) : '') + '</small>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div>';
  }
  function heirBlock(skill, fromName, entity) {
    if (!skill) return '';
    return '<h4>유품</h4><div class="heirbox"><p>' + esc(fromName) + '에게서 물려받은 기술. 위력 ' + HEIRLOOM_POWER + '배 · MP 0 · 전투마다 한 번. 이 동료가 쓰러지면 사라진다.</p>' + skillBlock(skill, entity) + '</div>';
  }

  function statusList(buffs, extra, artifacts) {
    const stack = core.GAME_CONSTANTS.STACK_CAP;
    const items = Object.keys(buffs || {}).filter(id => buffs[id]).map(id => {
      const v = buffs[id], good = GOOD.includes(id) || /^defProtocol/.test(id);
      const relic = stack.ARTIFACT_MAP[id];
      const amount = relic ? ' ' + v + '스택' : (id === 'guard' || id === 'damage_half') ? ' ' + v + '턴' : '';
      const cap = artifacts?.includes(relic) ? stack.ENHANCED : stack.DEFAULT;
      const info = relic ? '쌓이는 표식(최대 ' + cap + '). 이를 읽거나 소모하는 기술·특성이 있다' : STATUS_INFO[id];
      return '<li><i class="' + (good ? 'good' : 'bad') + '">' + esc((core.BUFF_NAMES[id] || id) + amount) + '</i>' + esc(info || '') + '</li>';
    }).concat(extra || []);
    return items.length ? '<ul class="stl">' + items.join('') + '</ul>' : '<p class="none">없음</p>';
  }
  const blessLine = (run, id) => '<li><i class="good">축복 +' + Math.round(run.blessings[id] * 100) + '%</i>모든 능력치, 치명타율 +' + core.GAME_CONSTANTS.BLESSING_CRIT + '%p · 회피율 +' + core.GAME_CONSTANTS.BLESSING_EVA + '%p</li>';
  /** A companion outside battle (map, spring, start): card numbers, trait, heirloom, every skill in full. */
  function charSheet(run, id) {
    const c = card(id); if (!c) return;
    const s = c.stats, h = run && run.heirlooms[id], from = h && (card(h.form || h.from) || card(h.from));
    let html = cardHead(id, ROLE_OF(c)) + statGrid([['체력', s.hp, s.hp], ['공격', s.atk, s.atk], ['마공', s.matk, s.matk], ['방어', s.def, s.def], ['마방', s.mdef, s.mdef]]);
    if (run && run.blessings[id]) html += '<ul class="stl">' + blessLine(run, id) + '</ul>';
    const heir = from ? heirBlock(h.skill ?? heirloomSkill(from), from.name, from) : '';
    html += '<h4>특성</h4><p>' + esc(c.trait.desc) + '</p>' + heir + '<h4>기술</h4>' + c.skills.map(sk => skillBlock(sk, c)).join('');
    openSheet('동료', html);
  }
  function ROLE_OF(c) { const r = core.DISPLAY_NAMES && core.DISPLAY_NAMES.role && core.DISPLAY_NAMES.role[c.role]; return r || ''; }
  /** The unit as the screen shows it now, with the core's own stat formula (statuses, field, blessing, traits). */
  function liveStats(B, ref) {
    const host = B.bridge && B.bridge.host, b = host && host.battle; if (!b || !b.players) return null;
    const shown = ref.side === 'enemy' ? B.D.enemy : B.D.allies[ref.idx]; if (!shown) return null;
    const u = ref.side === 'enemy' ? (B.bridge.enemyIndex === shown.idx ? b.enemy : null) : b.players[ref.idx];
    if (!u) return null;
    const view = Object.assign({}, u, { buffs: Object.assign({}, shown.buffs) });
    const field = (b.fieldBuffs || []).filter(f => B.D.field.includes(f.name));
    return { u, s: core.Logic.calculateStats(view, field, host.state.mode, host.state.artifacts, B.D.turn || b.turn || 1) };
  }
  function allySheet(run, B, i) {
    const id = B.party[i], shown = B.D && B.D.allies[i]; if (!id || !shown) return;
    const live = liveStats(B, { side: 'ally', idx: i });
    const c = live?.u.proto || card(shown.form || id) || card(id);
    const init = core.Logic.calculateInitialStats(c, B.party, core.GameUtils.getAllCards(), i);
    const base = Object.assign({}, c.stats, init && init.stats);
    const where = shown.dead ? '쓰러짐' : shown.out ? '물러남' : i === B.D.cur ? '싸우는 중' : '뒤에서 대기';
    let html = cardHead(c.id, POSITION[i] + ' · ' + where + ' · HP ' + shown.hp + '/' + shown.maxHp + ' · MP ' + shown.mp + '/' + shown.maxMp);
    if (live) {
      const s = live.s, critBase = Number.isFinite(base.baseCrit) ? base.baseCrit : core.GAME_CONSTANTS.BASE_CRIT, evaBase = (base.baseEva || 0) + core.GAME_CONSTANTS.BASE_EVA_BONUS;
      const rows = [['공격', s.atk, base.atk], ['마공', s.matk, base.matk], ['방어', s.def, base.def], ['마방', s.mdef, base.mdef], ['치명', s.crit, critBase, '%'], ['회피', s.evasion, evaBase, '%']];
      html += statGrid(rows);
      if (rows.some(r => r[1] !== r[2])) html += '<p class="sm">줄 그은 숫자는 전투 시작 때 값. 축복·하늘·상태·최후의 일인이 지금 수치에 들어 있다.</p>';
    }
    const extra = [];
    if (shown.lastStand) extra.push('<li><i class="bad">최후의 일인</i>공격력·마법공격력 ×1.5, 치명타율 +25%p</li>');
    if (run.blessings[id]) extra.push(blessLine(run, id));
    html += '<h4>상태</h4>' + statusList(shown.buffs, extra, B.artifacts);
    const traitNote = /^syn_/.test(c.trait.type) ? (init && init.activeTrait ? ' (발동 중)' : ' (조건 부족)') : c.trait.type === 'pos_stat_boost' ? (c.trait.pos === i ? ' (자리 효과 발동)' : ' (' + POSITION[c.trait.pos] + ' 전용)') : '';
    const skills = live?.u.skills || c.skills;
    const heir = skills.find(sk => sk.heirloom);
    html += '<h4>특성</h4><p>' + esc(c.trait.desc + traitNote) + '</p>' + (heir ? heirBlock(heir, heir.heirFromName, live.u) : '') + '<h4>기술</h4>' +
      skills.filter(sk => !sk.heirloom).map(sk => skillBlock(sk, c)).join('');
    openSheet('동료 · 지금', html);
  }
  function foeSheet(B) {
    const shown = B.D && B.D.enemy; if (!shown) return;
    const def = B.door.enemies[shown.idx], live = liveStats(B, { side: 'enemy', idx: shown.idx }), many = B.door.enemies.length > 1;
    let html = '<div class="ih foe"><span class="pic">' + sprite(def.sprite, { flip: foeFlip(def), cls: def.look === 'boss' ? 'boss-tint' : def.look === 'shadow' ? 'shadow-tint' : '' }) + '</span><div><b>' + esc(shown.name) + '</b><i class="grade">' + esc(def.kind || '') + '</i><i class="el-' + def.element + '">' + (ELEMENT[def.element] || '') + '</i>' +
      '<small>HP ' + shown.hp.toLocaleString('en-US') + ' / ' + shown.maxHp.toLocaleString('en-US') + (many ? ' · ' + (shown.idx + 1) + '/' + B.door.enemies.length + '번째' : '') + '</small></div></div>';
    if (live) {
      const host = B.bridge.host, raw = core.Logic.calculateStats(Object.assign({}, live.u, { buffs: {} }), [], host.state.mode, [], B.D.turn || 1), s = live.s;
      html += statGrid([['공격', s.atk, raw.atk], ['마공', s.matk, raw.matk], ['방어', s.def, raw.def], ['마방', s.mdef, raw.mdef]]);
    }
    const strong = Object.keys(ELEMENT).filter(el => core.Logic.getElementalMultiplier(el, def.element) > 1);
    if (strong.length) html += '<p class="sm">상성: ' + strong.map(el => ELEMENT[el]).join('·') + ' 속성 동료가 치면 피해 ×' + core.Logic.getElementalMultiplier(strong[0], def.element) + '</p>';
    const extra = [];
    if (shown.charging) extra.push('<li><i class="bad">차징</i>힘을 모으는 중. 다음 행동이 크다</li>');
    for (const a of shown.affixes || []) extra.push('<li><i class="affix">' + esc(AFFIXES[a].name) + (a === 'frenzy' && shown.frenzied ? ' 발동' : '') + '</i>' + esc(AFFIXES[a].desc) + '</li>');
    html += '<h4>상태 · 접두사</h4>' + statusList(shown.buffs, extra, B.artifacts);
    const cd = $('#pf-cd'), lines = [];
    if (B.intent) lines.push(B.intent.kind === 'stun' ? '이번 턴은 기절해서 못 움직인다.' : '다음 행동: ' + B.intent.name + (B.intent.dmg ? ' · ' + TYPE[B.intent.kind] + ' ' + (B.intent.dmg[0] === B.intent.dmg[1] ? B.intent.dmg[0] : B.intent.dmg[0] + '~' + B.intent.dmg[1]) : ''));
    if (cd.classList.contains('on')) lines.push(cd.textContent);
    if (def.note) lines.push(def.note);
    if (lines.length) html += '<h4>행동</h4>' + lines.map(t => '<p>' + esc(t) + '</p>').join('');
    if (many) html += '<p class="sm">이 문: ' + B.door.enemies.map((d, k) => (k === shown.idx ? '▶ ' : '') + d.name).map(esc).join(' → ') + '</p>';
    const skills = (live && live.u.skills) || [];
    if (skills.length) html += '<h4>기술</h4>' + skills.map(sk => { let t = ''; try { t = core.SkillDisplay.body(sk, { entity: live.u, enemy: true }); } catch (e) { t = ''; } return '<div class="skl ' + sk.type + '"><b>' + esc(sk.name) + '</b><small>' + (TYPE[sk.type] || '') + '</small>' + (t ? '<p>' + esc(t) + '</p>' : '') + '</div>'; }).join('');
    openSheet('적 · 지금', html);
  }
  function fieldSheet(B) {
    const list = B.D?.field || [];
    const max = B.artifacts?.includes('buff_overload') ? 5 : (core.GAME_CONSTANTS.MAX_FIELD_BUFFS || 3);
    const html = (list.length ? '<ul class="stl">' + list.map(id => '<li><i class="good" style="background:' + (FIELD[id] || [0, '#33295c'])[1] + ';color:#120e24">' + esc(core.BUFF_NAMES[id] || id) + '</i>' + esc(FIELD_INFO[id] || '') + '</li>').join('') + '</ul>' : '<p class="none">지금 하늘에 걸린 필드 버프가 없다.</p>') +
      '<p class="sm">필드 버프는 아군에게만 적용된다. 최대 ' + max + '개, 넘치면 가장 먼저 건 것이 사라진다.</p>';
    openSheet('하늘 · 필드 버프', html);
  }

  function battlefieldSheet(B) {
    if (!B.door) return;
    const region = REGIONS[B.door.region?.id], quirk = QUIRKS[B.door.quirk];
    const block = entry => entry ? '<h4>' + esc(entry.name) + '</h4><p>' + esc(entry.desc) + '</p>' : '';
    const slots = Array.from({ length: RELIC_LIMIT }, (_, index) => {
      const id = B.artifacts[index];
      const relic = core.ARTIFACT_LIST.find(item => item.id === id);
      if (!relic) return '<li>빈 칸</li>';
      return '<li><b>' + esc(relic.name) + '</b>' +
        (id === B.temporaryRelic ? ' · 이번 전투만' : '') + ' · ' + esc(relic.desc) + '</li>';
    });
    openSheet('전장·유물', (block(region) || '<p>지역 규칙 없음</p>') + block(quirk) +
      '<h4>장착 유물</h4><ul class="stl">' + slots.join('') + '</ul>');
  }

  return { charSheet, allySheet, foeSheet, fieldSheet, battlefieldSheet };
}
