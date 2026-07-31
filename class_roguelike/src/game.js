(() => {
  "use strict";

  const app = document.getElementById("app");
  const liveRegion = document.getElementById("live-region");
  const TIER_LABELS = ["", "일반", "고급", "희귀", "영웅", "전설"];
  const NAV_ITEMS = [
    { id: "dungeons", icon: "◇", label: "던전" },
    { id: "classes", icon: "Ⅲ", label: "클래스" },
    { id: "equipment", icon: "†", label: "장비" },
    { id: "status", icon: "◎", label: "상태" }
  ];

  let state = loadState();
  let ui = {
    atTitle: true,
    view: "dungeons",
    modal: null,
    selectedClassId: null,
    selectedSkillId: null,
    skillFilter: "all",
    inventoryFilter: "all",
    damagePop: null
  };
  let actionLocked = false;
  let flowTimer = 0;
  let toastTimer = 0;
  let previousFocus = null;
  const combatImageNodes = new Map();

  function getCombatImageNode(key) {
    if (combatImageNodes.has(key)) return combatImageNodes.get(key);
    const image = document.createElement("img");
    image.className = "combatant-art";
    image.decoding = "async";
    image.src = key === "lumi" ? GAME_IMAGES.lumi : GAME_IMAGES.demon;
    image.alt = key === "lumi"
      ? "달빛 유적에서 검을 든 루미"
      : "붉은 일식 아래 선 마왕의 잔영";
    combatImageNodes.set(key, image);
    return image;
  }

  function hydrateCombatImages() {
    app.querySelectorAll("[data-combat-image]").forEach((placeholder) => {
      const image = getCombatImageNode(placeholder.dataset.combatImage);
      image.className = placeholder.className.replace(" combatant-art-placeholder", "");
      placeholder.replaceWith(image);
    });
  }

  function focusTokenFor(element) {
    if (!(element instanceof HTMLElement)) return null;
    const keys = [
      "action",
      "classId",
      "dungeonId",
      "itemId",
      "skillId",
      "armorSkillId",
      "view",
      "filter"
    ];
    const data = {};
    keys.forEach((key) => {
      if (element.dataset[key] !== undefined) data[key] = element.dataset[key];
    });
    return Object.keys(data).length ? data : null;
  }

  function findFocusToken(token) {
    if (!token) return null;
    return [...app.querySelectorAll("[data-action]")].find((element) =>
      Object.entries(token).every(([key, value]) => element.dataset[key] === value)
    ) || null;
  }

  function syncModalAccessibility() {
    [...app.children].forEach((child) => {
      const isOverlay = child.classList.contains("overlay");
      if (ui.modal && !isOverlay) {
        child.inert = true;
        child.setAttribute("aria-hidden", "true");
      } else {
        child.inert = false;
        child.removeAttribute("aria-hidden");
      }
    });
  }

  function defaultState() {
    return {
      version: GAME_VERSION,
      started: false,
      runId: "",
      level: 1,
      xp: 0,
      selectedClasses: [],
      initialClassChoices: null,
      pendingClassChoices: null,
      inventory: [],
      equipment: { weapon: null, armor: null },
      clearedDungeons: [],
      battlesWon: 0,
      highestDamage: 0,
      battle: null,
      lastSavedAt: 0
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== GAME_VERSION) return defaultState();
      return {
        ...defaultState(),
        ...parsed,
        equipment: { ...defaultState().equipment, ...(parsed.equipment || {}) },
        inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
        selectedClasses: Array.isArray(parsed.selectedClasses) ? parsed.selectedClasses : [],
        initialClassChoices: Array.isArray(parsed.initialClassChoices) ? parsed.initialClassChoices : null,
        clearedDungeons: Array.isArray(parsed.clearedDungeons) ? parsed.clearedDungeons : []
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    state.lastSavedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      showToast("저장 공간을 사용할 수 없어 이번 세션만 진행됩니다.", "warning");
    }
  }

  function resetState() {
    state = defaultState();
    state.runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    state.initialClassChoices = availableClassChoices();
    ui = {
      ...ui,
      atTitle: false,
      view: "dungeons",
      modal: null,
      selectedClassId: null,
      selectedSkillId: null
    };
    actionLocked = false;
    clearTimeout(flowTimer);
    saveState();
    render();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value) {
    return Math.max(0, Math.round(value));
  }

  function pct(value) {
    return `${clamp(Number.isFinite(value) ? value : 0, 0, 100)}%`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function classById(id) {
    return CLASS_DATA.find((entry) => entry.id === id);
  }

  function dungeonById(id) {
    return DUNGEONS.find((entry) => entry.id === id);
  }

  function itemById(id) {
    return EQUIPMENT_CATALOG.find((entry) => entry.id === id);
  }

  function getXpRequired(level = state.level) {
    if (level >= MAX_LEVEL) return 0;
    return 80 + (level - 1) * 28;
  }

  function getClassMastery(selectedClass) {
    return clamp(state.level - selectedClass.acquiredAt + 1, 1, 10);
  }

  function hasClass(id) {
    return state.selectedClasses.some((entry) => entry.id === id);
  }

  function hasBeginnerProtection() {
    return state.level < 4;
  }

  function equipmentStats() {
    const result = {
      atk: 0,
      matk: 0,
      def: 0,
      mdef: 0,
      maxMana: 0,
      regen: 0,
      critChance: 0
    };
    Object.values(state.equipment).forEach((itemId) => {
      const item = itemById(itemId);
      if (!item) return;
      Object.entries(item.stats || {}).forEach(([key, value]) => {
        result[key] = (result[key] || 0) + value;
      });
    });
    return result;
  }

  function getCoreStats() {
    const levelOffset = state.level - 1;
    const gear = equipmentStats();
    const stats = {
      maxHp: BASE_PLAYER_STATS.maxHp + levelOffset * 20,
      atk: BASE_PLAYER_STATS.atk + levelOffset * 4,
      matk: BASE_PLAYER_STATS.matk + levelOffset * 4,
      def: BASE_PLAYER_STATS.def,
      mdef: BASE_PLAYER_STATS.mdef,
      maxMana: BASE_PLAYER_STATS.maxMana,
      regen: Math.min(
        20,
        BASE_PLAYER_STATS.regen + Math.max(0, state.selectedClasses.length - 1) * 5
      ),
      critChance: BASE_PLAYER_STATS.critChance,
      critDamage: BASE_PLAYER_STATS.critDamage,
      dreamMax: BASE_PLAYER_STATS.dreamCrystals
    };

    stats.atk += gear.atk || 0;
    stats.matk += gear.matk || 0;
    stats.def += gear.def || 0;
    stats.mdef += gear.mdef || 0;
    stats.maxMana += gear.maxMana || 0;
    stats.regen += gear.regen || 0;
    stats.critChance += gear.critChance || 0;

    state.selectedClasses.forEach(({ id }) => {
      switch (id) {
        case "magic_swordsman":
          stats.maxMana += 20;
          break;
        case "aether_saber":
          stats.maxMana += 30;
          stats.regen += 2;
          break;
        case "priest":
          stats.maxMana += 20;
          stats.regen += 4;
          break;
        case "archmage":
          stats.maxMana += 30;
          stats.regen += 2;
          break;
        case "witch":
          stats.critChance += 0.1;
          break;
        case "assassin":
          stats.critDamage += 0.3;
          break;
        case "moon_sage":
          stats.regen += 4;
          stats.dreamMax += 1;
          break;
        case "star_sage":
          stats.regen += 2;
          stats.dreamMax += 1;
          break;
        case "sun_sage":
          stats.critDamage += 0.3;
          stats.regen += 2;
          stats.dreamMax += 1;
          break;
        case "breaker":
          stats.critChance += 0.1;
          break;
        default:
          break;
      }
    });

    return Object.fromEntries(
      Object.entries(stats).map(([key, value]) => [
        key,
        ["critChance", "critDamage"].includes(key) ? value : round(value)
      ])
    );
  }

  function getPassiveRates() {
    const rates = { atk: 0, matk: 0, def: 0, mdef: 0, regen: 0 };
    state.selectedClasses.forEach(({ id }) => {
      switch (id) {
        case "magic_swordsman":
          rates.matk += 0.1;
          rates.mdef += 0.2;
          break;
        case "paladin":
          rates.atk += 0.1;
          rates.def += 0.2;
          break;
        case "aether_saber":
          rates.atk += 0.1;
          break;
        case "priest":
        case "archmage":
        case "witch":
          rates.matk += 0.1;
          break;
        case "assassin":
          rates.atk += 0.1;
          break;
        case "phantom":
          rates.atk += 0.1;
          rates.mdef += 0.2;
          break;
        case "moon_sage":
          rates.mdef += 0.2;
          break;
        case "star_sage":
          rates.def += 0.2;
          rates.mdef += 0.2;
          break;
        case "gardener":
          rates.atk += 0.1;
          rates.matk += 0.1;
          break;
        case "breaker":
          rates.mdef += 0.2;
          break;
        default:
          break;
      }
    });
    return rates;
  }

  function applyStatRates(core, rates) {
    const stats = { ...core };
    ["atk", "matk", "def", "mdef", "regen"].forEach((key) => {
      stats[key] = round(core[key] * Math.max(0, 1 + (rates[key] || 0)));
    });
    return stats;
  }

  function getBaseStats() {
    return applyStatRates(getCoreStats(), getPassiveRates());
  }

  function getBattleStats() {
    const core = getCoreStats();
    const battle = state.battle;
    if (!battle) return applyStatRates(core, getPassiveRates());
    const statuses = battle.player.statuses;
    const rates = getPassiveRates();
    const addRate = (keys, amount) => keys.forEach((key) => { rates[key] += amount; });

    if (hasClass("berserker") && battle.player.hp < core.maxHp * 0.5) {
      addRate(["atk", "def"], 0.3);
    }
    if (statuses.goddess) addRate(["atk", "matk", "def", "mdef"], 1);
    if (statuses.divine_armor) addRate(["def", "mdef"], 0.3);
    if (statuses.star_form) addRate(["def", "mdef"], 0.5);
    if (statuses.star_milk) addRate(["def", "mdef"], 0.3);
    if (statuses.sun_form) {
      addRate(["atk"], 1);
      addRate(["def"], -0.5);
    }
    if (statuses.moon_form) addRate(["matk"], 0.5);
    if (statuses.royal_bloom) addRate(["atk", "matk"], 0.3);
    if (statuses.meditation) {
      addRate(["matk"], -0.5);
      addRate(["regen"], 1);
    }
    if (statuses.reckless) addRate(["def", "mdef"], -0.5);
    if (statuses.adrenaline) {
      addRate(["def", "mdef"], -0.25);
    }
    if (statuses.instinct) addRate(["def", "mdef"], -0.25);
    if (statuses.attack_surge) addRate(["atk"], 1);
    if (statuses.castle_guard) addRate(["def"], 1);

    const divineStacks = statuses.divine?.stacks || 0;
    if (divineStacks) addRate(["def", "mdef"], divineStacks * 0.02);

    const stats = applyStatRates(core, rates);
    if (statuses.adrenaline) stats.critDamage += 1;
    if (statuses.mana_dress) {
      stats.regen += 10;
      stats.evasion = (stats.evasion || 0) + 0.1;
    }
    if (statuses.witch_veil) stats.evasion = (stats.evasion || 0) + 0.4;
    if (statuses.moonlight_veil) stats.evasion = (stats.evasion || 0) + 0.4;
    if (statuses.instinct) stats.evasion = (stats.evasion || 0) + 0.25;
    if (statuses.flower_dance) stats.evasion = (stats.evasion || 0) + 0.2;
    if (statuses.royal_focus) stats.critChance += 0.25;
    if (statuses.meteor_focus) stats.critChance += 0.4;

    return Object.fromEntries(
      Object.entries(stats).map(([key, value]) => [
        key,
        ["critChance", "critDamage", "evasion"].includes(key) ? value : round(value)
      ])
    );
  }

  function classRestrictionReason(classData) {
    const weapon = itemById(state.equipment.weapon);
    const armor = itemById(state.equipment.armor);
    if (weapon && classData.weaponRestrictions?.includes(weapon.type)) {
      return `${weapon.name} 장착으로 잠김`;
    }
    if (armor && classData.armorRestrictions?.includes(armor.type)) {
      return `${armor.name} 장착으로 잠김`;
    }
    return "";
  }

  function availableClassChoices(count = 6) {
    const pool = CLASS_DATA.filter((entry) => !hasClass(entry.id));
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((entry) => entry.id);
  }

  function announce(message) {
    liveRegion.textContent = "";
    requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  }

  function showToast(message, type = "") {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-hidden", "true");
      document.body.appendChild(stack);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`.trim();
    toast.textContent = message;
    stack.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.remove();
      if (!stack.children.length) stack.remove();
    }, 2600);
    announce(message);
  }

  function render() {
    app.setAttribute("aria-busy", "true");
    if (!ui.atTitle && state.battle?.result && !ui.modal) {
      ui.modal = { type: "battleResult" };
    }
    if (ui.atTitle) {
      app.innerHTML = renderTitle();
    } else if (!state.started || state.pendingClassChoices) {
      app.innerHTML = renderClassSelection();
    } else if (state.battle) {
      app.innerHTML = renderBattle();
    } else {
      app.innerHTML = renderHub();
    }
    if (ui.modal) app.insertAdjacentHTML("beforeend", renderModal());
    hydrateCombatImages();
    syncModalAccessibility();
    app.setAttribute("aria-busy", "false");
    requestAnimationFrame(() => {
      const panel = ui.modal ? app.querySelector("[data-modal-panel]") : null;
      const autoFocus = panel?.querySelector("[data-autofocus]") ||
        panel?.querySelector("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])") ||
        app.querySelector("[data-autofocus]");
      if (autoFocus) autoFocus.focus({ preventScroll: true });
    });
    if (!ui.atTitle) ensureAutoBattleFlow();
  }

  function renderTitle() {
    const canContinue = state.started;
    return `
      <main class="screen title-screen">
        <div class="eyebrow">Mobile roguelike RPG</div>
        <section class="title-copy" aria-labelledby="game-title">
          <div class="title-mark" aria-hidden="true">Ⅲ</div>
          <h1 id="game-title">삼중운명 <span>꿈의 잔향</span></h1>
          <p class="title-lede">세 번의 선택, 하나의 운명. 클래스를 엮고 장비의 대가를 감수하며 흑성의 끝까지 나아가세요.</p>
        </section>
        <div class="title-actions">
          ${canContinue ? `
            <button class="primary-button" data-action="continue-run">이어하기 · Lv.${state.level}</button>
            <button class="ghost-button" data-action="open-new-run">새로운 운명 시작</button>
          ` : `
            <button class="primary-button" data-action="new-run">새로운 운명 시작</button>
          `}
          <div class="title-meta" aria-label="게임 특징">
            <span>오프라인 실행</span><span>자동 저장</span><span>최대 Lv.30</span>
          </div>
        </div>
      </main>`;
  }

  function selectionCandidates() {
    if (state.pendingClassChoices) {
      const remaining = CLASS_DATA.length - state.selectedClasses.length;
      const expectedCount = Math.min(6, remaining);
      if (state.pendingClassChoices.choices?.length !== expectedCount) {
        state.pendingClassChoices.choices = availableClassChoices(expectedCount);
        saveState();
      }
      return state.pendingClassChoices.choices.map(classById).filter(Boolean);
    }
    if (state.initialClassChoices?.length !== Math.min(6, CLASS_DATA.length)) {
      state.initialClassChoices = availableClassChoices();
      saveState();
    }
    return state.initialClassChoices.map(classById).filter(Boolean);
  }

  function renderClassSelection() {
    const candidates = selectionCandidates();
    const isAdvancement = Boolean(state.pendingClassChoices);
    const selected = classById(ui.selectedClassId);
    const step = isAdvancement ? state.selectedClasses.length + 1 : 1;
    return `
      <main class="screen selection-screen">
        <header class="selection-head">
          <div class="eyebrow">${isAdvancement ? `Lv.${state.level} 운명 개화` : "첫 번째 운명"}</div>
          <h1>${isAdvancement ? "새 클래스를 선택하세요" : "루미의 길을 선택하세요"}</h1>
          <p>${isAdvancement
            ? "무작위로 제시된 여섯 클래스 중 하나가 기존 운명에 합류합니다. 선택지는 저장되어 새로고침해도 바뀌지 않습니다."
            : "무작위로 제시된 여섯 클래스 중 하나의 특성과 스킬로 런을 시작합니다. 이후 Lv.11과 Lv.21에서도 여섯 개가 제시됩니다."}</p>
          <div class="selection-progress" aria-label="${step}번째 클래스 선택">
            ${[1, 2, 3].map((index) => `<i class="${index <= step ? "active" : ""}"></i>`).join("")}
          </div>
        </header>
        <section class="class-grid" aria-label="선택 가능한 클래스">
          ${candidates.map((entry) => renderClassCard(entry, ui.selectedClassId === entry.id)).join("")}
        </section>
        <footer class="selection-footer">
          <div class="selection-summary">
            <strong>${selected ? escapeHtml(selected.name) : "클래스를 선택하세요"}</strong>
            <span>${selected ? escapeHtml(selected.trait?.text || "") : `${candidates.length}개의 운명이 기다립니다`}</span>
          </div>
          <button class="ghost-button compact-button" data-action="class-detail" data-class-id="${selected?.id || ""}" ${selected ? "" : "disabled"}>스킬</button>
          <button class="primary-button compact-button" data-action="confirm-class" ${selected ? "" : "disabled"}>
            ${isAdvancement ? "운명 결속" : "런 시작"}
          </button>
        </footer>
      </main>`;
  }

  function renderClassCard(entry, selected = false) {
    const restriction = [
      ...(entry.weaponRestrictions || []).map(equipmentTypeLabel),
      ...(entry.armorRestrictions || []).map(equipmentTypeLabel)
    ];
    return `
      <button
        class="class-card card-button ${selected ? "selected" : ""}"
        style="--class-color:${entry.color}"
        data-action="select-class"
        data-class-id="${entry.id}"
        aria-pressed="${selected}">
        <span class="class-sigil" aria-hidden="true">${escapeHtml(entry.glyph)}</span>
        <span>
          <h2>${escapeHtml(entry.name)}</h2>
          <p>${escapeHtml(entry.trait?.text || "")}</p>
          <span class="class-tags">
            ${(entry.roles || []).slice(0, 3).map((role) => `<span class="chip">${escapeHtml(roleLabel(role))}</span>`).join("")}
            ${restriction.length ? `<span class="chip rose">${escapeHtml(restriction.join("·"))} 제한</span>` : `<span class="chip green">장비 자유</span>`}
          </span>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>`;
  }

  function renderHub() {
    const stats = getBaseStats();
    const xpRequired = getXpRequired();
    return `
      <div class="screen app-shell">
        <header class="topbar">
          <div class="brand-lockup">
            <small>TRINITY NOCTURNE</small>
            <strong>삼중운명: 꿈의 잔향</strong>
          </div>
          <div class="level-orb" aria-label="현재 레벨 ${state.level}">
            <span>LV</span><b>${state.level}</b>
          </div>
        </header>
        <section class="run-strip" aria-label="현재 자원">
          <div class="micro-stat">
            <div class="micro-stat-row"><span>EXP</span><b>${state.level >= MAX_LEVEL ? "MAX" : `${state.xp}/${xpRequired}`}</b></div>
            <div class="meter" style="--meter-color:var(--xp)"><i style="--fill:${state.level >= MAX_LEVEL ? "100%" : pct((state.xp / xpRequired) * 100)}"></i></div>
          </div>
          <div class="micro-stat">
            <div class="micro-stat-row"><span>생명력</span><b>${stats.maxHp}</b></div>
            <div class="meter" style="--meter-color:var(--hp)"><i style="--fill:100%"></i></div>
          </div>
          <div class="run-resource"><span>결정</span><b>${stats.dreamMax}</b></div>
        </section>
        <main class="main-view">
          ${renderHubView()}
        </main>
        ${renderBottomNav()}
      </div>`;
  }

  function renderHubView() {
    switch (ui.view) {
      case "classes": return renderClassesView();
      case "equipment": return renderEquipmentView();
      case "status": return renderStatusView();
      default: return renderDungeonsView();
    }
  }

  function renderBottomNav() {
    return `
      <nav class="bottom-nav" aria-label="주 메뉴">
        ${NAV_ITEMS.map((item) => `
          <button class="nav-button ${ui.view === item.id ? "active" : ""}" data-action="change-view" data-view="${item.id}" aria-current="${ui.view === item.id ? "page" : "false"}">
            <span class="nav-icon" aria-hidden="true">${item.icon}</span>${item.label}
          </button>`).join("")}
      </nav>`;
  }

  function renderDungeonsView() {
    return `
      <div class="section-head">
        <div><small>ROGUELIKE ROUTE</small><h1>운명의 균열</h1></div>
        <p>던전마다 강해지는 마왕의 잔영을 쓰러뜨리고 장비를 수집하세요.</p>
      </div>
      <section class="dungeon-list" aria-label="던전 목록">
        ${DUNGEONS.map((dungeon, index) => {
          const unlocked = state.level >= dungeon.unlockLevel;
          const cleared = state.clearedDungeons.includes(dungeon.id);
          const latest = unlocked && !DUNGEONS[index + 1]?.unlockLevel || (
            unlocked && (!DUNGEONS[index + 1] || state.level < DUNGEONS[index + 1].unlockLevel)
          );
          return `${renderDungeonCard(dungeon, unlocked, cleared, latest)}${index < DUNGEONS.length - 1 ? '<div class="journey-line" aria-hidden="true"></div>' : ""}`;
        }).join("")}
      </section>`;
  }

  function renderDungeonCard(dungeon, unlocked, cleared, current) {
    const tierColor = TIER_COLORS[dungeon.tier] || "var(--violet)";
    return `
      <button
        class="dungeon-card card-button ${unlocked ? "" : "locked"} ${current ? "current" : ""}"
        style="--tier-color:${tierColor}"
        data-action="${unlocked ? "open-dungeon" : "locked-dungeon"}"
        data-dungeon-id="${dungeon.id}"
        ${unlocked ? "" : "aria-disabled=\"true\""}>
        <span class="dungeon-index" aria-hidden="true">${String(dungeon.order).padStart(2, "0")}</span>
        <span class="dungeon-copy">
          <h2>${escapeHtml(dungeon.name)}</h2>
          <p>${escapeHtml(dungeon.description)}</p>
          <span class="chip-row">
            <span class="chip">권장 Lv.${dungeon.enemyLevel}</span>
            <span class="chip ${dungeon.tier >= 4 ? "gold" : "violet"}">T${dungeon.tier} 보상</span>
            ${cleared ? '<span class="chip green">클리어</span>' : ""}
          </span>
        </span>
        <span class="dungeon-side">${unlocked ? `<b>${cleared ? "재도전" : "입장"}</b>70 / 30` : `<b>잠김</b>Lv.${dungeon.unlockLevel}`}</span>
      </button>`;
  }

  function renderClassesView() {
    return `
      <div class="section-head">
        <div><small>CLASS MASTERY</small><h1>결속된 운명</h1></div>
        <p>각 클래스는 합류 후 10레벨 동안 새로운 스킬을 해방합니다.</p>
      </div>
      <section class="detail-stack" aria-label="보유 클래스">
        ${state.selectedClasses.map((selected, index) => renderOwnedClass(selected, index)).join("")}
      </section>
      ${state.selectedClasses.length < 3 ? `
        <div class="status-panel">
          <h2>다음 운명의 개화</h2>
          <p>Lv.${state.selectedClasses.length === 1 ? 11 : 21}에 무작위 클래스 3개가 제시됩니다. 새 클래스를 선택하면 기본 마나 리젠이 +5 상승합니다.</p>
        </div>` : ""}`;
  }

  function renderOwnedClass(selected, index) {
    const entry = classById(selected.id);
    if (!entry) return "";
    const mastery = getClassMastery(selected);
    const nextSkill = entry.skills.find((skill) => skill.unlock > mastery);
    const reason = classRestrictionReason(entry);
    return `
      <article class="class-card owned-class" style="--class-color:${entry.color}">
        <div class="owned-class-head">
          <span class="class-sigil" aria-hidden="true">${escapeHtml(entry.glyph)}</span>
          <div><h2>${index + 1}차 · ${escapeHtml(entry.name)}</h2><p>${reason || entry.trait.text}</p></div>
          <div class="mastery">숙련 ${mastery}/10</div>
        </div>
        <div class="mastery-track" aria-label="숙련도 ${mastery}">
          ${Array.from({ length: 10 }, (_, i) => `<i class="${i < mastery ? "filled" : ""}"></i>`).join("")}
        </div>
        <div class="next-unlock">
          <span>${reason ? "스킬 비활성" : nextSkill ? "다음 해방" : "모든 스킬 해방"}</span>
          <b>${reason ? escapeHtml(reason) : nextSkill ? `숙련 ${nextSkill.unlock} · ${escapeHtml(nextSkill.name)}` : `${entry.skills.length}개 습득 완료`}</b>
        </div>
        <button class="ghost-button compact-button" data-action="class-detail" data-class-id="${entry.id}">상세 보기</button>
      </article>`;
  }

  function renderEquipmentView() {
    const weapon = itemById(state.equipment.weapon);
    const armor = itemById(state.equipment.armor);
    const items = state.inventory
      .map(itemById)
      .filter(Boolean)
      .filter((item) => ui.inventoryFilter === "all" || item.slot === ui.inventoryFilter)
      .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name, "ko"));
    return `
      <div class="section-head">
        <div><small>EQUIPMENT</small><h1>운명의 장비</h1></div>
        <p>높은 능력치에는 대가가 따릅니다. 제한 장비는 클래스 스킬만 잠급니다.</p>
      </div>
      <section class="equipment-slots" aria-label="착용 장비">
        ${renderEquipmentSlot("weapon", weapon)}
        ${renderEquipmentSlot("armor", armor)}
      </section>
      <div class="inventory-filter" role="group" aria-label="장비 필터">
        ${[
          ["all", "전체"],
          ["weapon", "무기"],
          ["armor", "방어구"]
        ].map(([id, label]) => `<button class="filter-button ${ui.inventoryFilter === id ? "active" : ""}" data-action="inventory-filter" data-filter="${id}">${label}</button>`).join("")}
      </div>
      <section class="equipment-list" aria-label="보유 장비">
        ${items.length ? items.map(renderEquipmentCard).join("") : '<div class="empty-state">아직 획득한 장비가 없습니다.<br>던전에서 마왕의 잔영을 쓰러뜨려 보세요.</div>'}
      </section>`;
  }

  function renderEquipmentSlot(slot, item) {
    return `
      <button class="equipment-slot card-button ${item ? "filled" : ""}" style="--tier-color:${item ? TIER_COLORS[item.tier] : "var(--violet)"}" data-action="${item ? "open-item" : "noop"}" ${item ? `data-item-id="${item.id}"` : "disabled"}>
        <span class="slot-label">${slot === "weapon" ? "WEAPON" : "ARMOR"}</span>
        <h3>${item ? escapeHtml(item.name) : slot === "weapon" ? "무기 없음" : "방어구 없음"}</h3>
        <p>${item ? `${TIER_LABELS[item.tier]} · ${equipmentTypeLabel(item.type)}` : "던전 드랍으로 획득"}</p>
      </button>`;
  }

  function renderEquipmentCard(item) {
    const equipped = state.equipment[item.slot] === item.id;
    return `
      <button class="equipment-card card-button" style="--tier-color:${TIER_COLORS[item.tier]}" data-action="open-item" data-item-id="${item.id}">
        <span class="item-glyph" aria-hidden="true">${escapeHtml(item.glyph)}</span>
        <span class="equipment-copy">
          <h3>${escapeHtml(item.name)}</h3>
          <p>T${item.tier} ${TIER_LABELS[item.tier]} · ${formatItemStats(item)}</p>
        </span>
        <span class="equipped-label">${equipped ? "착용 중" : "보기"}</span>
      </button>`;
  }

  function renderStatusView() {
    const stats = getBaseStats();
    return `
      <div class="section-head">
        <div><small>STATUS</small><h1>루미의 기록</h1></div>
        <p>레벨로 공격과 체력이 성장하며 방어력은 장비와 특성으로 강화됩니다.</p>
      </div>
      <section class="stat-grid" aria-label="능력치">
        ${[
          ["생명력", stats.maxHp],
          ["물리 공격", stats.atk],
          ["마법 공격", stats.matk],
          ["물리 방어", stats.def],
          ["마법 방어", stats.mdef],
          ["최대 마나", stats.maxMana],
          ["마나 리젠", stats.regen],
          ["치명타율", `${round(stats.critChance * 100)}%`],
          ["치명타 피해", `+${round(stats.critDamage * 100)}%`],
          ["꿈의 결정", stats.dreamMax]
        ].map(([label, value]) => `<div class="stat-tile"><span>${label}</span><b>${value}</b></div>`).join("")}
      </section>
      <section class="status-panel">
        <h2>이번 운명의 조합</h2>
        <div class="chip-row" style="margin-top:10px">
          ${state.selectedClasses.map(({ id }) => {
            const entry = classById(id);
            return entry ? `<span class="chip gold">${escapeHtml(entry.name)}</span>` : "";
          }).join("")}
        </div>
        <p>클래스 특성은 제한 장비를 착용해도 항상 유지됩니다. 장비와 버프를 포함한 전투 중 수치는 상태 시트에서 실시간으로 확인할 수 있습니다.</p>
      </section>
      <section class="status-panel">
        <h2>런 기록</h2>
        <p>승리 ${state.battlesWon}회 · 최고 피해 ${state.highestDamage.toLocaleString("ko-KR")} · 클리어 던전 ${state.clearedDungeons.length}/10</p>
      </section>
      <button class="danger-button" style="width:100%;margin-top:12px" data-action="open-new-run">현재 런 포기</button>`;
  }

  function renderBattle() {
    const battle = state.battle;
    const stats = getBattleStats();
    const playerStatuses = renderCombatStatuses("player");
    const enemyStatuses = renderCombatStatuses("enemy");
    const warning = battle.player.statuses.stun
      ? "기절 · 다음 행동을 할 수 없습니다"
      : battle.charge
        ? `${escapeHtml(battle.charge.name)} 충전 중 · 다음 행동에 자동 발동`
        : classRestrictionSummary();
    const armor = itemById(state.equipment.armor);
    const armorSkillCount = armor?.armorSkills?.length || 0;
    return `
      <main class="screen battle-screen">
        <header class="battle-topbar">
          <button class="icon-button" data-action="open-flee" aria-label="전투에서 후퇴">←</button>
          <div class="battle-title">
            <strong>${escapeHtml(battle.dungeonName)}</strong>
            <span>TURN ${battle.turn} · ${battle.phase === "player" ? "루미의 턴" : "마왕의 턴"}</span>
          </div>
          <button class="icon-button" data-action="open-log" aria-label="전투 기록 보기">≡</button>
        </header>
        <section class="battle-stage" aria-label="전투 화면">
          <article class="combatant enemy">
            <span class="combatant-art combatant-art-placeholder" data-combat-image="demon" aria-hidden="true"></span>
            <div class="combatant-hud">
              <div class="combatant-name"><strong>${escapeHtml(battle.enemy.name)}</strong><span>Lv.${battle.enemy.level} · 마왕형</span></div>
              <div class="resource-row">
                <div class="meter" role="progressbar" aria-label="${escapeHtml(battle.enemy.name)} 생명력" aria-valuemin="0" aria-valuemax="${battle.enemy.maxHp}" aria-valuenow="${round(battle.enemy.hp)}" style="--meter-color:var(--hp)"><i style="--fill:${pct((battle.enemy.hp / battle.enemy.maxHp) * 100)}"></i></div>
                <b>${round(battle.enemy.hp)} / ${battle.enemy.maxHp}</b>
              </div>
              <div class="combat-status-row">${enemyStatuses || '<span class="chip">상태 이상 없음</span>'}</div>
            </div>
            ${ui.damagePop?.target === "enemy" ? `<div class="damage-pop ${ui.damagePop.critical ? "critical" : ""}">${ui.damagePop.critical ? "CRIT " : ""}${ui.damagePop.value}</div>` : ""}
          </article>
          <div class="battle-event" role="status" aria-live="polite" aria-atomic="true">${formatBattleEvent(battle.event)}</div>
          <article class="combatant player">
            <span class="combatant-art combatant-art-placeholder" data-combat-image="lumi" aria-hidden="true"></span>
            <div class="combatant-hud">
              <div class="combatant-name"><strong>루미</strong><span>Lv.${state.level} · ${state.selectedClasses.map(({ id }) => classById(id)?.name).filter(Boolean).join(" / ")}</span></div>
              <div class="resource-row">
                <div class="meter" role="progressbar" aria-label="루미 생명력" aria-valuemin="0" aria-valuemax="${stats.maxHp}" aria-valuenow="${round(battle.player.hp)}" style="--meter-color:var(--hp)"><i style="--fill:${pct((battle.player.hp / stats.maxHp) * 100)}"></i></div>
                <b>${round(battle.player.hp)} / ${stats.maxHp}</b>
              </div>
              <div class="resource-row">
                <div class="meter" role="progressbar" aria-label="루미 마나" aria-valuemin="0" aria-valuemax="${stats.maxMana}" aria-valuenow="${round(battle.player.mana)}" style="--meter-color:var(--mp)"><i style="--fill:${pct((battle.player.mana / stats.maxMana) * 100)}"></i></div>
                <b>${round(battle.player.mana)} / ${stats.maxMana}</b>
              </div>
              <div class="combat-status-row">${playerStatuses || '<span class="chip">버프 없음</span>'}</div>
            </div>
            ${ui.damagePop?.target === "player" ? `<div class="damage-pop ${ui.damagePop.critical ? "critical" : ""}">${ui.damagePop.value}</div>` : ""}
          </article>
        </section>
        <footer class="battle-controls">
          ${warning ? `<div class="warning-banner">${escapeHtml(warning)}</div>` : ""}
          <div class="battle-resource-bar">
            <span>마나 리젠 <strong>+${stats.regen}</strong></span>
            <span>꿈의 결정 <strong>${battle.player.dream}/${stats.dreamMax}</strong></span>
            <span>적 행동 <strong>${DUMMY_ENEMY.actions.map((action) => `${action.type === "magic" ? "마법" : "물리"} ${action.chance}%`).join(" · ")}</strong></span>
          </div>
          <div class="battle-actions">
            <button class="battle-action primary" data-action="basic-attack" ${battleButtonsDisabled() ? "disabled" : ""}>기본 공격<small>물리 100% · MP 0</small></button>
            <button class="battle-action accent" data-action="open-skills" ${battleButtonsDisabled() ? "disabled" : ""}>클래스 스킬<small>${getUnlockedSkills().length}개 사용 가능</small></button>
            <button class="battle-action" data-action="open-armor-skills" ${battleButtonsDisabled() || !armorSkillCount ? "disabled" : ""}>방어 태세<small>${armor ? escapeHtml(armor.name) : "방어구 필요"}</small></button>
            <button class="battle-action" data-action="open-battle-status">상태<small>효과 확인</small></button>
          </div>
        </footer>
      </main>`;
  }

  function battleButtonsDisabled() {
    return actionLocked || !state.battle || state.battle.phase !== "player" || Boolean(state.battle.result);
  }

  function classRestrictionSummary() {
    const disabled = state.selectedClasses
      .map(({ id }) => classById(id))
      .filter(Boolean)
      .map((entry) => ({ name: entry.name, reason: classRestrictionReason(entry) }))
      .filter((entry) => entry.reason);
    if (!disabled.length) return "";
    return `${disabled.map((entry) => entry.name).join(" · ")} 스킬 비활성 — 특성은 유지`;
  }

  function renderCombatStatuses(target) {
    const battle = state.battle;
    if (!battle) return "";
    const statuses = target === "player" ? battle.player.statuses : battle.enemy.statuses;
    const labels = [];
    const add = (key, label, tone = "", suffix = "") => {
      if (!statuses[key]) return;
      const status = statuses[key];
      const count = status.stacks ? ` ×${status.stacks}` : "";
      const turns = status.turns ? ` · ${status.turns}T` : "";
      labels.push(`<span class="chip ${tone}">${escapeHtml(label)}${count}${turns}${suffix}</span>`);
    };
    if (target === "enemy") {
      add("darkness", "암흑", "violet");
      add("rose", "장미", "rose");
      const addStatMods = (stat, label) => {
        const modifiers = Object.values(battle.enemy.statMods?.[stat] || {});
        if (!modifiers.length) return;
        const total = modifiers.reduce((sum, modifier) => sum + (modifier.rate || 0), 0);
        const turns = Math.max(...modifiers.map((modifier) => modifier.turns || 0));
        labels.push(
          `<span class="chip blue">${escapeHtml(label)} ${round(Math.abs(total) * 100)}%${turns ? ` · ${turns}T` : ""}</span>`
        );
      };
      addStatMods("def", "물방↓");
      addStatMods("mdef", "마방↓");
      add("stun", "기절", "gold");
    } else {
      add("guard", "가드", "gold");
      add("dodge_stance", "회피 태세", "blue");
      add("barrier", "배리어", "blue");
      add("magic_guard", "매직가드", "blue");
      add("reckless", "방어 취약", "rose");
      add("castle_guard", "성채 방어", "gold");
      add("luna_evade", "달빛 회피", "violet");
      add("star_barrier", "스타 배리어", "blue");
      add("star_milk", "별빛 강화", "blue");
      add("meteor_focus", "메테오 집중", "gold");
      add("flower_dance", "플라워 댄스", "rose");
      add("royal_focus", "로열 포커스", "rose");
      add("divine", "디바인", "gold");
      add("divine_armor", "디바인 아머", "gold");
      add("undying", "언다잉", "gold");
      add("attack_surge", "공격 증폭", "rose");
      add("fire_enchant", "화염 인챈트", "rose");
      add("meditation", "명상", "blue");
      add("mana_dress", "마나 드레스", "blue");
      add("sanctuary", "생츄어리", "gold");
      add("goddess", "여신강림", "gold");
      add("witch_veil", "어둠의 베일", "violet");
      add("moonlight_veil", "문라이트 베일", "violet");
      add("adrenaline", "아드레날린", "rose");
      add("instinct", "인스팅트", "violet");
      add("moon_form", "달의 형태", "violet");
      add("star_form", "별의 형태", "blue");
      add("sun_form", "태양의 형태", "gold");
      add("queen_domain", "퀸즈 도메인", "rose");
      add("royal_bloom", "로열 블룸", "rose");
      add("beginner_guard", "초보자 보호", "green");
      add("stun", "기절", "rose");
      add("charge", "차징", "gold");
    }
    return labels.join("");
  }

  function formatBattleEvent(event) {
    if (!event) return "<b>루미</b>의 행동을 선택하세요.";
    const safe = escapeHtml(event);
    const index = safe.indexOf("·");
    if (index < 0) return safe;
    return `<b>${safe.slice(0, index)}</b>${safe.slice(index)}`;
  }

  function renderModal() {
    const modal = ui.modal;
    if (!modal) return "";
    switch (modal.type) {
      case "newRun":
        return renderConfirmDialog(
          "새로운 운명을 시작할까요?",
          state.started ? "현재 레벨, 클래스, 장비와 던전 기록이 모두 지워집니다. 이 선택은 되돌릴 수 없습니다." : "첫 클래스를 선택하고 새로운 런을 시작합니다.",
          "새 런 시작",
          "confirm-new-run",
          true
        );
      case "classDetail":
        return renderClassDetailModal(classById(modal.classId));
      case "dungeon":
        return renderDungeonModal(dungeonById(modal.dungeonId));
      case "item":
        return renderItemModal(itemById(modal.itemId));
      case "skills":
        return renderSkillSheet();
      case "armorSkills":
        return renderArmorSkillSheet();
      case "battleStatus":
        return renderBattleStatusModal();
      case "battleLog":
        return renderBattleLogModal();
      case "flee":
        return renderConfirmDialog("균열에서 후퇴할까요?", "보상 없이 전투를 종료합니다. 현재 런과 획득한 장비는 유지됩니다.", "후퇴", "confirm-flee", true);
      case "battleResult":
        return renderBattleResultModal();
      default:
        return "";
    }
  }

  function renderConfirmDialog(title, body, confirmLabel, action, danger = false) {
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-modal-panel>
          <header class="modal-head">
            <div><small>CONFIRM</small><h2 id="dialog-title">${escapeHtml(title)}</h2></div>
            <button class="icon-button" data-action="close-modal" aria-label="닫기">×</button>
          </header>
          <div class="modal-body"><p style="color:var(--muted);font-size:.82rem;line-height:1.7">${escapeHtml(body)}</p></div>
          <footer class="modal-footer">
            <button class="ghost-button" data-action="close-modal">취소</button>
            <button class="${danger ? "danger-button" : "primary-button"}" data-action="${action}" data-autofocus>${escapeHtml(confirmLabel)}</button>
          </footer>
        </section>
      </div>`;
  }

  function renderClassDetailModal(entry) {
    if (!entry) return "";
    const restriction = [
      ...(entry.weaponRestrictions || []).map(equipmentTypeLabel),
      ...(entry.armorRestrictions || []).map(equipmentTypeLabel)
    ];
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="class-detail-title" data-modal-panel>
          <div class="detail-hero" style="--detail-color:${entry.color}">
            <span class="class-sigil" style="--class-color:${entry.color}" aria-hidden="true">${escapeHtml(entry.glyph)}</span>
            <h2 id="class-detail-title">${escapeHtml(entry.name)}</h2>
            <p>${escapeHtml(entry.comment || "")}</p>
          </div>
          <div class="detail-section">
            <h3>특성 · 항상 활성</h3>
            <p>${escapeHtml(entry.trait?.text || "")}</p>
          </div>
          <div class="detail-section">
            <h3>장비 제한</h3>
            <p>${restriction.length ? `${escapeHtml(restriction.join(", "))} 착용 시 이 클래스의 액티브 스킬이 비활성화됩니다. 특성은 유지됩니다.` : "무기와 방어구 제한이 없습니다."}</p>
          </div>
          <div class="detail-section">
            <h3>숙련 스킬</h3>
            ${entry.skills.map((skill) => `
              <div class="detail-skill">
                <strong>${escapeHtml(skill.name)}<span>숙련 ${skill.unlock} · MP ${skill.mp}</span></strong>
                <p>${escapeHtml(skill.text)}</p>
              </div>`).join("")}
          </div>
          <footer class="modal-footer" style="grid-template-columns:1fr">
            <button class="primary-button" data-action="close-modal" data-autofocus>확인</button>
          </footer>
        </section>
      </div>`;
  }

  function renderDungeonModal(dungeon) {
    if (!dungeon) return "";
    const preview = createEnemy(dungeon, 0, 0);
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dungeon-title" data-modal-panel>
          <div class="detail-hero" style="--detail-color:${TIER_COLORS[dungeon.tier]}">
            <span class="class-sigil" style="--class-color:${TIER_COLORS[dungeon.tier]}" aria-hidden="true">${String(dungeon.order).padStart(2, "0")}</span>
            <h2 id="dungeon-title">${escapeHtml(dungeon.name)}</h2>
            <p>${escapeHtml(dungeon.description)}</p>
          </div>
          <div class="detail-section">
            <h3>마왕의 잔영 · Lv.${preview.level}</h3>
            <div class="chip-row">
              <span class="chip">HP ${preview.maxHp}</span>
              <span class="chip">공격 ${preview.atk}</span>
              <span class="chip">마공 ${preview.matk}</span>
              <span class="chip">방어 ${preview.def}</span>
              <span class="chip">마방 ${preview.mdef}</span>
            </div>
          </div>
          <div class="detail-section">
            <h3>행동 성향</h3>
            <p>70% 확률로 물리 일반공격, 30% 확률로 마법공격력 200%의 심연 주문을 사용합니다. 루미의 행동이 항상 먼저입니다.</p>
          </div>
          <div class="detail-section">
            <h3>예상 보상</h3>
            <p>경험치 ${getDungeonXpReward(dungeon)} · 주 보상 T${dungeon.tier} ${TIER_LABELS[dungeon.tier]} 장비. 낮은 확률로 상위 티어 장비가 등장합니다.</p>
          </div>
          <footer class="modal-footer">
            <button class="ghost-button" data-action="close-modal">취소</button>
            <button class="primary-button" data-action="enter-dungeon" data-dungeon-id="${dungeon.id}" data-autofocus>균열 입장</button>
          </footer>
        </section>
      </div>`;
  }

  function renderItemModal(item) {
    if (!item) return "";
    const equipped = state.equipment[item.slot] === item.id;
    const restricted = state.selectedClasses
      .map(({ id }) => classById(id))
      .filter((entry) => entry && (
        item.slot === "weapon"
          ? entry.weaponRestrictions?.includes(item.type)
          : entry.armorRestrictions?.includes(item.type)
      ));
    const actionLabel = equipped
      ? "장비 해제"
      : restricted.length
        ? `장착하고 ${restricted.reduce((sum, entry) => sum + entry.skills.length, 0)}개 스킬 잠금`
        : "장착";
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="item-title" data-modal-panel>
          <div class="detail-hero" style="--detail-color:${TIER_COLORS[item.tier]}">
            <span class="class-sigil" style="--class-color:${TIER_COLORS[item.tier]}" aria-hidden="true">${escapeHtml(item.glyph)}</span>
            <h2 id="item-title">${escapeHtml(item.name)}</h2>
            <p>T${item.tier} ${TIER_LABELS[item.tier]} · ${equipmentTypeLabel(item.type)}</p>
          </div>
          <div class="detail-section">
            <h3>능력치</h3>
            <div class="chip-row">${Object.entries(item.stats).map(([key, value]) => `<span class="chip gold">${statLabel(key)} +${key === "critChance" ? `${round(value * 100)}%` : value}</span>`).join("")}</div>
          </div>
          ${item.armorSkills?.length ? `
            <div class="detail-section">
              <h3>방어구 메인 스킬</h3>
              <p>${item.armorSkills.map((id) => ARMOR_SKILLS[id]?.name).filter(Boolean).join(" · ")}</p>
            </div>` : ""}
          <div class="detail-section">
            <h3>${restricted.length ? "클래스 충돌" : "장착 효과"}</h3>
            <p>${restricted.length
              ? `${restricted.map((entry) => entry.name).join(", ")}의 액티브 스킬이 비활성화됩니다. 클래스 특성은 그대로 적용됩니다.`
              : "현재 조합과 충돌하지 않습니다."}</p>
          </div>
          <footer class="modal-footer">
            <button class="ghost-button" data-action="close-modal">취소</button>
            <button class="${equipped ? "danger-button" : "primary-button"}" data-action="toggle-equip" data-item-id="${item.id}" data-autofocus>${escapeHtml(actionLabel)}</button>
          </footer>
        </section>
      </div>`;
  }

  function renderSkillSheet() {
    const skills = getUnlockedSkills();
    const filtered = skills.filter((entry) => ui.skillFilter === "all" || entry.classId === ui.skillFilter);
    const selected = skills.find((entry) => entry.skill.id === ui.selectedSkillId);
    const disabledReason = selected ? skillDisabledReason(selected) : "스킬을 선택하세요";
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="skill-sheet-title" data-modal-panel>
          <div class="sheet-grip" aria-hidden="true"></div>
          <header class="modal-head">
            <div><small>ACTIVE SKILLS</small><h2 id="skill-sheet-title">클래스 스킬</h2></div>
            <button class="icon-button" data-action="close-modal" aria-label="닫기">×</button>
          </header>
          <div class="modal-body">
            <div class="skill-filters" role="group" aria-label="클래스 필터">
              <button class="filter-button ${ui.skillFilter === "all" ? "active" : ""}" data-action="skill-filter" data-filter="all">전체</button>
              ${state.selectedClasses.map(({ id }, index) => {
                const entry = classById(id);
                return entry ? `<button class="filter-button ${ui.skillFilter === id ? "active" : ""}" data-action="skill-filter" data-filter="${id}">${index + 1}차 · ${escapeHtml(entry.name)}</button>` : "";
              }).join("")}
            </div>
            <div class="skill-grid">
              ${filtered.map((entry) => renderSkillCard(entry, ui.selectedSkillId === entry.skill.id)).join("")}
            </div>
          </div>
          <footer class="modal-footer">
            <button class="ghost-button" data-action="close-modal">취소</button>
            <button class="primary-button" data-action="use-selected-skill" ${selected && !disabledReason ? "" : "disabled"}>${selected ? `${escapeHtml(selected.skill.name)} 사용` : "스킬 선택"}</button>
          </footer>
        </section>
      </div>`;
  }

  function renderSkillCard(entry, selected) {
    const reason = skillDisabledReason(entry);
    return `
      <button class="skill-card ${selected ? "selected" : ""} ${reason ? "locked" : ""}" data-action="select-skill" data-skill-id="${entry.skill.id}" aria-pressed="${selected}">
        <span class="skill-card-head">
          <h3>${escapeHtml(entry.skill.name)}</h3>
          <span class="skill-cost">MP ${entry.skill.mp}</span>
        </span>
        <p>${escapeHtml(entry.skill.text)}</p>
        <span class="skill-source">${escapeHtml(entry.className)} · 숙련 ${entry.skill.unlock}</span>
        ${reason ? `<span class="lock-reason">잠김 · ${escapeHtml(reason)}</span>` : ""}
      </button>`;
  }

  function renderArmorSkillSheet() {
    const armor = itemById(state.equipment.armor);
    const skills = (armor?.armorSkills || []).map((id) => ARMOR_SKILLS[id]).filter(Boolean);
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="armor-skill-title" data-modal-panel>
          <div class="sheet-grip" aria-hidden="true"></div>
          <header class="modal-head">
            <div><small>ARMOR STANCE</small><h2 id="armor-skill-title">${escapeHtml(armor?.name || "방어 태세")}</h2></div>
            <button class="icon-button" data-action="close-modal" aria-label="닫기">×</button>
          </header>
          <div class="modal-body">
            <div class="skill-grid">
              ${skills.map((skill) => {
                const unavailable = state.battle.player.mana < skill.mp;
                return `
                  <button class="skill-card ${unavailable ? "locked" : ""}" data-action="use-armor-skill" data-armor-skill-id="${skill.id}" ${unavailable ? "disabled" : ""}>
                    <span class="skill-card-head"><h3>${escapeHtml(skill.name)}</h3><span class="skill-cost">MP ${skill.mp}</span></span>
                    <p>${escapeHtml(skill.text)}</p>
                    ${unavailable ? '<span class="lock-reason">마나 부족</span>' : '<span class="skill-source">이번 적 행동에 적용</span>'}
                  </button>`;
              }).join("")}
            </div>
          </div>
        </section>
      </div>`;
  }

  function renderBattleStatusModal() {
    const stats = getBattleStats();
    const battle = state.battle;
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="battle-status-title" data-modal-panel>
          <header class="modal-head">
            <div><small>LIVE STATUS</small><h2 id="battle-status-title">전투 상태</h2></div>
            <button class="icon-button" data-action="close-modal" aria-label="닫기">×</button>
          </header>
          <div class="modal-body">
            <div class="stat-grid">
              ${[
                ["공격", stats.atk],
                ["마공", stats.matk],
                ["방어", stats.def],
                ["마방", stats.mdef],
                ["치명", `${round(stats.critChance * 100)}%`],
                ["회피", `${round((stats.evasion || 0) * 100)}%`],
                ["리젠", stats.regen],
                ["결정", `${battle.player.dream}/${stats.dreamMax}`]
              ].map(([label, value]) => `<div class="stat-tile"><span>${label}</span><b>${value}</b></div>`).join("")}
            </div>
            <div class="status-panel">
              <h2>루미</h2>
              <div class="chip-row" style="margin-top:9px">${renderCombatStatuses("player") || '<span class="chip">효과 없음</span>'}</div>
            </div>
            <div class="status-panel">
              <h2>${escapeHtml(battle.enemy.name)}</h2>
              <div class="chip-row" style="margin-top:9px">${renderCombatStatuses("enemy") || '<span class="chip">효과 없음</span>'}</div>
            </div>
            <div class="status-panel">
              <h2>상태 규칙</h2>
              <p>암흑은 스택당 물리방어력 10% 감소(최대 5), 장미는 스택당 매 라운드 물리·마법공격력 5%의 마법피해(최대 15), 디바인은 스택당 양 방어력 2% 증가(최대 10)입니다.</p>
            </div>
          </div>
          <footer class="modal-footer" style="grid-template-columns:1fr">
            <button class="primary-button" data-action="close-modal" data-autofocus>전투로 돌아가기</button>
          </footer>
        </section>
      </div>`;
  }

  function renderBattleLogModal() {
    const logs = state.battle?.log || [];
    return `
      <div class="overlay" data-action="overlay-close">
        <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="battle-log-title" data-modal-panel>
          <div class="sheet-grip" aria-hidden="true"></div>
          <header class="modal-head">
            <div><small>BATTLE LOG</small><h2 id="battle-log-title">전투 기록</h2></div>
            <button class="icon-button" data-action="close-modal" aria-label="닫기">×</button>
          </header>
          <div class="modal-body">
            <div class="combat-log">
              ${[...logs].reverse().map((entry) => `<div class="log-entry"><b>TURN ${entry.turn}</b><span>${escapeHtml(entry.text)}</span></div>`).join("")}
            </div>
          </div>
        </section>
      </div>`;
  }

  function renderBattleResultModal() {
    const result = state.battle?.result;
    if (!result) return "";
    const victory = result.type === "victory";
    const item = itemById(result.itemId);
    return `
      <div class="overlay">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="result-title" data-modal-panel>
          <div class="detail-hero" style="--detail-color:${victory ? "var(--gold)" : "var(--red)"}">
            <span class="class-sigil" style="--class-color:${victory ? "var(--gold)" : "var(--red)"}" aria-hidden="true">${victory ? "✦" : "×"}</span>
            <h2 id="result-title">${victory ? "균열 정화 완료" : "운명이 꺾였습니다"}</h2>
            <p>${victory ? `${escapeHtml(state.battle.enemy.name)}을 쓰러뜨리고 꿈의 잔향을 회수했습니다.` : "루미는 균열 밖에서 다시 깨어납니다. 런 진행과 장비는 유지됩니다."}</p>
          </div>
          <div class="modal-body">
            <div class="result-stats">
              <div class="result-stat"><span>경험치</span><b>${victory ? `+${result.xp}` : "—"}</b></div>
              <div class="result-stat"><span>도달 레벨</span><b>Lv.${state.level}</b></div>
            </div>
            ${item ? `
              <div class="loot-card" style="--tier-color:${TIER_COLORS[item.tier]}">
                <span class="item-glyph" aria-hidden="true">${escapeHtml(item.glyph)}</span>
                <h3>${escapeHtml(item.name)}</h3>
                <p>T${item.tier} ${TIER_LABELS[item.tier]} · ${formatItemStats(item)}</p>
              </div>` : ""}
            ${result.levelUps?.length ? `
              <div class="status-panel">
                <h2>레벨 상승 · ${result.levelUps.map((level) => `Lv.${level}`).join(", ")}</h2>
                <p>최대 생명력과 물리·마법공격력이 성장했습니다.${state.pendingClassChoices ? " 새로운 클래스 선택이 열렸습니다." : ""}</p>
              </div>` : ""}
          </div>
          <footer class="modal-footer" style="grid-template-columns:1fr">
            <button class="primary-button" data-action="finish-battle-result" data-autofocus>${state.pendingClassChoices ? "새 운명 선택" : "던전으로 돌아가기"}</button>
          </footer>
        </section>
      </div>`;
  }

  function getUnlockedSkills() {
    const unlocked = state.selectedClasses.flatMap((selected) => {
      const entry = classById(selected.id);
      if (!entry) return [];
      const mastery = getClassMastery(selected);
      return entry.skills
        .filter((skill) => skill.unlock <= mastery)
        .map((skill) => ({
          skill,
          classId: entry.id,
          className: entry.name,
          classData: entry
        }));
    });
    const result = [];
    unlocked.forEach((entry) => {
      if (entry.skill.effect !== "dream_form") {
        result.push(entry);
        return;
      }
      const existingIndex = result.findIndex((candidate) => candidate.skill.effect === "dream_form");
      if (existingIndex < 0) {
        result.push(entry);
      } else if (classRestrictionReason(result[existingIndex].classData) && !classRestrictionReason(entry.classData)) {
        result[existingIndex] = entry;
      }
    });
    return result;
  }

  function skillDisabledReason(entry) {
    if (!state.battle) return "";
    const restriction = classRestrictionReason(entry.classData);
    if (restriction) return restriction;
    if (state.battle.player.mana < entry.skill.mp) return "마나 부족";
    if (["moon_form", "star_form", "sun_form"].includes(entry.skill.effect) && state.battle.player.dream <= 0) {
      return "꿈의 결정 부족";
    }
    if (state.battle.player.statuses.stun) return "기절";
    return "";
  }

  function equipmentTypeLabel(type) {
    return {
      greatsword: "대검",
      dagger: "단검",
      staff: "스태프",
      orb: "오브",
      heavy: "중갑옷",
      light: "경갑옷",
      cloth: "천옷"
    }[type] || type;
  }

  function roleLabel(role) {
    return {
      physical: "물리",
      magic: "마법",
      hybrid: "하이브리드",
      burst: "폭발",
      risk: "위험",
      debuffer: "약화",
      enchanter: "강화",
      tank: "방어",
      scaling: "성장",
      mana: "마나",
      support: "지원",
      healer: "회복",
      buffer: "버프",
      evasion: "회피",
      critical: "치명",
      counter: "반격",
      form: "형태",
      damage_over_time: "지속피해",
      control: "제어",
      rose: "장미"
    }[role] || role;
  }

  function statLabel(key) {
    return {
      atk: "물리공격",
      matk: "마법공격",
      def: "물리방어",
      mdef: "마법방어",
      maxMana: "최대마나",
      regen: "마나리젠",
      critChance: "치명타율"
    }[key] || key;
  }

  function formatItemStats(item) {
    return Object.entries(item.stats || {})
      .map(([key, value]) => `${statLabel(key)} +${key === "critChance" ? `${round(value * 100)}%` : value}`)
      .join(" · ");
  }

  function createEnemy(dungeon, encounterIndex = 0, affixRoll = null) {
    const minimum = dungeon.enemyLevel || dungeon.unlockLevel;
    const maximum = dungeon.levelRange?.[1] || minimum + 2;
    const level = clamp(
      Math.max(minimum, Math.min(state.level, maximum)) + Math.floor(encounterIndex / 2),
      1,
      MAX_LEVEL
    );
    const names = dungeon.encounterNames || dungeon.enemyNames || ["마왕의 잔영"];
    const baseName = names[encounterIndex % names.length] || "마왕의 잔영";
    const roll = affixRoll ?? Math.random();
    let affix = "";
    let hpMultiplier = 1;
    let attackMultiplier = 1;
    let defenseMultiplier = 1;
    if (!(hasBeginnerProtection() && dungeon.order === 1)) {
      if (roll >= 0.55 && roll < 0.7) {
        affix = "강인한";
        hpMultiplier = 1.15;
      } else if (roll >= 0.7 && roll < 0.85) {
        affix = "흉포한";
        attackMultiplier = 1.12;
        defenseMultiplier = 0.9;
      } else if (roll >= 0.85) {
        affix = "철벽의";
        hpMultiplier = 0.9;
        defenseMultiplier = 1.15;
      }
    }
    const base = DUMMY_ENEMY.stats;
    const maxHp = round((base.maxHp + 36 * (level - 1)) * hpMultiplier);
    return {
      id: `${dungeon.id}-${encounterIndex}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${affix ? `${affix} ` : ""}${baseName}`,
      affix,
      level,
      hp: maxHp,
      maxHp,
      atk: round((base.atk + 4 * (level - 1)) * attackMultiplier),
      matk: round((base.matk + 4 * (level - 1)) * attackMultiplier),
      def: round((base.def + 2.4 * (level - 1)) * defenseMultiplier),
      mdef: round((base.mdef + 2.4 * (level - 1)) * defenseMultiplier),
      statuses: {},
      statMods: { def: {}, mdef: {} }
    };
  }

  function startBattle(dungeonId) {
    const dungeon = dungeonById(dungeonId);
    if (!dungeon || state.level < dungeon.unlockLevel) return;
    const stats = getBaseStats();
    const encounterCount = dungeon.encounters || (dungeon.order >= 8 ? 3 : dungeon.order >= 4 ? 2 : 1);
    const encounters = Array.from({ length: encounterCount }, (_, index) => createEnemy(dungeon, index));
    state.battle = {
      dungeonId: dungeon.id,
      dungeonName: dungeon.name,
      dungeonOrder: dungeon.order,
      encounterIndex: 0,
      encounterCount,
      encounters,
      enemy: encounters[0],
      player: {
        hp: stats.maxHp,
        mana: Math.min(BASE_PLAYER_STATS.startingMana, stats.maxMana),
        dream: stats.dreamMax,
        statuses: hasBeginnerProtection() ? { beginner_guard: { permanent: true } } : {}
      },
      turn: 1,
      phase: "player",
      log: [],
      event: `조우 1/${encounterCount} · 루미가 먼저 행동합니다.`,
      result: null,
      charge: null,
      usage: {
        castle: 0,
        absolute_light: 0,
        moon_dream: 0,
        evade_stacks: 0
      }
    };
    addBattleLog(`조우 1/${encounterCount} · ${encounters[0].name} 출현. 루미가 선행합니다.`);
    ui.modal = null;
    ui.selectedSkillId = null;
    actionLocked = false;
    saveState();
    render();
  }

  function getEffectiveEnemyDefense(kind) {
    const enemy = state.battle.enemy;
    const statuses = enemy.statuses;
    if (kind === "physical") {
      const darkness = statuses.darkness?.stacks || 0;
      const modifierRate = getEnemyStatModifierRate("def");
      return Math.max(0, enemy.def * (1 - Math.min(0.5, darkness * 0.1) + modifierRate));
    }
    return Math.max(0, enemy.mdef * (1 + getEnemyStatModifierRate("mdef")));
  }

  function getEnemyStatModifierRate(stat) {
    return Object.values(state.battle?.enemy?.statMods?.[stat] || {})
      .reduce((sum, modifier) => sum + (modifier.rate || 0), 0);
  }

  function setEnemyStatModifier(stat, sourceId, rate, turns) {
    const enemy = state.battle.enemy;
    enemy.statMods ||= {};
    enemy.statMods[stat] ||= {};
    enemy.statMods[stat][sourceId] = {
      rate,
      turns,
      fresh: true
    };
  }

  function calculateDamage(offense, power, defense) {
    return Math.max(1, Math.floor((offense * (power / 100) * 100) / (100 + Math.max(0, defense))));
  }

  function attackEnemy(kind, power, options = {}) {
    const stats = getBattleStats();
    const accuracy = options.accuracy ?? 1;
    if (Math.random() > accuracy) {
      addBattleLog(`${options.name || "공격"}이 빗나갔습니다.`);
      return { hit: false, damage: 0, critical: false };
    }
    const extraCrit = options.extraCrit || 0;
    const critical = options.forceCrit || Math.random() < clamp(stats.critChance + extraCrit, 0, 1);
    let damage = 0;
    if (kind === "hybrid") {
      const physicalPower = options.physicalPower ?? power / 2;
      const magicPower = options.magicPower ?? power / 2;
      damage += calculateDamage(stats.atk, physicalPower, getEffectiveEnemyDefense("physical"));
      damage += calculateDamage(stats.matk, magicPower, getEffectiveEnemyDefense("magic"));
    } else {
      const offense = kind === "magic" ? stats.matk : stats.atk;
      damage = calculateDamage(offense, power, getEffectiveEnemyDefense(kind));
    }
    if (critical) damage = Math.floor(damage * (1 + stats.critDamage));
    if (options.hits && options.hits > 1) damage *= options.hits;
    state.battle.enemy.hp = Math.max(0, state.battle.enemy.hp - damage);
    state.highestDamage = Math.max(state.highestDamage, damage);
    ui.damagePop = { target: "enemy", value: damage, critical };
    return { hit: true, damage, critical };
  }

  function attackEnemyWithEnchant(result, physicalAction, multiplier = 80) {
    if (!result.hit || !physicalAction || !state.battle.player.statuses.fire_enchant) return 0;
    const stats = getBattleStats();
    const damage = calculateDamage(stats.matk, multiplier, getEffectiveEnemyDefense("magic"));
    state.battle.enemy.hp = Math.max(0, state.battle.enemy.hp - damage);
    state.highestDamage = Math.max(state.highestDamage, damage);
    addBattleLog(`파이어 인챈트가 ${damage}의 추가 마법피해를 주었습니다.`);
    return damage;
  }

  function addBattleLog(text) {
    if (!state.battle) return;
    state.battle.log.push({ turn: state.battle.turn, text });
    if (state.battle.log.length > 90) state.battle.log.shift();
  }

  function setPlayerStatus(id, turns, extra = {}) {
    state.battle.player.statuses[id] = { turns, tick: "round", ...extra };
  }

  function setEnemyStatus(id, turns, extra = {}) {
    state.battle.enemy.statuses[id] = { turns, tick: "round", ...extra };
  }

  function addEnemyStacks(id, amount, maximum) {
    const current = state.battle.enemy.statuses[id]?.stacks || 0;
    const next = clamp(current + amount, 0, maximum);
    if (next <= 0) {
      delete state.battle.enemy.statuses[id];
      return;
    }
    state.battle.enemy.statuses[id] = {
      permanent: true,
      tick: "permanent",
      stacks: next
    };
  }

  function addPlayerStacks(id, amount, maximum) {
    const current = state.battle.player.statuses[id]?.stacks || 0;
    state.battle.player.statuses[id] = {
      permanent: true,
      tick: "permanent",
      stacks: clamp(current + amount, 0, maximum)
    };
  }

  function replaceSageForm(id, turns) {
    ["moon_form", "star_form", "sun_form"].forEach((form) => {
      delete state.battle.player.statuses[form];
    });
    setPlayerStatus(id, turns);
  }

  function consumeHealth(ratio) {
    const stats = getBattleStats();
    const amount = Math.ceil(stats.maxHp * ratio);
    state.battle.player.hp = Math.max(1, state.battle.player.hp - amount);
    return amount;
  }

  function performPlayerAction(action) {
    if (!state.battle || battleButtonsDisabled()) return;
    const battle = state.battle;
    let name = "기본 공격";
    let manaCost = 0;
    let outcome;

    if (action.kind === "skill") {
      const reason = skillDisabledReason(action.entry);
      if (reason) {
        showToast(reason, "warning");
        return;
      }
      name = action.entry.skill.name;
      manaCost = action.entry.skill.mp;
      if (action.entry.skill.effect === "rose_prison" && (battle.enemy.statuses.rose?.stacks || 0) < 3) {
        showToast("장미가 3스택 이상 필요합니다.", "warning");
        return;
      }
    } else if (action.kind === "armor") {
      name = action.skill.name;
      manaCost = action.skill.mp;
      if (battle.player.mana < manaCost) {
        showToast("마나가 부족합니다.", "warning");
        return;
      }
    }

    battle.player.mana -= manaCost;
    battle.phase = "resolving";
    actionLocked = true;
    ui.modal = null;
    ui.selectedSkillId = null;

    if (action.kind === "basic") {
      outcome = attackEnemy("physical", 100, { name });
      const extra = attackEnemyWithEnchant(outcome, true);
      const totalDamage = outcome.damage + extra;
      if (extra) {
        state.highestDamage = Math.max(state.highestDamage, totalDamage);
        ui.damagePop = { target: "enemy", value: totalDamage, critical: outcome.critical };
      }
      addBattleLog(`${name} · ${outcome.hit ? `${totalDamage} 피해${outcome.critical ? " (치명타)" : ""}` : "빗나감"}`);
      battle.event = `루미 · ${name}${outcome.hit ? `으로 ${totalDamage} 피해` : "이 빗나갔습니다"}`;
    } else if (action.kind === "armor") {
      resolveArmorSkill(action.skill);
      battle.event = `루미 · ${name} 발동`;
      addBattleLog(`${name}을 사용했습니다. MP ${manaCost} 소모.`);
    } else {
      outcome = resolveClassSkill(action.entry);
    }

    if (battle.player.statuses.attack_surge && action.kind !== "armor") {
      delete battle.player.statuses.attack_surge;
    }

    saveState();
    render();
    clearDamagePopSoon();
    if (battle.enemy.hp <= 0) {
      flowTimer = window.setTimeout(handleEnemyDefeated, 520);
    } else {
      flowTimer = window.setTimeout(enemyTurn, 560);
    }
  }

  function resolveArmorSkill(skill) {
    switch (skill.id) {
      case "guard":
        setPlayerStatus("guard", 1, { tick: "nextEnemy" });
        break;
      case "dodge_stance":
        setPlayerStatus("dodge_stance", 1, { tick: "nextEnemy" });
        break;
      case "barrier":
        setPlayerStatus("barrier", 1, { tick: "nextEnemy" });
        break;
      case "magic_guard":
        setPlayerStatus("magic_guard", 1, { tick: "nextEnemy" });
        break;
      default:
        break;
    }
  }

  function resolveClassSkill(entry, options = {}) {
    const skill = entry.skill;
    const effect = skill.effect || skill.id;
    const battle = state.battle;
    let outcome = { hit: true, damage: 0, critical: false };
    let extraDamage = 0;
    let power = skill.power || 0;
    let physicalAction = skill.type === "physical" || skill.type === "hybrid";
    const afterAction = [];
    const attack = (kind = skill.type, adjustedPower = power, attackOptions = {}) => {
      outcome = attackEnemy(kind, adjustedPower, { name: skill.name, ...attackOptions });
      return outcome;
    };
    const queueDefenseModifier = () => {
      if (!skill.targetDefense || !skill.reductionPercent || !skill.duration) return;
      afterAction.push(() => {
        if (!outcome.hit) return;
        setEnemyStatModifier(
          skill.targetDefense,
          skill.id,
          -(skill.reductionPercent / 100),
          skill.duration
        );
      });
    };

    if (!options.charged && ["divine_blade", "milky_way_ecstasy"].includes(effect)) {
      battle.charge = {
        skillId: skill.id,
        classId: entry.classId,
        name: skill.name
      };
      setPlayerStatus("charge", 1, { name: skill.name, tick: "nextPlayer" });
      battle.event = `루미 · ${skill.name} 차징 시작`;
      addBattleLog(`${skill.name} 차징을 시작했습니다. 다음 행동에 자동 발동합니다.`);
      return outcome;
    }

    switch (effect) {
      case "heavy_impact": {
        const missing = 1 - battle.player.hp / getBattleStats().maxHp;
        power = 120 + missing * 120;
        attack("physical", power);
        break;
      }
      case "carnage": {
        const cost = consumeHealth(0.1);
        attack("physical", 150);
        addBattleLog(`카니지의 대가로 생명력 ${cost}를 소모했습니다.`);
        break;
      }
      case "wild_slash":
      case "wild_thrash":
        attack("physical", 300);
        setPlayerStatus("reckless", 1);
        break;
      case "ragnarok": {
        const missing = 1 - battle.player.hp / getBattleStats().maxHp;
        power = 250 + missing * 500;
        attack("physical", power);
        break;
      }
      case "flame_shot":
        attack("magic", skill.power);
        queueDefenseModifier();
        break;
      case "fire_enchant":
        setPlayerStatus("fire_enchant", 5);
        break;
      case "ignis_smash":
        attack("physical", 170);
        extraDamage = attackEnemyWithEnchant(outcome, true, 160);
        physicalAction = false;
        break;
      case "prominence":
        attack("magic", skill.power);
        queueDefenseModifier();
        break;
      case "divine_armor":
        setPlayerStatus("divine_armor", 5);
        break;
      case "undying":
        setPlayerStatus("undying", 1, { tick: "nextEnemy" });
        break;
      case "divine_blade": {
        const stacks = battle.player.statuses.divine?.stacks || 0;
        attack("physical", 420 + stacks * 30);
        delete battle.player.statuses.divine;
        break;
      }
      case "gigantic_castle": {
        power = Math.min(750, 150 + battle.usage.castle * 150);
        battle.usage.castle += 1;
        setPlayerStatus("castle_guard", 1, { tick: "nextEnemy" });
        attack("magic", power);
        break;
      }
      case "holy_smite":
        attack("physical", 140);
        break;
      case "judgment_road":
        attack("physical", skill.power);
        queueDefenseModifier();
        break;
      case "aether_lance":
        attack("physical", skill.power);
        queueDefenseModifier();
        break;
      case "meditation":
        setPlayerStatus("meditation", 3);
        break;
      case "mana_dress":
        setPlayerStatus("mana_dress", 4);
        break;
      case "holy_ball":
        attack("magic", 150);
        break;
      case "holy_ray":
        attack("magic", 240);
        break;
      case "sanctuary":
        setPlayerStatus("sanctuary", 4);
        break;
      case "goddess_descent":
        battle.player.hp = Math.min(getBattleStats().maxHp, battle.player.hp + getBattleStats().maxHp * 0.6);
        setPlayerStatus("goddess", 3);
        break;
      case "sunfire": {
        const cost = consumeHealth(0.2);
        attack("magic", 300);
        addBattleLog(`선파이어의 대가로 생명력 ${cost}를 소모했습니다.`);
        break;
      }
      case "absolute_light":
        power = Math.min(650, 150 + battle.usage.absolute_light * 100);
        battle.usage.absolute_light += 1;
        attack("magic", power);
        break;
      case "judgment":
        attack("magic", 360, { accuracy: 0.7 });
        break;
      case "the_holy":
        attack("magic", battle.player.statuses.goddess ? 800 : 600);
        setPlayerStatus("stun", 1, { tick: "nextPlayer" });
        break;
      case "shadow_ball":
        attack("magic", 110);
        if (outcome.hit) addEnemyStacks("darkness", 1, 5);
        break;
      case "phantom_raid":
        attack("physical", skill.power);
        queueDefenseModifier();
        break;
      case "veil_of_darkness":
        attack("magic", 100);
        setPlayerStatus("witch_veil", 3);
        break;
      case "dark_meteor":
        attack("magic", 380);
        if (outcome.hit) addEnemyStacks("darkness", 1, 5);
        setPlayerStatus("stun", 1, { tick: "nextPlayer" });
        break;
      case "cross_cut":
        attack("physical", 140);
        if (outcome.hit && outcome.critical) addEnemyStacks("darkness", 3, 5);
        break;
      case "assassin_nail": {
        const darkness = battle.enemy.statuses.darkness?.stacks || 0;
        attack("physical", 160, { extraCrit: darkness * 0.3 });
        break;
      }
      case "adrenaline":
        setPlayerStatus("adrenaline", 4);
        break;
      case "eclipse":
        attack("physical", 270, { forceCrit: true });
        break;
      case "genocide_step":
        attack("physical", 50);
        setPlayerStatus("dodge_stance", 1, { tick: "nextEnemy" });
        break;
      case "instinct":
        setPlayerStatus("instinct", 5);
        break;
      case "dancing_dagger": {
        const hits = 1 + clamp(battle.usage.evade_stacks, 0, 4);
        battle.usage.evade_stacks = 0;
        attack("physical", 60 * hits);
        addBattleLog(`댄싱대거가 ${hits}회 적중했습니다.`);
        break;
      }
      case "luna_blade":
        attack("magic", 300);
        setPlayerStatus("luna_evade", 1, { tick: "nextEnemy" });
        break;
      case "moon_form":
        battle.player.dream -= 1;
        replaceSageForm("moon_form", 3);
        break;
      case "moonlight_veil":
        attack("magic", 130);
        if (battle.player.statuses.moon_form) setPlayerStatus("moonlight_veil", 3);
        break;
      case "moon_force":
        attack("hybrid", 100, { physicalPower: 50, magicPower: 50 });
        if (outcome.hit && outcome.critical) {
          battle.player.mana = Math.min(getBattleStats().maxMana, battle.player.mana + 40);
          addBattleLog("문포스의 치명타로 마나 40을 회복했습니다.");
        }
        break;
      case "silent_serena":
        attack("magic", battle.player.statuses.moon_form ? 240 : 200);
        break;
      case "star_form":
        battle.player.dream -= 1;
        replaceSageForm("star_form", 3);
        break;
      case "star_barrier":
        setPlayerStatus("star_barrier", 1, {
          reduction: battle.player.statuses.star_form ? 0.8 : 0.6,
          tick: "nextEnemy"
        });
        break;
      case "star_powder_milkshake":
      case "star_milkshake":
        battle.player.hp = Math.min(getBattleStats().maxHp, battle.player.hp + getBattleStats().maxHp * 0.3);
        if (battle.player.statuses.star_form) setPlayerStatus("star_milk", 10);
        break;
      case "milky_way_ecstasy":
        attack("hybrid", 220, { physicalPower: 110, magicPower: 110 });
        break;
      case "sun_form":
        battle.player.dream -= 1;
        replaceSageForm("sun_form", 3);
        break;
      case "pang_pang_punch":
        attack("physical", 120);
        queueDefenseModifier();
        break;
      case "god_hand":
        attack("physical", battle.player.statuses.sun_form ? 250 : 170);
        break;
      case "meteor_smash":
        attack("physical", 220);
        if (battle.player.statuses.sun_form) setPlayerStatus("meteor_focus", 3);
        break;
      case "dream_form": {
        let dreamPower = 200;
        if (battle.player.statuses.star_form) {
          dreamPower = 400;
          setPlayerStatus("luna_evade", 1, { tick: "nextEnemy" });
        } else if (battle.player.statuses.moon_form) {
          dreamPower = 200 + battle.usage.moon_dream * 300;
          battle.usage.moon_dream += 1;
        } else if (battle.player.statuses.sun_form) {
          dreamPower = 200 + battle.player.dream * 150;
        }
        ["moon_form", "star_form", "sun_form"].forEach((form) => delete battle.player.statuses[form]);
        attack("magic", dreamPower);
        break;
      }
      case "rose_shot":
        attack("magic", 110);
        if (outcome.hit) addEnemyStacks("rose", 1, 15);
        break;
      case "flower_dance":
        attack("physical", 130);
        setPlayerStatus("flower_dance", 3);
        break;
      case "quick_grow":
        addEnemyStacks("rose", 3, 15);
        break;
      case "rose_prison":
        addEnemyStacks("rose", -3, 15);
        setEnemyStatus("stun", 1, { tick: "nextEnemy" });
        break;
      case "wild_root":
        attack("magic", 320);
        if (outcome.hit) addEnemyStacks("rose", 2, 15);
        setPlayerStatus("stun", 1, { tick: "nextPlayer" });
        break;
      case "queens_domain":
      case "queen_domain":
        setPlayerStatus("queen_domain", 3);
        break;
      case "vine_whip":
        attack("physical", 120);
        if (outcome.hit) addEnemyStacks("rose", 1, 15);
        break;
      case "cruel_thorn":
        attack("physical", 170);
        queueDefenseModifier();
        break;
      case "royal_focus":
        attack("physical", 150);
        setPlayerStatus("royal_focus", 3);
        break;
      case "royal_bloom":
        setPlayerStatus("royal_bloom", 3);
        break;
      case "heart_pierce":
        attack("physical", 220);
        if (outcome.hit && outcome.critical) addEnemyStacks("rose", 6, 15);
        break;
      case "finale": {
        const roses = battle.enemy.statuses.rose?.stacks || 0;
        delete battle.enemy.statuses.rose;
        attack("magic", 400 + roses * 40);
        break;
      }
      default:
        if (skill.type === "physical" || skill.type === "magic" || skill.type === "hybrid") {
          attack(skill.type, power || 100);
        }
        break;
    }

    if (physicalAction && !["ignis_smash", "fire_enchant"].includes(effect)) {
      extraDamage = attackEnemyWithEnchant(outcome, outcome.hit);
    }
    afterAction.forEach((applyEffect) => applyEffect());
    const totalDamage = outcome.damage + extraDamage;
    if (extraDamage) {
      state.highestDamage = Math.max(state.highestDamage, totalDamage);
      ui.damagePop = { target: "enemy", value: totalDamage, critical: outcome.critical };
    }
    const actionText = totalDamage
      ? `${skill.name}으로 ${totalDamage} 피해${outcome.critical ? " (치명타)" : ""}`
      : `${skill.name} 발동`;
    battle.event = `루미 · ${actionText}`;
    addBattleLog(`${actionText}. MP ${options.charged ? 0 : skill.mp} 소모.`);
    return outcome;
  }

  function getPlayerEvasion() {
    const statuses = state.battle.player.statuses;
    let evasion = getBattleStats().evasion || 0;
    if (statuses.dodge_stance) evasion += 0.5;
    if (statuses.luna_evade) evasion += 1;
    return clamp(evasion, 0, 1);
  }

  function enemyTurn() {
    const battle = state.battle;
    if (!battle || battle.result || battle.enemy.hp <= 0) return;
    battle.phase = "enemy";
    actionLocked = true;
    ui.damagePop = null;

    if (battle.enemy.statuses.stun) {
      delete battle.enemy.statuses.stun;
      battle.event = `${battle.enemy.name} · 기절로 행동 불가`;
      addBattleLog(`${battle.enemy.name}은 기절하여 행동하지 못했습니다.`);
      saveState();
      render();
      flowTimer = window.setTimeout(finishRound, 480);
      return;
    }

    const actionRoll = Math.random() * DUMMY_ENEMY.actions.reduce(
      (sum, action) => sum + action.chance,
      0
    );
    let chanceCursor = 0;
    const enemyAction = DUMMY_ENEMY.actions.find((action) => {
      chanceCursor += action.chance;
      return actionRoll < chanceCursor;
    }) || DUMMY_ENEMY.actions[0];
    const magic = enemyAction.type === "magic";
    const moveName = enemyAction.name;
    const evasion = getPlayerEvasion();
    if (Math.random() < evasion) {
      battle.usage.evade_stacks = clamp(battle.usage.evade_stacks + 1, 0, 4);
      battle.event = `루미 · ${moveName} 회피`;
      addBattleLog(`${battle.enemy.name}의 ${moveName}을 회피했습니다. 회피 충전 ${battle.usage.evade_stacks}/4.`);
      consumeImmediateDefenseStatuses();
      saveState();
      render();
      flowTimer = window.setTimeout(finishRound, 480);
      return;
    }

    const statuses = battle.player.statuses;
    const immune = (magic && statuses.magic_guard) || (!magic && statuses.barrier);
    const stats = getBattleStats();
    let damage = immune
      ? 0
      : calculateDamage(
        magic ? battle.enemy.matk : battle.enemy.atk,
        enemyAction.power,
        magic ? stats.mdef : stats.def
      );
    if (statuses.guard) damage = Math.floor(damage * 0.5);
    if (statuses.star_barrier) damage = Math.floor(damage * (1 - statuses.star_barrier.reduction));
    if (statuses.beginner_guard) damage = Math.floor(damage * 0.75);

    let undyingTriggered = false;
    if (damage >= battle.player.hp && statuses.undying) {
      damage = Math.max(0, battle.player.hp - 1);
      delete statuses.undying;
      setPlayerStatus("attack_surge", 1, { tick: "nextPlayer" });
      undyingTriggered = true;
    }
    battle.player.hp = Math.max(0, battle.player.hp - damage);
    ui.damagePop = { target: "player", value: damage, critical: false };
    battle.event = `${battle.enemy.name} · ${moveName}으로 ${damage} 피해`;
    addBattleLog(`${battle.enemy.name}의 ${moveName} · ${immune ? "피해 무효" : `${damage} 피해`}.${undyingTriggered ? " 언다잉 발동." : ""}`);

    const wasHit = true;
    if (wasHit && statuses.divine_armor) addPlayerStacks("divine", 1, 10);
    consumeImmediateDefenseStatuses();

    if (battle.player.hp <= 0) {
      saveState();
      render();
      clearDamagePopSoon();
      flowTimer = window.setTimeout(resolveDefeat, 520);
      return;
    }

    if (wasHit && statuses.sanctuary) {
      const counter = attackEnemy("magic", 150, { name: "생츄어리 반격" });
      addBattleLog(`생츄어리 반격으로 ${counter.damage} 피해를 주었습니다.`);
      if (battle.enemy.hp <= 0) {
        saveState();
        render();
        flowTimer = window.setTimeout(handleEnemyDefeated, 520);
        return;
      }
    }

    saveState();
    render();
    clearDamagePopSoon();
    flowTimer = window.setTimeout(finishRound, 520);
  }

  function consumeImmediateDefenseStatuses() {
    [
      "guard",
      "dodge_stance",
      "barrier",
      "magic_guard",
      "star_barrier",
      "luna_evade",
      "castle_guard",
      "undying"
    ].forEach((id) => {
      delete state.battle.player.statuses[id];
    });
  }

  function finishRound() {
    const battle = state.battle;
    if (!battle || battle.result) return;
    ui.damagePop = null;

    const roseStacks = battle.enemy.statuses.rose?.stacks || 0;
    if (roseStacks > 0) {
      const stats = getBattleStats();
      let roseDamage = calculateDamage(
        stats.atk * 0.05 + stats.matk * 0.05,
        roseStacks * 100,
        getEffectiveEnemyDefense("magic")
      );
      if (battle.player.statuses.queen_domain) roseDamage *= 2;
      battle.enemy.hp = Math.max(0, battle.enemy.hp - roseDamage);
      battle.event = `장미 · ${roseStacks}스택이 ${roseDamage} 피해`;
      addBattleLog(`장미 ${roseStacks}스택이 ${roseDamage}의 지속 마법피해를 주었습니다.`);
      ui.damagePop = { target: "enemy", value: roseDamage, critical: false };
      if (battle.enemy.hp <= 0) {
        saveState();
        render();
        flowTimer = window.setTimeout(handleEnemyDefeated, 520);
        return;
      }
    }

    const stats = getBattleStats();
    const recovered = Math.min(stats.regen, stats.maxMana - battle.player.mana);
    battle.player.mana += recovered;
    tickStatuses(battle.player.statuses, "player");
    tickStatuses(battle.enemy.statuses, "enemy");
    tickEnemyStatModifiers();
    battle.turn += 1;
    battle.phase = "player";
    battle.event = `TURN ${battle.turn} · 마나 ${recovered} 회복`;
    addBattleLog(`턴 시작 · 마나 ${recovered} 회복 (${round(battle.player.mana)}/${stats.maxMana}).`);
    actionLocked = false;
    saveState();
    render();
  }

  function tickStatuses(statuses, target) {
    Object.entries(statuses).forEach(([id, status]) => {
      if (!status || status.permanent || status.tick === "permanent" || !status.turns) return;
      if (status.tick && status.tick !== "round") return;
      delete status.fresh;
      status.turns -= 1;
      if (status.turns <= 0) {
        delete statuses[id];
        if (target === "player" && id === "royal_bloom" && state.battle?.enemy?.statuses?.rose) {
          delete state.battle.enemy.statuses.rose;
          addBattleLog("로열 블룸이 끝나 모든 장미가 시들었습니다.");
        }
      }
    });
  }

  function tickEnemyStatModifiers() {
    const statMods = state.battle?.enemy?.statMods;
    if (!statMods) return;
    Object.values(statMods).forEach((bySource) => {
      Object.entries(bySource).forEach(([sourceId, modifier]) => {
        if (modifier.fresh) {
          delete modifier.fresh;
          return;
        }
        modifier.turns -= 1;
        if (modifier.turns <= 0) delete bySource[sourceId];
      });
    });
  }

  function ensureAutoBattleFlow() {
    const battle = state.battle;
    if (ui.atTitle || !battle || battle.result || actionLocked || ui.modal) return;
    if (battle.phase === "resolving") {
      actionLocked = true;
      clearTimeout(flowTimer);
      flowTimer = window.setTimeout(
        battle.enemy.hp <= 0 ? handleEnemyDefeated : enemyTurn,
        320
      );
      return;
    }
    if (battle.phase === "enemy") {
      actionLocked = true;
      clearTimeout(flowTimer);
      flowTimer = window.setTimeout(() => {
        if (!state.battle) return;
        if (state.battle.player.hp <= 0) resolveDefeat();
        else if (state.battle.enemy.hp <= 0) handleEnemyDefeated();
        else finishRound();
      }, 320);
      return;
    }
    if (battle.phase !== "player") return;
    if (battle.player.statuses.stun) {
      actionLocked = true;
      clearTimeout(flowTimer);
      flowTimer = window.setTimeout(() => {
        if (!state.battle) return;
        delete state.battle.player.statuses.stun;
        state.battle.event = "루미 · 기절로 행동 불가";
        addBattleLog("루미는 기절하여 행동하지 못했습니다.");
        state.battle.phase = "resolving";
        saveState();
        render();
        flowTimer = window.setTimeout(enemyTurn, 520);
      }, 420);
      return;
    }
    if (battle.charge) {
      const charge = battle.charge;
      const classData = classById(charge.classId);
      const skill = classData?.skills.find((entry) => entry.id === charge.skillId);
      if (!classData || !skill) {
        battle.charge = null;
        delete battle.player.statuses.charge;
        return;
      }
      actionLocked = true;
      clearTimeout(flowTimer);
      flowTimer = window.setTimeout(() => {
        if (!state.battle) return;
        state.battle.charge = null;
        delete state.battle.player.statuses.charge;
        state.battle.phase = "resolving";
        resolveClassSkill({
          skill,
          classId: classData.id,
          className: classData.name,
          classData
        }, { charged: true });
        saveState();
        render();
        if (state.battle.enemy.hp <= 0) {
          flowTimer = window.setTimeout(handleEnemyDefeated, 520);
        } else {
          flowTimer = window.setTimeout(enemyTurn, 560);
        }
      }, 420);
    }
  }

  function handleEnemyDefeated() {
    const battle = state.battle;
    if (!battle || battle.result) return;
    addBattleLog(`${battle.enemy.name}을 쓰러뜨렸습니다.`);
    if (battle.encounterIndex + 1 < battle.encounterCount) {
      battle.encounterIndex += 1;
      battle.enemy = battle.encounters[battle.encounterIndex];
      const stats = getBaseStats();
      battle.player.hp = Math.min(stats.maxHp, battle.player.hp + Math.ceil(stats.maxHp * 0.15));
      battle.player.mana = Math.min(stats.maxMana, battle.player.mana + 25);
      battle.player.dream = stats.dreamMax;
      battle.player.statuses = hasBeginnerProtection() ? { beginner_guard: { permanent: true } } : {};
      battle.charge = null;
      battle.usage = { castle: 0, absolute_light: 0, moon_dream: 0, evade_stacks: 0 };
      battle.turn = 1;
      battle.phase = "player";
      battle.event = `조우 ${battle.encounterIndex + 1}/${battle.encounterCount} · ${battle.enemy.name} 출현`;
      addBattleLog(`다음 조우 · 생명력 15%, 마나 25 회복. 꿈의 결정이 초기화되었습니다.`);
      actionLocked = false;
      saveState();
      render();
      showToast(`다음 조우 ${battle.encounterIndex + 1}/${battle.encounterCount}`, "reward");
      return;
    }
    resolveVictory();
  }

  function resolveVictory() {
    const battle = state.battle;
    const dungeon = dungeonById(battle.dungeonId);
    if (!battle || !dungeon || battle.result) return;
    const firstClear = !state.clearedDungeons.includes(dungeon.id);
    state.battlesWon += 1;
    if (!state.clearedDungeons.includes(dungeon.id)) state.clearedDungeons.push(dungeon.id);
    const xp = getDungeonXpReward(dungeon, battle.enemy.level);
    const levelUps = gainExperience(xp);
    const item = rollEquipmentDrop(dungeon, battle.enemy.affix, firstClear);
    battle.result = {
      type: "victory",
      xp,
      itemId: item?.id || null,
      levelUps
    };
    battle.phase = "result";
    actionLocked = true;
    ui.modal = { type: "battleResult" };
    saveState();
    render();
  }

  function resolveDefeat() {
    const battle = state.battle;
    if (!battle || battle.result) return;
    battle.result = { type: "defeat", xp: 0, itemId: null, levelUps: [] };
    battle.phase = "result";
    actionLocked = true;
    ui.modal = { type: "battleResult" };
    saveState();
    render();
  }

  function gainExperience(amount) {
    const levels = [];
    if (state.level >= MAX_LEVEL) return levels;
    state.xp += amount;
    while (state.level < MAX_LEVEL && !state.pendingClassChoices) {
      const required = getXpRequired();
      if (state.xp < required) break;
      state.xp -= required;
      state.level += 1;
      levels.push(state.level);
      if (CLASS_MILESTONES.includes(state.level) && state.selectedClasses.length < 3) {
        state.pendingClassChoices = {
          level: state.level,
          choices: availableClassChoices()
        };
      }
    }
    if (state.level >= MAX_LEVEL) state.xp = 0;
    return levels;
  }

  function getDungeonXpReward(dungeon, enemyLevel = 1) {
    const baseXp = dungeon.xp || 100 + 20 * (enemyLevel - 1);
    return round(baseXp * TEST_XP_MULTIPLIER);
  }

  function rollEquipmentDrop(dungeon, affix = "", firstClear = false) {
    const chance = Math.min(0.8, (dungeon.dropRate ?? (0.32 + dungeon.order * 0.03)) + (affix ? 0.05 : 0));
    if (!firstClear && Math.random() > chance) return null;
    const weights = dungeon.lootTierWeights || {
      [clamp((dungeon.tier || 1) - 1, 1, 5)]: 20,
      [clamp(dungeon.tier || 1, 1, 5)]: 65,
      [clamp((dungeon.tier || 1) + 1, 1, 5)]: 12,
      [clamp((dungeon.tier || 1) + 2, 1, 5)]: 3
    };
    const weightedTiers = Object.entries(weights)
      .map(([tier, weight]) => ({ tier: Number(tier), weight: Number(weight) }))
      .filter((entry) => entry.weight > 0);
    const totalWeight = weightedTiers.reduce((sum, entry) => sum + entry.weight, 0);
    let tierRoll = Math.random() * totalWeight;
    let tier = weightedTiers[weightedTiers.length - 1]?.tier || dungeon.tier || 1;
    for (const entry of weightedTiers) {
      tierRoll -= entry.weight;
      if (tierRoll < 0) {
        tier = entry.tier;
        break;
      }
    }
    const candidates = EQUIPMENT_CATALOG.filter((item) => item.tier === tier);
    if (!candidates.length) return null;
    const item = candidates[Math.floor(Math.random() * candidates.length)];
    if (state.inventory.includes(item.id)) return null;
    state.inventory.push(item.id);
    return item;
  }

  function finishBattleResult() {
    state.battle = null;
    ui.modal = null;
    ui.view = "dungeons";
    ui.selectedSkillId = null;
    actionLocked = false;
    saveState();
    render();
  }

  function clearDamagePopSoon() {
    window.setTimeout(() => {
      ui.damagePop = null;
      const pop = document.querySelector(".damage-pop");
      if (pop) pop.remove();
    }, 720);
  }

  function openModal(modal) {
    previousFocus = focusTokenFor(document.activeElement);
    ui.modal = modal;
    render();
  }

  function closeModal() {
    if (ui.modal?.type === "battleResult") return;
    ui.modal = null;
    ui.selectedSkillId = null;
    render();
    requestAnimationFrame(() => {
      const focusTarget = findFocusToken(previousFocus);
      if (focusTarget) focusTarget.focus({ preventScroll: true });
      previousFocus = null;
    });
  }

  function confirmClassSelection() {
    const classData = classById(ui.selectedClassId);
    if (!classData) return;
    if (!state.started) {
      if (!state.initialClassChoices?.includes(classData.id)) return;
      state.started = true;
      state.selectedClasses = [{ id: classData.id, acquiredAt: 1 }];
      state.level = 1;
      state.xp = 0;
      state.inventory = [];
      state.equipment = { weapon: null, armor: null };
      state.clearedDungeons = [];
      state.battlesWon = 0;
      state.highestDamage = 0;
      state.initialClassChoices = null;
      state.runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      showToast(`${classData.name}의 운명이 시작됩니다.`, "reward");
    } else if (state.pendingClassChoices?.choices.includes(classData.id) && !hasClass(classData.id)) {
      state.selectedClasses.push({ id: classData.id, acquiredAt: state.level });
      state.pendingClassChoices = null;
      gainExperience(0);
      showToast(`${classData.name} 결속 · 기본 마나 리젠 +5`, "reward");
    } else {
      return;
    }
    ui.selectedClassId = null;
    ui.view = "dungeons";
    saveState();
    render();
  }

  function toggleEquip(itemId) {
    const item = itemById(itemId);
    if (!item || !state.inventory.includes(item.id) || state.battle) return;
    const equipped = state.equipment[item.slot] === item.id;
    state.equipment[item.slot] = equipped ? null : item.id;
    ui.modal = null;
    saveState();
    render();
    showToast(equipped ? `${item.name} 해제` : `${item.name} 장착`, equipped ? "" : "reward");
  }

  function handleAction(action, element) {
    switch (action) {
      case "continue-run":
        ui.atTitle = false;
        render();
        break;
      case "new-run":
        resetState();
        break;
      case "open-new-run":
        openModal({ type: "newRun" });
        break;
      case "confirm-new-run":
        resetState();
        break;
      case "select-class":
        ui.selectedClassId = element.dataset.classId;
        render();
        break;
      case "confirm-class":
        confirmClassSelection();
        break;
      case "class-detail":
        openModal({ type: "classDetail", classId: element.dataset.classId });
        break;
      case "change-view":
        ui.view = element.dataset.view || "dungeons";
        render();
        break;
      case "open-dungeon":
        openModal({ type: "dungeon", dungeonId: element.dataset.dungeonId });
        break;
      case "locked-dungeon": {
        const dungeon = dungeonById(element.dataset.dungeonId);
        showToast(`Lv.${dungeon?.unlockLevel || "?"}에 해금됩니다.`, "warning");
        break;
      }
      case "enter-dungeon":
        startBattle(element.dataset.dungeonId);
        break;
      case "inventory-filter":
        ui.inventoryFilter = element.dataset.filter || "all";
        render();
        break;
      case "open-item":
        openModal({ type: "item", itemId: element.dataset.itemId });
        break;
      case "toggle-equip":
        toggleEquip(element.dataset.itemId);
        break;
      case "basic-attack":
        performPlayerAction({ kind: "basic" });
        break;
      case "open-skills":
        ui.selectedSkillId = null;
        openModal({ type: "skills" });
        break;
      case "skill-filter":
        ui.skillFilter = element.dataset.filter || "all";
        render();
        break;
      case "select-skill":
        ui.selectedSkillId = element.dataset.skillId;
        render();
        break;
      case "use-selected-skill": {
        const entry = getUnlockedSkills().find((candidate) => candidate.skill.id === ui.selectedSkillId);
        if (entry) performPlayerAction({ kind: "skill", entry });
        break;
      }
      case "open-armor-skills":
        openModal({ type: "armorSkills" });
        break;
      case "use-armor-skill": {
        const skill = ARMOR_SKILLS[element.dataset.armorSkillId];
        if (skill) performPlayerAction({ kind: "armor", skill });
        break;
      }
      case "open-battle-status":
        openModal({ type: "battleStatus" });
        break;
      case "open-log":
        openModal({ type: "battleLog" });
        break;
      case "open-flee":
        if (!actionLocked) openModal({ type: "flee" });
        break;
      case "confirm-flee":
        state.battle = null;
        ui.modal = null;
        actionLocked = false;
        saveState();
        render();
        break;
      case "finish-battle-result":
        finishBattleResult();
        break;
      case "close-modal":
        closeModal();
        break;
      case "noop":
      default:
        break;
    }
  }

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || !app.contains(button)) return;
    const action = button.dataset.action;
    if (action === "overlay-close") {
      if (event.target === button) closeModal();
      return;
    }
    event.preventDefault();
    handleAction(action, button);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.modal && ui.modal.type !== "battleResult") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key === "Tab" && ui.modal) {
      const panel = app.querySelector("[data-modal-panel]");
      if (!panel) return;
      const focusable = [...panel.querySelectorAll("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("pagehide", saveState);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveState();
  });

  window.__TRINITY_TEST__ = Object.freeze({
    getState: () => JSON.parse(JSON.stringify(state)),
    getStats: () => ({ ...getBaseStats() }),
    getBattleStats: () => ({ ...getBattleStats() }),
    getDungeonXpReward: (dungeonId) => {
      const dungeon = dungeonById(dungeonId);
      return dungeon ? getDungeonXpReward(dungeon) : null;
    },
    replaceState: (nextState) => {
      state = {
        ...defaultState(),
        ...JSON.parse(JSON.stringify(nextState)),
        equipment: { ...defaultState().equipment, ...(nextState.equipment || {}) }
      };
      ui.atTitle = false;
      ui.modal = null;
      actionLocked = false;
      saveState();
      render();
    },
    startBattle,
    gainExperience,
    save: saveState
  });

  render();
})();
