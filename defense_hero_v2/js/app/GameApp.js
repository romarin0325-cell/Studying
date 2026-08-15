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

export class GameApp {
  constructor({ documentRef = globalThis.document, repository = null } = {}) {
    this.document = documentRef;
    this.sceneRoot = this.document.querySelector('#scene-root');
    this.overlayRoot = this.document.querySelector('#overlay-root');
    if (!this.sceneRoot || !this.overlayRoot) throw new Error('Hero Defense V2 app roots are missing');
    this.repository = repository ?? new SaveRepositoryV2();
    this.settings = this.repository.loadSettings();
    this.assetManager = new AssetManager({ manifest: ASSET_MANIFEST });
    this.selectedStageId = 'ancient_ruins';
    this.formation = { mainId: DEFAULT_FORMATION.mainId, heroIds: [...DEFAULT_FORMATION.heroIds] };
    this.scene = new SceneController(this.sceneRoot, {
      stages: StageSelectScreen,
      formation: FormationScreen,
      battle: BattleScreen,
      result: ResultScreen,
    });
    this.destroyed = false;
  }

  start() {
    this.#updateStorageWarning();
    this.assetManager.preload('menu').catch((error) => console.warn('V2 menu asset preload failed', error));
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

  showStages() {
    const checkpoint = this.repository.loadCheckpoint();
    this.scene.show('stages', {
      checkpoint,
      onFormation: (stageId) => this.showFormation(stageId),
      onContinue: () => checkpoint && this.showBattle({ checkpoint }),
      onSettings: () => this.openSettings(),
    });
  }

  showFormation(stageId = this.selectedStageId) {
    this.selectedStageId = stageId;
    this.assetManager.preload('formation').catch((error) => console.warn('V2 formation asset preload failed', error));
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
    this.assetManager.preload(battleAssetIds).catch((error) => console.warn('V2 battle asset preload failed', error));
    this.scene.show('battle', {
      stageId: this.selectedStageId,
      formation: this.formation,
      checkpoint,
      repository: this.repository,
      assetManager: this.assetManager,
      settings: this.settings,
      onSettings: () => this.openSettings(),
      onBack: () => this.showStages(),
      onResult: ({ result }) => {
        this.repository.clearCheckpoint();
        this.showResult(result);
      },
    });
  }

  showResult(result) {
    const stageName = STAGE_BY_ID[this.selectedStageId]?.name ?? this.selectedStageId;
    this.scene.show('result', {
      result,
      stageName,
      onRetry: () => this.showBattle({ stageId: this.selectedStageId, formation: this.formation }),
      onFormation: () => this.showFormation(this.selectedStageId),
      onStages: () => this.showStages(),
    });
  }

  openSettings() {
    const backdrop = this.document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.settingsModal = '';
    backdrop.innerHTML = `<section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="modal-heading"><div><span class="eyebrow">환경 설정</span><h2 id="settings-title">꿈의 전장 설정</h2></div><button class="icon-button" type="button" data-action="close-settings" aria-label="닫기">×</button></div>
      <div class="setting-list">
        ${this.#settingToggle('sound', '사운드')}
        ${this.#settingToggle('damageNumbers', '대미지 숫자')}
        ${this.#settingToggle('screenShake', '화면 흔들림')}
        ${this.#settingToggle('reducedEffects', '이펙트 간소화')}
      </div>
    </section>`;
    const close = () => backdrop.remove();
    backdrop.querySelector('[data-action="close-settings"]').addEventListener('click', close);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    for (const input of backdrop.querySelectorAll('input[data-setting]')) {
      input.addEventListener('change', () => {
        this.settings = this.repository.saveSettings({ ...this.settings, [input.dataset.setting]: input.checked });
        this.scene.current?.updateSettings?.(this.settings);
      });
    }
    this.overlayRoot.replaceChildren(backdrop);
  }

  getDebugState() {
    return {
      scene: this.scene.currentName,
      persistentStorage: this.repository.isPersistent,
      selectedStageId: this.selectedStageId,
      formation: { mainId: this.formation.mainId, heroIds: [...this.formation.heroIds] },
      settings: { ...this.settings },
      battle: this.scene.current?.getDebugState?.() ?? null,
    };
  }

  destroy() {
    this.destroyed = true;
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
