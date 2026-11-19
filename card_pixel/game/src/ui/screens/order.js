import { $, $$, esc, show } from '../dom.js';
import { head, DOOR, foeFlip, badges } from '../widgets.js';
import { ELEMENT, POSITION } from '../../engine/roster.js';
import { QUIRKS } from '../../content/quirks.js';
import { AFFIXES } from '../../content/affixes.js';

export function orderScreen(run, core, widgets, audio, toMap, startBattle) {
  const { card, sprite, cardRow } = widgets;
  const { sfx } = audio;
  const door = run.door, node = $('#order'), all = core.GameUtils.getAllCards();
  let slots = run.bench.slice(0, 3);
  function draw() {
    const deck = [slots[0] || null, slots[1] || null, slots[2] || null];
    const slotHtml = [0, 1, 2].map(i => {
      const id = deck[i];
      if (!id) return '<button class="slot win" data-slot="' + i + '"><span class="pos">' + POSITION[i] + '</span><span class="empty">＋</span></button>';
      const c = card(id), init = core.Logic.calculateInitialStats(c, deck, all, i), notes = [];
      if (c.trait.type === 'pos_stat_boost') notes.push(c.trait.pos === i ? '자리 효과 발동' : POSITION[c.trait.pos] + ' 전용 효과');
      else if (/^syn_/.test(c.trait.type)) notes.push(init.activeTrait ? '시너지 발동' : '시너지 조건 부족');
      return '<button class="slot win" data-slot="' + i + '"><span class="pos">' + POSITION[i] + '</span><span class="pic">' + sprite(id) + '</span><span class="nm">' + esc(c.name) + '</span><span class="fx">' + esc(notes.join(' · ')) + '</span><span class="badges">' + badges(run, id) + '</span></button>';
    }).join('');
    const q = door.quirk && QUIRKS[door.quirk];
    node.innerHTML = head(run, DOOR[door.type][0], '꿈길 ' + run.floor + '층') + '<div class="scroll">' +
      '<div class="foelist">' + door.enemies.map((e, k) => '<div class="foeline win"><span class="pic">' + sprite(e.sprite, { flip: foeFlip(e), cls: e.look === 'boss' ? 'boss-tint' : e.look === 'shadow' ? 'shadow-tint' : '' }) + '</span><span class="txt"><b>' + (door.enemies.length > 1 ? (k + 1) + '. ' : '') + esc(e.name) + ' <i class="el-' + e.element + '">' + ELEMENT[e.element] + '</i></b>' +
        (e.affixes && e.affixes.length ? '<span class="afx">' + e.affixes.map(a => '<i>' + esc(AFFIXES[a].name) + '</i> ' + esc(AFFIXES[a].desc)).join('<br>') + '</span>' : '') + (e.note ? '<span class="afx">' + esc(e.note) + '</span>' : '') + '</span></div>').join('') + '</div>' +
      (q ? '<div class="qbox"><b>꿈의 변덕 · ' + esc(q.name) + '</b><span>' + esc(q.desc) + '</span></div>' : '') +
      '<h3>출전 순서</h3><p class="sm">선봉부터 싸운다. 쓰러지면 다음 자리가 이어받고, 쓰러진 동료의 가장 강한 공격이 유품으로 넘어간다.</p>' +
      '<div class="slots">' + slotHtml + '</div>' +
      '<h3>동료 <span class="sm">누르면 빈 자리에 선다 · 자리를 누르면 내려온다</span></h3>' +
      '<div class="cards">' + run.bench.map(id => cardRow(run, id, { cls: slots.includes(id) ? 'used' : '' })).join('') + '</div></div>' +
      '<div class="footer"><button class="btn back" id="b-back">돌아가기</button><button class="btn go" id="b-go"' + (slots.length ? '' : ' disabled') + '>출전 (' + slots.length + '명)</button></div>';
    $$('.slot', node).forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.slot); if (slots[i]) { slots.splice(i, 1); sfx.tap(); draw(); } }));
    $$('.cardrow', node).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id; sfx.tap();
      if (slots.includes(id)) slots = slots.filter(x => x !== id); else if (slots.length < 3) slots.push(id);
      draw();
    }));
    $('#b-back').addEventListener('click', () => { sfx.tap(); toMap(false); });
    $('#b-go').addEventListener('click', () => { if (!slots.length) return; run.bench = slots.concat(run.bench.filter(id => !slots.includes(id))); audio.unlockAudio(); startBattle(slots); });
  }
  draw(); show('order');
}
