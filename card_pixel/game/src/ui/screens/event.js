import { $, $$, esc, show } from '../dom.js';
import { bonusPercent, chooseReplacements, departureLoss, head, heirloomOffer } from '../widgets.js';
import { chooseEvent } from '../../engine/run.js';
import { eventChoices } from '../../engine/rooms.js';
import { drawText } from '../reveal.js';
import { relicIcon } from '../relics.js';
import { describeEventOffer, eventEffectText, eventReleaseCount } from '../event-offers.js';

const DIALOGUE = {
  greenhouse: '“화분을 데려갈 거면 볕을 쬐어 줘.”',
  rabbit_tracks: '“굴 안에 한 마리 더 있어.”',
  observatory: '“등불을 끄면 별이 더 잘 보여.”',
  lightning_rod: '“한 번 빌려 써도 돼.”',
  late_letter: '“아직 제시간에 닿을 수 있어.”',
  armor_test: '“갑옷이 달아오를 때 쳐 봐.”',
  last_die: '“굴릴래, 아니면 받을 사람을 고를래?”',
  fifth_bell: '“다섯 번째 종이 울릴 때야.”',
  empty_role: '“가면 뒤엔 누가 있을까?”',
  championship: '“세 사람의 등급을 맞춰 와.”',
  grand_merchant: '“값을 보고 골라.”',
  rumi: '“한 사람에게 축복을 모아 줄 수도 있어.”'
};

