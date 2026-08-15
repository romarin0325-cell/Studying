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
      <div class="result-actions"><button class="primary-button" type="button" data-action="retry">같은 편성으로 재도전</button><button class="secondary-button" type="button" data-action="formation">편성 변경</button><button class="ghost-button" type="button" data-action="stages">스테이지 선택</button></div>
    </section>`;
    root.querySelector('[data-action="retry"]').addEventListener('click', this.onRetry);
    root.querySelector('[data-action="formation"]').addEventListener('click', this.onFormation);
    root.querySelector('[data-action="stages"]').addEventListener('click', this.onStages);
  }

  destroy() { this.root = null; }
}

export default ResultScreen;
