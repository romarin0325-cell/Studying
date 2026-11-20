import { $, $$, esc, show } from '../dom.js';
import { head } from '../widgets.js';
import { bindRelicSlots, openRelicSheet, relicEffect, relicIcon, relicStrip } from '../relics.js';
import { takeTreasure, equipRelic } from '../../engine/run.js';
import { RELIC_LIMIT } from '../../engine/rooms.js';

export function treasureReceipt(relic) {
  return relic ? '<div class="relic-receipt win" role="status">' + relicIcon(relic.id, 32) +
    '<span>' + esc(relic.name) + ' · <b class="gain">장착 완료</b></span></div>' : '';
}

export function treasureScreen(run, ui, id, { equipped = false, node = $('#treasure'), inline = false, onEquipped } = {}) {
  if (!inline) ui.playMusic();
  const relic = ui.artifacts.get(id);
  const pending = run.pending?.kind === 'relic' ? run.pending : null;
  const offered = run.room.type === 'treasure' && run.room.status === 'service';
  const canEquip = !!relic && !equipped && !!(pending || offered);
  const comparing = canEquip && run.relics.length === RELIC_LIMIT;
  const replaceable = comparing ? pending?.replace ?? run.relics : [];
  const { sfx } = ui.audio;
  const title = run.room.type === 'treasure' ? '보물방' : '유물';
  const cost = pending?.cost ?? 0;
  const short = Math.max(0, cost - run.crystals);
  let replacing = null;

  const description = relic ? '<h2>' + esc(relic.name) + '</h2><p>' + esc(relicEffect(relic)) + '</p>' : '<h2>남은 유물 없음</h2>';
  const offer = comparing ? '<div class="run-relic-compare" aria-live="polite">' +
    comparisonCard(relic, '장착', 'incoming') + comparisonCard(null, '빠짐', 'outgoing') + '</div>' :
    '<div class="run-relic-description win">' + description + (equipped ? '<small class="gain">장착 완료</small>' : '') + '</div>';
  node.innerHTML = (inline ? '<h4>유물 교체</h4>' : head(run, title, run.floor + '층')) +
    relicStrip(ui.core, run.relics, { replaceable, equipped: equipped ? id : null }) +
    '<div class="run-treasure' + (inline ? '' : ' scroll') + (comparing ? ' comparing' : '') + '">' +
    (inline ? '' : ui.scene(run.room.bg, '<div class="relic-dais">' + (relic ? relicIcon(id, 96) : '') + '</div>')) + offer +
    (cost ? '<p class="relic-cost' + (short ? ' loss' : '') + '">결정 ' + cost + (short ? ' · ' + short + '개 부족' : '') + '</p>' : '') +
    '</div><div class="footer"><button class="btn' + (canEquip ? '' : ' go') + '" id="b-leave">' +
    (canEquip ? '두고 간다' : '다음으로') + '</button>' +
    (canEquip ? '<button class="btn go" id="b-equip"' + (comparing || short ? ' disabled' : '') + '>장착</button>' : '') +
    '</div>';
  // Inline on the victory panel the comparison lives inside #result; switching screens would hide it.
  if (!inline) show('treasure');
  const equip = $('#b-equip', node);
  bindRelicSlots(node, run.relics, (slotId, button) => {
    sfx.tap();
    const item = ui.artifacts.get(slotId);
    if (!button.hasAttribute('data-replace')) {
      openRelicSheet(ui.sheets.openSheet, item);
      return;
    }
    replacing = slotId;
    for (const slot of $$('[data-replace]', node)) slot.setAttribute('aria-pressed', String(slot === button));
    $('.run-relic-compare .outgoing', node).outerHTML = comparisonCard(item, '빠짐', 'outgoing');
    equip.textContent = item.name + (hasFinalConsonant(item.name) ? '을' : '를') + ' 빼고 장착';
    equip.disabled = !!short;
  });
  $('#b-leave', node).addEventListener('click', equipped && run.pending?.kind === 'reinforcement' ? ui.route : ui.leave);
  equip?.addEventListener('click', () => {
    if (offered && !ui.command(takeTreasure).ok) return;
    if (run.pending?.kind === 'relic' && !ui.command(equipRelic, id, replacing).ok) {
      ui.route();
      return;
    }
    sfx.gem();
    if (onEquipped) onEquipped(id);
    else if (offered || pending) {
      const actions = $('.footer', node);
      actions.querySelectorAll('button').forEach(button => { button.disabled = true; });
      actions.insertAdjacentHTML('beforebegin', treasureReceipt(relic));
      setTimeout(() => {
        if (!actions.isConnected || !node.classList.contains('on')) return;
        if (run.pending) ui.route();
        else ui.leave(relic?.name);
      }, 480);
    }
  });
}

function comparisonCard(relic, label, kind) {
  const details = relic ? relicIcon(relic.id, 32) + '<h3>' + esc(relic.name) + '</h3><p>' + esc(relicEffect(relic)) + '</p>' :
    '<p>뺄 유물을 고른다.</p>';
  return '<article class="relic-compare-card ' + kind + '"><small>' + label + '</small>' + details + '</article>';
}

function hasFinalConsonant(word) {
  return /[가-힣]$/.test(word) && (word.charCodeAt(word.length - 1) - 0xac00) % 28 !== 0;
}