export function eventScreen(run, ui, result = null) {
  ui.playMusic();
  const { card, sprite, spr, cardRow } = ui.widgets;
  const { sfx } = ui.audio;
  const event = run.room.event;
  const node = $('#event');
  const offerContext = { card, artifacts: ui.artifacts, core: ui.core, room: run.room };
  const choices = run.pending?.kind === 'event' ? eventChoices(run, ui.core, ui.roster) : [];
  let selection = null;
  const hosts = event?.requires.present || [];
  const draws = result?.effects.flatMap(effect => effect.type === 'join' ?
    effect.draw ? [effect.draw] : effect.ids.map(id => ({ kind: 'join', id })) : []) ?? [];
  // Only new members walk into the scene; a boost or memory changes someone who is already here.
  const joined = draws.filter(draw => draw.kind === 'join').map(draw => draw.id);
  const released = result?.effects.filter(effect => effect.type === 'release').map(effect => effect.id) ?? [];

  const actor = (id, classes, flip) => {
    const asset = spr(id);
    return asset ? sprite(id, {
      cls: classes, flip: flip !== (asset.facing === 'left'),
      style: 'width:' + asset.w * 2 + 'px;height:' + asset.h * 2 + 'px;'
    }) : '';
  };
  const party = run.bench.find(id => !joined.includes(id) && !hosts.includes(id));
  const visible = [...new Set([...hosts, ...joined, ...released].filter(Boolean))];
  const artwork = '<div class="event-cast">' + (party ? actor(party, 'event-party', false) : '') +
    '<div class="event-visitors">' + visible.map(id => actor(id, joined.includes(id) ? 'event-joiner' : released.includes(id) ? 'event-released' : '', true)).join('') +
    '</div></div>';

  const joinIds = choice => choice.ops.flatMap(op => op.type === 'join' && !op.random ? op.ids : []);
  function targetValue(choice, id) {
    const change = choice.blessingChanges?.[id];
    const net = choice.netCrystals?.[id];
    if (change) return '원정 +' + bonusPercent(change.before) + '% → +' + bonusPercent(change.after) + '%';
    if (net != null) return '순수입 ◆' + net;
    return '';
  }

  function take(choice, target) {
    function apply(replaceIds) {
      const outcome = ui.command(chooseEvent, choice.id, target, replaceIds);
      if (outcome.reason === 'roster_full' && outcome.requiredReleases > 0 && !replaceIds.length) {
        chooseReplacements(run, ui, outcome.requiredReleases, apply, { incoming: joinIds(choice) });
        return;
      }
      if (!outcome.ok) return;
      ui.sheets.closeSheet();
      const equipped = outcome.effects.some(effect => effect.type === 'relic' && effect.equipped);
      if (equipped) sfx.gem();
      else if (outcome.effects.some(effect => effect.type === 'join')) sfx.awaken();
      else if (outcome.effects.some(effect => effect.type === 'promise')) {
        ui.audio.unlockAudio();
        sfx.seal();
      } else sfx.tap();
      if (run.pending || (run.room.relic && equipped)) ui.route();
      else eventScreen(run, ui, outcome);
    }
    const count = eventReleaseCount(run, choice);
    if (count) chooseReplacements(run, ui, count, apply, { incoming: joinIds(choice) });
    else apply([]);
  }

  const results = result ? [
    ...draws.map(draw => drawText(draw, card)),
    ...released.map(id => card(id).name + ' · 원정 이탈'),
    result.crystals ? '결정 ' + (result.crystals > 0 ? '+' : '') + result.crystals : '',
    ...result.effects.filter(effect => !['join', 'release'].includes(effect.type)).map(effect =>
      eventEffectText(effect, offerContext, effect.type === 'bless' ? effect.id : undefined))
  ].filter(Boolean) : [];
  const plates = choices.map(choice => {
    const { name, detail, condition, releaseNote, promiseRelic } = describeEventOffer(run, choice, offerContext);
    const changes = !choice.targets && choice.blessingChanges ? Object.keys(choice.blessingChanges).map(id =>
      '<small>' + esc(card(id).name + ' · ' + targetValue(choice, id)) + '</small>').join('') : '';
    const offer = joinIds(choice).map(id => heirloomOffer(card(id))).join('');
    const label = (promiseRelic ? '<b class="promise-choice">' + relicIcon(promiseRelic, 20) : '<b>') +
      esc(name) + '</b><span>' + esc(detail) + '</span>';
    return '<button class="event-choice win" data-choice="' + esc(choice.id) + '"' + (choice.enabled ? '' : ' disabled') +
      '>' + label + offer + changes + (releaseNote ? '<small class="loss">' + esc(releaseNote) + '</small>' : '') +
      (condition ? '<small>' + esc(condition) + '</small>' : '') + '</button>';
  }).join('');
  const promised = event?.id === run.promise?.id && ui.artifacts.get(run.promise?.relic);
  if (promised) results.push(run.promise.floor + '층 약속 · ' + promised.name + ' 인수');
  const secondary = results.length ? results.map(line => '<p>' + esc(line) + '</p>').join('') :
    event && choices.length ? '<p>' + esc(DIALOGUE[event.id] || '') + '</p>' : '';
  const canChoose = choices.some(choice => choice.enabled);
  node.innerHTML = head(run, '사건', run.floor + '층') + '<div class="run-event screen-split"><div class="fixed-top">' +
    ui.scene(run.room.bg, artwork) + '<div class="event-dialog win"><h2>' + esc(event?.name || '고요한 방') +
    '</h2><div class="scroll-detail" tabindex="0"><p>' + esc(event?.text || '방 안이 고요합니다.') + '</p>' + secondary + '</div></div></div>' +
    '<div class="event-choices scroll-list">' + plates + '</div><div class="footer fixed-foot">' +
    '<button class="btn' + (canChoose ? '' : ' go') + '" id="b-leave">' +
    (choices.length ? '그냥 지나가기' : '다음 층으로') + '</button></div></div>';
  // The confirm button names what the chosen companion receives (or that they leave).
  function targetVerb(choice) {
    if (choice.target === 'release') return '보내기';
    const types = choice.ops.map(effect => effect.type);
    if (types.includes('heirloom')) return '유품 받기';
    if (types.includes('bless')) return '축복 받기';
    return '선택';
  }

  show('event');
  $('#b-leave', node)?.addEventListener('click', ui.leave);
  for (const button of $$('[data-choice]', node)) button.addEventListener('click', () => {
    const choice = choices.find(entry => entry.id === button.dataset.choice);
    if (!choice.targets) return take(choice);
    selection = null;
    ui.sheets.openSheet('동료 고르기', '<div class="cards">' + choice.targets.map(id => cardRow(run, id, {
      skills: false, detail: targetValue(choice, id)
    })).join('') +
      '</div><p id="event-target-effect"></p><button class="btn go" id="b-event-target" disabled>선택 확정</button>');
    const confirm = $('#b-event-target');
    const rows = $$('#sh-body [data-id]');
    for (const row of rows) row.addEventListener('click', () => {
      selection = row.dataset.id;
      sfx.tap();
      for (const other of rows) other.classList.toggle('sel', other === row);
      const detail = targetValue(choice, selection);
      const losing = choice.target === 'release' ? departureLoss(run, selection) : '';
      const line = [detail, losing].filter(Boolean).join(' · ');
      const text = $('#event-target-effect');
      text.textContent = line || choice.ops.map(effect => eventEffectText(effect, offerContext, selection)).filter(Boolean).join(' · ');
      text.classList.toggle('loss', !!losing);
      confirm.disabled = false;
      confirm.textContent = card(selection).name + ' · ' + targetVerb(choice);
    });
    confirm.addEventListener('click', () => { if (selection) take(choice, selection); });
  });
}
