import { DEFAULT_FORMATION, MAIN_HEROES, NORMAL_HEROES } from "../../content/heroes.js";
import { HERO_COPY, JOURNEYS } from "../../content/presentation.js";
import { paintPortraits } from "../../render/Illustrations.js";
import { openFieldGuide } from '../FieldGuide.js';
import { ATTACK_LABELS } from '../FieldGuide.js';
import { AURA_BUFF_BY_ID } from '../../content/buffs.js';
import { ELEMENT_IDS, ELEMENT_LABELS } from '../../content/combat.js';
const number = value => Number(value.toFixed(2));
export class FormationScreen {
  constructor(options = {}) {
    Object.assign(this, options);
    this.mainId = this.initialFormation?.mainId ?? DEFAULT_FORMATION.mainId;
    this.heroIds = [...this.initialFormation?.heroIds ?? DEFAULT_FORMATION.heroIds];
    this.elementFilter = 'all';
  }
  mount(root) {
    this.root = root;
    this.render();
    this.onResize = () => {
      if (this.root) paintPortraits(this.root, this.assetManager);
    };
    globalThis.addEventListener?.('resize', this.onResize);
  }
  render() {
    const count = 1 + this.heroIds.length;
    const roster = NORMAL_HEROES.filter(hero => this.elementFilter === 'all' || hero.element === this.elementFilter);
    this.root.innerHTML = `<section class="screen formation-screen" data-screen="formation">
      <header class="compact-header"><button class="icon-button" data-action="back" aria-label="뒤로">‹</button><div><span class="eyebrow">${JOURNEYS[this.stageId].title}</span><h1>함께할 수호자</h1></div><span class="formation-count">${count}<small>/ 5</small></span></header>
      <div class="formation-tools"><p class="formation-advice">주인공 1명 + 동료 4명 · 공격 역할과 오라를 조합하세요.</p><button class="text-button" data-action="guide">상성표 ↗</button></div>
      <div class="formation-scroll"><section class="roster-section"><div class="section-title"><h2>이야기의 주인공</h2><span>1명 선택</span></div><div class="hero-grid hero-grid--main">${MAIN_HEROES.map((h) => this.card(h, this.mainId === h.id)).join("")}</div></section>
      <section class="roster-section"><div class="section-title"><h2>믿음직한 동료들</h2><span>4명 선택 · 눌러서 교대</span></div><nav class="roster-filters" aria-label="동료 속성 필터">${['all',...ELEMENT_IDS].map(id=>`<button type="button" data-element-filter="${id}" aria-pressed="${id===this.elementFilter}">${id==='all'?'전체':ELEMENT_LABELS[id]}</button>`).join('')}</nav><div class="hero-grid hero-grid--normal">${roster.map((h) => this.card(h, this.heroIds.includes(h.id))).join("")}</div></section></div>
      <footer class="formation-footer"><p>${this.heroIds.length === 4 ? "준비됐어요. 이제 우리의 자리를 찾아볼까요?" : `동료 ${4 - this.heroIds.length}명을 더 골라주세요.`}</p><button class="primary-button" data-action="ready" ${this.heroIds.length === 4 ? "" : "disabled"}>전장으로 출발 <span>→</span></button></footer>
      <div class="sheet-backdrop" data-sheet hidden><section class="info-sheet" role="dialog" aria-modal="true" aria-label="수호자 정보"><button class="sheet-close icon-button" data-action="close-sheet" aria-label="닫기">×</button><div data-sheet-body></div></section></div></section>`;
    this.root.querySelector('[data-action="back"]').onclick = this.onBack;
    this.root.querySelector('[data-action="guide"]').onclick = () => openFieldGuide(this.root);
    this.root.querySelector('[data-action="ready"]').onclick = () => this.onReady({ mainId: this.mainId, heroIds: [...this.heroIds] });
    for (const button of this.root.querySelectorAll('[data-element-filter]')) button.onclick=()=>{
      const scrollTop=this.root.querySelector('.formation-scroll').scrollTop;
      this.elementFilter=button.dataset.elementFilter; this.render();
      this.root.querySelector('.formation-scroll').scrollTop=scrollTop;
    };
    for (const card of this.root.querySelectorAll("[data-hero-id]")) {
      card.querySelector('[data-action="select"]').onclick = () => {
        const id = card.dataset.heroId;
        if (card.dataset.position === "main") this.mainId = id;
        else if (this.heroIds.includes(id)) this.heroIds = this.heroIds.filter((x) => x !== id);
        else if (this.heroIds.length < 4) this.heroIds.push(id);
        else { this.openSwap(id); return; }
        const scrollTop = this.root.querySelector('.formation-scroll').scrollTop;
        this.render();
        this.root.querySelector('.formation-scroll').scrollTop = scrollTop;
      };
      card.querySelector('[data-action="info"]').onclick = () => this.openInfo(card.dataset.heroId);
    }
    const sheet = this.root.querySelector("[data-sheet]");
    this.root.querySelector('[data-action="close-sheet"]').onclick = () => {
      this.closeSheet();
    };
    sheet.onclick = (e) => {
      if (e.target === sheet) this.closeSheet();
    };
    sheet.onkeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); this.closeSheet(); }
      if (event.key === 'Tab') {
        const buttons=[...sheet.querySelectorAll('button')], at=buttons.indexOf(document.activeElement);
        event.preventDefault(); buttons[(at+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
      }
    };
    paintPortraits(this.root, this.assetManager);
  }
  card(hero, selected) {
    const [title, role] = HERO_COPY[hero.id];
    return `<article class="hero-card ${selected ? "selected" : ""}" data-hero-id="${hero.id}" data-position="${hero.position}"><button class="hero-card__select" data-action="select" aria-pressed="${selected}"><canvas class="hero-portrait" data-portrait="${hero.id}" width="200" height="180"></canvas><span class="hero-card__copy"><small>${title}</small><b>${hero.name}</b><em>${role}</em></span><span class="selection-mark">✓</span></button><button class="hero-info-button" data-action="info" aria-label="${hero.name} 정보">i</button></article>`;
  }
  openInfo(id) {
    const hero = [...MAIN_HEROES, ...NORMAL_HEROES].find((h) => h.id === id), copy = HERO_COPY[id], sheet = this.root.querySelector("[data-sheet]");
    sheet.querySelector("[data-sheet-body]").innerHTML = `<span class="eyebrow">${copy[0]}</span><h2>${hero.name}</h2><p>${copy[2]}</p><div class="stat-grid"><div><small>공격</small><strong>${number(hero.attack.damage)}</strong></div><div><small>사거리</small><strong>${hero.attack.range}</strong></div></div><h3>${hero.skill.name}</h3><p>${hero.skill.cooldown}초마다 자동 발동 · ${number(hero.skill.damage)} 피해</p><div class="trait-list">${hero.traits.map((t) => `<div><b>Lv${t.level} · ${t.name}</b><small>${t.description}</small></div>`).join("")}</div>`;
    const detail = document.createElement('p');
    detail.className = 'hero-combat-details';
    const range = hero.attack.archetype === 'nova' ? hero.attack.radius : hero.attack.range;
    detail.textContent = `${ATTACK_LABELS[hero.attack.attackType]} · ${number(hero.attack.interval)}초 간격 · 사거리 ${range}`;
    sheet.querySelector('[data-sheet-body] h3').before(detail);
    for (const aura of hero.innateAuras ?? []) {
      const row = document.createElement('p'), buff=AURA_BUFF_BY_ID[aura.buffId];
      row.textContent = `기본 오라 · ${buff.displayName} / 범위 ${aura.range} · ${buff.description}`;
      detail.after(row);
    }
    this.showSheet();
  }
  showSheet() {
    this.previousFocus = document.activeElement;
    const sheet=this.root.querySelector('[data-sheet]'); sheet.hidden=false; sheet.querySelector('button').focus();
  }
  closeSheet() { this.root.querySelector('[data-sheet]').hidden=true; this.previousFocus?.focus?.(); }
  openSwap(id) {
    const sheet=this.root.querySelector('[data-sheet]'), candidate=NORMAL_HEROES.find(h=>h.id===id);
    sheet.querySelector('[data-sheet-body]').innerHTML = `<span class="eyebrow">수호대 교대</span><h2>${candidate.name} 합류</h2><p>교대할 동료를 선택하세요.</p><div class="swap-roster">${this.heroIds.map(current=>`<button data-replace="${current}"><canvas data-portrait="${current}" width="96" height="96"></canvas><b>${NORMAL_HEROES.find(h=>h.id===current).name}</b><span>교대 ↗</span></button>`).join('')}</div>`;
    for(const button of sheet.querySelectorAll('[data-replace]')) button.onclick=()=>{
      this.heroIds=this.heroIds.map(current=>current===button.dataset.replace?id:current);
      const scroll=this.root.querySelector('.formation-scroll').scrollTop;
      this.render(); this.root.querySelector('.formation-scroll').scrollTop=scroll;
    };
    this.showSheet(); paintPortraits(sheet,this.assetManager);
  }
  destroy() {
    globalThis.removeEventListener?.('resize', this.onResize);
    this.root = null;
  }
}
export default FormationScreen;
