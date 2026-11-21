import { $, $$, esc } from './dom.js';
import { tools } from './settings.js';
import { ELEMENT, GRADE } from '../engine/roster.js';
import { AFFIXES } from '../content/affixes.js';
import * as ContractRules from '../content/contracts.js';
import { heirloomSkill } from '../engine/bridge.js';
import { TERMS } from './glossary.js';
import { pixelIcon } from './pixel-icons.js';

export { replacementCount } from '../engine/awakenings.js';

export const TYPE = { phy: '물리', mag: '마법', sup: '보조', rest: '휴식' };
export const hasFinalConsonant = name => /[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0;
export function enemyActionText(beat) {
  if (!beat) return '';
  if (beat.rule === 'mana_drain') {
    return '마나 흡수' + (Number.isFinite(beat.drainFlat) ? ' · MP −' + beat.drainFlat : '');
  }
  if (beat.rule === 'retaliation') return '마법 반격 · 피격 시 ×' + beat.hitPower + ' · 미피격 시 ×' + beat.power;
  if (beat.type === 'phy' || beat.type === 'mag') {
    return TYPE[beat.type] + ' 공격' + (beat.power > 0 && beat.power !== 1 ? ' ×' + Number(beat.power.toFixed(2)) : '');
  }
  if (beat.rule === 'alternating_defense') {
    return (beat.turn % 2 ? '마법' : '물리') + ' 방어 +' + bonusPercent(beat.bonus) + '%';
  }
  if (beat.rule === 'defense_protocol' && beat.turn === 1) return '마법 방어 +' + bonusPercent(beat.bonus) + '%';
  return beat.name ?? '';
}
export function traitText(traitOrCard) {
  const trait = traitOrCard?.trait ?? traitOrCard;
  const desc = typeof trait === 'string' ? trait : trait?.desc ?? '';
  if (trait?.type === 'looter' || /^이 카드로 승리\s*시 추가 드로우$/.test(desc)) {
    return '전투 승리 후 생존 시 결정 +1';
  }
  return desc
    .replace(/자신 덱에 /g, '출전 파티에 ')
    .replace(/덱에 (불|물|자연|빛|어둠) (\d+)장 이상 시/g, '출전 파티에 $1 $2명 이상 시')
    .replace(/덱의 모든 카드의/g, '출전 동료 전원의')
    .replace(/덱의 지연 스킬/g, '출전 파티의 예약 스킬')
    .replace(/지연 스킬/g, '예약 스킬')
    .replace(/덱 전체/g, '출전 파티 전체')
    .replace(/덱이/g, '출전 파티가')
    .replace(/덱은/g, '출전 파티는')
    .replace(/덱을/g, '출전 파티를')
    .replace(/덱과/g, '출전 파티와')
    .replace(/덱/g, '출전 파티')
    .replace(/이 카드/g, '이 동료')
    .replace(/카드/g, '동료')
    .replace(/필드 버프의 능력치 효과/g, '필드 효과의 능력치 보너스')
    .replace(/필드\s*버프\s*수/g, '필드 효과 수')
    .replace(/필드\s*버프/g, '필드 효과')
    .replace(/일반등급/g, '노멀 등급')
    .replace(/선봉배치시/g, '선봉 배치 시')
    .replace(/선봉일시/g, '선봉 배치 시')
    .replace(/(배치|사망|있을|사용|발생)시/g, '$1 시')
    .replace(/일반공격시/g, '일반 공격 시')
    .replace(/적용중인/g, '적용 중인')
    .replace(/(부식|침묵)상태/g, '$1 상태')
    .replace(/(불|물|자연|빛|어둠)속성/g, '$1 속성')
    .replace(/수 만큼/g, '수만큼')
    .replace(/(\d+%)(확률로|증가|상승|피해)/g, '$1 $2');
}
export function skillText(body) {
  return String(body ?? '')
    .replace(/덱에 포함된/g, '출전 파티에 포함된')
    .replace(/지연 스킬/g, '예약 스킬')
    .replace(/필드\s*버프/g, '필드 효과');
}
const LEGACY_RULES = {
  rescue: '4층이나 6층에서 쓰러질 예고를 받은 동료를 후퇴시키고, 그 동료와 교대한 동료가 함께 생존하여 승리',
  heirloom: '4층이나 6층에서 유품 스킬로 적을 처치하고 승리'
};
export function activeContract(run) {
  const id = run.contract?.id;
  if (!Object.hasOwn(ContractRules.CONTRACTS, id)) return null;
  const contract = ContractRules.CONTRACTS[id];
  const legacyVersion = ContractRules.LEGACY_CONTRACT_RULE_VERSION ?? 1;
  const legacy = (run.contract.ruleVersion ?? legacyVersion) === legacyVersion;
  return { ...contract, legacy, rule: (legacy && LEGACY_RULES[id]) || contract.rule };
}

export function tempoBeatText(beat, step) {
  const action = beat.lesson ? { ...step, ...beat } : beat;
  const power = action.power ?? action.val;
  const type = TYPE[action.type];
  const desc = typeof action.effect === 'string' ? action.effect : '';
  let effect = '';
  switch (action.rule) {
    case 'mana_drain': effect = 'HP 피해 0 · 현재 MP ' + (Number.isFinite(action.drainFlat) ? '−' + action.drainFlat : '전부 소멸'); break;
    case 'retaliation': effect = '피격 시 ×' + action.hitPower + ' · 미피격 시 ×' + power; break;
    case 'front_hit': effect = '선두 공격'; break;
    case 'charge': effect = '다음 턴 강공'; break;
    case 'cleanse': effect = '자기 약화 전부 해제'; break;
    case 'defense_protocol': effect = '직전 피격 종류의 방어 +' + bonusPercent(action.bonus) + '%'; break;
    case 'alternating_defense': effect = (action.stat === 'mdef' ? '마방' : '물방') + ' +' + bonusPercent(action.bonus) + '%'; break;
    case 'lesson_guard': effect = '다음 턴 받는 피해 ' + bonusPercent(action.reduction) + '% 감소'; break;
    case 'swap_stats': effect = '명중 뒤 공·마공, 물방·마방 교환'; break;
  }
  const modifier = beat.lesson && ['phy', 'mag'].includes(action.type) && power > 0 && action.rule !== 'retaliation';
  return [beat.turn + '턴', beat.name, type && (type + (modifier ? ' ×' + power : '')), beat.lesson && (effect || desc)].filter(Boolean).join(' · ');
}
export const formatRange = range => Array.isArray(range)
  ? range[0] === range[1] ? String(range[0]) : range.join('~')
  : String(range ?? '');
export const bonusPercent = bonus => Math.round((bonus ?? 0) * 100);
export function blessingText(view) {
  if (!view) return '';
  const { expeditionBonus, battleBonus, effectiveBonus, active } = view;
  return '원정 +' + bonusPercent(expeditionBonus) + '% · 이번 +' + bonusPercent(battleBonus) +
    '% → 적용 +' + bonusPercent(effectiveBonus) + '% · ' + (active ? '출전 중' : '대기 중');
}

export function heirloomOffer(fighter) {
  const skill = fighter && heirloomSkill(fighter);
  return skill ? '<small class="heir-offer">쓰러질 때 남김 · ' + esc(skill.name) + '</small>' : '';
}

export function departureLoss(run, id) {
  const held = run.heirlooms?.[id];
  return [
    '원정 축복 +' + bonusPercent(run.blessings?.[id]) + '%',
    held && '보유 유품 ' + (held.name ?? held.skill?.name ?? '') + ' 소실',
    '이번 원정 재합류 불가'
  ].filter(Boolean).join(' · ');
}
export const DOOR = {
  wild: ['전투', '일반 몽마 출현'], elite: ['정예', '변이 2종을 지닌 강적'], gate: ['문지기', '그림자 연전 · 승리 시 1명 합류'],
  boss: ['보스', '꿈의 주인'], spring: ['소환의 샘', '꿈의 결정으로 동료 소환'], altar: ['혼돈의 제단', '무작위 동료 축복 · 최대 3회']
};
export const foeFlip = def => (def.facing || 'right') === 'right';

export function chooseReplacements(run, ui, count, action, { incoming = [], label } = {}) {
  const selected = new Set();
  const names = ids => ids.map(id => ui.widgets.card(id)?.name || id).join(' · ');
  ui.sheets.openSheet('보낼 동료 ' + count + '명', (incoming.length ? '<div class="cards">' +
    incoming.map(id => ui.widgets.cardRow(run, id, { skills: false, offer: true, tag: '합류' })).join('') + '</div>' : '') +
    '<div class="reserve-cards">' +
    run.bench.map(id => '<button class="win" data-dismiss-id="' + esc(id) + '" aria-pressed="false">' +
      ui.widgets.faceBadge(id, undefined, 40, run) + '</button>').join('') + '</div><div class="loss release-loss" id="dismiss-loss"></div>' +
    '<button class="btn go" id="b-dismiss-confirm" disabled>교체 확정</button>');
  const confirm = $('#b-dismiss-confirm');
  for (const button of $$('#sh-body [data-dismiss-id]')) button.addEventListener('click', () => {
    const id = button.dataset.dismissId;
    if (selected.has(id)) selected.delete(id);
    else if (selected.size < count) selected.add(id);
    button.setAttribute('aria-pressed', selected.has(id));
    confirm.disabled = selected.size !== count;
    $('#dismiss-loss').innerHTML = [...selected].map(id => '<p>' + esc(names([id]) + ' · ' + departureLoss(run, id)) + '</p>').join('');
    confirm.textContent = selected.size !== count ? '교체 확정' : label?.([...selected]) ??
      (incoming.length ? names([...selected]) + ' 보내고 ' + names(incoming) + ' 합류' : '교체 확정');
    ui.audio.sfx.tap();
  });
  confirm.addEventListener('click', () => {
    const ids = [...selected];
    ui.sheets.closeSheet();
    action(ids);
  }, { once: true });
}

export const riftKindLabel = kind => kind === 'practice' ? '연습' : '기록 도전';

export const logButton = attrs => '<button type="button" class="log-button" ' + attrs + '>' + pixelIcon('book', 16) + '기록</button>';
export const head = (run, title, sub, { back = false } = {}) => '<header class="top">' +
  (back ? '<button class="btn order-back" id="b-order-back" aria-label="지도로 돌아가기">←</button>' : '') + '<b>' + esc(title) + '</b>' +
  (sub ? '<span>' + esc(sub) + '</span>' : '') + '<span class="sp"></span><span class="gems">' +
  (run?.daily ? riftKindLabel(run.daily.kind) : '◆ ' + (run ? run.crystals : 0)) + '</span>' +
  (run?.lastBattleLog?.length ? logButton('data-battle-log') : '') + tools() + '</header>';
export const repeatBadge = (run, id) => run?.repeatStacks?.[id] > 0
  ? '<i class="repeat-stack" title="' + TERMS.boost.short + '">★' + run.repeatStacks[id] + '</i>' : '';
export function badges(run, id) {
  const out = [];
  if (run && run.blessings[id]) out.push('<i class="bless">축복 +' + Math.round(run.blessings[id] * 100) + '%</i>');
  if (run && run.heirlooms[id]) out.push('<i class="heir">' + TERMS.heirloom.short + ' ' + esc(run.heirlooms[id].name) + '</i>');
  return out.join('');
}

export const affixChips = def => (def.affixes || []).map(a => '<i class="affix">' + esc(AFFIXES[a].name) + '</i>').join('');

/** rows: [label, now, base, unit]. The base shows struck through when the value moved. */
export function statGrid(rows) {
  return '<div class="sg">' + rows.map(r => {
    const d = r[1] > r[2] ? 'up' : r[1] < r[2] ? 'down' : '';
    return '<span><em>' + r[0] + '</em><b class="' + d + '">' + r[1] + (r[3] || '') + '</b>' + (d ? '<small>' + r[2] + (r[3] || '') + '</small>' : '') + '</span>';
  }).join('') + '</div>';
}

export function createWidgets(ASSETS, card) {
  const spr = (id, pose) => ASSETS.sp[id + '-' + (pose || 'idle')] || ASSETS.sp[id + '-idle'];
  function sprite(id, o) {
    const m = spr(id, o && o.pose); if (!m) return '';
    const cls = ['px'].concat(o && o.cls ? [o.cls] : []).join(' ');
    const style = (o && o.flip ? 'transform:scaleX(-1);' : '') + (o && o.style ? o.style : '');
    return '<img class="' + cls + '" alt="" src="' + m.src + '" width="' + m.w + '" height="' + m.h + '"' + (style ? ' style="' + style + '"' : '') + '>';
  }
  function face(id, box) {
    const m = spr(id);
    if (!m) return '';
    const style = m.face
      ? 'display:block;margin-left:calc(50% - ' + m.face.x + 'px);margin-top:' + (-m.face.y) + 'px'
      : 'margin-left:' + Math.round((box || 40) / 2 - m.cx) + 'px;margin-top:-2px';
    return sprite(id, { style });
  }

  function cardRow(run, id, o) {
    const c = card(id), opt = o || {};
    return '<button class="cardrow win g-' + c.grade + (opt.cls ? ' ' + opt.cls : '') + '" data-id="' + id + '"' +
      (opt.sheet ? ' data-sheet="' + id + '"' : '') + (opt.slotId ? ' data-slot-id="' + esc(opt.slotId) + '"' : '') +
      (opt.coach ? ' data-coach="' + esc(opt.coach) + '"' : '') + '><span class="pic">' + sprite(id) + '</span><span class="txt">' +
      '<div class="nm">' + esc(c.name) + repeatBadge(run, id) + '<i class="grade">' + (GRADE[c.grade] || c.grade) + '</i><i class="el-' + c.element + '">' + ELEMENT[c.element] + '</i>' + (opt.tag ? '<i class="tag">' + esc(opt.tag) + '</i>' : '') + '</div>' +
      '<div class="st">HP ' + c.stats.hp + ' · 공 ' + c.stats.atk + ' · 마공 ' + c.stats.matk + ' · 방 ' + c.stats.def + '/' + c.stats.mdef + '</div>' +
      '<div class="trait">' + esc(traitText(c.trait)) + '</div>' + (opt.offer ? heirloomOffer(c) : '') +
      (opt.detail ? '<small class="card-detail">' + esc(opt.detail) + '</small>' : '') +
      (opt.skills !== false ? '<div class="sk">' + c.skills.map(s => esc(s.name) + '<small>' + TYPE[s.type] + (s.cost ? ' ' + s.cost : '') + '</small>').join(' · ') + '</div>' : '') +
      '<div class="badges">' + badges(run, id) + '</div></span></button>';
  }
  const benchMinis = run => run.bench.map(id => '<button class="mini g-' + card(id).grade + '" data-sheet="' + id + '" aria-label="' + esc(card(id).name) + '">' + face(id, 40) +
    repeatBadge(run, id) + (run.heirlooms[id] ? '<i class="h">유</i>' : '') + (run.blessings[id] ? '<i class="b">축</i>' : '') + '</button>').join('');

  function cardHead(id, sub) {
    const c = card(id);
    const art = sprite(id) || (c.baseCardId ? sprite(c.baseCardId) : '');
    return '<div class="ih g-' + c.grade + '"><span class="pic">' + art + '</span><div><b>' + esc(c.name) + '</b><i class="grade">' + (GRADE[c.grade] || c.grade) + '</i><i class="el-' + c.element + '">' + ELEMENT[c.element] + '</i>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>';
  }

  function faceBadge(id, name = card(id)?.name, size = 40, run) {
    return '<span class="face-badge"><span class="run-face">' + face(id, size) + repeatBadge(run, id) + '</span><b>' + esc(name || id) + '</b></span>';
  }

  return { card, spr, sprite, face, faceBadge, cardRow, benchMinis, cardHead };
}
