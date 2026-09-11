/* Presentation adapter. Game rules and learning content are owned by card/game/.
   Every hook calls the original method unless this file owns its entire view. */
'use strict';

const Astra = {
  ready: false,
  allCards: false,
  collectionContext: 'library',
  localPortraits: new Map(),
  portraitPath: '',
  modalStack: [],
  elementNames: { fire:'불', water:'물', nature:'자연', wind:'바람', light:'빛', dark:'어둠', earth:'대지', normal:'무속성' },
  roleNames: { dealer:'공격', balancer:'균형', buffer:'지원', debuffer:'약화', looter:'수집', tank:'방어', healer:'회복' },
  gradeNames: { legend:'전설', epic:'영웅', rare:'희귀', normal:'일반', transcendence:'초월', event:'이벤트', special:'스페셜' },
  modeNames: { origin:'오리진', draft:'드래프트', chaos:'카오스', artifact:'아티팩트', artifact_chaos:'아티팩트 카오스', artifact_reserve:'아티팩트 리저브', factory:'팩토리', perfect_plan:'퍼펙트플랜', puzzle:'퍼즐', archive:'아카이브', dream_corridor:'꿈의 회랑' },

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
  hook(name, after) {
    const original = RPG[name];
    if (typeof original !== 'function') throw new Error(`Missing Card API: ${name}`);
    RPG[name] = function (...args) {
      const result = original.apply(this, args);
      after.apply(Astra, args);
      return result;
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
  home() {
    if (!this.ready || document.body.dataset.screen === 'battle' || document.body.dataset.screen === 'draft') return;
    if (document.body.dataset.screen === 'title') return;
    RPG.toMenu();
  },
  learn() { RPG.showScreen('screen-study'); },
  settings() {
    if (!this.ready) return;
    this.$('asset-path').value = this.portraitPath;
    const gameMenu = document.querySelector('.settings-grid button');
    gameMenu.disabled = document.body.dataset.screen === 'title';
    gameMenu.textContent = gameMenu.disabled ? '게임 메뉴 (여정 진입 후)' : '게임 메뉴 · 저장 · 기록';
    this.$('modal-astra-settings').classList.add('active');
  },
  closeSettings() { this.$('modal-astra-settings').classList.remove('active'); },
  toast(message) {
    const toast = this.$('astra-toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
  },

  // This emblem is deliberately a card back, never a generated replacement
  // portrait. Native image loading still resolves each exact original filename.
  fallback(entity) {
    const color = { fire:'#d8a999', water:'#a5dfff', nature:'#b5d6bd', light:'#e7ca94', dark:'#bdb5dd' }[entity?.element] || '#a5dfff';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240"><g fill="none" stroke="${color}"><path opacity=".25" d="M90 15 162 60v120l-72 45-72-45V60Z"/><path opacity=".2" d="M90 32 145 68v104l-55 36-55-36V68Z"/><circle cx="90" cy="120" r="46" opacity=".35"/><path stroke-width="1.5" d="m90 68 14 38 38 14-38 14-14 38-14-38-38-14 38-14Z"/><path opacity=".65" fill="${color}" fill-opacity=".12" d="m90 88 11 32-11 32-11-32Z"/><path opacity=".5" d="M56 58h12m44 0h12M56 182h12m44 0h12M90 45v9m0 132v9"/></g></svg>`;
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
          delete img.dataset.fallback;
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
    this.renderParty();
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
  screenChanged(id) {
    const kind = id.replace('screen-', '');
    if (kind !== 'collection' && this.collectionContext === 'factory') {
      this.collectionContext = 'library';
      delete document.body.dataset.collectionContext;
    }
    document.body.dataset.screen = ['title','menu','collection','deck','study','battle'].includes(kind) ? kind : 'draft';
    document.querySelectorAll('[data-nav]').forEach(button => {
      if (button.dataset.nav === kind) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    const names = { title:'꿈을 엮는 기록실', menu:'로비 / 여정', deck:'파티 편성', collection:'카드 도감', study:'배움의 기록실', battle:'전투 진행 중' };
    const status = document.querySelector('.header-status');
    if (status) status.textContent = names[kind] || '새로운 조합을 선택하세요';
    if (kind === 'title') {
      this.$('modal-menu').classList.remove('active');
      const hasSave = Storage.loadDetailed(Storage.keys.SAVE).reason !== 'missing';
      const start = this.$('btn-start-load');
      start.replaceChildren();
      const label = this.text('span',hasSave ? '여정 이어가기' : '여정 시작하기');
      label.append(this.text('small',hasSave ? 'CONTINUE' : 'BEGIN YOUR JOURNEY'));
      start.append(label,this.icon('arrow'));
      start.onclick = () => RPG.startGame(hasSave ? 'load' : 'new');
      this.$('btn-start-new').hidden = !hasSave;
    }
    document.querySelector('.header-tools button[aria-label="설정"]').disabled = document.body.dataset.screen === 'battle' || document.body.dataset.screen === 'draft';
  },
  renderParty() {
    const box = this.$('astra-party');
    box.replaceChildren();
    const slots = ['선봉','중견','대장'];
    const positions = ['Ⅰ','Ⅱ','Ⅲ'];
    RPG.state.deck.slice(0, 3).forEach((id, index) => {
      const card = id ? RPG.getCardData(id) : null;
      const button = document.createElement('button');
      button.className = `party-card${card ? '' : ' empty'}`;
      button.setAttribute('aria-label', `${slots[index]}: ${card?.name || '비어 있음'}, 편성하기`);
      button.onclick = () => { RPG.openDeck(); RPG.selectDeckSlot(index); };
      button.append(this.text('span', `${positions[index]} / ${slots[index]}`, 'party-position'));
      button.append(ImageAssets.createPortrait(card || ''));
      button.append(this.text('strong', card?.name || '동료를 기다려요'));
      button.append(this.text('small', card ? `${this.elementNames[card.element] || card.element} · ${this.roleNames[card.role] || card.role}` : '카드를 선택하세요'));
      box.append(button);
    });
    const filled = RPG.state.deck.filter(id => id && RPG.getCardData(id)).length;
    this.$('astra-party-note').textContent = filled ? `${filled}명의 동료가 함께하고 있어요. 자리를 눌러 편성하세요.` : '먼저 동료를 소환하고, 함께할 파티를 꾸려보세요.';
    this.$('astra-depart-help').textContent = filled ? '준비가 끝났다면, 다음 장으로.' : '소환 → 파티 편성 → 전투 출전';
    this.$('astra-depart').disabled = !filled;
    this.$('astra-stage').textContent = String(RPG.state.enemyScale + 1).padStart(2, '0');
    this.$('astra-mode').textContent = this.modeNames[RPG.state.mode] || RPG.state.mode;
    const enemy = RPG.getCurrentStageEnemyData();
    this.$('next-enemy-text').textContent = enemy.name;
    const quiz = RPG.state.quiz_stats || {correct:0,total:0};
    this.$('astra-study-note').textContent = quiz.total ? `이번 여정 ${quiz.correct} / ${quiz.total} 정답` : '단어 · 문법 · TOEIC';
  },
  cardButton(card, count, onClick) {
    const button = document.createElement('button');
    button.className = `card-item ${card.grade}${count ? '' : ' unowned'}`;
    button.dataset.cardId = card.id;
    button.setAttribute('aria-label', `${card.name}, ${this.gradeNames[card.grade] || card.grade}, ${count ? `${count}장 보유` : '미보유'}`);
    button.append(ImageAssets.createPortrait(card));
    button.append(this.text('span', this.gradeNames[card.grade] || card.grade, 'card-grade'));
    button.append(this.text('span', card.name, 'card-name'));
    const meta = this.text('span','', 'card-meta');
    meta.append(this.text('span', this.elementNames[card.element] || card.element));
    meta.append(this.text('span', count ? `×${count}` : '미보유'));
    button.append(meta);
    button.onclick = onClick;
    return button;
  },
  renderCards(containerId, list, clickHandler) {
    const box = this.$(containerId);
    box.replaceChildren();
    const counts = new Map();
    for (const id of list) counts.set(id,(counts.get(id)||0)+1);
    for (const id of RPG.sortCardIdsByGrade([...counts.keys()])) {
      const card = RPG.getCardData(id);
      if (card) box.append(this.cardButton(card, counts.get(id), () => clickHandler(id)));
    }
  },
  renderCollection() {
    const counts = new Map();
    for (const id of RPG.state.inventory) counts.set(id,(counts.get(id)||0)+1);
    const source = this.allCards ? GameUtils.getAllCards() : [...counts.keys()].map(id => RPG.getCardData(id)).filter(Boolean);
    const cards = new Map(source.map(card => [card.id,card]));
    const query = this.$('card-search').value.trim().toLocaleLowerCase();
    const grade = this.$('card-grade').value;
    const filtered = [...cards.values()].filter(card => (grade === 'all' || card.grade === grade)
      && `${card.name} ${card.element} ${card.role} ${this.elementNames[card.element] || ''} ${this.roleNames[card.role] || ''}`.toLocaleLowerCase().includes(query));
    const box = this.$('collection-grid');
    box.replaceChildren();
    const byId = new Map(filtered.map(card => [card.id,card]));
    for (const id of RPG.sortCardIdsByGrade([...byId.keys()])) box.append(this.cardButton(byId.get(id), counts.get(id)||0, () => RPG.showCardInfo(id)));
    this.$('collection-empty').hidden = filtered.length !== 0;
    this.$('collection-count').textContent = `${filtered.length}종`;
    this.$('collection-scope').textContent = this.allCards ? '전체 도감' : '보유 카드';
    this.$('collection-scope').setAttribute('aria-pressed',String(this.allCards));
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
    const pool = draft.pool || [];
    this.collectionContext = 'factory';
    document.body.dataset.collectionContext = 'factory';
    this.$('collection-title').textContent = '현재 구성 중인 덱';
    this.$('collection-count').textContent = `${pool.length}장`;
    this.$('collection-back').textContent = '드래프트로';
    this.$('collection-back').onclick = () => {
      delete document.body.dataset.collectionContext;
      this.collectionContext = 'library';
      RPG.showScreen('screen-factory-draft');
      RPG.renderFactoryDraftScreen();
    };
    RPG.showScreen('screen-collection');
    this.renderCards('collection-grid', pool, id => RPG.showCardInfo(id));
    this.$('collection-empty').hidden = pool.length !== 0;
  },
  renderDeckSlots() {
    ['선봉','중견','대장'].forEach((role, index) => {
      const slot = this.$(`slot-${index}`);
      const card = RPG.state.deck[index] ? RPG.getCardData(RPG.state.deck[index]) : null;
      slot.replaceChildren(ImageAssets.createPortrait(card || ''));
      const text = this.text('span','', 'slot-text');
      text.append(this.text('small', `${index + 1} / ${role}`), this.text('strong', card?.name || '카드 선택'));
      slot.append(text);
      slot.setAttribute('aria-pressed',String(RPG.selectedSlot === index));
      slot.setAttribute('aria-label', `${role} ${card?.name || '빈 자리'}`);
    });
  },
  updateSlotSelection(index) {
    document.querySelectorAll('.deck-slot').forEach((slot, i) => slot.setAttribute('aria-pressed',String(i === index)));
    this.$('deck-hint').textContent = `${['선봉','중견','대장'][index]}에 배치할 카드를 선택하세요`;
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
      this.toast('저장된 기록을 내보냈습니다. 진행 중인 여정은 게임 메뉴에서 먼저 저장하세요.');
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
      RPG.showConfirm('이 파일의 기록을 가져올까요?<br>같은 항목의 현재 저장 기록이 교체됩니다.', () => {
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
      for (const el of document.querySelectorAll('.astra-header,main,.astra-nav')) el.inert = !!next;
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
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target.classList?.contains('modal'))) sync();
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',event => {
      if (!top) return;
      const buttons = focusable(top);
      if (event.key === 'Tab' && buttons.length) {
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
      }
      if (event.key === 'Escape') {
        // Respect application callbacks; never bypass a mandatory quiz or choice.
        const close = buttons.find(el => /^(닫기|취소|아니오)$/.test(el.textContent.trim()));
        if (close) { event.preventDefault(); close.click(); }
      }
    });
    sync();
  },
  init() {
    if (this.ready) return;
    if (!RPG._featuresInstalled) throw new Error('ASTRA requires installed Card feature modules.');
    this.hook('showScreen',this.screenChanged);
    this.hook('toMenu',this.renderParty);
    this.hook('updateDeckSlots',this.renderDeckSlots);
    this.hook('selectDeckSlot',this.updateSlotSelection);
    this.hook('openDeck',() => {
      this.renderDeckSlots();
      this.$('deck-hint').textContent = '자리를 선택하세요';
    });
    this.hook('openModeSelect',() => {
      for (const button of this.$('mode-list').querySelectorAll('button')) {
        button.setAttribute('aria-pressed','false');
        button.addEventListener('click',() => {
          for (const item of this.$('mode-list').querySelectorAll('button')) item.setAttribute('aria-pressed',String(item.id === `mode-btn-${RPG.selectedModeId}`));
        });
      }
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
