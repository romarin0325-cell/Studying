import { $, $$, esc, show } from '../dom.js';
import { head, DOOR, foeFlip, affixChips } from '../widgets.js';
import { ELEMENT } from '../../engine/roster.js';
import * as R from '../../engine/run.js';
import { QUIRKS } from '../../content/quirks.js';

export function mapScreen(run, roster, widgets, audio, enterDoor) {
  const { sprite, benchMinis } = widgets;
  const { sfx } = audio;
  const node = $('#map'), boss = roster.bossOf(run.boss);
  const track = Array.from({ length: R.FLOORS }, (_, i) => {
    const f = i + 1, cls = f < run.floor ? 'done' : f === run.floor ? 'cur' : '';
    return '<i class="' + cls + (f === 4 ? ' gate' : '') + (f === R.FLOORS ? ' boss' : '') + '">' + (f === R.FLOORS ? '★' : f) + '</i>';
  }).join('<u></u>');
  node.innerHTML = head(run, '꿈길 ' + run.floor + '층', run.floor === R.FLOORS ? '꿈의 주인' : run.floor === 4 ? '문지기' : '') + '<div class="scroll">' +
    '<div class="track">' + track + '</div>' +
    '<div class="bosscard win"><span class="pic">' + sprite(boss.sprite, { flip: foeFlip(boss), cls: boss.look === 'boss' ? 'boss-tint' : '' }) + '</span><span class="txt"><small>이번 꿈의 주인</small><b>' + esc(boss.name) + '</b><p>' + esc(boss.note) + '</p></span></div>' +
    '<h3>문을 고른다</h3><div class="doors">' + run.doors.map(doorCard).join('') + '</div>' +
    '<h3>동료 <span class="sm">' + run.bench.length + '명' + (run.fallen.length ? ' · 쓰러짐 ' + run.fallen.length : '') + ' · 누르면 자세히</span></h3>' +
    '<div class="benchrow">' + benchMinis(run) + '</div>' +
    '</div>';
  show('map');
  $$('.door', node).forEach(b => b.addEventListener('click', () => { audio.unlockAudio(); sfx.tap(); enterDoor(run.doors[Number(b.dataset.i)]); }));

  function doorCard(door, i) {
    const t = DOOR[door.type];
    let body = '';
    if (door.enemies.length) {
      body += '<div class="foes">' + door.enemies.map(e => '<span class="foe">' + sprite(e.sprite, { flip: foeFlip(e), cls: door.type === 'boss' ? (e.look === 'boss' ? 'boss-tint' : '') : 'sil' }) + '<i class="dot el-' + e.element + '">' + ELEMENT[e.element] + '</i>' + affixChips(e) + '</span>').join('') + '</div>';
      if (door.quirk) { const q = QUIRKS[door.quirk]; body += '<div class="qbox"><b>꿈의 변덕 · ' + esc(q.name) + '</b><span>' + esc(q.desc) + '</span></div>'; }
      if (door.type === 'gate' && door.fromUnchosen) body += '<p class="sm">네가 깨우지 않은 꿈이 섞여 있다.</p>';
    }
    const reward = ['wild', 'elite', 'gate'].includes(door.type) ? '<span class="rw">◆ +' + door.reward + (door.type === 'gate' ? ' · 동료 1' : '') + '</span>' : '';
    return '<button class="door win t-' + door.type + '" data-i="' + i + '"><span class="dt"><b>' + t[0] + '</b><small>' + t[1] + '</small>' + reward + '</span>' + body + '</button>';
  }
}
