import { $, $$, esc } from './dom.js';
import { icon } from './assets.js';
import { RELIC_LIMIT } from '../engine/rooms.js';

const EFFECTS = {
  reverse: '자연 속성 동료가 쓰러질 때 필드 효과 ‘대지의축복’ 발동',
  companion: '쓰러질 때 발동하는 특성과 유물의 피해 2배',
  double_attack: '일반 공격 위력 2배',
  over_flame: '작열 부여 시 중첩량 2배 (최대 5스택)',
  over_divine: '디바인 부여 시 중첩량 2배 (최대 5스택)',
  flame_piercing: '물리 공격 시 적의 작열 1스택당 방어력 관통 +10%',
  frozen_body: '물 속성 동료가 쓰러질 때 적에게 기절 부여',
  ice_break: '기절 상태인 적에게 주는 공격 피해 2배',
  support_boost: '보조 스킬의 MP 소모 0',
  lucky_vicky: '치명타 적중 또는 회피 성공 시 MP 10 회복',
  big_bang: '전설·초월 동료가 쓰러질 때 적에게 위력 3배 물리 피해',
  death_roulette: '공격 피해 2배 · 일반 공격 외 스킬 발동 시 30% 확률로 시전자 전투 불능',
  gale_storm: '전투 시작 후 3턴 동안 필드 효과 ‘질풍’ 발동 (치명타율·회피율 +20%)',
  buff_overload: '필드 효과 최대 유지 개수 5개로 증가'
};

export const relicEffect = relic => EFFECTS[relic.id] ?? relic.desc;

export function relicIcon(id, size, label = '') {
  const src = icon(id);
  return src ? `<img class="px relic-icon" width="${size}" height="${size}" src="${esc(src)}" alt="${esc(label)}">` : '';
}

export function relicStrip(core, ids, { replaceable = [], equipped, temporary } = {}) {
  const slots = Array.from({ length: RELIC_LIMIT }, (_, index) => {
    const id = ids[index];
    const relic = core.GameUtils.getArtifactById(id);
    const label = `${index + 1}번 칸 · ${relic?.name ?? '빈 칸'}` + (id && id === temporary ? ' · 이번 전투만' : '');
    const replace = replaceable.includes(id) ? ` data-replace="${esc(id)}" aria-pressed="false"` : '';
    const style = !relic ? ' empty' : id === equipped ? ' equipped' : '';
    return `<button type="button" class="relic-slot${style}" data-slot="${index}"${replace} aria-label="${esc(label)}" title="${esc(label)}">` +
      (relic ? relicIcon(id, 48) : '') + '</button>';
  }).join('');
  return '<div class="relic-rack"><span class="relic-rack-label">장착 유물</span>' +
    '<div class="relic-strip" role="group" aria-label="장착 유물">' + slots + '</div></div>';
}

export function bindRelicSlots(root, ids, onSlot) {
  for (const button of $$('.relic-slot', root)) {
    button.addEventListener('click', () => onSlot(ids[Number(button.dataset.slot)], button));
  }
}

export function openRelicSheet(openSheet, relic, { temporary = false, back, onClose } = {}) {
  const body = '<div class="relic-sheet" tabindex="-1">' + (relic
    ? '<div class="relic-sheet-effect">' + relicIcon(relic.id, 48) + '<div><p>' + esc(relicEffect(relic)) + '</p>' +
      (temporary ? '<small>이번 전투만</small>' : '') + '</div></div>'
    : '<p>장착된 유물이 없습니다.</p>') +
    (back ? '<button type="button" class="btn" data-relic-back>장착 유물로</button>' : '') + '</div>';
  openSheet(relic?.name ?? '빈 칸', body, { latest: '.relic-sheet', onClose });
  if (back) $('[data-relic-back]').addEventListener('click', back);
}

export function relicMarks(core, ids) {
  if (!ids.length) return '';
  return '<span class="relic-marks">' + ids.map(id => {
    const relic = core.GameUtils.getArtifactById(id);
    return `<span class="relic-mark" data-relic-mark="${esc(id)}" title="${esc(relic.name)}">` +
      relicIcon(id, 16, relic.name) + '</span>';
  }).join('') + '</span>';
}
