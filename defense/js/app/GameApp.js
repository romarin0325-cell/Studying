import { AssetManager } from '../render/AssetManager.js';
import { ASSET_MANIFEST, DIRECTIONS } from '../content/assets.js';
import { DEFAULT_FORMATION } from '../content/heroes.js';
import { STAGE_BY_ID } from '../content/stages.js';
import { SaveRepositoryV2 } from '../persistence/SaveRepositoryV2.js';
import { SceneController } from './SceneController.js';
import { StageSelectScreen } from './screens/StageSelectScreen.js';
import { FormationScreen } from './screens/FormationScreen.js';
import { BattleScreen } from './screens/BattleScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';
import { JOURNEYS } from '../content/presentation.js';
import { bindFullscreen } from './Fullscreen.js';
import { openFieldGuide } from './FieldGuide.js';
import { SoundDirector } from '../audio/SoundDirector.js';
import { heroIllustrationId } from '../render/Illustrations.js';

export class GameApp {
  constructor({ documentRef = globalThis.document, repository = null } = {}) {
    this.document = documentRef;
    this.sceneRoot = this.document.querySelector('#scene-root');
    this.overlayRoot = this.document.querySelector('#overlay-root');
    if (!this.sceneRoot || !this.overlayRoot) throw new Error('Hero Defense V2 app roots are missing');
    this.repository = repository ?? new SaveRepositoryV2();
    this.settings = this.repository.loadSettings();
    this.audio = new SoundDirector(); this.audio.setSettings(this.settings);
    this.audioGesture = () => { this.audio.unlock(); this.audio.event({ type: 'select' }); };
    this.audioVisibility = () => { if (this.document.hidden) this.audio.suspend(); else if (this.audio.context) this.audio.unlock(); };
    this.document.addEventListener('pointerdown', this.audioGesture, { passive: true });
    this.document.addEventListener('visibilitychange', this.audioVisibility);
    this.assetManager = new AssetManager({ manifest: ASSET_MANIFEST });
    this.selectedStageId = 'ancient_ruins';
    this.difficultyId = 'easy';
    this.formation = { mainId: DEFAULT_FORMATION.mainId, heroIds: [...DEFAULT_FORMATION.heroIds] };
    this.scene = new SceneController(this.sceneRoot, {
      stages: StageSelectScreen,
      formation: FormationScreen,
      battle: BattleScreen,
      result: ResultScreen,
    });
    this.destroyed = false;
    this.mediaFailures = new Set();
  }

  start() {
    this.#updateStorageWarning();
    this.preloadArt('menu');
    this.showStages();
    globalThis.__heroDefenseV2Debug = {
      getState: () => this.getDebugState(),
      showStages: () => this.showStages(),
      startDefaultBattle: (stageId = 'ancient_ruins') => {
        this.selectedStageId = stageId;
        this.showBattle({ stageId, formation: this.formation });
        return this.getDebugState();
      },
      autoPlace: () => this.scene.current?.debugAutoPlace?.(),
      startWave: () => this.scene.current?.debugStartWave?.(),
      stepTicks: (count = 1) => this.scene.current?.debugStepTicks?.(count),
    };
    return this;
  }

  async preloadArt(selection, fallbackIds = []) {
    const summary = await this.assetManager.preload(selection);
    for (const id of summary.failed) this.mediaFailures.add(id);
    if (summary.failed.length && fallbackIds.length) {
      const fallback = await this.assetManager.preload(fallbackIds);
      for (const id of fallback.failed) this.mediaFailures.add(id);
    }
    return summary;
  }

  showStages() {
    this.audio.setMode('menu');
    const checkpoint = this.repository.loadCheckpoint();
    this.scene.show('stages', {
      checkpoint,
      stageId: this.selectedStageId,
      difficultyId: this.difficultyId,
      progress: this.repository.loadProgress(),
      onFormation: (stageId, difficultyId) => this.showFormation(stageId, difficultyId),
      onContinue: () => checkpoint && this.showBattle({ checkpoint }),
      onSettings: () => this.openSettings(),
    });
  }

  showFormation(stageId = this.selectedStageId, difficultyId = this.difficultyId) {
    this.audio.setMode('menu');
    this.selectedStageId = stageId;
    this.difficultyId = difficultyId;
    this.preloadArt('formation');
    this.scene.show('formation', {
      stageId,
      initialFormation: this.formation,
      assetManager: this.assetManager,
      onBack: () => this.showStages(),
      onReady: (formation) => {
        this.formation = { mainId: formation.mainId, heroIds: [...formation.heroIds] };
        this.showBattle({ stageId, formation: this.formation });
      },
    });
  }

