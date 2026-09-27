import { GameLoop } from '../../core/GameLoop.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../../core/enums.js';
import { BattleSession } from '../../battle/BattleSession.js';
import { allHeroesPlaced } from '../../battle/systems/PlacementSystem.js';
import { getAttackInterval } from '../../battle/systems/BasicAttackSystem.js';
import { getSkillCooldown } from '../../battle/systems/SkillSystem.js';
import { getEffectiveRange } from '../../battle/systems/TargetingSystem.js';
import { placementPreview } from '../../battle/PlacementPreview.js';
import { buffEffects, auraConnections } from '../../battle/systems/AuraSystem.js';
import { ATTACK_FAMILIES, LEVEL_DAMAGE_MULTIPLIERS } from '../../content/combat.js';
import { STATUS_BY_ID } from '../../content/statuses.js';
import { BattleRenderer } from '../../render/BattleRenderer.js';
import { EffectRenderer } from '../../render/EffectRenderer.js';
import { paintPortraits } from '../../render/Illustrations.js';
import { JOURNEYS, HERO_COPY, DEFENSE_LABELS } from '../../content/presentation.js';
import { STAGE_BY_ID } from '../../content/stages.js';
import { ENEMY_BY_ID } from '../../content/enemies.js';

const PHASE_LABELS = Object.freeze({
  PREPARATION: '배치 준비', WAVE_RUNNING: '방어 중', INTERMISSION: '웨이브 사이', VICTORY: '승리', DEFEAT: '패배',
});

function traitOptions(hero, level) {
  return (hero.definition.traits ?? []).filter((trait) => trait.level === level);
}

function buffTotal(hero, effectType) {
  return buffEffects(hero, effectType).reduce((sum, effect) => sum + Number(effect.value), 0);
}

function formatNumber(value, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}

export class BattleScreen {
  constructor({
    stageId,
    difficultyId = 'easy',
    formation,
    checkpoint = null,
    repository,
    assetManager,
    settings,
    audio,
    onSettings,
    onBack,
    onResult,
  } = {}) {
    Object.assign(this, { stageId, difficultyId, formation, checkpoint, repository, assetManager, settings, audio, onSettings, onBack, onResult });
    this.root = null;
    this.session = null;
    this.renderer = null;
    this.effectRenderer = null;
    this.loop = null;
    this.selectedHeroId = formation?.mainId ?? checkpoint?.formation?.mainId;
    this.openSheetHeroId = null;
    this.lastSheetSignature = '';
    this.resizeObserver = null;
    this.resultTimer = null;
    this.audioContext = null;
    this.shakeTimer = null;
    this.boundResize = () => this.#resize();
    this.lastPhase = null;
    this.lastUiAt = 0;
    this.spellAiming = false;
    this.boundVisibility = () => {
      if (this.document.hidden && !this.session.state.paused && this.session.state.phase === BATTLE_PHASE.WAVE_RUNNING) {
        this.session.applyNow('toggle_pause');
        this.#refreshUi(this.session.snapshot());
      }
    };
  }

