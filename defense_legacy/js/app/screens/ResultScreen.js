import { paintPortraits } from '../../render/Illustrations.js';
import { JOURNEYS, worldStyle } from '../../content/presentation.js';
const ELEMENT_COLORS = Object.freeze({
  fire: '#ff7155', water: '#55c8ff', nature: '#79d76b', light: '#ffe27a', dark: '#bb83e8',
});

export function formatElapsedTime(elapsedSeconds = 0) {
  const total = Math.max(0, Math.round(Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0));
  return `${Math.floor(total / 60)}분 ${total % 60}초`;
}

export class ResultScreen {
  constructor({ result, stageName, stageId, assetManager, onNext, onRetry, onFormation, onStages } = {}) {
    Object.assign(this, { result, stageName, stageId, assetManager, onNext, onRetry, onFormation, onStages });
    this.root = null;
  }

  mount(root) {
    this.root = root;
    const victory = this.result?.victory;
    root.innerHTML = `<section class="screen result-screen ${victory ? 'victory' : 'defeat'}" data-screen="result">
      <div class="result-art" style="${worldStyle(JOURNEYS[this.stageId]?.art ?? 0)}"></div>
      <header class="result-heading"><span class="eyebrow">${victory ? 'VICTORY' : 'JOURNEY PAUSED'} · ${this.stageName}</span><h1>${victory ? '수호 성공' : '다음엔, 끝까지'}</h1>
      <div class="result-stars" aria-label="${this.result.stars ?? 0}별">${[0,1,2].map(i=>`<span class="${i<(this.result.stars??0)?'earned':''}" style="--star-delay:${i*.13}s">✦</span>`).join('')}</div></header>
      <div class="result-party">${(this.result.heroReport??[]).map(hero=>`<canvas data-portrait="${hero.heroId}" width="200" height="220" aria-label="${hero.name}"></canvas>`).join('')}</div>
      <div class="result-summary"><div><small>도달한 웨이브</small><b>${this.result?.wave ?? 0}<em> / 10</em></b></div><div><small>수호 시간</small><b>${formatElapsedTime(this.result?.elapsedSeconds)}</b></div><div><small>남은 코어</small><b>${this.result.coreDurability ?? 0}<em> / 10</em></b></div></div>
      <div class="result-reward"><span class="reward-seal">${victory?'✧':'◇'}</span><div><b>${victory ? this.result.firstClear ? '첫 수호 기록을 새겼습니다' : this.result.newBest ? '최고 수호 기록 경신' : '수호 기록 저장 완료' : '다시 짜는 수호대'}</b><p>${victory ? `여정에 별 ${this.result.stars??1}개 기록 · 최고 기록은 계속 보존됩니다.` : '상성표를 확인하고 직선과 굽이의 역할을 바꿔보세요.'}</p></div></div>
      ${this.#heroReportPanel()}
      <div class="result-actions">${victory ? '<button class="primary-button" data-action="next">다음 여정 →</button>' : ''}<button class="${victory?'secondary-button':'primary-button'}" type="button" data-action="retry">재도전</button><button class="secondary-button" type="button" data-action="formation">편성 변경</button><button class="ghost-button" type="button" data-action="stages">여정 선택</button></div>
    </section>`;
    root.querySelector('[data-action="retry"]').addEventListener('click', this.onRetry);
    root.querySelector('[data-action="formation"]').addEventListener('click', this.onFormation);
    root.querySelector('[data-action="stages"]').addEventListener('click', this.onStages);
    root.querySelector('[data-action="next"]')?.addEventListener('click', this.onNext);
    if (this.assetManager) paintPortraits(root, this.assetManager);
  }

  #heroReportPanel() {
    const heroes = this.result?.heroReport ?? [];
    if (!heroes.length) return '';
    const maxDamage = Math.max(...heroes.map((hero) => hero.damage), 1);
    return `<div class="hero-report">
      <h3>수호대 전투 기록 <small>누적 피해 / 처치</small></h3>
      ${heroes.map((hero) => `
        <div class="hero-report-row">
          <span class="hero-element-dot" style="background:${ELEMENT_COLORS[hero.element] ?? '#fff'}"></span>
          <span class="hero-report-name">${hero.name}</span>
          <div class="hero-report-bar-bg">
            <div class="hero-report-bar" style="width:${((hero.damage / maxDamage) * 100).toFixed(1)}%"></div>
          </div>
          <span class="hero-report-damage">${Math.round(hero.damage).toLocaleString()}</span>
          <span class="hero-report-kills">${hero.kills}처치</span>
        </div>
      `).join('')}
    </div>`;
  }

  destroy() { this.root = null; }
}

export default ResultScreen;
