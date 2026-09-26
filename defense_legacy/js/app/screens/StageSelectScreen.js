import { STAGES } from "../../content/stages.js";
import { openFieldGuide } from '../FieldGuide.js';
import { bindFullscreen } from '../Fullscreen.js';
import { ENEMY_BY_ID } from "../../content/enemies.js";
import { JOURNEYS, DEFENSE_LABELS, worldStyle } from "../../content/presentation.js";
export class StageSelectScreen {
  constructor(options = {}) {
    Object.assign(this, options);
    this.selected = this.stageId ?? STAGES[0].id;
    this.difficultyId ??= "easy";
  }
  mount(root) {
    this.root = root;
    this.render();
  }
  render() {
    this.unbindFullscreen?.();
    const stage = STAGES.find((s) => s.id === this.selected), journey = JOURNEYS[stage.id];
    const record = this.progress?.[`${stage.id}:${this.difficultyId}`];
    this.root.innerHTML = `<section class="screen stage-select-screen" data-screen="stage-select">
      <header class="app-header"><div class="brand-lockup"><span class="brand-kicker">STARWARD · DEFENSE</span><h1>별의 수호자</h1></div><nav class="header-tools" aria-label="게임 메뉴"><button class="icon-button" data-action="guide" aria-label="상성표와 전투 도감">?</button><button class="icon-button" data-action="fullscreen" aria-label="전체화면">⛶</button><button class="icon-button" data-action="settings" aria-label="설정">⚙</button></nav></header>
      ${this.checkpoint ? `<button class="continue-banner" data-action="continue">이어지는 이야기 <b>${JOURNEYS[this.checkpoint.stageId]?.title ?? "전투"} · W${this.checkpoint.nextWave}</b><span>계속하기 →</span></button>` : ""}
      <div class="journey-scene" style="${worldStyle(journey.art)}"><div class="scene-vignette"></div><span class="chapter-label">CHAPTER ${journey.chapter}</span><div class="journey-title"><span>${journey.subtitle}</span><h2>${journey.title}</h2><p>${record ? "★".repeat(record.stars) + "☆".repeat(3 - record.stars) + "  수호 완료" : "아직 쓰이지 않은 이야기"}</p></div><div class="scene-spark s1">✦</div><div class="scene-spark s2">✧</div></div>
      <nav class="chapter-tabs" aria-label="여정 선택">${STAGES.map((s) => `<button data-stage="${s.id}" aria-pressed="${s.id === this.selected}" class="chapter-tab ${s.id === this.selected ? "active" : ""}"><small>${JOURNEYS[s.id].chapter}</small><b>${JOURNEYS[s.id].title}</b></button>`).join("")}</nav>
      <div class="journey-brief"><div><span class="eyebrow">이번 여정의 전략</span><p>${journey.note}</p></div><div class="difficulty-options" aria-label="난도"><button data-difficulty="easy" aria-pressed="${this.difficultyId === "easy"}">이야기</button><button data-difficulty="normal" aria-pressed="${this.difficultyId === "normal"}">시련</button></div></div>
      <div class="wave-preview"><div class="section-title"><h3>다가오는 적</h3><span>눌러서 적 정보</span></div><div class="wave-strip" data-wave-strip="${stage.id}">${stage.waves.map((w, i) => `<button class="wave-chip ${w.kind === "boss" ? "wave-chip--boss" : ""}" data-wave-chip="${stage.id}:${i + 1}" aria-label="${i + 1}웨이브 ${ENEMY_BY_ID[w.groups[0].enemyId].name}"><small>${w.kind === "boss" ? "♛" : String(i + 1).padStart(2, "0")}</small><span>${DEFENSE_LABELS[ENEMY_BY_ID[w.groups[0].enemyId].defenseType]}</span></button>`).join("")}</div><p class="wave-detail" data-wave-detail>${this.difficultyId === "normal" ? "시련 · 더 강하고 빠른 적 · 최종 보스 저지 필수" : "10개 웨이브 · 중간 보스와 최종 보스"}</p></div>
      <footer class="journey-footer"><span>수호자 5명과 함께하는 작은 모험</span><button class="primary-button" data-action="formation" data-stage-id="${stage.id}">수호대 편성 <span>→</span></button></footer>
    </section>`;
    this.root.querySelector('[data-action="settings"]').onclick = this.onSettings;
    this.root.querySelector('[data-action="guide"]').onclick = () => openFieldGuide(this.root);
    this.unbindFullscreen = bindFullscreen(this.root);
    this.root.querySelector('[data-action="continue"]')?.addEventListener("click", this.onContinue);
    this.root.querySelector('[data-action="formation"]').onclick = () => this.onFormation(stage.id, this.difficultyId);
    for (const button of this.root.querySelectorAll("[data-difficulty]")) button.onclick = () => {
      this.difficultyId = button.dataset.difficulty;
      this.render();
    };
    for (const button of this.root.querySelectorAll("[data-stage]")) button.onclick = () => {
      this.selected = button.dataset.stage;
      this.render();
    };
    for (const button of this.root.querySelectorAll("[data-wave-chip]")) button.onclick = () => {
      const number = Number(button.dataset.waveChip.split(":")[1]), wave = stage.waves[number - 1], enemy = ENEMY_BY_ID[wave.groups[0].enemyId];
      this.root.querySelector("[data-wave-detail]").textContent = `W${number} ${enemy.name} ×${wave.enemyCount} · ${DEFENSE_LABELS[enemy.defenseType]}형`;
      for (const chip of this.root.querySelectorAll("[data-wave-chip]")) chip.classList.toggle("active", chip === button);
    };
  }
  destroy() {
    this.unbindFullscreen?.();
    this.root = null;
  }
}
export default StageSelectScreen;
