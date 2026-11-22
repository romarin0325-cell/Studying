import { scheduleTimer } from './engine/bridge.js';
import { create as createRoster } from './engine/roster.js';
import { createSaveStore } from './engine/save.js';
import * as DailyStore from './engine/daily-store.js';
import * as Run from './engine/run.js';
import { createMusic } from './audio/music.js';
import { createStage } from './stage/stage.js';
import { createAudio } from './stage/audio.js';
import { $ } from './ui/dom.js';
import { createNavigation, mountPage } from './ui/nav.js';
import { createSettings } from './ui/settings.js';
import { createSheet } from './ui/sheet.js';
import { storage } from './ui/storage.js';
import { createWidgets } from './ui/widgets.js';

const { RelayCore: core, RELAY_ASSETS: assets } = window;
window.__relayCoreTimer = scheduleTimer;
const roster = createRoster(core, assets);
const stage = createStage(assets);
const audio = createAudio(stage.clock);
const widgets = createWidgets(assets, roster.card);
const store = createSaveStore(storage, { core, roster });
const dailyStore = DailyStore.create?.(storage, { core, roster });

let musicContext;
let musicPlayer;
let musicRequest;
let musicEnabled = true;
const music = {
  get enabled() { return musicEnabled; },
  setEnabled(enabled) {
    musicEnabled = enabled;
    musicPlayer?.setEnabled(enabled);
  },
  play(trackId, dungeonId) {
    musicRequest = () => musicPlayer?.play(trackId, dungeonId);
    musicRequest();
  },
  playOutcome(trackId, battleKey) {
    musicRequest = null;
    return musicPlayer?.playOutcome(trackId, battleKey) ?? 'unavailable';
  },
  holdReward(dungeonId) {
    musicRequest = () => musicPlayer?.holdReward(dungeonId);
    musicRequest();
  }
};

const unlockEffects = audio.unlockAudio;
audio.unlockAudio = function unlockAudio({ skipPendingMusic = false } = {}) {
  unlockEffects();
  if (document.hidden || navigator.userActivation?.hasBeenActive === false) return;
  if (!musicContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      musicContext = new AudioContext();
    } catch { return; }
    musicPlayer = createMusic({ context: musicContext, destination: musicContext.destination });
    musicPlayer.setEnabled(musicEnabled);
    if (!skipPendingMusic) musicRequest?.();
  }
  if (musicContext.state !== 'running') musicContext.resume().catch(() => {});
};

document.addEventListener('visibilitychange', () => {
  if (!musicContext) return;
  const change = document.hidden ? musicContext.suspend() : musicContext.resume();
  change.catch(() => {});
});

mountPage();
const sheets = createSheet(stage);
const navigation = createNavigation({ core, roster, widgets, stage, audio, music, sheets, store, dailyStore });
const settings = createSettings(stage, audio, music, sheets, navigation.resetData, {
  available: () => !navigation.run && !!$('#title.on, #hub.on'),
  start: navigation.replayTutorial
});

settings.loadSettings();
settings.syncFullscreen();
$('#frame').addEventListener('click', event => {
  const button = event.target.closest('.meta-screen button, .meta-sheet button, #b-sheetclose');
  if (button && !button.disabled && !button.matches('.b-set, .b-full')) {
    audio.unlockAudio({ skipPendingMusic: button.id === 'b-start' });
    audio.sfx.tap();
  }
}, true);
$('#b-sheetclose').addEventListener('click', navigation.closePreparation);
$('#sheet').addEventListener('click', event => {
  if (event.target.id === 'sheet') navigation.closePreparation();
});

window.__slice = window.__game = {
  R: Run,
  roster,
  advance: seconds => navigation.review?.advance(seconds) ?? Promise.resolve(0),
  state: () => navigation.review?.state() || null,
  report: () => navigation.review?.report() || null,
  settle: seconds => navigation.review?.settle(seconds),
  get run() { return navigation.run; },
  get B() { return navigation.review?.B || { bridge: null, log: [] }; },
  get busy() { return !!navigation.review?.B?.busy; },
  get clock() { return navigation.review?.clock || stage.clock; },
  get errors() { return navigation.review?.errors || []; },
  get brief() { return navigation.review?.brief; },
  get foeSheet() { return navigation.review?.foeSheet; },
  get allySheet() { return navigation.review?.allySheet; },
  get fieldSheet() { return navigation.review?.fieldSheet; },
  charSheet: navigation.inspect,
  settingsSheet: settings.settingsSheet,
  closeSheet() {
    sheets.closeSheet();
    navigation.closePreparation();
  }
};

navigation.boot();
