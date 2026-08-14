import * as Data from "../data/content.js";
import { GameLoop } from "../core/GameLoop.js";
import { SeededRng } from "../core/SeededRng.js";
import {
  FutureSchemaVersionError,
  MemoryStorage,
  SaveRepository,
} from "../state/SaveRepository.js";
import { buildStagePlan } from "../battle/StageBuilder.js";
import { BattleEngine } from "../battle/BattleEngine.js";
import { BattleRenderer } from "../render/BattleRenderer.js";
import { AssetManager } from "../render/AssetManager.js";
import { SceneRouter } from "./SceneRouter.js";
import { RunController } from "./RunController.js";
import {
  clone,
  elementPill,
  escapeHtml,
  formatTime,
  hashSeed,
  iconFor,
  threatPill,
} from "../ui/viewHelpers.js";

const content = Object.freeze({
  elements: Data.ELEMENT_DEFINITIONS ?? Data.ELEMENTS ?? [],
  characters: Data.CHARACTER_DEFINITIONS ?? Data.CHARACTERS ?? [],
  enemies: Data.ENEMY_TYPE_DEFINITIONS ?? Data.ENEMIES ?? [],
  bosses: Data.BOSS_DEFINITIONS ?? Data.BOSSES ?? [],
  statuses: Data.STATUS_DEFINITIONS ?? Data.STATUSES ?? [],
  fieldBuffs: Data.FIELD_BUFF_DEFINITIONS ?? Data.FIELD_BUFFS ?? [],
  difficulties: Data.DIFFICULTY_DEFINITIONS ?? Data.DIFFICULTIES ?? [],
  doctrines: Data.DOCTRINE_DEFINITIONS ?? Data.DOCTRINES ?? [],
  relics: Data.RELIC_DEFINITIONS ?? Data.RELICS ?? [],
  mutators: Data.MUTATOR_DEFINITIONS ?? Data.MUTATORS ?? [],
  blessings: Data.STARTING_BLESSING_DEFINITIONS ?? Data.STARTING_BLESSINGS ?? [],
  challenges: Data.FIXED_CHALLENGE_DEFINITIONS ?? Data.FIXED_CHALLENGES ?? [],
  wavePackages: Data.WAVE_PACKAGE_DEFINITIONS ?? Data.WAVE_PACKAGES ?? [],
  maps: Data.MAP_LAYOUT_DEFINITIONS ?? Data.MAP_LAYOUTS ?? [],
  specialTiles: Data.SPECIAL_TILE_DEFINITIONS ?? Data.SPECIAL_TILES ?? [],
});

const SCREEN_KICKERS = Object.freeze({
  title: "별빛 원정대",
  hub: "작전 허브",
  deck: "원정 편성",
  setup: "난도와 시드",
  map: "원정 지도",
  preview: "위협 미리보기",
  battle: "코어 방어 작전",
  growth: "성장 조각",
  reward: "전술 보상",
  result: "원정 기록",
  challenges: "고정 도전",
  training: "훈련장",
  compendium: "캐릭터 도감",
  records: "작전 기록",
  settings: "환경 설정",
});

const ROLE_NAMES = Object.freeze({
  buffer: "버퍼",
  balancer: "밸런서",
  dealer: "딜러",
  aoe: "광역",
  controller: "제어",
  debuffer: "디버퍼",
});

const DEFAULT_DECK = Object.freeze({
  leaderId: "rumi",
  companionIds: ["gray", "time_magician", "silver_rabbit", "guardian"],
});

function getById(collection, id) {
  return collection.find((item) => item.id === id);
}

function difficultyStartGold(definition) {
  return definition?.startingGold ?? definition?.startGold ?? 180;
}

function makeSeed() {
  const now = Date.now().toString(36).toUpperCase();
  return `STAR-${now.slice(-7)}`;
}

export class GameApp {
  constructor({ root, modalRoot, toast, backButton, homeButton, sceneKicker }) {
    this.root = root;
    this.modalRoot = modalRoot;
    this.toastNode = toast;
    this.backButton = backButton;
    this.homeButton = homeButton;
    this.sceneKicker = sceneKicker;
    this.router = new SceneRouter((route, action) => this.#onRoute(route, action));
    this.repository = new SaveRepository({ storage: globalThis.localStorage });
    this.controller = new RunController({ repository: this.repository, SeededRng, content });
    this.assets = new AssetManager(Data.ASSET_MANIFEST ?? Data.ASSETS ?? []);
    this.assets.preload("menu");
    this.draftDeck = clone(DEFAULT_DECK);
    this.activeDeckSlot = null;
    this.setupState = {
      difficultyId: "scout",
      seed: makeSeed(),
      blessingId: content.blessings[0]?.id ?? null,
    };
    this.trainingState = {
      leaderId: "rumi",
      companionIds: [...DEFAULT_DECK.companionIds],
      enemyId: "normal",
      enemyElement: "fire",
      wavePackageId: content.wavePackages[0]?.id ?? null,
      elitePrefix: "",
      statusId: "",
      bossId: "",
      bossPhaseRatio: 1,
      elementRules: true,
      elementMultiplier: 1.2,
    };
    this.futureSaveError = null;
    this.currentStagePlan = null;
    this.battle = null;
    this.battleRenderer = null;
    this.battleLoop = null;
    this.battleSnapshot = null;
    this.battleUiLastAt = 0;
    this.battlePerf = { fps: 0, updateMs: 0, renderMs: 0, lastFrameAt: 0 };
    this.selectedBattleCharacterId = null;
    this.movingBattleUnit = false;
    this.aimingActive = false;
    this.preAimBattleSpeed = null;
    this.battlePressTimer = null;
    this.battlePressStart = null;
    this.battleLongPressConsumed = false;
    this.activeMode = "expedition";
    this.challengeContext = null;
    this.specialRun = null;
    this.toastTimer = null;
    this.historyReady = false;
  }

  async init() {
    this.#validateContent();
    try {
      this.controller.initialize();
    } catch (error) {
      if (!(error instanceof FutureSchemaVersionError)) throw error;
      this.futureSaveError = error;
      this.repository = new SaveRepository({ storage: new MemoryStorage() });
      this.controller = new RunController({ repository: this.repository, SeededRng, content });
      this.controller.initialize();
    }
    this.#bindGlobalEvents();
    this.router.reset("title");
  }

  getDebugState() {
    return {
      route: this.router.current,
      run: clone(this.controller.run),
      meta: clone(this.controller.meta),
      battle: this.battle?.getSnapshot?.() ?? null,
      stagePlan: clone(this.currentStagePlan),
    };
  }

  debugSetTimeScale(value) {
    const speed = Math.max(0, Math.min(20, Number(value) || 0));
    this.battle?.setSpeed?.(speed);
    return speed;
  }

  debugCompleteStage() {
    if (this.router.current?.name !== "battle") return false;
    const snapshot = this.battle?.getSnapshot?.() ?? this.battleSnapshot ?? {};
    this.#finishBattle(true, snapshot);
    return true;
  }

  debugFailStage() {
    if (this.router.current?.name !== "battle") return false;
    const snapshot = this.battle?.getSnapshot?.() ?? this.battleSnapshot ?? {};
    this.#finishBattle(false, snapshot);
    return true;
  }

  #validateContent() {
    const validator = Data.validateContent ?? Data.validateData;
    if (typeof validator !== "function") return;
    const result = validator();
    const errors = Array.isArray(result) ? result : result?.errors;
    if (errors?.length) throw new Error(`콘텐츠 데이터 검증 실패: ${errors.join(", ")}`);
  }

