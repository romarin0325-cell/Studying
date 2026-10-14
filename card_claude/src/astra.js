/* DREAMWEAVER · Claude Edition presentation layer. Game rules and learning content are
   owned by card/game/. Hooks call the original method unless this file owns that view. */
'use strict';

const Astra = {
  ready: false,
  allCards: false,
  collectionContext: 'library',
  localPortraits: new Map(),
  portraitPath: '',
  deckFilter: 'all',
  lastScreen: null,
  battleSnapshot: null,
  pendingBonus: null,
  hpMemory: new Map(),
  viewer: { ids: [], index: -1 },
  battleCue: { side: null, type: 'phy', crit: 0, enemyTurn: -1 },
  GRADE_ORDER: ['transcendence','legend','epic','rare','special','event','normal'],
  GRADE_LABELS: { all:'전체', transcendence:'초월', legend:'전설', epic:'에픽', rare:'레어', special:'스페셜', event:'이벤트', normal:'노멀' },
  SUMMON_NAMES: { astra:'성좌 소환', strawberry:'하트 소환', dreamsky:'구름 소환' },
  revealTimers: [],
  get elementNames() { return DISPLAY_NAMES.element; },
  get roleNames() { return DISPLAY_NAMES.role; },
  get gradeNames() { return DISPLAY_NAMES.grade; },
  get modeNames() { return DISPLAY_NAMES.mode; },
  get motion() { return !document.body.classList.contains('dw-lite'); },

  $(id) { return document.getElementById(id); },
  icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  },
  text(tag, value, className) {
    const el = document.createElement(tag);
    el.textContent = value;
    if (className) el.className = className;
    return el;
  },
  button(label, className, onClick) {
    const button = this.text('button', label, className);
    button.type = 'button';
    if (onClick) button.onclick = onClick;
    return button;
  },
  hook(name, after) {
    const original = RPG[name];
    if (typeof original !== 'function') throw new Error(`Missing Card API: ${name}`);
    RPG[name] = function (...args) {
      const result = original.apply(this, args);
      after.apply(Astra, args);
      return result;
    };
  },
  hookBefore(name, before) {
    const original = RPG[name];
    if (typeof original !== 'function') throw new Error(`Missing Card API: ${name}`);
    RPG[name] = function (...args) {
      before.apply(Astra, args);
      return original.apply(this, args);
    };
  },
  hookDoubleConfirmed(name, after) {
    const original = RPG[name];
    if (typeof original !== 'function' || typeof RPG.showDoubleConfirm !== 'function') throw new Error(`Missing Card API: ${name}`);
    RPG[name] = function (...args) {
      const showDoubleConfirm = this.showDoubleConfirm;
      let intercepted = false;
      this.showDoubleConfirm = function (firstMessage, secondMessage, onYes) {
        intercepted = true;
        this.showDoubleConfirm = showDoubleConfirm;
        return showDoubleConfirm.call(this, firstMessage, secondMessage, () => {
          const result = onYes?.();
          after.apply(Astra, args);
          return result;
        });
      };
      try { return original.apply(this, args); }
      finally { if (!intercepted) this.showDoubleConfirm = showDoubleConfirm; }
    };
  },
  portrait(entity, className = '') {
    return ImageAssets.createPortrait(entity || '', { wrapperClass:`dw-art${className ? ` ${className}` : ''}` });
  },
  // A 3:5 portrait in its grade frame, with the element badge.
  framed(card, className = '') {
    const frame = this.text('span', '', `dw-frame${className ? ` ${className}` : ''}`);
    if (card?.grade) frame.dataset.grade = card.grade;
    frame.append(this.portrait(card));
    if (card?.element) {
      const badge = this.text('span', '', 'dw-el');
      badge.dataset.el = card.element;
      badge.append(this.icon(`el-${['fire','water','nature','wind','light','dark','earth'].includes(card.element) ? card.element : 'normal'}`));
      badge.title = this.elementNames[card.element] || card.element;
      frame.append(badge);
    }
    return frame;
  },
  cardLine(card) {
    return [this.elementNames[card.element] || card.element, this.roleNames[card.role] || card.role].filter(Boolean).join(' · ');
  },
  inRun() { return !!(RPG.state && RPG.state.mode && RPG.state.deck); },
  sfx(name) { if (typeof DreamSfx !== 'undefined') DreamSfx.play(name); },

  // ---------- Theme, motion, sound ----------
  setTheme(name) {
    const themes = {astra:'#0d2235',strawberry:'#fde8f1',dreamsky:'#eaf5fb'};
    if (!Object.prototype.hasOwnProperty.call(themes,name)) name = 'astra';
    document.body.dataset.theme = name;
    document.querySelector('meta[name="theme-color"]').content = themes[name];
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.themeChoice === name)));
    const back = window.DREAMWEAVER_THEME_CARDS?.[name];
    if (back) document.body.style.setProperty('--card-back', `url("${back}")`);
    else document.body.style.removeProperty('--card-back');
    document.querySelectorAll('img[data-fallback=true]').forEach(img => {
      // Never replace a real portrait or interrupt an in-flight local image load.
      if (img.src.startsWith('data:image/')) img.src = this.fallback(img._astraEntity);
    });
    try { localStorage.setItem('dreamweaverTheme',name); } catch { /* Theme remains usable for this session. */ }
    if (this.ready && document.body.dataset.screen === 'summon') this.renderSummon();
  },
  installMotion() {
    let stored = null;
    try { stored = localStorage.getItem('dwMotion'); } catch { /* Default below. */ }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.toggle('dw-lite', stored ? stored === 'off' : !!reduce);
    this.syncToggles();
  },
  toggleMotion() {
    document.body.classList.toggle('dw-lite');
    try { localStorage.setItem('dwMotion', this.motion ? 'on' : 'off'); } catch { /* Session only. */ }
    this.syncToggles();
  },
  toggleSfx() {
    if (typeof DreamSfx === 'undefined') return;
    DreamSfx.setEnabled(!DreamSfx.enabled);
    this.syncToggles();
    this.sfx('tap');
  },
  syncToggles() {
    this.$('dw-motion-toggle')?.setAttribute('aria-checked', String(this.motion));
    this.$('dw-sfx-toggle')?.setAttribute('aria-checked', String(typeof DreamSfx !== 'undefined' && DreamSfx.enabled));
  },
  syncFullscreenShortcut() {
    const button = this.$('btn-game-fullscreen');
    const label = button.textContent.replace('⛶','').trim() || '전체화면';
    button.setAttribute('aria-label',label);
    button.title = label;
    button.replaceChildren(this.icon(document.fullscreenElement ? 'shrink' : 'expand'));
  },
  installChatViewport() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const modal = this.$('modal-lumi-question');
    const update = () => {
      // Follow only the visible chat viewport; do not scroll the page or trap zoom.
      if (viewport.scale !== 1) { modal.style.removeProperty('--chat-height'); modal.style.removeProperty('--chat-top'); return; }
      modal.style.setProperty('--chat-height',`${viewport.height}px`);
      modal.style.setProperty('--chat-top',`${viewport.offsetTop}px`);
    };
    viewport.addEventListener('resize',update);
    viewport.addEventListener('scroll',update);
    update();
  },
  home() {
    if (!this.ready || !['collection','deck','study','summon'].includes(document.body.dataset.screen)) return;
    RPG.toMenu();
  },
  learn() {
    RPG.showScreen('screen-study');
    this.renderStudy();
  },
  menu() {
    if (!this.ready) return;
    RPG.openSystemMenu();
  },
  showSummon() {
    if (!this.ready || !this.inRun()) return;
    // toMenu() prepares the mode-specific summon controls (draft, chaos, puzzle).
    if (!['menu','summon','deck','collection','study'].includes(document.body.dataset.screen)) return;
    if (document.body.dataset.screen === 'summon') return this.renderSummon();
    RPG.toMenu();
    RPG.showScreen('screen-summon');
    this.renderSummon();
  },
  settings() {
    if (!this.ready) return;
    this.$('asset-path').value = this.portraitPath;
    this.$('modal-menu').classList.remove('active');
    this.syncToggles();
    this.$('modal-astra-settings').classList.add('active');
  },
  closeSettings() { this.$('modal-astra-settings').classList.remove('active'); },
  toast(message) {
    const toast = this.$('astra-toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
  },
  // Plain confirmations become non-blocking toasts. Messages that ask the player
  // to read or decide something keep the original dialog.
  isToastNotice(message) {
    if (typeof message !== 'string' || message.includes('<') || message.length > 60) return false;
    return ['저장되었습니다.','불러오기 완료','티켓이 부족합니다.','정답! 드로우권 1장을 추가로 획득했습니다.','오답입니다... 보상 없음.','오답입니다... 추가 효과는 없습니다.'].includes(message.trim());
  },

  // This emblem is deliberately a card back, never a generated replacement
  // portrait. Native image loading still resolves each exact original filename.
  fallback(entity) {
    const themed = window.DREAMWEAVER_THEME_CARDS?.[document.body.dataset.theme];
    if (themed) return themed;
    const color = { fire:'#d8a999', water:'#a5dfff', nature:'#b5d6bd', light:'#e7ca94', dark:'#bdb5dd' }[entity?.element] || '#a5dfff';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 300"><rect width="180" height="300" fill="#132f46"/><g fill="none" stroke="${color}"><rect x="9" y="9" width="162" height="282" rx="10" opacity=".35"/><path opacity=".25" d="M90 45 162 95v110l-72 50-72-50V95Z"/><circle cx="90" cy="150" r="46" opacity=".35"/><path stroke-width="1.5" d="m90 98 14 38 38 14-38 14-14 38-14-38-38-14 38-14Z"/><path opacity=".65" fill="${color}" fill-opacity=".12" d="m90 118 11 32-11 32-11-32Z"/></g></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  },
  installImages() {
    try { this.portraitPath = localStorage.getItem('astraPortraitPath') || ''; } catch { /* Session-only still works. */ }
    const originalLoad = ImageAssets.load.bind(ImageAssets);
    ImageAssets.load = (img, entity, options = {}) => {
      if (!img) return;
      const filename = ImageAssets.getEntitySource(entity);
      const selected = this.localPortraits.get(filename.normalize('NFC'));
      const resolved = selected || (filename ? this.portraitPath + filename : '');
      img.dataset.astraSource = filename;
      img._astraEntity = entity;
      if (ImageAssets.sources.get(img) === resolved && !options.force) {
        if (img.dataset.fallback === 'true') img.src = this.fallback(entity);
        return originalLoad(img, resolved, { ...options, alt:options.alt || entity?.name || filename.replace(/\.png$/i, '') });
      }
      delete img.dataset.fallback;
      originalLoad(img, resolved, { ...options, alt:options.alt || entity?.name || filename.replace(/\.png$/i, '') });
      const originalError = img.onerror;
      if (originalError) {
        img.onerror = () => {
          originalError();
          img.dataset.fallback = 'true';
          img.src = this.fallback(entity);
          img.style.display = 'block';
          if (options.parent && options.toggleParent) options.parent.style.display = '';
        };
      }
      const originalSuccess = img.onload;
      if (originalSuccess) {
        img.onload = () => {
          originalSuccess();
          if (!img.src.startsWith('data:image/')) delete img.dataset.fallback;
        };
      }
      if (!filename) {
        img.src = this.fallback(entity);
        img.style.display = 'block';
        img.dataset.fallback = 'true';
      }
    };
  },
  refreshImages() {
    document.querySelectorAll('img[data-astra-source]').forEach(img => {
      ImageAssets.load(img, img._astraEntity || img.dataset.astraSource, { force:true, alt:img.alt });
    });
    if (this.inRun()) {
      this.$('astra-party').replaceChildren();
      this.renderParty();
    }
  },
  setPortraitPath(value) {
    const clean = value.trim().replaceAll('\\', '/');
    if (/^[a-z]+:/i.test(clean) || clean.startsWith('//') || /[?#<>]/.test(clean)) {
      this.toast('HTML 기준 상대 폴더 경로를 입력하세요. 예: portraits/');
      return false;
    }
    this.portraitPath = clean && !clean.endsWith('/') ? `${clean}/` : clean;
    try { localStorage.setItem('astraPortraitPath', this.portraitPath); } catch { this.toast('이 실행 중에만 경로를 적용합니다.'); }
    this.refreshImages();
    this.$('asset-status').textContent = this.portraitPath ? `초상화 위치: ${this.portraitPath}` : 'HTML과 같은 폴더에서 초상화를 불러옵니다.';
    return true;
  },
  selectPortraitFiles(files) {
    for (const url of this.localPortraits.values()) URL.revokeObjectURL(url);
    this.localPortraits.clear();
    for (const file of files) {
      if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(file.name)) continue;
      const key = file.name.normalize('NFC');
      if (!this.localPortraits.has(key)) this.localPortraits.set(key, URL.createObjectURL(file));
    }
    this.refreshImages();
    this.$('asset-status').textContent = `초상화 ${this.localPortraits.size}개 연결됨 · 현재 실행 중에 유지됩니다.`;
  },

  // ---------- Screens ----------
  screenChanged(id) {
    const kind = id.replace('screen-', '');
    if (kind !== 'collection' && this.collectionContext === 'factory') {
      this.collectionContext = 'library';
      delete document.body.dataset.collectionContext;
    }
    const screen = ['title','menu','collection','deck','study','battle','summon'].includes(kind) ? kind : 'draft';
    document.body.dataset.screen = screen;
    // Re-entering the current screen (for example after a dialog) must not replay motion.
    const element = this.$(id);
    if (this.lastScreen !== id && element) {
      element.classList.remove('dw-enter');
      void element.offsetWidth;
      element.classList.add('dw-enter');
    }
    this.lastScreen = id;
    document.querySelectorAll('[data-nav]').forEach(button => {
      if (button.dataset.nav === kind) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    this.updateHeader();
    if (kind === 'title') {
      this.$('modal-menu').classList.remove('active');
      this.renderTitle();
    }
  },
  updateHeader() {
    const screen = document.body.dataset.screen;
    const names = { title:'', menu:'로비', deck:'파티 편성', collection:this.collectionContext === 'factory' ? '드래프트 덱' : '카드 도감', study:'배움의 기록실', battle:'전투', draft:'여정 준비', summon:'소환' };
    document.querySelector('.header-status').textContent = names[screen] ?? '';
    let kicker = '';
    if (this.inRun() && screen !== 'title') {
      const state = RPG.state;
      kicker = screen === 'battle'
        ? `STAGE ${state.enemyScale + 1}`
        : [this.modeNames[state.mode] || state.mode, state.gameType === 'endless' ? '엔드리스' : '도전', state.hardMode ? '하드' : ''].filter(Boolean).join(' · ');
    }
    this.$('dw-top-kicker').textContent = kicker;
    this.$('dw-mission-dot').hidden = !this.missionClaimable();
  },
  saveSummary() {
    const result = Storage.loadDetailed(Storage.keys.SAVE);
    if (result.reason === 'missing') return null;
    const data = result.ok ? result.data : null;
    if (!data || typeof data !== 'object' || !data.mode) return {text:''};
    const stage = Number.isFinite(data.enemyScale) ? data.enemyScale + 1 : null;
    return {text:[this.modeNames[data.mode] || data.mode, data.gameType === 'endless' ? '엔드리스' : data.gameType === 'challenge' ? '도전' : '', stage ? `STAGE ${stage}` : ''].filter(Boolean).join(' · ')};
  },
  renderTitle() {
    const summary = this.saveSummary();
    const start = this.$('btn-start-load');
    start.replaceChildren();
    const label = this.text('span', summary ? '여정 이어가기' : '여정 시작하기');
    label.append(this.text('small', summary ? (summary.text || '저장된 여정') : '첫 여정을 떠나요'));
    start.append(label, this.icon('arrow'));
    start.onclick = () => { this.sfx('open'); RPG.startGame(summary ? 'load' : 'new'); };
    this.$('btn-start-new').hidden = !summary;
    this.$('btn-fortune-cookie').classList.toggle('has-dot', typeof FortuneCookie !== 'undefined' && FortuneCookie.canUse());
    this.$('btn-title-mission').classList.toggle('has-dot', this.missionClaimable());
  },
  missionClaimable() {
    if (!RPG._globalLoaded || !RPG.global) return false;
    const done = mission => !!mission && !mission.claimed && Object.values(mission.missions || {}).length > 0
      && Object.values(mission.missions).every(item => (item.progress || 0) >= item.target);
    const special = RPG.global.specialMission;
    return done(RPG.global.weeklyMission) || done(RPG.global.monthlyMission) || (!!special?.unlocked && !!special.rewardCardId && done(special));
  },

  // ---------- Lobby ----------
  renderParty() {
    if (!this.inRun()) return;
    const state = RPG.state;
    const box = this.$('astra-party');
    const slots = ['선봉','중견','대장'];
    [0,1,2].forEach(index => {
      const id = state.deck[index] || null;
      const card = id ? RPG.getCardData(id) : null;
      const current = box.querySelector(`[data-slot="${index}"]`);
      // Unchanged members keep their loaded portrait element: no blank frame on return.
      if (current && current.dataset.cardKey === String(card?.id || '')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `party-card${card ? '' : ' empty'}`;
      button.dataset.slot = String(index);
      button.dataset.cardKey = card?.id || '';
      if (card) button.dataset.grade = card.grade;
      button.setAttribute('aria-label', `${slots[index]}: ${card?.name || '비어 있음'}, 편성하기`);
      button.onclick = () => { this.sfx('tap'); RPG.openDeck(); RPG.selectDeckSlot(index); };
      button.append(this.text('span', slots[index], 'party-position'));
      let art;
      if (card) art = this.framed(card);
      else {
        art = this.text('span', '', 'dw-art dw-art--empty');
        art.append(this.icon('plus'));
      }
      const plate = this.text('span', '', 'dw-plate');
      plate.append(this.text('strong', card?.name || '빈 자리'), this.text('small', card ? this.cardLine(card) : '눌러서 배치'));
      art.append(plate);
      button.append(art);
      if (current) current.replaceWith(button);
      else box.append(button);
    });
    const filled = state.deck.filter(id => id && RPG.getCardData(id)).length;
    const owned = state.inventory.length;
    let note = '';
    if (!filled) note = owned ? '동료를 배치하면 출전할 수 있어요.' : '먼저 소환에서 동료를 모으세요.';
    else if (filled < 3 && owned > filled) note = `빈 자리 ${3 - filled}곳 · 편성에서 자동 편성으로 채울 수 있어요.`;
    this.$('astra-party-note').textContent = note;
    this.$('astra-party-note').hidden = !note;
    this.$('astra-depart').disabled = !filled;
    this.$('astra-depart-help').textContent = filled ? `STAGE ${state.enemyScale + 1} 도전` : '파티를 먼저 편성하세요';
    this.renderStage();
    this.renderBlessBadge();
    this.updateHeader();
    if (document.body.dataset.screen === 'summon') this.renderSummon();
  },
  renderStage() {
    const state = RPG.state;
    const stage = state.enemyScale + 1;
    this.$('astra-stage').textContent = String(stage).padStart(2, '0');
    this.$('astra-mode').textContent = this.modeNames[state.mode] || state.mode;
    this.$('dw-stage-type').textContent = [state.gameType === 'endless' ? '엔드리스' : '도전', state.hardMode ? '하드' : ''].filter(Boolean).join(' · ');
    const clear = GameUtils.getClearStage(state.mode, state.gameType);
    const route = this.$('dw-route');
    route.replaceChildren();
    if (Number.isFinite(clear)) {
      this.$('dw-stage-goal').textContent = `/ ${clear}`;
      // Six-stage chapters: the run reads as a short path with the next step lit.
      const chapter = Math.floor(state.enemyScale / 6);
      for (let i = 0; i < 6; i++) {
        const index = chapter * 6 + i;
        if (index >= clear) break;
        const step = this.text('i', '');
        if (index < state.enemyScale) step.className = 'is-done';
        else if (index === state.enemyScale) step.className = 'is-now';
        if (i === 5) step.classList.add('is-boss');
        route.append(step);
      }
    } else {
      this.$('dw-stage-goal').textContent = '';
      const record = typeof ModeRecords !== 'undefined' ? ModeRecords.read() : {ok:false};
      const best = record.ok ? record.data.modes[state.mode]?.maxStage : 0;
      if (best) route.append(this.text('span', `최고 기록 STAGE ${best}`, 'dw-route-text'));
    }
    const enemy = RPG.getCurrentStageEnemyData();
    const name = this.$('next-enemy-text');
    name.textContent = enemy.name;
    if (state.mode === 'dream_corridor') {
      const max = GAME_CONSTANTS.DREAM_CORRIDOR_MAX_LIVES;
      const lives = state.dreamCorridorLives ?? max;
      name.append(this.text('span', ` ${'♥'.repeat(Math.max(0,lives))}${'♡'.repeat(Math.max(0,max - lives))}`, 'dw-lives'));
    }
    // toMenu() hides the legacy preview; the lobby always shows the opponent.
    const img = this.$('next-enemy-img');
    img.parentElement.style.display = '';
    const source = ImageAssets.getEntitySource(enemy);
    if (img.dataset.astraSource === source && img.getAttribute('src')) img.style.display = 'block';
    else ImageAssets.load(img, enemy, { force:true, alt:enemy.name });
  },
  renderBlessBadge() {
    const state = RPG.state;
    const active = (state.activeChaosBlessing || []).length + (state.activeSageBlessing || []).length;
    const badge = this.$('dw-bless-count');
    badge.hidden = !active;
    badge.textContent = active ? String(active) : '';
    this.$('dw-bless').classList.toggle('is-active', !!active);
    this.$('dw-bless').setAttribute('aria-label', active ? `축복의 제단, 축복 받은 카드 ${active}장` : '축복의 제단');
  },
  showRates() {
    const mode = RPG.state?.mode;
    const table = GACHA_RATES[mode] || GACHA_RATES.default;
    const describe = rates => {
      let previous = 0;
      const rows = rates.map(entry => {
        const value = Math.round((entry.threshold - previous) * 100);
        previous = entry.threshold;
        return `<tr><th>${this.GRADE_LABELS[entry.grade] || entry.grade}</th><td>${value}%</td></tr>`;
      });
      rows.push(`<tr><th>${this.GRADE_LABELS.normal}</th><td>${Math.round((1 - previous) * 100)}%</td></tr>`);
      return rows.join('');
    };
    RPG.openInfoModal('소환 확률', `<div class="dw-rates"><section><h4>일반 소환</h4><table>${describe(table.normal)}</table></section><section><h4>도전 소환</h4><table>${describe(table.challenge)}</table></section></div><p class="dw-note">도전 소환은 단어 퀴즈에 정답일 때 진행되며, 오답이면 티켓만 소모됩니다.</p>`);
  },

  // ---------- Summon screen ----------
  summonPool() {
    try { return GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions()); } catch { return []; }
  },
  renderSummon() {
    if (!this.inRun()) return;
    const state = RPG.state;
    const special = state.mode === 'draft' ? '드래프트' : ['chaos','artifact_chaos'].includes(state.mode) ? '카오스 풀' : state.mode === 'puzzle' ? '퍼즐 조각' : null;
    this.$('dw-banner-kicker').textContent = `${this.modeNames[state.mode] || state.mode} 카드풀`;
    this.$('dw-banner-title').textContent = special || this.SUMMON_NAMES[document.body.dataset.theme] || this.SUMMON_NAMES.astra;
    this.$('dw-nav-summon-label').textContent = state.mode === 'draft' ? '드래프트' : '소환';
    const pool = this.summonPool();
    const legends = pool.filter(card => card.grade === 'legend');
    this.$('dw-banner-pool').textContent = special ? `${this.modeNames[state.mode] || state.mode} 모드 전용 진행` : `${new Set(pool.map(card => card.id)).size}종 중 전설 ${legends.length}종`;
    const feature = this.$('dw-banner-feature');
    const key = `${state.mode}:${legends.length}`;
    if (feature.dataset.key !== key) {
      feature.dataset.key = key;
      feature.replaceChildren();
      // A stable showcase per run: the first three legends by grade order and name.
      RPG.sortCardDataByGrade(legends).slice(0, 3).forEach(card => feature.append(this.framed(card)));
    }
    this.renderSummonControls();
  },
  // Probability of one grade in a rate table (thresholds are cumulative).
  rateOf(rates, grade) {
    let previous = 0;
    for (const entry of rates) {
      if (entry.grade === grade) return entry.threshold - previous;
      previous = entry.threshold;
    }
    return 0;
  },
  // The learning summon is the headline: the quiz path is bigger, first, and shows what it is worth.
  renderSummonControls() {
    const state = RPG.state;
    const cost = GAME_CONSTANTS.COSTS.GACHA_SINGLE;
    const normal = this.$('btn-normal-gacha');
    const challenge = this.$('btn-challenge-gacha');
    const label = (button, title, sub, price) => {
      const copy = this.text('span', '');
      copy.append(this.text('strong', title));
      if (sub) copy.append(sub);
      button.replaceChildren(copy);
      if (price !== null) button.append(this.priceTag(price));
    };
    const table = GACHA_RATES[state.mode] || GACHA_RATES.default;
    const top = ['legend','epic','rare'].find(grade => this.rateOf(table.challenge, grade) > 0) || 'rare';
    const pct = rates => `${Math.round(this.rateOf(rates, top) * 100)}%`;
    const odds = this.text('small', '', 'dw-odds');
    odds.append(this.text('span', `단어 퀴즈 정답 시 ${this.GRADE_LABELS[top]} `), this.text('s', pct(table.normal)), this.text('span', ' → '), this.text('b', pct(table.challenge)));
    label(challenge, '도전 소환', odds, cost);
    challenge.prepend(this.icon('cap'));
    if (state.mode === 'puzzle') label(normal, '퍼즐 조각', this.text('small', '단어 퀴즈로 36장 확보'), null);
    else label(normal, '일반 소환', this.text('small', `${this.GRADE_LABELS[top]} ${pct(table.normal)}`), cost);
    normal.disabled = state.mode !== 'puzzle' && state.tickets < cost;
    challenge.disabled = state.tickets < cost;
  },
  afterGacha(isChallenge) {
    const modal = this.$('modal-gacha');
    if (!modal.classList.contains('active')) return;
    const roulette = this.$('screen-chaos-roulette').classList.contains('active') && isChallenge === undefined;
    const id = roulette ? RPG.global.pendingTranscendenceCards?.at(-1) : RPG.state.inventory.at(-1);
    const card = RPG.getCardData(id);
    if (!card) return;
    modal.classList.remove('active');
    this.openReveal(card, { title: roulette ? '초월 소환' : isChallenge ? '도전 소환 성공' : '일반 소환', kind: roulette ? 'roulette' : isChallenge ? 'challenge' : 'normal', note: roulette ? '다음 오리진 게임 전설 풀에 추가되었습니다.' : '' });
  },
  openReveal(card, options) {
    const stage = this.$('dw-reveal');
    this.clearRevealTimers();
    stage.dataset.best = card.grade;
    stage.classList.remove('is-done');
    stage.replaceChildren();
    stage.append(this.text('i', '', 'dw-reveal-rays'), this.text('i', '', 'dw-reveal-circle'));
    const heading = this.text('h2', options.title, 'dw-reveal-title');
    heading.id = 'dw-reveal-title';
    const flip = this.button('', 'dw-flip');
    flip.dataset.grade = card.grade;
    flip.setAttribute('aria-label', '카드 공개');
    const inner = this.text('span', '', 'dw-flip-inner');
    const front = this.text('span', '', 'dw-flip-face dw-flip-front');
    front.append(this.framed(card));
    inner.append(this.text('span', '', 'dw-flip-face dw-flip-back'), front);
    const caption = this.text('span', '', 'dw-flip-caption');
    caption.dataset.grade = card.grade;
    caption.append(this.text('span', this.GRADE_LABELS[card.grade] || card.grade, 'dw-grade-tag'), this.text('strong', card.name), this.text('small', this.cardLine(card)));
    flip.append(inner, caption);
    flip.onclick = () => this.flipCard();
    const note = this.text('p', options.note || '', 'dw-reveal-summary');
    note.setAttribute('aria-live', 'polite');
    const actions = this.text('div', '', 'dw-reveal-actions');
    actions.append(this.button('확인', 'dw-btn', () => this.closeReveal()));
    const cost = GAME_CONSTANTS.COSTS.GACHA_SINGLE;
    // Every follow-up leads into another quiz; the plain summon never offers a faster repeat.
    if (options.kind !== 'roulette' && RPG.state.tickets >= cost) {
      const next = this.button('', 'dw-btn dw-btn--primary', () => { this.closeReveal(); RPG.openChallengeGacha(); });
      next.id = 'dw-gacha-again';
      next.append(this.text('span', options.kind === 'challenge' ? '한 번 더 도전' : '도전 소환'), this.priceTag(cost));
      actions.append(next);
    }
    stage.append(heading, flip, note, this.text('p', '카드를 눌러 공개', 'dw-reveal-hint'), actions);
    stage.setAttribute('role','dialog');
    stage.setAttribute('aria-modal','true');
    stage.setAttribute('aria-labelledby','dw-reveal-title');
    stage.setAttribute('aria-hidden','false');
    stage.classList.add('is-open');
    this.revealState = { flip, card, opener:document.activeElement };
    for (const el of document.querySelectorAll('.dw-top,main,.astra-nav')) el.inert = true;
    this.renderTicketCount();
    this.sfx('summon');
    flip.focus({preventScroll:true});
    if (!this.motion) return this.flipCard();
    this.revealTimers.push(setTimeout(() => this.flipCard(), 650));
  },
  flipCard() {
    const state = this.revealState;
    if (!state || state.flip.classList.contains('is-flipped')) return;
    const { flip, card } = state;
    flip.classList.add('is-flipped');
    flip.setAttribute('aria-label', `${card.name}, ${this.GRADE_LABELS[card.grade] || card.grade}`);
    this.sfx(['legend','transcendence','special'].includes(card.grade) ? 'legend' : card.grade === 'epic' ? 'epic' : card.grade === 'rare' ? 'rare' : 'flip');
    const stage = this.$('dw-reveal');
    stage.classList.add('is-done');
    this.revealTimers.push(setTimeout(() => stage.querySelector('.dw-reveal-actions .dw-btn:last-child')?.focus({preventScroll:true}), 60));
  },
  clearRevealTimers() {
    this.revealTimers.forEach(clearTimeout);
    this.revealTimers = [];
  },
  closeReveal() {
    const stage = this.$('dw-reveal');
    if (!stage.classList.contains('is-open')) return;
    this.clearRevealTimers();
    stage.classList.remove('is-open','is-done');
    stage.setAttribute('aria-hidden','true');
    stage.replaceChildren();
    for (const el of document.querySelectorAll('.dw-top,main,.astra-nav')) el.inert = !!document.querySelector('.modal.active');
    const opener = this.revealState?.opener;
    this.revealState = null;
    this.renderTicketCount();
    if (this.inRun()) { this.renderSummonControls(); this.renderParty(); }
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({preventScroll:true});
  },
  priceTag(value) {
    const tag = this.text('span', '', 'dw-price');
    tag.append(this.icon('ticket'), this.text('b', String(value)));
    return tag;
  },
  renderTicketCount() {
    if (this.inRun()) this.$('ui-tickets').textContent = RPG.state.tickets;
  },

  // ---------- Cards, collection and formation ----------
  cardTile(card, options = {}) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `dw-card${options.count === 0 ? ' is-unowned' : ''}${options.selected ? ' is-selected' : ''}`;
    tile.dataset.cardId = card.id;
    tile.dataset.grade = card.grade;
    const availability = options.count === null || options.count === undefined ? '' : options.count ? `${options.count}장 보유` : '미보유';
    tile.setAttribute('aria-label', [card.name, this.gradeNames[card.grade] || card.grade, availability].filter(Boolean).join(', '));
    const frame = this.framed(card);
    if (options.count > 1) frame.append(this.text('span', `×${options.count}`, 'dw-card-count'));
    tile.append(frame);
    tile.append(this.text('span', card.name, 'dw-card-name'));
    tile.append(this.text('span', options.count === 0 ? '미보유' : this.cardLine(card), 'dw-card-meta'));
    tile.onclick = options.onClick;
    if (!options.info) return tile;
    const wrap = this.text('div', '', 'dw-card-wrap');
    const info = this.button('', 'dw-card-info', event => { event.stopPropagation(); this.showCard(card.id, options.list); });
    info.append(this.icon('info'));
    info.setAttribute('aria-label', `${card.name} 상세 정보`);
    wrap.append(tile, info);
    return wrap;
  },
  renderCards(containerId, list, clickHandler) {
    if (containerId === 'deck-card-list') return this.renderDeckCards(clickHandler);
    const box = this.$(containerId);
    box.replaceChildren();
    const counts = new Map();
    for (const id of list) counts.set(id,(counts.get(id)||0)+1);
    for (const id of RPG.sortCardIdsByGrade([...counts.keys()])) {
      const card = RPG.getCardData(id);
      if (card) box.append(this.cardTile(card, { count: containerId === 'card-pool-grid' ? null : counts.get(id), onClick: () => clickHandler(id) }));
    }
  },
  gradeChips(box, grades, current, onPick) {
    box.replaceChildren();
    for (const grade of grades) {
      const chip = this.button(this.GRADE_LABELS[grade] || grade, 'dw-chip', () => onPick(grade));
      chip.dataset.gradeChoice = grade;
      chip.setAttribute('aria-pressed', String(current === grade));
      box.append(chip);
    }
  },
  renderCollection() {
    const counts = new Map();
    for (const id of RPG.state.inventory) counts.set(id,(counts.get(id)||0)+1);
    const all = GameUtils.getAllCards();
    const source = this.allCards ? all : [...counts.keys()].map(id => RPG.getCardData(id)).filter(Boolean);
    const cards = new Map(source.map(card => [card.id,card]));
    const query = this.$('card-search').value.trim().toLocaleLowerCase();
    const grade = this.$('card-grade').value;
    const filtered = [...cards.values()].filter(card => (grade === 'all' || card.grade === grade)
      && `${card.name} ${card.element} ${card.role} ${this.elementNames[card.element] || ''} ${this.roleNames[card.role] || ''}`.toLocaleLowerCase().includes(query));
    const box = this.$('collection-grid');
    box.replaceChildren();
    const byId = new Map(filtered.map(card => [card.id,card]));
    const ordered = RPG.sortCardIdsByGrade([...byId.keys()]);
    for (const id of ordered) box.append(this.cardTile(byId.get(id), { count:counts.get(id)||0, onClick:() => this.showCard(id, ordered) }));
    this.$('collection-empty').hidden = filtered.length !== 0;
    const ownedKinds = counts.size;
    const totalKinds = new Set(all.map(card => card.id)).size;
    this.$('collection-count').textContent = this.allCards ? `${filtered.length}종 · 보유 ${ownedKinds}종` : `${filtered.length}종`;
    this.$('collection-scope').textContent = this.allCards ? `전체 ${cards.size}종` : `보유 ${ownedKinds}종`;
    this.$('collection-scope').title = this.allCards ? '눌러서 보유 카드만 보기' : '눌러서 전체 도감 보기';
    const ratio = totalKinds ? ownedKinds / totalKinds : 0;
    this.$('dw-completion-value').textContent = `${ownedKinds} / ${totalKinds}`;
    this.$('dw-completion-bar').style.width = `${Math.round(ratio * 100)}%`;
    const grades = ['all', ...[...this.$('card-grade').options].map(option => option.value).filter(value => value !== 'all')];
    this.gradeChips(this.$('grade-options'), grades, grade, picked => {
      this.$('card-grade').value = picked;
      this.renderCollection();
    });
  },
  openCollection() {
    this.collectionContext = 'library';
    delete document.body.dataset.collectionContext;
    this.$('collection-title').textContent = '카드 도감';
    this.$('collection-back').textContent = '로비로';
    this.$('collection-back').onclick = () => RPG.toMenu();
    RPG.showScreen('screen-collection');
    this.renderCollection();
  },
  openFactoryViewDeck() {
    const draft = RPG.state.factoryDraft;
    if (!draft || !draft.active) return RPG.toMenu();
    const body = this.$('factory-draft-body');
    if (body) draft.scrollTop = body.scrollTop;
    const pool = draft.pool || [];
    this.collectionContext = 'factory';
    document.body.dataset.collectionContext = 'factory';
    this.$('collection-title').textContent = '현재 구성 중인 덱';
    this.$('collection-back').textContent = '드래프트로';
    this.$('collection-back').onclick = () => {
      delete document.body.dataset.collectionContext;
      this.collectionContext = 'library';
      RPG.showScreen('screen-factory-draft');
      RPG.renderFactoryDraftScreen();
    };
    RPG.showScreen('screen-collection');
    this.renderCards('collection-grid', pool, id => RPG.showCardInfo(id));
    this.$('collection-count').textContent = `${pool.length}장`;
    this.$('collection-empty').hidden = pool.length !== 0;
  },
  showCard(id, list) {
    this.viewer = { ids: Array.isArray(list) ? list : [], index: Array.isArray(list) ? list.indexOf(id) : -1 };
    RPG.showCardInfo(id);
  },
  stepViewer(delta) {
    const { ids, index } = this.viewer;
    if (index < 0 || ids.length < 2) return;
    const next = (index + delta + ids.length) % ids.length;
    this.viewer.index = next;
    this.sfx('tap');
    RPG.showCardInfo(ids[next]);
  },
  deckUse(id) {
    const owned = RPG.state.inventory.filter(item => item === id).length;
    const used = RPG.state.deck.filter(item => item === id).length;
    return {owned, used, spare:owned - used};
  },
  renderDeckCards(assign) {
    if (assign) this.deckAssign = assign;
    const box = this.$('deck-card-list');
    const counts = new Map();
    for (const id of RPG.state.inventory) counts.set(id,(counts.get(id)||0)+1);
    const ids = RPG.sortCardIdsByGrade([...counts.keys()]).filter(id => RPG.getCardData(id));
    const present = this.GRADE_ORDER.filter(grade => ids.some(id => RPG.getCardData(id).grade === grade));
    if (this.deckFilter !== 'all' && !present.includes(this.deckFilter)) this.deckFilter = 'all';
    const chips = this.$('dw-deck-filter');
    if (present.length > 1) this.gradeChips(chips, ['all', ...present], this.deckFilter, grade => { this.deckFilter = grade; this.renderDeckCards(); });
    else chips.replaceChildren();
    const scroll = box.scrollTop;
    box.replaceChildren();
    const shown = ids.filter(id => this.deckFilter === 'all' || RPG.getCardData(id).grade === this.deckFilter);
    for (const id of shown) box.append(this.cardTile(RPG.getCardData(id), { count:counts.get(id), info:true, list:shown, onClick:() => this.pickDeckCard(id) }));
    box.scrollTop = scroll;
    this.$('dw-deck-empty').hidden = ids.length !== 0;
    this.refreshDeckStates();
  },
  // Placement changes update badges in place; portraits are never rebuilt.
  refreshDeckStates() {
    const slots = ['선봉','중견','대장'];
    for (const tile of this.$('deck-card-list').querySelectorAll('.dw-card')) {
      const id = tile.dataset.cardId;
      const deployed = RPG.state.deck.map((item, index) => item === id ? slots[index] : null).filter(Boolean).join('·');
      const selected = RPG.selectedSlot >= 0 && RPG.state.deck[RPG.selectedSlot] === id;
      tile.classList.toggle('is-deployed', !!deployed);
      tile.classList.toggle('is-selected', selected);
      const frame = tile.querySelector('.dw-frame');
      let badge = frame.querySelector('.dw-card-badge');
      if (deployed && !badge) {
        badge = this.text('span', '', 'dw-card-badge');
        frame.append(badge);
      }
      if (badge) {
        if (deployed) badge.textContent = deployed;
        else badge.remove();
      }
      const card = RPG.getCardData(id);
      tile.setAttribute('aria-label', [card.name, this.gradeNames[card.grade] || card.grade, `${this.deckUse(id).owned}장 보유`, deployed ? `${deployed} 출전 중` : ''].filter(Boolean).join(', '));
    }
  },
  pickDeckCard(id) {
    const deck = RPG.state.deck;
    if (RPG.selectedSlot < 0) {
      const empty = deck.indexOf(null);
      if (empty < 0) return this.toast('교체할 자리를 먼저 선택하세요.');
      RPG.selectDeckSlot(empty);
    }
    const slot = RPG.selectedSlot;
    this.sfx('tap');
    if (deck[slot] === id) {
      // Tapping the card already in the selected slot takes it out.
      deck[slot] = null;
    } else if (this.deckUse(id).spare <= 0) {
      // Every copy is placed: move it here and swap the displaced card back.
      const from = deck.findIndex((item, index) => item === id && index !== slot);
      if (from < 0) return;
      deck[from] = deck[slot];
      deck[slot] = id;
    } else {
      this.deckAssign?.(id);
      const next = [slot + 1, slot + 2, slot + 3].map(index => index % 3).find(index => deck[index] === null);
      if (next !== undefined && deck[slot] === id) RPG.selectDeckSlot(next);
    }
    RPG.updateDeckSlots();
    this.updateSlotSelection(RPG.selectedSlot);
  },
  autoFormation() {
    const deck = RPG.state.deck;
    if (!deck.includes(null)) return this.toast('세 자리가 모두 채워져 있어요.');
    const spare = new Map();
    for (const id of RPG.state.inventory) spare.set(id,(spare.get(id)||0)+1);
    for (const id of deck) if (id) spare.set(id,(spare.get(id)||0)-1);
    const ranked = RPG.sortCardIdsByGrade([...spare.keys()]);
    let placed = 0;
    deck.forEach((id, index) => {
      if (id) return;
      const pick = ranked.find(item => spare.get(item) > 0);
      if (!pick) return;
      deck[index] = pick;
      spare.set(pick, spare.get(pick) - 1);
      placed++;
    });
    if (!placed) return this.toast('배치할 수 있는 카드가 없습니다.');
    const empty = deck.indexOf(null);
    RPG.updateDeckSlots();
    RPG.selectDeckSlot(empty >= 0 ? empty : Math.max(0, RPG.selectedSlot));
    this.sfx('open');
    this.toast(`${placed}명을 등급 순으로 배치했어요.`);
  },
  renderDeckSlots() {
    ['선봉','중견','대장'].forEach((role, index) => {
      const slot = this.$(`slot-${index}`);
      const card = RPG.state.deck[index] ? RPG.getCardData(RPG.state.deck[index]) : null;
      if (slot.dataset.cardKey !== String(card?.id || '') || !slot.querySelector('.dw-art')) {
        slot.dataset.cardKey = card?.id || '';
        slot.replaceChildren(this.text('small', role, 'dw-slot-role'));
        if (card) {
          slot.dataset.grade = card.grade;
          slot.append(this.framed(card));
        } else {
          delete slot.dataset.grade;
          const empty = this.text('span','', 'dw-art dw-art--empty');
          empty.append(this.icon('plus'));
          slot.append(empty);
        }
        slot.append(this.text('strong', card?.name || '빈 자리'));
      }
      slot.removeAttribute('style');
      slot.setAttribute('aria-pressed',String(RPG.selectedSlot === index));
      slot.setAttribute('aria-label', `${role} ${card?.name || '빈 자리'}`);
    });
  },
  updateSlotSelection(index) {
    document.querySelectorAll('.dw-slot').forEach((slot, i) => slot.setAttribute('aria-pressed',String(i === index)));
    const role = ['선봉','중견','대장'][index];
    const current = RPG.state.deck[index];
    this.$('deck-hint').textContent = !role ? '자리를 선택하세요' : current ? `${role} 교체 · 같은 카드를 누르면 해제` : `${role}에 배치할 카드를 고르세요`;
    this.refreshDeckStates();
  },
  decorateCardInfo(id) {
    const card = RPG.getCardData(id);
    if (!card) return;
    const modal = this.$('modal-card');
    modal.dataset.grade = card.grade;
    const frame = modal.querySelector('.dw-card-hero > .dw-frame');
    frame.dataset.grade = card.grade;
    const badge = frame.querySelector('.dw-el');
    badge.dataset.el = card.element;
    badge.replaceChildren(this.icon(`el-${['fire','water','nature','wind','light','dark','earth'].includes(card.element) ? card.element : 'normal'}`));
    const meta = this.$('md-grade');
    meta.className = 'dw-card-chips';
    meta.dataset.grade = card.grade;
    meta.replaceChildren(
      this.text('span', this.GRADE_LABELS[card.grade] || this.gradeNames[card.grade] || card.grade, 'dw-grade-tag'),
      this.text('span', this.roleNames[card.role] || card.role, 'dw-chip-static'),
      this.text('span', this.elementNames[card.element] || card.element, 'dw-chip-static'));
    const stats = this.$('md-stats');
    stats.className = 'dw-stats';
    stats.dataset.grade = card.grade;
    stats.replaceChildren();
    // Bars compare against the strongest value of that stat across all cards.
    if (!this.statMax) {
      this.statMax = {};
      for (const item of GameUtils.getAllCards()) for (const key of ['hp','atk','matk','def','mdef']) this.statMax[key] = Math.max(this.statMax[key] || 1, item.stats?.[key] || 0);
    }
    for (const [key, label] of [['hp','HP'],['atk','물리 공격'],['matk','마법 공격'],['def','물리 방어'],['mdef','마법 방어']]) {
      const row = this.text('div','', 'dw-stat');
      const bar = this.text('i','');
      const fill = this.text('i','');
      fill.style.width = `${Math.round(Math.min(1, (card.stats[key] || 0) / this.statMax[key]) * 100)}%`;
      bar.append(fill);
      row.append(this.text('span', label), bar, this.text('b', Number(card.stats[key] || 0).toLocaleString('ko-KR')));
      stats.append(row);
    }
    const owned = RPG.state?.inventory ? RPG.state.inventory.filter(item => item === id).length : 0;
    if (owned) stats.append(this.text('p', `${owned}장 보유`, 'dw-owned'));
    const { ids, index } = this.viewer;
    const inList = ids[index] === id && ids.length > 1;
    modal.querySelectorAll('.dw-viewer-nav,.dw-viewer-count').forEach(el => { el.hidden = !inList; });
    if (inList) modal.querySelector('.dw-viewer-count').textContent = `${index + 1} / ${ids.length}`;
    else this.viewer = { ids: [], index: -1 };
  },
  setupCardModal() {
    const content = this.$('modal-card').querySelector('.modal-content');
    content.classList.add('dw-card-sheet');
    const scroll = content.querySelector('.modal-scroll');
    const art = this.$('md-img').parentElement;
    art.className = 'dw-art';
    art.removeAttribute('style');
    const frame = this.text('span','', 'dw-frame dw-card-art');
    const badge = this.text('span','', 'dw-el');
    frame.append(art, badge);
    const prev = this.button('', 'dw-viewer-nav', () => this.stepViewer(-1));
    prev.dataset.dir = 'prev';
    prev.setAttribute('aria-label','이전 카드');
    prev.append(this.icon('left'));
    const next = this.button('', 'dw-viewer-nav', () => this.stepViewer(1));
    next.dataset.dir = 'next';
    next.setAttribute('aria-label','다음 카드');
    next.append(this.icon('right'));
    const count = this.text('span', '', 'dw-viewer-count');
    const hero = this.text('div','', 'dw-card-hero');
    const side = this.text('div','', 'dw-card-side');
    side.append(this.$('md-grade'), this.$('md-name'), this.$('md-stats'));
    hero.append(frame, side, prev, next, count);
    scroll.prepend(hero);
    this.$('md-name').removeAttribute('style');
    // Swipe between cards in the current list.
    let startX = null;
    hero.addEventListener('touchstart', event => { startX = event.touches[0].clientX; }, {passive:true});
    hero.addEventListener('touchend', event => {
      if (startX === null) return;
      const dx = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) this.stepViewer(dx < 0 ? 1 : -1);
    });
    const closeModal = RPG.closeModal.bind(RPG);
    RPG.closeModal = () => { this.viewer = { ids: [], index: -1 }; return closeModal(); };
  },

  // ---------- Study ----------
  renderStudy() {
    const state = RPG.state || {};
    const collocation = ['chaos', 'artifact_chaos', 'draft'].includes(state.mode);
    const wrong = collocation ? (state.wrongCollocations || []).length : (state.wrongWords || []).length;
    this.$('dw-study-words').textContent = wrong ? `${collocation ? '연어' : '단어'} 오답 ${wrong}개 복습` : collocation ? '숙어 · 구동사' : '단어 · 오답 복습';
    this.$('dw-study-grammar').textContent = `문법 강의 ${GRAMMAR_DATA.length}강`;
    const fortune = typeof FortuneCookie !== 'undefined' && FortuneCookie.canUse();
    this.$('dw-study-fortune').textContent = fortune ? '오늘의 쿠키가 준비됐어요' : '오늘 결과 다시 보기';
    this.$('dw-study-fortune').closest('button').classList.toggle('has-dot', fortune);
    const quiz = state.quiz_stats;
    this.$('dw-study-toeic').textContent = quiz?.total ? `이번 여정 퀴즈 ${quiz.correct} / ${quiz.total} 정답` : 'Part 5 · 6 · 7 실전 문제';
  },

  // ---------- Battle ----------
  renderBattleStatuses() {
    const render = (id, actor) => {
      const buffs = actor?.buffs;
      const box = this.$(id);
      box.replaceChildren();
      for (const [key,value] of Object.entries(buffs || {})) {
        if (!value) continue;
        const negative = StatusRules.isNegative(key);
        const label = StatusRules.formatDisplay(key, value, RPG.state.artifacts || [], actor);
        const badge = this.text('span',label,`status-badge ${negative ? 'status-negative' : 'status-positive'}`);
        badge.title = `${negative ? '디버프' : '버프'}: ${BUFF_NAMES[key] || key}`;
        box.append(badge);
      }
    };
    render('p-buffs',RPG.battle.players[RPG.battle.currentPlayerIdx]);
    render('e-buffs',RPG.battle.enemy);
  },
  renderBattleHud() {
    const battle = RPG.battle;
    if (!battle || !battle.enemy) return;
    const player = battle.players[battle.currentPlayerIdx];
    const format = value => Math.max(0, Math.round(value)).toLocaleString('ko-KR');
    if (player) {
      this.$('dw-p-hp').textContent = `${format(player.hp)} / ${format(player.maxHp)}`;
      this.$('dw-p-mp').textContent = `MP ${format(player.mp)} / ${format(player.maxMp || GAME_CONSTANTS.MAX_MP)}`;
      const frame = this.$('dw-p-frame');
      const grade = player.proto?.grade || RPG.getCardData(player.id)?.grade;
      if (grade) frame.dataset.grade = grade;
    }
    this.$('dw-e-hp').textContent = `${format(battle.enemy.hp)} / ${format(battle.enemy.maxHp)}`;
    this.$('dw-enemy-tag').textContent = `STAGE ${RPG.state.enemyScale + 1}`;
    const pill = this.$('dw-turn-pill');
    pill.dataset.side = /enemy/.test(battle.phase || '') ? 'enemy' : 'player';
    const bench = this.$('dw-bench');
    bench.replaceChildren();
    battle.players.forEach((member, index) => {
      if (!member) return;
      const pip = this.text('i','', `dw-pip${index === battle.currentPlayerIdx ? ' is-current' : ''}${member.isDead ? ' is-down' : ''}`);
      pip.title = `${['선봉','중견','대장'][member.pos ?? index] || ''} ${member.name}${member.isDead ? ' (전투 불능)' : ''}`;
      bench.append(pip);
    });
    bench.setAttribute('aria-label', `파티 ${battle.players.filter(member => member && !member.isDead).length}명 생존`);
    const field = this.$('field-buff-box');
    field.replaceChildren(...battle.fieldBuffs.map(buff => this.text('span', BUFF_NAMES[buff.name] || buff.name, 'dw-field-chip')));
    this.reactToHp('p', player, battle);
    this.reactToHp('e', battle.enemy, battle);
  },
  // HP changes drive the feedback: numbers, a sprite matching the attacker's skill type, and recoil.
  reactToHp(side, actor, battle) {
    if (!actor) return;
    const memory = this.hpMemory.get(side);
    const identity = `${actor.id}:${side === 'p' ? battle.currentPlayerIdx : 'enemy'}`;
    this.hpMemory.set(side, {battle, identity, hp:actor.hp});
    if (!memory || memory.battle !== battle || memory.identity !== identity) return;
    const delta = Math.round(actor.hp - memory.hp);
    if (!delta) return;
    // Only the player's attacks can be critical; the flag belongs to the hit that logged it.
    const crit = side === 'e' && delta < 0 && Date.now() - this.battleCue.crit < 1500;
    const layer = this.$(`dw-${side}-float`);
    const mark = this.text('span', delta > 0 ? `+${delta.toLocaleString('ko-KR')}` : delta.toLocaleString('ko-KR'), delta > 0 ? 'is-heal' : crit ? 'is-crit' : 'is-hit');
    layer.append(mark);
    setTimeout(() => mark.remove(), 1100);
    let fx = 'heal';
    if (delta < 0) {
      const fromPlayer = side === 'e';
      fx = crit ? 'crit' : fromPlayer && this.battleCue.type === 'mag' ? 'magic' : fromPlayer ? 'slash' : 'hit';
      const box = layer.closest('.battle-actor');
      box.classList.remove('dw-hit');
      void box.offsetWidth;
      box.classList.add('dw-hit');
      this.sfx(crit ? 'crit' : fx === 'magic' ? 'magic' : 'hit');
      if (crit) this.battleCue.crit = 0;
    } else this.sfx('heal');
    this.spawnFx(side, fx);
  },
  spawnFx(side, name) {
    if (!this.motion) return;
    const layer = this.$(`dw-${side}-fx`);
    const sprite = this.text('i', '');
    sprite.dataset.fx = name;
    layer.append(sprite);
    setTimeout(() => sprite.remove(), 900);
  },
  lunge(side) {
    if (!this.motion) return;
    const box = this.$(side === 'p' ? 'player-actor-box' : 'enemy-actor-box');
    box.classList.remove('dw-lunge');
    void box.offsetWidth;
    box.classList.add('dw-lunge');
  },
  onPlayerSkill(source, target, skill) {
    const battle = RPG.battle;
    if (!battle || !battle.players.includes(source)) return;
    this.battleCue.type = skill?.type || 'phy';
    if (skill?.type === 'sup') { this.spawnFx('p', skill.effects?.some(effect => /barrier|guard/.test(effect.type || '')) ? 'guard' : 'heal'); }
    else this.lunge('p');
    if (this.motion && skill && skill !== RPG.NORMAL_ATTACK && (skill.cost || 0) >= 30) this.cutIn(source, skill);
  },
  cutIn(source, skill) {
    const band = this.$('dw-cutin');
    const img = this.$('p-img');
    band.replaceChildren();
    const art = this.text('span','', 'dw-cutin-art');
    if (img?.src) art.style.setProperty('--cut-art', `url("${img.src}")`);
    const copy = this.text('span','', 'dw-cutin-text');
    copy.append(this.text('small', source.name), this.text('strong', skill.name));
    band.dataset.grade = source.proto?.grade || '';
    band.append(art, copy);
    band.classList.remove('is-on');
    void band.offsetWidth;
    band.classList.add('is-on');
    clearTimeout(this.cutTimer);
    this.cutTimer = setTimeout(() => band.classList.remove('is-on'), 1000);
  },
  onBattleLog(message) {
    if (typeof message !== 'string' || !RPG.battle) return;
    const battle = RPG.battle;
    if (/Critical/.test(message) && battle.phase === 'player-resolving') this.battleCue.crit = Date.now();
    if (battle.phase === 'enemy-resolving' && battle.turn !== this.battleCue.enemyTurn && /피해|회피|방어|!/.test(message) && message.includes(battle.enemy?.name || '\u0000')) {
      this.battleCue.enemyTurn = battle.turn;
      this.lunge('e');
    }
    if (/배리어로 방어|매직가드로 방어/.test(message)) this.spawnFx('p', 'guard');
    if (/회피 성공/.test(message)) {
      const side = battle.phase === 'enemy-resolving' ? 'p' : 'e';
      const mark = this.text('span', 'MISS', 'is-heal');
      this.$(`dw-${side}-float`).append(mark);
      setTimeout(() => mark.remove(), 1100);
    }
  },
  markShortSkills(player) {
    // Disabled-for-the-enemy-turn differs from not having enough MP.
    for (const button of this.$('battle-controls').querySelectorAll('.skill-btn')) {
      const cost = Number((button.querySelector('.skill-cost')?.textContent || '').replace(/\D/g, '')) || 0;
      button.classList.toggle('is-short', !!player && player.mp < cost);
      if (!button.querySelector(':scope > svg')) button.prepend(this.icon(`sk-${['phy','mag','sup'].includes(button.dataset.skillType) ? button.dataset.skillType : 'phy'}`));
    }
    if (RPG.battle) this.$('dw-turn-pill').dataset.side = 'player';
  },

  // ---------- Results ----------
  snapshotBattle(win) {
    const battle = RPG.battle;
    if (!battle || battle.isFinished) return;
    this.battleSnapshot = {
      win,
      time:Date.now(),
      stage:RPG.state.enemyScale + 1,
      enemy:battle.enemy,
      tickets:RPG.state.tickets,
      mode:RPG.state.mode,
      fallen:battle.players.filter(member => member && (member.isDead || RPG.state.mode === 'puzzle')).map(member => member.id),
      unlocked:[...(RPG.global?.unlocked_bonus_cards || [])]
    };
  },
  bonusOffer() {
    const state = RPG.state;
    const enemy = RPG.battle?.enemy;
    if (state.mode === 'archive') return null;
    if (state.mode === 'puzzle') return '추가 퀴즈 · 다음 전투 혼돈의 축복 5회';
    if (['chaos','artifact_chaos','draft'].includes(state.mode)) return '콜로케이션 퀴즈 · 소환 티켓 +1';
    if (enemy?.id === 'creator_god' && state.mode === 'artifact' && (state.artifacts || []).length < GAME_CONSTANTS.MAX_ARTIFACTS) return '창조신 보너스 문법 퀴즈 · 아티팩트 획득 기회';
    if (enemy?.id === 'creator_god') return '창조신 보너스 문법 퀴즈 · 소환 티켓 +3';
    return '보너스 단어 퀴즈 · 소환 티켓 +1';
  },
  resetInfoModal() {
    const modal = this.$('modal-info');
    modal.classList.remove('dw-result','is-win','is-lose','has-actions');
    modal.querySelector('.dw-result-actions')?.remove();
  },
  miniCard(card, index) {
    const item = this.text('div','', 'dw-mini');
    item.style.setProperty('--i', index);
    item.append(this.framed(card), this.text('strong', card.name));
    return item;
  },
  countUp(el, to) {
    if (!this.motion) { el.textContent = `+${to}`; return; }
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / 600);
      el.textContent = `+${Math.round(to * (1 - Math.pow(1 - t, 3)))}`;
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = '+0';
    setTimeout(() => requestAnimationFrame(step), 350);
  },
  decorateInfo(title) {
    this.resetInfoModal();
    const snap = this.battleSnapshot;
    const kinds = {'전투 결과':'battle','게임 클리어':'clear','Game Over':'over'};
    // The snapshot lives until this result is shown or the next battle starts (archive quizzes may take a while).
    if (!kinds[title] || !snap) return;
    this.battleSnapshot = null;
    const modal = this.$('modal-info');
    const content = this.$('info-content');
    const win = snap.win;
    modal.classList.add('dw-result', win ? 'is-win' : 'is-lose');
    // Remove sentences the panel now shows as structured rewards and losses.
    content.innerHTML = content.innerHTML
      .replace('승리!<br>보상을 획득했습니다.', '')
      .replace(/전사자 발생: [^<]*<br>\(카드가 소멸했습니다\)/, '')
      .replace(/사용 카드 소멸: [^<]*<br>\(전투에 사용한 카드가 모두 소멸했습니다\)/, '')
      .replace(/^패배\.\.\.(<br>)*/, '')
      .replace(/^(<br>)+|(<br>)+$/g, '');
    const notes = content.innerHTML.trim();
    const banner = this.text('div','', 'dw-result-banner');
    banner.dataset.kind = kinds[title] === 'clear' ? 'clear' : win ? 'battle' : 'lose';
    banner.setAttribute('role','img');
    banner.setAttribute('aria-label', kinds[title] === 'clear' ? 'STAGE CLEAR' : win ? 'VICTORY' : 'DEFEAT');
    const sub = this.text('p', kinds[title] === 'clear' ? `${this.modeNames[snap.mode] || snap.mode} 모드 클리어` : `STAGE ${snap.stage} · ${snap.enemy?.name || ''}${win ? ' 격파' : ''}`, 'dw-result-sub');
    const panel = this.text('div','', 'dw-result-body');
    if (win) {
      const gained = RPG.state.tickets - snap.tickets;
      if (gained > 0) {
        const reward = this.text('div','', 'dw-reward');
        const value = this.text('b', `+${gained}`);
        reward.append(this.icon('ticket'), this.text('span', '소환 티켓'), value);
        panel.append(reward);
        this.countUp(value, gained);
      }
    }
    const unlocked = (RPG.global?.unlocked_bonus_cards || []).filter(id => !snap.unlocked.includes(id)).map(id => RPG.getCardData(id)).filter(Boolean);
    if (unlocked.length) {
      const row = this.text('div','', 'dw-result-cards is-new');
      row.append(this.text('h4','새 동료 해금'));
      unlocked.forEach((card, index) => row.append(this.miniCard(card, index)));
      panel.append(row);
    }
    const fallen = snap.fallen.map(id => RPG.getCardData(id)).filter(Boolean);
    if (fallen.length) {
      const row = this.text('div','', 'dw-result-cards is-lost');
      row.append(this.text('h4', snap.mode === 'puzzle' ? '사용 후 소멸' : '전투 불능 · 카드 소멸'));
      fallen.forEach((card, index) => row.append(this.miniCard(card, index)));
      panel.append(row);
    }
    content.replaceChildren(banner, sub, panel);
    if (notes) {
      const note = this.text('div','', 'dw-result-notes');
      note.innerHTML = notes;
      content.append(note);
    }
    this.sfx(win ? 'victory' : 'defeat');
    if (title !== '전투 결과') return;
    const offer = win ? this.bonusOffer() : null;
    const actions = this.text('div','', 'dw-result-actions');
    modal.classList.add('has-actions');
    if (offer) {
      const card = this.text('div','', 'dw-offer');
      card.append(this.icon('spark'), this.text('span', offer));
      content.append(card);
      actions.append(this.button('건너뛰기','dw-btn',() => this.resultAction('no')), this.button('퀴즈 도전','dw-btn dw-btn--primary',() => this.resultAction('yes')));
    } else {
      actions.append(this.button(win ? '계속' : '로비로','dw-btn dw-btn--primary dw-btn--block',() => this.resultAction(null)));
    }
    modal.querySelector('.modal-content').append(actions);
  },
  resultAction(choice) {
    this.pendingBonus = choice;
    try { RPG.closeInfoModal(); } finally { this.pendingBonus = null; }
  },

  // ---------- Missions, menu and dialogs ----------
  decorateMissionReward() {
    const rewardId = RPG.missionViewType === 'special' ? RPG.global.specialMission?.rewardCardId : RPG.global.monthlyMission?.rewardCardId;
    const card = RPG.getCardData(rewardId);
    const section = this.$(RPG.missionViewType === 'special' ? 'special-mission-section' : 'monthly-mission-section');
    const panel = section.children[1];
    panel.classList.add('mission-reward-showcase');
    panel.querySelector('.reward-card-preview')?.remove();
    panel.querySelector('.reward-progress')?.remove();
    if (!card) { panel.classList.remove('mission-reward-showcase'); delete panel.dataset.grade; return; }
    panel.dataset.grade = card.grade;
    const preview = this.text('button','','reward-card-preview');
    preview.setAttribute('aria-label',`${card.name} 보상 카드 자세히 보기`);
    preview.append(ImageAssets.createPortrait(card));
    preview.onclick = () => RPG.showCardInfo(card.id);
    panel.prepend(preview);
    const mission = RPG.missionViewType === 'special' ? RPG.global.specialMission : RPG.global.monthlyMission;
    const objectives = Object.values(mission.missions || {});
    const complete = objectives.filter(item => (item.progress || 0) >= item.target).length;
    const progress = this.text('div',mission.claimed ? '수령 완료' : `${complete} / ${objectives.length} 미션 완료`,'reward-progress');
    const meter = document.createElement('progress');
    meter.max = Math.max(1,objectives.length);
    meter.value = complete;
    meter.setAttribute('aria-label','보상 획득까지 완료한 미션');
    progress.append(meter);
    panel.append(progress);
  },
  decorateMissionHub() {
    const global = RPG.global;
    const entries = [global.monthlyMission, global.weeklyMission];
    if (RPG.isSpecialMissionVisible()) entries.push(global.specialMission);
    const rewards = [
      () => RPG.getCardData(global.monthlyMission?.rewardCardId)?.name || '보너스 카드',
      () => `카오스 티켓 ${RPG.getWeeklyChaosTicketRewardAmount()}장`,
      () => RPG.getCardData(global.specialMission?.rewardCardId)?.name || '시즌 카드'
    ];
    [...this.$('mission-hub-list').children].forEach((button, index) => {
      const mission = entries[index];
      if (!mission) return;
      const title = button.firstChild?.textContent || '';
      const items = Object.values(mission.missions || {});
      const complete = items.filter(item => (item.progress || 0) >= item.target).length;
      const ready = !mission.claimed && items.length && complete === items.length;
      button.removeAttribute('style');
      button.classList.add('dw-mission-row');
      button.classList.toggle('is-ready', !!ready);
      button.replaceChildren();
      const copy = this.text('span','', 'dw-mission-copy');
      copy.append(this.text('strong', title), this.text('small', `보상 · ${rewards[index]()}`));
      const meter = this.text('span','', 'dw-meter');
      const fill = document.createElement('i');
      fill.style.width = `${items.length ? (complete / items.length) * 100 : 0}%`;
      meter.append(fill);
      copy.append(meter);
      button.append(copy, this.text('span', mission.claimed ? '수령 완료' : ready ? '보상 받기' : `${complete} / ${items.length}`, 'dw-mission-state'));
    });
  },
  setupSheetHead(modalId, title, onClose) {
    const content = this.$(modalId).querySelector('.modal-content');
    content.classList.add('dw-sheet');
    content.removeAttribute('style');
    const heading = content.querySelector('h3');
    heading.textContent = title;
    const head = this.text('div','', 'dw-sheet-head');
    const close = this.button('', 'dw-icon', onClose);
    close.setAttribute('aria-label','닫기');
    close.append(this.icon('close'));
    heading.replaceWith(head);
    head.append(heading, close);
    return content;
  },
  setupSystemMenu() {
    const content = this.setupSheetHead('modal-menu', '메뉴', () => this.$('modal-menu').classList.remove('active'));
    content.classList.add('dw-menu-sheet');
    const list = this.text('div','', 'dw-menu-list');
    const icons = {'저장하기':'save','기록 확인':'trophy','카드풀 확인':'cards','타이틀로':'door','음악재생':'music'};
    const buttons = [...content.querySelectorAll('button.menu-btn')];
    for (const button of buttons) {
      const label = button.textContent.trim();
      button.className = 'dw-menu-item';
      button.removeAttribute('style');
      if (label === '음악재생') { button.hidden = true; continue; }
      if (icons[label]) button.replaceChildren(this.icon(icons[label]), this.text('span', label));
      if (label === '타이틀로') button.classList.add('is-danger');
      list.append(button);
    }
    const mission = this.button('', 'dw-menu-item', () => { this.$('modal-menu').classList.remove('active'); RPG.openMissionHub(); });
    mission.append(this.icon('mission'), this.text('span','미션'));
    list.prepend(mission);
    const settings = this.button('', 'dw-menu-item', () => this.settings());
    settings.append(this.icon('settings'), this.text('span','설정 · 테마 · 연출'));
    list.insertBefore(settings, list.querySelector('.is-danger'));
    content.querySelector('.dw-sheet-head').after(list);
    content.querySelector(':scope > button:not(.dw-menu-item):not(.dw-icon)')?.remove();
  },
  syncSystemMenu() {
    const button = this.$('btn-toggle-tutoring');
    const on = RPG.global?.tutoringEventEnabled !== false;
    button.removeAttribute('style');
    button.className = 'dw-menu-item dw-toggle';
    button.setAttribute('role','switch');
    button.setAttribute('aria-checked', String(on));
    button.replaceChildren(this.icon('pen'), this.text('span','개인과외 이벤트'), this.text('i','', 'dw-switch'));
  },
  setupTypeSelect() {
    const modal = this.$('modal-type-select');
    const content = modal.querySelector('.modal-content');
    content.classList.add('dw-sheet','dw-journey');
    content.querySelector('h3').textContent = '새 여정';
    content.querySelector('p').textContent = '어떤 방식으로 떠날까요?';
    const [endless, challenge] = content.querySelectorAll('[onclick^="RPG.selectGameType"]');
    const choice = (button, icon, title, desc) => {
      button.removeAttribute('style');
      button.classList.add('dw-journey-choice');
      button.replaceChildren(this.icon(icon), this.text('strong', title), this.text('small', desc));
    };
    choice(endless, 'star', '엔드리스', '끝없는 스테이지 · 최고 기록 도전');
    choice(challenge, 'trophy', '도전', '목표 스테이지 클리어 · 새 동료 해금');
    const grid = this.text('div','', 'dw-journey-grid');
    endless.before(grid);
    grid.append(endless, challenge);
    const label = this.text('h4','다음 여정의 카드풀', 'dw-section-label');
    grid.after(label);
    const list = this.text('div','', 'dw-menu-list');
    label.after(list);
    for (const id of ['btn-bonus-pool-editor','btn-card-set-editor','btn-special-card-editor']) {
      const button = this.$(id);
      const display = button.style.display;
      button.removeAttribute('style');
      if (display) button.style.display = display;
      button.classList.add('dw-menu-item');
      const sub = button.querySelector('span');
      const title = button.firstChild.textContent.trim();
      button.replaceChildren(this.icon(id === 'btn-card-set-editor' ? 'grid' : 'cards'), this.text('strong', title), sub || this.text('span',''));
      sub?.removeAttribute('style');
      list.append(button);
    }
    const back = content.querySelector('[onclick="RPG.backFromTypeSelect()"]');
    back.removeAttribute('style');
    back.className = 'dw-btn dw-btn--block';
  },
  setupModeSelect() {
    const content = this.$('modal-mode-select').querySelector('.modal-content');
    content.classList.add('dw-sheet','dw-mode-sheet');
    content.removeAttribute('style');
    const enter = this.$('btn-enter-mode');
    enter.removeAttribute('style');
    enter.className = 'dw-btn dw-btn--hero dw-btn--block';
    enter.textContent = '이 모드로 출발';
    const cancel = content.querySelector('[onclick*="modal-mode-select"]');
    cancel.removeAttribute('style');
    cancel.className = 'dw-btn dw-btn--block';
    cancel.textContent = '뒤로';
    const footer = this.text('div','', 'dw-mode-footer');
    this.$('mode-desc').removeAttribute('style');
    footer.append(this.$('mode-desc'), enter, cancel);
    content.append(footer);
    this.$('mode-list').removeAttribute('style');
    for (const id of ['btn-chaos-roulette','btn-hard-mode']) this.$(id).classList.add('dw-chip');
  },
  decorateModes() {
    const definitions = new Map((RPG.modeDefinitions || []).map(mode => [mode.id, mode]));
    const records = typeof ModeRecords !== 'undefined' ? ModeRecords.read() : {ok:false};
    const heading = this.$('modal-mode-select').querySelector('h3');
    heading.textContent = RPG.tempGameType === 'endless' ? '엔드리스 · 모드 선택' : RPG.tempGameType === 'challenge' ? '도전 · 모드 선택' : '모드 선택';
    this.$('modal-mode-select').dataset.selected = '';
    for (const id of ['btn-chaos-roulette','btn-hard-mode']) {
      const toggle = this.$(id);
      const display = toggle.style.display;
      toggle.removeAttribute('style');
      toggle.style.display = display;
    }
    for (const button of this.$('mode-list').querySelectorAll('button')) {
      const id = button.id.replace('mode-btn-','');
      const mode = definitions.get(id);
      if (!mode) continue;
      const cleared = button.style.color && button.style.color !== '';
      button.style.removeProperty('color');
      button.style.removeProperty('padding');
      button.style.removeProperty('font-size');
      button.classList.add('dw-mode');
      const summary = mode.desc.split('\n(')[0].replace(/\n/g,' ');
      const goal = (mode.desc.match(/\(성공조건:\s*([^)]*)\)/) || [])[1] || '';
      const chips = this.text('span','', 'dw-mode-tags');
      const stage = goal.match(/(\d+)\s*스테이지/);
      if (stage) chips.append(this.text('i', `목표 ${stage[1]}`, ''));
      else if (goal.includes('무한')) chips.append(this.text('i', '무한', ''));
      else if (id === 'dream_corridor') chips.append(this.text('i', '히든', 'is-special'));
      if (goal.includes('패배 시 런 실패')) chips.append(this.text('i', '패배 시 종료', 'is-warn'));
      if (RPG.tempGameType === 'endless' && records.ok && records.data.modes[id]) chips.append(this.text('i', `최고 ${records.data.modes[id].maxStage}`, 'is-record'));
      if (RPG.global.hardChallengeCleared?.[id] && RPG.tempGameType === 'challenge') chips.append(this.text('i', 'HARD CLEAR', 'is-gold'));
      else if (cleared && RPG.global.unlocked_modes?.includes(id) && RPG.tempGameType === 'challenge') chips.append(this.text('i', '클리어', 'is-gold'));
      button.replaceChildren(this.text('strong', mode.name), this.text('small', summary), chips);
      button.setAttribute('aria-label', `${mode.name}. ${summary}`);
      button.setAttribute('aria-pressed','false');
      button.addEventListener('click',() => {
        for (const item of this.$('mode-list').querySelectorAll('button')) {
          item.style.removeProperty('border-color');
          item.setAttribute('aria-pressed',String(item.id === `mode-btn-${RPG.selectedModeId}`));
        }
        this.$('modal-mode-select').dataset.selected = RPG.selectedModeId || '';
        this.$('mode-desc').scrollTop = 0;
        this.sfx('tap');
      });
    }
  },
  setupBlessing() {
    const content = this.$('modal-chaos').querySelector('.modal-content');
    content.classList.add('dw-sheet','dw-bless-sheet');
    const check = content.querySelector('[onclick="RPG.checkActiveChaosBlessings()"]');
    check.removeAttribute('style');
    check.className = 'dw-btn dw-btn--block';
    this.$('btn-artifact-check').classList.add('dw-btn','dw-btn--block');
    const close = content.querySelector('.chaos-close-btn');
    close.removeAttribute('style');
    close.className = 'chaos-close-btn dw-btn dw-btn--block';
    const options = content.querySelectorAll('[onclick^="RPG.activateChaos"]');
    const icons = ['spark','cap','book'];
    options.forEach((button, index) => {
      const sub = button.querySelector('span');
      const title = button.firstChild.textContent.trim();
      button.removeAttribute('style');
      button.classList.add('dw-bless-option');
      sub?.removeAttribute('style');
      button.replaceChildren(this.icon(icons[index] || 'spark'), this.text('strong', title), sub || this.text('span',''));
    });
  },
  installAlerts() {
    const showAlert = RPG.showAlert;
    RPG.showAlert = function (message) {
      if (Astra.isToastNotice(message)) return Astra.toast(message.trim());
      return showAlert.call(this, message);
    };
    const showConfirm = RPG.showConfirm;
    RPG.showConfirm = function (message, onYes, onNo) {
      // A bonus offer already answered on the result panel resolves without a second dialog.
      if (Astra.pendingBonus) {
        const choice = Astra.pendingBonus;
        Astra.pendingBonus = null;
        return choice === 'yes' ? onYes?.() : onNo?.();
      }
      return showConfirm.call(this, message, onYes, onNo);
    };
  },

  // Backup only the documented game progress keys, never API credentials.
  backupKeys() { return Object.values(Storage.keys).filter(key => key !== Storage.keys.API_KEY); },
  exportSave() {
    const values = {};
    try {
      for (const key of this.backupKeys()) {
        const raw = localStorage.getItem(key);
        if (raw !== null) values[key] = key === Storage.keys.FORTUNE_LAST_USED ? raw : JSON.parse(raw);
      }
      const payload = { format:'astra-progress', version:1, exportedAt:new Date().toISOString(), values };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Dreamweaver-progress-${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.toast('저장된 기록을 내보냈습니다. 진행 중인 여정은 메뉴에서 먼저 저장하세요.');
    } catch { this.toast('기록을 읽지 못했습니다. 현재 저장은 변경하지 않았습니다.'); }
  },
  validateImport(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('올바른 기록 파일이 아닙니다.');
    let values;
    if (payload.format === 'astra-progress') {
      if (payload.version !== 1 || !payload.values || typeof payload.values !== 'object' || Array.isArray(payload.values)) throw new Error('지원하지 않는 기록 버전입니다.');
      values = payload.values;
    } else { values = { [Storage.keys.SAVE]:payload }; }
    const allowed = new Set(this.backupKeys());
    const safe = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
    if (!Object.keys(safe).length) throw new Error('게임 기록이 들어 있지 않습니다.');
    const hasOwn = key => Object.prototype.hasOwnProperty.call(safe, key);
    if (hasOwn(Storage.keys.GLOBAL) && !RPG.validateGlobalData(safe[Storage.keys.GLOBAL])) {
      throw new Error('전역 기록 형식이 잘못되었습니다.');
    }
    if (hasOwn(Storage.keys.SAVE)) {
      const normalized = SaveDataMigrator.normalizeRunState(safe[Storage.keys.SAVE], RPG.state, {
        defaultBlessingUses:GAME_CONSTANTS.DEFAULT_BLESSING_USES,
        defaultDraftRerolls:GAME_CONSTANTS.DRAFT.INITIAL_REROLLS,
        normalizeBonusPoolIds:ids => RPG.normalizeActiveBonusPoolIds(ids),
        normalizeSpecialSelections:items => RPG.normalizeSpecialCardSelections(items),
        defaultSpecialSelections:RPG.global.activeSpecialCardSelections
      });
      if (!normalized) throw new Error('불러올 수 없는 여정 기록입니다.');
    }
    if (hasOwn(Storage.keys.MODE_RECORDS) && !ModeRecords.validate(safe[Storage.keys.MODE_RECORDS])) throw new Error('모드별 최고 기록 형식 또는 버전이 잘못되었습니다.');
    for (const [key,value] of Object.entries(safe)) {
      if ([Storage.keys.VOCAB,Storage.keys.COLLOCATION,Storage.keys.RECORDS].includes(key) && !Array.isArray(value)) throw new Error('학습 또는 전투 기록 형식이 잘못되었습니다.');
      if (key === Storage.keys.FORTUNE_LAST_USED && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error('포춘쿠키 기록 형식이 잘못되었습니다.');
    }
    return safe;
  },
  async importFile(file) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('기록 파일은 5MB 이하여야 합니다.');
      const safe = this.validateImport(JSON.parse(await file.text()));
      const recordNotice = Object.prototype.hasOwnProperty.call(safe, Storage.keys.MODE_RECORDS) ? '' : '<br>파일에 없는 모드별 최고 기록은 현재 기록을 유지합니다.';
      RPG.showConfirm('이 파일의 기록을 가져올까요?<br>같은 항목의 현재 저장 기록이 교체됩니다.' + recordNotice, () => {
        const previous = new Map();
        try {
          for (const key of this.backupKeys()) previous.set(key,localStorage.getItem(key));
          const writes = new Map(Object.entries(safe).map(([key,value]) => [key,key === Storage.keys.FORTUNE_LAST_USED ? value : JSON.stringify(value)]));
          for (const [key,raw] of writes) localStorage.setItem(key,raw);
          for (const [key,raw] of writes) {
            if (localStorage.getItem(key) !== raw) throw new Error(`Failed to verify imported key: ${key}`);
          }
          try { sessionStorage.setItem('astraImportNotice','기록을 가져왔습니다. 메모리를 새 기록으로 다시 불러왔어요. 직접 선택한 초상화 파일은 다시 연결해주세요.'); } catch { /* Reload still protects in-memory state. */ }
          location.reload();
        } catch {
          for (const [key,raw] of previous) {
            try { if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key,raw); } catch { /* Report failure below. */ }
          }
          this.toast('저장 공간에 기록을 쓰지 못했습니다. 기록 가져오기를 중단했습니다.');
        }
      });
    } catch (error) { this.toast(error.message || '기록을 가져오지 못했습니다.'); }
    this.$('astra-import').value = '';
  },

  installDialogs() {
    const focusable = modal => [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[inert]'));
    let top = null;
    let previousActive = new Set();
    const returns = new WeakMap();
    const sync = () => {
      if (this.$('modal-library').classList.contains('active')) {
        this.$('modal-library').classList.remove('active');
        this.learn();
      }
      const active = [...document.querySelectorAll('.modal.active')].sort((a,b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex));
      const next = active.at(-1) || null;
      for (const modal of active) if (!previousActive.has(modal)) returns.set(modal,document.activeElement);
      for (const modal of document.querySelectorAll('.modal')) {
        modal.inert = modal.classList.contains('active') && modal !== next;
        modal.setAttribute('role','dialog');
        modal.setAttribute('aria-modal','true');
        if (!modal.hasAttribute('aria-label') && !modal.hasAttribute('aria-labelledby')) {
          const heading = modal.querySelector('h2,h3');
          if (heading && !heading.id) heading.id = `${modal.id}-heading`;
          if (heading) modal.setAttribute('aria-labelledby',heading.id);
        }
      }
      const revealOpen = this.$('dw-reveal').classList.contains('is-open');
      for (const el of document.querySelectorAll('.dw-top,main,.astra-nav')) el.inert = !!next || revealOpen;
      if (next !== top) {
        if (next) {
          const opener = top && returns.get(top);
          const target = previousActive.has(next) && next.contains(opener) ? opener : focusable(next)[0];
          (target || next.querySelector('.modal-content'))?.focus({preventScroll:true});
        } else if (top) {
          let target = returns.get(top);
          const visited = new Set();
          while (target?.closest('.modal') && !target.getClientRects().length && !visited.has(target)) {
            visited.add(target);
            target = returns.get(target.closest('.modal'));
          }
          if (target?.isConnected && target.getClientRects().length && !target.closest('[inert]')) target.focus({preventScroll:true});
        }
        top = next;
      }
      previousActive = new Set(active);
      // Lobby badges follow the result of any dialog (claims, blessings, quizzes).
      if (!next && this.inRun() && ['menu','summon'].includes(document.body.dataset.screen)) {
        this.renderBlessBadge(); this.renderTicketCount(); this.updateHeader();
        if (document.body.dataset.screen === 'summon') this.renderSummonControls();
        else this.renderParty();
      }
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target.classList?.contains('modal'))) sync();
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',event => {
      const reveal = this.$('dw-reveal');
      if (reveal.classList.contains('is-open')) {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (reveal.classList.contains('is-done')) this.closeReveal();
          else this.flipCard();
        }
        if (event.key === 'Tab') {
          // Focus stays on the overlay; actions join the cycle once the card is revealed.
          const items = [...reveal.querySelectorAll('button')].filter(el => !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
          if (items.length) {
            event.preventDefault();
            const index = items.indexOf(document.activeElement);
            items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
          }
        }
        return;
      }
      if (!top) return;
      const buttons = focusable(top);
      if (event.key === 'Tab' && buttons.length) {
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
      }
      if (event.key === 'Escape') {
        // Respect application callbacks; never bypass a mandatory quiz or choice.
        const close = buttons.find(el => /^(닫기|취소|아니오|뒤로|확인|계속|건너뛰기)$/.test(el.textContent.trim()) || el.getAttribute('aria-label') === '닫기');
        if (close) { event.preventDefault(); close.click(); }
      }
    });
    sync();
  },
  init() {
    if (this.ready) return;
    let theme = 'astra';
    try { theme = localStorage.getItem('dreamweaverTheme') || theme; } catch { /* Use default. */ }
    this.setTheme(theme);
    this.installMotion();
    this.installChatViewport();
    this.hook('syncGameFullscreenButton',this.syncFullscreenShortcut);
    RPG.syncGameFullscreenButton();
    if (!RPG._featuresInstalled) throw new Error('DREAMWEAVER requires installed Card feature modules.');
    this.setupCardModal();
    this.setupSystemMenu();
    this.setupTypeSelect();
    this.setupModeSelect();
    this.setupBlessing();
    this.setupSheetHead('modal-mission-hub', '미션', () => RPG.closeMissionHub()).querySelector(':scope > button[onclick="RPG.closeMissionHub()"]')?.remove();
    this.installAlerts();
    this.hook('setupControls',this.markShortSkills);
    this.hook('showScreen',this.screenChanged);
    this.hook('showCardInfo',this.decorateCardInfo);
    this.hook('toMenu',this.renderParty);
    this.hook('renderMissionView',this.decorateMissionReward);
    this.hook('renderMissionHub',this.decorateMissionHub);
    this.hook('updateSystemMenuUI',this.syncSystemMenu);
    this.hook('renderBattlefield',() => { this.renderBattleStatuses(); this.renderBattleHud(); });
    this.hook('runGacha',this.afterGacha);
    this.hook('spinChaosRoulette',() => this.afterGacha());
    this.hook('log',this.onBattleLog);
    this.hookBefore('executeSkill',this.onPlayerSkill);
    // Slot views are owned here so placing a card never rebuilds unchanged portraits.
    RPG.updateDeckSlots = () => this.renderDeckSlots();
    RPG.selectDeckSlot = index => { RPG.selectedSlot = index; this.updateSlotSelection(index); };
    this.hook('openInfoModal',this.decorateInfo);
    this.hookBefore('winBattle',() => this.snapshotBattle(true));
    this.hookBefore('loseBattle',() => this.snapshotBattle(false));
    this.hookBefore('startBattleInit',() => { this.hpMemory.clear(); this.battleSnapshot = null; this.battleCue = { side:null, type:'phy', crit:0, enemyTurn:-1 }; });
    this.hook('openDeck',() => {
      const empty = RPG.state.deck.indexOf(null);
      RPG.selectDeckSlot(empty >= 0 ? empty : 0);
      this.renderDeckSlots();
    });
    this.hook('openModeSelect',() => {
      this.decorateModes();
      this.$('btn-hard-mode').setAttribute('aria-pressed','false');
    });
    this.hook('toggleHardMode',() => {
      const button = this.$('btn-hard-mode');
      button.removeAttribute('style');
      button.style.display = 'block';
      button.setAttribute('aria-pressed',String(RPG.hardModeActive));
    });
    this.hook('openChaosBlessing',() => {
      const artifact = this.$('btn-artifact-check');
      if (artifact) { const display = artifact.style.display; artifact.removeAttribute('style'); artifact.style.display = display; }
    });
    RPG.renderCardList = (containerId,list,callback) => this.renderCards(containerId,list,callback);
    RPG.openCollection = () => this.openCollection();
    RPG.openFactoryViewDeck = () => this.openFactoryViewDeck();
    RPG.openLibrary = () => this.learn();
    this.hookDoubleConfirmed('reshuffleChaosPool',this.renderParty);
    this.$('card-search').addEventListener('input',() => this.renderCollection());
    this.$('card-grade').addEventListener('change',() => this.renderCollection());
    this.$('collection-scope').addEventListener('click',() => { this.allCards = !this.allCards; this.renderCollection(); });
    this.$('asset-path-form').addEventListener('submit',event => { event.preventDefault(); this.setPortraitPath(this.$('asset-path').value); });
    this.$('portrait-files').addEventListener('change',event => this.selectPortraitFiles(event.target.files));
    this.$('astra-import').addEventListener('change',event => this.importFile(event.target.files[0]));
    const importLabel = document.querySelector('.file-label');
    importLabel.tabIndex = 0;
    importLabel.setAttribute('role','button');
    importLabel.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.$('astra-import').click(); }
    });
    // Navigation taps get a soft click; game dialogs keep their own sounds silent.
    document.querySelector('.astra-nav').addEventListener('click', () => this.sfx('tap'));
    this.installDialogs();
    this.ready = true;
    this.screenChanged('screen-title');
    try {
      const importNotice = sessionStorage.getItem('astraImportNotice');
      if (importNotice) {
        sessionStorage.removeItem('astraImportNotice');
        this.toast(importNotice);
      }
    } catch { /* Session storage may be unavailable for local files. */ }
  }
};
Astra.installImages();
document.addEventListener('DOMContentLoaded',() => Astra.init());