  showBattle({ stageId = this.selectedStageId, formation = this.formation, checkpoint = null } = {}) {
    this.selectedStageId = checkpoint?.stageId ?? stageId;
    this.difficultyId = checkpoint?.difficultyId ?? this.difficultyId;
    this.formation = checkpoint?.formation
      ? { mainId: checkpoint.formation.mainId, heroIds: [...checkpoint.formation.heroIds] }
      : { mainId: formation.mainId, heroIds: [...formation.heroIds] };
    const stage = STAGE_BY_ID[this.selectedStageId];
    const heroIds = [this.formation.mainId, ...this.formation.heroIds];
    const bossIds = [stage?.midBossId, stage?.finalBossId].filter(Boolean);
    const battleAssetIds = [
      ...heroIds.flatMap((id) => DIRECTIONS.map((direction) => `battle/${id}/${direction}`)),
      ...bossIds.flatMap((id) => DIRECTIONS.map((direction) => `boss/${id}/${direction}`)),
      ...heroIds.map((id) => `portrait/${id}`),
    ];
    const primaryIds = [...new Set(heroIds.map(heroIllustrationId)), 'illustration/combat-fx','illustration/creatures','illustration/worlds'];
    this.preloadArt(primaryIds, battleAssetIds);
    this.scene.show('battle', {
      stageId: this.selectedStageId,
      difficultyId: this.difficultyId,
      formation: this.formation,
      checkpoint,
      repository: this.repository,
      assetManager: this.assetManager,
      settings: this.settings,
      audio: this.audio,
      onSettings: () => this.openSettings(),
      onBack: () => this.showStages(),
      onResult: ({ result, snapshot }) => {
        this.repository.clearCheckpoint();
        result.stars = result.victory ? (snapshot.core.durability >= 10 ? 3 : snapshot.core.durability >= 6 ? 2 : 1) : 0;
        const previous = this.repository.loadProgress()[`${this.selectedStageId}:${this.difficultyId}`];
        result.firstClear = result.victory && !previous;
        result.newBest = result.victory && (!previous || result.stars > previous.stars || result.elapsedSeconds < previous.seconds);
        result.coreDurability = snapshot.core.durability;
        if (result.victory) this.repository.recordVictory(`${this.selectedStageId}:${this.difficultyId}`, result.stars, result.elapsedSeconds);
        this.showResult(result);
      },
    });
  }

  showResult(result) {
    this.audio.setMode('menu');
    if (result.victory) this.audio.event({ type: 'victory' });
    const stageName = JOURNEYS[this.selectedStageId]?.title ?? this.selectedStageId;
    this.scene.show('result', {
      result,
      stageName,
      stageId: this.selectedStageId,
      assetManager: this.assetManager,
      onNext: () => {
        const ids = Object.keys(JOURNEYS), next = ids[ids.indexOf(this.selectedStageId) + 1];
        if (next) this.showFormation(next); else this.showStages();
      },
      onRetry: () => this.showBattle({ stageId: this.selectedStageId, formation: this.formation }),
      onFormation: () => this.showFormation(this.selectedStageId),
      onStages: () => this.showStages(),
    });
  }

  openSettings() {
    const battle = this.scene.currentName === 'battle' ? this.scene.current : null;
    const resume = battle?.session?.state.phase === 'WAVE_RUNNING' && !battle.session.state.paused;
    if (resume) battle.session.applyNow('toggle_pause');
    const backdrop = this.document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.settingsModal = '';
    backdrop.innerHTML = `<section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="modal-heading"><div><span class="eyebrow">환경 설정</span><h2 id="settings-title">꿈의 전장 설정</h2></div><button class="icon-button" type="button" data-action="close-settings" aria-label="닫기">×</button></div>
      <div class="setting-list">
        <button class="setting-row text-button" data-action="fullscreen">⛶ 전체화면 전환</button>
        <button class="setting-row text-button" data-action="guide">상성표와 전투 도감 ↗</button>
        ${this.#settingToggle('sound', '사운드')}
        ${this.#settingToggle('music', '배경 음악')}
        ${this.#settingToggle('damageNumbers', '대미지 숫자')}
        ${this.#settingToggle('screenShake', '화면 흔들림')}
        ${this.#settingToggle('reducedEffects', '이펙트 간소화')}
      </div>
    </section>`;
    const unbindFullscreen = bindFullscreen(backdrop);
    backdrop.querySelector('[data-action="guide"]').onclick = () => openFieldGuide(backdrop);
    const close = () => { unbindFullscreen(); backdrop.remove(); if (resume && this.scene.current === battle && battle.session.state.paused) battle.session.applyNow('toggle_pause'); };
    backdrop.querySelector('[data-action="close-settings"]').addEventListener('click', close);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    for (const input of backdrop.querySelectorAll('input[data-setting]')) {
      input.addEventListener('change', () => {
        this.settings = this.repository.saveSettings({ ...this.settings, [input.dataset.setting]: input.checked });
        this.audio.setSettings(this.settings);
        if (this.settings.sound) this.audio.unlock();
        this.scene.current?.updateSettings?.(this.settings);
      });
    }
    this.overlayRoot.replaceChildren(backdrop);
  }

  getDebugState() {
    return {
      scene: this.scene.currentName,
      mediaFailures: [...this.mediaFailures],
      persistentStorage: this.repository.isPersistent,
      selectedStageId: this.selectedStageId,
      formation: { mainId: this.formation.mainId, heroIds: [...this.formation.heroIds] },
      settings: { ...this.settings },
      battle: this.scene.current?.getDebugState?.() ?? null,
    };
  }

  destroy() {
    this.destroyed = true;
    this.audio.destroy();
    this.document.removeEventListener('pointerdown', this.audioGesture);
    this.document.removeEventListener('visibilitychange', this.audioVisibility);
    this.scene.destroy();
    this.overlayRoot.replaceChildren();
    delete globalThis.__heroDefenseV2Debug;
  }

  #settingToggle(key, label) {
    return `<label class="setting-row"><span>${label}</span><input type="checkbox" data-setting="${key}" ${this.settings[key] ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
  }

  #updateStorageWarning() {
    const warning = this.document.querySelector('[data-storage-warning]');
    if (!warning) return;
    warning.hidden = this.repository.isPersistent;
  }
}

export default GameApp;
