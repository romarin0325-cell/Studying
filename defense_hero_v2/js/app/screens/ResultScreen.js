const ELEMENT_COLORS = Object.freeze({
  fire: '#ff7155', water: '#55c8ff', nature: '#79d76b', light: '#ffe27a', dark: '#bb83e8',
});

export class ResultScreen {
  constructor({ result, stageName, onRetry, onFormation, onStages } = {}) {
    Object.assign(this, { result, stageName, onRetry, onFormation, onStages });
    this.root = null;
  }

  mount(root) {
    this.root = root;
    const victory = this.result?.victory;
    root.innerHTML = `<section class="screen result-screen ${victory ? 'victory' : 'defeat'}" data-screen="result">
      <div class="result-orb">${victory ? '✦' : '◇'}</div><span class="eyebrow">${this.stageName}</span><h1>${victory ? '코어를 지켜냈어!' : '꿈의 코어가 무너졌어'}</h1><p>${this.result?.wave ?? 0}웨이브 · ${Math.round(this.result?.elapsedSeconds ?? 0)}초</p>
      ${this.#heroReportPanel()}
      <div class="result-actions"><button class="primary-button" type="button" data-action="retry">같은 편성으로 재도전</button><button class="secondary-button" type="button" data-action="formation">편성 변경</button><button class="ghost-button" type="button" data-action="stages">스테이지 선택</button></div>
    </section>`;
    root.querySelector('[data-action="retry"]').addEventListener('click', this.onRetry);
    root.querySelector('[data-action="formation"]').addEventListener('click', this.onFormation);
    root.querySelector('[data-action="stages"]').addEventListener('click', this.onStages);
  }

  #heroReportPanel() {
    const heroes = this.result?.heroReport ?? [];
    if (!heroes.length) return '';
    const maxDamage = Math.max(...heroes.map((hero) => hero.damage), 1);
    return `<div class="hero-report">
      <h3>영웅별 누적 대미지</h3>
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