  #bindGlobalEvents() {
    this.backButton.addEventListener("click", () => this.#requestBack());
    this.homeButton.addEventListener("click", () => this.#requestHome());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden || !this.battle) return;
      this.battle.togglePause?.(true);
      if (this.activeMode === "expedition") this.controller.saveRun?.({ checkpoint: true });
      this.showToast("백그라운드 전환으로 전투를 일시정지하고 저장했습니다.");
    });
    window.addEventListener("popstate", () => {
      if (!this.historyReady) return;
      this.#requestBack({ fromHistory: true });
    });
  }

  #onRoute(route, action) {
    if (!route) return;
    this.#disposeBattleIfLeaving(route.name);
    document.body.classList.toggle("is-battle", route.name === "battle");
    this.backButton.classList.toggle("is-hidden", ["title", "hub", "map", "battle"].includes(route.name));
    this.homeButton.classList.toggle("is-hidden", ["title", "hub", "battle"].includes(route.name));
    this.sceneKicker.textContent = SCREEN_KICKERS[route.name] ?? "Hero Core Defense";
    if (action === "push" && this.historyReady) history.pushState({ heroDefense: true }, "");
    if (!this.historyReady) {
      history.replaceState({ heroDefense: true }, "");
      this.historyReady = true;
    }
    this.#render(route);
    window.scrollTo?.(0, 0);
    queueMicrotask(() => this.root.focus({ preventScroll: true }));
  }

  #render(route) {
    const renderer = {
      title: () => this.#renderTitle(),
      hub: () => this.#renderHub(),
      deck: () => this.#renderDeck(),
      setup: () => this.#renderSetup(),
      map: () => this.#renderMap(),
      preview: () => this.#renderPreview(route.params),
      battle: () => this.#renderBattle(route.params),
      growth: () => this.#renderGrowth(),
      reward: () => this.#renderReward(),
      result: () => this.#renderResult(),
      challenges: () => this.#renderChallenges(),
      training: () => this.#renderTraining(),
      compendium: () => this.#renderCompendium(),
      records: () => this.#renderRecords(),
      settings: () => this.#renderSettings(),
    }[route.name];
    if (!renderer) throw new Error(`알 수 없는 화면: ${route.name}`);
    renderer();
  }

  #requestBack({ fromHistory = false } = {}) {
    if (this.activeMode === "expedition" && this.controller.run && ["map", "preview", "battle", "growth", "reward", "result"].includes(this.router.current?.name)) {
      if (this.router.current.name === "battle") {
        this.battle?.togglePause?.(true);
        this.showModal({
          title: "전투를 중단할까요?",
          body: "현재 스테이지는 준비 상태로 저장되어 다음에 다시 시작할 수 있습니다.",
          confirmLabel: "허브로",
          danger: true,
          onConfirm: () => {
            this.controller.setPhase("deploy", { checkpoint: true });
            this.#disposeBattle();
            this.router.reset("hub");
          },
          onCancel: () => this.battle?.togglePause?.(false),
        });
        if (fromHistory) history.pushState({ heroDefense: true }, "");
        return;
      }
      this.controller.saveRun?.({ checkpoint: true });
      this.router.reset("hub");
      return;
    }
    if (this.router.current?.name === "battle") {
      this.battle?.togglePause?.(true);
      this.showModal({
        title: "전투를 중단할까요?",
        body: "현재 스테이지는 준비 상태로 저장되어 다음에 다시 시작할 수 있습니다.",
        confirmLabel: "허브로",
        danger: true,
        onConfirm: () => {
          if (this.activeMode === "expedition" && this.controller.run) this.controller.setPhase("deploy", { checkpoint: true });
          if (this.activeMode !== "expedition") this.specialRun = null;
          this.#disposeBattle();
          this.router.reset("hub");
        },
        onCancel: () => this.battle?.togglePause?.(false),
      });
      if (fromHistory) history.pushState({ heroDefense: true }, "");
      return;
    }
    if (!this.router.back()) this.router.reset("title");
  }

  #requestHome() {
    if (this.controller.run) {
      this.showModal({
        title: "원정은 안전하게 저장됩니다",
        body: "허브로 돌아가도 타이틀의 계속하기로 현재 단계에서 재개할 수 있습니다.",
        confirmLabel: "허브로",
        onConfirm: () => this.router.reset("hub"),
      });
      return;
    }
    this.router.reset("hub");
  }

  showToast(message) {
    clearTimeout(this.toastTimer);
    this.toastNode.textContent = message;
    this.toastNode.classList.add("is-visible");
    this.toastTimer = setTimeout(() => this.toastNode.classList.remove("is-visible"), 2600);
  }

  async #copySeed(seed) {
    try {
      await navigator.clipboard.writeText(seed);
      this.showToast("전체 시드를 복사했습니다.");
    } catch {
      this.showToast(`시드: ${seed}`);
    }
  }

  showModal({ title, body, confirmLabel = "확인", cancelLabel = "취소", danger = false, onConfirm, onCancel }) {
    this.modalRoot.classList.add("is-open");
    this.modalRoot.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <p class="eyebrow">COMMAND</p>
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        <div class="lede">${body}</div>
        <div class="inline-actions" style="justify-content:flex-end;margin-top:20px">
          ${onCancel ? `<button class="ghost-button" type="button" data-modal-cancel>${escapeHtml(cancelLabel)}</button>` : ""}
          <button class="${danger ? "danger-button" : "primary-button"}" type="button" data-modal-confirm>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    const close = () => {
      this.modalRoot.classList.remove("is-open");
      this.modalRoot.replaceChildren();
    };
    this.modalRoot.querySelector("[data-modal-confirm]").addEventListener("click", () => {
      close();
      onConfirm?.();
    });
    this.modalRoot.querySelector("[data-modal-cancel]")?.addEventListener("click", () => {
      close();
      onCancel?.();
    });
    this.modalRoot.querySelector("[data-modal-confirm]").focus();
  }

  #renderTitle() {
    const hasRun = Boolean(this.controller.run ?? this.repository.hasRun());
    const warning = this.futureSaveError
      ? `<div class="surface-card" style="margin:18px auto 0;max-width:520px;border-color:rgba(255,111,121,.5)">
          <strong>새 버전에서 생성된 저장</strong>
          <p class="muted" style="margin:6px 0 0">현재 앱은 이 저장을 덮어쓰지 않고 임시 세션으로 실행합니다.</p>
        </div>`
      : "";
    this.root.innerHTML = `
      <section class="scene title-scene">
        <div class="title-panel">
          <div class="title-emblem" aria-hidden="true">✦</div>
          <p class="eyebrow">ROGUELITE TACTICAL DEFENSE</p>
          <h1>영웅의 빛으로<br />코어를 지켜라</h1>
          <p class="lede">예고된 위협을 읽고, 다섯 영웅의 배치와 성장 분기로 여섯 전장을 돌파하세요.</p>
          <div class="title-actions">
            ${hasRun ? `<button class="primary-button" type="button" data-action="continue">계속하기</button>` : ""}
            <button class="${hasRun ? "secondary-button" : "primary-button"}" type="button" data-action="new-game">새 게임</button>
            <button class="ghost-button" type="button" data-action="settings">설정</button>
          </div>
          ${warning}
          <p class="version-label">VERTICAL SLICE v0.2 · SAVE SCHEMA 1</p>
        </div>
      </section>`;
    this.root.querySelector('[data-action="continue"]')?.addEventListener("click", () => this.#continueRun());
    this.root.querySelector('[data-action="new-game"]').addEventListener("click", () => this.router.push("hub"));
    this.root.querySelector('[data-action="settings"]').addEventListener("click", () => this.router.push("settings"));
  }

  #continueRun() {
    const run = this.controller.resumeRun();
    if (!run) {
      this.showToast("재개할 수 있는 원정 저장이 없습니다.");
      this.#renderTitle();
      return;
    }
    this.activeMode = "expedition";
    this.specialRun = null;
    this.challengeContext = null;
    const target = ["map", "preview", "deploy", "growth", "reward", "result"].includes(run.phase)
      ? run.phase
      : "map";
    if (target === "deploy" || target === "preview") {
      const nodeVariant = run.selectedNodeByStage?.[run.stageNumber] ?? run.selectedNode ?? 0;
      this.currentStagePlan = buildStagePlan({
        stageNumber: run.stageNumber,
        seed: run.seed,
        difficultyId: run.difficultyId,
        nodeVariant,
      });
      this.router.reset(target === "deploy" ? "preview" : target, { stagePlan: this.currentStagePlan });
      return;
    }
    this.router.reset(target);
  }

  #renderHub() {
    const run = this.controller.run;
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">OPERATIONS HUB</p>
          <h1>다음 작전을 선택하세요</h1>
          <p class="lede">고정된 영웅을 익히고, 공개된 문제에 맞춰 조합을 바꾸는 전술 허브입니다.</p>
        </div>
        ${run ? `<div class="surface-card" style="max-width:900px;margin:0 auto 14px">
          <div class="toolbar">
            <div><strong>진행 중인 원정</strong><div class="muted">${escapeHtml(run.seed)} · 스테이지 ${run.stageNumber}/6 · 코어 ${run.coreHp}</div></div>
            <button class="primary-button" type="button" data-hub="resume">원정 재개</button>
          </div>
        </div>` : ""}
        <div class="menu-grid">
          <button class="menu-card" type="button" data-hub="expedition" data-icon="✦"><strong>원정</strong><span>덱과 시드를 정하고 6스테이지 로그라이트 작전을 시작합니다.</span></button>
          <button class="menu-card" type="button" data-hub="challenges" data-icon="◇"><strong>고정 도전</strong><span>정해진 편성과 웨이브로 핵심 대응법을 시험합니다.</span></button>
          <button class="menu-card" type="button" data-hub="training" data-icon="◎"><strong>훈련장</strong><span>영웅·적 유형·속성·보스를 강제로 조합해 즉시 테스트합니다.</span></button>
          <button class="menu-card" type="button" data-hub="compendium" data-icon="♧"><strong>캐릭터</strong><span>4명의 주인공과 6명의 동료, 기술과 성장 분기를 확인합니다.</span></button>
          <button class="menu-card" type="button" data-hub="records" data-icon="▥"><strong>기록</strong><span>최고 점수, 최근 시드와 캐릭터별 클리어 기록을 확인합니다.</span></button>
          <button class="menu-card" type="button" data-hub="settings" data-icon="⚙"><strong>설정</strong><span>판독성과 접근성, 사운드와 디버그 오버레이를 조정합니다.</span></button>
        </div>
        <div class="inline-actions" style="justify-content:center;margin-top:18px">
          <button class="ghost-button" type="button" data-hub="title">타이틀로</button>
        </div>
      </section>`;
    this.root.querySelectorAll("[data-hub]").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.hub;
      if (action === "expedition") {
        if (this.controller.run) {
          this.showModal({
            title: "새 원정을 시작할까요?",
            body: "진행 중인 원정 저장은 삭제됩니다.",
            confirmLabel: "새 원정",
            cancelLabel: "취소",
            danger: true,
            onConfirm: () => {
              this.controller.abandonRun();
              this.draftDeck = clone(DEFAULT_DECK);
              this.router.push("deck");
            },
          });
        } else this.router.push("deck");
      } else if (action === "resume") this.#continueRun();
      else if (action === "title") this.router.reset("title");
      else this.router.push(action);
    }));
  }

  #renderDeck() {
    const unlocks = this.controller.meta.unlocks;
    const slots = [
      { id: "leader", kind: "leader", characterId: this.draftDeck.leaderId, label: "주인공" },
      ...this.draftDeck.companionIds.map((characterId, index) => ({ id: `companion-${index}`, kind: "companion", characterId, label: `동료 ${index + 1}` })),
    ];
    const selectedCharacters = new Set([this.draftDeck.leaderId, ...this.draftDeck.companionIds]);
    const selectedDefinitions = [...selectedCharacters].map((id) => getById(content.characters, id)).filter(Boolean);
    const warningTags = [];
    if (!selectedDefinitions.some((character) => character.attackTags?.includes("air"))) warningTags.push("공중 대응 부족");
    if (!selectedDefinitions.some((character) => character.attackTags?.some((tag) => ["splash", "chain", "pierce"].includes(tag)) || character.rolePrimary === "aoe")) warningTags.push("군집 대응 부족");
    if (!selectedDefinitions.some((character) => character.id === "cinderella" || character.damageTypes?.includes("magic"))) warningTags.push("중갑 대응 부족");
    const valid = Boolean(this.draftDeck.leaderId)
      && this.draftDeck.companionIds.length === 4
      && new Set(this.draftDeck.companionIds).size === 4;

    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">DECK ASSEMBLY</p>
          <h1>주인공 1명과 동료 4명</h1>
          <p class="lede">슬롯을 고른 뒤 캐릭터를 탭하세요. 위협 경고는 추천이며 시작을 막지 않습니다.</p>
        </div>
        <div class="surface-card">
          <div class="deck-slots">
            ${slots.map((slot) => {
              const character = getById(content.characters, slot.characterId);
              return `<button class="deck-slot ${character ? "is-filled" : ""} ${this.activeDeckSlot === slot.id ? "is-active" : ""}" type="button" data-slot="${slot.id}" data-kind="${slot.kind}">
                <small class="muted">${slot.label}</small>
                ${character ? `<strong>${escapeHtml(character.name)}</strong><div class="tag-row" style="margin-top:8px">${elementPill(character.element, content.elements)}<span class="tag">${ROLE_NAMES[character.rolePrimary] ?? character.rolePrimary}</span></div>` : `<strong>비어 있음</strong>`}
              </button>`;
            }).join("")}
          </div>
          <div class="toolbar">
            <div class="tag-row">
              ${warningTags.length ? warningTags.map((warning) => `<span class="status-pill" style="color:var(--gold)">! ${warning}</span>`).join("") : `<span class="status-pill" style="color:var(--green)">✓ 핵심 위협 대응 확보</span>`}
            </div>
            <span class="muted">속성 커버리지 ${new Set(selectedDefinitions.map(({ element }) => element)).size}/5</span>
          </div>
        </div>
        <div class="surface-card" style="margin-top:14px">
          <div class="toolbar"><h2 style="margin:0">로스터</h2><span class="muted">잠긴 영웅도 훈련장에서는 사용할 수 있습니다.</span></div>
          <div class="roster-grid">
            ${content.characters.map((character) => {
              const isUnlocked = (character.kind === "leader" ? unlocks.leaders : unlocks.companions).includes(character.id);
              const selected = selectedCharacters.has(character.id);
              return `<button class="roster-card ${selected ? "is-selected" : ""}" type="button" data-character="${character.id}" data-kind="${character.kind}" aria-disabled="${!isUnlocked}">
                <span class="roster-token">${escapeHtml(character.name[0])}</span>
                <strong>${escapeHtml(character.name)} ${isUnlocked ? "" : "🔒"}</strong>
                <small>${character.kind === "leader" ? "주인공" : `배치 ${character.cost}`} · ${ROLE_NAMES[character.rolePrimary] ?? character.rolePrimary}</small>
                <div class="tag-row" style="margin-top:9px">${elementPill(character.element, content.elements)}</div>
              </button>`;
            }).join("")}
          </div>
        </div>
        <div class="inline-actions" style="justify-content:flex-end;margin-top:16px">
          <button class="primary-button" type="button" data-action="deck-next" ${valid ? "" : "disabled"}>난도와 시드 선택</button>
        </div>
      </section>`;
    this.root.querySelectorAll("[data-slot]").forEach((button) => button.addEventListener("click", () => {
      this.activeDeckSlot = button.dataset.slot;
      this.#renderDeck();
    }));
    this.root.querySelectorAll("[data-character]").forEach((button) => button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") {
        this.showToast("이 캐릭터는 첫 원정 클리어 후 해금됩니다.");
        return;
      }
      const id = button.dataset.character;
      const kind = button.dataset.kind;
      if (kind === "leader") {
        if (this.activeDeckSlot && this.activeDeckSlot !== "leader") {
          this.showToast("주인공은 주인공 슬롯에만 편성할 수 있습니다.");
          return;
        }
        this.draftDeck.leaderId = id;
        this.activeDeckSlot = "leader";
      } else {
        if (this.draftDeck.companionIds.includes(id)) {
          this.showToast("같은 동료는 한 명만 편성할 수 있습니다.");
          return;
        }
        const requested = this.activeDeckSlot?.startsWith("companion-")
          ? Number(this.activeDeckSlot.split("-")[1])
          : this.draftDeck.companionIds.findIndex((entry) => !entry);
        const index = requested >= 0 ? requested : 0;
        this.draftDeck.companionIds[index] = id;
        this.activeDeckSlot = `companion-${Math.min(3, index + 1)}`;
      }
      this.#renderDeck();
    }));
    this.root.querySelector('[data-action="deck-next"]').addEventListener("click", () => this.router.push("setup"));
  }

  #renderSetup() {
    const unlocked = new Set(this.controller.meta.unlocks.difficulties);
    const recentSeeds = this.controller.meta.records.recentSeeds ?? [];
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">EXPEDITION PARAMETERS</p>
          <h1>난도와 시드를 고르세요</h1>
          <p class="lede">같은 시드는 지도·웨이브·속성·변이·보상 후보와 전투 난수를 그대로 재현합니다.</p>
        </div>
        <div class="surface-card">
          <h2>난도</h2>
          <div class="choice-grid">
            ${content.difficulties.map((difficulty) => {
              const locked = !unlocked.has(difficulty.id);
              return `<button class="choice-card ${this.setupState.difficultyId === difficulty.id ? "is-selected" : ""}" type="button" data-difficulty="${difficulty.id}" aria-disabled="${locked}">
                <h3>${escapeHtml(difficulty.name)} ${locked ? "🔒" : ""}</h3>
                <p>${escapeHtml(difficulty.description)}</p>
                <div class="tag-row"><span class="tag">HP ×${difficulty.enemyHpMul}</span><span class="tag">속도 ×${difficulty.enemySpeedMul}</span><span class="resource-pill">금화 ${difficultyStartGold(difficulty)}</span></div>
              </button>`;
            }).join("")}
          </div>
        </div>
        <div class="surface-card" style="margin-top:14px">
          <div class="form-grid">
            <div class="field">
              <label for="seed-input">원정 시드</label>
              <input id="seed-input" maxlength="40" autocomplete="off" value="${escapeHtml(this.setupState.seed)}" />
              <span class="muted">축약 ${hashSeed(this.setupState.seed)}</span>
            </div>
            <div class="field">
              <span class="field-label">시드 도구</span>
              <div class="inline-actions">
                <button class="secondary-button" type="button" data-seed="new">새 시드</button>
                ${recentSeeds.slice(0, 2).map((seed) => `<button class="ghost-button" type="button" data-seed-value="${escapeHtml(seed)}">${escapeHtml(seed)}</button>`).join("")}
              </div>
            </div>
          </div>
        </div>
        <div class="surface-card" style="margin-top:14px">
          <h2>시작 축복 · 2택 1</h2>
          <div class="choice-grid">
            ${content.blessings.slice(0, 2).map((blessing) => `<button class="choice-card ${this.setupState.blessingId === blessing.id ? "is-selected" : ""}" type="button" data-blessing="${blessing.id}">
              <h3>${escapeHtml(blessing.name)}</h3><p>${escapeHtml(blessing.description)}</p>
            </button>`).join("")}
          </div>
        </div>
        <div class="inline-actions" style="justify-content:flex-end;margin-top:16px">
          <button class="primary-button" type="button" data-action="start-run">원정 생성</button>
        </div>
      </section>`;
    this.root.querySelectorAll("[data-difficulty]").forEach((button) => button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") return this.showToast("표준 난도를 클리어하면 월식이 해금됩니다.");
      this.setupState.difficultyId = button.dataset.difficulty;
      this.#renderSetup();
    }));
    this.root.querySelectorAll("[data-blessing]").forEach((button) => button.addEventListener("click", () => {
      this.setupState.blessingId = button.dataset.blessing;
      this.#renderSetup();
    }));
    this.root.querySelector('[data-seed="new"]').addEventListener("click", () => {
      this.setupState.seed = makeSeed();
      this.#renderSetup();
    });
    this.root.querySelectorAll("[data-seed-value]").forEach((button) => button.addEventListener("click", () => {
      this.setupState.seed = button.dataset.seedValue;
      this.#renderSetup();
    }));
    this.root.querySelector("#seed-input").addEventListener("input", (event) => {
      this.setupState.seed = event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
    });
    this.root.querySelector('[data-action="start-run"]').addEventListener("click", () => {
      const seed = this.setupState.seed.trim() || makeSeed();
      this.controller.createRun({
        deck: clone(this.draftDeck),
        difficultyId: this.setupState.difficultyId,
        seed,
        blessingId: this.setupState.blessingId,
      });
      this.activeMode = "expedition";
      this.router.reset("map");
    });
  }

  #stageOptions(run) {
    const count = [2, 4, 5].includes(run.stageNumber) ? 2 : 1;
    return Array.from({ length: count }, (_, nodeVariant) => buildStagePlan({
      stageNumber: run.stageNumber,
      seed: run.seed,
      difficultyId: run.difficultyId,
      nodeVariant,
    }));
  }

  #renderMap() {
    const run = this.controller.run;
    if (!run) {
      this.router.reset("hub");
      return;
    }
    const options = this.#stageOptions(run);
    const completed = new Set(run.completedStages);
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">EXPEDITION MAP · ${escapeHtml(run.seed)}</p>
          <h1>스테이지 ${run.stageNumber}의 경로</h1>
          <p class="lede">적 유형과 속성 비중은 별개입니다. 두 축을 함께 읽고 성장·배치를 결정하세요.</p>
        </div>
        <div class="surface-card">
          <div class="resource-row">
            <span class="resource-pill">◆ 코어 ${run.coreHp}/100</span>
            <span class="resource-pill">◈ 금화 ${run.gold}</span>
            <span class="resource-pill">✦ 조각 ${run.shards}</span>
            <span class="resource-pill">교본 ${run.doctrines.length}/2</span>
            <span class="resource-pill">유물 ${run.relics.length}/2</span>
          </div>
          <div class="map-track">
            ${Array.from({ length: 6 }, (_, index) => {
              const stage = index + 1;
              const boss = stage === 3 ? "중간 보스" : stage === 6 ? "최종 보스" : "전술 전장";
              return `<div class="map-node ${stage === run.stageNumber ? "is-current" : ""} ${completed.has(stage) ? "is-complete" : ""}">
                <small class="muted">STAGE ${stage}</small>
                <h3>${boss}</h3>
                <span class="tag">${completed.has(stage) ? "완료" : stage === run.stageNumber ? "현재" : "잠김"}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
        <div class="scene-heading" style="margin-bottom:14px"><h2>${options.length === 2 ? "공개된 두 경로 중 하나를 선택" : "다음 위협 확인"}</h2></div>
        <div class="choice-grid">
          ${options.map((plan, index) => {
            const mutator = this.#mutatorDefinition(plan.mutator);
            return `<button class="choice-card" type="button" data-node="${index}">
              <p class="eyebrow">ROUTE ${String.fromCharCode(65 + index)}</p>
              <h3>${escapeHtml(plan.layout?.name ?? `전장 ${index + 1}`)}</h3>
              <p>${escapeHtml(plan.layout?.description ?? "두 경로가 코어 앞에서 합류하는 전장")}</p>
              <div class="tag-row">${plan.threats.slice(0, 4).map((id) => threatPill(id, content.enemies)).join("")}</div>
              <div class="tag-row" style="margin-top:8px" data-map-element-profile="${index}">${this.#elementProfileHtml(plan.elementProfile)}</div>
              ${mutator ? `<p class="muted" style="margin:10px 0 0">변이 · ${escapeHtml(mutator.name)}</p>` : ""}
            </button>`;
          }).join("")}
        </div>
        <div class="inline-actions" style="justify-content:center;margin-top:18px">
          <button class="ghost-button" type="button" data-action="save-exit">저장하고 허브로</button>
        </div>
      </section>`;
    this.root.querySelectorAll("[data-node]").forEach((button) => button.addEventListener("click", () => {
      const nodeVariant = Number(button.dataset.node);
      this.controller.chooseNode(nodeVariant);
      this.currentStagePlan = options[nodeVariant];
      this.router.push("preview", { stagePlan: this.currentStagePlan });
    }));
    this.root.querySelector('[data-action="save-exit"]').addEventListener("click", () => {
      this.controller.saveRun({ checkpoint: true });
      this.router.reset("hub");
    });
  }

  #renderPreview(params = {}) {
    const run = this.activeMode === "expedition" ? this.controller.run : this.specialRun;
    const plan = params.stagePlan ?? this.currentStagePlan;
    if (!plan || !run) {
      this.router.reset(run ? "map" : "hub");
      return;
    }
    if (this.activeMode === "expedition" && (Number(plan.stageNumber) !== Number(run.stageNumber)
      || Number(plan.nodeVariant ?? 0) !== Number(run.selectedNodeByStage?.[run.stageNumber] ?? run.selectedNode ?? 0))) {
      this.currentStagePlan = null;
      this.router.reset("map");
      return;
    }
    this.currentStagePlan = plan;
    const mutator = this.#mutatorDefinition(plan.mutator);
    const boss = plan.preview?.bossId ? getById(content.bosses, plan.preview.bossId) : null;
    const recommendations = this.#recommendations(plan.threats);
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">THREAT PREVIEW · STAGE ${plan.stageNumber}</p>
          <h1>${escapeHtml(plan.layout?.name ?? "균열 전장")}</h1>
          <p class="lede">전투 시작 전에는 배치와 이동이 무료이며 100% 환급됩니다.</p>
        </div>
        <div class="preview-layout">
          <div class="surface-card">
            <canvas id="preview-canvas" class="mini-map" width="780" height="480" aria-label="경로와 배치 가능 칸 미리보기"></canvas>
          </div>
          <aside class="surface-card">
            <h2>공개 위협</h2>
            <div class="tag-row">${plan.threats.map((id) => threatPill(id, content.enemies)).join("")}</div>
            <h3 style="margin-top:18px">속성 HP 비중</h3>
            <div class="tag-row" data-preview-element-profile>${this.#elementProfileHtml(plan.elementProfile)}</div>
            ${mutator ? `<h3 style="margin-top:18px">변이 · ${escapeHtml(mutator.name)}</h3><p class="muted">${escapeHtml(mutator.description)}</p>` : ""}
            ${boss ? `<h3 style="margin-top:18px">보스 · ${escapeHtml(boss.name)}</h3><div class="tag-row">${elementPill(boss.element, content.elements)}<span class="tag">고정 속성</span></div>` : ""}
            <h3 style="margin-top:18px">추천 대응</h3>
            <ul class="muted">${recommendations.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
            <div class="resource-row" style="margin-top:18px"><span class="resource-pill">적 ${plan.totalEnemies}</span><span class="resource-pill">공중 ${Math.round((plan.aerialRatio ?? 0) * 100)}%</span><span class="resource-pill">경로 ${plan.paths.length}</span></div>
          </aside>
        </div>
        <div class="inline-actions" style="justify-content:flex-end;margin-top:16px">
          <button class="ghost-button" type="button" data-action="preview-back">경로 다시 선택</button>
          <button class="primary-button" type="button" data-action="deploy">배치 시작</button>
        </div>
      </section>`;
    this.#drawPreview(this.root.querySelector("#preview-canvas"), plan);
    this.root.querySelector('[data-action="preview-back"]').addEventListener("click", () => {
      if (this.activeMode === "expedition") {
        run.phase = "map";
        this.controller.saveRun();
        this.router.replace("map");
      } else {
        this.specialRun = null;
        this.router.back();
      }
    });
    this.root.querySelector('[data-action="deploy"]').addEventListener("click", () => {
      if (this.activeMode === "expedition") this.controller.setPhase("deploy", { checkpoint: true });
      this.router.push("battle", { stagePlan: plan });
    });
  }

  #drawPreview(canvas, plan) {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const cellW = canvas.width / 13;
    const cellH = canvas.height / 8;
    context.fillStyle = "#071624";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(150,207,255,.09)";
    context.lineWidth = 1;
    for (let col = 0; col <= 13; col += 1) {
      context.beginPath(); context.moveTo(col * cellW, 0); context.lineTo(col * cellW, canvas.height); context.stroke();
    }
    for (let row = 0; row <= 8; row += 1) {
      context.beginPath(); context.moveTo(0, row * cellH); context.lineTo(canvas.width, row * cellH); context.stroke();
    }
    for (const path of plan.paths ?? []) {
      context.beginPath();
      (path.cells ?? path.points ?? path).forEach((point, index) => {
        const x = (point.col ?? point.x) * cellW + cellW / 2;
        const y = (point.row ?? point.y) * cellH + cellH / 2;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = "rgba(92,225,230,.55)";
      context.lineWidth = Math.min(cellW, cellH) * 0.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
    }
    for (const node of plan.leaderNodes ?? []) {
      context.fillStyle = "rgba(255,210,122,.7)";
      context.beginPath();
      context.arc((node.col ?? node.x) * cellW + cellW / 2, (node.row ?? node.y) * cellH + cellH / 2, Math.min(cellW, cellH) * 0.26, 0, Math.PI * 2);
      context.fill();
    }
    const core = plan.core ?? { col: 10, row: 3 };
    context.fillStyle = "#f7fbff";
    context.fillRect((core.col ?? core.x) * cellW + cellW * 0.26, (core.row ?? core.y) * cellH + cellH * 0.26, cellW * 0.48, cellH * 0.48);
  }

  #elementProfileHtml(profile) {
    const weights = profile?.weights ?? profile?.elementWeights ?? {};
    return Object.entries(weights)
      .filter(([, value]) => Number(value) > 0)
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .map(([id, value]) => `${elementPill(id, content.elements)}<span class="tag">${Math.round(Number(value) * (Number(value) <= 1 ? 100 : 1))}%</span>`)
      .join("");
  }

  #mutatorDefinition(mutator) {
    if (!mutator) return null;
    if (typeof mutator === "object") return mutator;
    return getById(content.mutators, mutator);
  }

  #recommendations(threats = []) {
    const result = [];
    if (threats.includes("aerial")) result.push("공중 공격 가능 영웅과 공중 우선 타깃을 중앙에 배치");
    if (threats.includes("armored")) result.push("마법 피해·부식·관통으로 물리 저항 우회");
    if (threats.includes("swarm") || threats.includes("split")) result.push("스플래시·연쇄·관통을 경로 합류점에 집중");
    if (threats.includes("cleanse")) result.push("정화 적을 강적 우선으로 빠르게 처치하거나 침묵 사용");
    if (threats.includes("rush")) result.push("선두 우선과 감속·동결로 누수 차단");
    if (!result.length) result.push("경로 합류점에 범용 화력을 배치하고 코어 인근에 예비 대응 유지");
    return result;
  }

  #renderGrowth() {
    const run = this.controller.run;
    if (!run) return this.router.reset("hub");
    const ids = [run.deck.leaderId, ...run.deck.companionIds];
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">GROWTH · STAGE ${run.stageNumber} CLEARED</p>
          <h1>성장 조각을 배분하세요</h1>
          <p class="lede">주인공은 Lv.4, 동료는 Lv.3에서 역할을 바꾸는 상호 배타 분기를 선택합니다.</p>
        </div>
        <div class="toolbar surface-card">
          <div><strong>보유 성장 조각</strong><div class="muted">확정한 강화는 이번 런에서 되돌릴 수 없습니다.</div></div>
          <span class="resource-pill" style="font-size:1rem">✦ ${run.shards}</span>
        </div>
        <div class="card-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));margin-top:14px">
          ${ids.map((id) => {
            const character = getById(content.characters, id);
            const level = run.levels[id] ?? 1;
            const options = this.controller.getUpgradeOptions(id);
            const branch = run.branches[id];
            return `<article class="surface-card">
              <div class="toolbar">
                <div class="status-row"><span class="roster-token" style="margin:0">${escapeHtml(character.name[0])}</span><div><strong>${escapeHtml(character.name)}</strong><div class="muted">Lv.${level}/${character.maxLevel}${branch ? ` · 분기 ${branch}` : ""}</div></div></div>
                ${elementPill(character.element, content.elements)}
              </div>
              ${options.length ? options.map((upgrade) => `<button class="choice-card" style="width:100%;min-height:104px;margin-top:8px" type="button" data-upgrade="${upgrade.id}" data-character="${id}" ${run.shards >= upgrade.cost ? "" : "disabled"}>
                <h3>${upgrade.branch ? `${upgrade.branch} · ` : ""}${escapeHtml(upgrade.title)}</h3>
                <p>${escapeHtml(upgrade.description)}</p>
                <span class="resource-pill">조각 ${upgrade.cost}</span>
              </button>`).join("") : `<p class="muted">${level >= character.maxLevel ? "전문화가 완성되었습니다." : "다음 강화 데이터가 없습니다."}</p>`}
            </article>`;
          }).join("")}
        </div>
        <div class="inline-actions" style="justify-content:flex-end;margin-top:16px">
          <button class="primary-button" type="button" data-action="growth-next">${this.controller.getPendingRewardKind() ? "보상 선택" : "다음 스테이지"}</button>
        </div>
      </section>`;
    this.root.querySelectorAll("[data-upgrade]").forEach((button) => button.addEventListener("click", () => {
      const result = this.controller.applyUpgrade(button.dataset.character, button.dataset.upgrade);
      this.showToast(result.ok ? `${result.upgrade.title}을(를) 습득했습니다.` : result.reason);
      this.#renderGrowth();
    }));
    this.root.querySelector('[data-action="growth-next"]').addEventListener("click", () => {
      const next = this.controller.advanceAfterGrowth();
      this.router.replace(next);
    });
  }

  #renderReward() {
    const run = this.controller.run;
    if (!run) return this.router.reset("hub");
    const kind = this.controller.getPendingRewardKind();
    if (!kind) {
      this.controller.advanceToNextStage();
      this.router.replace("map");
      return;
    }
    const ids = this.controller.getRewardChoices(kind);
    const pool = kind === "relic" ? content.relics : content.doctrines;
    const title = kind === "relic" ? "규칙을 바꾸는 유물" : "원정 전술 교본";
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">${kind === "relic" ? "RELIC DRAFT" : "DOCTRINE DRAFT"}</p>
          <h1>${title} · 3택 1</h1>
          <p class="lede">현재 덱 시너지와 범용·방어 선택이 섞이도록 후보가 안전하게 구성됩니다.</p>
        </div>
        <div class="choice-grid">
          ${ids.map((id) => getById(pool, id)).filter(Boolean).map((reward) => `<button class="choice-card" type="button" data-reward="${reward.id}">
            <p class="eyebrow">${kind.toUpperCase()}</p>
            <h3>${escapeHtml(reward.name)}</h3>
            <p>${escapeHtml(reward.description)}</p>
            <div class="tag-row">${(reward.tags ?? reward.synergyTags ?? []).slice(0, 4).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          </button>`).join("")}
        </div>
        <div class="inline-actions" style="justify-content:flex-end;margin-top:16px">
          <button class="ghost-button" type="button" data-action="reroll" ${run.rerolls > 0 ? "" : "disabled"}>리롤 ${run.rerolls}/1</button>
        </div>
      </section>`;
    this.root.querySelectorAll("[data-reward]").forEach((button) => button.addEventListener("click", () => {
      if (!this.controller.chooseReward(kind, button.dataset.reward)) return;
      this.router.replace("map");
    }));
    this.root.querySelector('[data-action="reroll"]').addEventListener("click", () => {
      this.controller.rerollReward(kind);
      this.#renderReward();
    });
  }

  #renderResult() {
    const run = this.controller.run;
    if (!run?.result) return this.router.reset("hub");
    const result = run.result;
    const stats = run.stats ?? {};
    const strategyValue = (value) => {
      const normalized = Number(value);
      return Number.isFinite(normalized) ? Math.max(0, normalized) : 0;
    };
    const damageValue = (value) => Math.round(strategyValue(value)).toLocaleString();
    const advantageRatio = stats.damage > 0 ? Math.round((stats.advantageDamage / stats.damage) * 100) : 0;
    const topCharacters = Object.entries(stats.byCharacter ?? {})
      .sort((left, right) => (right[1].damage ?? 0) - (left[1].damage ?? 0))
      .slice(0, 5);
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">${result.success ? "EXPEDITION COMPLETE" : "CORE LOST"}</p>
          <h1>${result.success ? "별빛이 균열을 봉인했습니다" : "전술을 고쳐 다시 도전하세요"}</h1>
          <p class="lede">시드 ${escapeHtml(result.seed)} · ${escapeHtml(getById(content.difficulties, result.difficultyId)?.name ?? result.difficultyId)}</p>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><strong>${result.score.toLocaleString()}</strong><span>최종 점수</span></div>
          <div class="stat-card"><strong>${result.stages}/6</strong><span>완료 스테이지</span></div>
          <div class="stat-card"><strong>${formatTime(result.elapsedSeconds)}</strong><span>전투 시간</span></div>
          <div class="stat-card"><strong>${stats.kills ?? 0}</strong><span>처치</span></div>
          <div class="stat-card"><strong>${Math.round(stats.damage ?? 0).toLocaleString()}</strong><span>총 피해</span></div>
          <div class="stat-card"><strong>${advantageRatio}%</strong><span>속성 우위 피해 비중</span></div>
          <div class="stat-card"><strong>${Math.round((stats.controlSeconds ?? 0) * 10) / 10}초</strong><span>제어 시간</span></div>
          <div class="stat-card"><strong>${stats.relocations ?? 0}</strong><span>재배치</span></div>
        </div>
        <div class="surface-card" style="margin-top:14px">
          <h2>캐릭터 기여</h2>
          <div class="contribution-list">
          ${topCharacters.length ? topCharacters.map(([id, entry]) => {
            const character = getById(content.characters, id);
            const totalDamage = strategyValue(entry.damage);
            const share = stats.damage > 0 ? Math.round((totalDamage / stats.damage) * 100) : 0;
            const advantageousDamage = entry.advantageDamage ?? entry.advantageousDamage;
            const controlSeconds = entry.controlSeconds ?? entry.controlTime;
            const statusApplications = entry.statusesApplied ?? entry.statusApplications;
            return `<article class="contribution-row" data-character-contribution="${escapeHtml(id)}">
              <header><strong>${escapeHtml(character?.name ?? id)}</strong><span>총 피해 ${damageValue(totalDamage)} · ${share}%</span></header>
              <dl class="contribution-metrics">
                <div><dt>광역 피해</dt><dd>${damageValue(entry.areaDamage)}</dd></div>
                <div><dt>공중 피해</dt><dd>${damageValue(entry.aerialDamage)}</dd></div>
                <div><dt>우위 피해</dt><dd>${damageValue(advantageousDamage)}</dd></div>
                <div><dt>제어</dt><dd>${strategyValue(controlSeconds).toFixed(1)}초</dd></div>
                <div><dt>상태 부여</dt><dd>${Math.round(strategyValue(statusApplications))}회</dd></div>
              </dl>
            </article>`;
          }).join("") : `<p class="muted">기여 통계가 아직 없습니다.</p>`}
          </div>
        </div>
        <div class="inline-actions" style="justify-content:center;margin-top:18px">
          <button class="ghost-button" type="button" data-result="copy-seed">시드 복사</button>
          <button class="secondary-button" type="button" data-result="same-seed">같은 시드 재도전</button>
          <button class="primary-button" type="button" data-result="hub">허브로</button>
        </div>
      </section>`;
    this.root.querySelector('[data-result="copy-seed"]').addEventListener("click", () => this.#copySeed(result.seed));
    this.root.querySelector('[data-result="hub"]').addEventListener("click", () => {
      this.controller.finalizeResult();
      this.router.reset("hub");
    });
    this.root.querySelector('[data-result="same-seed"]').addEventListener("click", () => {
      const config = {
        deck: clone(run.deck),
        difficultyId: run.difficultyId,
        seed: run.seed,
        blessingId: run.blessingId,
      };
      this.controller.finalizeResult();
      this.draftDeck = clone(config.deck);
      this.setupState = { difficultyId: config.difficultyId, seed: config.seed, blessingId: config.blessingId };
      this.controller.createRun(config);
      this.router.reset("map");
    });
  }

  #renderChallenges() {
    this.controller.refreshChallengeUnlocks?.();
    const unlocked = new Set(this.controller.meta.unlocks.challenges ?? []);
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">FIXED TACTICAL TRIALS</p>
          <h1>같은 조건, 다른 해법</h1>
          <p class="lede">고정된 편성과 성장으로 대공·중갑·지연 연계를 한 가지씩 집중 학습합니다.</p>
        </div>
        <div class="choice-grid">
          ${content.challenges.map((challenge, index) => {
            const isUnlocked = unlocked.has(challenge.id);
            const stars = this.controller.meta.records.challengeStars?.[challenge.id] ?? 0;
            return `<button class="choice-card" type="button" data-challenge="${challenge.id}" aria-disabled="${!isUnlocked}">
              <p class="eyebrow">TRIAL ${index + 1} · ${"★".repeat(stars)}${"☆".repeat(3 - stars)}</p>
              <h3>${escapeHtml(challenge.name)} ${isUnlocked ? "" : "🔒"}</h3>
              <p>${escapeHtml(challenge.purpose)}</p>
              <p class="muted">고정 성장 조각 ${challenge.fixedGrowthShards ?? 0} · ${(challenge.fixedRelicIds ?? []).length ? `고정 유물 ${(challenge.fixedRelicIds ?? []).map((id) => getById(content.relics, id)?.name ?? id).join(", ")}` : "유물 없음"}</p>
              <ul class="compact-list">${(challenge.starConditions ?? []).map((condition, starIndex) => `<li>${starIndex + 1}★ ${escapeHtml(condition.description)}</li>`).join("")}</ul>
              <div class="tag-row">${challenge.fixedDeck.companionIds.slice(0, 3).map((id) => `<span class="tag">${escapeHtml(getById(content.characters, id)?.name ?? id)}</span>`).join("")}</div>
            </button>`;
          }).join("")}
        </div>
        ${!content.challenges.length ? `<div class="surface-card"><p class="muted">고정 도전 데이터가 없습니다.</p></div>` : ""}
      </section>`;
    this.root.querySelectorAll("[data-challenge]").forEach((button) => button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") {
        this.showToast("원정에서 균열을 더 조사하면 해금됩니다.");
        return;
      }
      const challenge = getById(content.challenges, button.dataset.challenge);
      this.#confirmChallenge(challenge);
    }));
  }

  #confirmChallenge(challenge) {
    const deckNames = [challenge.fixedDeck.leaderId, ...challenge.fixedDeck.companionIds]
      .map((id) => getById(content.characters, id)?.name ?? id)
      .join(" · ");
    this.showModal({
      title: challenge.name,
      body: `<strong>고정 편성</strong><br />${escapeHtml(deckNames)}<br /><br /><strong>고정 성장</strong><br />성장 조각 ${challenge.fixedGrowthShards ?? 0}${(challenge.fixedRelicIds ?? []).length ? ` · ${(challenge.fixedRelicIds ?? []).map((id) => escapeHtml(getById(content.relics, id)?.name ?? id)).join(" · ")}` : ""}<br /><br />${(challenge.starConditions ?? []).map((condition, index) => `${index + 1}★ ${escapeHtml(condition.description)}`).join("<br />")}`,
      confirmLabel: "도전 시작",
      cancelLabel: "취소",
      onConfirm: () => this.#startChallenge(challenge),
      onCancel: () => {},
    });
  }

  #startChallenge(challenge) {
    const seed = `CHALLENGE-${challenge.id.toUpperCase()}`;
    const growth = this.#allocateFixedGrowth(challenge.fixedDeck, challenge.fixedGrowthShards ?? 0);
    const trainingOverrides = {
      threats: challenge.enemyRules?.highWeightTags,
      highWeightTags: challenge.enemyRules?.highWeightTags,
      aerialHpBudgetRatio: challenge.enemyRules?.aerialHpBudgetRatio,
      primaryElement: challenge.enemyRules?.fixedPrimaryElement,
      elementPool: challenge.enemyRules?.elementPool,
      maxElements: challenge.enemyRules?.maxElements,
      bossOnly: challenge.enemyRules?.bossOnly,
      bossId: challenge.enemyRules?.bossOverride?.bossId,
      enemyElement: challenge.enemyRules?.bossOverride?.element,
    };
    const stageNumber = challenge.id.includes("stopped") ? 6 : challenge.id.includes("sky") ? 5 : 4;
    this.specialRun = {
      seed,
      difficultyId: "standard",
      deck: clone(challenge.fixedDeck),
      levels: growth.levels,
      branches: growth.branches,
      doctrines: [],
      relics: [...(challenge.fixedRelicIds ?? [])],
      shards: growth.remainingShards,
      timeLimitSeconds: challenge.timeLimitSeconds ?? null,
      coreHp: 100,
      coreShield: 0,
      gold: 360,
      stats: {},
    };
    this.activeMode = "challenge";
    this.challengeContext = challenge;
    this.currentStagePlan = buildStagePlan({ stageNumber, seed, difficultyId: "standard", trainingOverrides });
    this.router.push("preview", { stagePlan: this.currentStagePlan });
  }

  #allocateFixedGrowth(deck, shardBudget) {
    const ids = [deck.leaderId, ...deck.companionIds];
    const levels = Object.fromEntries(ids.map((id) => [id, 1]));
    const branches = {};
    let remainingShards = Math.max(0, Math.floor(Number(shardBudget) || 0));
    let advanced = true;
    while (advanced && remainingShards > 0) {
      advanced = false;
      for (const id of ids) {
        const character = getById(content.characters, id);
        const nextLevel = (levels[id] ?? 1) + 1;
        const options = (character?.upgrades ?? []).filter((upgrade) => upgrade.level === nextLevel && (!upgrade.branch || upgrade.branch === "A"));
        const upgrade = options.find(({ branch }) => branch === "A") ?? options[0];
        const cost = Number(upgrade?.cost) || 0;
        if (!upgrade || cost > remainingShards) continue;
        remainingShards -= cost;
        levels[id] = nextLevel;
        if (upgrade.branch) branches[id] = upgrade.branch;
        advanced = true;
      }
    }
    return { levels, branches, remainingShards };
  }

  #renderTraining() {
    const leaders = content.characters.filter(({ kind }) => kind === "leader");
    const companions = content.characters.filter(({ kind }) => kind === "companion");
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading">
          <p class="eyebrow">CONTROLLED SIMULATION</p>
          <h1>훈련 조건을 강제로 구성</h1>
          <p class="lede">모든 프로토타입 캐릭터와 적 유형·속성·보스를 즉시 시험하며 영구 보상은 없습니다.</p>
        </div>
        <div class="surface-card">
          <div class="form-grid">
            <div class="field"><label for="training-leader">주인공</label><select id="training-leader">${leaders.map((item) => `<option value="${item.id}" ${item.id === this.trainingState.leaderId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
            ${this.trainingState.companionIds.map((selectedId, index) => `<div class="field"><label for="training-companion-${index}">동료 ${index + 1}</label><select id="training-companion-${index}" data-training-companion="${index}">${companions.map((item) => `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>`).join("")}
            <div class="field"><label for="training-enemy">주 적 유형</label><select id="training-enemy">${content.enemies.map((item) => `<option value="${item.id}" ${item.id === this.trainingState.enemyId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
            <div class="field"><label for="training-element">적 속성</label><select id="training-element">${content.elements.map((item) => `<option value="${item.id}" ${item.id === this.trainingState.enemyElement ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
            <div class="field"><label for="training-wave">웨이브 패키지</label><select id="training-wave">${content.wavePackages.map((item) => `<option value="${item.id}" ${item.id === this.trainingState.wavePackageId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
            <div class="field"><label for="training-elite">정예 접두사</label><select id="training-elite"><option value="">없음</option>${[["swift", "신속"], ["steel", "강철"], ["regenerating", "재생"], ["unyielding", "불굴"]].map(([id, label]) => `<option value="${id}" ${id === this.trainingState.elitePrefix ? "selected" : ""}>${label}</option>`).join("")}</select></div>
            <div class="field"><label for="training-status">초기 적 상태</label><select id="training-status"><option value="">없음</option>${content.statuses.map((item) => `<option value="${item.id}" ${item.id === this.trainingState.statusId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
            <div class="field"><label for="training-boss">보스</label><select id="training-boss"><option value="">없음</option>${content.bosses.map((item) => `<option value="${item.id}" ${item.id === this.trainingState.bossId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></div>
            <div class="field"><label for="training-boss-phase">보스 HP 단계</label><select id="training-boss-phase">${[[1, "100% · 시작"], [0.7, "70% · 1차 패턴"], [0.5, "50% · 중반"], [0.2, "20% · 최종 패턴"]].map(([value, label]) => `<option value="${value}" ${value === this.trainingState.bossPhaseRatio ? "selected" : ""}>${label}</option>`).join("")}</select></div>
            <div class="field"><label for="training-multiplier">속성 우위 배율</label><select id="training-multiplier">${[1.15, 1.2, 1.25].map((value) => `<option value="${value}" ${value === this.trainingState.elementMultiplier ? "selected" : ""}>×${value.toFixed(2)}</option>`).join("")}</select></div>
          </div>
          <label class="switch-row"><span><strong>속성 규칙</strong><span class="muted" style="display:block">OFF에서는 모든 조합이 ×1.00</span></span><input id="training-elements-on" type="checkbox" ${this.trainingState.elementRules ? "checked" : ""} /></label>
          <div class="inline-actions" style="justify-content:flex-end;margin-top:16px"><button class="primary-button" type="button" data-action="training-start">훈련 시작</button></div>
        </div>
        <div class="surface-card" style="margin-top:14px">
          <h2>상태·판정 디버그</h2>
          <div class="tag-row">${content.statuses.map((status) => `<span class="status-pill">${escapeHtml(status.name)}</span>`).join("")}</div>
          <p class="muted" style="margin:12px 0 0">전투 설정에서 디버그 오버레이를 켜면 HP·저항·상태·경로 진행률·쿨다운·FPS를 함께 표시합니다.</p>
        </div>
      </section>`;
    const fields = {
      "training-leader": "leaderId",
      "training-enemy": "enemyId",
      "training-element": "enemyElement",
      "training-wave": "wavePackageId",
      "training-elite": "elitePrefix",
      "training-status": "statusId",
      "training-boss": "bossId",
    };
    for (const [id, key] of Object.entries(fields)) this.root.querySelector(`#${id}`).addEventListener("change", (event) => { this.trainingState[key] = event.target.value; });
    this.root.querySelectorAll("[data-training-companion]").forEach((select) => select.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.trainingCompanion);
      const next = [...this.trainingState.companionIds];
      if (next.some((id, otherIndex) => id === event.target.value && otherIndex !== index)) {
        event.target.value = next[index];
        this.showToast("훈련 편성에는 같은 동료를 두 번 넣을 수 없습니다.");
        return;
      }
      next[index] = event.target.value;
      this.trainingState.companionIds = next;
    }));
    this.root.querySelector("#training-multiplier").addEventListener("change", (event) => { this.trainingState.elementMultiplier = Number(event.target.value); });
    this.root.querySelector("#training-boss-phase").addEventListener("change", (event) => { this.trainingState.bossPhaseRatio = Number(event.target.value); });
    this.root.querySelector("#training-elements-on").addEventListener("change", (event) => { this.trainingState.elementRules = event.target.checked; });
    this.root.querySelector('[data-action="training-start"]').addEventListener("click", () => this.#startTraining());
  }

  #startTraining() {
    const deck = { leaderId: this.trainingState.leaderId, companionIds: [...this.trainingState.companionIds] };
    const ids = [deck.leaderId, ...deck.companionIds];
    this.specialRun = {
      seed: `TRAINING-${this.trainingState.enemyId}-${this.trainingState.enemyElement}`.toUpperCase(),
      difficultyId: "scout",
      deck,
      levels: Object.fromEntries(ids.map((id) => [id, getById(content.characters, id)?.kind === "leader" ? 6 : 5])),
      branches: Object.fromEntries(ids.map((id) => [id, "A"])),
      doctrines: [],
      relics: [],
      coreHp: 100,
      coreShield: 0,
      gold: 500,
      stats: {},
      elementRules: this.trainingState.elementRules,
      elementMultiplier: this.trainingState.elementMultiplier,
    };
    this.activeMode = "training";
    this.challengeContext = null;
    this.currentStagePlan = buildStagePlan({
      stageNumber: this.trainingState.bossId ? 6 : 2,
      seed: this.specialRun.seed,
      difficultyId: "scout",
      trainingOverrides: {
        enemyId: this.trainingState.enemyId,
        enemyElement: this.trainingState.enemyElement,
        primaryElement: this.trainingState.enemyElement,
        elementProfile: { weights: { [this.trainingState.enemyElement]: 1 } },
        wavePackageId: this.trainingState.wavePackageId,
        bossId: this.trainingState.bossId || undefined,
        bossPhaseRatio: this.trainingState.bossId ? this.trainingState.bossPhaseRatio : undefined,
        elitePrefix: this.trainingState.elitePrefix || undefined,
        statusId: this.trainingState.statusId || undefined,
        threats: [this.trainingState.enemyId],
      },
    });
    this.router.push("preview", { stagePlan: this.currentStagePlan });
  }

  #renderCompendium() {
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading"><p class="eyebrow">CHARACTER ARCHIVE</p><h1>4명의 주인공 · 6명의 동료</h1><p class="lede">도감 설명과 전투는 같은 데이터 원본을 읽습니다.</p></div>
        <div class="roster-grid">
          ${content.characters.map((character) => `<button class="roster-card" type="button" data-codex="${character.id}">
            <span class="roster-token">${escapeHtml(character.name[0])}</span>
            <strong>${escapeHtml(character.name)}</strong>
            <small>${character.kind === "leader" ? "주인공" : `동료 · 비용 ${character.cost}`} · ${ROLE_NAMES[character.rolePrimary] ?? character.rolePrimary}</small>
            <div class="tag-row" style="margin-top:9px">${elementPill(character.element, content.elements)}${(character.roleTags ?? []).map((role) => `<span class="tag">${ROLE_NAMES[role] ?? role}</span>`).join("")}</div>
          </button>`).join("")}
        </div>
      </section>`;
    this.root.querySelectorAll("[data-codex]").forEach((button) => button.addEventListener("click", () => {
      const character = getById(content.characters, button.dataset.codex);
      this.showModal({
        title: character.name,
        body: `
          <div class="tag-row">${elementPill(character.element, content.elements)}<span class="tag">${ROLE_NAMES[character.rolePrimary] ?? character.rolePrimary}</span></div>
          <h3 style="margin-top:18px">기술</h3>
          ${(character.skills ?? []).map((skill) => `<div class="switch-row"><div><strong>${escapeHtml(skill.name)}</strong><span class="muted" style="display:block">${escapeHtml(skill.description)}</span></div></div>`).join("")}
          <h3 style="margin-top:18px">성장 분기</h3>
          ${(character.upgrades ?? []).map((upgrade) => `<div class="switch-row"><div><strong>Lv.${upgrade.level}${upgrade.branch ? ` ${upgrade.branch}` : ""} · ${escapeHtml(upgrade.title)}</strong><span class="muted" style="display:block">${escapeHtml(upgrade.description)}</span></div></div>`).join("")}`,
      });
    }));
  }

  #renderRecords() {
    const records = this.controller.meta.records;
    const affinity = this.controller.meta.affinity ?? {};
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading"><p class="eyebrow">MISSION RECORDS</p><h1>전술은 기록에서 선명해집니다</h1><p class="lede">실패 원인을 같은 시드로 재현하고, 편성별 성과를 비교하세요.</p></div>
        <div class="stat-grid">
          <div class="stat-card"><strong>${(records.bestScore ?? 0).toLocaleString()}</strong><span>최고 점수</span></div>
          <div class="stat-card"><strong>${records.clears ?? 0}</strong><span>원정 클리어</span></div>
          <div class="stat-card"><strong>${records.failures ?? 0}</strong><span>원정 실패</span></div>
          <div class="stat-card"><strong>${escapeHtml(getById(content.difficulties, records.highestDifficulty)?.name ?? "정찰")}</strong><span>최고 난도</span></div>
        </div>
        <div class="preview-layout" style="margin-top:14px">
          <div class="surface-card"><h2>최근 시드</h2>${(records.recentSeeds ?? []).length ? records.recentSeeds.map((seed) => `<div class="switch-row"><code>${escapeHtml(seed)}</code><button class="ghost-button" type="button" data-copy-seed="${escapeHtml(seed)}">복사</button></div>`).join("") : `<p class="muted">완료한 원정이 아직 없습니다.</p>`}</div>
          <div class="surface-card"><h2>인연 기록</h2>${content.characters.map((character) => `<div class="switch-row"><span>${escapeHtml(character.name)}</span><strong>${affinity[character.id] ?? 0} XP</strong></div>`).join("")}</div>
        </div>
      </section>`;
    this.root.querySelectorAll("[data-copy-seed]").forEach((button) => button.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(button.dataset.copySeed); this.showToast("시드를 복사했습니다."); }
      catch { this.showToast(`시드: ${button.dataset.copySeed}`); }
    }));
  }

  #renderSettings() {
    const settings = this.controller.settings;
    const toggles = [
      ["sound", "사운드", "공격·경고 효과음"],
      ["damageNumbers", "피해 숫자", "전장 위 피해량 팝업"],
      ["particles", "파티클", "폭발·별빛·상태 효과"],
      ["screenShake", "화면 흔들림", "보스와 강한 공격의 카메라 반동"],
      ["vibration", "진동", "지원 기기에서 보스 경고 진동"],
      ["flashes", "번쩍임", "피격·스킬의 밝기 플래시"],
      ["debugOverlay", "성능 오버레이", "FPS·update·entity·projectile 수"],
    ];
    this.root.innerHTML = `
      <section class="scene">
        <div class="scene-heading"><p class="eyebrow">ACCESSIBILITY & DISPLAY</p><h1>판독성을 나에게 맞게</h1><p class="lede">색상뿐 아니라 아이콘과 형태를 함께 사용하며, 강한 시각·촉각 효과는 개별로 끌 수 있습니다.</p></div>
        <div class="surface-card" style="max-width:720px;margin:0 auto">
          ${toggles.map(([key, label, description]) => `<label class="switch-row"><span><strong>${label}</strong><span class="muted" style="display:block">${description}</span></span><input type="checkbox" data-setting="${key}" ${settings[key] ? "checked" : ""} /></label>`).join("")}
        </div>
      </section>`;
    this.root.querySelectorAll("[data-setting]").forEach((input) => input.addEventListener("change", () => {
      this.controller.updateSettings({ [input.dataset.setting]: input.checked });
      this.showToast("설정을 저장했습니다.");
    }));
  }

  #renderBattle(params = {}) {
    const run = this.activeMode === "expedition" ? this.controller.run : this.specialRun;
    const plan = params.stagePlan ?? this.currentStagePlan;
    if (!run || !plan) {
      this.router.reset(this.activeMode === "expedition" ? "map" : "hub");
      return;
    }
    if (this.activeMode === "expedition" && (Number(plan.stageNumber) !== Number(run.stageNumber)
      || Number(plan.nodeVariant ?? 0) !== Number(run.selectedNodeByStage?.[run.stageNumber] ?? run.selectedNode ?? 0))) {
      this.currentStagePlan = null;
      this.router.reset("map");
      return;
    }
    this.currentStagePlan = plan;
    console.info("[Hero Core Defense] battle seed:", run.seed);
    const ids = [run.deck.leaderId, ...run.deck.companionIds];
    this.root.innerHTML = `
      <section class="scene battle-scene">
        <div class="battle-topbar">
          <div class="hud-group">
            <div class="hud-value"><small>STAGE</small><strong>${plan.stageNumber} · ${escapeHtml(plan.layout?.name ?? "균열")}</strong></div>
            <button class="hud-value hud-seed-button" type="button" data-copy-battle-seed title="전체 시드 복사: ${escapeHtml(run.seed)}"><small>SEED · TAP TO COPY</small><strong>${escapeHtml(run.seed)}</strong></button>
          </div>
          <div class="hud-group">
            <div class="core-meter"><div class="toolbar" style="margin:0 0 3px"><small>CORE <span id="core-value">${run.coreHp}/100</span></small><small id="shield-value">SHIELD ${run.coreShield ?? 0}</small></div><div class="meter"><span id="core-meter-fill" style="width:${run.coreHp}%"></span></div></div>
            <div class="hud-value"><small>ENEMIES</small><strong id="enemy-count">0 / ${plan.totalEnemies}</strong></div>
            <div class="hud-value"><small>TIME</small><strong id="battle-time">0:00</strong></div>
          </div>
          <div class="hud-group">
            <button class="icon-button" type="button" data-battle="pause" aria-label="일시정지">Ⅱ</button>
            <button class="icon-button" type="button" data-battle="speed" aria-label="전투 속도">1×</button>
            <button class="icon-button" type="button" data-battle="exit" aria-label="전투 메뉴">⚙</button>
          </div>
        </div>
        <div class="battle-stage">
          <canvas id="battle-canvas" aria-label="13열 8행 전투 보드"></canvas>
          <div class="battle-context" id="battle-context">아래 영웅을 고른 뒤 배치할 칸을 탭하세요.</div>
          <div class="battle-overlay"><div class="battle-message" id="battle-message">배치 준비 · 전투 전 이동과 환급은 무료</div></div>
        </div>
        <div class="battle-bottombar">
          ${ids.map((id) => {
            const character = getById(content.characters, id);
            return `<button class="unit-button" type="button" data-unit="${id}">
              <span class="unit-token">${escapeHtml(character?.name?.[0] ?? "?")}</span>
              <span class="unit-copy"><strong>${escapeHtml(character?.name ?? id)} · Lv.${run.levels[id] ?? 1}</strong><small>${character?.kind === "leader" ? "리더 거점 · 무료" : `배치 ${character?.cost ?? 0}`} · ${iconFor(character?.element)} ${getById(content.elements, character?.element)?.name ?? ""}</small><small data-unit-state="${id}">미배치</small></span>
            </button>`;
          }).join("")}
          <button class="active-button" type="button" data-battle="active"><span style="display:block;font-size:1.25rem">✦</span><span>액티브</span><small id="active-cooldown" style="display:block">READY</small></button>
          <div class="battle-action-strip">
            <button type="button" data-battle="priority">선두</button>
            <button type="button" data-battle="move">이동</button>
            <button type="button" data-battle="recall">회수</button>
            <button type="button" data-battle="auto">자동 배치</button>
            <button type="button" data-battle="start">전투 시작</button>
          </div>
        </div>
      </section>`;

    const canvas = this.root.querySelector("#battle-canvas");
    const settings = this.controller.settings;
    this.battle = new BattleEngine({
      stagePlan: plan,
      deck: run.deck,
      levels: run.levels,
      branches: run.branches,
      doctrines: run.doctrines,
      relics: run.relics,
      difficultyId: run.difficultyId,
      seed: run.seed,
      coreHp: run.coreHp,
      coreShield: run.coreShield,
      gold: run.gold,
      costMultiplier: run.costMultiplier ?? 1,
      leaderActiveCooldownMultiplier: run.leaderActiveCooldownMultiplier ?? 1,
      settings: {
        elementRulesEnabled: run.elementRules ?? settings.elementRules,
        elementMultiplier: run.elementMultiplier ?? settings.elementMultiplier,
        damageNumbers: settings.damageNumbers,
        reducedEffects: !settings.particles,
        debug: settings.debugOverlay,
      },
      onEvent: (event) => this.#onBattleEvent(event),
    });
    this.assets.preload("battle").then(() => this.#renderBattleFrame(true));
    this.battleRenderer = new BattleRenderer(canvas, { assets: this.assets });
    this.battleRenderer.resize();
    this.battleSnapshot = this.battle.getSnapshot();
    this.battlePerf = { fps: 0, updateMs: 0, renderMs: 0, lastFrameAt: performance.now() };
    this.selectedBattleCharacterId = ids[0];
    this.movingBattleUnit = false;
    this.root.querySelector(`[data-unit="${ids[0]}"]`)?.classList.add("is-selected");
    this.#renderBattleFrame(true);
    this.battleLoop = new GameLoop({
      update: (dt) => {
        const updateStartedAt = performance.now();
        this.battleSnapshot = this.battle.step(dt);
        this.battlePerf.updateMs = performance.now() - updateStartedAt;
        if (this.activeMode === "challenge" && this.specialRun?.timeLimitSeconds && this.battleSnapshot.time >= this.specialRun.timeLimitSeconds && this.battleSnapshot.phase === "running") {
          this.#finishBattle(false, this.battleSnapshot);
          return;
        }
        if (["victory", "defeat"].includes(this.battleSnapshot.phase)) this.#finishBattle(this.battleSnapshot.phase === "victory", this.battleSnapshot);
      },
      render: () => {
        const renderStartedAt = performance.now();
        const frameDelta = renderStartedAt - this.battlePerf.lastFrameAt;
        if (frameDelta > 0) {
          const instantFps = 1000 / frameDelta;
          this.battlePerf.fps = this.battlePerf.fps ? this.battlePerf.fps * 0.9 + instantFps * 0.1 : instantFps;
        }
        this.battlePerf.lastFrameAt = renderStartedAt;
        this.#renderBattleFrame(false);
        this.battlePerf.renderMs = performance.now() - renderStartedAt;
      },
    });
    this.battleLoop.start();
    window.addEventListener("resize", this.boundBattleResize ??= () => {
      this.battleRenderer?.resize();
      this.#syncBattleOrientation();
    });
    this.#syncBattleOrientation();

    canvas.addEventListener("pointerdown", (event) => this.#beginBattlePress(event));
    canvas.addEventListener("pointermove", (event) => this.#trackBattlePress(event));
    canvas.addEventListener("pointercancel", () => this.#clearBattlePress());
    canvas.addEventListener("pointerup", (event) => {
      this.#clearBattlePress();
      if (this.battleLongPressConsumed) {
        this.battleLongPressConsumed = false;
        return;
      }
      this.#handleBattleCanvas(event);
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.root.querySelectorAll("[data-unit]").forEach((button) => {
      let detailTimer = null;
      let detailOpened = false;
      const clearDetailTimer = () => {
        clearTimeout(detailTimer);
        detailTimer = null;
      };
      button.addEventListener("pointerdown", () => {
        clearDetailTimer();
        detailOpened = false;
        detailTimer = setTimeout(() => {
          detailOpened = true;
          const definition = getById(content.characters, button.dataset.unit);
          const unit = this.battleSnapshot?.allies?.find((ally) => ally.characterId === button.dataset.unit) ?? {
            characterId: definition.id,
            name: definition.name,
            attack: definition.baseStats?.damage ?? 0,
            range: definition.baseStats?.rangeCells ?? 0,
            priority: definition.targetPolicy ?? "front",
          };
          this.#showBattleUnitDetail(unit);
        }, 550);
      });
      button.addEventListener("pointerup", clearDetailTimer);
      button.addEventListener("pointercancel", clearDetailTimer);
      button.addEventListener("pointerleave", clearDetailTimer);
      button.addEventListener("contextmenu", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        if (detailOpened) {
          detailOpened = false;
          return;
        }
        this.selectedBattleCharacterId = button.dataset.unit;
        this.#cancelActiveAim();
        this.movingBattleUnit = false;
        this.root.querySelectorAll("[data-unit]").forEach((item) => item.classList.toggle("is-selected", item === button));
        const unit = this.battleSnapshot?.allies?.find((ally) => ally.characterId === button.dataset.unit);
        this.root.querySelector("#battle-context").textContent = unit
          ? `${unit.name} · 사거리 ${Number(unit.range ?? 0).toFixed(1)} · ${this.#priorityName(unit.priority)} 우선 · 이동 버튼을 누른 뒤 새 칸을 탭하세요.`
          : `${getById(content.characters, button.dataset.unit)?.name} · 배치 가능한 칸을 탭하세요.`;
      });
    });
    this.root.querySelector('[data-battle="auto"]').addEventListener("click", () => {
      const placed = this.battle.autoPlace();
      this.showToast(`${placed || 0}명의 영웅을 자동 배치했습니다.`);
      this.battleSnapshot = this.battle.getSnapshot();
      this.#renderBattleFrame(true);
    });
    this.root.querySelector("[data-copy-battle-seed]").addEventListener("click", () => this.#copySeed(run.seed));
    this.root.querySelector('[data-battle="move"]').addEventListener("click", (event) => {
      const current = this.battleSnapshot?.allies?.find((ally) => ally.characterId === this.selectedBattleCharacterId);
      if (!current) return this.showToast("배치된 영웅을 먼저 선택하세요.");
      if ((current.relocationCooldown ?? 0) > 0) return this.showToast(`재배치까지 ${current.relocationCooldown.toFixed(1)}초`);
      this.movingBattleUnit = !this.movingBattleUnit;
      event.currentTarget.classList.toggle("is-selected", this.movingBattleUnit);
      this.root.querySelector("#battle-context").textContent = this.movingBattleUnit ? `${current.name}의 새 위치를 탭하세요. 이동 버튼을 다시 누르면 취소합니다.` : "이동을 취소했습니다.";
    });
    this.root.querySelector('[data-battle="recall"]').addEventListener("click", () => {
      if (!this.selectedBattleCharacterId) return this.showToast("회수할 영웅을 선택하세요.");
      if (!this.battle.recall?.(this.selectedBattleCharacterId)) return this.showToast(this.#battleErrorMessage(this.battle.lastActionError));
      this.movingBattleUnit = false;
      this.battleSnapshot = this.battle.getSnapshot();
      this.#renderBattleFrame(true);
      this.showToast("영웅을 회수하고 배치 비용을 100% 환급했습니다.");
    });
    this.root.querySelector('[data-battle="start"]').addEventListener("click", (event) => {
      if (!this.battle.start()) return this.showToast(this.#battleErrorMessage(this.battle.lastActionError));
      event.currentTarget.disabled = true;
      this.controller.run && this.activeMode === "expedition" && this.controller.setPhase("battle", { checkpoint: true });
      this.root.querySelector("#battle-context").textContent = "웨이브 진입 · 공개 위협에 대응하세요";
    });
    this.root.querySelector('[data-battle="active"]').addEventListener("click", (event) => {
      const leader = this.battleSnapshot?.allies?.find((ally) => ally.kind === "leader");
      if (!leader) return this.showToast("주인공을 먼저 배치하세요.");
      if ((leader.activeCooldownRemaining ?? 0) > 0) return this.showToast(`액티브 재사용까지 ${leader.activeCooldownRemaining.toFixed(1)}초`);
      if (this.aimingActive) {
        this.#cancelActiveAim();
      } else {
        this.preAimBattleSpeed = this.battle.speed;
        this.battle.setSpeed(0.2);
        this.aimingActive = true;
        this.root.querySelector('[data-battle="speed"]').textContent = "0.2×";
      }
      event.currentTarget.classList.toggle("is-selected", this.aimingActive);
      this.root.querySelector("#battle-context").textContent = this.aimingActive ? "액티브 대상 지점을 탭하세요. 다시 누르면 취소합니다." : "액티브 조준을 취소했습니다.";
    });
    this.root.querySelector('[data-battle="priority"]').addEventListener("click", (event) => {
      const current = this.battleSnapshot?.allies?.find((ally) => ally.characterId === this.selectedBattleCharacterId);
      if (!current) return this.showToast("배치된 영웅을 먼저 선택하세요.");
      const order = ["front", "strong", "air"];
      const next = order[(order.indexOf(current.priority) + 1) % order.length];
      this.battle.setPriority(this.selectedBattleCharacterId, next);
      event.currentTarget.textContent = this.#priorityName(next);
      this.battleSnapshot = this.battle.getSnapshot();
    });
    this.root.querySelector('[data-battle="pause"]').addEventListener("click", (event) => {
      const paused = this.battle.togglePause();
      event.currentTarget.textContent = paused ? "▶" : "Ⅱ";
    });
    this.root.querySelector('[data-battle="speed"]').addEventListener("click", (event) => {
      if (this.aimingActive) return this.showToast("액티브 조준 중에는 0.2× 전술 감속이 유지됩니다.");
      const next = this.battle.speed >= 2 ? 1 : 2;
      this.battle.setSpeed(next);
      event.currentTarget.textContent = `${next}×`;
    });
    this.root.querySelector('[data-battle="exit"]').addEventListener("click", () => this.#requestBack());
  }

  #handleBattleCanvas(event) {
    const cell = this.battleRenderer.cellFromPointer(event);
    if (!cell) return;
    if (this.aimingActive) {
      if (this.battle.castLeaderActive(cell.col, cell.row)) {
        this.#cancelActiveAim();
        this.showToast("주인공 액티브를 발동했습니다.");
      } else this.showToast(this.#battleErrorMessage(this.battle.lastActionError));
      this.battleSnapshot = this.battle.getSnapshot();
      return;
    }
    const tappedAlly = this.battleSnapshot?.allies?.find((ally) => Math.hypot((ally.x ?? ally.col) - cell.col, (ally.y ?? ally.row) - cell.row) < 0.5);
    if (tappedAlly) {
      this.#selectBattleUnit(tappedAlly.characterId);
      return;
    }
    if (!this.selectedBattleCharacterId) return;
    const existing = this.battleSnapshot?.allies?.find((ally) => ally.characterId === this.selectedBattleCharacterId);
    if (existing && !this.movingBattleUnit) {
      this.showToast("이동 버튼을 누른 뒤 새 칸을 선택하세요.");
      return;
    }
    const ok = existing
      ? this.battle.move(this.selectedBattleCharacterId, cell.col, cell.row)
      : this.battle.place(this.selectedBattleCharacterId, cell.col, cell.row);
    if (!ok) this.showToast(this.#battleErrorMessage(this.battle.lastActionError));
    if (ok) {
      this.movingBattleUnit = false;
      this.root.querySelector('[data-battle="move"]')?.classList.remove("is-selected");
    }
    this.battleSnapshot = this.battle.getSnapshot();
    this.#renderBattleFrame(true);
  }

  #syncBattleOrientation() {
    const portrait = window.matchMedia?.("(orientation: portrait) and (max-width: 900px)")?.matches ?? window.innerHeight > window.innerWidth;
    const startButton = this.root.querySelector('[data-battle="start"]');
    if (startButton) startButton.disabled = portrait || this.battleSnapshot?.phase !== "preparation";
  }

  #beginBattlePress(event) {
    this.#clearBattlePress();
    const cell = this.battleRenderer?.cellFromPointer(event);
    if (!cell) return;
    const ally = this.battleSnapshot?.allies?.find((entry) => Math.hypot((entry.x ?? entry.col) - cell.col, (entry.y ?? entry.row) - cell.row) < 0.5);
    if (!ally) return;
    this.battlePressStart = { x: event.clientX, y: event.clientY };
    this.battlePressTimer = setTimeout(() => {
      this.battleLongPressConsumed = true;
      this.#showBattleUnitDetail(ally);
    }, 550);
  }

  #trackBattlePress(event) {
    if (!this.battlePressStart) return;
    if (Math.hypot(event.clientX - this.battlePressStart.x, event.clientY - this.battlePressStart.y) > 10) this.#clearBattlePress();
  }

  #clearBattlePress() {
    clearTimeout(this.battlePressTimer);
    this.battlePressTimer = null;
    this.battlePressStart = null;
  }

  #selectBattleUnit(characterId) {
    this.selectedBattleCharacterId = characterId;
    this.#cancelActiveAim();
    this.movingBattleUnit = false;
    this.root.querySelector('[data-battle="move"]')?.classList.remove("is-selected");
    this.root.querySelectorAll("[data-unit]").forEach((button) => button.classList.toggle("is-selected", button.dataset.unit === characterId));
    const ally = this.battleSnapshot?.allies?.find((entry) => entry.characterId === characterId);
    if (ally) this.root.querySelector("#battle-context").textContent = `${ally.name} · 사거리 ${Number(ally.range ?? 0).toFixed(1)} · ${this.#priorityName(ally.priority)} 우선 · 이동 버튼을 누른 뒤 새 칸을 탭하세요.`;
  }

  #showBattleUnitDetail(ally) {
    const definition = getById(content.characters, ally.characterId);
    const wasPaused = Boolean(this.battleSnapshot?.paused);
    this.battle?.togglePause?.(true);
    this.showModal({
      title: definition?.name ?? ally.name ?? ally.characterId,
      body: `${escapeHtml(ROLE_NAMES[definition?.rolePrimary] ?? definition?.rolePrimary ?? "영웅")} · ${escapeHtml(getById(content.elements, definition?.element)?.name ?? definition?.element ?? "무속성")}<br />Lv.${ally.level ?? 1}${ally.branch ? ` · 분기 ${escapeHtml(ally.branch)}` : ""} · 공격 ${Math.round(ally.damage ?? ally.attack ?? 0)} · 사거리 ${Number(ally.range ?? 0).toFixed(1)}<br />${this.#priorityName(ally.priority)} 우선 · 재배치 ${Math.max(0, ally.relocationCooldown ?? 0).toFixed(1)}초 · 대상 ${escapeHtml(ally.targetId ?? "없음")}<br /><span class="muted">${escapeHtml(definition?.description ?? definition?.basic?.description ?? "전장을 지키는 원정대 영웅입니다.")}</span>`,
      confirmLabel: "전투로",
      onConfirm: () => {
        if (!wasPaused) this.battle?.togglePause?.(false);
      },
    });
  }

  #cancelActiveAim() {
    if (this.preAimBattleSpeed != null) {
      this.battle?.setSpeed?.(this.preAimBattleSpeed);
      const speedButton = this.root.querySelector('[data-battle="speed"]');
      if (speedButton) speedButton.textContent = `${this.preAimBattleSpeed}×`;
    }
    this.preAimBattleSpeed = null;
    this.aimingActive = false;
    this.root.querySelector('[data-battle="active"]')?.classList.remove("is-selected");
  }

  #renderBattleFrame(forceUi = false) {
    if (!this.battleSnapshot || !this.battleRenderer) return;
    this.battleRenderer.render(this.battleSnapshot, this.currentStagePlan, {
      selectedId: this.selectedBattleCharacterId,
      aiming: this.aimingActive,
      debug: this.controller.settings.debugOverlay,
      debugStats: this.battlePerf,
      damageNumbers: this.controller.settings.damageNumbers,
    });
    const now = performance.now();
    if (!forceUi && now - this.battleUiLastAt < 100) return;
    this.battleUiLastAt = now;
    const snapshot = this.battleSnapshot;
    const coreHp = Math.max(0, Math.round(snapshot.core?.hp ?? 0));
    const coreMax = Math.max(1, Math.round(snapshot.core?.maxHp ?? 100));
    this.root.querySelector("#core-value").textContent = `${coreHp}/${coreMax}`;
    this.root.querySelector("#core-meter-fill").style.width = `${(coreHp / coreMax) * 100}%`;
    this.root.querySelector("#shield-value").textContent = `SHIELD ${Math.round(snapshot.core?.shield ?? 0)}`;
    const defeated = snapshot.stats?.enemiesDefeated ?? snapshot.stats?.kills ?? 0;
    this.root.querySelector("#enemy-count").textContent = `${snapshot.enemies?.length ?? 0} / ${Math.max(0, (this.currentStagePlan.totalEnemies ?? 0) - defeated)}`;
    this.root.querySelector("#battle-time").textContent = formatTime(snapshot.time ?? 0);
    for (const character of [this.activeMode === "expedition" ? this.controller.run : this.specialRun].flatMap((run) => [run.deck.leaderId, ...run.deck.companionIds])) {
      const ally = snapshot.allies?.find((entry) => entry.characterId === character);
      const target = this.root.querySelector(`[data-unit-state="${character}"]`);
      if (!target) continue;
      target.textContent = ally ? `${this.#priorityName(ally.priority)} · 이동 ${Math.max(0, ally.relocationCooldown ?? 0).toFixed(1)}초` : "미배치";
    }
    const leader = snapshot.allies?.find((ally) => ally.kind === "leader");
    this.root.querySelector("#active-cooldown").textContent = !leader || (leader.activeCooldownRemaining ?? 0) <= 0 ? "READY" : `${leader.activeCooldownRemaining.toFixed(1)}초`;
  }

  #onBattleEvent(event) {
    if (event.type === "wave_warning") {
      const elementName = getById(content.elements, event.primaryElement)?.name ?? event.primaryElement;
      const threats = (event.threats ?? []).map((threat) => getById(content.enemies, threat)?.name ?? ({ elite: "정예", mixed: "혼합", air: "공중" })[threat] ?? threat);
      const label = `다음 웨이브 ${event.waveNumber ?? ""} · ${threats.join(" · ") || "혼합"}${elementName ? ` · 주 속성 ${elementName}` : ""}`;
      this.root.querySelector("#battle-context")?.replaceChildren(document.createTextNode(label));
      this.#showBattleWarning(label, Math.max(1200, Math.min(8000, Number(event.startsIn ?? event.leadSeconds ?? 8) * 1000)));
    }
    if (["boss_warning", "boss_pattern_warning", "boss_telegraph"].includes(event.type)) {
      this.#showBattleWarning(`보스 경고 · ${event.label ?? event.patternName ?? event.patternId ?? "강력한 기술"}`, Math.max(1000, Number(event.duration ?? event.telegraphSeconds ?? event.telegraph ?? 1.2) * 1000));
    }
    if (event.type === "core_approach_warning") this.#showBattleWarning("코어 접근 위험 · 경로 끝 적을 집중 공격하세요", 1200);
    if (event.type === "core_damaged") {
      if (this.controller.settings.vibration) navigator.vibrate?.(30);
      const stage = this.root.querySelector(".battle-stage");
      if (stage && this.controller.settings.screenShake) {
        stage.classList.remove("is-shaking");
        requestAnimationFrame(() => stage.classList.add("is-shaking"));
        setTimeout(() => stage.classList.remove("is-shaking"), 320);
      }
      if (stage && this.controller.settings.flashes) {
        stage.classList.add("is-flashing");
        setTimeout(() => stage.classList.remove("is-flashing"), 180);
      }
      this.#playBattleTone("core");
    }
    if (event.type === "leader_active") this.#playBattleTone("active");
    if (event.type === "wave_warning" || event.type === "boss_warning") this.#playBattleTone("warning");
  }

  #playBattleTone(kind) {
    if (!this.controller.settings.sound) return;
    try {
      const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioContext ??= new AudioContextClass();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const now = this.audioContext.currentTime;
      const frequencies = { warning: 520, core: 150, active: 780 };
      oscillator.type = kind === "core" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequencies[kind] ?? 360, now);
      if (kind === "warning") oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      oscillator.connect(gain).connect(this.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    } catch {
      // Audio is optional; visual warnings and all game logic remain available.
    }
  }

  #showBattleWarning(message, durationMs = 1400) {
    const target = this.root.querySelector("#battle-message");
    if (!target) return;
    clearTimeout(this.battleWarningTimer);
    target.textContent = message;
    target.classList.remove("is-hidden");
    target.classList.add("is-warning");
    this.battleWarningTimer = setTimeout(() => {
      target.classList.add("is-hidden");
      target.classList.remove("is-warning");
    }, durationMs);
  }

  #finishBattle(success, snapshot) {
    if (!this.battle) return;
    const normalized = this.#normalizeBattleSnapshot(snapshot);
    this.#disposeBattle();
    if (this.activeMode === "expedition") {
      if (success) {
        const result = this.controller.completeStage(normalized);
        this.router.replace(result.next);
      } else {
        this.controller.failRun(normalized);
        this.router.replace("result");
      }
      return;
    }
    if (this.activeMode === "challenge" && success && this.challengeContext) {
      const records = this.controller.meta.records;
      const stars = this.#challengeStarCount(this.challengeContext, normalized);
      records.challengeStars[this.challengeContext.id] = Math.max(records.challengeStars[this.challengeContext.id] ?? 0, stars);
      this.repository.saveMeta(this.controller.meta);
      this.controller.refreshChallengeUnlocks?.();
      normalized.challengeStars = stars;
    }
    const destination = this.activeMode === "challenge" ? "challenges" : "training";
    const title = success ? "훈련 목표 달성" : "코어가 파괴되었습니다";
    this.specialRun = null;
    this.showModal({
      title,
      body: `${success ? "전술이 정상 작동했습니다." : "배치와 우선순위를 조정해 보세요."}<br />전투 시간 ${formatTime(normalized.stats.elapsedSeconds)} · 처치 ${normalized.stats.kills}${this.activeMode === "challenge" && success ? `<br />획득 별 ${"★".repeat(normalized.challengeStars ?? 1)}${"☆".repeat(3 - (normalized.challengeStars ?? 1))}` : ""}`,
      confirmLabel: "목록으로",
      onConfirm: () => this.router.replace(destination),
    });
  }

  #normalizeBattleSnapshot(snapshot = {}) {
    const stats = snapshot.stats ?? {};
    const byCharacter = Object.fromEntries(Object.entries(stats.byCharacter ?? {}).map(([id, value]) => [id, {
      ...value,
      advantageDamage: value.advantageDamage ?? value.advantageousDamage ?? 0,
      statusesApplied: value.statusesApplied ?? value.statusApplications ?? 0,
      controlSeconds: value.controlSeconds ?? value.controlTime ?? 0,
    }]));
    return {
      ...snapshot,
      core: snapshot.core ?? { hp: 0, shield: 0 },
      stats: {
        ...stats,
        kills: stats.kills ?? stats.enemiesDefeated ?? 0,
        advantageDamage: stats.advantageDamage ?? stats.advantageousDamage ?? 0,
        aerialDamage: stats.aerialDamage ?? Object.values(byCharacter).reduce((sum, item) => sum + (item.aerialDamage ?? 0), 0),
        areaDamage: stats.areaDamage ?? Object.values(byCharacter).reduce((sum, item) => sum + (item.areaDamage ?? 0), 0),
        controlSeconds: stats.controlSeconds ?? stats.controlTime ?? 0,
        statusesApplied: stats.statusesApplied ?? stats.statusApplications ?? 0,
        activeUses: stats.activeUses ?? Object.values(byCharacter).reduce((sum, item) => sum + (item.activeUses ?? 0), 0),
        elapsedSeconds: stats.elapsedSeconds ?? stats.elapsedTime ?? snapshot.time ?? 0,
        byCharacter,
      },
    };
  }

  #challengeStarCount(challenge, snapshot) {
    const stats = snapshot.stats ?? {};
    const conditions = challenge.starConditions ?? [{ id: "clear" }];
    return conditions.reduce((stars, condition) => {
      let met = false;
      if (condition.id === "clear") met = true;
      if (condition.id === "core_no_damage") met = (stats.coreDamageTaken ?? 0) <= 0;
      if (condition.id === "time_under_300") met = (stats.elapsedSeconds ?? Infinity) <= (condition.limitSeconds ?? 300);
      if (condition.id === "corrosion_breaks") met = (stats.corrosionBreaks ?? 0) >= (condition.minimum ?? 1);
      if (condition.id === "core_hp_70") met = (snapshot.core?.hp ?? 0) >= (condition.minimum ?? 70);
      if (condition.id === "delayed_damage_ratio") met = (stats.delayedDamage ?? 0) / Math.max(1, stats.damage ?? 0) >= (condition.minimumRatio ?? 0.35);
      return stars + Number(met);
    }, 0);
  }

  #priorityName(priority) {
    return ({ front: "선두", strong: "강적", air: "공중" })[priority] ?? "선두";
  }

  #battleErrorMessage(reason) {
    return ({
      character_not_in_deck: "현재 덱에 없는 영웅입니다.",
      outside_grid: "보드 밖에는 배치할 수 없습니다.",
      occupied: "이미 다른 영웅이 있는 칸입니다.",
      leader_node_required: "주인공은 금색 리더 거점에만 배치할 수 있습니다.",
      path_blocked: "적 이동 경로에는 배치할 수 없습니다.",
      obstacle: "장애물이 있는 칸입니다.",
      core: "코어 칸에는 배치할 수 없습니다.",
      insufficient_gold: "배치 금화가 부족합니다.",
      relocation_cooldown: "재배치 쿨다운이 남았습니다.",
      leader_required: "전투 시작 전에 주인공을 배치하세요.",
      active_cooldown: "액티브 쿨다운이 남았습니다.",
      recall_running: "전투 중에는 영웅을 회수할 수 없습니다.",
      ally_not_placed: "배치된 영웅을 먼저 선택하세요.",
    })[reason] ?? "지금은 이 명령을 실행할 수 없습니다.";
  }

  #disposeBattleIfLeaving(nextName) {
    if (nextName !== "battle" && this.battle) this.#disposeBattle();
  }

  #disposeBattle() {
    clearTimeout(this.battleWarningTimer);
    this.battleWarningTimer = null;
    this.battleLoop?.stop();
    this.battleLoop = null;
    this.battle?.destroy?.();
    this.battle = null;
    this.battleRenderer = null;
    this.battleSnapshot = null;
    this.selectedBattleCharacterId = null;
    this.movingBattleUnit = false;
    this.#cancelActiveAim();
    this.#clearBattlePress();
    this.battleLongPressConsumed = false;
    window.removeEventListener("resize", this.boundBattleResize);
  }
}
