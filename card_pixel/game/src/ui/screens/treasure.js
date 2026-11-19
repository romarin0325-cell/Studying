import { $, $$, esc, show } from '../dom.js';
import { head } from '../widgets.js';
import { takeTreasure, equipRelic } from '../../engine/run.js';
import { RELIC_LIMIT } from '../../engine/rooms.js';

export function treasureScreen(run, ui, id, { equipped = false } = {}) {
  const relic = ui.artifacts.get(id);
  const pending = run.pending?.kind === 'relic' ? run.pending : null;
  const offered = run.room.type === 'treasure' && run.room.status === 'service';
  const slotsFull = run.relics.length === RELIC_LIMIT;
  const replaceable = pending?.replace || (offered && slotsFull ? run.relics : []);
  const { sfx } = ui.audio;
  const node = $('#treasure');
  let replacing = null;

  function render() {
    const old = ui.artifacts.get(replacing);
    const title = run.room.type === 'treasure' ? '보물방' : '유물';
    const slots = Array.from({ length: RELIC_LIMIT }, (_, index) => {
      const slotId = run.relics[index];
      const item = ui.artifacts.get(slotId);
      const selectable = replaceable.includes(slotId);
      const body = slotId ? ui.icon(slotId) + '<span>' + esc(item.name) + '</span>' : '<span>빈 칸</span>';
      const cls = 'relic-slot win' + (slotId === replacing ? ' sel' : '') +
        (slotId && slotId === id && (equipped || !offered) ? ' equipped' : '');
      return selectable ? '<button class="' + cls + '" data-replace="' + esc(slotId) + '">' + body + '</button>' :
        '<div class="' + cls + '">' + body + '</div>';
    }).join('');
    const description = relic ? '<h2>' + esc(relic.name) + '</h2><p>' + esc(relic.desc) + '</p>' : '<h2>남은 유물 없음</h2>';
    const compare = old ? '<div class="run-relic-compare"><p class="loss">빠짐 · ' + esc(old.name + ' · ' + old.desc) +
      '</p><p class="gain">장착 · ' + esc(relic.name + ' · ' + relic.desc) + '</p></div>' : '';
    const canEquip = !!relic && !equipped && !!(pending || offered);
    const label = old ? old.name + (hasFinalConsonant(old.name) ? '을' : '를') + ' 빼고 장착' : '장착';
    const disabled = (replaceable.length && !old) || (pending && run.crystals < pending.cost);
    node.innerHTML = head(run, title, run.floor + '층') +
      '<div class="run-treasure scroll">' + ui.scene(run.room.bg, '<div class="relic-dais">' + (relic ? ui.icon(id, 3) : '') + '</div>') +
      '<div class="run-relic-description win">' + description + (equipped ? '<small class="gain">장착 완료</small>' : '') +
      (pending?.cost ? '<small>결정 ' + pending.cost + (run.crystals < pending.cost ? ' · ' + (pending.cost - run.crystals) + '개 부족' : '') + '</small>' : '') +
      '</div><h3>장착 유물</h3><div class="run-relic-slots">' + slots + '</div>' +
      (replaceable.length && !old ? '<p class="sm">빼낼 유물을 고른다.</p>' : '') + compare + '</div>' +
      '<div class="footer"><button class="btn' + (canEquip ? '' : ' go') + '" id="b-leave">' +
      (canEquip ? '두고 가기' : '다음으로') + '</button>' +
      (canEquip ? '<button class="btn go" id="b-equip"' + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>' : '') +
      '</div>';
    show('treasure');
    for (const button of $$('[data-replace]', node)) button.addEventListener('click', () => {
      replacing = button.dataset.replace;
      sfx.tap();
      render();
      $('.run-relic-compare', node).scrollIntoView({ block: 'nearest' });
    });
    $('#b-leave', node).addEventListener('click', ui.leave);
    $('#b-equip', node)?.addEventListener('click', () => {
      if (offered && !ui.command(takeTreasure).ok) return;
      if (run.pending?.kind === 'relic' && !ui.command(equipRelic, id, replacing).ok) {
        ui.route();
        return;
      }
      sfx.gem();
      if (run.pending) ui.route();
      else treasureScreen(run, ui, id, { equipped: true });
    });
  }
  render();
}

function hasFinalConsonant(word) {
  return /[가-힣]$/.test(word) && (word.charCodeAt(word.length - 1) - 0xac00) % 28 !== 0;
}
