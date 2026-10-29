/* DREAMWEAVER · Lumen presentation layer.
   card/game owns rules, rewards and saves; card/src/astra.js owns portraits, backups and dialog focus.
   This file only renders the shell and wraps public RPG methods to show what already happened. */
'use strict';

const LumenUI = {
  slots: ['선봉', '중견', '대장'],
  deckFilter: 'all',
  detailIds: [],
  track: { player: null, enemy: null, playerHp: 0, enemyHp: 0 },
  logBuffer: [],
  finishing: false,
  pendingResult: null,
  summonTimers: [],

  $(id) { return document.getElementById(id); },
  el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  },
  icon(name, className) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);
    return svg;
  },
  reduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; },
  grade(card) { return DISPLAY_NAMES.grade[card.grade] || card.grade; },
  element(card) { return DISPLAY_NAMES.element[card.element] || card.element || ''; },
  role(card) { return DISPLAY_NAMES.role[card.role] || card.role || ''; },
  modeName(mode) { return DISPLAY_NAMES.mode[mode] || mode || ''; },
  pad(value) { return String(value).padStart(2, '0'); },
  restart(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  },

  // ---------- Shell ----------
  screenChanged(id) {
    const kind = id.replace('screen-', '');
    if (kind !== 'collection' && Astra.collectionContext === 'factory') {
      Astra.collectionContext = 'library';
      delete document.body.dataset.collectionContext;
    }
    const primary = ['title', 'menu', 'collection', 'deck', 'study', 'battle'];
    document.body.dataset.screen = primary.includes(kind) ? kind : 'draft';
    document.body.dataset.view = kind;
    document.querySelectorAll('[data-nav]').forEach(button => {
      if (button.dataset.nav === kind) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const factory = Astra.collectionContext === 'factory';
    const places = {
      title: ['', ''], menu: this.runPlace(), deck: ['PARTY', '파티 편성'], collection: factory ? ['FACTORY', '구성 중인 덱'] : ['COLLECTION', '도감'],
      study: ['STUDY', '학습'], battle: ['', ''], 'factory-draft': ['DRAFT', '팩토리 드래프트'], 'artifact-reserve-draft': ['DRAFT', '아티팩트 리저브'],
      'perfect-plan-draft': ['DRAFT', '퍼펙트플랜'], draft: ['DRAFT', '드래프트'], 'chaos-roulette': ['ROULETTE', '카오스 룰렛'], 'transcendence-check': ['TRANSCEND', '초월 카드']
    };
    this.setPlace(...(places[kind] || ['', '']));
    const back = this.$('lm-back');
    back.hidden = !(kind === 'deck' || (kind === 'collection' && factory) || kind === 'transcendence-check');
    if (kind === 'title') this.renderTitle();
    const settingsButton = document.querySelector('.header-tools button[aria-label="설정"]');
    settingsButton.disabled = document.body.dataset.screen === 'battle' || document.body.dataset.screen === 'draft';
    if (kind === 'battle') this.enterBattle();
    if (kind === 'study') this.renderStudy();
    const main = this.$('main-content');
    if (main) main.scrollTop = 0;
  },
  runPlace() {
    const type = RPG.state?.gameType === 'challenge' ? (RPG.state.hardMode ? 'CHALLENGE · HARD' : 'CHALLENGE') : 'ENDLESS';
    return [type, this.modeName(RPG.state?.mode) || '로비'];
  },
  setPlace(kicker, title) {
    this.$('lm-place-kicker').textContent = kicker;
    const status = document.querySelector('.header-status');
    if (status) status.textContent = title;
  },
  goBack() {
    const view = document.body.dataset.view;
    if (view === 'deck') return RPG.toMenu();
    if (view === 'collection') return this.$('collection-back').click();
    if (view === 'transcendence-check') return RPG.openChaosRoulette();
    return RPG.toMenu();
  },
  renderTitle() {
    let hasSave = false;
    let summary = '';
    try {
      hasSave = Storage.loadDetailed(Storage.keys.SAVE).reason !== 'missing';
      const save = hasSave ? Storage.load(Storage.keys.SAVE) : null;
      if (save && save.mode) summary = `${this.modeName(save.mode)} · STAGE ${this.pad((save.enemyScale || 0) + 1)}`;
    } catch { /* A damaged save is reported by the original loader. */ }
    const start = this.$('btn-start-load');
    const label = start.querySelector('.lm-cta-label');
    label.replaceChildren(document.createTextNode(hasSave ? '여정 이어가기' : '여정 시작하기'));
    if (summary) label.append(this.el('small', '', summary));
    start.onclick = () => RPG.startGame(hasSave ? 'load' : 'new');
    this.$('btn-start-new').hidden = !hasSave;
    this.refreshDots();
  },
  syncFullscreen() {
    const button = this.$('btn-game-fullscreen');
    const label = button.textContent.replace('⛶', '').trim() || '전체화면';
    const active = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.hidden = button.disabled;
    button.replaceChildren(this.icon(active ? 'shrink' : 'expand'));
  },
  savedTheme() {
    let theme = 'dreamsky';
    try { theme = localStorage.getItem('lumenTheme') || theme; } catch { /* Default theme. */ }
    return ['astra', 'strawberry', 'dreamsky'].includes(theme) ? theme : 'dreamsky';
  },
  setThemeColor() {
    const colors = { astra:'#0f1830', strawberry:'#fff3f8', dreamsky:'#f3ede2' };
    document.querySelector('meta[name="theme-color"]').content = colors[document.body.dataset.theme] || colors.astra;
  },
  settings() {
    if (!Astra.ready) return;
    this.$('asset-path').value = Astra.portraitPath;
    const inRun = document.body.dataset.screen !== 'title';
    document.querySelectorAll('[data-run-only]').forEach(button => { button.hidden = !inRun; });
    this.syncSettings();
    this.$('modal-astra-settings').classList.add('active');
  },
  syncSettings() {
    const on = RPG.global && RPG.global.tutoringEventEnabled !== false;
    const toggle = this.$('lm-tutoring-toggle');
    toggle.setAttribute('aria-pressed', String(!!on));
  },
  hasClaimableMission() {
    try {
      const g = RPG.global || {};
      if (g.monthlyMission && !g.monthlyMission.claimed && RPG.areAllMonthlyMissionsCleared()) return true;
      if (g.weeklyMission && !g.weeklyMission.claimed && RPG.areAllWeeklyMissionsCleared()) return true;
      if (RPG.isSpecialMissionVisible() && g.specialMission && !g.specialMission.claimed && RPG.areAllSpecialMissionsCleared()) return true;
    } catch { /* Missions load lazily on the title screen. */ }
    return false;
  },
  refreshDots() {
    const mission = this.hasClaimableMission();
    for (const id of ['btn-title-mission', 'lm-mission']) this.$(id)?.classList.toggle('has-dot', mission);
    let fortune = false;
    try { fortune = FortuneCookie.canUse(); } catch { /* Storage may be blocked. */ }
    for (const id of ['btn-fortune-cookie', 'lm-study-fortune']) this.$(id)?.classList.toggle('has-dot', fortune);
  },

  // ---------- Lobby ----------
  renderParty() {
    const box = this.$('astra-party');
    box.replaceChildren();
    const deck = RPG.state.deck || [];
    for (let index = 0; index < 3; index++) {
      const card = deck[index] ? RPG.getCardData(deck[index]) : null;
      const button = this.el('button', `lm-party-card${card ? '' : ' is-empty'}`);
      button.type = 'button';
      if (card) { button.dataset.grade = card.grade; button.dataset.element = card.element; }
      button.setAttribute('aria-label', `${this.slots[index]}: ${card ? card.name : '비어 있음'}, 편성하기`);
      button.onclick = () => { RPG.openDeck(); RPG.selectDeckSlot(index); };
      const tag = this.el('span', 'lm-slot-tag');
      tag.append(this.el('b', '', String(index + 1)), document.createTextNode(this.slots[index]));
      if (card) {
        const art = ImageAssets.createPortrait(card);
        art.classList.add('lm-party-art');
        button.append(art, tag);
        const plate = this.el('span', 'lm-party-plate');
        plate.append(this.el('strong', '', card.name));
        const meta = this.el('small', '');
        meta.append(this.el('i', `lm-el lm-el-${card.element}`), document.createTextNode(`${this.element(card)} · ${this.role(card)}`));
        plate.append(meta);
        button.append(plate, this.el('span', 'lm-grade-line'));
      } else {
        const empty = this.el('span', 'lm-party-empty');
        empty.append(this.icon('plus'), this.el('small', '', '비어 있음'));
        button.append(empty, tag);
      }
      box.append(button);
    }
    const filled = deck.filter(id => id && RPG.getCardData(id)).length;
    const owned = (RPG.state.inventory || []).length;
    const note = this.$('astra-party-note');
    note.textContent = filled ? '' : owned ? '카드를 눌러 파티를 편성하세요.' : '먼저 티켓으로 동료를 소환하세요.';
    note.hidden = !!filled;
    const depart = this.$('astra-depart');
    depart.disabled = !filled;
    this.$('astra-depart-help').textContent = filled ? '' : '소환 → 편성 → 출전';
    const stage = RPG.state.enemyScale + 1;
    this.$('astra-stage').textContent = this.pad(stage);
    const goal = GameUtils.getClearStage(RPG.state.mode, RPG.state.gameType);
    this.$('lm-stage-goal').textContent = Number.isFinite(goal) ? `/ ${goal}` : '';
    this.$('astra-mode').textContent = this.modeName(RPG.state.mode);
    if (document.body.dataset.view === 'menu') this.setPlace(...this.runPlace());
    const enemy = RPG.getCurrentStageEnemyData();
    this.$('next-enemy-text').textContent = enemy.name;
    let tag = '';
    let season = null;
    try { season = RPG.getCurrentSpecialSeason(); } catch { /* No season. */ }
    if (season && enemy.id === season.bossId) tag = '시즌 보스';
    else if (enemy.hiddenBossFor) tag = '히든 보스';
    else if (enemy.id === 'creator_god') tag = '보스';
    const tagNode = this.$('lm-encounter-tag');
    tagNode.replaceChildren();
    if (tag) tagNode.append(this.el('b', 'lm-boss', tag));
    if (!tag) tagNode.append(document.createTextNode(DISPLAY_NAMES.element[enemy.element] || ''));
    this.$('next-enemy-preview').dataset.boss = tag ? 'true' : 'false';
    this.decorateRecruit();
    const uses = Number.isFinite(RPG.state.chaosBlessingUses) ? RPG.state.chaosBlessingUses : '';
    this.$('lm-blessing-count').textContent = uses === '' ? '' : String(uses);
    this.refreshDots();
  },
  decorateRecruit() {
    const recipe = {
      '일반 뽑기 (1장)': ['일반 소환', 'summon', '1'],
      '도전 뽑기': ['도전 소환', 'quiz', '1'],
      '퍼즐조각획득': ['퍼즐 조각', 'summon', ''],
      '드래프트 시작': ['드래프트 시작', 'cards', ''],
      '카오스 셔플': ['카오스 셔플', 'summon', ''],
      '아티팩트 확인': ['아티팩트', 'gem', '']
    };
    document.querySelectorAll('.lm-recruit .menu-btn:not(.lm-chain-btn)').forEach(button => {
      const raw = button.dataset.lmLabel && button.querySelector('.lm-recruit-name') ? button.dataset.lmRaw : button.textContent.trim();
      const plan = recipe[raw] || [raw, 'summon', ''];
      button.dataset.lmRaw = raw;
      button.dataset.lmLabel = plan[0];
      button.classList.toggle('is-challenge', raw === '도전 뽑기');
      button.replaceChildren(this.icon(plan[1]), this.el('span', 'lm-recruit-name', plan[0]));
      if (plan[2]) {
        const cost = this.el('span', 'lm-cost');
        cost.append(this.icon('ticket'), document.createTextNode(plan[2]));
        button.append(cost);
      }
      const subs = { '일반 뽑기 (1장)':'티켓 1장', '도전 뽑기':'티켓 1장 · 퀴즈' };
      if (subs[raw]) button.append(this.el('span', 'lm-recruit-sub', subs[raw]));
      button.setAttribute('aria-label', raw === '도전 뽑기' ? '도전 소환, 티켓 1장, 퀴즈 정답 시 높은 등급' : plan[2] ? `${plan[0]}, 티켓 ${plan[2]}장` : plan[0]);
    });
    this.syncChainButton();
  },
  chainCount() {
    if (RPG.state.mode === 'puzzle') return 0;
    return Math.min(10, Math.floor((RPG.state.tickets || 0) / GAME_CONSTANTS.COSTS.GACHA_SINGLE));
  },
  syncChainButton() {
    const button = this.$('lm-chain-gacha');
    const challenge = this.$('btn-challenge-gacha');
    const count = this.chainCount();
    // Convenience goes to the learning path: several challenge quizzes in a row, revealed together.
    button.hidden = count < 2 || challenge.dataset.lmRaw !== '도전 뽑기';
    if (button.hidden) return;
    button.replaceChildren(this.icon('quiz'), this.el('span', 'lm-recruit-name', '연속 도전'), this.el('span', 'lm-recruit-sub', `퀴즈 ${count}문제`));
    button.setAttribute('aria-label', `연속 도전, 퀴즈 ${count}문제, 티켓 ${count}장, 정답마다 도전 소환`);
  },
  // Each round is the original challenge summon (ticket, vocabulary quiz, challenge rates). Only the reveal waits.
  startChain() {
    const count = this.chainCount();
    if (count < 2) return RPG.openChallengeGacha();
    this.chain = { total: count, left: count, done: 0, picks: [], fails: 0, before: RPG.state.inventory.slice() };
    this.nextChain();
  },
  nextChain() {
    const chain = this.chain;
    if (!chain) return;
    if (chain.left <= 0 || (RPG.state.tickets || 0) < GAME_CONSTANTS.COSTS.GACHA_SINGLE) return this.endChain();
    chain.left--;
    chain.done++;
    this.syncChainBar();
    RPG.openChallengeGacha();
  },
  chainPicked() {
    this.chain.picks.push(RPG.state.inventory.at(-1));
    this.$('modal-gacha').classList.remove('active');
    setTimeout(() => this.nextChain(), 120);
  },
  syncChainBar() {
    const bar = this.$('lm-chain');
    const chain = this.chain;
    bar.hidden = !chain;
    if (!chain) return;
    bar.querySelector('.lm-chain-count').replaceChildren(document.createTextNode('연속 도전 '), this.el('b', '', String(chain.done)), document.createTextNode(` / ${chain.total}`));
    bar.querySelector('.lm-chain-score').textContent = `소환 ${chain.picks.length}`;
    const stop = bar.querySelector('button');
    stop.disabled = chain.left <= 0;
    stop.textContent = chain.left <= 0 ? '이번 문제까지' : '그만하기';
  },
  endChain() {
    const chain = this.chain;
    this.chain = null;
    this.syncChainBar();
    if (!chain) return;
    if (!chain.picks.length) return RPG.showAlert(`퀴즈 ${chain.fails}문제를 모두 놓쳤습니다.<br>(티켓이 소모되었습니다)`);
    this.$('modal-gacha').classList.add('active');
    this.presentBatch(chain.picks, chain.before, { title:'연속 도전', fails:chain.fails });
  },
  // ---------- Card tiles ----------
  tile(card, count, onClick, options = {}) {
    const button = this.el('button', `card-item lm-tile ${card.grade}${count === 0 ? ' unowned' : ''}`);
    button.type = 'button';
    button.dataset.cardId = card.id;
    button.dataset.grade = card.grade;
    button.dataset.element = card.element;
    const availability = count === null ? '카드풀' : count ? `${count}장 보유` : '미보유';
    button.setAttribute('aria-label', `${card.name}, ${this.grade(card)}, ${this.element(card)} ${this.role(card)}, ${availability}`);
    const art = ImageAssets.createPortrait(card);
    art.classList.add('lm-tile-art');
    button.append(art);
    button.append(this.el('span', 'lm-tile-grade', this.grade(card)));
    const element = this.el('span', 'lm-tile-el');
    element.append(this.el('i', `lm-el lm-el-${card.element}`));
    element.title = this.element(card);
    button.append(element);
    if (count > 1) button.append(this.el('span', 'lm-tile-count', `×${count}`));
    if (count === 0 && !options.quiet) button.append(this.el('span', 'lm-tile-lock', '미보유'));
    const plate = this.el('span', 'lm-tile-plate');
    plate.append(this.el('span', 'card-name', card.name));
    const meta = this.el('span', 'card-meta');
    meta.append(this.el('span', '', `${this.element(card)} · ${this.role(card)}`));
    plate.append(meta);
    button.append(plate);
    button.onclick = onClick;
    return button;
  },
  renderCards(containerId, list, clickHandler) {
    if (containerId === 'deck-card-list') return this.renderDeckCards(list, clickHandler);
    const box = this.$(containerId);
    box.replaceChildren();
    const counts = new Map();
    for (const id of list) counts.set(id, (counts.get(id) || 0) + 1);
    const ids = RPG.sortCardIdsByGrade([...counts.keys()]).filter(id => RPG.getCardData(id));
    for (const id of ids) {
      const card = RPG.getCardData(id);
      const count = containerId === 'card-pool-grid' ? null : counts.get(id);
      box.append(this.tile(card, count, () => { this.detailIds = ids; clickHandler(id); }));
    }
    box.classList.add('lm-grid');
  },
  renderCollection() {
    const counts = new Map();
    for (const id of RPG.state.inventory) counts.set(id, (counts.get(id) || 0) + 1);
    const all = Astra.allCards;
    const source = all ? GameUtils.getAllCards() : [...counts.keys()].map(id => RPG.getCardData(id)).filter(Boolean);
    const cards = new Map(source.map(card => [card.id, card]));
    const query = this.$('card-search').value.trim().toLocaleLowerCase();
    const grade = this.$('card-grade').value;
    const filtered = [...cards.values()].filter(card => (grade === 'all' || card.grade === grade)
      && `${card.name} ${card.element} ${card.role} ${this.element(card)} ${this.role(card)} ${this.grade(card)}`.toLocaleLowerCase().includes(query));
    const box = this.$('collection-grid');
    box.replaceChildren();
    const byId = new Map(filtered.map(card => [card.id, card]));
    const ids = RPG.sortCardIdsByGrade([...byId.keys()]);
    for (const id of ids) box.append(this.tile(byId.get(id), counts.get(id) || 0, () => { this.detailIds = ids; RPG.showCardInfo(id); }, { quiet: !all }));
    this.$('collection-empty').hidden = filtered.length !== 0;
    this.$('collection-count').textContent = `${filtered.length}종`;
    this.$('collection-scope').textContent = all ? '전체 도감' : '보유 카드';
    this.$('collection-scope').setAttribute('aria-pressed', String(all));
    this.$('lm-scope-run').setAttribute('aria-pressed', String(!all));
    this.$('lm-scope-all').setAttribute('aria-pressed', String(all));
    const owned = new Set(RPG.state.inventory).size;
    if (all && !query && grade === 'all') this.$('collection-count').textContent = `보유 ${owned} / ${filtered.length}종`;
    else if (!all && !query && grade === 'all') this.$('collection-count').textContent = `${owned}종 · ${RPG.state.inventory.length}장`;
    this.$('lm-collection-note').textContent = !all && !owned ? '아직 함께하는 동료가 없습니다. 로비에서 소환하세요.' : '';
    this.syncGradeChips();
  },
  buildGradeChips() {
    const box = this.$('lm-grade-chips');
    const select = this.$('card-grade');
    for (const option of select.options) {
      const chip = this.el('button', 'lm-chip', option.value === 'all' ? '전체' : option.textContent);
      chip.type = 'button';
      chip.dataset.gradeChoice = option.value;
      if (option.value !== 'all') chip.dataset.grade = option.value;
      chip.onclick = () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change'));
      };
      box.append(chip);
    }
  },
  syncGradeChips() {
    const value = this.$('card-grade').value;
    document.querySelectorAll('#lm-grade-chips .lm-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.gradeChoice === value)));
  },

  // ---------- Deck ----------
  renderDeckSlots() {
    const deck = RPG.state.deck || [];
    this.slots.forEach((role, index) => {
      const slot = this.$(`slot-${index}`);
      const card = deck[index] ? RPG.getCardData(deck[index]) : null;
      slot.style.borderColor = '';
      slot.replaceChildren();
      slot.classList.toggle('is-empty', !card);
      if (card) { slot.dataset.grade = card.grade; slot.append(ImageAssets.createPortrait(card)); }
      else { delete slot.dataset.grade; const hole = this.el('span', 'lm-slot-hole'); hole.append(this.icon('plus')); slot.append(hole); }
      const text = this.el('span', 'slot-text');
      text.append(this.el('small', '', `${index + 1} ${role}`), this.el('strong', '', card ? card.name : '비어 있음'));
      slot.append(text);
      slot.setAttribute('aria-pressed', String(RPG.selectedSlot === index));
      slot.setAttribute('aria-label', `${role} ${card ? card.name : '빈 자리'}`);
    });
    this.syncDeckBadges();
  },
  updateSlotSelection(index) {
    const deck = RPG.state.deck || [];
    document.querySelectorAll('.deck-slot').forEach((slot, i) => {
      slot.style.borderColor = '';
      slot.setAttribute('aria-pressed', String(i === index));
    });
    const role = this.slots[index];
    this.$('deck-hint').textContent = role ? (deck[index] ? `${role} 교체할 카드 선택` : `${role}에 놓을 카드 선택`) : '자리를 선택하세요';
  },
  renderDeckCards(list, handler) {
    this.deckList = list;
    this.deckHandler = handler;
    const box = this.$('deck-card-list');
    box.replaceChildren();
    const counts = new Map();
    for (const id of list) counts.set(id, (counts.get(id) || 0) + 1);
    const ids = RPG.sortCardIdsByGrade([...counts.keys()]).filter(id => RPG.getCardData(id));
    const elements = [...new Set(ids.map(id => RPG.getCardData(id).element))];
    if (this.deckFilter !== 'all' && !elements.includes(this.deckFilter)) this.deckFilter = 'all';
    const shown = ids.filter(id => this.deckFilter === 'all' || RPG.getCardData(id).element === this.deckFilter);
    for (const id of shown) {
      const card = RPG.getCardData(id);
      const wrap = this.el('div', 'lm-tile-wrap');
      const tile = this.tile(card, counts.get(id), () => this.placeCard(id));
      const info = this.el('button', 'lm-tile-info');
      info.type = 'button';
      info.setAttribute('aria-label', `${card.name} 상세`);
      info.append(this.icon('info'));
      info.onclick = event => { event.stopPropagation(); this.detailIds = shown; RPG.showCardInfo(id); };
      wrap.append(tile, info);
      box.append(wrap);
    }
    if (!ids.length) {
      const empty = this.el('div', 'lm-empty-card');
      empty.append(this.el('strong', '', '보유한 카드가 없습니다'), this.el('span', '', '로비에서 티켓으로 동료를 소환하세요.'));
      box.append(empty);
    }
    const chips = this.$('lm-deck-filter');
    chips.replaceChildren();
    const make = (value, label) => {
      const chip = this.el('button', 'lm-chip', label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(this.deckFilter === value));
      if (value !== 'all') { chip.prepend(this.el('i', `lm-el lm-el-${value}`)); }
      chip.onclick = () => { this.deckFilter = value; this.renderDeckCards(this.deckList, this.deckHandler); };
      chips.append(chip);
    };
    make('all', `전체 ${list.length}`);
    if (elements.length > 1) for (const element of elements) make(element, DISPLAY_NAMES.element[element] || element);
    this.syncDeckBadges();
  },
  placeCard(id) {
    const deck = RPG.state.deck;
    const target = RPG.selectedSlot === -1 || RPG.selectedSlot === undefined ? deck.indexOf(null) : RPG.selectedSlot;
    const wasEmpty = target >= 0 && !deck[target];
    this.deckHandler(id);
    if (wasEmpty && deck[target] === id) {
      const next = deck.findIndex((value, index) => !value && index !== target);
      if (next >= 0) RPG.selectDeckSlot(next);
    }
  },
  syncDeckBadges() {
    const deck = RPG.state.deck || [];
    document.querySelectorAll('#deck-card-list .lm-tile').forEach(tile => {
      tile.querySelector('.lm-tile-placed')?.remove();
      const positions = deck.map((id, index) => id === tile.dataset.cardId ? index : -1).filter(index => index >= 0);
      tile.classList.toggle('is-placed', positions.length > 0);
      if (positions.length) tile.append(this.el('span', 'lm-tile-placed', positions.map(index => this.slots[index]).join(' · ')));
    });
  },

  // ---------- Card detail ----------
  statMax() {
    if (this._statMax) return this._statMax;
    const max = { hp:1, atk:1, matk:1, def:1, mdef:1 };
    for (const card of GameUtils.getAllCards()) for (const key of Object.keys(max)) max[key] = Math.max(max[key], card.stats?.[key] || 0);
    this._statMax = max;
    return max;
  },
  decorateDetail(id) {
    const card = RPG.getCardData(id);
    if (!card) return;
    const modal = this.$('modal-card');
    modal.dataset.grade = card.grade;
    modal.dataset.element = card.element;
    const chips = this.$('md-grade');
    chips.className = 'lm-detail-grade';
    chips.replaceChildren(this.el('span', 'lm-grade-chip', this.grade(card)));
    const element = this.el('span', 'lm-meta-chip');
    element.append(this.el('i', `lm-el lm-el-${card.element}`), document.createTextNode(this.element(card)));
    chips.append(element, this.el('span', 'lm-meta-chip', this.role(card)));
    const owned = RPG.state.inventory.filter(item => item === id).length;
    this.$('lm-detail-own').textContent = owned ? `이번 여정 ${owned}장 보유` : '이번 여정 미보유';
    const stats = this.$('md-stats');
    stats.replaceChildren();
    const max = this.statMax();
    for (const [key, label] of [['hp','HP'], ['atk','물리 공격'], ['matk','마법 공격'], ['def','물리 방어'], ['mdef','마법 방어']]) {
      const row = this.el('div', `lm-stat lm-stat-${key}`);
      const value = card.stats[key];
      row.append(this.el('span', '', label), this.el('b', '', String(value)));
      const bar = this.el('i', 'lm-stat-bar');
      bar.style.setProperty('--v', `${Math.round(value / max[key] * 100)}%`);
      row.append(bar);
      stats.append(row);
    }
    const skills = this.$('md-skills');
    skills.replaceChildren();
    const trait = this.el('section', 'lm-trait');
    trait.append(this.el('small', '', '특성'), this.el('p', '', card.trait?.desc || '없음'));
    skills.append(trait);
    const list = [RPG.NORMAL_ATTACK, ...(card.skills || [])];
    for (const skill of list) {
      const holder = document.createElement('div');
      holder.innerHTML = SkillDisplay.html(skill, { entity: card });
      const node = holder.firstElementChild;
      node.dataset.type = skill.type;
      skills.append(node);
    }
    const ids = this.detailIds.includes(id) ? this.detailIds : [];
    const position = ids.indexOf(id);
    const prev = this.$('lm-detail-prev');
    const next = this.$('lm-detail-next');
    const pos = this.$('lm-detail-pos');
    prev.hidden = next.hidden = ids.length < 2;
    pos.textContent = ids.length > 1 ? `${position + 1} / ${ids.length}` : '';
    prev.disabled = position <= 0;
    next.disabled = position < 0 || position >= ids.length - 1;
    prev.onclick = () => { if (position > 0) RPG.showCardInfo(ids[position - 1]); };
    next.onclick = () => { if (position < ids.length - 1) RPG.showCardInfo(ids[position + 1]); };
    modal.querySelector('.lm-detail-scroll').scrollTop = 0;
  },

  // ---------- Study ----------
  renderStudy() {
    const quiz = RPG.state?.quiz_stats || { correct:0, total:0 };
    const lectures = typeof GRAMMAR_DATA !== 'undefined' ? GRAMMAR_DATA.length : 0;
    this.$('lm-study-stat').textContent = quiz.total
      ? `이번 여정 퀴즈 ${quiz.correct} / ${quiz.total} 정답`
      : `문법 강의 ${lectures}강`;
    this.refreshDots();
  },

  // ---------- Battle ----------
  enterBattle() {
    this.track = { player: null, enemy: null, playerHp: 0, enemyHp: 0 };
    this.logBuffer = [];
    const stage = this.$('screen-battle');
    stage.classList.remove('is-won', 'is-lost');
    this.$('player-actor-box').classList.remove('is-defeated');
    this.$('enemy-actor-box').classList.remove('is-defeated');
    this.$('lm-banner').replaceChildren();
    this.setPlace(`STAGE ${this.pad(RPG.state.enemyScale + 1)}`, this.modeName(RPG.state.mode));
  },
  renderStatuses() {
    const render = (id, actor) => {
      const box = this.$(id);
      box.replaceChildren();
      for (const [key, value] of Object.entries(actor?.buffs || {})) {
        if (!value) continue;
        const negative = StatusRules.isNegative(key);
        const text = StatusRules.formatDisplay(key, value, RPG.state.artifacts || [], actor);
        const badge = this.el('span', `status-badge ${negative ? 'status-negative' : 'status-positive'}`, text);
        badge.title = `${negative ? '디버프' : '버프'}: ${BUFF_NAMES[key] || key}`;
        box.append(badge);
      }
    };
    if (!RPG.battle) return;
    render('p-buffs', RPG.battle.players[RPG.battle.currentPlayerIdx]);
    render('e-buffs', RPG.battle.enemy);
  },
  gauge(fill, numberId, value, max) {
    const pct = Math.max(0, Math.min(100, value / Math.max(1, max) * 100));
    fill.style.width = `${pct}%`;
    if (numberId) this.$(numberId).textContent = `${Math.max(0, Math.round(value))} / ${max}`;
    return pct;
  },
  syncBattle() {
    const battle = RPG.battle;
    if (!battle || !battle.enemy || document.body.dataset.screen !== 'battle') return;
    const player = battle.players[battle.currentPlayerIdx];
    const enemy = battle.enemy;
    const logs = this.logBuffer.join('\n');
    this.logBuffer = [];
    const eFill = this.$('e-hp-bar');
    const ePct = this.gauge(eFill, 'lm-e-hp', enemy.hp, enemy.maxHp);
    this.ghost(eFill, ePct, this.track.enemy === enemy ? this.track.enemyHp : enemy.hp, enemy.maxHp);
    if (this.track.enemy === enemy) {
      const delta = this.track.enemyHp - enemy.hp;
      if (delta > 0) this.hit('enemy', delta, /Critical!/.test(logs));
      else if (delta < 0) this.pop('enemy', `+${-delta}`, 'heal');
    }
    this.track.enemy = enemy;
    this.track.enemyHp = enemy.hp;
    if (player && !player.isDead) {
      const pFill = this.$('p-hp-bar');
      const pPct = this.gauge(pFill, 'lm-p-hp', player.hp, player.maxHp);
      this.gauge(this.$('p-mp-bar'), 'lm-p-mp', player.mp, player.maxMp || GAME_CONSTANTS.MAX_MP);
      this.ghost(pFill, pPct, this.track.player === player ? this.track.playerHp : player.hp, player.maxHp);
      if (this.track.player === player) {
        const delta = this.track.playerHp - player.hp;
        if (delta > 0) this.hit('player', delta, false);
        else if (delta < 0) this.pop('player', `+${-delta}`, 'heal');
        else if (/회피 성공/.test(logs)) this.pop('player', '회피', 'miss');
        else if (/(배리어|매직가드)로 방어/.test(logs)) this.pop('player', '방어', 'miss');
      } else if (this.track.player) {
        this.switchIn(player);
      }
      this.track.player = player;
      this.track.playerHp = player.hp;
      this.$('lm-p-slot').textContent = this.slots[battle.currentPlayerIdx] || '';
    }
    const tag = this.$('lm-e-tag');
    tag.textContent = enemy.hiddenBossFor ? '히든 보스' : enemy.id === 'creator_god' ? '보스' : '상대';
    this.renderRoster();
    this.renderFieldBuffs();
  },
  ghost(fill, pct, previousHp, maxHp) {
    const ghost = fill.parentElement.querySelector('.lm-ghost');
    if (!ghost) return;
    const previous = Math.max(0, Math.min(100, previousHp / Math.max(1, maxHp) * 100));
    clearTimeout(ghost._timer);
    if (previous > pct && !this.reduced()) {
      ghost.style.transition = 'none';
      ghost.style.width = `${previous}%`;
      void ghost.offsetWidth;
      ghost._timer = setTimeout(() => { ghost.style.transition = ''; ghost.style.width = `${pct}%`; }, 360);
    } else {
      ghost.style.transition = 'none';
      ghost.style.width = `${pct}%`;
    }
  },
  hit(side, amount, crit) {
    const box = this.$(side === 'enemy' ? 'enemy-actor-box' : 'player-actor-box');
    this.restart(box, 'is-hit');
    this.pop(side, String(amount), crit ? 'crit' : 'dmg');
  },
  pop(side, text, kind) {
    if (this.reduced()) return;
    const art = this.$(side === 'enemy' ? 'enemy-actor-box' : 'player-actor-box').querySelector('.lm-actor-art');
    const layer = art.querySelector('.lm-pop-layer') || art.appendChild(this.el('span', 'lm-pop-layer'));
    const number = this.el('span', `lm-pop lm-pop-${kind}`);
    if (kind === 'crit') number.append(this.el('small', '', 'CRITICAL'));
    number.append(this.el('b', '', text));
    number.style.setProperty('--dx', `${Math.round(Math.random() * 24 - 12)}px`);
    layer.append(number);
    setTimeout(() => number.remove(), 1100);
  },
  switchIn(player) {
    const index = RPG.battle.currentPlayerIdx;
    this.showBanner('player', `${index + 1} ${this.slots[index] || ''} 교대`, player.name, 'swap');
    this.restart(this.$('player-actor-box'), 'is-entering');
  },
  showBanner(side, kicker, title, type) {
    if (this.reduced()) return;
    const banner = this.$('lm-banner');
    const inner = this.el('div', 'lm-banner-inner');
    inner.dataset.side = side;
    inner.dataset.type = type || '';
    inner.append(this.el('small', '', kicker), this.el('strong', '', title));
    banner.replaceChildren(inner);
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => inner.remove(), 1300);
  },
  renderRoster() {
    const box = this.$('lm-roster');
    const battle = RPG.battle;
    box.replaceChildren();
    battle.players.forEach((actor, index) => {
      const dot = this.el('span', 'lm-roster-dot');
      if (!actor) { dot.classList.add('is-none'); box.append(dot); return; }
      if (actor.isDead) dot.classList.add('is-down');
      if (index === battle.currentPlayerIdx && !actor.isDead) dot.classList.add('is-active');
      dot.title = `${this.slots[index]} ${actor.name}${actor.isDead ? ' · 쓰러짐' : ''}`;
      dot.append(ImageAssets.createPortrait(actor.proto || actor));
      dot.append(this.el('b', '', String(index + 1)));
      box.append(dot);
    });
  },
  renderFieldBuffs() {
    const box = this.$('field-buff-box');
    const buffs = RPG.battle.fieldBuffs || [];
    box.replaceChildren();
    if (!buffs.length) { box.append(this.el('span', 'lm-field-empty', '필드 버프 없음')); return; }
    for (const buff of buffs) box.append(this.el('span', 'lm-field-chip', BUFF_NAMES[buff.name] || buff.name));
  },
  decorateLog() {
    const box = this.$('battle-log');
    const line = box.lastElementChild;
    if (!line || line._lumen) return;
    line._lumen = true;
    const text = line.textContent;
    this.logBuffer.push(text);
    const turn = text.match(/^=== (\d+)턴 ===$/);
    if (turn) { line.classList.add('lm-log-turn'); line.textContent = `${turn[1]}턴`; return; }
    if (text === '--- 적 턴 ---') { line.classList.add('lm-log-enemy'); line.textContent = '상대 턴'; return; }
    if (/^\[특성\]/.test(text)) line.classList.add('lm-log-trait');
    else if (/^\[아티팩트\]/.test(text)) line.classList.add('lm-log-artifact');
    else if (/필드버프/.test(text)) line.classList.add('lm-log-field');
    else if (/^승리 보상/.test(text)) line.classList.add('lm-log-reward');
    if (/Critical!/.test(text)) line.classList.add('lm-log-crit');
  },
  decorateControls() {
    const types = { phy:'sword', mag:'wand', sup:'shield' };
    document.querySelectorAll('#battle-controls .skill-btn').forEach(button => {
      if (button.querySelector('.lm-skill-icon')) return;
      const icon = this.icon(types[button.dataset.skillType] || 'star', 'lm-skill-icon');
      button.prepend(icon);
      const cost = button.querySelector('.skill-cost');
      if (cost && cost.textContent.trim() === 'MP 0') cost.classList.add('is-free');
    });
  },
  wrapBattle() {
    const ui = this;
    const execute = RPG.executeSkill;
    RPG.executeSkill = function (source, target, skill, isDelayed = false) {
      const isPlayer = source && RPG.battle && RPG.battle.players.includes(source);
      if (isPlayer && skill && skill.name !== RPG.NORMAL_ATTACK.name && RPG.battle.phase === 'player-ready') {
        const typeNames = { phy:'물리', mag:'마법', sup:'보조' };
        ui.showBanner('player', `${source.name} · ${typeNames[skill.type] || '스킬'}`, skill.name, skill.type);
      }
      const result = execute.apply(this, arguments);
      ui.syncBattle();
      return result;
    };
    const enemyTurn = BattleRuntime.TurnManager.startEnemyTurn;
    BattleRuntime.TurnManager.startEnemyTurn = function (rpg) {
      const box = ui.$('battle-log');
      const before = box.childElementCount;
      const result = enemyTurn.apply(this, arguments);
      const lines = [...box.children].slice(before).map(line => line.textContent);
      const name = rpg.battle?.enemy?.name || '';
      for (const line of lines) {
        const named = line.match(/・・(.+)!$/) || (name && line.startsWith(`${name}의 `) ? line.slice(name.length + 2).match(/^(.+?)!/) : null);
        if (named) { ui.showBanner('enemy', name, named[1], 'enemy'); break; }
      }
      return result;
    };
    const finish = (method, side) => {
      const original = RPG[method];
      RPG[method] = function (...args) {
        if (!this.battle || this.battle.isFinished || ui.finishing || ui.reduced() || document.body.dataset.screen !== 'battle') {
          ui.pendingResult = ui.resultSnapshot(side);
          return original.apply(this, args);
        }
        ui.finishing = true;
        ui.syncBattle();
        document.body.classList.add('lm-finishing');
        ui.$(side === 'victory' ? 'enemy-actor-box' : 'player-actor-box').classList.add('is-defeated');
        ui.showBanner(side === 'victory' ? 'player' : 'enemy', side === 'victory' ? 'STAGE CLEAR' : 'DEFEAT', side === 'victory' ? '승리' : '패배', side);
        setTimeout(() => {
          ui.finishing = false;
          document.body.classList.remove('lm-finishing');
          ui.pendingResult = ui.resultSnapshot(side);
          original.apply(RPG, args);
        }, 950);
      };
    };
    finish('winBattle', 'victory');
    finish('loseBattle', 'defeat');
  },
  resultSnapshot(kind) {
    return { kind, stage: (RPG.state.enemyScale || 0) + 1, tickets: RPG.state.tickets || 0, mode: RPG.state.mode };
  },
  decorateInfo(title) {
    const modal = this.$('modal-info');
    const content = modal.querySelector('.modal-content');
    content.querySelector('.lm-result')?.remove();
    delete modal.dataset.result;
    const pending = this.pendingResult;
    let kind = null;
    if (title === '게임 클리어') kind = 'clear';
    else if (title === 'Game Over') kind = 'defeat';
    else if (title === '전투 결과' && pending) kind = pending.kind;
    if (!kind) return;
    this.pendingResult = null;
    modal.dataset.result = kind;
    const head = this.el('div', 'lm-result');
    const words = { victory:['VICTORY', '승리'], defeat:['DEFEAT', '패배'], clear:['ALL CLEAR', '모드 클리어'] };
    head.append(this.el('p', 'lm-result-word', words[kind][0]));
    const stage = pending ? pending.stage : RPG.state.enemyScale;
    head.append(this.el('p', 'lm-result-sub', kind === 'clear' ? `${this.modeName(RPG.state.mode)} 모드 클리어` : `STAGE ${this.pad(stage)} · ${words[kind][1]}`));
    if (kind === 'victory' && pending) {
      const gained = (RPG.state.tickets || 0) - pending.tickets;
      if (gained > 0) {
        const reward = this.el('p', 'lm-result-reward');
        reward.append(this.icon('ticket'), this.el('b', '', `+${gained}`), document.createTextNode(' 소환 티켓'));
        head.append(reward);
      }
      const info = this.$('info-content');
      info.innerHTML = info.innerHTML.replace(/^승리!<br>보상을 획득했습니다\.(<br>)*/, '');
    }
    if (kind === 'defeat') {
      const info = this.$('info-content');
      info.innerHTML = info.innerHTML.replace(/^패배\.\.\.(<br>)*/, '');
    }
    content.prepend(head);
  },

  // ---------- Summon ----------
  clearSummonTimers() { this.summonTimers.forEach(clearTimeout); this.summonTimers = []; },
  presentSummon(card, kind) {
    const modal = this.$('modal-gacha');
    const result = this.$('gacha-result');
    if (!card || !modal.classList.contains('active')) return;
    this.clearSummonTimers();
    modal.classList.remove('is-batch');
    const titles = { normal:'일반 소환', challenge:'도전 소환', roulette:'초월 소환' };
    this.$('gacha-title').textContent = titles[kind] || '소환';
    modal.dataset.grade = card.grade;
    const portrait = ImageAssets.createPortrait(card);
    const scene = this.el('div', 'lm-summon');
    scene.dataset.grade = card.grade;
    const rare = ['epic', 'legend', 'transcendence', 'special', 'event'].includes(card.grade);
    scene.dataset.rare = String(rare);
    const light = this.el('div', 'lm-summon-light');
    const flip = this.el('div', 'lm-summon-card');
    const back = this.el('div', 'lm-summon-face lm-summon-back');
    const front = this.el('div', 'lm-summon-face lm-summon-front');
    front.append(portrait, this.el('span', 'lm-summon-frame'));
    flip.append(back, front);
    const info = this.el('div', 'lm-summon-info');
    const ribbon = this.el('div', 'lm-summon-ribbon');
    ribbon.append(this.el('span', 'lm-grade-chip', this.grade(card)), this.el('strong', '', card.name));
    const meta = this.el('small', '');
    meta.append(this.el('i', `lm-el lm-el-${card.element}`), document.createTextNode(`${this.element(card)} · ${this.role(card)}`));
    ribbon.append(meta);
    info.append(ribbon);
    const copies = kind === 'roulette' ? 1 : RPG.state.inventory.filter(id => id === card.id).length;
    if (copies === 1) front.append(this.el('span', 'lm-new', 'NEW'));
    if (kind === 'roulette') info.append(this.el('p', 'lm-summon-note', '다음 오리진 게임 전설 풀에 추가되었습니다.'));
    scene.append(light, flip, info, this.el('i', 'lm-summon-flash'));
    modal.classList.toggle('is-rare', rare);
    modal.classList.remove('is-charging');
    result.replaceChildren(scene);
    result.dataset.grade = card.grade;
    const again = this.$('lm-summon-again');
    const canAgain = (kind === 'normal' || kind === 'challenge') && RPG.state.mode !== 'puzzle';
    again.hidden = !canAgain;
    if (canAgain) {
      again.disabled = (RPG.state.tickets || 0) < GAME_CONSTANTS.COSTS.GACHA_SINGLE;
      again.querySelector('.lm-again-label').textContent = kind === 'challenge' ? '다시 도전' : '한 번 더';
      again.querySelector('.lm-cost').lastChild.textContent = '1';
      again.onclick = () => {
        RPG.closeGachaModal();
        if (kind === 'challenge') RPG.openChallengeGacha(); else RPG.openGacha();
      };
    }
    const reveal = () => {
      this.clearSummonTimers();
      scene.classList.add('is-arrived', 'is-charged', 'is-revealed');
      modal.classList.remove('is-charging');
    };
    if (this.reduced()) { reveal(); return; }
    scene.onclick = reveal;
    requestAnimationFrame(() => scene.classList.add('is-arrived'));
    const charge = rare ? 650 : 220;
    this.summonTimers.push(setTimeout(() => { scene.classList.add('is-charged'); modal.classList.add('is-charging'); }, charge));
    this.summonTimers.push(setTimeout(() => { scene.classList.add('is-revealed'); modal.classList.remove('is-charging'); }, charge + (rare ? 620 : 260)));
  },
  presentBatch(ids, previous, options = {}) {
    const modal = this.$('modal-gacha');
    const result = this.$('gacha-result');
    if (!modal.classList.contains('active')) return;
    this.clearSummonTimers();
    const order = ['normal', 'rare', 'epic', 'legend', 'special', 'event', 'transcendence'];
    const rareGrades = ['epic', 'legend', 'transcendence', 'special', 'event'];
    const cards = ids.map(id => RPG.getCardData(id)).filter(Boolean);
    const best = cards.reduce((top, card) => order.indexOf(card.grade) > order.indexOf(top.grade) ? card : top, cards[0]);
    this.$('gacha-title').textContent = `${options.title || '연속 소환'} · ${cards.length}장`;
    modal.dataset.grade = best.grade;
    modal.classList.add('is-batch');
    modal.classList.toggle('is-rare', rareGrades.includes(best.grade));
    modal.classList.remove('is-charging');
    const scene = this.el('div', 'lm-batch');
    scene.dataset.grade = best.grade;
    const grid = this.el('div', 'lm-batch-grid');
    grid.style.setProperty('--cols', cards.length <= 4 ? cards.length : Math.ceil(cards.length / 2));
    const seen = new Set(previous);
    cards.forEach((card, index) => {
      const item = this.el('button', 'lm-batch-card');
      item.type = 'button';
      item.dataset.grade = card.grade;
      item.dataset.rare = String(rareGrades.includes(card.grade));
      item.style.setProperty('--i', index);
      item.setAttribute('aria-label', `${card.name}, ${this.grade(card)}`);
      const flip = this.el('span', 'lm-batch-flip');
      const back = this.el('span', 'lm-batch-face lm-batch-back');
      const front = this.el('span', 'lm-batch-face lm-batch-front');
      front.append(ImageAssets.createPortrait(card));
      if (!seen.has(card.id)) front.append(this.el('span', 'lm-new', 'NEW'));
      seen.add(card.id);
      flip.append(back, front);
      item.append(flip, this.el('span', 'lm-batch-name', card.name));
      item.onclick = event => {
        if (!scene.classList.contains('is-done')) return;
        event.stopPropagation();
        // A chain can draw the same card twice; paging walks each card once.
        this.detailIds = [...new Set(ids)];
        RPG.showCardInfo(card.id);
      };
      grid.append(item);
    });
    const tally = this.el('div', 'lm-batch-tally');
    for (const grade of [...order].reverse()) {
      const count = cards.filter(card => card.grade === grade).length;
      if (!count) continue;
      const chip = this.el('span', 'lm-grade-chip', `${DISPLAY_NAMES.grade[grade] || grade} ${count}`);
      chip.dataset.grade = grade;
      tally.append(chip);
    }
    if (options.fails) tally.append(this.el('span', 'lm-meta-chip', `오답 ${options.fails}`));
    scene.append(grid, tally);
    result.replaceChildren(scene);
    result.dataset.grade = best.grade;
    const again = this.$('lm-summon-again');
    const next = this.chainCount();
    again.hidden = next < 1;
    again.disabled = false;
    again.querySelector('.lm-again-label').textContent = next >= 2 ? `연속 도전 ×${next}` : '다시 도전';
    again.querySelector('.lm-cost').lastChild.textContent = String(next >= 2 ? next : 1);
    again.onclick = () => { RPG.closeGachaModal(); if (next >= 2) this.startChain(); else RPG.openChallengeGacha(); };
    const finish = () => { this.clearSummonTimers(); scene.classList.add('is-arrived', 'is-revealed', 'is-instant', 'is-done'); };
    if (this.reduced()) { finish(); return; }
    scene.onclick = () => { if (!scene.classList.contains('is-done')) finish(); };
    requestAnimationFrame(() => scene.classList.add('is-arrived'));
    this.summonTimers.push(setTimeout(() => scene.classList.add('is-revealed'), 260));
    this.summonTimers.push(setTimeout(() => scene.classList.add('is-done'), 260 + cards.length * 90 + 520));
  },
  installChainBar() {
    const content = this.$('modal-quiz').querySelector('.modal-content');
    const bar = this.el('div', 'lm-chain');
    bar.id = 'lm-chain';
    bar.hidden = true;
    const stop = this.el('button', '', '그만하기');
    stop.type = 'button';
    stop.onclick = () => { if (this.chain) { this.chain.left = 0; this.syncChainBar(); } };
    bar.append(this.el('span', 'lm-chain-count'), this.el('span', 'lm-chain-score'), stop);
    content.prepend(bar);
  },
  installSummon() {
    const modal = this.$('modal-gacha');
    const content = modal.querySelector('.modal-content');
    const ok = content.querySelector('button[onclick="RPG.closeGachaModal()"]');
    const actions = this.el('div', 'lm-summon-actions');
    const again = this.el('button', 'lm-btn lm-btn-soft');
    again.id = 'lm-summon-again';
    again.type = 'button';
    again.hidden = true;
    again.append(this.icon('summon'), this.el('span', 'lm-again-label', '한 번 더'));
    const cost = this.el('span', 'lm-cost');
    cost.append(this.icon('ticket'), document.createTextNode('1'));
    again.append(cost);
    ok.removeAttribute('style');
    ok.classList.add('lm-cta', 'lm-cta-compact');
    ok.before(actions);
    actions.append(again, ok);
    const observer = new MutationObserver(() => {
      if (modal.classList.contains('active')) return;
      this.clearSummonTimers();
      // classList.remove records a mutation even when nothing changes; only write when needed
      // so this observer never wakes itself.
      if (modal.classList.contains('is-charging') || modal.classList.contains('is-rare')) modal.classList.remove('is-charging', 'is-rare');
      if (document.body.dataset.screen === 'menu') this.syncChainButton();
    });
    observer.observe(modal, { attributes:true, attributeFilter:['class'] });
  },

  // ---------- Mode select ----------
  decorateModes() {
    const list = this.$('mode-list');
    const cleared = new Set(RPG.global?.unlocked_modes || []);
    for (const button of list.querySelectorAll('button')) {
      if (button.querySelector('.lm-mode-name')) continue;
      const mode = button.id.replace('mode-btn-', '');
      const badge = button.querySelector('.hard-clear-badge');
      const name = [...button.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim();
      [...button.childNodes].filter(node => node.nodeType === 3).forEach(node => node.remove());
      button.prepend(this.el('span', 'lm-mode-name', name));
      const goal = GameUtils.getClearStage(mode, RPG.tempGameType);
      const meta = this.el('span', 'lm-mode-meta', Number.isFinite(goal) ? `${goal} 스테이지` : '기록 도전');
      button.insertBefore(meta, badge || null);
      if (cleared.has(mode) && !badge) button.append(this.el('small', 'lm-mode-clear', 'CLEAR'));
      button.removeAttribute('style');
    }
    const desc = this.$('mode-desc');
    desc.classList.toggle('is-empty', !RPG.selectedModeId);
  },
  decorateTypeSelect() {
    const modal = this.$('modal-type-select');
    if (modal.dataset.lumen) return;
    modal.dataset.lumen = 'true';
    const buttons = modal.querySelectorAll('.menu-btn');
    // Keep the controller's display toggle (special editor); drop only legacy colours and spacing.
    buttons.forEach(button => ['padding', 'margin-bottom', 'border-color', 'color'].forEach(name => button.style.removeProperty(name)));
    const [endless, challenge] = buttons;
    endless.classList.add('lm-type-card', 'is-endless');
    challenge.classList.add('lm-type-card', 'is-challenge');
    endless.innerHTML = '<small>ENDLESS</small><strong>엔드리스</strong><span>끝없이 이어지는 스테이지 · 최고 기록</span>';
    challenge.innerHTML = '<small>CHALLENGE</small><strong>챌린지</strong><span>목표 스테이지 돌파 · 보너스 동료 해금</span>';
    const tools = this.el('div', 'lm-type-tools');
    tools.append(this.el('p', 'lm-type-label', '다음 여정의 카드풀'));
    for (const button of [...buttons].slice(2)) { button.classList.add('lm-row-btn'); tools.append(button); }
    challenge.after(tools);
  },

  // ---------- Missions ----------
  decorateMissionHub() {
    const list = this.$('mission-hub-list');
    const g = RPG.global || {};
    const states = [
      [g.monthlyMission, () => RPG.areAllMonthlyMissionsCleared()],
      [g.weeklyMission, () => RPG.areAllWeeklyMissionsCleared()],
      [g.specialMission, () => RPG.areAllSpecialMissionsCleared()]
    ];
    [...list.children].forEach((button, index) => {
      button.removeAttribute('style');
      button.classList.add('lm-mission-row');
      const [mission, cleared] = states[index] || [];
      if (!mission || !mission.missions) return;
      const items = Object.values(mission.missions);
      const done = items.filter(item => (item.progress || 0) >= item.target).length;
      const status = this.el('span', 'lm-mission-state', mission.claimed ? '수령 완료' : `${done} / ${items.length}`);
      if (!mission.claimed && cleared()) { status.textContent = '보상 수령'; status.classList.add('is-ready'); }
      button.append(status);
    });
  },

  // ---------- Install ----------
  overrideAstra() {
    Astra.screenChanged = id => this.screenChanged(id);
    Astra.renderParty = () => this.renderParty();
    Astra.renderCards = (containerId, list, handler) => this.renderCards(containerId, list, handler);
    Astra.cardButton = (card, count, onClick) => this.tile(card, count, onClick);
    Astra.renderCollection = () => this.renderCollection();
    Astra.renderDeckSlots = () => this.renderDeckSlots();
    Astra.updateSlotSelection = index => this.updateSlotSelection(index);
    Astra.renderBattleStatuses = () => this.renderStatuses();
    Astra.decorateSummon = () => {};
    Astra.syncFullscreenShortcut = () => this.syncFullscreen();
    Astra.settings = () => this.settings();
    // Lumen keeps its own theme choice (bright by default) so another edition's saved theme never decides the first look.
    const setTheme = Astra.setTheme.bind(Astra);
    Astra.setTheme = name => {
      if (!this.themeReady) name = this.savedTheme();
      setTheme(name);
      if (this.themeReady) { try { localStorage.setItem('lumenTheme', document.body.dataset.theme); } catch { /* Session only. */ } }
      this.setThemeColor();
    };
  },
  after(name, fn) {
    const original = RPG[name];
    if (typeof original !== 'function') throw new Error(`Missing Card API: ${name}`);
    RPG[name] = function (...args) {
      const result = original.apply(this, args);
      fn.apply(LumenUI, args);
      return result;
    };
  },
  init() {
    this.buildGradeChips();
    this.installSummon();
    this.$('lm-back').onclick = () => this.goBack();
    this.$('lm-scope-run').onclick = () => { Astra.allCards = false; this.renderCollection(); this.$('collection-grid').scrollTop = 0; };
    this.$('lm-scope-all').onclick = () => { Astra.allCards = true; this.renderCollection(); this.$('collection-grid').scrollTop = 0; };
    this.after('showCardInfo', id => this.decorateDetail(id));
    this.after('openDeck', () => {
      const empty = RPG.state.deck.indexOf(null);
      if (empty >= 0) RPG.selectDeckSlot(empty);
    });
    this.after('renderBattlefield', () => this.syncBattle());
    this.after('setupControls', () => this.decorateControls());
    this.after('log', () => this.decorateLog());
    this.after('openInfoModal', title => this.decorateInfo(title));
    this.after('runGacha', isChallenge => {
      if (this.chain && isChallenge) return this.chainPicked();
      this.presentSummon(RPG.getCardData(RPG.state.inventory.at(-1)), isChallenge ? 'challenge' : 'normal');
    });
    const showAlert = RPG.showAlert;
    RPG.showAlert = function (message, ...rest) {
      // A missed quiz inside a chain is tallied on the result instead of interrupting the next question.
      if (LumenUI.chain && /퀴즈 실패/.test(String(message))) {
        LumenUI.chain.fails++;
        setTimeout(() => LumenUI.nextChain(), 120);
        return;
      }
      return showAlert.call(this, message, ...rest);
    };
    this.installChainBar();
    this.after('spinChaosRoulette', () => this.presentSummon(RPG.getCardData((RPG.global.pendingTranscendenceCards || []).at(-1)), 'roulette'));
    this.after('openModeSelect', () => this.decorateModes());
    this.after('openTypeSelect', () => this.decorateTypeSelect());
    this.after('renderMissionHub', () => this.decorateMissionHub());
    this.after('closeMissionView', () => this.refreshDots());
    this.after('closeMissionHub', () => this.refreshDots());
    this.after('updateSystemMenuUI', () => this.syncSettings());
    this.after('toggleHardMode', () => this.decorateModes());
    this.wrapBattle();
    for (const id of ['mode-list']) {
      this.$(id).addEventListener('click', () => this.$('mode-desc').classList.toggle('is-empty', !RPG.selectedModeId));
    }
    const fortune = this.$('modal-fortune-cookie');
    new MutationObserver(() => { if (!fortune.classList.contains('active')) this.refreshDots(); }).observe(fortune, { attributes:true, attributeFilter:['class'] });
    this.themeReady = true;
    this.setThemeColor();
    this.syncFullscreen();
    document.body.classList.add('lm-ready');
    this.ready = true;
  }
};

LumenUI.overrideAstra();
document.addEventListener('DOMContentLoaded', () => LumenUI.init());
