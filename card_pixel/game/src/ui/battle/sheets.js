import { $, esc } from '../dom.js';
import { activeContract, blessingDetail, TYPE, foeFlip, formatMultiplier, riftKindLabel, skillText, statGrid, traitText } from '../widgets.js';
import { bindRelicSlots, openRelicSheet, relicEffect, relicStrip } from '../relics.js';
import { shortRiftDate } from '../screens/daily-rift.js';
import { ELEMENT, POSITION } from '../../engine/roster.js';
import { QUIRKS } from '../../content/quirks.js';
import { REGIONS } from '../../content/regions.js';
import { HEIRLOOM_POWER, heirloomSkill } from '../../engine/bridge.js';
import { affixLines, FIELD, GOOD, fieldCap, intentLines, skyRelics } from './hud.js';
import * as Run from '../../engine/run.js';
import { fieldInfo } from './fields.js';

/* What each status and field blessing does. Numbers follow the card rules
   (logic.js GAME_CONSTANTS.DEBUFF_REDUCTIONS, FIELD_BUFF_STATS, calculateStats; battle_runtime defProtocol). */
const STATUS_INFO = {
  weak: '공격력 -20%', silence: '마법공격력 -20%', curse: '마법방어력 -20%', temptation: '마법방어력 -20%',
  darkness: '방어력 -20% (부식 중첩 시 -40%)', corrosion: '방어력 -20% (암흑 중첩 시 -40%)',
  stun: '다음 행동 1회 불가', evasion: '회피율 +50%', barrier: '물리 공격 1회 무효', magic_guard: '마법 공격 1회 무효',
  guard: '받는 피해 50% 감소', damage_half: '받는 피해 50% 감소',
  defProtocolPhy: '방어력 +50% (방어 프로토콜)', defProtocolMag: '마법방어력 +50% (방어 프로토콜)'
};
function contractStatus(run, B, contract) {
  const { id, met, failed, riskDoorTaken } = run.contract;
  if (met) return '달성';
  const fighters = B.party.filter(Boolean).length;
  const missedRisk = id === 'elite' && run.floor >= 2 && !riskDoorTaken;
  const missedElite = id === 'elite' && run.floor === 6 && (B.door.type !== 'elite' || fighters < 2);
  const missedHeirloom = id === 'heirloom' && !contract.legacy && run.floor > 4;
  if (failed || run.floor > 6 || missedRisk || missedElite || missedHeirloom || (id === 'rescue' && run.floor === 6 && fighters < 2)) return '이번 원정 불가';
  return '진행 중';
}

