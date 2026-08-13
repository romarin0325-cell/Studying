import { EffectRenderer } from "./EffectRenderer.js";

const ELEMENT_STYLE = Object.freeze({
  water: { color: "#5cc8ff", symbol: "●" },
  fire: { color: "#ff7048", symbol: "▲" },
  nature: { color: "#74d680", symbol: "◆" },
  light: { color: "#ffe282", symbol: "✦" },
  dark: { color: "#b690ff", symbol: "☾" },
});

const TILE_STYLE = Object.freeze({
  conduit: { color: "#3caeff", label: "도" },
  tile_conduit: { color: "#3caeff", label: "도" },
  forge: { color: "#ff9a4c", label: "주" },
  foundry: { color: "#ff9a4c", label: "주" },
  tile_foundry: { color: "#ff9a4c", label: "주" },
  mycelium: { color: "#75d98d", label: "균" },
  tile_mycelium: { color: "#75d98d", label: "균" },
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function initialFor(entity) {
  return String(entity.name ?? entity.characterId ?? entity.enemyId ?? "?").trim().slice(0, 1).toUpperCase() || "?";
}

function getPoint(cell) {
  return { col: Number(cell?.col ?? cell?.x ?? 0), row: Number(cell?.row ?? cell?.y ?? 0) };
}

export class BattleRenderer {
  constructor(canvas, { assets = null } = {}) {
    if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("BattleRenderer requires a canvas element.");
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    if (!this.context) throw new Error("Canvas 2D is not available.");
    this.effectRenderer = new EffectRenderer(this.context);
    this.assets = assets;
    this.viewport = { width: 1, height: 1, dpr: 1 };
    this.board = { x: 0, y: 0, width: 1, height: 1, cell: 1 };
    this.lastStagePlan = null;
    this.resize();
  }

  resize(width, height) {
    const rect = this.canvas.getBoundingClientRect?.() ?? {};
    const cssWidth = Math.max(1, Number(width ?? rect.width ?? this.canvas.clientWidth ?? 960) || 960);
    const cssHeight = Math.max(1, Number(height ?? rect.height ?? this.canvas.clientHeight ?? 540) || 540);
    const dpr = Math.min(2, Math.max(1, Number(globalThis.devicePixelRatio) || 1));
    const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    if (this.canvas.style) {
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
    }
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewport = { width: cssWidth, height: cssHeight, dpr };
    this.#layoutBoard(this.lastStagePlan);
    return { ...this.viewport };
  }

  #layoutBoard(stagePlan) {
    const cols = Number(stagePlan?.cols ?? stagePlan?.grid?.cols ?? 13) || 13;
    const rows = Number(stagePlan?.rows ?? stagePlan?.grid?.rows ?? 8) || 8;
    const padding = Math.max(8, Math.min(this.viewport.width, this.viewport.height) * 0.025);
    const cell = Math.max(1, Math.min((this.viewport.width - padding * 2) / cols, (this.viewport.height - padding * 2) / rows));
    const width = cell * cols;
    const height = cell * rows;
    this.board = {
      x: (this.viewport.width - width) / 2,
      y: (this.viewport.height - height) / 2,
      width,
      height,
      cell,
      cols,
      rows,
    };
  }

  #toCanvas(x, y) {
    return {
      x: this.board.x + (Number(x) + 0.5) * this.board.cell,
      y: this.board.y + (Number(y) + 0.5) * this.board.cell,
    };
  }

  render(snapshot, stagePlan, options = {}) {
    if (!snapshot || !stagePlan) return;
    if (this.lastStagePlan !== stagePlan) {
      this.lastStagePlan = stagePlan;
      this.#layoutBoard(stagePlan);
    }
    const context = this.context;
    const { width, height } = this.viewport;
    context.save();
    context.clearRect(0, 0, width, height);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#071522");
    background.addColorStop(0.55, "#10283a");
    background.addColorStop(1, "#15152d");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    this.#drawBoard(stagePlan);
    this.effectRenderer.drawAreas(snapshot.areaEffects, this.#toCanvas.bind(this), this.board.cell, snapshot.time ?? 0);
    this.#drawSelection(snapshot, options);
    this.effectRenderer.drawBarricades(snapshot.barricades, this.#toCanvas.bind(this), this.board.cell);
    this.#drawAllies(snapshot.allies, options);
    this.#drawEnemies(snapshot.enemies);
    this.effectRenderer.drawProjectiles(snapshot.projectiles, this.#toCanvas.bind(this), this.board.cell);
    this.effectRenderer.drawParticles(snapshot.particles, this.#toCanvas.bind(this), this.board.cell);
    if (options.damageNumbers !== false) {
      if (Array.isArray(snapshot.damagePopups)) this.effectRenderer.drawPooledDamagePopups(snapshot.damagePopups, this.#toCanvas.bind(this), this.board.cell);
      else this.effectRenderer.drawDamagePopups(snapshot.events, [...(snapshot.enemies ?? []), ...(snapshot.allies ?? [])], this.#toCanvas.bind(this), this.board.cell, snapshot.time ?? 0);
    }
    this.#drawCore(snapshot.core, stagePlan.core);
    if (snapshot.paused && snapshot.phase === "running") this.#drawCenteredLabel("일시정지", "탭 메뉴에서 전투를 재개하세요");
    if (options.aiming) this.#drawAimingOverlay();
    if (options.debug) this.#drawDebug(snapshot, options.debugStats);
    context.restore();
  }

  #drawBoard(stagePlan) {
    const context = this.context;
    const board = this.board;
    roundedRect(context, board.x - 4, board.y - 4, board.width + 8, board.height + 8, Math.max(8, board.cell * 0.16));
    context.fillStyle = "rgba(5,11,20,.92)";
    context.fill();
    context.strokeStyle = "rgba(131,193,224,.25)";
    context.lineWidth = 1;
    context.stroke();

    for (let row = 0; row < board.rows; row += 1) {
      for (let col = 0; col < board.cols; col += 1) {
        const x = board.x + col * board.cell;
        const y = board.y + row * board.cell;
        context.fillStyle = (row + col) % 2 ? "rgba(29,61,72,.66)" : "rgba(24,53,67,.66)";
        context.fillRect(x + 0.5, y + 0.5, board.cell - 1, board.cell - 1);
      }
    }

    for (const path of stagePlan.paths ?? []) {
      const cells = path.cells ?? path.points ?? path;
      context.save();
      context.lineJoin = "round";
      context.lineCap = "round";
      context.strokeStyle = "rgba(123,101,89,.95)";
      context.lineWidth = board.cell * 0.72;
      context.beginPath();
      cells.forEach((raw, index) => {
        const cell = getPoint(raw);
        const point = this.#toCanvas(cell.col, cell.row);
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
      context.strokeStyle = "rgba(239,194,121,.25)";
      context.lineWidth = Math.max(1, board.cell * 0.08);
      context.setLineDash([board.cell * 0.16, board.cell * 0.13]);
      context.stroke();
      context.restore();
    }

    for (const raw of stagePlan.obstacles ?? []) {
      const cell = getPoint(raw);
      const point = this.#toCanvas(cell.col, cell.row);
      context.save();
      context.translate(point.x, point.y);
      context.fillStyle = "#27313a";
      context.strokeStyle = "rgba(179,202,214,.34)";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(-board.cell * 0.3, board.cell * 0.27);
      context.lineTo(-board.cell * 0.2, -board.cell * 0.25);
      context.lineTo(board.cell * 0.11, -board.cell * 0.34);
      context.lineTo(board.cell * 0.32, board.cell * 0.2);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }

    for (const raw of stagePlan.leaderNodes ?? []) {
      const cell = getPoint(raw);
      const point = this.#toCanvas(cell.col, cell.row);
      context.beginPath();
      context.arc(point.x, point.y, board.cell * 0.35, 0, Math.PI * 2);
      context.fillStyle = "rgba(118,174,255,.14)";
      context.fill();
      context.strokeStyle = "rgba(135,206,255,.8)";
      context.lineWidth = Math.max(1.5, board.cell * 0.04);
      context.stroke();
      context.fillStyle = "rgba(210,238,255,.8)";
      context.font = `700 ${Math.max(8, board.cell * 0.17)}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("L", point.x, point.y);
    }

    for (const raw of stagePlan.specialTiles ?? []) {
      const cell = getPoint(raw);
      const point = this.#toCanvas(cell.col, cell.row);
      const style = TILE_STYLE[raw.type ?? raw.id] ?? { color: "#7dd3a8", label: "특" };
      context.save();
      context.translate(point.x, point.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = `${style.color}28`;
      context.strokeStyle = style.color;
      context.lineWidth = Math.max(1.5, board.cell * 0.04);
      context.fillRect(-board.cell * 0.28, -board.cell * 0.28, board.cell * 0.56, board.cell * 0.56);
      context.strokeRect(-board.cell * 0.28, -board.cell * 0.28, board.cell * 0.56, board.cell * 0.56);
      context.rotate(-Math.PI / 4);
      context.fillStyle = style.color;
      context.font = `800 ${Math.max(8, board.cell * 0.18)}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(style.label, 0, 0);
      context.restore();
    }
  }

  #drawSelection(snapshot, options) {
    const selected = snapshot.allies?.find((ally) => ally.id === options.selectedId || ally.characterId === options.selectedId);
    if (!selected) return;
    const point = this.#toCanvas(selected.x, selected.y);
    const context = this.context;
    context.save();
    context.beginPath();
    context.arc(point.x, point.y, Math.max(this.board.cell * 0.3, Number(selected.range) * this.board.cell), 0, Math.PI * 2);
    context.fillStyle = "rgba(111,217,255,.06)";
    context.fill();
    context.strokeStyle = "rgba(111,217,255,.32)";
    context.lineWidth = Math.max(1, this.board.cell * 0.025);
    context.setLineDash([this.board.cell * 0.12, this.board.cell * 0.08]);
    context.stroke();
    context.restore();
  }

  #drawAllies(allies, options) {
    for (const ally of allies ?? []) {
      const point = this.#toCanvas(ally.x, ally.y);
      const element = ELEMENT_STYLE[ally.element] ?? ELEMENT_STYLE.light;
      const selected = ally.id === options.selectedId || ally.characterId === options.selectedId;
      this.#drawToken(point, this.board.cell * (ally.kind === "leader" ? 0.37 : 0.32), {
        fill: "#173849",
        ring: selected ? "#ffffff" : element.color,
        label: initialFor(ally),
        element,
        elite: false,
        assetId: `battle/${ally.characterId}`,
      });
      if ((ally.relocationCooldown ?? 0) > 0) this.#drawRadialCooldown(point, ally.relocationCooldown / (ally.kind === "leader" ? 5 : 10));
      this.#drawStatusDots(point, ally.statuses, -1);
    }
  }

  #drawEnemies(enemies) {
    for (const enemy of enemies ?? []) {
      const point = this.#toCanvas(enemy.x, enemy.y);
      const element = ELEMENT_STYLE[enemy.element] ?? ELEMENT_STYLE.dark;
      const radius = this.board.cell * (enemy.isBoss ? 0.46 : enemy.enemyId === "swarm" ? 0.21 : 0.27);
      const aerial = enemy.tags?.includes("air") || enemy.tags?.includes("aerial");
      const yOffset = aerial ? -this.board.cell * 0.09 : 0;
      point.y += yOffset;
      this.#drawToken(point, radius, {
        fill: enemy.isBoss ? "#492447" : aerial ? "#2d3d57" : "#3c2d35",
        ring: element.color,
        label: initialFor(enemy),
        element,
        elite: Boolean(enemy.elitePrefix),
        aerial,
        assetId: `${enemy.isBoss ? "boss" : "enemy"}/${enemy.enemyId}`,
      });
      this.#drawHealthBar(point, radius, enemy);
      this.#drawStatusDots(point, enemy.statuses, 1);
    }
  }

  #drawToken(point, radius, options) {
    const context = this.context;
    context.save();
    context.translate(point.x, point.y);
    context.beginPath();
    context.ellipse(0, radius * 0.72, radius * 0.78, radius * 0.26, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(0,0,0,.32)";
    context.fill();
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    const gradient = context.createRadialGradient(-radius * 0.25, -radius * 0.3, radius * 0.08, 0, 0, radius);
    gradient.addColorStop(0, "rgba(255,255,255,.22)");
    gradient.addColorStop(0.22, options.fill);
    gradient.addColorStop(1, "#09131e");
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = options.ring;
    context.lineWidth = Math.max(2, radius * 0.12);
    context.stroke();
    const image = this.assets?.getImage?.(options.assetId);
    if (image) {
      const entry = this.assets.getEntry?.(options.assetId) ?? {};
      const size = radius * 2;
      const pivotX = Number.isFinite(Number(entry.pivotX)) ? Number(entry.pivotX) : 0.5;
      const pivotY = Number.isFinite(Number(entry.pivotY)) ? Number(entry.pivotY) : 0.5;
      context.save();
      context.beginPath();
      context.arc(0, 0, radius * 0.94, 0, Math.PI * 2);
      context.clip();
      context.drawImage(image, -size * pivotX, -size * pivotY, size, size);
      context.restore();
    }
    if (options.elite) {
      context.beginPath();
      context.arc(0, 0, radius * 1.18, 0, Math.PI * 2);
      context.strokeStyle = "#ffd66b";
      context.lineWidth = Math.max(1, radius * 0.07);
      context.setLineDash([radius * 0.25, radius * 0.15]);
      context.stroke();
      context.setLineDash([]);
    }
    context.fillStyle = "rgba(255,255,255,.96)";
    context.font = `800 ${Math.max(10, radius * 0.8)}px system-ui`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    if (!image) context.fillText(options.label, 0, 1);
    context.beginPath();
    context.arc(-radius * 0.66, -radius * 0.64, radius * 0.27, 0, Math.PI * 2);
    context.fillStyle = options.element.color;
    context.fill();
    context.strokeStyle = "#07121d";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#07121d";
    context.font = `800 ${Math.max(7, radius * 0.32)}px system-ui`;
    context.fillText(options.element.symbol, -radius * 0.66, -radius * 0.63);
    if (options.aerial) {
      context.fillStyle = "#b8e6ff";
      context.font = `900 ${Math.max(8, radius * 0.42)}px system-ui`;
      context.fillText("↑", radius * 0.72, -radius * 0.65);
    }
    context.restore();
  }

  #drawHealthBar(point, radius, enemy) {
    const context = this.context;
    const width = radius * (enemy.isBoss ? 2.65 : 2.05);
    const height = Math.max(3, radius * 0.18);
    const x = point.x - width / 2;
    const y = point.y - radius - height * 2;
    const hpRatio = clamp(Number(enemy.hp) / Math.max(1, Number(enemy.maxHp)), 0, 1);
    const shieldRatio = clamp(Number(enemy.shield) / Math.max(1, Number(enemy.maxHp)), 0, 1);
    context.fillStyle = "rgba(0,0,0,.65)";
    context.fillRect(x - 1, y - 1, width + 2, height + 2);
    context.fillStyle = enemy.isBoss ? "#ff557f" : "#ff6d6d";
    context.fillRect(x, y, width * hpRatio, height);
    if (shieldRatio > 0) {
      context.fillStyle = "#70d4ff";
      context.fillRect(x, y - height - 1, width * shieldRatio, Math.max(2, height * 0.7));
    }
  }

  #drawStatusDots(point, statuses, direction) {
    const ids = Object.keys(statuses ?? {}).slice(0, 5);
    if (ids.length === 0) return;
    const context = this.context;
    const size = Math.max(2.5, this.board.cell * 0.045);
    const start = point.x - ((ids.length - 1) * size * 1.45) / 2;
    ids.forEach((id, index) => {
      const hue = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;
      context.beginPath();
      context.arc(start + index * size * 1.45, point.y + direction * this.board.cell * 0.38, size, 0, Math.PI * 2);
      context.fillStyle = `hsl(${hue} 70% 62%)`;
      context.fill();
      context.strokeStyle = "rgba(0,0,0,.7)";
      context.lineWidth = 1;
      context.stroke();
    });
  }

  #drawRadialCooldown(point, ratio) {
    const context = this.context;
    context.save();
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.arc(point.x, point.y, this.board.cell * 0.34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(ratio, 0, 1));
    context.closePath();
    context.fillStyle = "rgba(3,9,15,.55)";
    context.fill();
    context.restore();
  }

  #drawCore(core, rawCell) {
    const cell = getPoint(rawCell ?? { col: 10, row: 3 });
    const point = this.#toCanvas(cell.col, cell.row);
    const context = this.context;
    const pulse = 0.95 + Math.sin(Date.now() / 500) * 0.05;
    context.save();
    context.translate(point.x, point.y);
    context.scale(pulse, pulse);
    context.rotate(Math.PI / 4);
    const size = this.board.cell * 0.34;
    context.fillStyle = "#75dcff";
    context.shadowColor = "#6ee7ff";
    context.shadowBlur = this.board.cell * 0.3;
    context.fillRect(-size, -size, size * 2, size * 2);
    context.shadowBlur = 0;
    context.strokeStyle = "#effcff";
    context.lineWidth = Math.max(2, this.board.cell * 0.05);
    context.strokeRect(-size, -size, size * 2, size * 2);
    context.restore();
    if ((core?.shield ?? 0) > 0) {
      context.beginPath();
      context.arc(point.x, point.y, this.board.cell * 0.48, 0, Math.PI * 2);
      context.strokeStyle = "rgba(115,218,255,.7)";
      context.lineWidth = Math.max(2, this.board.cell * 0.04);
      context.stroke();
    }
  }

  #drawCenteredLabel(title, subtitle) {
    const context = this.context;
    const width = Math.min(360, this.viewport.width * 0.6);
    const height = 86;
    const x = (this.viewport.width - width) / 2;
    const y = (this.viewport.height - height) / 2;
    roundedRect(context, x, y, width, height, 14);
    context.fillStyle = "rgba(4,11,21,.88)";
    context.fill();
    context.strokeStyle = "rgba(142,219,255,.36)";
    context.stroke();
    context.textAlign = "center";
    context.fillStyle = "#f4fbff";
    context.font = "800 22px system-ui";
    context.fillText(title, this.viewport.width / 2, y + 34);
    context.fillStyle = "rgba(218,238,248,.72)";
    context.font = "500 12px system-ui";
    context.fillText(subtitle, this.viewport.width / 2, y + 58);
  }

  #drawAimingOverlay() {
    const context = this.context;
    context.save();
    context.strokeStyle = "rgba(255,226,122,.9)";
    context.lineWidth = Math.max(2, this.board.cell * 0.035);
    context.setLineDash([this.board.cell * 0.14, this.board.cell * 0.09]);
    roundedRect(context, this.board.x, this.board.y, this.board.width, this.board.height, 8);
    context.stroke();
    context.restore();
  }

  #drawDebug(snapshot, debugStats = {}) {
    const context = this.context;
    const summaryLines = [
      `phase ${snapshot.phase}${snapshot.paused ? " / paused" : ""}`,
      `t ${Number(snapshot.time ?? 0).toFixed(2)}  speed ${snapshot.speed ?? 1}x`,
      `enemy ${snapshot.enemies?.length ?? 0}/${snapshot.limits?.enemies ?? 65}`,
      `projectile ${snapshot.projectiles?.length ?? 0}/${snapshot.limits?.projectiles ?? 160}`,
      `area ${snapshot.areaEffects?.length ?? 0}`,
      `particle ${snapshot.particles?.length ?? 0}/${snapshot.limits?.particles ?? 500}  popup ${snapshot.damagePopups?.length ?? 0}/${snapshot.limits?.damagePopups ?? 60}`,
      `fps ${Number(debugStats.fps ?? 0).toFixed(0)}  update ${Number(debugStats.updateMs ?? 0).toFixed(2)}ms`,
      `render ${Number(debugStats.renderMs ?? 0).toFixed(2)}ms  pool ${snapshot.limits?.pool?.available ?? 0}`,
    ];
    const statusLabel = (statuses) => Object.entries(statuses ?? {})
      .map(([id, entry]) => `${id}${Number(entry?.stacks) > 1 ? `:${Number(entry.stacks).toFixed(0)}` : ""}`)
      .join(",") || "-";
    const enemyLines = (snapshot.enemies ?? []).map((enemy) =>
      `E ${enemy.id} hp ${Math.ceil(enemy.hp)}/${Math.ceil(enemy.maxHp)} R ${Number(enemy.physicalResist ?? 0).toFixed(2)}/${Number(enemy.magicResist ?? 0).toFixed(2)} S ${statusLabel(enemy.statuses)} P ${(Number(enemy.progress ?? 0) * 100).toFixed(0)}%`,
    );
    const allyLines = (snapshot.allies ?? []).map((ally) =>
      `A ${ally.id} -> ${ally.targetId ?? "-"} CD ${Math.max(0, Number(ally.attackCooldown ?? 0)).toFixed(2)}`,
    );
    const lines = [...summaryLines, ...enemyLines, ...allyLines];
    const lineHeight = 13;
    const width = Math.min(this.viewport.width - this.board.x - 12, 510);
    const maxLines = Math.max(summaryLines.length, Math.floor((this.board.height - 12) / lineHeight));
    const visibleLines = lines.slice(0, maxLines);
    context.fillStyle = "rgba(0,0,0,.66)";
    context.fillRect(this.board.x + 6, this.board.y + 6, width, visibleLines.length * lineHeight + 10);
    context.font = "10px ui-monospace, monospace";
    context.fillStyle = "#9af6cd";
    context.textAlign = "left";
    context.textBaseline = "top";
    visibleLines.forEach((line, index) => context.fillText(line, this.board.x + 12, this.board.y + 11 + index * lineHeight));
  }

  cellFromPointer(event) {
    if (!event) return null;
    const rect = this.canvas.getBoundingClientRect?.() ?? { left: 0, top: 0, width: this.viewport.width, height: this.viewport.height };
    const scaleX = this.viewport.width / Math.max(1, Number(rect.width) || this.viewport.width);
    const scaleY = this.viewport.height / Math.max(1, Number(rect.height) || this.viewport.height);
    const clientX = Number(event.clientX ?? event.x);
    const clientY = Number(event.clientY ?? event.y);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    const x = (clientX - Number(rect.left ?? 0)) * scaleX;
    const y = (clientY - Number(rect.top ?? 0)) * scaleY;
    const col = Math.floor((x - this.board.x) / this.board.cell);
    const row = Math.floor((y - this.board.y) / this.board.cell);
    if (col < 0 || row < 0 || col >= this.board.cols || row >= this.board.rows) return null;
    return { col, row };
  }
}

export default BattleRenderer;
