import { DEFAULT_FORMATION, MAIN_HEROES, NORMAL_HEROES } from '../../content/heroes.js';
import { drawResolvedSprite } from '../../render/SpriteResolver.js';

const roleNames = Object.freeze({ dealer: '딜러', balancer: '밸런서', buffer: '버퍼', debuffer: '디버퍼' });

export class FormationScreen {
  constructor({ stageId, initialFormation, assetManager, onBack, onReady } = {}) {
    this.stageId = stageId;
    this.onBack = onBack;
    this.onReady = onReady;
    this.assetManager = assetManager;
    this.mainId = initialFormation?.mainId ?? DEFAULT_FORMATION.mainId;
    this.heroIds = [...(initialFormation?.heroIds ?? DEFAULT_FORMATION.heroIds)];
    this.root = null;
  }

  mount(root) {
    this.root = root;
    this.#render();
  }

  #render() {
    this.root.innerHTML = `
      <section class="screen formation-screen" data-screen="formation">
        <header class="compact-header"><button class="icon-button" type="button" data-action="back" aria-label="뒤로">‹</button><div><span class="eyebrow">출전 편성</span><h1>별의 수호대를 골라줘</h1></div><span class="formation-count">${1 + this.heroIds.length}/5</span></header>
        <div class="formation-scroll">
          <section class="roster-section"><div class="section-title"><h2>메인 영웅</h2><span>1명 필수</span></div><div class="hero-grid hero-grid--main">${MAIN_HEROES.map((hero) => this.#heroCard(hero, this.mainId === hero.id)).join('')}</div></section>
          <section class="roster-section"><div class="section-title"><h2>일반 영웅</h2><span>4명 필수 · 중복 불가</span></div><div class="hero-grid hero-grid--normal">${NORMAL_HEROES.map((hero) => this.#heroCard(hero, this.heroIds.includes(hero.id))).join('')}</div></section>
        </div>
        <footer class="formation-footer">
          <div class="selected-slots">${[this.mainId, ...this.heroIds, ...Array(5).fill(null)].slice(0, 5).map((id, index) => `<span class="selected-slot ${id ? 'filled' : ''}">${id ? this.#name(id) : index + 1}</span>`).join('')}</div>
          <button class="primary-button" type="button" data-action="ready" ${this.heroIds.length === 4 ? '' : 'disabled'}>전투 준비</button>
        </footer>
        <div class="sheet-backdrop" data-sheet hidden><section class="info-sheet" role="dialog" aria-modal="true"><button class="sheet-close icon-button" type="button" data-action="close-sheet" aria-label="닫기">×</button><div data-sheet-body></div></section></div>
      </section>`;
    this.root.querySelector('[data-action="back"]').addEventListener('click', this.onBack);
    this.root.querySelector('[data-action="ready"]').addEventListener('click', () => this.onReady({ mainId: this.mainId, heroIds: [...this.heroIds] }));
    for (const card of this.root.querySelectorAll('[data-hero-id]')) {
      card.querySelector('[data-action="select"]').addEventListener('click', () => this.#select(card.dataset.heroId, card.dataset.position));
      card.querySelector('[data-action="info"]').addEventListener('click', (event) => { event.stopPropagation(); this.#openInfo(card.dataset.heroId); });
    }
    this.root.querySelector('[data-action="close-sheet"]').addEventListener('click', () => this.#closeInfo());
    this.root.querySelector('[data-sheet]').addEventListener('click', (event) => { if (event.target === event.currentTarget) this.#closeInfo(); });
    this.#paintPortraits();
  }

  #heroCard(hero, selected) {
    return `<article class="hero-card ${selected ? 'selected' : ''}" data-hero-id="${hero.id}" data-position="${hero.position}">
      <button class="hero-card__select" type="button" data-action="select"><canvas class="hero-portrait hero-emblem--${hero.element}" data-portrait="${hero.id}" width="96" height="96" aria-hidden="true"></canvas><span class="hero-card__copy"><b>${hero.name}</b><small>${roleNames[hero.role]} · ${hero.attack.archetype}</small></span><span class="selection-mark">✓</span></button>
      <button class="hero-info-button" type="button" data-action="info" aria-label="${hero.name} 정보">i</button>
    </article>`;
  }

  #select(id, position) {
    if (position === 'main') this.mainId = id;
    else if (this.heroIds.includes(id)) this.heroIds = this.heroIds.filter((candidate) => candidate !== id);
    else if (this.heroIds.length < 4) this.heroIds.push(id);
    this.#render();
  }

  #paintPortraits() {
    const ids = [...MAIN_HEROES, ...NORMAL_HEROES].map((hero) => `portrait/${hero.id}`);
    const paint = () => {
      if (!this.root) return;
      for (const canvas of this.root.querySelectorAll('[data-portrait]')) {
        const assetId = `portrait/${canvas.dataset.portrait}`;
        const image = this.assetManager?.getImage(assetId);
        const entry = this.assetManager?.getEntry(assetId);
        const context = canvas.getContext('2d');
        if (!context || !image) continue;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawResolvedSprite(context, { image, frame: entry?.frame ?? null }, {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        });
      }
    };
    paint();
    this.assetManager?.preload(ids).then(paint).catch(() => {});
  }

  #openInfo(id) {
    const hero = [...MAIN_HEROES, ...NORMAL_HEROES].find((candidate) => candidate.id === id);
    const sheet = this.root.querySelector('[data-sheet]');
    sheet.querySelector('[data-sheet-body]').innerHTML = `<span class="eyebrow">${roleNames[hero.role]}</span><h2>${hero.name}</h2><h3>${hero.skill.name}</h3><p>${hero.skill.shape === 'area' ? `범위 ${hero.skill.radius}` : hero.skill.shape === 'melee' ? '근접 한방' : '단일'} · 쿨타임 ${hero.skill.cooldown}초 · 피해 ${hero.skill.damage}</p><div class="trait-list">${hero.traits.map((trait) => `<div><b>Lv${trait.level} ${trait.name}</b><small>${trait.effects.map((effect) => effect.type.replaceAll('_', ' ')).join(' · ')}</small></div>`).join('')}</div>`;
    sheet.hidden = false;
  }

  #closeInfo() { this.root.querySelector('[data-sheet]').hidden = true; }
  #name(id) { return [...MAIN_HEROES, ...NORMAL_HEROES].find((hero) => hero.id === id)?.name ?? id; }
  destroy() { this.root = null; }
}

export default FormationScreen;
