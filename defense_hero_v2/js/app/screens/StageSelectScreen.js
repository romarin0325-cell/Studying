import { ENEMY_BY_ID } from '../../content/enemies.js';
import { STAGES } from '../../content/stages.js';

const defenseNames = Object.freeze({ normal: '일반', air: '공중', heavy: '중갑', regeneration: '재생', demon: '악마', boss: '보스' });
const elementNames = Object.freeze({ fire: '불', water: '물', nature: '자연', light: '빛', dark: '어둠' });
const DEFENSE_COLORS = Object.freeze({
  normal: '#f5d48a', air: '#8ce5ff', heavy: '#aeb8cf', regeneration: '#70dc8c', demon: '#d085ed', boss: '#ff7089',
});

export class StageSelectScreen {
  constructor({ checkpoint, onFormation, onContinue, onSettings } = {}) {
    this.checkpoint = checkpoint;
    this.onFormation = onFormation;
    this.onContinue = onContinue;
    this.onSettings = onSettings;
    this.root = null;
    this.popover = null;
    this.popoverChipKey = null;
  }

  mount(root) {
    this.root = root;
    root.innerHTML = `
      <section class="screen stage-select-screen" data-screen="stage-select">
        <header class="app-header">
          <div class="brand-lockup"><span class="brand-kicker">DREAM FRONTIER</span><h1>Hero Core Defense <b>V2</b></h1></div>
          <button class="icon-button" type="button" data-action="settings" aria-label="설정">⚙</button>
        </header>
        ${this.checkpoint ? `<button class="continue-banner" type="button" data-action="continue">진행 중인 전투 계속하기 · ${this.checkpoint.nextWave}웨이브</button>` : ''}
        <div class="stage-grid">
          ${STAGES.map((stage) => this.#stageCard(stage)).join('')}
        </div>
      </section>`;
    root.querySelector('[data-action="settings"]')?.addEventListener('click', this.onSettings);
    root.querySelector('[data-action="continue"]')?.addEventListener('click', this.onContinue);
    for (const button of root.querySelectorAll('[data-action="formation"]')) {
      button.addEventListener('click', () => this.onFormation(button.dataset.stageId));
    }
    root.querySelector('.stage-grid')?.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-wave-chip]');
      if (!chip) {
        this.#hideWavePopover();
        return;
      }
      event.stopPropagation();
      const [stageId, waveNumber] = chip.dataset.waveChip.split(':');
      const stage = STAGES.find((entry) => entry.id === stageId);
      const wave = stage?.waves[Number(waveNumber) - 1];
      if (!wave) return;
      if (this.popoverChipKey === chip.dataset.waveChip) {
        this.#hideWavePopover();
        return;
      }
      this.#showWavePopover(chip, wave, Number(waveNumber));
    });
  }

  #stageCard(stage) {
    const mid = ENEMY_BY_ID[stage.midBossId];
    const final = ENEMY_BY_ID[stage.finalBossId];
    return `
      <article class="stage-card stage-card--${stage.id}">
        <div class="stage-card__art" aria-hidden="true"><span>${stage.id === 'ancient_ruins' ? '𓂀' : '✦'}</span></div>
        <div class="stage-card__body">
          <div class="stage-card__heading"><div><span class="eyebrow">${elementNames[stage.representativeElement]} 엘리멘탈</span><h2>${stage.name}</h2></div><span class="difficulty-chip">이지</span></div>
          <div class="defense-tags">${stage.featuredDefenseTypes.map((id) => `<span>${defenseNames[id]}</span>`).join('')}</div>
          ${this.#waveStrip(stage)}
          <p class="boss-line">중간보스 <b>${mid.name}</b> · 최종보스 <b>${final.name}</b></p>
          <div class="difficulty-row" aria-label="난도">
            <button type="button" class="difficulty active">이지</button>
            <button type="button" class="difficulty" disabled>노멀<small>준비 중</small></button>
            <button type="button" class="difficulty" disabled>하드<small>준비 중</small></button>
          </div>
          <button class="primary-button" type="button" data-action="formation" data-stage-id="${stage.id}">편성하기</button>
        </div>
      </article>`;
  }

  #waveStrip(stage) {
    return `<div class="wave-strip" data-wave-strip="${stage.id}" aria-label="웨이브 미리보기">
      ${stage.waves.map((wave, index) => {
        const waveNumber = index + 1;
        const bossWave = wave.kind === 'boss';
        const enemy = ENEMY_BY_ID[wave.groups[0].enemyId];
        const color = DEFENSE_COLORS[enemy?.defenseType] ?? '#fff';
        const symbol = bossWave ? '★' : (enemy?.token?.symbol ?? '●');
        return `<button class="wave-chip${bossWave ? ' wave-chip--boss' : ''}" type="button"
          data-wave-chip="${stage.id}:${waveNumber}"
          style="border-color:${color}; color:${color}"
          aria-label="${waveNumber}웨이브 ${enemy?.name ?? ''}"
          >${symbol}<small>${waveNumber}</small></button>`;
      }).join('')}
    </div>`;
  }

  #showWavePopover(chip, wave, waveNumber) {
    this.#hideWavePopover();
    const enemy = ENEMY_BY_ID[wave.groups[0].enemyId];
    const bossWave = wave.kind === 'boss';
    const popover = document.createElement('div');
    popover.className = 'wave-popover';
    popover.setAttribute('role', 'tooltip');
    popover.innerHTML = `
      <strong>${waveNumber}웨이브 · ${enemy?.name ?? wave.groups[0].enemyId}</strong>
      <span>${defenseNames[enemy?.defenseType] ?? '일반'} 방어 타입 · ${wave.enemyCount}마리${bossWave ? ' · 보스' : ''}</span>`;
    document.body.appendChild(popover);
    const chipRect = chip.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const left = Math.max(8, Math.min(
      chipRect.left + chipRect.width / 2 - popoverRect.width / 2,
      window.innerWidth - popoverRect.width - 8,
    ));
    popover.style.left = `${left}px`;
    popover.style.top = `${chipRect.bottom + 6}px`;
    this.popover = popover;
    this.popoverChipKey = chip.dataset.waveChip;
  }

  #hideWavePopover() {
    this.popover?.remove();
    this.popover = null;
    this.popoverChipKey = null;
  }

  destroy() {
    this.#hideWavePopover();
    this.root = null;
  }
}

export default StageSelectScreen;
