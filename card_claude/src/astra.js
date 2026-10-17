/* DREAMWEAVER · Claude Edition presentation layer. Game rules and learning content are
   owned by card/game/. Hooks call the original method unless this file owns that view. */
'use strict';

const Astra = {
  ready: false,
  collectionTab: 'run',
  collectionContext: 'library',
  collectionGrade: 'all',
  deckFilter: 'all',
  localPortraits: new Map(),
  portraitPath: '',
  lastScreen: null,
  battleSnapshot: null,
  pendingBonus: null,
  hpMemory: new Map(),
  viewer: { ids: [], index: -1 },
  battleCue: { type: 'phy', crit: 0, enemyTurn: -1 },
  calloutQueue: [],
  calloutRecent: new Map(),
  heroKey: null,
  revealTimers: [],
  GRADE_ORDER: ['transcendence','legend','epic','rare','special','event','normal'],
  GRADE_LABELS: { all:'전체', transcendence:'초월', legend:'전설', epic:'에픽', rare:'레어', special:'스페셜', event:'이벤트', normal:'노멀' },
  SLOT_NAMES: ['선봉','중견','대장'],
  SUMMON_NAMES: { astra:'성좌 소환', strawberry:'하트 소환', dreamsky:'구름 소환' },
  THEMES: {
    dreamsky: { meta:'#edf2f7', back:'#16222f', accent:'#1a8cf0', soft:'#7cc0ff' },
    strawberry: { meta:'#f7f0f2', back:'#2a1e24', accent:'#e0457a', soft:'#ffb3cb' },
    astra: { meta:'#0b141e', back:'#0e1b29', accent:'#4fb3ff', soft:'#9fd6ff' }
  },
  get elementNames() { return DISPLAY_NAMES.element; },
  get roleNames() { return DISPLAY_NAMES.role; },
  get gradeNames() { return DISPLAY_NAMES.grade; },
  get modeNames() { return DISPLAY_NAMES.mode; },
  get motion() { return !document.body.classList.contains('dw-lite'); },

  // ---------- DOM helpers ----------
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
  plain(html) { return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); },
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
  // Presentation must never break a battle: wrapped runtime calls swallow view errors.
  safely(fn) { try { fn(); } catch (error) { console.warn('[DREAMWEAVER view]', error); } },
  portrait(entity, className = '') {
    return ImageAssets.createPortrait(entity || '', { wrapperClass:`dw-art${className ? ` ${className}` : ''}`, wrapperTag:'span' });
  },
  elementKey(element) { return ['fire','water','nature','wind','light','dark','earth'].includes(element) ? element : 'normal'; },
  // A 3:5 portrait in a grade-coloured frame, with the element badge.
  framed(card, className = '', entity = card) {
    const frame = this.text('span', '', `dw-cardart${className ? ` ${className}` : ''}`);
    if (card?.grade) frame.dataset.grade = card.grade;
    frame.append(this.portrait(entity));
    if (card?.element) {
      const badge = this.text('span', '', 'dw-el');
      badge.dataset.el = card.element;
      badge.append(this.icon(`el-${this.elementKey(card.element)}`));
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
    if (!Object.prototype.hasOwnProperty.call(this.THEMES, name)) name = 'strawberry';
    document.body.dataset.theme = name;
    document.querySelector('meta[name="theme-color"]').content = this.THEMES[name].meta;
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === name)));
    this.cardBackUrl = this.cardBack(name);
    document.body.style.setProperty('--card-back', `url("${this.cardBackUrl}")`);
    document.querySelectorAll('img[data-fallback=true]').forEach(img => {
      // Never replace a real portrait or interrupt an in-flight local image load.
      if (img.src.startsWith('data:image/')) img.src = this.cardBackUrl;
    });
    try { localStorage.setItem('dreamweaverTheme', name); } catch { /* Theme remains usable for this session. */ }
    if (this.ready && document.body.dataset.screen === 'summon') this.renderSummon();
  },
  // Each theme uses its bespoke card back asset (Astra astrolabe, Magical Girl heart-wing, Dream Sky moon-cloud).
  cardBack(theme) {
    if (typeof window !== 'undefined' && window.DREAMWEAVER_THEME_CARDS && window.DREAMWEAVER_THEME_CARDS[theme]) {
      return window.DREAMWEAVER_THEME_CARDS[theme];
    }
    const t = this.THEMES[theme] || this.THEMES.strawberry;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 500"><rect width="300" height="500" rx="18" fill="${t.back}"/><rect x="12" y="12" width="276" height="476" rx="12" fill="none" stroke="${t.accent}" stroke-opacity=".55" stroke-width="2"/><g stroke="${t.soft}" stroke-opacity=".09" stroke-width="1">${Array.from({length:22},(_,i)=>`<path d="M${-200+i*30} 500 L${100+i*30} 0"/>`).join('')}</g><g fill="none" stroke="${t.accent}" stroke-width="3"><path d="M150 168 172 228 232 250 172 272 150 332 128 272 68 250 128 228Z"/><circle cx="150" cy="250" r="104" stroke-opacity=".35" stroke-width="2"/></g><path d="M150 214 160 240 186 250 160 260 150 286 140 260 114 250 140 240Z" fill="${t.soft}"/><text x="150" y="440" fill="${t.soft}" fill-opacity=".8" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="6" text-anchor="middle">DREAMWEAVER</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
    const label = button.textContent.replace('⛶', '').trim() || '전체화면';
    button.setAttribute('aria-label', label);
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
      modal.style.setProperty('--chat-height', `${viewport.height}px`);
      modal.style.setProperty('--chat-top', `${viewport.offsetTop}px`);
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();
  },

  // ---------- Navigation ----------
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
  back() {
    if (document.body.dataset.screen === 'deck') return this.leaveDeck();
    if (this.collectionContext === 'factory') this.$('collection-back').click();
  },
  // Formation is a sub-screen: leaving it runs the game's own deck check (puzzle needs three).
  leaveDeck() {
    this.sfx('tap');
    if (!RPG.state.inventory.length) return RPG.toMenu();
    RPG.confirmDeck();
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

  // ---------- Images ----------
  fallback() { return this.cardBackUrl || this.cardBack(document.body.dataset.theme); },
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
      const alt = options.alt || entity?.name || filename.replace(/\.png$/i, '');
      if (ImageAssets.sources.get(img) === resolved && !options.force) {
        if (img.dataset.fallback === 'true') img.src = this.fallback(entity);
        return originalLoad(img, resolved, { ...options, alt });
      }
      delete img.dataset.fallback;
      originalLoad(img, resolved, { ...options, alt });
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
    this.heroKey = null;
    if (this.inRun()) {
      this.$('astra-party').replaceChildren();
      this.renderParty();
    } else this.renderTitle();
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
  // Title and lobby use the lead card's own illustration as the backdrop. A missing
  // portrait simply leaves the quiet field; the card back is never blown up.
  setHero(card) {
    const key = card?.id || '';
    if (this.heroKey === key) return;
    this.heroKey = key;
    const img = this.$('dw-hero-img');
    document.body.classList.remove('dw-has-hero');
    if (!card) { img.removeAttribute('src'); return; }
    const request = Symbol(key);
    this.heroRequest = request;
    const done = () => {
      if (this.heroRequest !== request) return;
      const real = img.getAttribute('src') && !img.src.startsWith('data:') && img.dataset.fallback !== 'true';
      document.body.classList.toggle('dw-has-hero', !!real);
    };
    img.addEventListener('load', done, { once:true });
    ImageAssets.load(img, card, { force:true, alt:'' });
  },
  leadOf(deck) {
    const ids = (deck || []).filter(id => id && RPG.getCardData(id));
    if (!ids.length) return null;
    const best = RPG.sortCardIdsByGrade([...new Set(ids)])[0];
    return { card:RPG.getCardData(best), slot:deck.lastIndexOf(best) };
  },
  featuredCard() {
    const legends = (typeof CARDS !== 'undefined' ? CARDS : []).filter(card => card.grade === 'legend' && !card.hide_from_gacha);
    if (!legends.length) return null;
    const day = Math.floor(Date.now() / 864e5);
    return legends[day % legends.length];
  },

  // ---------- Screens and header ----------
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
    this.closeGradeMenu();
    document.querySelectorAll('[data-nav]').forEach(button => {
      if (button.dataset.nav === kind) button.setAttribute('aria-current', 'page');
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
    const state = this.inRun() ? RPG.state : null;
    const mode = state ? (this.modeNames[state.mode] || state.mode) : '';
    const names = { title:'', menu:mode || '로비', deck:'파티 편성', collection:this.collectionContext === 'factory' ? '드래프트 덱' : '카드 도감', study:'배움의 기록실', battle:mode || '전투', draft:'여정 준비', summon:'소환' };
    document.querySelector('.header-status').textContent = names[screen] ?? '';
    let kicker = '';
    if (state && screen !== 'title') {
      kicker = screen === 'menu' || screen === 'battle'
        ? [state.gameType === 'endless' ? '엔드리스' : '도전', state.hardMode ? '하드' : ''].filter(Boolean).join(' · ')
        : screen === 'deck' ? '자리를 고르고 카드를 누르세요' : mode;
    }
    this.$('dw-top-kicker').textContent = kicker;
    const action = this.$('dw-top-action');
    action.hidden = screen !== 'deck';
    if (screen === 'deck') {
      action.textContent = '완료';
      action.onclick = () => this.leaveDeck();
    }
    this.renderTicketCount();
    this.refreshDots();
  },
  // Every badge that announces something to do is recomputed whenever a dialog closes.
  refreshDots() {
    const fortune = typeof FortuneCookie !== 'undefined' && FortuneCookie.canUse();
    const mission = this.missionClaimable();
    this.$('btn-fortune-cookie')?.classList.toggle('has-dot', fortune);
    this.$('btn-title-mission')?.classList.toggle('has-dot', mission);
    this.$('dw-study-fortune-btn')?.classList.toggle('has-dot', fortune);
    this.$('dw-mission-dot').hidden = !mission;
    const study = document.querySelector('[data-nav="study"]');
    study?.classList.toggle('has-dot', fortune);
    if (this.$('dw-study-fortune')) this.$('dw-study-fortune').textContent = fortune ? '오늘의 쿠키가 준비됐어요' : '오늘 결과 다시 보기';
  },
  saveSummary() {
    const result = Storage.loadDetailed(Storage.keys.SAVE);
    if (result.reason === 'missing') return null;
    const data = result.ok ? result.data : null;
    if (!data || typeof data !== 'object' || !data.mode) return { text:'', deck:[] };
    const stage = Number.isFinite(data.enemyScale) ? data.enemyScale + 1 : null;
    return {
      text:[this.modeNames[data.mode] || data.mode, data.gameType === 'endless' ? '엔드리스' : data.gameType === 'challenge' ? '도전' : '', stage ? `STAGE ${stage}` : ''].filter(Boolean).join(' · '),
      deck:Array.isArray(data.deck) ? data.deck : []
    };
  },
  renderTitle() {
    const summary = this.saveSummary();
    const start = this.$('btn-start-load');
    start.replaceChildren();
    const label = this.text('span', summary ? '여정 이어가기' : '여정 시작하기');
    label.append(this.text('small', summary ? (summary.text || '저장된 여정') : '첫 여정을 떠나요'));
    start.append(label, this.icon('right'));
    start.onclick = () => { this.sfx('open'); RPG.startGame(summary ? 'load' : 'new'); };
    this.$('btn-start-new').hidden = !summary;
    this.refreshDots();
    this.setHero(this.leadOf(summary?.deck)?.card || this.featuredCard());
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
      button.setAttribute('aria-label', `${this.SLOT_NAMES[index]}: ${card?.name || '비어 있음'}, 편성하기`);
      button.onclick = () => { this.sfx('tap'); RPG.openDeck(); RPG.selectDeckSlot(index); };
      let art;
      if (card) art = this.framed(card);
      else {
        art = this.text('span', '', 'dw-art dw-art--empty');
        art.append(this.icon('plus'));
      }
      button.append(this.text('span', String(index + 1), 'party-slotno'), art, this.text('strong', card?.name || this.SLOT_NAMES[index]));
      if (current) current.replaceWith(button);
      else box.append(button);
    });
    const filled = state.deck.filter(id => id && RPG.getCardData(id)).length;
    const owned = state.inventory.length;
    let note = '';
    if (!filled) note = owned ? '동료를 배치하면 출전할 수 있어요.' : '먼저 소환에서 동료를 모으세요.';
    else if (filled < 3 && owned > filled) note = `빈 자리 ${3 - filled}곳 · 편성의 자동 버튼으로 채울 수 있어요.`;
    this.$('astra-party-note').textContent = note;
    this.$('astra-party-note').hidden = !note;
    this.$('astra-depart').disabled = !filled;
    this.$('astra-depart-help').textContent = filled ? `STAGE ${state.enemyScale + 1}` : '편성 필요';
    this.renderLead();
    this.renderStage();
    this.renderBlessBadge();
    this.updateHeader();
    if (document.body.dataset.screen === 'summon') this.renderSummon();
  },
  renderLead() {
    const lead = this.leadOf(RPG.state.deck);
    const role = this.$('dw-lead-role');
    if (!lead) {
      role.textContent = '';
      this.$('dw-lead-name').textContent = RPG.state.inventory.length ? '파티를 편성하세요' : '첫 동료를 소환하세요';
      this.$('dw-lead-meta').textContent = RPG.state.inventory.length ? '편성에서 세 자리를 채울 수 있어요' : '도전 소환은 단어 퀴즈로 더 높은 등급을 노려요';
      // Before the first summon, the backdrop teases a legend from this run's pool.
      const pool = this.summonPool().filter(card => card.grade === 'legend');
      this.setHero(RPG.state.inventory.length ? null : pool[Math.floor(Date.now() / 864e5) % Math.max(1, pool.length)] || this.featuredCard());
      return;
    }
    const { card, slot } = lead;
    role.textContent = this.SLOT_NAMES[slot] || '';
    this.$('dw-lead-name').textContent = card.name;
    this.$('dw-lead-meta').textContent = [this.GRADE_LABELS[card.grade] || card.grade, this.cardLine(card)].join(' · ');
    this.setHero(card);
  },
  renderStage() {
    const state = RPG.state;
    this.$('astra-stage').textContent = String(state.enemyScale + 1).padStart(2, '0');
    this.$('astra-mode').textContent = this.modeNames[state.mode] || state.mode;
    this.$('dw-stage-type').textContent = state.hardMode ? ' · 하드' : '';
    const clear = GameUtils.getClearStage(state.mode, state.gameType);
    const route = this.$('dw-route');
    route.replaceChildren();
    if (Number.isFinite(clear)) {
      this.$('dw-stage-goal').textContent = ` / ${clear}`;
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
      const record = typeof ModeRecords !== 'undefined' ? ModeRecords.read() : { ok:false };
      const best = record.ok ? record.data.modes[state.mode]?.maxStage : 0;
      if (best) route.append(this.text('span', `최고 기록 STAGE ${best}`, 'dw-route-text'));
    }
    const enemy = RPG.getCurrentStageEnemyData();
    const name = this.$('next-enemy-text');
    name.textContent = enemy.name;
    if (state.mode === 'dream_corridor') {
      const max = GAME_CONSTANTS.DREAM_CORRIDOR_MAX_LIVES;
      const lives = state.dreamCorridorLives ?? max;
      name.append(this.text('span', `${'♥'.repeat(Math.max(0, lives))}${'♡'.repeat(Math.max(0, max - lives))}`, 'dw-lives'));
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
    RPG.openInfoModal('소환 확률', `<div class="dw-rates"><section><h4>도전 소환</h4><table>${describe(table.challenge)}</table></section><section><h4>일반 소환</h4><table>${describe(table.normal)}</table></section></div><p class="dw-note">도전 소환은 단어 퀴즈에 정답일 때 진행되며, 오답이면 티켓만 소모됩니다.</p>`);
  },

  // ---------- Summon ----------
  summonPool() {
    try { return GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions()); } catch { return []; }
  },
  renderSummon() {
    if (!this.inRun()) return;
    const state = RPG.state;
    const special = state.mode === 'draft' ? '드래프트' : ['chaos','artifact_chaos'].includes(state.mode) ? '카오스 풀' : state.mode === 'puzzle' ? '퍼즐 조각' : null;
    this.$('dw-banner-kicker').textContent = `${this.modeNames[state.mode] || state.mode} 카드풀`;
    this.$('dw-banner-title').textContent = special || this.SUMMON_NAMES[document.body.dataset.theme] || this.SUMMON_NAMES.strawberry;
    this.$('dw-nav-summon-label').textContent = state.mode === 'draft' ? '드래프트' : '소환';
    const pool = this.summonPool();
    const legends = pool.filter(card => card.grade === 'legend');
    this.$('dw-banner-pool').textContent = special ? `${this.modeNames[state.mode] || state.mode} 모드 전용 진행` : `${new Set(pool.map(card => card.id)).size}종 · 전설 ${legends.length}종`;
    const feature = this.$('dw-banner-feature');
    const key = `${state.mode}:${legends.map(card => card.id).join(',')}`;
    if (feature.dataset.key !== key) {
      feature.dataset.key = key;
      feature.replaceChildren();
      // A stable showcase per pool: three legends, the middle one in front.
      const picks = RPG.sortCardDataByGrade(legends).slice(0, 3);
      if (picks.length === 3) [picks[0], picks[1]] = [picks[1], picks[0]];
      [picks[1], picks[0], picks[2]].filter(Boolean).forEach(card => feature.append(this.framed(card)));
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
  // The learning summon is the headline: bigger, first, and it shows what the quiz is worth.
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
    challenge.prepend(this.icon('study'));
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
    stage.dataset.grade = card.grade;
    stage.classList.remove('is-done');
    stage.replaceChildren();
    stage.append(this.text('i', '', 'dw-reveal-glow'), this.text('i', '', 'dw-reveal-rays'));
    const heading = this.text('h2', options.title, 'dw-reveal-title');
    heading.id = 'dw-reveal-title';
    const flip = this.button('', 'dw-flip');
    flip.setAttribute('aria-label', '카드 공개');
    const inner = this.text('span', '', 'dw-flip-inner');
    const front = this.text('span', '', 'dw-flip-face dw-flip-front');
    front.append(this.framed(card));
    inner.append(this.text('span', '', 'dw-flip-face dw-flip-back'), front);
    const caption = this.text('span', '', 'dw-flip-caption');
    const grade = this.text('span', this.GRADE_LABELS[card.grade] || card.grade, 'dw-gradetag');
    grade.dataset.grade = card.grade;
    caption.append(grade, this.text('strong', card.name), this.text('small', this.cardLine(card)));
    flip.append(inner, caption);
    flip.onclick = () => this.flipCard();
    const note = this.text('p', options.note || '', 'dw-reveal-note');
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
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-labelledby', 'dw-reveal-title');
    stage.setAttribute('aria-hidden', 'false');
    stage.classList.add('is-open');
    this.revealState = { flip, card, opener:document.activeElement };
    for (const el of document.querySelectorAll('.dw-top,main,.astra-nav')) el.inert = true;
    this.renderTicketCount();
    this.sfx('summon');
    flip.focus({ preventScroll:true });
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
    this.revealTimers.push(setTimeout(() => stage.querySelector('.dw-reveal-actions .dw-btn:last-child')?.focus({ preventScroll:true }), 60));
  },
  clearRevealTimers() {
    this.revealTimers.forEach(clearTimeout);
    this.revealTimers = [];
  },
  closeReveal() {
    const stage = this.$('dw-reveal');
    if (!stage.classList.contains('is-open')) return;
    this.clearRevealTimers();
    stage.classList.remove('is-open', 'is-done');
    stage.setAttribute('aria-hidden', 'true');
    stage.replaceChildren();
    for (const el of document.querySelectorAll('.dw-top,main,.astra-nav')) el.inert = !!document.querySelector('.modal.active');
    const opener = this.revealState?.opener;
    this.revealState = null;
    this.renderTicketCount();
    if (this.inRun()) { this.renderSummonControls(); this.renderParty(); }
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll:true });
  },
  priceTag(value) {
    const tag = this.text('span', '', 'dw-price');
    tag.append(this.icon('ticket'), this.text('b', String(value)));
    return tag;
  },
  renderTicketCount() {
    if (this.inRun()) this.$('ui-tickets').textContent = RPG.state.tickets;
  },

  // ---------- Card tiles ----------
  cardTile(card, options = {}) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `dw-card${options.locked ? ' is-locked' : ''}`;
    tile.dataset.cardId = card.id;
    tile.dataset.grade = card.grade;
    const frame = this.framed(card);
    if (options.count > 1) frame.append(this.text('span', `×${options.count}`, 'dw-card-count'));
    if (options.locked) {
      const lock = this.text('span', '', 'dw-lock');
      lock.append(this.icon('lock'));
      frame.append(lock);
    }
    tile.append(frame, this.text('span', card.name, 'dw-card-name'));
    if (options.how) tile.append(this.text('span', options.how, options.locked ? 'dw-card-how' : 'dw-card-meta'));
    else tile.append(this.text('span', options.meta ?? this.cardLine(card), 'dw-card-meta'));
    const availability = options.locked ? `잠김, ${options.how || ''}` : options.count ? `${options.count}장 보유` : '';
    tile.setAttribute('aria-label', [card.name, this.GRADE_LABELS[card.grade] || card.grade, availability].filter(Boolean).join(', '));
    tile.onclick = options.onClick;
    if (!options.info) return tile;
    // Formation tiles assign on tap; the corner button (or a long press) opens details.
    const wrap = this.text('div', '', 'dw-card-wrap');
    const info = this.button('', 'dw-card-info', event => { event.stopPropagation(); this.showCard(card.id, options.list); });
    info.append(this.icon('info'));
    info.setAttribute('aria-label', `${card.name} 상세 정보`);
    let timer = null;
    tile.addEventListener('pointerdown', () => { timer = setTimeout(() => { timer = 'fired'; this.showCard(card.id, options.list); }, 480); });
    const cancel = () => { if (timer && timer !== 'fired') clearTimeout(timer); };
    tile.addEventListener('pointerup', cancel);
    tile.addEventListener('pointerleave', cancel);
    tile.addEventListener('pointercancel', cancel);
    tile.addEventListener('click', event => {
      if (timer === 'fired') { event.stopImmediatePropagation(); event.preventDefault(); }
      timer = null;
    }, true);
    tile.addEventListener('contextmenu', event => event.preventDefault());
    wrap.append(tile, info);
    return wrap;
  },
  renderCards(containerId, list, clickHandler) {
    if (containerId === 'deck-card-list') return this.renderDeckCards(clickHandler);
    const box = this.$(containerId);
    box.classList.add('dw-grid');
    box.replaceChildren();
    const counts = new Map();
    for (const id of list) counts.set(id, (counts.get(id) || 0) + 1);
    const ordered = RPG.sortCardIdsByGrade([...counts.keys()]).filter(id => RPG.getCardData(id));
    for (const id of ordered) {
      const card = RPG.getCardData(id);
      box.append(this.cardTile(card, { count: containerId === 'card-pool-grid' ? null : counts.get(id), onClick: () => { this.viewer = { ids:ordered, index:ordered.indexOf(id) }; clickHandler(id); } }));
    }
  },

  // ---------- Grade menu (shared by the collection and formation) ----------
  gradeOptions(cards) {
    const counts = new Map();
    for (const card of cards) counts.set(card.grade, (counts.get(card.grade) || 0) + 1);
    return { grades:this.GRADE_ORDER.filter(grade => counts.has(grade)), counts, total:cards.length };
  },
  openGradeMenu(button, context) {
    const menu = this.$('dw-grade-menu');
    if (!menu.hidden && this.gradeMenuFor === button) return this.closeGradeMenu();
    const cards = context === 'deck' ? this.deckCardList() : this.collectionCards().cards;
    const { grades, counts, total } = this.gradeOptions(cards);
    const current = context === 'deck' ? this.deckFilter : this.collectionGrade;
    menu.replaceChildren();
    for (const grade of ['all', ...grades]) {
      const item = this.button('', '', () => {
        this.closeGradeMenu();
        if (context === 'deck') { this.deckFilter = grade; this.renderDeckCards(); }
        else { this.collectionGrade = grade; this.renderCollection(); }
        button.focus({ preventScroll:true });
      });
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(grade === current));
      const swatch = this.text('i', '');
      if (grade !== 'all') swatch.dataset.grade = grade;
      item.append(swatch, this.text('span', this.GRADE_LABELS[grade] || grade), this.text('small', String(grade === 'all' ? total : counts.get(grade))));
      menu.append(item);
    }
    menu.hidden = false;
    const rect = button.getBoundingClientRect();
    const width = menu.offsetWidth;
    menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
    menu.style.top = `${Math.min(rect.bottom + 6, innerHeight - menu.offsetHeight - 8)}px`;
    this.gradeMenuFor = button;
    button.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-checked="true"]') || menu.firstChild)?.focus({ preventScroll:true });
    this.sfx('tap');
  },
  closeGradeMenu() {
    const menu = this.$('dw-grade-menu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    this.gradeMenuFor?.setAttribute('aria-expanded', 'false');
    this.gradeMenuFor = null;
  },
  setSelectLabel(button, prefix, grade) {
    button.replaceChildren(this.text('span', `${prefix}${this.GRADE_LABELS[grade] || grade}`), this.icon('down'));
  },

  // ---------- Collection: this run's cards, and the account's unlock book ----------
  // How each card enters play, from the game's own unlock rules.
  accountState(card) {
    const global = RPG.global || {};
    const bonus = new Set(global.unlocked_bonus_cards || []);
    if (card.unlockSource === 'hidden') {
      const thisMonth = global.monthlyMission?.rewardCardId === card.id;
      return { track:'hidden', open:bonus.has(card.id), how:thisMonth ? '이번 달 월간 미션 보상' : '월간 미션 보상' };
    }
    if (card.specialCard) return { track:'special', open:(global.unlocked_special_cards || []).includes(card.id), how:'시즌 미션 보상' };
    if (typeof BONUS_TRANSCENDENCE_CARDS !== 'undefined' && BONUS_TRANSCENDENCE_CARDS.some(item => item.id === card.id)) {
      const boss = (typeof ENEMIES !== 'undefined' ? ENEMIES : []).find(enemy => enemy.bonusTranscendenceReward === card.id);
      return { track:'trans', open:(global.unlocked_bonus_transcendence_cards || []).includes(card.id), how:boss ? `${boss.name} 격파 시 10%` : '히든 보스 격파 보상' };
    }
    if (card.unlockSource === 'bonus' || (typeof BONUS_CARDS !== 'undefined' && BONUS_CARDS.some(item => item.id === card.id))) {
      const today = typeof RPG.getCurrentDateKey === 'function' ? RPG.getCurrentDateKey() : '';
      const released = !card.releaseDate || !today || card.releaseDate <= today;
      const [, month, day] = (card.releaseDate || '').split('-').map(Number);
      return { track:released ? 'bonus' : 'upcoming', open:bonus.has(card.id), how:released ? '도전 모드 클리어 시 해금' : `${month}월 ${day}일 공개` };
    }
    if (typeof TRANSCENDENCE_CARDS !== 'undefined' && TRANSCENDENCE_CARDS.some(item => item.id === card.id)) return { open:true, how:'카오스 룰렛' };
    if (card.hide_from_gacha) return { open:true, how:'루미 데이트 이벤트' };
    return { open:true, how:'' };
  },
  collectionCards() {
    if (this.collectionTab === 'run' && this.inRun()) {
      const counts = new Map();
      for (const id of RPG.state.inventory) counts.set(id, (counts.get(id) || 0) + 1);
      return { counts, cards:[...counts.keys()].map(id => RPG.getCardData(id)).filter(Boolean) };
    }
    const seen = new Set();
    const counts = new Map();
    if (this.inRun()) for (const id of RPG.state.inventory) counts.set(id, (counts.get(id) || 0) + 1);
    const cards = GameUtils.getAllCards().filter(card => !seen.has(card.id) && seen.add(card.id));
    return { counts, cards };
  },
  setCollectionTab(tab) {
    this.collectionTab = tab === 'book' ? 'book' : 'run';
    this.collectionGrade = 'all';
    this.sfx('tap');
    this.renderCollection();
    this.$('collection-grid').scrollIntoView?.({ block:'nearest' });
    this.$('screen-collection').scrollTop = 0;
  },
  renderTracks() {
    const tracks = { bonus:[0,0], hidden:[0,0], special:[0,0], trans:[0,0] };
    const seen = new Set();
    for (const card of GameUtils.getAllCards()) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      const state = this.accountState(card);
      if (!tracks[state.track]) continue;
      tracks[state.track][1]++;
      if (state.open) tracks[state.track][0]++;
    }
    const labels = { bonus:'보너스 · 도전 클리어', hidden:'히든 · 월간 미션', special:'시즌 스페셜', trans:'초월 · 히든 보스' };
    const box = this.$('dw-tracks');
    box.replaceChildren(...Object.entries(tracks).filter(([, [, total]]) => total).map(([key, [have, total]]) => {
      const item = this.text('div', '', 'dw-track');
      const value = this.text('b', String(have));
      value.append(this.text('small', ` / ${total}`));
      const meter = this.text('em', '');
      const fill = this.text('i', '');
      fill.style.width = `${Math.round(have / total * 100)}%`;
      meter.append(fill);
      item.append(this.text('span', labels[key]), value, meter);
      return item;
    }));
  },
  renderCollection() {
    const book = this.collectionTab === 'book' || !this.inRun();
    this.$('dw-tab-run').setAttribute('aria-selected', String(!book));
    this.$('dw-tab-book').setAttribute('aria-selected', String(book));
    this.$('dw-tracks').hidden = !book;
    if (book) this.renderTracks();
    const { counts, cards } = this.collectionCards();
    const { grades } = this.gradeOptions(cards);
    if (this.collectionGrade !== 'all' && !grades.includes(this.collectionGrade)) this.collectionGrade = 'all';
    this.$('card-grade').value = this.collectionGrade;
    this.setSelectLabel(this.$('grade-picker-open'), '등급 · ', this.collectionGrade);
    const query = this.$('card-search').value.trim().toLocaleLowerCase();
    const filtered = cards.filter(card => (this.collectionGrade === 'all' || card.grade === this.collectionGrade)
      && `${card.name} ${card.element} ${card.role} ${this.elementNames[card.element] || ''} ${this.roleNames[card.role] || ''}`.toLocaleLowerCase().includes(query));
    const byId = new Map(filtered.map(card => [card.id, card]));
    const ordered = RPG.sortCardIdsByGrade([...byId.keys()]);
    const box = this.$('collection-grid');
    box.replaceChildren();
    for (const id of ordered) {
      const card = byId.get(id);
      const state = book ? this.accountState(card) : { open:true };
      box.append(this.cardTile(card, { count:counts.get(id) || 0, locked:!state.open, how:state.open ? '' : state.how, onClick:() => this.showCard(id, ordered) }));
    }
    this.$('collection-empty').hidden = filtered.length !== 0;
    this.$('collection-empty').textContent = !book && !cards.length ? '아직 모은 카드가 없습니다. 소환에서 동료를 모으세요.' : '조건에 맞는 카드가 없습니다.';
    const owned = this.inRun() ? RPG.state.inventory.length : 0;
    this.$('collection-count').textContent = book ? `${filtered.length}종` : `${counts.size}종 · ${owned}장`;
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

  // ---------- Formation ----------
  deckUse(id) {
    const owned = RPG.state.inventory.filter(item => item === id).length;
    const used = RPG.state.deck.filter(item => item === id).length;
    return { owned, used, spare:owned - used };
  },
  deckCardList() {
    return [...new Set(RPG.state.inventory)].map(id => RPG.getCardData(id)).filter(Boolean);
  },
  renderDeckCards(assign) {
    if (assign) this.deckAssign = assign;
    const box = this.$('deck-card-list');
    const counts = new Map();
    for (const id of RPG.state.inventory) counts.set(id, (counts.get(id) || 0) + 1);
    const ids = RPG.sortCardIdsByGrade([...counts.keys()]).filter(id => RPG.getCardData(id));
    const { grades } = this.gradeOptions(ids.map(id => RPG.getCardData(id)));
    if (this.deckFilter !== 'all' && !grades.includes(this.deckFilter)) this.deckFilter = 'all';
    const picker = this.$('dw-deck-grade');
    this.setSelectLabel(picker, '', this.deckFilter);
    picker.hidden = grades.length < 2;
    const scroll = box.scrollTop;
    box.replaceChildren();
    const shown = ids.filter(id => this.deckFilter === 'all' || RPG.getCardData(id).grade === this.deckFilter);
    for (const id of shown) {
      const card = RPG.getCardData(id);
      box.append(this.cardTile(card, { count:counts.get(id), info:true, list:shown, meta:this.roleNames[card.role] || card.role, onClick:() => this.pickDeckCard(id) }));
    }
    box.scrollTop = scroll;
    this.$('dw-deck-empty').hidden = ids.length !== 0;
    this.refreshDeckStates();
  },
  // Placement changes update badges in place; portraits are never rebuilt.
  refreshDeckStates() {
    for (const tile of this.$('deck-card-list').querySelectorAll('.dw-card')) {
      const id = tile.dataset.cardId;
      const slots = RPG.state.deck.map((item, index) => item === id ? index : -1).filter(index => index >= 0);
      const selected = RPG.selectedSlot >= 0 && RPG.state.deck[RPG.selectedSlot] === id;
      tile.classList.toggle('is-deployed', slots.length > 0);
      tile.classList.toggle('is-selected', selected);
      const frame = tile.querySelector('.dw-cardart');
      let badge = frame.querySelector('.dw-card-slot');
      if (slots.length && !badge) {
        badge = this.text('span', '', 'dw-card-slot');
        frame.append(badge);
      }
      if (badge) {
        if (slots.length) badge.textContent = slots.map(index => index + 1).join('·');
        else badge.remove();
      }
      const card = RPG.getCardData(id);
      tile.setAttribute('aria-label', [card.name, this.GRADE_LABELS[card.grade] || card.grade, `${this.deckUse(id).owned}장 보유`, slots.length ? `${slots.map(index => this.SLOT_NAMES[index]).join('·')} 출전 중` : ''].filter(Boolean).join(', '));
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
    for (const id of RPG.state.inventory) spare.set(id, (spare.get(id) || 0) + 1);
    for (const id of deck) if (id) spare.set(id, (spare.get(id) || 0) - 1);
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
    this.SLOT_NAMES.forEach((role, index) => {
      const slot = this.$(`slot-${index}`);
      const card = RPG.state.deck[index] ? RPG.getCardData(RPG.state.deck[index]) : null;
      if (slot.dataset.cardKey !== String(card?.id || '') || !slot.querySelector('.dw-art')) {
        slot.dataset.cardKey = card?.id || '';
        slot.classList.toggle('is-empty', !card);
        let art;
        if (card) art = this.framed(card);
        else {
          art = this.text('span', '', 'dw-art dw-art--empty');
          art.append(this.icon('plus'));
        }
        const label = this.text('span', '', 'dw-slot-role');
        label.append(this.text('b', String(index + 1)), this.text('span', role));
        slot.replaceChildren(art, label, this.text('strong', card?.name || '비어 있음'));
      }
      slot.removeAttribute('style');
      slot.setAttribute('aria-pressed', String(RPG.selectedSlot === index));
      slot.setAttribute('aria-label', `${role} ${card?.name || '빈 자리'}`);
    });
  },
  updateSlotSelection(index) {
    document.querySelectorAll('.dw-slot').forEach((slot, i) => slot.setAttribute('aria-pressed', String(i === index)));
    const role = this.SLOT_NAMES[index];
    const current = RPG.state.deck[index];
    this.$('deck-hint').textContent = !role ? '자리를 선택하세요' : current ? `${role} 교체 · 같은 카드를 누르면 해제` : `${role}에 배치할 카드를 고르세요`;
    this.refreshDeckStates();
  },

  // ---------- Card detail: one fixed sheet, navigation in its own bar ----------
  setupCardModal() {
    const content = this.$('modal-card').querySelector('.modal-content');
    content.classList.add('dw-card-sheet');
    content.removeAttribute('style');
    const scroll = content.querySelector('.modal-scroll');
    const art = this.$('md-img').parentElement;
    art.className = 'dw-art';
    art.removeAttribute('style');
    this.$('md-img').removeAttribute('style');
    const frame = this.text('span', '', 'dw-cardart dw-card-art');
    frame.append(art, this.text('span', '', 'dw-el'));
    const bar = this.text('div', '', 'dw-card-bar');
    const nav = (dir, label, icon, delta) => {
      const button = this.button('', 'dw-iconbtn dw-viewer-nav', () => this.stepViewer(delta));
      button.dataset.dir = dir;
      button.setAttribute('aria-label', label);
      button.append(this.icon(icon));
      return button;
    };
    const close = this.button('', 'dw-iconbtn', () => RPG.closeModal());
    close.setAttribute('aria-label', '닫기');
    close.append(this.icon('close'));
    bar.append(this.text('strong', '카드 정보', 'dw-card-bar-title'), nav('prev', '이전 카드', 'left', -1), this.text('span', '', 'dw-viewer-count'), nav('next', '다음 카드', 'right', 1), close);
    content.prepend(bar);
    const hero = this.text('div', '', 'dw-card-hero');
    const side = this.text('div', '', 'dw-card-side');
    const obtain = this.text('p', '', 'dw-card-obtain');
    obtain.id = 'dw-card-obtain';
    side.append(this.$('md-grade'), this.$('md-name'), obtain, this.$('md-stats'));
    hero.append(frame, side);
    scroll.prepend(hero);
    this.$('md-name').removeAttribute('style');
    this.$('md-grade').removeAttribute('style');
    this.$('md-stats').removeAttribute('style');
    this.$('md-skills').removeAttribute('style');
    // Swipe between cards in the current list.
    let startX = null;
    hero.addEventListener('touchstart', event => { startX = event.touches[0].clientX; }, { passive:true });
    hero.addEventListener('touchend', event => {
      if (startX === null) return;
      const dx = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) this.stepViewer(dx < 0 ? 1 : -1);
    });
    const closeModal = RPG.closeModal.bind(RPG);
    RPG.closeModal = () => { this.viewer = { ids: [], index: -1 }; return closeModal(); };
  },
  decorateCardInfo(id) {
    const card = RPG.getCardData(id);
    if (!card) return;
    const modal = this.$('modal-card');
    modal.dataset.grade = card.grade;
    const frame = modal.querySelector('.dw-card-hero > .dw-cardart');
    frame.dataset.grade = card.grade;
    const badge = frame.querySelector('.dw-el');
    badge.dataset.el = card.element;
    badge.replaceChildren(this.icon(`el-${this.elementKey(card.element)}`));
    const meta = this.$('md-grade');
    meta.className = 'dw-card-chips';
    const grade = this.text('span', this.GRADE_LABELS[card.grade] || this.gradeNames[card.grade] || card.grade, 'dw-gradetag');
    grade.dataset.grade = card.grade;
    meta.replaceChildren(grade, this.text('span', this.roleNames[card.role] || card.role, 'dw-chip-static'), this.text('span', this.elementNames[card.element] || card.element, 'dw-chip-static'));
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
      const row = this.text('div', '', 'dw-stat');
      const bar = this.text('em', '');
      const fill = this.text('i', '');
      fill.style.width = `${Math.round(Math.min(1, (card.stats[key] || 0) / this.statMax[key]) * 100)}%`;
      bar.append(fill);
      row.append(this.text('span', label), bar, this.text('b', Number(card.stats[key] || 0).toLocaleString('ko-KR')));
      stats.append(row);
    }
    const owned = RPG.state?.inventory ? RPG.state.inventory.filter(item => item === id).length : 0;
    if (owned) stats.append(this.text('p', `이번 여정 ${owned}장 보유`, 'dw-owned'));
    const state = this.accountState(card);
    const obtain = this.$('dw-card-obtain');
    obtain.textContent = state.how ? `${state.open ? '획득' : '잠김'} · ${state.how}` : '';
    obtain.hidden = !state.how;
    obtain.classList.toggle('is-locked', !state.open);
    const { ids, index } = this.viewer;
    const inList = ids[index] === id && ids.length > 1;
    modal.querySelectorAll('.dw-viewer-nav,.dw-viewer-count').forEach(el => { el.hidden = !inList; });
    if (inList) modal.querySelector('.dw-viewer-count').textContent = `${index + 1} / ${ids.length}`;
    else this.viewer = { ids: [], index: -1 };
    modal.querySelector('.modal-scroll').scrollTop = 0;
  },

  // ---------- Study ----------
  renderStudy() {
    const state = RPG.state || {};
    const collocation = ['chaos', 'artifact_chaos', 'draft'].includes(state.mode);
    const wrong = collocation ? (state.wrongCollocations || []).length : (state.wrongWords || []).length;
    this.$('dw-study-words').textContent = wrong ? `${collocation ? '연어' : '단어'} 오답 ${wrong}개 복습` : collocation ? '숙어 · 구동사' : '단어 · 오답 복습';
    this.$('dw-study-grammar').textContent = `문법 강의 ${GRAMMAR_DATA.length}강`;
    const quiz = state.quiz_stats;
    this.$('dw-study-toeic').textContent = quiz?.total ? `이번 여정 퀴즈 ${quiz.correct} / ${quiz.total} 정답` : 'Part 5 · 6 · 7 실전 문제';
    this.refreshDots();
  },

  // ---------- Battle HUD ----------
  renderBattleStatuses() {
    const render = (id, actor) => {
      const box = this.$(id);
      box.replaceChildren();
      for (const [key, value] of Object.entries(actor?.buffs || {})) {
        if (!value) continue;
        const negative = StatusRules.isNegative(key);
        const label = StatusRules.formatDisplay(key, value, RPG.state.artifacts || [], actor);
        const badge = this.text('span', label, `status-badge ${negative ? 'status-negative' : 'status-positive'}`);
        badge.title = `${negative ? '디버프' : '버프'}: ${BUFF_NAMES[key] || key}`;
        box.append(badge);
      }
    };
    render('p-buffs', RPG.battle.players[RPG.battle.currentPlayerIdx]);
    render('e-buffs', RPG.battle.enemy);
  },
  renderBattleHud() {
    const battle = RPG.battle;
    if (!battle || !battle.enemy) return;
    const player = battle.players[battle.currentPlayerIdx];
    const format = value => Math.max(0, Math.round(value)).toLocaleString('ko-KR');
    if (player) {
      this.$('dw-p-hp').textContent = `${format(player.hp)} / ${format(player.maxHp)}`;
      this.$('dw-p-mp').textContent = `MP ${format(player.mp)} / ${format(player.maxMp || GAME_CONSTANTS.MAX_MP)}`;
      const grade = player.proto?.grade || RPG.getCardData(player.id)?.grade;
      if (grade) this.$('dw-p-card').dataset.grade = grade;
    }
    this.$('dw-e-hp').textContent = `${format(battle.enemy.hp)} / ${format(battle.enemy.maxHp)}`;
    this.$('dw-enemy-tag').textContent = `STAGE ${RPG.state.enemyScale + 1}`;
    this.$('enemy-actor-box').classList.toggle('is-charging', !!battle.enemy.isCharging);
    this.$('player-actor-box').classList.toggle('is-down', !!player?.isDead);
    const pill = this.$('dw-turn-pill');
    pill.dataset.side = /enemy/.test(battle.phase || '') ? 'enemy' : 'player';
    const bench = this.$('dw-bench');
    bench.replaceChildren();
    battle.players.forEach((member, index) => {
      if (!member) return;
      const pip = this.text('i', '', `dw-pip${index === battle.currentPlayerIdx ? ' is-current' : ''}${member.isDead ? ' is-down' : ''}`);
      pip.title = `${this.SLOT_NAMES[member.pos ?? index] || ''} ${member.name}${member.isDead ? ' (전투 불능)' : ''}`;
      bench.append(pip);
    });
    bench.setAttribute('aria-label', `파티 ${battle.players.filter(member => member && !member.isDead).length}명 생존`);
    const field = this.$('field-buff-box');
    const known = new Set(this.fieldShown || []);
    const names = battle.fieldBuffs.map(buff => buff.name);
    field.replaceChildren(...names.map(name => this.text('span', BUFF_NAMES[name] || name, `dw-field-chip${known.has(name) || !this.motion ? '' : ' is-new'}`)));
    this.fieldShown = names;
    this.reactToHp('p', player, battle);
    this.reactToHp('e', battle.enemy, battle);
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

  // ---------- Battle presentation ----------
  // Impact follows what actually happened (damage, crits, signature effects),
  // never a skill's tier. Strokes travel from the attacker towards the target.
  actorBox(side) { return this.$(side === 'p' ? 'player-actor-box' : 'enemy-actor-box'); },
  cardRect(side) {
    const arena = this.$('dw-arena').getBoundingClientRect();
    const card = this.$(side === 'p' ? 'dw-p-card' : 'dw-e-card').getBoundingClientRect();
    return { x:card.left - arena.left, y:card.top - arena.top, w:card.width, h:card.height };
  },
  spawnFx(side, kind, color) {
    if (!this.motion || document.body.dataset.screen !== 'battle') return;
    const rect = this.cardRect(side);
    if (!rect.w) return;
    const fromLeft = side === 'e';
    const shapes = {
      slash:'<path d="M-6 22 Q46 30 106 70" stroke-width="7"/><path d="M-4 40 Q48 50 104 92" stroke-width="4"/><path d="M2 8 Q50 14 98 44" stroke-width="3"/>',
      heavy:'<path d="M-10 18 Q46 34 110 84" stroke-width="10"/><path d="M-8 44 Q50 52 108 102" stroke-width="6"/><path d="M0 2 Q52 10 104 48" stroke-width="4"/>',
      burst:'<circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="26"/><circle class="fx-core" cx="50" cy="50" r="12"/>' + Array.from({ length:8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${50 + Math.cos(a) * 18}" y1="${50 + Math.sin(a) * 18}" x2="${50 + Math.cos(a) * 46}" y2="${50 + Math.sin(a) * 46}" stroke-width="3"/>`; }).join(''),
      heal:'<path d="M30 60v-14M23 53h14"/><path d="M62 72v-14M55 65h14"/><path d="M50 40v-14M43 33h14"/>',
      guard:'<polygon points="50,8 86,26 86,62 50,92 14,62 14,26"/>'
    };
    const classes = { slash:'fx-slash', heavy:'fx-slash', burst:'fx-burst', crit:'fx-burst fx-crit', heal:'fx-heal', guard:'fx-guard' };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', `dw-fx ${classes[kind] || 'fx-burst'}`);
    svg.innerHTML = shapes[kind === 'crit' ? 'burst' : kind] || shapes.burst;
    const size = kind === 'slash' || kind === 'heavy' ? { w:rect.w * 1.25, h:rect.h * .62 } : { w:rect.w * 1.1, h:rect.w * 1.1 };
    Object.assign(svg.style, { left:`${rect.x + rect.w / 2 - size.w / 2}px`, top:`${rect.y + rect.h * .42 - size.h / 2}px`, width:`${size.w}px`, height:`${size.h}px` });
    svg.style.setProperty('--fxc', color || 'var(--accent)');
    if ((kind === 'slash' || kind === 'heavy') && !fromLeft) svg.style.transform = 'scaleX(-1)';
    this.$('dw-fxlayer').append(svg);
    setTimeout(() => svg.remove(), 900);
  },
  floatText(side, value, kind) {
    const rect = this.cardRect(side);
    if (!rect.w) return;
    const mark = this.text('span', value, `dw-float is-${kind}`);
    mark.style.left = `${rect.x + rect.w / 2 + (Math.random() * 16 - 8)}px`;
    mark.style.top = `${rect.y + rect.h * .38}px`;
    this.$('dw-fxlayer').append(mark);
    setTimeout(() => mark.remove(), 1000);
  },
  shake(strength = 1) {
    if (!this.motion) return;
    const arena = this.$('dw-arena');
    arena.style.setProperty('--shake', `${3 * strength}px`);
    arena.classList.remove('dw-shake');
    void arena.offsetWidth;
    arena.classList.add('dw-shake');
  },
  lunge(side) {
    if (!this.motion) return;
    const box = this.actorBox(side);
    box.classList.remove('dw-lunge');
    void box.offsetWidth;
    box.classList.add('dw-lunge');
  },
  recoil(side) {
    const box = this.actorBox(side);
    box.classList.remove('dw-hit');
    void box.offsetWidth;
    box.classList.add('dw-hit');
  },
  // HP changes drive numbers, strokes and recoil.
  reactToHp(side, actor, battle) {
    if (!actor) return;
    const memory = this.hpMemory.get(side);
    const identity = `${actor.id}:${side === 'p' ? battle.currentPlayerIdx : 'enemy'}`;
    this.hpMemory.set(side, { battle, identity, hp:actor.hp });
    if (!memory || memory.battle !== battle || memory.identity !== identity) return;
    const delta = Math.round(actor.hp - memory.hp);
    if (!delta) return;
    if (delta > 0) {
      this.floatText(side, `+${delta.toLocaleString('ko-KR')}`, 'heal');
      this.spawnFx(side, 'heal', 'var(--success)');
      this.sfx('heal');
      return;
    }
    // Only the player's attacks can be critical; the flag belongs to the hit that logged it.
    const crit = side === 'e' && Date.now() - this.battleCue.crit < 1500;
    const heavy = -delta >= (actor.maxHp || Infinity) * .3;
    const byPlayer = side === 'e';
    const type = byPlayer ? this.battleCue.type : this.battleCue.enemyType;
    const color = byPlayer ? (type === 'mag' ? 'var(--mag-line)' : 'var(--phy-line)') : 'var(--danger)';
    this.floatText(side, delta.toLocaleString('ko-KR'), crit ? 'crit' : 'hit');
    if (type === 'mag') this.spawnFx(side, crit ? 'crit' : 'burst', crit ? '#ffd84a' : color);
    else {
      this.spawnFx(side, heavy || crit ? 'heavy' : 'slash', color);
      if (crit) this.spawnFx(side, 'crit', '#ffd84a');
    }
    this.recoil(side);
    if (crit || heavy) this.shake(crit && heavy ? 2 : 1.3);
    this.sfx(crit ? 'crit' : type === 'mag' ? 'magic' : 'hit');
    if (crit) this.battleCue.crit = 0;
  },
  callout(kind, label, message) {
    if (document.body.dataset.screen !== 'battle') return;
    const text = this.plain(message);
    if (!text) return;
    const key = `${kind}:${text}`;
    if (Date.now() - (this.calloutRecent.get(key) || 0) < 4000) return;
    this.calloutRecent.set(key, Date.now());
    this.calloutQueue.push({ kind, label, text });
    if (this.calloutQueue.length > 3) this.calloutQueue.splice(0, this.calloutQueue.length - 3);
    if (!this.calloutTimer) this.nextCallout();
  },
  nextCallout() {
    const item = this.calloutQueue.shift();
    const box = this.$('dw-callouts');
    if (!item) { this.calloutTimer = null; return; }
    const el = this.text('div', '', 'dw-callout');
    el.dataset.kind = item.kind;
    el.append(this.text('b', item.label), this.text('span', item.text));
    box.replaceChildren(el);
    this.calloutTimer = setTimeout(() => { el.remove(); this.nextCallout(); }, this.motion ? 1150 : 1600);
  },
  // A cut-in is reserved for moments that change the fight. It shows the whole card.
  cutIn(side, entity, card, title, reason) {
    if (!this.motion || document.body.dataset.screen !== 'battle') return;
    const band = this.text('div', '', 'dw-cutin');
    band.dataset.side = side === 'p' ? 'player' : 'enemy';
    const frame = this.framed(card || { grade:'' }, '', entity);
    if (side === 'e') frame.dataset.grade = '';
    const copy = this.text('span', '', 'dw-cutin-copy');
    copy.append(this.text('small', entity?.name || ''), this.text('strong', title), this.text('em', reason));
    band.append(frame, copy);
    this.$('dw-arena').querySelector('.dw-cutin')?.remove();
    this.$('dw-arena').append(band);
    this.sfx('cutin');
    setTimeout(() => band.remove(), 1200);
  },
  signature(source, target, skill, isDelayed) {
    const types = new Set((skill.effects || []).map(effect => effect.type));
    const battle = RPG.battle;
    const debuffStacks = Object.entries(target?.buffs || {}).filter(([key, value]) => value && StatusRules.isNegative(key)).reduce((sum, [, value]) => sum + (Number(value) || 1), 0);
    const fields = battle.fieldBuffs.length;
    if (types.has('suicide')) return ['자폭', '모든 힘을 한 번에'];
    if (types.has('transform') || types.has('transform_choice')) return ['변신', '전투 중 새로운 모습으로'];
    if ((types.has('consume_field_all') || types.has('consume_field_buff_dmg') || types.has('remove_field_buff_dmg')) && fields >= 2) return ['전소모', `필드 버프 ${fields}개 소모`];
    if ((types.has('consume_debuff_all') || types.has('consume_debuff_then_random_debuff')) && debuffStacks >= 3) return ['전소모', `디버프 ${debuffStacks}중첩 소모`];
    if (isDelayed) return ['지연 발동', '준비한 기술이 터집니다'];
    return null;
  },
  beforeSkill(source, target, skill, isDelayed) {
    const battle = RPG.battle;
    if (!battle || !skill || !battle.players.includes(source)) return;
    this.battleCue.type = skill.type || 'phy';
    if (skill.type === 'sup') this.spawnFx('p', (skill.effects || []).some(effect => /barrier|guard|shield/.test(effect.id || effect.type || '')) ? 'guard' : 'heal', 'var(--sup-line)');
    else this.lunge('p');
    const moment = this.signature(source, target, skill, isDelayed);
    if (moment) this.cutIn('p', source, source.proto || RPG.getCardData(source.id), skill.name, moment[1] ? `${moment[0]} · ${moment[1]}` : moment[0]);
  },
  // Big enemy patterns: charging is telegraphed, scheduled finishers get a cut-in.
  onEnemyAction(enemy, action) {
    const battle = RPG.battle;
    if (!battle || battle.enemy !== enemy || !action) return;
    this.battleCue.enemyType = action.type;
    this.battleCue.enemyAction = action.name;
    if (action.isChargeStart) {
      this.callout('danger', '경고', `${enemy.name} 힘을 모으는 중 · 다음 턴 강공격`);
      this.sfx('charge');
      return;
    }
    const scheduled = action.rate === 0 || (Number(action.val) || 0) >= 3;
    if (action.chargeReset || (scheduled && action.name !== '일반 공격')) {
      this.cutIn('e', enemy, null, action.name, action.chargeReset ? '모아둔 힘 해방' : '보스 필살 패턴');
    }
  },
  onBattleLog(message) {
    if (typeof message !== 'string' || !RPG.battle) return;
    const battle = RPG.battle;
    const plain = this.plain(message);
    // Turn markers read as quiet dividers instead of ASCII rules.
    const turn = plain.match(/^=== (\d+)턴 ===$/);
    if (turn || plain === '--- 적 턴 ---') {
      const line = this.$('battle-log').lastElementChild;
      if (line) {
        line.classList.add('log-turn');
        line.classList.toggle('is-enemy', !turn);
        line.textContent = turn ? `TURN ${turn[1]}` : 'ENEMY TURN';
      }
    }
    if (/Critical/.test(message) && battle.phase === 'player-resolving') this.battleCue.crit = Date.now();
    if (battle.phase === 'enemy-resolving' && battle.turn !== this.battleCue.enemyTurn && battle.enemy?.name && plain.startsWith(battle.enemy.name)) {
      this.battleCue.enemyTurn = battle.turn;
      this.lunge('e');
    }
    let match;
    if ((match = plain.match(/^\[시너지\]\s*(.+?)\s*발동!?$/))) this.callout('synergy', '시너지', match[1]);
    else if ((match = plain.match(/^\[특성\]\s*(.+)$/))) this.callout('trait', '특성', match[1]);
    else if ((match = plain.match(/^\[아티팩트\]\s*(.+)$/))) this.callout('artifact', '아티팩트', match[1]);
    else if ((match = plain.match(/^필드버프 \[(.+?)\] 발동!$/))) this.callout('field', '필드', `${match[1]} 전개`);
    if (/배리어로 방어|매직가드로 방어/.test(plain)) { this.spawnFx('p', 'guard', 'var(--accent)'); this.floatText('p', 'GUARD', 'miss'); }
    if (/회피 성공/.test(plain)) this.floatText(battle.phase === 'enemy-resolving' ? 'p' : 'e', 'MISS', 'miss');
    if (/쓰러짐!$|사망!$/.test(plain) && this.motion) {
      // Drawn on the effect layer: the fallen card fades out underneath it.
      const rect = this.cardRect('p');
      const stamp = this.text('span', 'K.O.', 'dw-ko');
      stamp.style.left = `${rect.x + rect.w / 2}px`;
      stamp.style.top = `${rect.y + rect.h * .4}px`;
      this.$('dw-fxlayer').append(stamp);
      setTimeout(() => stamp.remove(), 1100);
    }
  },
  installBattleRuntime() {
    if (typeof BattleRuntime !== 'undefined' && typeof BattleRuntime.executeSkill === 'function') {
      const execute = BattleRuntime.executeSkill;
      BattleRuntime.executeSkill = function (rpg, source, target, skill, isDelayed) {
        Astra.safely(() => Astra.beforeSkill(source, target, skill, isDelayed));
        return execute.apply(this, arguments);
      };
    }
    if (typeof Logic !== 'undefined' && typeof Logic.decideEnemyAction === 'function') {
      const decide = Logic.decideEnemyAction;
      Logic.decideEnemyAction = function (enemy) {
        const action = decide.apply(this, arguments);
        Astra.safely(() => Astra.onEnemyAction(enemy, action));
        return action;
      };
    }
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
      unlocked:[...(RPG.global?.unlocked_bonus_cards || [])],
      trans:[...(RPG.global?.unlocked_bonus_transcendence_cards || [])]
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
    modal.classList.remove('dw-result', 'is-win', 'is-lose', 'has-actions');
    modal.querySelector('.dw-result-actions')?.remove();
  },
  miniCard(card, index) {
    const item = this.text('div', '', 'dw-mini');
    item.style.setProperty('--i', index);
    item.append(this.framed(card), this.text('strong', card.name));
    return item;
  },
  countUp(el, to) {
    if (!this.motion) { el.textContent = `+${to}`; return; }
    const start = performance.now() + 350;
    const step = now => {
      const t = Math.max(0, Math.min(1, (now - start) / 600));
      el.textContent = `+${Math.round(to * (1 - Math.pow(1 - t, 3)))}`;
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = '+0';
    requestAnimationFrame(step);
  },
  decorateInfo(title) {
    this.resetInfoModal();
    const snap = this.battleSnapshot;
    const kinds = { '전투 결과':'battle', '게임 클리어':'clear', 'Game Over':'over' };
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
    const clear = kinds[title] === 'clear';
    const head = this.text('div', '', 'dw-result-head');
    const word = this.text('b', clear ? 'STAGE CLEAR' : win ? 'VICTORY' : 'DEFEAT');
    head.setAttribute('role', 'img');
    head.setAttribute('aria-label', word.textContent);
    head.append(word, this.text('span', clear ? `${this.modeNames[snap.mode] || snap.mode} 모드 클리어` : `STAGE ${snap.stage} · ${snap.enemy?.name || ''}${win ? ' 격파' : ''}`));
    const panel = this.text('div', '', 'dw-result-body');
    if (win) {
      const gained = RPG.state.tickets - snap.tickets;
      if (gained > 0) {
        const reward = this.text('div', '', 'dw-reward');
        const value = this.text('b', `+${gained}`);
        reward.append(this.icon('ticket'), this.text('span', '소환 티켓'), value);
        panel.append(reward);
        this.countUp(value, gained);
      }
    }
    const unlocked = [
      ...(RPG.global?.unlocked_bonus_cards || []).filter(id => !snap.unlocked.includes(id)),
      ...(RPG.global?.unlocked_bonus_transcendence_cards || []).filter(id => !snap.trans.includes(id))
    ].map(id => RPG.getCardData(id)).filter(Boolean);
    if (unlocked.length) {
      const row = this.text('div', '', 'dw-result-cards is-new');
      row.append(this.text('h4', '도감 해금'));
      unlocked.forEach((card, index) => row.append(this.miniCard(card, index)));
      panel.append(row);
    }
    const fallen = snap.fallen.map(id => RPG.getCardData(id)).filter(Boolean);
    if (fallen.length) {
      const row = this.text('div', '', 'dw-result-cards is-lost');
      row.append(this.text('h4', snap.mode === 'puzzle' ? '사용 후 소멸' : '전투 불능 · 카드 소멸'));
      fallen.forEach((card, index) => row.append(this.miniCard(card, index)));
      panel.append(row);
    }
    content.replaceChildren(head, panel);
    if (notes) {
      const note = this.text('div', '', 'dw-result-notes');
      note.innerHTML = notes;
      panel.append(note);
    }
    this.sfx(win ? 'victory' : 'defeat');
    if (title !== '전투 결과') return;
    const offer = win ? this.bonusOffer() : null;
    const actions = this.text('div', '', 'dw-result-actions');
    modal.classList.add('has-actions');
    if (offer) {
      const card = this.text('div', '', 'dw-offer');
      card.append(this.icon('study'), this.text('span', offer));
      panel.append(card);
      actions.append(this.button('건너뛰기', 'dw-btn', () => this.resultAction('no')), this.button('퀴즈 도전', 'dw-btn dw-btn--primary', () => this.resultAction('yes')));
    } else {
      actions.append(this.button(win ? '계속' : '로비로', 'dw-btn dw-btn--primary dw-btn--block', () => this.resultAction(null)));
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
    const preview = this.text('button', '', 'reward-card-preview');
    preview.type = 'button';
    preview.setAttribute('aria-label', `${card.name} 보상 카드 자세히 보기`);
    preview.append(this.framed(card));
    preview.onclick = () => RPG.showCardInfo(card.id);
    panel.prepend(preview);
    const mission = RPG.missionViewType === 'special' ? RPG.global.specialMission : RPG.global.monthlyMission;
    const objectives = Object.values(mission.missions || {});
    const complete = objectives.filter(item => (item.progress || 0) >= item.target).length;
    const progress = this.text('div', mission.claimed ? '수령 완료' : `${complete} / ${objectives.length} 미션 완료`, 'reward-progress');
    const meter = this.text('span', '', 'dw-meter');
    const fill = this.text('i', '');
    fill.style.width = `${objectives.length ? complete / objectives.length * 100 : 0}%`;
    meter.append(fill);
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
      const copy = this.text('span', '', 'dw-mission-copy');
      copy.append(this.text('strong', title), this.text('small', `보상 · ${rewards[index]()}`));
      const meter = this.text('span', '', 'dw-meter');
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
    heading.removeAttribute('style');
    const head = this.text('div', '', 'dw-sheet-head');
    const close = this.button('', 'dw-iconbtn', onClose);
    close.setAttribute('aria-label', '닫기');
    close.append(this.icon('close'));
    heading.replaceWith(head);
    head.append(heading, close);
    return content;
  },
  setupSystemMenu() {
    const content = this.setupSheetHead('modal-menu', '메뉴', () => this.$('modal-menu').classList.remove('active'));
    content.classList.add('dw-menu-sheet');
    const list = this.text('div', '', 'dw-menu-list');
    const icons = { '저장하기':'save', '기록 확인':'trophy', '카드풀 확인':'grid', '타이틀로':'exit', '음악재생':'music' };
    for (const button of [...content.querySelectorAll('button.menu-btn')]) {
      const label = button.textContent.trim();
      button.className = 'dw-menu-item';
      button.removeAttribute('style');
      if (label === '음악재생') { button.hidden = true; continue; }
      if (icons[label]) button.replaceChildren(this.icon(icons[label]), this.text('span', label));
      if (label === '타이틀로') button.classList.add('is-danger');
      list.append(button);
    }
    const mission = this.button('', 'dw-menu-item', () => { this.$('modal-menu').classList.remove('active'); RPG.openMissionHub(); });
    mission.append(this.icon('mission'), this.text('span', '미션'));
    list.prepend(mission);
    const settings = this.button('', 'dw-menu-item', () => this.settings());
    settings.append(this.icon('sliders'), this.text('span', '설정 · 테마 · 연출'));
    list.insertBefore(settings, list.querySelector('.is-danger'));
    content.querySelector('.dw-sheet-head').after(list);
    content.querySelector(':scope > button:not(.dw-menu-item):not(.dw-iconbtn)')?.remove();
  },
  syncSystemMenu() {
    const button = this.$('btn-toggle-tutoring');
    const on = RPG.global?.tutoringEventEnabled !== false;
    button.removeAttribute('style');
    button.className = 'dw-menu-item dw-toggle';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(on));
    button.replaceChildren(this.icon('pen'), this.text('span', '개인과외 이벤트'), this.text('i', '', 'dw-switch'));
  },
  setupTypeSelect() {
    const modal = this.$('modal-type-select');
    const content = modal.querySelector('.modal-content');
    content.classList.add('dw-sheet', 'dw-journey');
    content.removeAttribute('style');
    content.querySelector('h3').textContent = '새 여정';
    content.querySelector('h3').removeAttribute('style');
    content.querySelector('p').textContent = '어떤 방식으로 떠날까요?';
    content.querySelector('p').removeAttribute('style');
    const [endless, challenge] = content.querySelectorAll('[onclick^="RPG.selectGameType"]');
    const choice = (button, icon, title, desc) => {
      button.removeAttribute('style');
      button.classList.add('dw-journey-choice');
      button.replaceChildren(this.icon(icon), this.text('strong', title), this.text('small', desc));
    };
    // Challenge runs unlock new companions, so they lead.
    choice(challenge, 'trophy', '도전', '목표 스테이지 클리어 · 새 동료 해금');
    choice(endless, 'star', '엔드리스', '끝없는 스테이지 · 최고 기록 도전');
    const grid = this.text('div', '', 'dw-journey-grid');
    endless.before(grid);
    grid.append(challenge, endless);
    const label = this.text('h4', '다음 여정의 카드풀', 'dw-section-label');
    grid.after(label);
    const list = this.text('div', '', 'dw-menu-list');
    label.after(list);
    for (const id of ['btn-bonus-pool-editor', 'btn-card-set-editor', 'btn-special-card-editor']) {
      const button = this.$(id);
      const display = button.style.display;
      button.removeAttribute('style');
      if (display) button.style.display = display;
      button.classList.add('dw-menu-item');
      const sub = button.querySelector('span');
      const title = button.firstChild.textContent.trim();
      button.replaceChildren(this.icon(id === 'btn-card-set-editor' ? 'grid' : id === 'btn-special-card-editor' ? 'star' : 'book'), this.text('strong', title), sub || this.text('span', ''));
      sub?.removeAttribute('style');
      list.append(button);
    }
    const back = content.querySelector('[onclick="RPG.backFromTypeSelect()"]');
    back.removeAttribute('style');
    back.className = 'dw-btn dw-btn--block';
  },
  setupModeSelect() {
    const content = this.$('modal-mode-select').querySelector('.modal-content');
    content.classList.add('dw-sheet', 'dw-mode-sheet');
    content.removeAttribute('style');
    const enter = this.$('btn-enter-mode');
    enter.removeAttribute('style');
    enter.className = 'dw-btn dw-btn--hero dw-btn--block';
    enter.textContent = '이 모드로 출발';
    const cancel = content.querySelector('[onclick*="modal-mode-select"]');
    cancel.removeAttribute('style');
    cancel.className = 'dw-btn dw-btn--block';
    cancel.textContent = '뒤로';
    const footer = this.text('div', '', 'dw-mode-footer');
    this.$('mode-desc').removeAttribute('style');
    footer.append(this.$('mode-desc'), enter, cancel);
    content.append(footer);
    this.$('mode-list').removeAttribute('style');
    for (const id of ['btn-chaos-roulette', 'btn-hard-mode']) this.$(id).classList.add('dw-chip');
  },
  decorateModes() {
    const definitions = new Map((RPG.modeDefinitions || []).map(mode => [mode.id, mode]));
    const records = typeof ModeRecords !== 'undefined' ? ModeRecords.read() : { ok:false };
    const heading = this.$('modal-mode-select').querySelector('h3');
    heading.textContent = RPG.tempGameType === 'endless' ? '엔드리스 · 모드 선택' : RPG.tempGameType === 'challenge' ? '도전 · 모드 선택' : '모드 선택';
    this.$('modal-mode-select').dataset.selected = '';
    for (const id of ['btn-chaos-roulette', 'btn-hard-mode']) {
      const toggle = this.$(id);
      const display = toggle.style.display;
      toggle.removeAttribute('style');
      toggle.style.display = display;
    }
    for (const button of this.$('mode-list').querySelectorAll('button')) {
      const id = button.id.replace('mode-btn-', '');
      const mode = definitions.get(id);
      if (!mode) continue;
      const cleared = button.style.color && button.style.color !== '';
      button.style.removeProperty('color');
      button.style.removeProperty('padding');
      button.style.removeProperty('font-size');
      button.classList.add('dw-mode');
      const summary = mode.desc.split('\n(')[0].replace(/\n/g, ' ');
      const goal = (mode.desc.match(/\(성공조건:\s*([^)]*)\)/) || [])[1] || '';
      const chips = this.text('span', '', 'dw-mode-tags');
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
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        for (const item of this.$('mode-list').querySelectorAll('button')) {
          item.style.removeProperty('border-color');
          item.setAttribute('aria-pressed', String(item.id === `mode-btn-${RPG.selectedModeId}`));
        }
        this.$('modal-mode-select').dataset.selected = RPG.selectedModeId || '';
        this.$('mode-desc').scrollTop = 0;
        this.sfx('tap');
      });
    }
  },
  setupBlessing() {
    const content = this.$('modal-chaos').querySelector('.modal-content');
    content.classList.add('dw-sheet', 'dw-bless-sheet');
    content.removeAttribute('style');
    const check = content.querySelector('[onclick="RPG.checkActiveChaosBlessings()"]');
    check.removeAttribute('style');
    check.className = 'dw-btn dw-btn--block';
    this.$('btn-artifact-check').classList.add('dw-btn', 'dw-btn--block');
    const close = content.querySelector('.chaos-close-btn');
    close.removeAttribute('style');
    close.className = 'chaos-close-btn dw-btn dw-btn--block';
    const icons = ['bless', 'study', 'book'];
    content.querySelectorAll('[onclick^="RPG.activateChaos"]').forEach((button, index) => {
      const sub = button.querySelector('span');
      const title = button.firstChild.textContent.trim();
      button.removeAttribute('style');
      button.classList.add('dw-bless-option');
      sub?.removeAttribute('style');
      button.replaceChildren(this.icon(icons[index] || 'bless'), this.text('strong', title), sub || this.text('span', ''));
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
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Dreamweaver-progress-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (hasOwn(Storage.keys.GLOBAL) && !RPG.validateGlobalData(safe[Storage.keys.GLOBAL])) throw new Error('전역 기록 형식이 잘못되었습니다.');
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
    for (const [key, value] of Object.entries(safe)) {
      if ([Storage.keys.VOCAB, Storage.keys.COLLOCATION, Storage.keys.RECORDS].includes(key) && !Array.isArray(value)) throw new Error('학습 또는 전투 기록 형식이 잘못되었습니다.');
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
          for (const key of this.backupKeys()) previous.set(key, localStorage.getItem(key));
          const writes = new Map(Object.entries(safe).map(([key, value]) => [key, key === Storage.keys.FORTUNE_LAST_USED ? value : JSON.stringify(value)]));
          for (const [key, raw] of writes) localStorage.setItem(key, raw);
          for (const [key, raw] of writes) {
            if (localStorage.getItem(key) !== raw) throw new Error(`Failed to verify imported key: ${key}`);
          }
          try { sessionStorage.setItem('astraImportNotice', '기록을 가져왔습니다. 메모리를 새 기록으로 다시 불러왔어요. 직접 선택한 초상화 파일은 다시 연결해주세요.'); } catch { /* Reload still protects in-memory state. */ }
          location.reload();
        } catch {
          for (const [key, raw] of previous) {
            try { if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw); } catch { /* Report failure below. */ }
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
      const active = [...document.querySelectorAll('.modal.active')].sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex));
      const next = active.at(-1) || null;
      for (const modal of active) if (!previousActive.has(modal)) returns.set(modal, document.activeElement);
      for (const modal of document.querySelectorAll('.modal')) {
        modal.inert = modal.classList.contains('active') && modal !== next;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (!modal.hasAttribute('aria-label') && !modal.hasAttribute('aria-labelledby')) {
          const heading = modal.querySelector('h2,h3');
          if (heading && !heading.id) heading.id = `${modal.id}-heading`;
          if (heading) modal.setAttribute('aria-labelledby', heading.id);
        }
      }
      const revealOpen = this.$('dw-reveal').classList.contains('is-open');
      for (const el of document.querySelectorAll('.dw-top,main,.astra-nav')) el.inert = !!next || revealOpen;
      if (next) this.closeGradeMenu();
      if (next !== top) {
        if (next) {
          const opener = top && returns.get(top);
          const target = previousActive.has(next) && next.contains(opener) ? opener : focusable(next)[0];
          (target || next.querySelector('.modal-content'))?.focus({ preventScroll:true });
        } else if (top) {
          let target = returns.get(top);
          const visited = new Set();
          while (target?.closest('.modal') && !target.getClientRects().length && !visited.has(target)) {
            visited.add(target);
            target = returns.get(target.closest('.modal'));
          }
          if (target?.isConnected && target.getClientRects().length && !target.closest('[inert]')) target.focus({ preventScroll:true });
        }
        top = next;
      }
      previousActive = new Set(active);
      if (!next) {
        // Badges follow the result of any dialog (fortune cookie, claims, blessings, quizzes).
        this.refreshDots();
        if (this.inRun() && ['menu', 'summon'].includes(document.body.dataset.screen)) {
          this.renderBlessBadge(); this.renderTicketCount(); this.updateHeader();
          if (document.body.dataset.screen === 'summon') this.renderSummonControls();
          else this.renderParty();
        }
      }
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target.classList?.contains('modal'))) sync();
    });
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['class'] });
    document.addEventListener('pointerdown', event => {
      const menu = this.$('dw-grade-menu');
      if (!menu.hidden && !menu.contains(event.target) && event.target !== this.gradeMenuFor && !this.gradeMenuFor?.contains(event.target)) this.closeGradeMenu();
    }, true);
    window.addEventListener('resize', () => this.closeGradeMenu());
    document.addEventListener('keydown', event => {
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
      const menu = this.$('dw-grade-menu');
      if (!menu.hidden) {
        const items = [...menu.querySelectorAll('button')];
        const index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') { event.preventDefault(); const owner = this.gradeMenuFor; this.closeGradeMenu(); owner?.focus(); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        }
        if (event.key === 'Tab') this.closeGradeMenu();
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
    let theme = 'strawberry';
    try { theme = localStorage.getItem('dreamweaverTheme') || theme; } catch { /* Use default. */ }
    this.setTheme(theme);
    this.installMotion();
    this.installChatViewport();
    this.hook('syncGameFullscreenButton', this.syncFullscreenShortcut);
    RPG.syncGameFullscreenButton();
    if (!RPG._featuresInstalled) throw new Error('DREAMWEAVER requires installed Card feature modules.');
    this.setupCardModal();
    this.setupSystemMenu();
    this.setupTypeSelect();
    this.setupModeSelect();
    this.setupBlessing();
    this.setupSheetHead('modal-mission-hub', '미션', () => RPG.closeMissionHub()).querySelector(':scope > button[onclick="RPG.closeMissionHub()"]')?.remove();
    this.installAlerts();
    this.installBattleRuntime();
    this.hook('setupControls', this.markShortSkills);
    this.hook('showScreen', this.screenChanged);
    this.hook('showCardInfo', this.decorateCardInfo);
    this.hook('toMenu', this.renderParty);
    this.hook('renderMissionView', this.decorateMissionReward);
    this.hook('renderMissionHub', this.decorateMissionHub);
    this.hook('updateSystemMenuUI', this.syncSystemMenu);
    this.hook('renderBattlefield', () => this.safely(() => { this.renderBattleStatuses(); this.renderBattleHud(); }));
    this.hook('runGacha', this.afterGacha);
    this.hook('spinChaosRoulette', () => this.afterGacha());
    this.hook('log', message => this.safely(() => this.onBattleLog(message)));
    // Slot views are owned here so placing a card never rebuilds unchanged portraits.
    RPG.updateDeckSlots = () => this.renderDeckSlots();
    RPG.selectDeckSlot = index => { RPG.selectedSlot = index; this.updateSlotSelection(index); };
    this.hook('openInfoModal', this.decorateInfo);
    this.hookBefore('winBattle', () => this.snapshotBattle(true));
    this.hookBefore('loseBattle', () => this.snapshotBattle(false));
    this.hookBefore('startBattleInit', () => {
      this.hpMemory.clear();
      this.battleSnapshot = null;
      this.battleCue = { type:'phy', crit:0, enemyTurn:-1 };
      this.calloutQueue = [];
      this.fieldShown = [];
      this.$('dw-callouts').replaceChildren();
      this.$('dw-fxlayer').replaceChildren();
    });
    this.hook('openDeck', () => {
      const empty = RPG.state.deck.indexOf(null);
      RPG.selectDeckSlot(empty >= 0 ? empty : 0);
      this.renderDeckSlots();
    });
    this.hook('openModeSelect', () => {
      this.decorateModes();
      this.$('btn-hard-mode').setAttribute('aria-pressed', 'false');
    });
    this.hook('toggleHardMode', () => {
      const button = this.$('btn-hard-mode');
      button.removeAttribute('style');
      button.style.display = 'block';
      button.setAttribute('aria-pressed', String(RPG.hardModeActive));
    });
    this.hook('openChaosBlessing', () => {
      const artifact = this.$('btn-artifact-check');
      if (artifact) { const display = artifact.style.display; artifact.removeAttribute('style'); artifact.style.display = display; }
    });
    RPG.renderCardList = (containerId, list, callback) => this.renderCards(containerId, list, callback);
    RPG.openCollection = () => this.openCollection();
    RPG.openFactoryViewDeck = () => this.openFactoryViewDeck();
    RPG.openLibrary = () => this.learn();
    this.hookDoubleConfirmed('reshuffleChaosPool', this.renderParty);
    this.$('card-search').addEventListener('input', () => this.renderCollection());
    this.$('card-grade').addEventListener('change', () => { this.collectionGrade = this.$('card-grade').value; this.renderCollection(); });
    this.$('asset-path-form').addEventListener('submit', event => { event.preventDefault(); this.setPortraitPath(this.$('asset-path').value); });
    this.$('portrait-files').addEventListener('change', event => this.selectPortraitFiles(event.target.files));
    this.$('astra-import').addEventListener('change', event => this.importFile(event.target.files[0]));
    const importLabel = document.querySelector('.file-label');
    importLabel.tabIndex = 0;
    importLabel.setAttribute('role', 'button');
    importLabel.addEventListener('keydown', event => {
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
document.addEventListener('DOMContentLoaded', () => Astra.init());