  mount(root) {
    this.root = root;
    this.document = root.ownerDocument;
    this.document?.documentElement?.classList.add('battle-active');
    this.document?.body?.classList.add('battle-active');
    root.innerHTML = `<section class="screen battle-screen" data-screen="battle">
      <header class="battle-hud">
        <button class="icon-button battle-back" type="button" data-action="back" aria-label="스테이지 선택">‹</button>
        <div class="hud-stat hud-core"><small>♡ 코어</small><strong data-core>10 / 10</strong></div>
        <div class="hud-stat hud-wave"><small>WAVE</small><strong data-wave>준비</strong></div>
        <div class="hud-stat hud-crystals"><small>◆ 꿈의 결정</small><strong data-crystals>0</strong></div>
        <span class="phase-chip" data-phase>배치 준비</span>
        <button class="icon-button" type="button" data-action="settings" aria-label="설정">⚙</button>
      </header>
      <div class="battle-layout">
        <div class="battle-board-shell" data-board-shell>
          <canvas id="battle-canvas" aria-label="수호자 배치와 별의 기원 조준 전장"></canvas>
          <div class="wave-announcement" role="status" data-announcement hidden></div>
          <div class="pause-curtain" data-pause-curtain hidden><span class="eyebrow">잠시 쉬어가요</span><h2>별들이 기다리고 있어요</h2><button class="primary-button" data-action="resume">계속하기 ▷</button><button class="ghost-button" data-action="retreat">여정으로 돌아가기</button><p>진행 중인 웨이브는 처음부터 이어집니다.</p></div>
          <div class="board-hint" data-board-hint>영웅 카드를 고르고 빈 칸을 눌러 배치해</div>
        </div>
        <aside class="battle-panel">
          <div class="battle-notice">
            <div class="selection-brief" data-selection-brief></div>
            <div class="battle-intel"><span data-intel></span><b data-enemy-count></b></div>
            <div class="boss-hud" data-boss-hud hidden><span data-boss-name></span><div class="boss-health-track"><i data-boss-health></i></div><small data-boss-action></small><div class="boss-cast-track" data-boss-cast-track hidden><i data-boss-cast></i></div></div>
          </div>
          <div class="hero-rail" data-hero-rail>${this.#heroCards()}</div>
          <section class="command-focus" aria-label="선택한 수호자 상태">
            <div class="command-focus-heading"><div><small data-focus-role></small><h2 data-focus-name></h2></div><button type="button" class="text-button" data-action="hero-details">상세 정보 ↗</button></div>
            <div class="command-skill"><b data-focus-skill></b><span data-focus-charge></span></div>
            <div class="command-charge-track"><i data-focus-meter></i></div>
            <div class="command-auras" data-focus-auras></div>
          </section>
          <div class="battle-actions">
            <button class="secondary-button compact" type="button" data-action="auto-place">자동 배치</button>
            <button class="secondary-button compact starfall-button" type="button" data-action="starfall" hidden>✧ 별의 기원</button>
            <button class="primary-button compact" type="button" data-action="start-wave">1웨이브 시작</button>
            <button class="icon-button labeled" type="button" data-action="pause" aria-label="일시정지"><span>Ⅱ</span><small>정지</small></button>
            <button class="icon-button labeled" type="button" data-action="speed" aria-label="속도"><span data-speed>×1</span><small>속도</small></button>
          </div>
        </aside>
      </div>
      <div class="sheet-backdrop growth-backdrop" data-growth hidden><section class="info-sheet growth-sheet" role="dialog" aria-modal="true" aria-label="웨이브 성장"><div class="growth-heading"><div><span class="eyebrow" data-growth-wave></span><h2>조금 더 강해질 시간</h2></div><b data-growth-crystals></b></div><p data-next-enemy></p><div data-growth-list></div><div class="growth-actions"><button class="secondary-button" data-action="reposition">배치 바꾸기</button><button class="primary-button" data-action="growth-next">다음 웨이브 →</button></div></section></div>
      <div class="sheet-backdrop" data-hero-sheet hidden><section class="info-sheet battle-hero-sheet" role="dialog" aria-modal="true"><button class="sheet-close icon-button" type="button" data-action="close-sheet" aria-label="닫기">×</button><div data-sheet-body></div></section></div>
    </section>`;

    this.session = new BattleSession({
      stageId: this.stageId,
      difficultyId: this.difficultyId,
      formation: this.formation,
      checkpoint: this.checkpoint,
      repository: this.repository,
      seed: `${this.stageId}:easy:v2`,
    });
    this.effectRenderer = new EffectRenderer({ assetManager: this.assetManager });
    this.effectRenderer.setReduced(this.settings.reducedEffects);
    this.effectRenderer.setDamageNumbers(this.settings.damageNumbers);
    this.renderer = new BattleRenderer({
      canvas: root.querySelector('#battle-canvas'),
      assetManager: this.assetManager,
      effectRenderer: this.effectRenderer,
    });
    this.renderer.setReduced(this.settings.reducedEffects);
    this.renderer.getPlacementPreview = point => placementPreview(this.session.state, this.selectedHeroId, point);
    this.session.applyNow('set_speed', { speed: 2 });
    this.#paintHeroAvatars();
    this.#bindEvents();
    this.document.addEventListener('visibilitychange', this.boundVisibility);
    this.#resize();
    this.#refreshUi(this.session.snapshot());
    this.loop = new GameLoop({
      update: (delta) => this.#update(delta),
      render: () => this.#render(),
    });
    this.loop.start();
  }

