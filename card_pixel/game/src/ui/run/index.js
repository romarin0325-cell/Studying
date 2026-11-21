import * as Run from '../../engine/run.js';
import { create as createRoster } from '../../engine/roster.js';
import { INTRO } from '../../content/intro.js';
import { createStage } from '../../stage/stage.js';
import { createAudio } from '../../stage/audio.js';
import { $, esc } from '../dom.js';
import { createSheet, sheetMarkup } from '../sheet.js';
import { createWidgets } from '../widgets.js';
import { createDetails } from '../battle/sheets.js';
import { battleMarkup, createBattleView } from '../battle/view.js';
import { appendSettlement, openBattleLog } from '../battle/log.js';
import { awakenScreen } from '../screens/awaken.js';
import { mapScreen } from '../screens/map.js';
import { orderScreen } from '../screens/order.js';
import { springScreen } from '../screens/spring.js';
import { altarScreen } from '../screens/altar.js';
import { eventScreen } from '../screens/event.js';
import { treasureReceipt, treasureScreen } from '../screens/treasure.js';
import { gatePickScreen } from '../screens/gate-pick.js';
import { reinforceScreen } from '../screens/reinforce.js';

const screens = ['awaken', 'map', 'order', 'spring', 'altar', 'event', 'treasure', 'pick', 'reinforce'];
let runtime;

function mount(frame, shared) {
  const core = window.RelayCore;
  const assets = window.RELAY_ASSETS;
  const roster = createRoster(core, assets);
  const stage = shared?.stage || createStage(assets);
  const audio = shared?.audio || createAudio(stage.clock);
  const widgets = createWidgets(assets, roster.card);
  for (const id of screens) {
    if (!$('#' + id)) frame.insertAdjacentHTML('beforeend', '<section id="' + id + '" class="screen"></section>');
    $('#' + id).classList.add('run-screen');
  }
  if (!$('#battle')) frame.insertAdjacentHTML('beforeend', battleMarkup());
  if (!$('#sheet')) frame.insertAdjacentHTML('beforeend', sheetMarkup());

  const sheets = shared?.sheets || createSheet(stage);
  const details = createDetails(core, widgets, sheets.openSheet);
  const battle = createBattleView({ core, roster, widgets, stage, audio, sheets, details, music: shared?.music });
  const canvas = $('#cv');
  stage.init(canvas, $('#fx'));
  stage.loadSprites();
  stage.start();
  window.addEventListener('resize', () => {
    if ($('#battle')?.classList.contains('on')) battle.layout();
  });
  for (const id of screens) {
    $('#' + id).addEventListener('click', event => {
      if (event.target.closest('[data-battle-log]') && battle.expedition) {
        audio.sfx.tap();
        openBattleLog(sheets, widgets, battle.expedition.lastBattleLog);
        return;
      }
      const button = event.target.closest('[data-sheet]');
      if (!button || !battle.expedition) return;
      event.stopPropagation();
      audio.sfx.tap();
      details.charSheet(battle.expedition, button.dataset.sheet);
    });
  }
  $('#sheet').addEventListener('click', event => {
    const button = event.target.closest('[data-sheet]');
    if (button && battle.expedition && $('.run-screen.on')) {
      details.charSheet(battle.expedition, button.dataset.sheet);
    }
  });
  return { frame, core, roster, widgets, audio, sheets, battle, details };
}

