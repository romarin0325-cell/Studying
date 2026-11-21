import { $, $$, esc } from './dom.js';
import { icon } from './assets.js';
import { RELIC_LIMIT } from '../engine/rooms.js';

const EFFECTS = {
  reverse: '자연 속성 동료가 쓰러지면 하늘에 대지의 축복을 건다.',
  companion: '쓰러질 때 발동하는 특성과 유물의 피해 2배.',
  double_attack: '일반 공격 위력 2배.',
  over_flame: '작열을 부여할 때 중첩량 2배. 최대 5중첩.',
  over_divine: '디바인을 부여할 때 중첩량 2배. 최대 5중첩.',
  flame_piercing: '물리 공격이 적의 작열 1중첩마다 방어력을 10% 더 관통한다.',
  frozen_body: '물 속성 동료가 쓰러지면 적을 기절시킨다.',
  ice_break: '기절한 적에게 주는 공격 피해 2배.',
  support_boost: '보조 기술의 MP 소모 0.',
  lucky_vicky: '치명타를 내거나 공격을 피하면 MP 10 회복.',
  big_bang: '전설·초월 동료가 쓰러지면 적에게 위력 3배의 물리 피해를 준다.',
  death_roulette: '공격 피해 2배. 일반 공격 외 기술이 발동할 때 30% 확률로 시전자가 쓰러진다.',
  gale_storm: '전투 시작부터 3턴 동안 하늘에 질풍을 건다. 치명타율·회피율 +20%p.',
  buff_overload: '하늘에 필드 버프를 최대 5개까지 건다.'
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
    : '<p>유물을 장착할 수 있다.</p>') +
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
