/* Astra presentation only. The shared controller owns skills, rewards and saves. */
'use strict';

const AstraEdition = {
  density: 3,
  detailIds: [],
  detailId: null,
  $(id) { return document.getElementById(id); },
  text(tag, value, className) { return Astra.text(tag, value, className); },

  setDensity(value) {
    this.density = value === 4 ? 4 : 3;
    document.body.dataset.density = String(this.density);
    document.querySelectorAll('.ae-density').forEach(button => {
      button.textContent = this.density === 3 ? '4열' : '3열';
      button.setAttribute('aria-label', `카드 목록 ${this.density === 3 ? 4 : 3}열로 보기`);
    });
    try { localStorage.setItem('astraCatalogColumns', String(this.density)); } catch { /* Session preference. */ }
  },
  toggleDensity() { this.setDensity(this.density === 3 ? 4 : 3); },
  collectionScope(all) {
    Astra.allCards = all;
    Astra.renderCollection();
    this.$('collection-grid').scrollTop = 0;
  },
  acquisition(card) {
    const global = RPG.global || {};
    if (card.unlockSource === 'hidden') return {
      permanent: true, open: (global.unlocked_bonus_cards || []).includes(card.id),
      how: '월간 미션 보상'
    };
    if (card.specialCard) return {
      permanent: true, open: (global.unlocked_special_cards || []).includes(card.id),
      how: '시즌 미션 보상'
    };
    if (BONUS_TRANSCENDENCE_CARDS.some(item => item.id === card.id)) return {
      permanent: true, open: (global.unlocked_bonus_transcendence_cards || []).includes(card.id),
      how: '히든 보스 격파 보상'
    };
    if (card.unlockSource === 'bonus' || BONUS_CARDS.some(item => item.id === card.id)) return {
      permanent: true, open: (global.unlocked_bonus_cards || []).includes(card.id),
      how: card.releaseDate && card.releaseDate > RPG.getCurrentDateKey() ? `${card.releaseDate} 공개` : '도전 모드 클리어 보상'
    };
    return { permanent: false, open: true, how: '' };
  },
  decorateCollection() {
    const all = Astra.allCards;
    this.$('ae-tab-run').setAttribute('aria-pressed', String(!all));
    this.$('ae-tab-book').setAttribute('aria-pressed', String(all));
    const unique = new Map(GameUtils.getAllCards().map(card => [card.id, card]));
    const permanent = [...unique.values()].map(card => this.acquisition(card)).filter(state => state.permanent);
    this.$('ae-collection-note').textContent = all
      ? `영구 해금 ${permanent.filter(state => state.open).length} / ${permanent.length} · 카드에서 획득 조건 확인`
      : `이번 여정에 함께하는 동료 ${new Set(RPG.state.inventory).size}종`;
    if (all) for (const button of this.$('collection-grid').querySelectorAll('[data-card-id]')) {
      const state = this.acquisition(RPG.getCardData(button.dataset.cardId));
      if (state.permanent) {
        const badge = this.text('span', state.open ? '해금' : '잠김', 'ae-unlock');
        button.append(badge);
        button.classList.toggle('ae-locked', !state.open);
        button.setAttribute('aria-label', `${button.getAttribute('aria-label')}, ${state.open ? '영구 해금' : '잠김'}, ${state.how}`);
      }
    }
  },
  decorateDeck() {
    const grid = this.$('deck-card-list');
    for (const button of [...grid.querySelectorAll('.card-item')]) {
      const entry = this.text('div', '', 'ae-deck-entry');
      button.before(entry);
      entry.append(button);
      const info = this.text('button', '상세', 'ae-card-info');
      info.type = 'button';
      info.setAttribute('aria-label', `${RPG.getCardData(button.dataset.cardId).name} 상세`);
      info.onclick = () => RPG.showCardInfo(button.dataset.cardId);
      entry.append(info);
    }
    this.syncPlacement();
    this.filterDeck();
  },
  syncPlacement() {
    for (const card of this.$('deck-card-list').querySelectorAll('.card-item')) {
      const positions = RPG.state.deck.map((id, i) => id === card.dataset.cardId ? i + 1 : null).filter(Boolean);
      let badge = card.querySelector('.ae-placement');
      if (positions.length) {
        if (!badge) { badge = this.text('span', '', 'ae-placement'); card.querySelector('.portrait').append(badge); }
        badge.textContent = positions.join(' · ');
        badge.setAttribute('aria-label', `${positions.join(', ')}번 자리에 편성됨`);
      } else badge?.remove();
      card.classList.toggle('ae-placed', positions.length > 0);
    }
  },
  filterDeck() {
    const query = this.$('ae-deck-search').value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const entry of this.$('deck-card-list').children) {
      const card = RPG.getCardData(entry.querySelector('[data-card-id]')?.dataset.cardId);
      if (!card) continue;
      const match = `${card.name} ${Astra.elementNames[card.element]} ${Astra.roleNames[card.role]} ${Astra.gradeNames[card.grade]}`.toLocaleLowerCase().includes(query);
      entry.hidden = !match;
      if (match) visible++;
    }
    this.$('ae-deck-empty').hidden = visible !== 0;
  },
  clearSlot() {
    const index = RPG.selectedSlot;
    if (index < 0 || index > 2) { Astra.toast('먼저 비울 자리를 선택하세요.'); return; }
    RPG.state.deck[index] = null;
    RPG.updateDeckSlots();
    Astra.updateSlotSelection(index);
  },
  decorateDetail(id) {
    const card = RPG.getCardData(id);
    if (!card) return;
    if (!this.paging) {
      const screen = document.querySelector('.screen.active');
      this.detailIds = [...new Set([...screen.querySelectorAll('[data-card-id]')]
        .filter(el => el.getClientRects().length && !el.closest('[hidden]'))
        .map(el => el.dataset.cardId))];
      if (!this.detailIds.includes(id)) this.detailIds = [id];
    }
    this.detailId = id;
    const index = this.detailIds.indexOf(id);
    this.$('ae-card-page').textContent = `${index + 1} / ${this.detailIds.length}`;
    this.$('ae-card-prev').disabled = index <= 0;
    this.$('ae-card-next').disabled = index >= this.detailIds.length - 1;
    const stats = this.$('md-stats');
    stats.replaceChildren();
    for (const [key, label] of [['hp','HP'],['atk','물리 공격'],['matk','마법 공격'],['def','물리 방어'],['mdef','마법 방어']]) {
      const row = this.text('div', '', 'ae-stat');
      row.append(this.text('span', label), this.text('strong', String(card.stats[key])));
      stats.append(row);
    }
    const state = this.acquisition(card);
    const count = RPG.state.inventory.filter(item => item === id).length;
    this.$('ae-card-acquisition').textContent = [count ? `이번 여정 ${count}장 보유` : '이번 여정 미보유',
      state.permanent ? `${state.open ? '영구 해금' : '미해금'} · ${state.how}` : ''].filter(Boolean).join(' / ');
    // SkillDisplay remains the source of truth for every rule, number and description.
    this.$('md-skills').firstElementChild?.classList.add('ae-trait');
    this.$('modal-card').querySelector('.modal-scroll').scrollTop = 0;
  },
  pageCard(direction) {
    const id = this.detailIds[this.detailIds.indexOf(this.detailId) + direction];
    if (!id) return;
    this.paging = true;
    try { RPG.showCardInfo(id); } finally { this.paging = false; }
  },
  decorateBattle() {
    const player = RPG.battle.players[RPG.battle.currentPlayerIdx];
    const enemy = RPG.battle.enemy;
    const number = value => Math.max(0, Math.ceil(Number(value) || 0)).toLocaleString('ko-KR');
    this.$('ae-p-hp').textContent = player ? `${number(player.hp)} / ${number(player.maxHp)}` : '—';
    this.$('ae-p-mp').textContent = player ? `${number(player.mp)} / ${number(player.maxMp || GAME_CONSTANTS.MAX_MP)}` : '—';
    this.$('ae-e-hp').textContent = enemy ? `${number(enemy.hp)} / ${number(enemy.maxHp)}` : '—';
    this.$('ae-active-player').textContent = player ? `${player.name} · ${['선봉','중견','대장'][RPG.battle.currentPlayerIdx]}` : '전투 진행 중';
  },
  decorateControls() {
    for (const button of this.$('battle-controls').querySelectorAll('.skill-btn')) {
      const type = button.dataset.skillType;
      const glyph = this.text('span', type === 'phy' ? '↗' : type === 'mag' ? '✧' : '+', 'ae-skill-icon');
      glyph.setAttribute('aria-hidden', 'true');
      button.prepend(glyph);
    }
  },
  latestLog() {
    const log = this.$('battle-log');
    log.scrollTop = log.scrollHeight;
    this.$('ae-log-follow').hidden = true;
  },
  screenChanged() {
    const state = RPG.state.quiz_stats || { correct: 0, total: 0 };
    this.$('ae-study-progress').textContent = state.total ? `이번 여정 ${state.total}문제 · ${state.correct}문제 정답` : '한 문제씩, 더 넓은 세상으로.';
    if (document.body.dataset.screen === 'deck') {
      this.$('ae-deck-search').value = '';
      this.filterDeck();
    }
  },
  syncLobby() {
    document.body.dataset.partyReady = String(RPG.state.deck.some(id => id && RPG.getCardData(id)));
  },
  init() {
    let density = 3;
    try { density = Number(localStorage.getItem('astraCatalogColumns')) || 3; } catch { /* Default density. */ }
    this.setDensity(density);
    const cardButton = Astra.cardButton.bind(Astra);
    Astra.cardButton = (card, count, click) => {
      const button = cardButton(card, count, click);
      const grade = this.text('span', Astra.gradeNames[card.grade] || card.grade, 'ae-grade');
      const role = this.text('span', Astra.roleNames[card.role] || card.role, 'ae-role');
      button.querySelector('.card-name').after(role);
      button.querySelector('.portrait').append(grade);
      return button;
    };
    const renderCards = Astra.renderCards.bind(Astra);
    Astra.renderCards = (...args) => {
      renderCards(...args);
      if (args[0] === 'deck-card-list') this.decorateDeck();
    };
    const collection = Astra.renderCollection.bind(Astra);
    Astra.renderCollection = () => { collection(); this.decorateCollection(); };
    Astra.hook('showCardInfo', id => this.decorateDetail(id));
    Astra.hook('updateDeckSlots', () => this.syncPlacement());
    Astra.hook('renderBattlefield', () => this.decorateBattle());
    Astra.hook('setupControls', () => this.decorateControls());
    Astra.hook('showScreen', () => this.screenChanged());
    Astra.hook('toMenu', () => this.syncLobby());
    this.$('ae-deck-search').addEventListener('input', () => this.filterDeck());
    this.$('battle-log').addEventListener('scroll', () => {
      const log = this.$('battle-log');
      this.$('ae-log-follow').hidden = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    });
    document.addEventListener('keydown', event => {
      if (!this.$('modal-card').classList.contains('active') || this.$('modal-card').inert) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); this.pageCard(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    this.ready = true;
  }
};
document.addEventListener('DOMContentLoaded', () => AstraEdition.init());
