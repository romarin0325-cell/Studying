import { DEFAULT_FORMATION, MAIN_HEROES, NORMAL_HEROES } from "../../content/heroes.js";
import { HERO_COPY, JOURNEYS } from "../../content/presentation.js";
import { paintPortraits } from "../../render/Illustrations.js";
export class FormationScreen {
  constructor(options = {}) {
    Object.assign(this, options);
    this.mainId = this.initialFormation?.mainId ?? DEFAULT_FORMATION.mainId;
    this.heroIds = [...this.initialFormation?.heroIds ?? DEFAULT_FORMATION.heroIds];
  }
  mount(root) {
    this.root = root;
    this.render();
  }
  render() {
    const count = 1 + this.heroIds.length;
    this.root.innerHTML = `<section class="screen formation-screen" data-screen="formation">
      <header class="compact-header"><button class="icon-button" data-action="back" aria-label="뒤로">‹</button><div><span class="eyebrow">${JOURNEYS[this.stageId].title}</span><h1>함께할 수호자</h1></div><span class="formation-count">${count}<small>/ 5</small></span></header>
      <p class="formation-advice">${JOURNEYS[this.stageId].counter}</p>
      <div class="formation-scroll"><section class="roster-section"><div class="section-title"><h2>이야기의 주인공</h2><span>1명 선택</span></div><div class="hero-grid hero-grid--main">${MAIN_HEROES.map((h) => this.card(h, this.mainId === h.id)).join("")}</div></section>
      <section class="roster-section"><div class="section-title"><h2>믿음직한 동료들</h2><span>4명 선택 · 선택 해제 후 교체</span></div><div class="hero-grid hero-grid--normal">${NORMAL_HEROES.map((h) => this.card(h, this.heroIds.includes(h.id))).join("")}</div></section></div>
      <footer class="formation-footer"><p>${this.heroIds.length === 4 ? "준비됐어요. 이제 우리의 자리를 찾아볼까요?" : `동료 ${4 - this.heroIds.length}명을 더 골라주세요.`}</p><button class="primary-button" data-action="ready" ${this.heroIds.length === 4 ? "" : "disabled"}>정원으로 출발 <span>→</span></button></footer>
      <div class="sheet-backdrop" data-sheet hidden><section class="info-sheet" role="dialog" aria-modal="true" aria-label="수호자 정보"><button class="sheet-close icon-button" data-action="close-sheet" aria-label="닫기">×</button><div data-sheet-body></div></section></div></section>`;
    this.root.querySelector('[data-action="back"]').onclick = this.onBack;
    this.root.querySelector('[data-action="ready"]').onclick = () => this.onReady({ mainId: this.mainId, heroIds: [...this.heroIds] });
    for (const card of this.root.querySelectorAll("[data-hero-id]")) {
      card.querySelector('[data-action="select"]').onclick = () => {
        const id = card.dataset.heroId;
        if (card.dataset.position === "main") this.mainId = id;
        else if (this.heroIds.includes(id)) this.heroIds = this.heroIds.filter((x) => x !== id);
        else if (this.heroIds.length < 4) this.heroIds.push(id);
        else {
          this.root.querySelector(".formation-advice").textContent = "선택한 동료 한 명을 눌러 해제한 뒤 교체해 주세요.";
          return;
        }
        this.render();
      };
      card.querySelector('[data-action="info"]').onclick = () => this.openInfo(card.dataset.heroId);
    }
    const sheet = this.root.querySelector("[data-sheet]");
    this.root.querySelector('[data-action="close-sheet"]').onclick = () => {
      sheet.hidden = true;
    };
    sheet.onclick = (e) => {
      if (e.target === sheet) sheet.hidden = true;
    };
    paintPortraits(this.root, this.assetManager);
  }
  card(hero, selected) {
    const [title, role] = HERO_COPY[hero.id];
    return `<article class="hero-card ${selected ? "selected" : ""}" data-hero-id="${hero.id}" data-position="${hero.position}"><button class="hero-card__select" data-action="select" aria-pressed="${selected}"><canvas class="hero-portrait" data-portrait="${hero.id}" width="200" height="180"></canvas><span class="hero-card__copy"><small>${title}</small><b>${hero.name}</b><em>${role}</em></span><span class="selection-mark">✓</span></button><button class="hero-info-button" data-action="info" aria-label="${hero.name} 정보">i</button></article>`;
  }
  openInfo(id) {
    const hero = [...MAIN_HEROES, ...NORMAL_HEROES].find((h) => h.id === id), copy = HERO_COPY[id], sheet = this.root.querySelector("[data-sheet]");
    sheet.querySelector("[data-sheet-body]").innerHTML = `<span class="eyebrow">${copy[0]}</span><h2>${hero.name}</h2><p>${copy[2]}</p><div class="stat-grid"><div><small>공격</small><strong>${hero.attack.damage}</strong></div><div><small>사거리</small><strong>${hero.attack.range}</strong></div></div><h3>${hero.skill.name}</h3><p>${hero.skill.cooldown}초마다 자동 발동 · ${hero.skill.damage} 피해</p><div class="trait-list">${hero.traits.map((t) => `<div><b>Lv${t.level} · ${t.name}</b><small>${t.description}</small></div>`).join("")}</div>`;
    sheet.hidden = false;
  }
  destroy() {
    this.root = null;
  }
}
export default FormationScreen;
