import { $, $$, esc, show } from '../dom.js';
import { head, badges, foeFlip } from '../widgets.js';
import { POSITION } from '../../engine/roster.js';
import { HEIRLOOM_POWER, heirloomPreview } from '../../engine/bridge.js';
import { confirmOrder } from '../../engine/run.js';
import { QUIRKS } from '../../content/quirks.js';
import { AFFIXES } from '../../content/affixes.js';

export function orderScreen(run, ui) {
  const { core, widgets, audio, sheets } = ui;
  const { card, sprite, face } = widgets;
  const { sfx } = audio;
  const node = $('#order');
  const room = run.room;
  const party = [0, 1, 2].map(i => run.bench[i] || null);
  const all = core.GameUtils.getAllCards();
  const qualifiers = room.type === 'gate' || room.type === 'boss';
  const quirk = QUIRKS[room.quirk];
  let selected = -1;

  function render() {
    const previews = heirloomPreview(core, party);
    const slots = party.map((id, i) => {
      const fighter = id && card(id);
      const picked = selected === i ? ' sel' : '';
      const preview = previews[i];
      const link = preview.skill ? '쓰러지면 ↓ ' + card(preview.to).name + '에게 ' + preview.skill.name + ' ×' + HEIRLOOM_POWER : '넘길 공격 없음';
      const replaced = preview.skill && run.heirlooms[preview.to]?.name;
      const recruitment = run.recruited.includes(id) ? '생환 시 인연' : '생환 시 영입 후보';
      let trait = '';
      if (fighter?.trait.type === 'pos_stat_boost') {
        trait = fighter.trait.pos === i ? '자리 효과 발동' : POSITION[fighter.trait.pos] + ' 전용';
      } else if (fighter && /^syn_/.test(fighter.trait.type)) {
        trait = core.Logic.calculateInitialStats(fighter, party, all, i).activeTrait ? '시너지 발동' : '시너지 조건 부족';
      }
      return '<button class="relay-seat win' + picked + '" data-slot="' + i + '" aria-pressed="' + (selected === i) + '">' +
        '<small>' + POSITION[i] + '</small><span class="run-face">' + (id ? face(id, 44) : '') + '</span>' +
        '<span><b>' + esc(fighter?.name || '빈 자리') + '</b><span class="badges">' + (id ? badges(run, id) : '') + '</span>' +
        (trait ? '<small>' + esc(trait) + '</small>' : '') + '</span>' +
        (id && qualifiers ? '<small class="recruit-flag">' + recruitment + '</small>' : '') + '</button>' +
        (i < 2 ? '<p class="relay-link">' + esc(link) + (replaced ? '<small>' + esc(replaced) + ' 유품을 교체한다</small>' : '') + '</p>' : '');
    }).join('');

    const bench = run.bench.filter(id => !party.includes(id));
    const hazards = [quirk?.name, ...new Set(room.enemies.flatMap(enemy => (enemy.affixes || []).map(id => AFFIXES[id].name)))].filter(Boolean);
    const action = room.final && run.stats.retries ? '편성을 바꿔 재도전' : '출전 (' + party.filter(Boolean).length + '명)';
    node.innerHTML = head(run, '출전 순서', run.floor + '층') + '<div class="scroll">' +
      '<button class="win run-opponents" id="b-opponents"><span>' +
      room.enemies.map(enemy => '<span class="run-face">' + face(enemy.sprite, 32) + '</span>').join('') + '</span><span><b>' +
      esc(room.enemies.map(enemy => enemy.name).join(' → ')) + '</b><small>' +
      esc((room.enemies.length > 1 ? room.enemies.length + '연전 · ' : '') + room.name +
        (hazards.length ? ' · ' + hazards.join(' · ') : '')) + '</small></span></button>' +
      '<div class="relay-seats">' + slots + '</div><h3>대기 동료</h3><p class="sm">자리를 누른 뒤, 바꿀 자리나 대기 동료를 고른다.</p>' +
      '<div class="reserve-cards">' + (bench.map(id => '<button class="win" data-bench="' + esc(id) + '"><span class="run-face">' +
        face(id, 44) + '</span><b>' + esc(card(id).name) + '</b></button>').join('') || '<p>없음</p>') +
      '</div></div><div class="footer"><button class="btn go" id="b-go">' + action + '</button></div>';
    show('order');
    for (const button of $$('[data-slot]', node)) button.addEventListener('click', () => {
      const index = Number(button.dataset.slot);
      if (selected < 0) selected = index;
      else {
        [party[selected], party[index]] = [party[index], party[selected]];
        selected = -1;
      }
      sfx.tap();
      render();
    });
    for (const button of $$('[data-bench]', node)) button.addEventListener('click', () => {
      if (selected < 0) return;
      party[selected] = button.dataset.bench;
      selected = -1;
      sfx.tap();
      render();
    });
    $('#b-go', node).addEventListener('click', () => {
      audio.unlockAudio();
      sfx.tap();
      if (ui.command(confirmOrder, party).ok) ui.route();
    });
    $('#b-opponents', node).addEventListener('click', () => {
      sheets.openSheet(room.name, room.enemies.map(enemy => '<div class="run-foe-detail">' +
        sprite(enemy.sprite, { flip: foeFlip(enemy), cls: enemy.look === 'shadow' ? 'shadow-tint' : '' }) +
        '<div><h4>' + esc(enemy.name) + '</h4>' +
        (enemy.note ? '<p>' + esc(enemy.note) + '</p>' : '') +
        (enemy.affixes || []).map(id => '<p>' + esc(AFFIXES[id].desc) + '</p>').join('') + '</div></div>').join('') +
        (quirk ? '<p>' + esc(quirk.name + ' · ' + quirk.desc) + '</p>' : ''));
    });
  }
  render();
}