  #heroCards() {
    const ids = [this.formation?.mainId ?? this.checkpoint?.formation?.mainId, ...(this.formation?.heroIds ?? this.checkpoint?.formation?.heroIds ?? [])];
    return ids.map((id, slot) => `<button class="battle-hero-card ${id === this.selectedHeroId ? 'selected' : ''}" type="button" data-hero-card="${id}" data-slot="${slot}">
      <canvas class="battle-hero-avatar" data-hero-avatar="${id}" width="160" height="150" aria-hidden="true"></canvas><span class="battle-hero-copy"><b data-hero-name>${id}</b><small>Lv<span data-level>1</span></small></span><small class="hero-charge-label" data-charge-label></small><span class="hero-cooldown" data-cooldown></span>
    </button>`).join('');
  }

  #paintHeroAvatars() { paintPortraits(this.root, this.assetManager, '[data-hero-avatar]'); }

  #bindEvents() {
    this.root.querySelector('[data-action="hero-details"]').onclick = () => this.#openHeroSheet(this.selectedHeroId);
    this.root.querySelector('[data-action="back"]').addEventListener('click', () => {
      if (this.session.state.phase !== BATTLE_PHASE.WAVE_RUNNING) { this.onBack(); return; }
      if (!this.session.state.paused) this.session.applyNow('toggle_pause');
      this.#refreshUi(this.session.snapshot());
    });
    this.root.querySelector('[data-action="retreat"]').onclick = this.onBack;
    this.root.querySelector('[data-action="settings"]').addEventListener('click', this.onSettings);
    this.root.querySelector('[data-action="auto-place"]').addEventListener('click', () => {
      this.session.applyNow('auto_place');
      this.#refreshUi(this.session.snapshot());
    });
    this.root.querySelector('[data-action="start-wave"]').addEventListener('click', () => {
      this.#ensureAudioContext();
      this.session.applyNow('start_wave');
      this.#refreshUi(this.session.snapshot());
    });
    this.root.querySelector('[data-action="starfall"]').addEventListener('click', () => {
      this.spellAiming = !this.spellAiming;
      this.renderer.spellAiming = this.spellAiming;
      this.#refreshUi(this.session.snapshot());
    });
    this.root.querySelector('[data-action="resume"]').onclick = () => { this.session.applyNow('toggle_pause'); this.#refreshUi(this.session.snapshot()); };
    this.root.querySelector('[data-action="reposition"]').onclick = () => { this.root.querySelector('[data-growth]').hidden = true; };
    this.root.querySelector('[data-action="growth-next"]').onclick = () => {
      this.root.querySelector('[data-growth]').hidden = true;
      this.#ensureAudioContext(); this.session.applyNow('start_wave'); this.#refreshUi(this.session.snapshot());
    };
    this.root.querySelector('[data-action="pause"]').addEventListener('click', () => {
      this.session.applyNow('toggle_pause');
      this.#refreshUi(this.session.snapshot());
    });
    this.root.querySelector('[data-action="speed"]').addEventListener('click', () => {
      this.session.applyNow('set_speed', { speed: this.session.state.speed === 1 ? 2 : 1 });
      this.#refreshUi(this.session.snapshot());
    });
    for (const card of this.root.querySelectorAll('[data-hero-card]')) {
      let gesture = null;
      card.addEventListener('pointerdown', event => {
        if (!['PREPARATION','INTERMISSION'].includes(this.session.state.phase)) return;
        gesture = { x: event.clientX, y: event.clientY, moved: false };
        card.setPointerCapture(event.pointerId);
      });
      card.addEventListener('pointermove', event => {
        if (!gesture) return;
        if (Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y) > 8) gesture.moved = true;
        if (!gesture.moved) return;
        this.selectedHeroId = card.dataset.heroCard;
        const point = this.renderer.clientToLogical(event.clientX,event.clientY);
        this.renderer.draggingHeroId = this.selectedHeroId;
        this.renderer.aim = point.inside ? point : null;
        this.#refreshUi(this.session.snapshot());
      });
      card.addEventListener('pointerup', event => {
        if (gesture?.moved) { this.suppressCardClickUntil = performance.now()+250; this.#handleBoardPointer(event); }
        gesture = null; this.renderer.draggingHeroId = null; this.renderer.aim = null;
      });
      card.addEventListener('pointercancel', () => { gesture = null; this.renderer.draggingHeroId = null; this.renderer.aim = null; });
      card.addEventListener('click', () => {
        if (performance.now() < (this.suppressCardClickUntil ?? 0)) return;
        this.selectedHeroId = card.dataset.heroCard;
        const phase = this.session.state.phase;
        if ([BATTLE_PHASE.WAVE_RUNNING, BATTLE_PHASE.INTERMISSION].includes(phase)) {
          this.#openHeroSheet(this.selectedHeroId);
        }
        this.#refreshUi(this.session.snapshot());
      });
    }
    this.renderer.canvas.addEventListener('pointerdown', (event) => this.#handleBoardPointer(event));
    this.renderer.canvas.addEventListener('pointermove', (event) => {
      if (!this.spellAiming && !['PREPARATION', 'INTERMISSION'].includes(this.session.state.phase)) return;
      const point = this.renderer.clientToLogical(event.clientX, event.clientY);
      this.renderer.aim = point.inside ? { x: point.x, y: point.y } : null;
    });
    this.renderer.canvas.addEventListener('pointerleave', () => { this.renderer.aim = null; });
    this.root.querySelector('[data-action="close-sheet"]').addEventListener('click', () => this.#closeHeroSheet());
    this.root.querySelector('[data-hero-sheet]').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) this.#closeHeroSheet();
    });
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.boundResize);
      this.resizeObserver.observe(this.root.querySelector('.battle-layout'));
    } else {
      globalThis.addEventListener('resize', this.boundResize);
    }
  }

  #update(deltaSeconds) {
    const steps = this.session.state.speed;
    for (let index = 0; index < steps; index += 1) {
      this.session.step(deltaSeconds, { landscape: this.renderer.layout.landscape });
    }
    const presentationDelta = this.session.state.paused ? 0 : deltaSeconds;
    this.effectRenderer.update(presentationDelta);
    this.renderer.advanceGameTime(presentationDelta);
    this.#consumeEvents();
  }

  #render() {
    if (!this.renderer || !this.session) return;
    const snapshot = this.session.snapshot();
    const renderStarted = globalThis.performance?.now?.() ?? Date.now();
    this.renderer.render(snapshot);
    this.session.recordRenderDuration((globalThis.performance?.now?.() ?? Date.now()) - renderStarted);
    const now = performance.now();
    if (now - this.lastUiAt > 100 || snapshot.phase !== this.lastPhase) { this.#refreshUi(snapshot); this.lastUiAt = now; }
    if ([BATTLE_PHASE.VICTORY, BATTLE_PHASE.DEFEAT].includes(snapshot.phase) && !this.resultTimer) {
      this.loop?.stop();
      this.resultTimer = globalThis.setTimeout(() => this.onResult({ result: snapshot.result, snapshot }), 280);
    }
  }

  #consumeEvents() {
    for (const event of this.session.consumeVisualEvents()) {
      this.#applyFeedback(event);
      this.renderer.feedback(event);
      if (!event.effectPreset) continue;
      this.effectRenderer.push(event);
    }
  }

  #ensureAudioContext() { return this.audio?.unlock() ?? null; }

  #applyFeedback(event) {
    if (this.settings.screenShake && event.type === 'core_damaged') {
      const board = this.root?.querySelector('[data-board-shell]');
      if (board) {
        board.classList.remove('shake');
        void board.offsetWidth;
        board.classList.add('shake');
        if (this.shakeTimer) globalThis.clearTimeout(this.shakeTimer);
        this.shakeTimer = globalThis.setTimeout(() => board.classList.remove('shake'), 180);
      }
    }
    this.audio?.event(event);
  }

  #handleBoardPointer(event) {
    const boardPoint = this.renderer.clientToLogical(event.clientX, event.clientY);
    if (this.spellAiming) {
      if (boardPoint.inside && this.session.applyNow('cast_starfall', { x: boardPoint.x, y: boardPoint.y })) {
        this.spellAiming = false; this.renderer.spellAiming = false; this.renderer.aim = null;
        this.#refreshUi(this.session.snapshot());
      } else this.#announce('적이 있는 곳을 골라주세요');
      return;
    }
    const tapped = this.session.state.heroes.find(h => h.placed && Math.hypot(h.x + .5 - boardPoint.x, h.y + .5 - boardPoint.y) < .65);
    if (tapped) {
      this.selectedHeroId = tapped.id;
      if (this.session.state.phase === BATTLE_PHASE.WAVE_RUNNING) this.#openHeroSheet(tapped.id);
      this.#refreshUi(this.session.snapshot()); return;
    }
    if (![BATTLE_PHASE.PREPARATION, BATTLE_PHASE.INTERMISSION].includes(this.session.state.phase)) return;
    const point = this.renderer.clientToLogical(event.clientX, event.clientY);
    if (!point.inside || !this.selectedHeroId) return;
    const legal = this.session.state.stage.placementCells.filter(cell => !this.session.state.heroes.some(h => h.id !== this.selectedHeroId && h.placed && h.x === cell.x && h.y === cell.y));
    const nearest = legal.sort((a,b) => Math.hypot(a.x+.5-point.x,a.y+.5-point.y)-Math.hypot(b.x+.5-point.x,b.y+.5-point.y))[0];
    if (!nearest || Math.hypot(nearest.x+.5-point.x,nearest.y+.5-point.y) > .85 || !this.session.applyNow('place_hero', { heroId: this.selectedHeroId, x: nearest.x, y: nearest.y })) { this.#announce('밝은 원 위에 배치할 수 있어요'); return; }
    const next = this.session.state.heroes.find((hero) => !hero.placed);
    if (next) this.selectedHeroId = next.id;
    this.#refreshUi(this.session.snapshot());
  }

  #openHeroSheet(heroId) {
    const hero = this.session.state.heroes.find((candidate) => candidate.id === heroId);
    if (!hero) return;
    this.openSheetHeroId = heroId;
    this.lastSheetSignature = '';
    const sheet = this.root.querySelector('[data-hero-sheet]');
    sheet.hidden = false;
    this.#renderHeroSheet();
  }

  #sheetSignature(hero) {
    const state = this.session.state;
    return [
      state.phase,
      state.crystals,
      hero.level,
      [...hero.buffs].map(([id, runtime]) => `${id}:${[...runtime.sources].join(',')}`).join(';'),
      JSON.stringify(auraConnections(state, hero).provided.map(aura => [aura.id, aura.range, aura.recipients])),
      Object.values(hero.selectedTraits).filter(Boolean).join(','),
    ].join('|');
  }

  #renderHeroSheet() {
    const sheet = this.root?.querySelector('[data-hero-sheet]');
    if (!sheet || sheet.hidden || !this.openSheetHeroId) return;
    const hero = this.session.state.heroes.find((candidate) => candidate.id === this.openSheetHeroId);
    if (!hero) return;
    const signature = this.#sheetSignature(hero);
    if (signature === this.lastSheetSignature) return;
    this.lastSheetSignature = signature;

    const state = this.session.state;
    const readOnly = state.phase === BATTLE_PHASE.WAVE_RUNNING;
    const nextLevel = Math.min(6, hero.level + 1);
    const options = traitOptions(hero, nextLevel);
    const canGrow = !readOnly && state.crystals > 0 && hero.level < 6;
    const controls = options.length
      ? options.map((trait) => `<button class="trait-choice secondary-button" type="button" data-level-trait="${trait.id}" ${canGrow ? '' : 'disabled'}><b>${trait.name}</b><small>${trait.description}</small></button>`).join('')
      : `<button class="primary-button" type="button" data-level-up ${canGrow ? '' : 'disabled'}>꿈의 결정 1개로 Lv${nextLevel}</button>`;

    const levelMultiplier = LEVEL_DAMAGE_MULTIPLIERS[hero.level] ?? 1;
    const attackType = hero.definition.attack.attackType;
    const familyBonus = ATTACK_FAMILIES.physical.includes(attackType)
      ? buffTotal(hero, 'physical_damage_bonus')
      : ATTACK_FAMILIES.magical.includes(attackType)
        ? buffTotal(hero, 'magic_damage_bonus')
        : 0;
    const damage = hero.definition.attack.damage * levelMultiplier * (1 + buffTotal(hero, 'direct_damage_bonus') + familyBonus);
    const skill = hero.definition.skill;
    const skillDamage = skill.damage * levelMultiplier;
    const onHitNames = (skill.onHitEffects ?? [])
      .map((effect) => STATUS_BY_ID[effect.statusId]?.displayName ?? effect.statusId)
      .filter((name, index, list) => list.indexOf(name) === index);
    const connections = auraConnections(state, hero);
    const buffChips = connections.received
      .map((buff) => `<span class="buff-chip" style="border-color:${buff.color}"><b>${buff.displayName}</b><small>${buff.description}</small><small>제공 · ${buff.sourceNames.join(', ')}</small></span>`)
      .join('');
    const providerChips = connections.provided.map(aura => `<span class="buff-chip" style="border-color:${aura.color}"><b>${aura.displayName} · 범위 ${aura.range}</b><small>${aura.description}</small><small>받는 수호자 · ${aura.recipientNames.join(', ') || (hero.placed ? '현재 연결 없음' : '배치 후 연결')}</small></span>`).join('');
    const selectedTraits = Object.values(hero.selectedTraits).filter(Boolean)
      .map((traitId) => (hero.definition.traits ?? []).find((trait) => trait.id === traitId))
      .filter(Boolean)
      .map((trait) => `<span><b>${trait.name}</b> · ${trait.description}</span>`)
      .join('') || '<span>선택 특성 없음</span>';

    sheet.querySelector('[data-sheet-body]').innerHTML = `<span class="eyebrow">영웅 성장 · 결정 ${state.crystals}</span><h2>${hero.definition.name} <small>Lv${hero.level}</small></h2>
      <div class="stat-grid">
        <div><small>공격력</small><strong>${formatNumber(damage)}</strong></div>
        <div><small>공격 간격</small><strong>${formatNumber(getAttackInterval(state, hero), 2)}초</strong></div>
        <div><small>사거리</small><strong>${getEffectiveRange(state, hero)}</strong></div>
        <div><small>스킬 쿨다운</small><strong>${formatNumber(getSkillCooldown(state, hero), 1)}초</strong></div>
      </div>
      <p class="sheet-skill"><b>${skill.name}</b> · 피해 ${formatNumber(skillDamage)} · ${skill.shape === 'area' ? `범위 ${formatNumber(skill.radius)}` : skill.shape === 'melee' ? '근접 한방' : '단일'}${onHitNames.length ? ` · 적중 시 ${onHitNames.join(' · ')}` : ''}</p>
      ${providerChips ? `<h3 class="aura-heading">제공하는 오라</h3><div class="buff-chips">${providerChips}</div>` : ''}
      <h3 class="aura-heading">받고 있는 오라</h3><div class="buff-chips">${buffChips || `<span class="buff-empty">${hero.definition.auraImmune ? '오라를 받지 않는 수호자' : '현재 연결된 오라 없음'}</span>`}</div>
      <div class="selected-traits">${selectedTraits}</div>
      <div class="level-controls">${controls}</div>
      <p class="sheet-note">${readOnly ? '전투 중에는 보기만 가능해. 레벨업과 특성 선택은 웨이브 사이에 할 수 있어.' : '웨이브 사이에는 카드를 고른 뒤 전장을 눌러 자유롭게 재배치할 수 있어.'}</p>`;
    sheet.querySelector('[data-level-up]')?.addEventListener('click', () => this.#levelHero(this.openSheetHeroId, null));
    for (const button of sheet.querySelectorAll('[data-level-trait]')) {
      button.addEventListener('click', () => this.#levelHero(this.openSheetHeroId, button.dataset.levelTrait));
    }
  }

  #levelHero(heroId, traitId) {
    this.session.applyNow('level_up', { heroId, traitId });
    this.#closeHeroSheet();
    this.#refreshUi(this.session.snapshot());
    if (this.session.state.phase === BATTLE_PHASE.INTERMISSION) this.#showGrowth();
  }

  #closeHeroSheet() {
    const sheet = this.root?.querySelector('[data-hero-sheet]');
    if (sheet) sheet.hidden = true;
    this.openSheetHeroId = null;
    this.lastSheetSignature = '';
  }

  #refreshUi(snapshot) {
    if (!this.root) return;
    const changedPhase = this.lastPhase !== snapshot.phase;
    this.lastPhase = snapshot.phase;
    const running = snapshot.phase === BATTLE_PHASE.WAVE_RUNNING;
    this.audio?.setMode(snapshot.paused ? 'paused' : running ? 'battle' : 'menu');
    this.renderer.selectedHeroId = this.selectedHeroId;
    const selected = this.session.state.heroes.find(h => h.id === this.selectedHeroId);
    const previewPoint = this.renderer.aim ?? (selected?.placed ? { x: selected.x + .5, y: selected.y + .5 } : null);
    const preview = !running && previewPoint ? placementPreview(this.session.state, this.selectedHeroId, previewPoint) : null;
    this.renderer.selectedRange = selected ? getEffectiveRange(this.session.state, selected) : 3;
    if (preview) this.renderer.selectedRange = preview.geometry.range;
    const waveDefinition = STAGE_BY_ID[this.stageId ?? snapshot.stageId]?.waves[(running ? snapshot.wave.number : snapshot.nextWave) - 1];
    const enemy = ENEMY_BY_ID[waveDefinition?.groups[0].enemyId];
    this.root.querySelector('[data-intel]').textContent = `${running ? '' : '다음 · '}${enemy?.name ?? ''} · ${DEFENSE_LABELS[enemy?.defenseType] ?? ''}형`;
    this.root.querySelector('[data-enemy-count]').textContent = running ? `${Math.max(0,snapshot.wave.total-snapshot.wave.spawned)+snapshot.wave.alive} 남음` : '';
    this.root.querySelector('[data-selection-brief]').textContent = this.spellAiming ? '적 무리를 누르세요 · 1.5초 정지, 4초 감속' : running ? `${JOURNEYS[snapshot.stageId].title} · 수호자를 누르면 전투 정보` : `${selected?.definition.name ?? ''} · ${HERO_COPY[selected?.id]?.[1] ?? ''} · 사거리 ${this.renderer.selectedRange}`;
    this.root.querySelector('[data-pause-curtain]').hidden = !snapshot.paused || !running;
    const spell = this.root.querySelector('[data-action="starfall"]');
    spell.hidden = !running;
    spell.disabled = !snapshot.starfallReady || snapshot.paused;
    spell.textContent = this.spellAiming ? '선택 취소' : snapshot.starfallReady ? '✧ 별의 기원' : '사용 완료';
    spell.classList.toggle('aiming', this.spellAiming);
    const boss = snapshot.enemies.find(e => e.isBoss);
    this.root.querySelector('[data-boss-hud]').hidden = !boss;
    this.root.querySelector('.battle-intel').hidden = !running || Boolean(boss) || this.spellAiming;
    this.root.querySelector('[data-selection-brief]').hidden = running && (!this.spellAiming || Boolean(boss));
    if (boss) {
      this.root.querySelector('[data-boss-name]').textContent = boss.name + (snapshot.wave.number===5?' · 전조':'');
      this.root.querySelector('[data-boss-health]').style.width = `${Math.max(0,boss.hp/boss.maxHp)*100}%`;
      const cast=boss.bossState, casting=cast?.phase==='windup';
      this.root.querySelector('[data-boss-cast-track]').hidden=!casting;
      if(casting) this.root.querySelector('[data-boss-cast]').style.width=`${(1-cast.remaining/cast.duration)*100}%`;
      this.root.querySelector('[data-boss-action]').textContent=!cast?'':casting
        ? `${cast.name} · ${cast.remaining.toFixed(1)}초 / 기절·집중 공격으로 방해`
        : cast.interrupted ? '시전 방해 · 받는 피해 +25%'
        : cast.phase==='active' ? `${cast.name} 발동 중 · ${cast.remaining.toFixed(1)}초`
        : cast.phase==='recovery' ? '시전 완료'
        : `${cast.name}까지 ${Math.ceil(cast.remaining)}초`;
    }
    if (changedPhase && snapshot.phase === BATTLE_PHASE.INTERMISSION) { this.spellAiming = false; this.renderer.spellAiming = false; this.#showGrowth(); }
    if (changedPhase && running) { this.root.querySelector('[data-growth]').hidden = true; this.#closeHeroSheet(); this.#announce(`${waveDefinition?.kind === 'boss' ? '수호신 출현' : 'WAVE'} ${snapshot.wave.number.toString().padStart(2,'0')}`); }
    this.root.querySelector('[data-core]').textContent = `${Number.isInteger(snapshot.core.durability) ? snapshot.core.durability : snapshot.core.durability.toFixed(1)} / ${snapshot.core.maxDurability}`;
    this.root.querySelector('[data-wave]').textContent = snapshot.phase === BATTLE_PHASE.WAVE_RUNNING ? `${snapshot.wave.number} · ${snapshot.wave.alive}` : `${snapshot.nextWave} / 10`;
    this.root.querySelector('[data-crystals]').textContent = snapshot.crystals;
    this.root.querySelector('[data-phase]').textContent = PHASE_LABELS[snapshot.phase];
    const start = this.root.querySelector('[data-action="start-wave"]');
    start.disabled = snapshot.phase === BATTLE_PHASE.WAVE_RUNNING || !allHeroesPlaced(this.session.state);
    start.textContent = snapshot.phase === BATTLE_PHASE.INTERMISSION ? `${snapshot.nextWave}웨이브 시작` : snapshot.phase === BATTLE_PHASE.PREPARATION ? '1웨이브 시작' : '방어 중';
    const auto = this.root.querySelector('[data-action="auto-place"]');
    auto.disabled = snapshot.phase === BATTLE_PHASE.WAVE_RUNNING;
    auto.hidden = running;
    const pause = this.root.querySelector('[data-action="pause"]');
    pause.disabled = snapshot.phase !== BATTLE_PHASE.WAVE_RUNNING;
    pause.querySelector('span').textContent = snapshot.paused ? '▶' : 'Ⅱ';
    this.root.querySelector('[data-speed]').textContent = `×${snapshot.speed}`;
    const hint = this.root.querySelector('[data-board-hint]');
    hint.hidden = !this.spellAiming && allHeroesPlaced(this.session.state);
    hint.textContent = this.spellAiming ? '적 무리를 누르면 별의 기원이 내려요' : '수호자를 고르고 빈 자리에 배치하세요';
    for (const card of this.root.querySelectorAll('[data-hero-card]')) {
      const hero = snapshot.heroes.find((candidate) => candidate.id === card.dataset.heroCard);
      card.classList.toggle('selected', hero.id === this.selectedHeroId);
      card.classList.toggle('placed', hero.placed);
      card.querySelector('[data-hero-name]').textContent = ({ avalanche_maid: '메이드', lightning_sage: '번개 현자', storm_sage: '폭풍 현자' })[hero.id] ?? hero.name; card.setAttribute('aria-label', `${hero.name} Lv${hero.level}`);
      card.querySelector('[data-level]').textContent = hero.level;
      const runtime = this.session.state.heroes.find((candidate) => candidate.id === hero.id);
      const charging = snapshot.projectiles.find(action => action.sourceId === hero.id && action.actionKind === 'skill');
      const cooldown = getSkillCooldown(this.session.state, runtime);
      const charge = Math.max(0, Math.min(1, 1 - runtime.skillTimer / cooldown));
      const label = !running ? (hero.placed ? '배치 완료' : '미배치') : charging ? (charging.phase === 'windup' ? '시전 중' : '발사') : runtime.skillTimer <= 0 ? '준비 완료' : `${Math.ceil(runtime.skillTimer)}초`;
      card.dataset.skillState = charging ? 'casting' : charge >= 1 ? 'ready' : 'charging';
      card.querySelector('[data-cooldown]').style.setProperty('--charge', String(charge));
      card.querySelector('[data-charge-label]').textContent = label;
      card.setAttribute('aria-label', `${hero.name} Lv${hero.level} · ${runtime.definition.skill.name} ${label}`);
    }
    if (selected) this.#refreshCommandFocus(snapshot, selected);
    if (this.openSheetHeroId) {
      if ([BATTLE_PHASE.VICTORY, BATTLE_PHASE.DEFEAT].includes(snapshot.phase)) this.#closeHeroSheet();
      else this.#renderHeroSheet();
    }
  }

  #refreshCommandFocus(snapshot, hero) {
    const state = this.session.state, focus = this.root.querySelector('.command-focus');
    const connections = auraConnections(state, hero);
    const cast = snapshot.projectiles.find(action => action.sourceId === hero.id && action.actionKind === 'skill');
    const cooldown = getSkillCooldown(state, hero);
    focus.querySelector('[data-focus-role]').textContent = `${HERO_COPY[hero.id]?.[1] ?? ''} · 사거리 ${formatNumber(getEffectiveRange(state, hero))}`;
    focus.querySelector('[data-focus-name]').textContent = hero.definition.name;
    focus.querySelector('[data-focus-skill]').textContent = hero.definition.skill.name;
    focus.querySelector('[data-focus-charge]').textContent = cast ? (cast.phase === 'windup' ? '시전 준비' : '목표로 이동 중') : hero.skillTimer > 0 ? `${formatNumber(hero.skillTimer)}초 / ${formatNumber(cooldown)}초` : '표적이 들어오면 발동';
    focus.querySelector('[data-focus-meter]').style.width = `${cast ? 100 : Math.max(0, Math.min(1, 1 - hero.skillTimer / cooldown)) * 100}%`;
    const markup = connections.provided.map(aura => `<p><b>제공 · ${aura.displayName}</b><span>${aura.description} · ${aura.recipients.length}명 연결</span></p>`).join('')
      + connections.received.map(aura => `<p><b>받음 · ${aura.displayName}</b><span>${aura.sourceNames.join(', ')} → ${aura.description}</span></p>`).join('');
    const auras = focus.querySelector('[data-focus-auras]');
    const content = markup || `<p class="no-aura">${hero.definition.auraImmune ? '오라를 받지 않는 수호자' : '현재 연결된 오라 없음'}</p>`;
    if (auras.innerHTML !== content) auras.innerHTML = content;
  }

  #announce(text) {
    const label = this.root?.querySelector('[data-announcement]');
    if (!label) return;
    label.textContent = text; label.hidden = false;
    clearTimeout(this.announcementTimer);
    this.announcementTimer = setTimeout(() => { if (label.isConnected) label.hidden = true; }, 1600);
  }

  #showGrowth() {
    const state = this.session.state, sheet = this.root.querySelector('[data-growth]');
    sheet.querySelector('[data-growth-wave]').textContent = `WAVE ${state.wave.number || state.nextWave-1} CLEAR`;
    sheet.querySelector('[data-growth-crystals]').textContent = `✧ ${state.crystals}`;
    const next = ENEMY_BY_ID[state.stage.waves[state.nextWave-1].groups[0].enemyId];
    sheet.querySelector('[data-next-enemy]').textContent = `다음은 ${next.name} · ${DEFENSE_LABELS[next.defenseType]}형`;
    sheet.querySelector('[data-growth-list]').innerHTML = state.heroes.map(hero => `<button class="growth-row" data-grow-hero="${hero.id}" ${hero.level>=6 || state.crystals<1?'disabled':''}><canvas data-portrait="${hero.id}" width="100" height="90"></canvas><span><b>${hero.definition.name}</b><small>Lv.${hero.level} · ${HERO_COPY[hero.id][1]}</small></span><strong>${hero.level>=6?'MAX':`✧ 1 <small>${[3,5].includes(hero.level)?'특성 선택':'성장 ↑'}</small>`}</strong></button>`).join('');
    for (const button of sheet.querySelectorAll('[data-grow-hero]')) button.onclick = () => {
      const hero = state.heroes.find(h => h.id === button.dataset.growHero);
      if ([3,5].includes(hero.level)) { sheet.hidden = true; this.#openHeroSheet(hero.id); }
      else this.#levelHero(hero.id, null);
    };
    sheet.hidden = false;
    paintPortraits(sheet, this.assetManager);
  }

  #resize() {
    if (!this.renderer) return;
    const bounds = this.root.querySelector('.battle-layout').getBoundingClientRect();
    const view = this.document.defaultView;
    const landscape = view.innerWidth > view.innerHeight;
    const deckReserve = landscape ? Math.min(360, bounds.width * .43) : view.innerHeight <= 690 ? 176 : 248;
    const side = Math.max(1, Math.min(landscape ? bounds.width - deckReserve : bounds.width, landscape ? bounds.height : bounds.height - deckReserve));
    this.root.querySelector('.battle-layout').style.setProperty('--arena-side', `${side}px`);
    this.renderer.resize();
    this.#paintHeroAvatars();
    this.renderer.render(this.session?.snapshot?.() ?? { stage: { theme: 'ruins', path: [], obstacles: [] }, heroes: [], enemies: [] });
  }

  updateSettings(settings) {
    this.settings = settings;
    this.effectRenderer?.setReduced(settings.reducedEffects);
    this.effectRenderer?.setDamageNumbers(settings.damageNumbers);
    this.renderer?.setReduced(settings.reducedEffects);
  }

  debugAutoPlace() {
    const result = this.session.applyNow('auto_place');
    this.#refreshUi(this.session.snapshot());
    return result;
  }

  debugStartWave() {
    const result = this.session.applyNow('start_wave');
    this.#refreshUi(this.session.snapshot());
    return result;
  }

  debugStepTicks(count = 1) {
    const ticks = Math.max(0, Number(count) || 0);
    for (let index = 0; index < ticks; index += 1) {
      this.session.step(FIXED_TICK_SECONDS, { landscape: this.renderer.layout.landscape });
    }
    const presentationDelta = this.session.state.paused
      ? 0
      : FIXED_TICK_SECONDS * ticks / this.session.state.speed;
    this.effectRenderer.update(presentationDelta);
    this.renderer.advanceGameTime(presentationDelta);
    this.#consumeEvents();
    this.#refreshUi(this.session.snapshot());
    this.#render();
    return this.getDebugState();
  }

  getDebugState() {
    return {
      snapshot: this.session?.snapshot() ?? null,
      layout: this.renderer?.layout.snapshot() ?? null,
      effects: this.effectRenderer?.snapshotCaps() ?? null,
      performanceSamples: {
        update: [...(this.session?.state?.metrics?.updateSamples ?? [])],
        render: [...(this.session?.state?.metrics?.renderSamples ?? [])],
      },
    };
  }

  destroy() {
    this.loop?.stop();
    this.session?.destroy();
    this.resizeObserver?.disconnect();
    globalThis.removeEventListener?.('resize', this.boundResize);
    if (this.resultTimer) globalThis.clearTimeout(this.resultTimer);
    if (this.shakeTimer) globalThis.clearTimeout(this.shakeTimer);
    clearTimeout(this.announcementTimer);
    this.document.removeEventListener('visibilitychange', this.boundVisibility);
    this.audioContext?.close?.().catch?.(() => {});
    this.document?.documentElement?.classList.remove('battle-active');
    this.document?.body?.classList.remove('battle-active');
    this.root = null;
  }
}

export default BattleScreen;
