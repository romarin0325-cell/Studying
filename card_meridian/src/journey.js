'use strict';

const Meridian = {
  positions: ['선봉', '중견', '대장'],
  $(id) { return document.getElementById(id); },
  stage() { return Number(RPG.state.enemyScale) + 1; },
  stageLabel(stage) { return String(stage).padStart(2, '0'); },
  filled() { return RPG.state.deck.filter(id => id && RPG.getCardData(id)).length; },

  title() {
    this.encounter = null;
    this.partyEdited = false;
    const record = Storage.loadDetailed(Storage.keys.SAVE);
    const hasRecord = record.reason !== 'missing';
    const data = record.ok ? record.data : null;
    this.$('md-start-label').textContent = hasRecord ? '여정 이어가기' : '첫 여정 시작';
    const stage = Number(data?.enemyScale);
    this.$('md-start-note').textContent = Number.isFinite(stage) && data
      ? (Astra.modeNames[data.mode] || '여정') + ' · 스테이지 ' + this.stageLabel(stage + 1)
      : hasRecord ? '저장 기록 불러오기' : '오리진 · 엔드리스';
    this.$('btn-start-new').textContent = hasRecord ? '새 여정' : '모드 선택';
    this.$('btn-start-load').onclick = () => {
      if (hasRecord || Storage.loadDetailed(Storage.keys.SAVE).reason !== 'missing') RPG.startGame('load');
      else this.firstJourney();
    };
  },

  firstJourney() {
    // Let the engine validate data, load the account, and process attendance.
    RPG.startGame('new');
    const picker = this.$('modal-type-select');
    if (!picker.classList.contains('active')) return;
    picker.classList.remove('active');
    RPG.tempGameType = 'endless';
    RPG.selectedModeId = 'origin';
    RPG.hardModeActive = false;
    this.startMode('origin');
  },

  startMode(mode) {
    this.starting = true;
    try {
      if (RPG.initNewGame(mode) === false) return;
      this.$('modal-mode-select').classList.remove('active');
      if (!['factory','artifact_reserve','perfect_plan'].includes(mode)) RPG.toMenu();
    } finally { this.starting = false; }
  },

  backToTypes() {
    this.$('modal-mode-select').classList.remove('active');
    this.$('modal-type-select').classList.add('active');
  },

  modeBrowser() {
    const kind = RPG.tempGameType === 'challenge' ? '도전 모드' : '엔드리스';
    this.$('md-mode-kind').textContent = kind;
    const filters = this.$('md-mode-groups');
    filters.replaceChildren();
    const list = this.$('mode-list');
    const choices = [...list.querySelectorAll('button')];
    const groups = new Map();
    for (const choice of choices) {
      const id = choice.id.slice('mode-btn-'.length);
      const group = ['chaos','artifact_chaos','draft','factory','artifact_reserve','perfect_plan'].includes(id)
        ? '파티 빌딩' : ['archive','puzzle','dream_corridor'].includes(id) ? '학습' : '전투';
      choice.dataset.group = group;
      groups.set(group, (groups.get(group) || 0) + 1);
    }
    const filter = group => {
      for (const button of filters.children) button.setAttribute('aria-pressed', String(button.dataset.group === group));
      for (const choice of choices) choice.hidden = choice.dataset.group !== group;
      list.scrollTop = 0;
      choices.find(choice => !choice.hidden && !choice.disabled)?.click();
    };
    for (const group of ['전투','파티 빌딩','학습']) {
      if (!groups.has(group)) continue;
      const button = Astra.text('button', group);
      button.dataset.group = group;
      button.onclick = () => filter(group);
      filters.append(button);
    }
    filter(filters.firstElementChild.dataset.group);
    this.$('btn-enter-mode').onclick = () => {
      const mode = RPG.selectedModeId;
      if (!mode) return;
      const previous = Storage.loadDetailed(Storage.keys.SAVE);
      if (previous.reason === 'missing') return this.startMode(mode);
      const oldMode = Astra.modeNames[previous.data?.mode];
      const scale = previous.data?.enemyScale;
      const old = oldMode && Number.isSafeInteger(scale) ? oldMode + ' · 스테이지 ' + (scale + 1) : '현재 여정';
      RPG.showConfirm(old + '의 저장 기록을 교체하고 ' + (Astra.modeNames[mode] || '선택한 모드') + ' 여정을 시작할까요?', () => this.startMode(mode));
    };
  },

  nextAction() {
    const state = RPG.state;
    const filled = this.filled();
    if (state.mode === 'factory' && state.factoryDraft?.active)
      return {kind:'factory', title:'카드풀 구성 계속', note:'번들을 선택해 이번 여정의 카드풀을 완성하세요.'};
    if (state.mode === 'artifact_reserve' && state.artifactReserveDraft?.active)
      return {kind:'reserve', title:'아티팩트 선택 계속', note:'출전에 사용할 아티팩트 세트를 선택하세요.'};
    if (state.mode === 'perfect_plan' && state.perfectPlanDraft?.active)
      return {kind:'plan', title:'카드 선택 계속', note:'이번 여정의 전용 카드풀을 완성하세요.'};
    if (state.mode === 'puzzle' && !state.puzzlePiecesClaimed)
      return {kind:'puzzle', title:'퍼즐 조각 획득', note:'단어 퀴즈로 이번 여정의 동료를 모으세요.'};
    if (filled && (state.mode !== 'puzzle' || filled === 3))
      return {kind:'battle', title:'전투 출전', note:''};
    if (state.mode === 'draft') return {kind:'draft', title:'드래프트 시작', note:'후보 중 세 명을 선발하세요.'};
    if (state.inventory.length) return {kind:'deck', title:'동료 편성', note:state.mode === 'puzzle'
      ? '퍼즐 전투에는 동료 세 명이 필요합니다.' : '보유한 동료를 출전 자리에 배치하세요.'};
    if (state.tickets >= GAME_CONSTANTS.COSTS.GACHA_SINGLE)
      return {kind:'summon', title:'첫 동료 소환', note:'소환 티켓 ' + GAME_CONSTANTS.COSTS.GACHA_SINGLE + '장으로 동료를 만납니다.'};
    if ((state.greatSageBlessingUses ?? GAME_CONSTANTS.DEFAULT_BLESSING_USES) > 0)
      return {kind:'blessing', title:'축복의 제단', note:'대현자의 문법 퀴즈로 소환 티켓을 얻을 수 있어요.'};
    return {kind:'title', title:'여정 선택으로', note:'보유한 동료와 소환 티켓을 모두 사용했습니다.'};
  },

  takeAction() {
    if (document.body.dataset.screen !== 'menu') return;
    switch (this.nextAction().kind) {
      case 'battle': return RPG.startBattleInit();
      case 'summon': return RPG.openGacha();
      case 'deck':
        RPG.openDeck();
        this.departAfterEditing = true;
        this.updateDeckActions();
        return;
      case 'puzzle': return RPG.openPuzzlePieces();
      case 'draft': return RPG.startDraft();
      case 'blessing': return RPG.openChaosBlessing();
      case 'factory': RPG.showScreen('screen-factory-draft'); return RPG.renderFactoryDraftScreen();
      case 'reserve': RPG.showScreen('screen-artifact-reserve-draft'); return RPG.renderArtifactReserveDraftScreen();
      case 'plan': return RPG.openPerfectPlanDraft();
      case 'title': return RPG.toTitle();
    }
  },

  lobby() {
    if (document.body.dataset.screen !== 'menu') return;
    const state = RPG.state;
    const action = this.nextAction();
    const enemy = RPG.getCurrentStageEnemyData();
    const filled = this.filled();
    this.$('astra-stage').textContent = this.stageLabel(this.stage());
    const goal = GameUtils.getClearStage(state.mode, state.gameType);
    this.$('md-goal').hidden = !Number.isFinite(goal);
    this.$('md-goal').textContent = Number.isFinite(goal) ? '/ ' + goal : '';
    this.$('astra-mode').textContent = [Astra.modeNames[state.mode] || state.mode,
      state.gameType === 'challenge' ? '도전' : '엔드리스', state.hardMode ? '하드' : ''].filter(Boolean).join(' · ');
    this.$('next-enemy-text').textContent = enemy.name;
    const preparing = action.kind !== 'battle';
    this.$('next-enemy-preview').classList.toggle('md-preparing', preparing);
    this.$('next-enemy-text').hidden = preparing;
    this.$('md-scout').hidden = preparing;
    this.$('md-prep-title').hidden = !preparing;
    this.$('md-scout').setAttribute('aria-label', enemy.name + ' 상대 정보');
    const img = this.$('next-enemy-img');
    ImageAssets.load(img, enemy, {alt:enemy.name, parent:img.parentElement, toggleParent:true});
    if (img.complete && img.naturalWidth) {
      img.style.display = 'block';
      img.parentElement.style.display = '';
    }
    this.$('astra-depart').querySelector('strong').textContent = action.title;
    this.$('astra-depart-help').textContent = action.note;
    this.$('astra-depart-help').hidden = !action.note;
    this.$('astra-depart').dataset.action = action.kind;
    this.$('ui-tickets').textContent = state.tickets;
    this.$('md-party-count').textContent = filled + ' / 3';
    const lineup = this.$('astra-party');
    lineup.replaceChildren();
    state.deck.slice(0, 3).forEach((id, index) => {
      const card = id && RPG.getCardData(id);
      const slot = Astra.text('button', '', 'md-party-card' + (card ? '' : ' is-empty'));
      slot.setAttribute('aria-label', this.positions[index] + ' · ' + (card?.name || '빈자리') + ' 편성');
      const art = card ? ImageAssets.createPortrait(card) : Astra.text('span', '', 'md-empty-art');
      if (!card) art.append(Astra.icon('plus'));
      slot.append(art, Astra.text('small', this.positions[index]), Astra.text('strong', card?.name || '빈자리'));
      slot.onclick = () => { RPG.openDeck(); RPG.selectDeckSlot(index); };
      lineup.append(slot);
    });
    this.updateRecruit();
    if (this.partyEdited || this.encounter && RPG.battle.isFinished) {
      this.partyEdited = false;
      this.encounter = null;
      RPG.saveGame(false);
    }
  },

  updateRecruit() {
    const {mode, tickets, puzzlePiecesClaimed} = RPG.state;
    const draft = mode === 'draft';
    const chaos = RPG.isChaosPoolMode(mode);
    const puzzle = mode === 'puzzle';
    const cost = GAME_CONSTANTS.COSTS.GACHA_SINGLE;
    this.$('md-recruit-heading').textContent = draft ? '동료 선발' : chaos ? '카오스 카드풀' : puzzle ? '퍼즐 소환' : '동료 소환';
    this.$('md-recruit-cost').textContent = draft || chaos || puzzle ? '' : '1회 · 티켓 ' + cost + '장';
    if (draft) {
      const draw = this.$('menu-draft-area').querySelector('button');
      const filled = this.filled();
      draw.disabled = filled === 3;
      draw.textContent = filled === 3 ? '동료 선발 완료' : filled ? '남은 동료 선발' : '드래프트 시작';
    }
    if (chaos) {
      const shuffle = this.$('menu-chaos-area').lastElementChild;
      const price = GAME_CONSTANTS.COSTS.CHAOS_SHUFFLE;
      shuffle.disabled = tickets < price;
      shuffle.textContent = '카드풀 셔플 · 티켓 ' + price + '장';
    }
    const normal = this.$('btn-normal-gacha');
    normal.textContent = puzzle ? (puzzlePiecesClaimed ? '조각 획득 완료' : '퍼즐 조각 획득') : '일반 소환';
    normal.disabled = puzzle ? !!puzzlePiecesClaimed : tickets < cost;
    const challenge = this.$('btn-challenge-gacha');
    challenge.textContent = '퀴즈 소환';
    challenge.disabled = tickets < cost;
    if (typeof CardChainChallenge !== 'undefined' && CardChainChallenge.ready) CardChainChallenge.sync();
  },

  placeCard(id, index) {
    if (index < 0 || index >= 3) { RPG.showAlert('교체할 자리를 선택하세요.'); return false; }
    const held = RPG.state.inventory.filter(card => card === id).length;
    const usedElsewhere = RPG.state.deck.filter((card, slot) => slot !== index && card === id).length;
    if (held <= usedElsewhere) { RPG.showAlert('이 카드의 보유 수량을 모두 편성했습니다.'); return false; }
    RPG.state.deck[index] = id;
    this.partyEdited = true;
    return true;
  },

  openDeck() {
    this.departAfterEditing = false;
    RPG.showScreen('screen-deck');
    RPG.updateDeckSlots();
    const empty = RPG.state.deck.findIndex(id => !id);
    RPG.selectedSlot = empty;
    RPG.renderCardList('deck-card-list', RPG.state.inventory, id => {
      const index = RPG.selectedSlot;
      if (!this.placeCard(id, index)) return;
      RPG.updateDeckSlots();
      const next = RPG.state.deck.findIndex(card => !card);
      RPG.selectDeckSlot(next >= 0 ? next : index);
    });
    if (empty >= 0) RPG.selectDeckSlot(empty);
    else this.$('deck-hint').textContent = '교체할 자리를 먼저 선택하세요.';
    if (!RPG.state.inventory.length) {
      this.$('ae-deck-empty').textContent = '보유한 동료가 없습니다. 여정에서 첫 동료를 소환하세요.';
      this.$('ae-deck-empty').hidden = false;
    }
    this.updateDeckActions();
  },

  updateDeckActions() {
    if (document.body.dataset.screen !== 'deck') return;
    const confirm = this.$('md-confirm-deck');
    confirm.textContent = this.departAfterEditing ? '편성 후 출전' : '편성 완료';
    const filled = this.filled();
    confirm.disabled = !filled || RPG.state.mode === 'puzzle' && filled < 3;
    this.$('md-clear-slot').disabled = !RPG.state.deck[RPG.selectedSlot];
    const recruit = this.$('md-deck-recruit');
    recruit.hidden = RPG.state.inventory.length > 0;
    if (!recruit.hidden) {
      const action = this.nextAction();
      this.$('ae-deck-empty').textContent = '이번 여정에 보유한 동료가 없습니다.';
      recruit.textContent = action.title + (action.kind === 'summon' ? ' · 티켓 ' + GAME_CONSTANTS.COSTS.GACHA_SINGLE + '장' : '');
      recruit.onclick = () => { RPG.toMenu(); this.takeAction(); };
    }
  },

  confirmParty() {
    const depart = this.departAfterEditing;
    RPG.confirmDeck();
    if (depart && document.body.dataset.screen === 'menu' && !document.querySelector('.modal.active') &&
      this.nextAction().kind === 'battle') RPG.startBattleInit();
  },

  showSummon(challenge) {
    const card = RPG.getCardData(RPG.state.inventory.at(-1));
    RPG.saveGame(false);
    if (typeof CardChainChallenge !== 'undefined' && CardChainChallenge.settling) return;
    const modal = this.$('modal-gacha');
    if (!card || !modal.classList.contains('active')) return;
    this.summon = {id:card.id, challenge};
    modal.classList.add('md-single');
    const result = this.$('gacha-result');
    result.replaceChildren();
    const frame = Astra.text('div', '', 'md-reveal-frame');
    frame.append(ImageAssets.createPortrait(card));
    const facts = Astra.text('div', '', 'md-pull-facts');
    facts.append(Astra.text('small', [Astra.gradeNames[card.grade], Astra.elementNames[card.element], Astra.roleNames[card.role]].filter(Boolean).join(' · ')),
      Astra.text('h3', card.name), Astra.text('p', '이번 여정 ' + RPG.state.inventory.filter(id => id === card.id).length + '장 보유'));
    result.append(frame, facts);
    this.$('gacha-title').textContent = challenge ? '퀴즈 소환' : '동료 소환';
    const row = this.$('md-pull-actions');
    row.hidden = false;
    const empty = RPG.state.deck.findIndex(id => !id);
    this.$('md-equip').textContent = empty >= 0 ? this.positions[empty] + '에 편성' : '교체할 자리 선택';
    const repeat = this.$('md-repeat');
    repeat.hidden = RPG.state.tickets < GAME_CONSTANTS.COSTS.GACHA_SINGLE || RPG.state.mode === 'puzzle' && !challenge;
    repeat.replaceChildren(Astra.text('strong', challenge ? '퀴즈 재도전' : '한 번 더 소환'),
      Astra.text('small', '티켓 ' + GAME_CONSTANTS.COSTS.GACHA_SINGLE + '장'));
    this.lobby();
  },

  repeatSummon() {
    if (!this.summon || RPG.state.tickets < GAME_CONSTANTS.COSTS.GACHA_SINGLE) return;
    const challenge = this.summon.challenge;
    RPG.closeGachaModal();
    if (challenge) RPG.openChallengeGacha();
    else RPG.openGacha();
  },

  equipSummon(chosen) {
    if (!this.summon) return;
    const index = chosen ?? RPG.state.deck.findIndex(id => !id);
    if (index < 0) {
      if (this.$('md-slot-picker')) return;
      const picker = Astra.text('div', '', 'md-slot-picker');
      picker.id = 'md-slot-picker';
      RPG.state.deck.forEach((id, slot) => {
        const button = Astra.text('button', '', 'md-outline');
        button.append(Astra.text('small', this.positions[slot]), Astra.text('strong', RPG.getCardData(id).name));
        button.onclick = () => this.equipSummon(slot);
        picker.append(button);
      });
      this.$('md-pull-actions').before(picker);
      picker.firstChild.focus();
      return;
    }
    if (!this.placeCard(this.summon.id, index)) return;
    RPG.closeGachaModal();
    RPG.toMenu();
    this.$('astra-party').children[index]?.classList.add('md-arrived');
  },

  resetSummon() {
    this.summon = null;
    this.$('modal-gacha').classList.remove('md-single');
    this.$('md-slot-picker')?.remove();
    this.$('md-pull-actions').hidden = true;
  },

  battleStarted() {
    this.encounter = {stage:this.stage(), tickets:RPG.state.tickets};
    this.$('md-battle-stage').textContent = 'STAGE ' + this.stageLabel(this.stage());
  },

  scout() {
    const enemy = buildBattleEnemy(RPG);
    RPG.openInfoModal(enemy.name + ' · 상대 정보', '');
    const box = this.$('info-content');
    const summary = Astra.text('div', '', 'md-scout-summary');
    const stats = Astra.text('dl', '', 'md-scout-stats');
    for (const [label,value] of [['HP',enemy.maxHp],['물리 공격',enemy.atk],['마법 공격',enemy.matk],['물리 방어',enemy.def],['마법 방어',enemy.mdef]]) {
      stats.append(Astra.text('dt',label),Astra.text('dd',String(value)));
    }
    summary.append(ImageAssets.createPortrait(RPG.getCurrentStageEnemyData()),stats);
    box.append(summary);
    box.insertAdjacentHTML('beforeend', enemy.skills.map(skill => SkillDisplay.html(skill,{entity:enemy,enemy:true})).join(''));
  },

  showSkills() {
    const player = RPG.battle.players[RPG.battle.currentPlayerIdx];
    if (!player) return;
    const skills = [RPG.NORMAL_ATTACK, ...(player.skills || player.proto.skills)];
    RPG.openInfoModal(player.name + ' · 스킬 설명', skills.map(skill => SkillDisplay.html(skill,{entity:player.proto})).join(''));
  },

  victory(extra, clear) {
    // The original result callback opens the mode-specific optional bonus.
    // Mandatory archive questions, final clears and their rewards own their screens.
    if (clear || !this.encounter || RPG.state.mode === 'archive' ||
      !this.$('modal-info').classList.contains('active') || this.$('info-title').textContent !== '전투 결과') return;
    const report = this.$('info-content').innerHTML.replace(/^승리!<br\s*\/?>(보상을 획득했습니다\.)?(<br\s*\/?>)*/i, '');
    RPG.closeInfoModal();
    const confirm = this.$('modal-confirm');
    if (!confirm.classList.contains('active')) return;
    this.reward = {accept:this.$('confirm-yes').onclick, decline:this.$('confirm-no').onclick};
    this.$('md-win-stage').textContent = 'STAGE ' + this.stageLabel(this.encounter.stage) + '  /  승리';
    this.$('md-win-name').textContent = RPG.battle.enemy.name + ' 격파';
    const earned = RPG.state.tickets - this.encounter.tickets;
    this.$('md-win-tickets').textContent = '+' + earned + '장';
    this.$('md-win-extra').innerHTML = report || extra || '';
    ImageAssets.hydrate(this.$('md-win-extra'));
    this.$('md-win-offer').textContent = this.$('confirm-msg').textContent.replace(/\s+/g, ' ').trim();
    const ready = this.nextAction().kind === 'battle';
    this.$('md-win-next').hidden = !ready;
    this.$('md-win-next').querySelector('strong').textContent = '스테이지 ' + this.stageLabel(this.stage()) + ' 출전';
    this.$('md-win-home').textContent = ready ? '여정으로' : '다음 전투 준비';
    confirm.classList.remove('active');
    this.$('modal-voyage-result').classList.add('active');
    RPG.saveGame(false);
  },

  resolveVictory(choice) {
    const reward = this.reward;
    if (!reward) return;
    this.reward = null;
    this.$('modal-voyage-result').classList.remove('active');
    if (choice === 'quiz') return reward.accept();
    reward.decline();
    if (choice === 'next' && document.body.dataset.screen === 'menu' &&
      !document.querySelector('.modal.active') && this.nextAction().kind === 'battle') RPG.startBattleInit();
  },

  init() {
    const alert = RPG.showAlert;
    RPG.showAlert = function (message, ...args) {
      if (message === '불러오기 완료' || message === '저장되었습니다.' && Meridian.starting) return;
      if (message === '저장되었습니다.') return Astra.toast(message);
      return alert.call(this, message, ...args);
    };
    Astra.hook('showBattleScreen', () => this.battleStarted());
    Astra.hook('openModeSelect', () => this.modeBrowser());
    Astra.hook('applyGreatSageBlessing', () => this.lobby());
    Astra.hook('updateDeckSlots', () => this.updateDeckActions());
    Astra.hook('selectDeckSlot', () => this.updateDeckActions());
    Astra.hook('finishWinBattle', (extra, clear) => this.victory(extra, clear));
    Astra.hook('closeGachaModal', () => this.resetSummon());
    Astra.hook('spinChaosRoulette', () => this.resetSummon());
    const challenge = RPG.openChallengeGacha;
    RPG.openChallengeGacha = function (...args) {
      const tickets = this.state.tickets;
      const result = challenge.apply(this, args);
      if (this.state.tickets !== tickets) {
        this.saveGame(false);
        Meridian.lobby();
      }
      return result;
    };
    this.ready = true;
  }
};
document.addEventListener('DOMContentLoaded', () => Meridian.init());