export function createDetails(core, widgets, openSheet) {
  const { card, sprite, cardHead } = widgets;

  function skillBlock(s, entity, note) {
    let text = '';
    try { text = skillText(core.SkillDisplay.body(s, { entity })); } catch (e) { text = ''; }
    return '<div class="skl ' + s.type + '"><b>' + esc(s.name) + '</b><small>' + (TYPE[s.type] || '') + ' · MP ' + (s.cost || 0) + (note ? ' · ' + esc(note) : '') + '</small>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div>';
  }
  function heirBlock(skill, fromName, entity) {
    if (!skill) return '';
    return '<h4>유품</h4><div class="heirbox"><p>' + esc(fromName) + '에게서 계승한 스킬 · 위력 ' + HEIRLOOM_POWER + '배 · MP 0 · 전투당 1회 (쓰러지면 소멸)</p>' + skillBlock(skill, entity) + '</div>';
  }

  function statusList(buffs, extra, artifacts, protocolBonus) {
    const stack = core.GAME_CONSTANTS.STACK_CAP;
    const items = Object.keys(buffs || {}).filter(id => buffs[id]).map(id => {
      const v = buffs[id], good = GOOD.includes(id) || /^defProtocol/.test(id);
      const relic = stack.ARTIFACT_MAP[id];
      const amount = relic ? ' ' + v + '스택' : (id === 'guard' || id === 'damage_half') ? ' ' + v + '턴' : '';
      const cap = artifacts?.includes(relic) ? stack.ENHANCED : stack.DEFAULT;
      let info = relic ? '누적 표식 (최대 ' + cap + '스택) · 스택에 비례해 강화되거나 소모하는 스킬·특성과 연계' : STATUS_INFO[id];
      if (id === 'defProtocolPhy' || id === 'defProtocolMag') {
        const pct = Math.round((protocolBonus ?? 0.5) * 100);
        info = (id === 'defProtocolPhy' ? '방어력 +' : '마법방어력 +') + pct + '% (방어 프로토콜)';
      }
      return '<li><i class="' + (good ? 'good' : 'bad') + '">' + esc((core.BUFF_NAMES[id] || id) + amount) + '</i>' + esc(info || '') + '</li>';
    }).concat(extra || []);
    return items.length ? '<ul class="stl">' + items.join('') + '</ul>' : '<p class="none">없음</p>';
  }
  const blessLine = (run, id) => '<li><i class="good">축복 +' + Math.round(run.blessings[id] * 100) + '%</i>모든 능력치 상승 · 치명타율 +' + core.GAME_CONSTANTS.BLESSING_CRIT + '% · 회피율 +' + core.GAME_CONSTANTS.BLESSING_EVA + '%</li>';
  /** A companion outside battle (map, spring, start): card numbers, trait, heirloom, every skill in full. */
  function charSheet(run, id, { loaned = false, onClose, blessing } = {}) {
    const c = card(id); if (!c) return;
    const s = c.stats, h = run && run.heirlooms[id], from = h && (card(h.form || h.from) || card(h.from));
    const actual = blessing?.stats ?? s;
    let html = cardHead(id, ROLE_OF(c)) + statGrid([['체력', actual.maxHp ?? actual.hp ?? s.hp, s.hp],
      ['공격', actual.atk ?? s.atk, s.atk], ['마공', actual.matk ?? s.matk, s.matk],
      ['방어', actual.def ?? s.def, s.def], ['마방', actual.mdef ?? s.mdef, s.mdef]]);
    if (blessing) html += '<p class="seat-blessing">' + esc(blessingDetail(blessing)) + '</p>';
    else if (run?.blessings[id]) html += '<ul class="stl">' + blessLine(run, id) + '</ul>';
    const heir = from ? heirBlock(h.skill ?? heirloomSkill(from), from.name, from) : '';
    html += '<h4>특성</h4><p>' + esc(traitText(c.trait)) + '</p>' + heir + '<h4>스킬</h4>' + c.skills.map(sk => skillBlock(sk, c)).join('');
    const offered = loaned ? heirloomSkill(c) : null;
    if (offered) {
      html += '<h4>넘길 유품</h4><div class="heirbox"><p>위력 ×' + HEIRLOOM_POWER +
        ' · MP 0 · 전투당 1회</p>' + skillBlock({ ...offered, cost: 0 }, c) + '</div>';
    }
    openSheet(loaned ? c.name : '동료 정보', html, { onClose });
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
    const where = shown.dead ? '쓰러짐' : shown.out ? '후퇴' : i === B.D.cur ? '출전 중' : '대기 중';
    let html = cardHead(c.id, POSITION[i] + ' · ' + where + ' · HP ' + shown.hp + '/' + shown.maxHp + ' · MP ' + shown.mp + '/' + shown.maxMp);
    if (live) {
      const s = live.s, critBase = Number.isFinite(base.baseCrit) ? base.baseCrit : core.GAME_CONSTANTS.BASE_CRIT, evaBase = (base.baseEva || 0) + core.GAME_CONSTANTS.BASE_EVA_BONUS;
      const rows = [['공격', s.atk, base.atk], ['마공', s.matk, base.matk], ['방어', s.def, base.def], ['마방', s.mdef, base.mdef], ['치명', s.crit, critBase, '%'], ['회피', s.evasion, evaBase, '%']];
      html += statGrid(rows);
      if (rows.some(r => r[1] !== r[2])) html += '<p class="sm">취소선 수치는 전투 시작 시 기본값입니다. (축복·필드·상태·최후의 일인 반영)</p>';
    }
    const extra = [];
    if (shown.lastStand) extra.push('<li><i class="bad">최후의 일인</i>공격력·마법공격력 ×1.5, 치명타율 +25%p</li>');
    if (!B.blessingViews?.has(id)) {
      B.blessingViews?.set(id, Run.getBlessingView?.(run, B.door.index, B.party, id));
    }
    const blessing = B.blessingViews?.get(id);
    if (blessing) extra.push('<li class="seat-blessing">' + esc(blessingDetail(blessing)) + '</li>');
    else if (run.blessings[id]) extra.push(blessLine(run, id));
    html += '<h4>상태</h4>' + statusList(shown.buffs, extra, B.artifacts);
    const traitNote = /^syn_/.test(c.trait.type) ? (init && init.activeTrait ? ' (발동 중)' : ' (미발동)') : c.trait.type === 'pos_stat_boost' ? (c.trait.pos === i ? ' (배치 효과 발동)' : ' (' + POSITION[c.trait.pos] + ' 전용)') : '';
    const skills = live?.u.skills || c.skills;
    const heir = skills.find(sk => sk.heirloom);
    html += '<h4>특성</h4><p>' + esc(traitText(c.trait) + traitNote) + '</p>' + (heir ? heirBlock(heir, heir.heirFromName, live.u) : '') + '<h4>스킬</h4>' +
      skills.filter(sk => !sk.heirloom).map(sk => skillBlock(sk, c)).join('');
    openSheet('동료 전투 정보', html);
  }
  function foeSheet(B) {
    const shown = B.D && B.D.enemy; if (!shown) return;
    const def = B.door.enemies[shown.idx], live = liveStats(B, { side: 'enemy', idx: shown.idx }), many = B.door.enemies.length > 1;
    let html = '<div class="ih foe"><span class="pic">' + sprite(def.sprite, { flip: foeFlip(def), cls: def.look === 'boss' ? 'boss-tint' : def.look === 'shadow' ? 'shadow-tint' : '' }) + '</span><div><b>' + esc(shown.name) + '</b><i class="grade">' + esc(def.kind || '') + '</i><i class="el-' + def.element + '">' + (ELEMENT[def.element] || '') + '</i>' +
      '<small>HP ' + shown.hp.toLocaleString('en-US') + ' / ' + shown.maxHp.toLocaleString('en-US') + (many ? ' · 웨이브 ' + (shown.idx + 1) + '/' + B.door.enemies.length : '') + '</small></div></div>';
    if (live) {
      const host = B.bridge.host, raw = core.Logic.calculateStats(Object.assign({}, live.u, { buffs: {} }), [], host.state.mode, [], B.D.turn || 1), s = live.s;
      html += statGrid([['공격', s.atk, raw.atk], ['마공', s.matk, raw.matk], ['방어', s.def, raw.def], ['마방', s.mdef, raw.mdef]]);
    }
    const strong = Object.keys(ELEMENT).filter(el => core.Logic.getElementalMultiplier(el, def.element) > 1);
    if (strong.length) html += '<p class="sm">약점 상성: ' + strong.map(el => ELEMENT[el]).join('·') + ' 속성 공격 시 피해 ×' +
      formatMultiplier(core.Logic.getElementalMultiplier(strong[0], def.element)) + '</p>';
    const extra = [];
    if (shown.charging) extra.push('<li><i class="bad">충전 중</i>힘을 모으는 중 · 다음 턴 강력한 공격 발동</li>');
    for (const affix of affixLines(shown)) extra.push('<li><i class="affix">' + esc(affix.name) + '</i>' + esc(affix.text) + '</li>');
    const buffs = { ...shown.buffs };
    if (shown.affixes?.includes('tough')) delete buffs.damage_half;
    const lessonBonus = live?.u?.lessonProtocol?.bonus ?? B.door.tempo?.lesson?.steps?.find(step => Number.isFinite(step?.bonus))?.bonus;
    html += '<h4>상태 · 변이</h4>' + statusList(buffs, extra, B.artifacts, lessonBonus);
    if (def.source) html += '<h4>특성</h4><p>그림자에게는 원본 동료의 특성이 적용되지 않습니다.</p>';
    const lines = intentLines(B.intent, B.countdown, B.D.allies[B.D.cur]?.hp, core.BUFF_NAMES).filter(Boolean);
    if (def.note) lines.push(def.note);
    if (lines.length) html += '<h4>행동 예고</h4>' + lines.map(t => '<p>' + esc(t) + '</p>').join('');
    if (many) html += '<p class="sm">출현 순서: ' + B.door.enemies.map((d, k) => (k === shown.idx ? '▶ ' : '') + d.name).map(esc).join(' → ') + '</p>';
    const skills = (live && live.u.skills) || [];
    if (skills.length) html += '<h4>스킬</h4>' + skills.map(sk => { let t = ''; try { t = skillText(core.SkillDisplay.body(sk, { entity: live.u, enemy: true })); } catch (e) { t = ''; } return '<div class="skl ' + sk.type + '"><b>' + esc(sk.name) + '</b><small>' + (TYPE[sk.type] || '') + '</small>' + (t ? '<p>' + esc(t) + '</p>' : '') + '</div>'; }).join('');
    openSheet('적 전투 정보', html);
  }
  function fieldSheet(B) {
    const list = B.D?.field || [];
    const max = fieldCap(core, B.artifacts);
    const relics = skyRelics(B).map(id => {
      const relic = core.GameUtils.getArtifactById(id);
      return '<p><b>' + esc(relic.name) + '</b> · ' + esc(relicEffect(relic)) + '</p>';
    }).join('');
    const html = (list.length ? '<ul class="stl">' + list.map(id => '<li><i class="good" style="background:' + (FIELD[id] || [0, '#33295c'])[1] + ';color:#120e24">' + esc(core.BUFF_NAMES[id] || id) + '</i>' + esc(fieldInfo(core, id, B.artifacts)) + '</li>').join('') + '</ul>' : '<p class="none">적용 중인 필드 효과가 없습니다.</p>') +
      '<p class="sm">필드 효과는 아군에게만 적용됩니다. 최대 ' + max + '개까지 유지되며, 초과 시 가장 먼저 걸린 효과부터 사라집니다.</p>' + relics;
    openSheet('필드 효과', html);
  }

  function battlefieldSheet(run, B, focusSlot) {
    if (!B.door) return;
    const region = REGIONS[B.door.region?.id], quirk = QUIRKS[B.door.quirk];
    const contract = activeContract(run);
    const block = entry => entry ? '<h4>' + esc(entry.name) + '</h4><p>' + esc(entry.desc) + '</p>' : '';
    const artifacts = B.artifacts || [];
    const focusField = () => $('#b-field')?.focus({ preventScroll: true });
    const dailyLine = run.daily ? [shortRiftDate(run.daily.spec?.dayKey), riftKindLabel(run.daily.kind),
      '정산한 전투 ' + (run.stats?.turns ?? 0) + '턴'].filter(Boolean).join(' · ') : '';
    openSheet('전장·유물', (run.features?.relics === false ? '' : relicStrip(core, artifacts, { temporary: B.temporaryRelic })) +
      (dailyLine ? '<p>' + esc(dailyLine) + '</p>' : '') +
      (run.features?.regionRules === false ? '' : block(region) || '<p>지역 규칙 없음</p>') +
      (run.features?.quirks === false ? '' : block(quirk)) +
      (contract ? '<h4>계약 · ' + esc(contract.name) + ' · ' + contractStatus(run, B, contract) +
        '</h4><p>' + esc(contract.rule) + '</p>' : ''), {
      latest: focusSlot != null ? `[data-slot="${focusSlot}"]` : undefined, onClose: focusField
    });
    bindRelicSlots($('#sh-body'), artifacts, (id, button) => {
      openRelicSheet(openSheet, core.GameUtils.getArtifactById(id), {
        temporary: id != null && id === B.temporaryRelic,
        back: () => battlefieldSheet(run, B, button.dataset.slot), onClose: focusField
      });
    });
  }

  return { charSheet, allySheet, foeSheet, fieldSheet, battlefieldSheet };
}
