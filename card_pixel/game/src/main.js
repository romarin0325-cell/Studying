import { scheduleTimer } from './engine/bridge.js';
import { create as createRoster } from './engine/roster.js';
import { createStage } from './stage/stage.js';
import { createAudio } from './stage/audio.js';
import { $ } from './ui/dom.js';
import { createSheet } from './ui/sheet.js';
import { createSettings } from './ui/settings.js';
import { createWidgets } from './ui/widgets.js';
import { createDetails } from './ui/battle/sheets.js';
import { createNavigation, mountPage } from './ui/nav.js';

const { RelayCore: core, RELAY_ASSETS: assets } = window;
window.__relayCoreTimer = scheduleTimer;
const roster = createRoster(core, assets);
const stage = createStage(assets);
const audio = createAudio(stage.clock);
const widgets = createWidgets(assets, roster.card);

mountPage(widgets);
const sheets = createSheet(stage);
const details = createDetails(core, widgets, sheets.openSheet);
const settings = createSettings(stage, audio, sheets, id => navigation.charSheet(id));
const navigation = createNavigation({ core, roster, widgets, stage, audio, sheets, details });

settings.loadSettings();
settings.syncFullscreen();
stage.init($('#cv'), $('#fx'));
window.addEventListener('resize', navigation.layout);
$('#b-start').addEventListener('click', () => {
  audio.unlockAudio();
  audio.sfx.awaken();
  navigation.startRun();
});
stage.loadSprites().then(() => {
  navigation.layout();
  stage.start();
});

window.__slice = window.__game = {
  ...navigation.review,
  get run() { return navigation.run; },
  get busy() { return navigation.review.B.busy; },
  charSheet: navigation.charSheet,
  settingsSheet: settings.settingsSheet,
  closeSheet: sheets.closeSheet
};
