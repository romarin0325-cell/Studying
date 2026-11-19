import { $ } from './dom.js';
import { tools } from './settings.js';
import { sheetMarkup } from './sheet.js';
import { battleMarkup, createBattleView } from './battle/view.js';
import { awakenScreen } from './screens/awaken.js';
import { mapScreen } from './screens/map.js';
import { orderScreen } from './screens/order.js';
import { springScreen } from './screens/spring.js';
import { altarScreen } from './screens/altar.js';
import { pickScreen } from './screens/gate-pick.js';
import { endScreen } from './screens/end.js';
import * as R from '../engine/run.js';

export function mountPage({ spr, sprite }) {
  const titleLine = ['luna', 'ash', 'red_dragon'].filter(id => spr(id));
  document.getElementById('app').innerHTML =
    '<div id="frame">' +
    '<section id="title" class="screen on"><div class="corner">' + tools() + '</div><div class="logo">다음은 너<small>RELAYMARE · 가제</small></div>' +
    '<div class="line">' + titleLine.map(id => sprite(id)).join('<i>▶</i>') + '</div>' +
    '<p class="pitch">쓰러진 동료가 다음 동료의 힘이 된다.</p>' +
    '<button class="btn go" id="b-start">꿈길로 들어간다</button>' +
    '<p class="sm">도트 릴레이 시험판 · 일곱 층 · 약 10분<br>전투 수치는 카드 게임의 규칙 파일로 계산한다.</p></section>' +
    '<section id="awaken" class="screen"></section><section id="map" class="screen"></section><section id="order" class="screen"></section>' +
    '<section id="spring" class="screen"></section><section id="altar" class="screen"></section><section id="pick" class="screen"></section><section id="end" class="screen"></section>' +
    battleMarkup() + sheetMarkup() + '</div>';
}

export function createNavigation({ core, roster, widgets, stage, audio, sheets, details }) {
  const { sfx } = audio;
  const params = new URLSearchParams(location.search);
  let run = null;
  const battle = createBattleView({
    core, roster, widgets, stage, audio, sheets, details, toMap,
    onEnd: showEnd,
    onGatePick: choices => pickScreen(run, choices, widgets, sfx, toMap)
  });

  function startRun() {
    const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
    run = R.newRun(core, roster, seed, {});
    battle.reset(run);
    awakenScreen(run, roster, widgets, sfx, toMap);
  }

  function toMap(advance) {
    if (advance) R.nextFloor(run, roster);
    if (run.floor > R.FLOORS || run.result) return showEnd();
    mapScreen(run, roster, widgets, audio, enterDoor);
  }

  function showEnd(wiped) {
    endScreen(run, wiped, widgets, audio, startRun);
  }

  function enterDoor(door) {
    run.door = door;
    if (door.type === 'spring') return springScreen(run, roster, widgets, sfx, toMap);
    if (door.type === 'altar') return altarScreen(run, roster, widgets, sfx, toMap);
    orderScreen(run, core, widgets, audio, toMap, order => battle.startBattle(run, order));
  }

  return {
    startRun,
    layout: battle.layout,
    review: battle.review,
    get run() { return run; },
    charSheet: id => details.charSheet(run, id)
  };
}
