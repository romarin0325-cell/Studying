import { $, $$, esc, show } from '../dom.js';
import { bonusPercent, chooseReplacements, departureLoss, head, heirloomOffer, replacementCount } from '../widgets.js';
import { chooseEvent } from '../../engine/run.js';
import { eventChoices } from '../../engine/rooms.js';
import { BLESS } from '../../engine/awakenings.js';

const NEXT = '다음 전투 한 번';
const STAYS = '이번 원정 끝까지';
const BET = {
  empty_sky: '하늘을 비워 둔 채 승리',
  delayed_on_time: '예약 공격을 정시에 발동하고 승리',
  same_grade_full: '같은 등급 셋으로 출전해 승리'
};
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
  const choices = run.pending?.kind === 'event' ? eventChoices(run, ui.core, ui.roster) : [];
  let selection = null;
  const hosts = event?.requires.present || [];
  const joined = result?.effects.flatMap(effect => effect.type === 'join' ? effect.ids : []) || [];
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

  function effectText(effect, target) {
    const name = id => card(id).name;
    switch (effect.type) {
      case 'join':
        return STAYS + ' · ' + (effect.random ? '무작위 동료 1명' : effect.ids.map(name).join(' · ')) + ' 합류';
      case 'release':
        return (target ? name(target) : '동료 1명') + ' 이탈 · 축복·유품 소멸 · 등급에 따라 결정 획득';
      case 'bless': {
        const amount = effect.multiplier === 'grade' ? (target ? BLESS[card(target).grade] : null) : effect.multiplier;
        return STAYS + ' · ' + (effect.all ? '모든 동료' : target ? name(target) : '동료 1명') +
          (amount ? ' 능력치 +' + Math.round(amount * 100) + '%' : ' 등급별 축복');
      }
      case 'altar':
        return '무작위 동료 1명 축복 · 최대 세 번 굴리기';
      case 'relic': {
        const relic = ui.artifacts.get(effect.id === 'offered' ? run.room.relic : effect.id);
        return (effect.temporary ? NEXT : STAYS) + ' · ' + (relic?.name || '유물 품절');
      }
      case 'field':
        return NEXT + ' · 시작 하늘에 ' + effect.ids.map(id => ui.core.BUFF_NAMES[id] || id).join(' · ');
      case 'start':
        return NEXT + ' · 적 ' + Object.entries(effect.enemyDebuffs).map(([id, stacks]) =>
          (ui.core.BUFF_NAMES[id] || id) + ' +' + stacks).join(' · ');
      case 'bet': {
        const condition = effect.kind === 'kill_on_turn' ? effect.turn + '턴에 적 하나 처치 후 승리' : BET[effect.kind];
        const prize = effect.reward.crystals ? '결정 +' + effect.reward.crystals : ui.artifacts.get(effect.reward.relic)?.name;
        return (effect.kind === 'kill_on_turn' ? '다음 전투 ' : NEXT + ' · ') + condition + ' → ' + prize + ' · 실패 시 보상 없음';
      }
      case 'crystals':
        return '결정 +' + effect.amount;
      case 'heirloom':
        return STAYS + ' · ' + (target ? name(target) + '에게 ' : '') + '유품 ' + effect.name;
    }
  }

  const joinIds = choice => choice.ops.flatMap(op => op.type === 'join' && !op.random ? op.ids : []);
  function releases(choice) {
    const count = choice.ops.filter(op => op.type === 'join').reduce((sum, op) => sum + (op.random ? 1 : op.ids.length), 0);
    return choice.requiredReleases ?? replacementCount(run, count);
  }
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
      if (!outcome.ok) return;
      ui.sheets.closeSheet();
      const equipped = outcome.effects.some(effect => effect.type === 'relic' && effect.equipped);
      if (equipped) sfx.gem();
      else if (outcome.effects.some(effect => effect.type === 'join')) sfx.awaken();
      else sfx.tap();
      if (run.pending || (run.room.relic && equipped)) ui.route();
      else eventScreen(run, ui, outcome);
    }
    const count = releases(choice);
    if (count) chooseReplacements(run, ui, count, apply, { incoming: joinIds(choice) });
    else apply([]);
  }

  const cost = choice => choice.cost ? '결정 ' + choice.cost + ' · ' : '';
  const results = result ? [
    joined.length ? joined.map(id => card(id).name).join(' · ') + ' · 이번 원정 합류' : '',
    ...released.map(id => card(id).name + ' · 원정 이탈'),
    result.crystals ? '결정 ' + (result.crystals > 0 ? '+' : '') + result.crystals : '',
    ...result.effects.filter(effect => !['join', 'release'].includes(effect.type)).map(effect =>
      effect.type === 'bless' ? effectText(effect, effect.id) : effectText(effect))
  ].filter(Boolean) : [];
  const plates = choices.map(choice => {
    const short = run.crystals < (choice.cost || 0) ? '결정 ' + (choice.cost - run.crystals) + '개 부족' : '';
    const count = releases(choice);
    const changes = !choice.targets && choice.blessingChanges ? Object.keys(choice.blessingChanges).map(id =>
      '<small>' + esc(card(id).name + ' · ' + targetValue(choice, id)) + '</small>').join('') : '';
    const offer = joinIds(choice).map(id => heirloomOffer(card(id))).join('');
    const effects = choice.ops.map(effect => effectText(effect)).filter(Boolean);
    if (event.id === 'penguin_ice_seam' && choice.id === 'carry' && !choice.text.includes('물 동료 없음') &&
      !run.bench.some(id => ui.core.GameUtils.cardMatchesElement(card(id), 'water'))) effects.push('물 동료 없음');
    return '<button class="event-choice win" data-choice="' + esc(choice.id) + '"' + (choice.enabled ? '' : ' disabled') +
      '><b>' + esc(choice.text) + '</b><span>' + esc(cost(choice) + effects.join(' · ')) +
      '</span>' + offer + changes + (count ? '<small class="loss">보낼 동료 ' + count + '명 필요</small>' : '') +
      (short || !choice.enabled ? '<small>' + esc(short || '조건 미충족') + '</small>' : '') + '</button>';
  }).join('');
  const secondary = results.length ? results.map(line => '<p>' + esc(line) + '</p>').join('') :
    event && choices.length ? '<p>' + esc(DIALOGUE[event.id] || '') + '</p>' : '';
  const canChoose = choices.some(choice => choice.enabled);
  node.innerHTML = head(run, '사건', run.floor + '층') + '<div class="run-event">' +
    ui.scene(run.room.bg, artwork) + '<div class="event-dialog win"><h2>' + esc(event?.name || '고요한 방') +
    '</h2><p>' + esc(event?.text || '방 안이 비어 있다.') + '</p>' + secondary + '</div>' +
    '<div class="event-choices">' + plates +
    '<button class="btn' + (canChoose ? '' : ' go') + '" id="b-leave">' +
    (choices.length ? '그냥 지나가기' : '다음 층으로') + '</button></div></div>';
  // The confirm button names what the chosen companion receives (or that they leave).
  function targetVerb(choice) {
    if (choice.target === 'release') return '보내기';
    const types = choice.ops.map(effect => effect.type);
    if (types.includes('heirloom')) return '유품 받기';
    if (types.includes('bless')) return '축복 받기';
    return '고르기';
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
      text.textContent = line || choice.ops.map(effect => effectText(effect, selection)).filter(Boolean).join(' · ');
      text.classList.toggle('loss', !!losing);
      confirm.disabled = false;
      confirm.textContent = card(selection).name + ' · ' + targetVerb(choice);
    });
    confirm.addEventListener('click', () => { if (selection) take(choice, selection); });
  });
}