export function enterRun(run, host) {
  if (run.phase === 'done') return host.finish(run);
  const frame = $('#frame') || $('#app');
  if (!runtime || runtime.frame !== frame || !$('#battle')) runtime = mount(frame, host.runtime);
  const { core, roster, widgets, audio, sheets, battle, details } = runtime;
  battle.attach(run);
  const { assets } = host;
  const icon = (id, scale = 1) => {
    const src = assets.icon(id);
    const size = 32 * scale;
    return src ? '<img class="px run-icon" alt="" width="' + size + '" height="' + size + '" src="' + esc(src) + '">' : '';
  };
  const scene = (id, html = '', cls = '') => {
    const url = assets.background(id);
    const style = url ? ' style="--landscape:url(&quot;' + esc(url) + '&quot;)"' : '';
    return '<div class="run-scene ' + cls + '"' + style + '>' + html + '</div>';
  };
  const artifacts = new Map(core.ARTIFACT_LIST.map(relic => [relic.id, relic]));
  function command(action, ...args) {
    const result = action(run, ...args);
    if (result.ok) {
      if (run.dungeonId === 'dawn_forest' && action === Run.chooseStartPick) host.tutorial?.mark('awakening');
      host.save(run);
    }
    return result;
  }
  let mapEntry = false;
  const drafts = new Map();
  let draftFloor;
  let awakened = [];
  let receipt = '';
  function leave(equipped) {
    const result = command(Run.leaveRoom);
    if (!result.ok) return;
    if (typeof equipped === 'string') receipt = equipped;
    if (result.left && run.phase !== 'done') command(Run.nextFloor);
    route();
  }
  function enterDoor(index) {
    if (command(Run.chooseDoor, index).ok) route();
  }
  function wakeSurvivors() {
    if (!command(Run.leaveRoom).ok || !command(Run.nextFloor).ok) return;
    enterDoor(0);
  }
  function previewDoor(index) {
    if (draftFloor !== run.floor) {
      drafts.clear();
      draftFloor = run.floor;
    }
    if (!drafts.has(index)) {
      drafts.set(index, { runId: run.id, floor: run.floor, doorIndex: index, partyIds: Run.defaultParty(run) });
    }
    const draft = drafts.get(index);
    orderScreen(run, ui, {
      draft, awakened,
      onBack: () => route({ browseMap: true }),
      onEnter(partyIds) {
        const result = command(Run.enterBattleDoor, { floor: draft.floor, index: draft.doorIndex, partyIds });
        mapEntry = result.ok;
        if (result.ok) {
          if (run.dungeonId === 'dawn_forest' && run.floor === 3) host.tutorial?.mark('formation', { entryDoor: null });
          receipt = '';
        }
        return result;
      }
    });
    awakened = [];
    if (run.dungeonId === 'dawn_forest' && run.floor === 3) {
      host.tutorial?.mark('door', { entryDoor: { runId: run.id, index } });
      host.tutorial?.sync(run);
    }
  }
  const ui = {
    core, roster, widgets, audio, sheets, icon, scene, artifacts, command, leave, route, enterDoor,
    previewDoor,
    companion: (id, blessing) => details.charSheet(run, id, { blessing }),
    showAwakened(ids) { awakened = ids ?? []; },
    playMusic: () => host.runtime.music?.play(run.dungeonId)
  };

  function battleDecision(node, result, next, open = false) {
    const gained = run.lastBattleRelics ?? result.rewardDelta.relicIds;
    const equipped = new Set(gained.filter(id => run.relics.includes(id)));
    const decision = document.createElement('div');
    decision.className = 'victory-decision';
    function render() {
      node.innerHTML = [...equipped].map(id => treasureReceipt(artifacts.get(id))).join('');
      node.append(decision);
      next.hidden = true;
      const options = { node: decision, inline: true, onEquipped, onRelic: onEquipped };
      const rewardUi = { ...ui, leave: leaveDecision };
      if (run.pending?.kind === 'reinforcement') reinforceScreen(run, rewardUi, options);
      else if (run.pending?.kind === 'gate') gatePickScreen(run, rewardUi, options);
      else if (run.pending?.kind === 'relic') treasureScreen(run, rewardUi, run.pending.id, options);
      else {
        decision.remove();
        next.textContent = (run.floor + 1) + '층으로';
        next.hidden = false;
      }
    }
    function leaveDecision() {
      const left = command(Run.leaveRoom);
      if (!left.ok) return;
      if (left.left) {
        if (run.phase !== 'done') command(Run.nextFloor);
        route();
      } else render();
    }
    function onEquipped(id) {
      if (run.relics.includes(id)) {
        for (const previous of equipped) if (!run.relics.includes(previous)) equipped.delete(previous);
        equipped.add(id);
        run.lastBattleRelic = id;
        run.lastBattleRelics = [...equipped];
        host.save(run);
      }
      render();
    }
    if (open) render();
    else node.innerHTML = [...equipped].map(id => treasureReceipt(artifacts.get(id))).join('');
  }

  function afterBattle() {
    if (run.result) {
      if (run.phase !== 'done' && !command(Run.leaveRoom).left) return;
      if (run.daily) return host.finish(run);
      const rewards = Run.runRewards(run);
      host.finish(run);
      // The observatory owns the return transaction and the no-choice confirmation.
      if (!rewards.recruitable.length && !rewards.shardCandidates.length) {
        $('#recruit.on #meta-recruit-confirm')?.click();
      }
      return;
    }
    if (run.awaitingRetryResult) {
      delete run.awaitingRetryResult;
      host.save(run);
      return route();
    }
    if (run.room.type === 'borrowed' && run.phase === 'reward') return wakeSurvivors();
    leave();
  }

  function route({ browseMap = false } = {}) {
    try {
      return renderRoute(browseMap);
    } finally {
      host.tutorial?.sync(run);
    }
  }

  function renderRoute(browseMap) {
    if (run.phase === 'done') return host.finish(run);
    if (run.pending?.kind === 'start') return awakenScreen(run, ui);
    if (run.room?.status === 'left') {
      if (command(Run.nextFloor).ok) route();
      return;
    }
    if (run.phase === 'map') {
      if (run.doors[0]?.type === 'borrowed' || run.doors[0]?.type === 'awakening') return enterDoor(0);
      const door = host.profile?.().ui?.entryDoor;
      if (!browseMap && run.floor === 3 && door?.runId === run.id && run.doors[door.index]?.enemies.length) {
        return previewDoor(door.index);
      }
      if (!browseMap && run.doors.length === 1 && run.doors[0].enemies.length) return previewDoor(0);
      mapScreen(run, ui, { receipt });
      receipt = '';
      return;
    }
    if (run.room?.status === 'order') {
      if (run.room.type === 'borrowed' && command(Run.confirmOrder, INTRO.party).ok) return route();
      if (run.awaitingRetryResult) return battle.restoreResult(run, afterBattle, battleDecision);
      return orderScreen(run, ui);
    }
    if (run.room?.status === 'battle') {
      const options = Run.battleOptions(run);
      const fromMap = mapEntry;
      mapEntry = false;
      return battle.startBattle(run, options, (summary, log) => {
        const result = Run.settleBattle(run, summary);
        if (result.ok) {
          run.lastBattleLog = appendSettlement(log, result);
          // Keep the settled room resumable until the player confirms the final result.
          // leaveRoom moves a settled run with a final outcome to done.
          if (run.phase === 'done') run.phase = 'reward';
          if (result.retry) run.awaitingRetryResult = true;
          run.lastBattleRelic = result.relic?.equipped ? result.relic.id : null;
          run.lastBattleRelics = Array.isArray(result.relics) ? result.relics : null;
          host.save(run);
        }
        return result;
      }, afterBattle, {
        fromMap, decision: battleDecision,
        simpleOpening: (host.profile?.()?.ui?.entry?.legacy === false || host.profile?.()?.ui?.tutorialReplay) &&
          run.floor === 1 && run.room.type === 'borrowed',
        onAction: (action, events) => host.tutorial?.accepted(run, action, events),
        onReady: state => host.tutorial?.battleReady(run, state),
        replay: run.room.type === 'borrowed' ? host.tutorial?.battleActions(run) : undefined
      });
    }
    if (run.phase === 'reward') return battle.restoreResult(run, afterBattle, battleDecision);
    if (run.pending?.kind === 'relic') return treasureScreen(run, ui, run.pending.id);
    if (run.pending?.kind === 'altar' || run.room?.type === 'altar') return altarScreen(run, ui);
    if (run.room?.type === 'spring') return springScreen(run, ui);
    if (run.room?.type === 'event') {
      if (run.room.status === 'resolved' && run.relics.includes(run.room.relic)) {
        return treasureScreen(run, ui, run.room.relic, { equipped: true });
      }
      return eventScreen(run, ui);
    }
    if (run.room?.type === 'treasure') {
      if (run.room.status === 'resolved' && run.relics.includes(run.room.relic)) {
        return leave(artifacts.get(run.room.relic)?.name);
      }
      return treasureScreen(run, ui, run.room.relic, { equipped: run.relics.includes(run.room.relic) });
    }
    if (run.room?.type === 'awakening') return awakenScreen(run, ui);
  }

  route();
  return battle.review;
}
