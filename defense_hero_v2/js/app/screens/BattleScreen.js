import { GameLoop } from '../../core/GameLoop.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../../core/enums.js';
import { BattleSession } from '../../battle/BattleSession.js';
import { allHeroesPlaced } from '../../battle/systems/PlacementSystem.js';
import { getAttackInterval } from '../../battle/systems/BasicAttackSystem.js';
import { getSkillCooldown } from '../../battle/systems/SkillSystem.js';
import { getEffectiveRange } from '../../battle/systems/TargetingSystem.js';
import { buffEffects } from '../../battle/systems/AuraSystem.js';
import { AURA_BUFF_BY_ID } from '../../content/buffs.js';
import { ATTACK_FAMILIES, LEVEL_DAMAGE_MULTIPLIERS } from '../../content/combat.js';
import { STATUS_BY_ID } from '../../content/statuses.js';
import { BattleRenderer } from '../../render/BattleRenderer.js';
import { EffectRenderer } from '../../render/EffectRenderer.js';
import { drawResolvedSprite } from '../../render/SpriteResolver.js';

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
    formation,
    checkpoint = null,
    repository,
    assetManager,
    settings,
    onSettings,
    onBack,
    onResult,
  } = {}) {
    Object.assign(this, { stageId, formation, checkpoint, repository, assetManager, settings, onSettings, onBack, onResult });
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
  }

  mount(root) {
    this.root = root;
    this.document = root.ownerDocument;
    this.document?.documentElement?.classList.add('battle-active');
    this.document?.body?.classList.add('battle-active');
    root.innerHTML = `<section class="screen battle-screen" data-screen="battle">
      <header class="battle-hud">
        <button class="icon-button battle-back" type="button" data-action="back" aria-label="스테이지 선택">‹</button>
        <div class="hud-stat hud-core"><small>CORE</small><strong data-core>10 / 10</strong></div>
        <div class="hud-stat hud-wave"><small>WAVE</small><strong data-wave>준비</strong></div>
        <div class="hud-stat hud-crystals"><small>◆ 꿈의 결정</small><strong data-crystals>0</strong></div>
        <span class="phase-chip" data-phase>배치 준비</span>
        <button class="icon-button" type="button" data-action="settings" aria-label="설정">⚙</button>
      </header>
      <div class="battle-layout">
        <div class="battle-board-shell" data-board-shell>
          <canvas id="battle-canvas" aria-label="12×16 전장"></canvas>
          <div class="board-hint" data-board-hint>영웅 카드를 고르고 빈 칸을 눌러 배치해</div>
        </div>
        <aside class="battle-panel">
          <div class="hero-rail" data-hero-rail>${this.#heroCards()}</div>
          <div class="battle-actions">
            <button class="secondary-button compact" type="button" data-action="auto-place">자동 배치</button>
            <button class="primary-button compact" type="button" data-action="start-wave">1웨이브 시작</button>
            <button class="icon-button labeled" type="button" data-action="pause" aria-label="일시정지"><span>Ⅱ</span><small>정지</small></button>
            <button class="icon-button labeled" type="button" data-action="speed" aria-label="속도"><span data-speed>×1</span><small>속도</small></button>
          </div>
        </aside>
      </div>
      <div class="sheet-backdrop" data-hero-sheet hidden><section class="info-sheet battle-hero-sheet" role="dialog" aria-modal="true"><button class="sheet-close icon-button" type="button" data-action="close-sheet" aria-label="닫기">×</button><div data-sheet-body></div></section></div>
    </section>`;

    this.session = new BattleSession({
      stageId: this.stageId,
      formation: this.formation,
      checkpoint: this.checkpoint,
      repository: this.repository,
      seed: `${this.stageId}:easy:v2`,
    });
    this.effectRenderer = new EffectRenderer();
    this.effectRenderer.setReduced(this.settings.reducedEffects);
    this.effectRenderer.setDamageNumbers(this.settings.damageNumbers);
    this.renderer = new BattleRenderer({
      canvas: root.querySelector('#battle-canvas'),
      assetManager: this.assetManager,
      effectRenderer: this.effectRenderer,
    });
    this.renderer.setReduced(this.settings.reducedEffects);
    this.#paintHeroAvatars();
    this.#bindEvents();
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
      <canvas class="battle-hero-avatar" data-hero-avatar="${id}" width="64" height="64" aria-hidden="true"></canvas><span class="battle-hero-copy"><b data-hero-name>${id}</b><small>Lv<span data-level>1</span></small></span><span class="hero-cooldown" data-cooldown></span>
    </button>`).join('');
  }

  #paintHeroAvatars() {
    const ids = [this.formation?.mainId ?? this.checkpoint?.formation?.mainId, ...(this.formation?.heroIds ?? this.checkpoint?.formation?.heroIds ?? [])];
    const assetIds = ids.map((id) => `portrait/${id}`);
    const paint = () => {
      if (!this.root) return;
      for (const canvas of this.root.querySelectorAll('[data-hero-avatar]')) {
        const assetId = `portrait/${canvas.dataset.heroAvatar}`;
        const image = this.assetManager?.getImage(assetId);
        const entry = this.assetManager?.getEntry(assetId);
        const context = canvas.getContext('2d');
        if (!context || !image) continue;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawResolvedSprite(context, { image, frame: entry?.frame ?? null }, {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        });
      }
    };
    paint();
    this.assetManager?.preload(assetIds).then(paint).catch(() => {});
  }

  #bindEvents() {
    this.root.querySelector('[data-action="back"]').addEventListener('click', this.onBack);
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
    this.root.querySelector('[data-action="pause"]').addEventListener('click', () => {
      this.session.applyNow('toggle_pause');
      this.#refreshUi(this.session.snapshot());
    });
    this.root.querySelector('[data-action="speed"]').addEventListener('click', () => {
      this.session.applyNow('set_speed', { speed: this.session.state.speed === 1 ? 2 : 1 });
      this.#refreshUi(this.session.snapshot());
    });
    for (const card of this.root.querySelectorAll('[data-hero-card]')) {
      card.addEventListener('click', () => {
        this.selectedHeroId = card.dataset.heroCard;
        const phase = this.session.state.phase;
        if ([BATTLE_PHASE.WAVE_RUNNING, BATTLE_PHASE.INTERMISSION].includes(phase)) {
          this.#openHeroSheet(this.selectedHeroId);
        }
        this.#refreshUi(this.session.snapshot());
      });
    }
    this.renderer.canvas.addEventListener('pointerdown', (event) => this.#handleBoardPointer(event));
    this.root.querySelector('[data-action="close-sheet"]').addEventListener('click', () => this.#closeHeroSheet());
    this.root.querySelector('[data-hero-sheet]').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) this.#closeHeroSheet();
    });
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.boundResize);
      this.resizeObserver.observe(this.root.querySelector('[data-board-shell]'));
    } else {
      globalThis.addEventListener('resize', this.boundResize);
    }
  }

  #update(deltaSeconds) {
    const steps = this.session.state.speed;
    for (let index = 0; index < steps; index += 1) {
      this.session.step(deltaSeconds, { landscape: this.renderer.layout.landscape });
    }
    const gameDeltaSeconds = this.session.state.paused ? 0 : deltaSeconds * steps;
    this.effectRenderer.update(gameDeltaSeconds);
    this.renderer.advanceGameTime(gameDeltaSeconds);
    this.#consumeEvents();
  }

  #render() {
    if (!this.renderer || !this.session) return;
    const snapshot = this.session.snapshot();
    const renderStarted = globalThis.performance?.now?.() ?? Date.now();
    this.renderer.render(snapshot);
    this.session.recordRenderDuration((globalThis.performance?.now?.() ?? Date.now()) - renderStarted);
    this.#refreshUi(snapshot);
    if ([BATTLE_PHASE.VICTORY, BATTLE_PHASE.DEFEAT].includes(snapshot.phase) && !this.resultTimer) {
      this.loop?.stop();
      this.resultTimer = globalThis.setTimeout(() => this.onResult({ result: snapshot.result, snapshot }), 280);
    }
  }

  #consumeEvents() {
    for (const event of this.session.consumeVisualEvents()) {
      this.#applyFeedback(event);
      if (!event.effectPreset) continue;
      this.effectRenderer.push(event);
    }
  }

  #ensureAudioContext() {
    if (!this.settings.sound) return null;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (typeof AudioContextClass !== 'function') return null;
    try {
      this.audioContext ??= new AudioContextClass();
      if (this.audioContext.state === 'suspended') this.audioContext.resume?.().catch?.(() => {});
      return this.audioContext;
    } catch {
      return null;
    }
  }

  #applyFeedback(event) {
    if (this.settings.screenShake && (event.type === 'core_damaged' || event.effectPreset === 'critical_hit')) {
      const board = this.root?.querySelector('[data-board-shell]');
      if (board) {
        board.classList.remove('shake');
        void board.offsetWidth;
        board.classList.add('shake');
        if (this.shakeTimer) globalThis.clearTimeout(this.shakeTimer);
        this.shakeTimer = globalThis.setTimeout(() => board.classList.remove('shake'), 180);
      }
    }
    if (!this.settings.sound) return;
    const frequency = event.type === 'core_damaged'
      ? 130
      : event.type === 'wave_completed'
        ? 880
        : event.type === 'wave_started'
          ? 620
          : event.effectPreset === 'critical_hit'
            ? 980
            : null;
    if (!frequency) return;
    const audioContext = this.#ensureAudioContext();
    if (!audioContext || audioContext.state === 'closed') return;
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime;
      oscillator.type = event.type === 'core_damaged' ? 'sawtooth' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.035, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.075);
    } catch {
      // Audio feedback is optional; combat must continue if the device rejects it.
    }
  }

  #handleBoardPointer(event) {
    if (![BATTLE_PHASE.PREPARATION, BATTLE_PHASE.INTERMISSION].includes(this.session.state.phase)) return;
    const point = this.renderer.clientToLogical(event.clientX, event.clientY);
    if (!point.inside || !this.selectedHeroId) return;
    if (!this.session.applyNow('place_hero', { heroId: this.selectedHeroId, x: point.cellX, y: point.cellY })) return;
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
      [...hero.buffs.keys()].join(','),
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
    const buffChips = [...hero.buffs.keys()]
      .map((buffId) => AURA_BUFF_BY_ID[buffId])
      .filter(Boolean)
      .map((buff) => `<span class="buff-chip" style="border-color:${buff.color}; color:${buff.color}">${buff.displayName}<small>${buff.description}</small></span>`)
      .join('');
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
      <p class="sheet-skill"><b>${skill.name}</b> · 피해 ${formatNumber(skillDamage)} · ${skill.shape === 'area' ? '범위 3' : '단일'}${onHitNames.length ? ` · 적중 시 ${onHitNames.join(' · ')}` : ''}</p>
      <div class="buff-chips">${buffChips || '<span class="buff-empty">활성 버프 없음</span>'}</div>
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
  }

  #closeHeroSheet() {
    const sheet = this.root?.querySelector('[data-hero-sheet]');
    if (sheet) sheet.hidden = true;
    this.openSheetHeroId = null;
    this.lastSheetSignature = '';
  }

  #refreshUi(snapshot) {
    if (!this.root) return;
    this.root.querySelector('[data-core]').textContent = `${Number.isInteger(snapshot.core.durability) ? snapshot.core.durability : snapshot.core.durability.toFixed(1)} / ${snapshot.core.maxDurability}`;
    this.root.querySelector('[data-wave]').textContent = snapshot.phase === BATTLE_PHASE.WAVE_RUNNING ? `${snapshot.wave.number} · ${snapshot.wave.alive}` : `${snapshot.nextWave} / 10`;
    this.root.querySelector('[data-crystals]').textContent = snapshot.crystals;
    this.root.querySelector('[data-phase]').textContent = PHASE_LABELS[snapshot.phase];
    const start = this.root.querySelector('[data-action="start-wave"]');
    start.disabled = snapshot.phase === BATTLE_PHASE.WAVE_RUNNING || !allHeroesPlaced(this.session.state);
    start.textContent = snapshot.phase === BATTLE_PHASE.INTERMISSION ? `${snapshot.nextWave}웨이브 시작` : snapshot.phase === BATTLE_PHASE.PREPARATION ? '1웨이브 시작' : '방어 중';
    const auto = this.root.querySelector('[data-action="auto-place"]');
    auto.disabled = snapshot.phase === BATTLE_PHASE.WAVE_RUNNING;
    const pause = this.root.querySelector('[data-action="pause"]');
    pause.disabled = snapshot.phase !== BATTLE_PHASE.WAVE_RUNNING;
    pause.querySelector('span').textContent = snapshot.paused ? '▶' : 'Ⅱ';
    this.root.querySelector('[data-speed]').textContent = `×${snapshot.speed}`;
    const hint = this.root.querySelector('[data-board-hint]');
    hint.hidden = allHeroesPlaced(this.session.state);
    for (const card of this.root.querySelectorAll('[data-hero-card]')) {
      const hero = snapshot.heroes.find((candidate) => candidate.id === card.dataset.heroCard);
      card.classList.toggle('selected', hero.id === this.selectedHeroId);
      card.classList.toggle('placed', hero.placed);
      card.querySelector('[data-hero-name]').textContent = hero.name;
      card.querySelector('[data-level]').textContent = hero.level;
      const runtime = this.session.state.heroes.find((candidate) => candidate.id === hero.id);
      const cooldown = Math.max(runtime.attackTimer, runtime.skillTimer);
      card.querySelector('[data-cooldown]').style.setProperty('--cooldown', String(Math.min(1, cooldown / Math.max(1, runtime.definition.skill.cooldown))));
    }
    if (this.openSheetHeroId) {
      if ([BATTLE_PHASE.VICTORY, BATTLE_PHASE.DEFEAT].includes(snapshot.phase)) this.#closeHeroSheet();
      else this.#renderHeroSheet();
    }
  }

  #resize() {
    if (!this.renderer) return;
    this.renderer.resize();
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
    const gameDeltaSeconds = this.session.state.paused
      ? 0
      : FIXED_TICK_SECONDS * ticks * this.session.state.speed;
    this.effectRenderer.update(gameDeltaSeconds);
    this.renderer.advanceGameTime(gameDeltaSeconds);
    this.#consumeEvents();
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
    this.audioContext?.close?.().catch?.(() => {});
    this.document?.documentElement?.classList.remove('battle-active');
    this.document?.body?.classList.remove('battle-active');
    this.root = null;
  }
}

export default BattleScreen;
