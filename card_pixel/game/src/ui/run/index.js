import * as Run from '../../engine/run.js';
import { create as createRoster } from '../../engine/roster.js';
import { INTRO } from '../../content/intro.js';
import { createStage } from '../../stage/stage.js';
import { createAudio } from '../../stage/audio.js';
import { $, esc, show } from '../dom.js';
import { createSheet, sheetMarkup } from '../sheet.js';
import { createWidgets } from '../widgets.js';
import { createDetails } from '../battle/sheets.js';
import { battleMarkup, createBattleView } from '../battle/view.js';
import { awakenScreen } from '../screens/awaken.js';
import { mapScreen } from '../screens/map.js';
import { orderScreen } from '../screens/order.js';
import { springScreen } from '../screens/spring.js';
import { altarScreen } from '../screens/altar.js';
import { eventScreen } from '../screens/event.js';
import { treasureScreen } from '../screens/treasure.js';
import { gatePickScreen } from '../screens/gate-pick.js';

const screens = ['awaken', 'map', 'order', 'spring', 'altar', 'event', 'treasure', 'pick'];
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
  const battle = createBattleView({ core, roster, widgets, stage, audio, sheets, details });
  const canvas = $('#cv');
  stage.init(canvas, $('#fx'));
  stage.loadSprites();
  stage.start();
  window.addEventListener('resize', () => {
    if ($('#battle')?.classList.contains('on')) battle.layout();
  });
  for (const id of screens) {
    $('#' + id).addEventListener('click', event => {
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
  return { frame, core, roster, widgets, audio, sheets, battle };
}

export function enterRun(run, host) {
  if (run.phase === 'done') return host.finish(run);
  const frame = $('#frame') || $('#app');
  if (!runtime || runtime.frame !== frame || !$('#battle')) runtime = mount(frame, host.runtime);
  const { core, roster, widgets, audio, sheets, battle } = runtime;
  battle.attach(run);
  const { sfx } = audio;
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
    if (result.ok) host.save(run);
    return result;
  }
  function leave() {
    const result = command(Run.leaveRoom);
    if (!result.ok) return;
    if (result.left && run.phase !== 'done') command(Run.nextFloor);
    route();
  }
  function enterDoor(index) {
    audio.unlockAudio();
    sfx.tap();
    if (command(Run.chooseDoor, index).ok) route();
  }
  function wakeSurvivors() {
    if (!command(Run.leaveRoom).ok || !command(Run.nextFloor).ok) return;
    enterDoor(0);
  }
  const ui = {
    core, roster, widgets, audio, sheets, icon, scene, artifacts, command, leave, route, enterDoor
  };

  function afterBattle() {
    if (run.room.type === 'borrowed' && run.phase === 'reward') return wakeSurvivors();
    leave();
  }

  function route() {
    if (run.phase === 'done') return host.finish(run);
    if (run.pending?.kind === 'start') return awakenScreen(run, ui);
    if (run.pending?.kind === 'gate') return gatePickScreen(run, ui);
    if (run.pending?.kind === 'relic') return treasureScreen(run, ui, run.pending.id);
    if (run.room?.status === 'left') {
      if (command(Run.nextFloor).ok) route();
      return;
    }
    if (run.phase === 'map') {
      if (run.doors[0]?.type === 'borrowed' || run.doors[0]?.type === 'awakening') return enterDoor(0);
      return mapScreen(run, ui);
    }
    if (run.room?.status === 'order') {
      if (run.room.type === 'borrowed' && command(Run.confirmOrder, INTRO.party).ok) return route();
      return orderScreen(run, ui);
    }
    if (run.room?.status === 'battle') {
      const options = Run.battleOptions(run);
      return battle.startBattle(run, options, summary => {
        const result = command(Run.settleBattle, summary);
        if (result.ok) {
          if (run.phase === 'done' || result.retry || run.pending) {
            route();
            return null;
          }
          if (result.relic?.equipped) {
            treasureScreen(run, ui, result.relic.id, { equipped: true });
            return null;
          }
        }
        return result;
      }, afterBattle);
    }
    if (run.phase === 'reward') {
      if (run.room.type === 'borrowed') return battle.restoreResult(run, afterBattle);
      if (['elite', 'gate'].includes(run.room.type) && run.relics.includes(run.room.relic)) {
        return treasureScreen(run, ui, run.room.relic, { equipped: true });
      }
      return battle.restoreResult(run, leave);
    }
    if (run.pending?.kind === 'altar' || run.room?.type === 'altar') return altarScreen(run, ui);
    if (run.room?.type === 'spring') return springScreen(run, ui);
    if (run.room?.type === 'event') {
      if (run.room.status === 'resolved' && run.relics.includes(run.room.relic)) {
        return treasureScreen(run, ui, run.room.relic, { equipped: true });
      }
      return eventScreen(run, ui);
    }
    if (run.room?.type === 'treasure') {
      return treasureScreen(run, ui, run.room.relic, { equipped: run.relics.includes(run.room.relic) });
    }
    if (run.room?.type === 'awakening') return awakenScreen(run, ui);
  }

  route();
  return battle.review;
}
