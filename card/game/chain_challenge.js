/* Shared convenience actions; every quiz, ticket charge and reward uses RPG. */
'use strict';
const CardChainChallenge = {
  ready: false,
  chain: null,
  $(id) { return document.getElementById(id); },
  count() {
    if (!RPG.state || RPG.state.mode === 'puzzle') return 0;
    return Math.min(10, Math.floor((RPG.state.tickets || 0) / GAME_CONSTANTS.COSTS.GACHA_SINGLE));
  },
  available() {
    const area = this.$('menu-gacha-area');
    return this.$('screen-menu').classList.contains('active') && area && getComputedStyle(area).display !== 'none' && this.count() >= 2;
  },
  sync() {
    const button = this.$('cc-chain-gacha');
    if (!button) return;
    button.hidden = !this.available();
    const count = this.count();
    button.querySelector('small').textContent = `${count}문제`;
    button.setAttribute('aria-label', `연속 도전, 퀴즈 ${count}문제, 티켓 ${count}장, 정답마다 도전 소환`);
    const bar = this.$('cc-chain');
    bar.hidden = !this.chain;
    if (this.chain) {
      bar.querySelector('span').textContent = `연속 도전 ${this.chain.done} / ${this.chain.total} · 소환 ${this.chain.picks.length}`;
      const stop = bar.querySelector('button');
      stop.disabled = this.chain.left <= 0;
      stop.textContent = this.chain.left > 0 ? '그만하기' : '이번 문제까지';
    }
  },
  start() {
    if (this.chain || !this.available()) return;
    const total = this.count();
    this.chain = {total, left:total, done:0, fails:0, picks:[], phase:'next'};
    this.next(this.chain);
  },
  next(chain) {
    if (this.chain !== chain) return;
    if (!this.$('screen-menu').classList.contains('active')) return this.cancel();
    if (chain.left <= 0 || (RPG.state.tickets || 0) < GAME_CONSTANTS.COSTS.GACHA_SINGLE) return this.finish(chain);
    chain.left--;
    chain.done++;
    chain.phase = 'question';
    this.opening = chain;
    try { RPG.openChallengeGacha(); } finally { this.opening = null; }
    this.sync();
    // A data error must never consume the rest of the tickets in a loop.
    if (!this.$('modal-quiz').classList.contains('active')) this.finish(chain);
  },
  cancel() {
    const chain = this.chain;
    if (!chain) return;
    chain.cancelled = true;
    this.chain = null;
    clearTimeout(this.timer);
    this.sync();
  },
  finish(chain) {
    if (this.chain !== chain) return;
    this.chain = null;
    clearTimeout(this.timer);
    this.sync();
    const result = this.$('gacha-result');
    result.replaceChildren();
    delete result.dataset.grade;
    this.$('gacha-title').textContent = '연속 도전 결과';
    const summary = document.createElement('p');
    summary.className = 'cc-summary';
    summary.textContent = `${chain.done}문제 · 정답 ${chain.picks.length} · 오답 ${chain.fails}`;
    const list = document.createElement('div');
    list.className = 'cc-results';
    for (const id of chain.picks) {
      const card = RPG.getCardData(id);
      const row = document.createElement('div');
      row.className = 'cc-result-card';
      row.append(ImageAssets.createPortrait(card, {wrapperStyle:'width:54px;height:72px;flex-shrink:0;'}));
      const label = document.createElement('span');
      const grade = document.createElement('small');
      grade.textContent = DISPLAY_NAMES.grade[card.grade] || card.grade;
      const name = document.createElement('strong');
      name.textContent = card.name;
      label.append(grade, name);
      row.append(label);
      list.append(row);
    }
    if (!chain.picks.length) {
      const empty = document.createElement('p');
      empty.textContent = '이번에는 소환한 카드가 없습니다. 다음 도전을 응원합니다.';
      list.append(empty);
    }
    result.append(summary, list);
    this.$('modal-gacha').classList.add('cc-result-active', 'active');
  },
  after(name, callback) {
    const original = RPG[name];
    RPG[name] = function (...args) {
      const result = original.apply(this, args);
      callback(...args);
      return result;
    };
  },
  install() {
    if (this.ready || typeof LumenUI !== 'undefined') return;
    // The source page loads feature modules sequentially after DOMContentLoaded.
    if (window._scriptLoadComplete && window._scriptLoadErrors?.length) return;
    if (typeof RPG === 'undefined' || !RPG._featuresInstalled || typeof RPG.startQuiz !== 'function') {
      setTimeout(() => this.install(), 100);
      return;
    }
    const area = this.$('menu-gacha-area');
    if (!area) return;
    const button = document.createElement('button');
    button.id = 'cc-chain-gacha';
    button.type = 'button';
    button.className = 'menu-btn cc-chain-start';
    button.hidden = true;
    const title = document.createElement('span');
    title.textContent = '연속 도전';
    button.append(title, document.createElement('small'));
    button.onclick = () => this.start();
    area.append(button);
    const bar = document.createElement('div');
    bar.id = 'cc-chain';
    bar.className = 'cc-chain';
    bar.hidden = true;
    bar.setAttribute('role', 'status');
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.onclick = () => { if (this.chain) { this.chain.left = 0; this.sync(); } };
    bar.append(document.createElement('span'), stop);
    this.$('modal-quiz').querySelector('.modal-content').prepend(bar);

    const startQuiz = RPG.startQuiz;
    RPG.startQuiz = (callback, ...args) => {
      const chain = this.opening;
      if (!chain) return startQuiz.call(RPG, callback, ...args);
      return startQuiz.call(RPG, success => {
        chain.phase = 'settling';
        const before = RPG.state.inventory.length;
        this.settling = chain;
        try { callback(success); } finally { this.settling = null; }
        if (success && RPG.state.inventory.length > before) chain.picks.push(RPG.state.inventory.at(-1));
        if (!success) chain.fails++;
        // Single-card presentation has already granted its reward; only defer the reveal.
        this.$('modal-gacha').classList.remove('active');
        if (this.chain !== chain || chain.cancelled) return;
        chain.phase = 'next';
        this.sync();
        this.timer = setTimeout(() => this.next(chain), 120);
      }, ...args);
    };
    const showAlert = RPG.showAlert;
    RPG.showAlert = (message, ...args) => {
      if (this.settling && /퀴즈 실패/.test(String(message))) return;
      return showAlert.call(RPG, message, ...args);
    };
    this.after('toMenu', () => this.sync());
    this.after('showScreen', id => { if (id !== 'screen-menu') this.cancel(); });
    this.after('closeGachaModal', () => this.$('modal-gacha').classList.remove('cc-result-active'));
    this.after('runGacha', () => {
      if (!this.settling) this.$('modal-gacha').classList.remove('cc-result-active');
    });
    // An escaped/dismissed quiz cancels the sequence; it never starts hidden quizzes.
    new MutationObserver(() => {
      if (this.chain?.phase === 'question' && !this.$('modal-quiz').classList.contains('active')) this.cancel();
    }).observe(this.$('modal-quiz'), {attributes:true, attributeFilter:['class']});

    // Advancing an empty slot avoids overwriting the card just placed. Explicit
    // replacement of an occupied slot preserves the player's chosen position.
    const render = RPG.renderCardList;
    RPG.renderCardList = function (target, cards, handler, ...args) {
      if (target !== 'deck-card-list' || typeof handler !== 'function') return render.call(this, target, cards, handler, ...args);
      return render.call(this, target, cards, id => {
        const slot = this.selectedSlot >= 0 ? this.selectedSlot : this.state.deck.findIndex(value => !value);
        const wasEmpty = slot >= 0 && !this.state.deck[slot];
        handler(id);
        if (wasEmpty && this.state.deck[slot] === id) {
          const next = this.state.deck.findIndex(value => !value);
          if (next >= 0) this.selectDeckSlot(next);
        }
      }, ...args);
    };
    this.after('openDeck', () => {
      const next = RPG.state.deck.findIndex(value => !value);
      if (next >= 0) RPG.selectDeckSlot(next);
    });
    this.ready = true;
    this.sync();
  }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(() => CardChainChallenge.install(), 0));
else setTimeout(() => CardChainChallenge.install(), 0);
