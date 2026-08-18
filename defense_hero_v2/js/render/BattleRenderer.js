import { ViewportLayout, logicalToViewPoint } from './ViewportLayout.js';
import { SpriteResolver, drawResolvedSprite } from './SpriteResolver.js';
import { HERO_BY_ID } from '../content/heroes.js';
import { AURA_BUFF_BY_ID } from '../content/buffs.js';

const BURST_PULSE_SECONDS = 0.15;
const BUFF_GLOW_PERIOD_SECONDS = 2.4;

const DEFENSE_COLORS = Object.freeze({
  normal: '#f5d48a',
  air: '#8ce5ff',
  heavy: '#aeb8cf',
  regeneration: '#70dc8c',
  demon: '#d085ed',
  boss: '#ff7089',
});

const ELEMENT_COLORS = Object.freeze({
  fire: '#ff7155', water: '#55c8ff', nature: '#79d76b', light: '#ffe27a', dark: '#bb83e8',
});

function roundedRect(context, x, y, width, height, radius) {
  const safe = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect?.(x, y, width, height, safe);
  if (!context.roundRect) context.rect(x, y, width, height);
}

export function spriteDestination(point, size, entry = null) {
  const pivotX = Number.isFinite(entry?.pivotX) ? entry.pivotX : 0.5;
  const pivotY = Number.isFinite(entry?.pivotY) ? entry.pivotY : 0.75;
  return {
    x: point.x - size * pivotX,
    y: point.y - size * pivotY,
    width: size,
    height: size,
  };
}

export class BattleRenderer {
  constructor({ canvas, assetManager, effectRenderer = null } = {}) {
    if (!canvas?.getContext) throw new TypeError('BattleRenderer requires a canvas');
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.layout = new ViewportLayout({ canvas, dprCap: 2 });
    this.sprites = new SpriteResolver(assetManager);
    this.effectRenderer = effectRenderer;
    this.lastSnapshot = null;
    this.gameTimeSeconds = 0;
    this.reduced = false;
    this.lastAttackTimers = new Map();
    this.burstPulses = new Map();
  }

  setReduced(reduced) {
    this.reduced = Boolean(reduced);
  }

  advanceGameTime(deltaSeconds) {
    const delta = Number(deltaSeconds);
    if (Number.isFinite(delta) && delta > 0) this.gameTimeSeconds += delta;
  }

  resize() {
    const bounds = this.canvas.parentElement?.getBoundingClientRect?.() ?? this.canvas.getBoundingClientRect();
    return this.layout.resize(bounds.width, bounds.height, globalThis.devicePixelRatio ?? 1);
  }

  render(snapshot) {
    this.lastSnapshot = snapshot;
    const context = this.context;
    this.layout.beginFrame(context);
    this.#drawBackdrop(context, snapshot.stage.theme);
    this.#drawBoard(context, snapshot);
    this.#drawHeroes(context, snapshot.heroes);
    this.#drawEnemies(context, snapshot.enemies);
    this.effectRenderer?.render(context, this.layout);
  }

  clientToLogical(clientX, clientY) {
    return this.layout.clientToLogical(clientX, clientY, this.canvas.getBoundingClientRect());
  }

  #drawBackdrop(context, theme) {
    const gradient = context.createLinearGradient(0, 0, 0, this.layout.cssHeight);
    if (theme === 'chaos') {
      gradient.addColorStop(0, '#171027');
      gradient.addColorStop(1, '#321335');
    } else {
      gradient.addColorStop(0, '#17233a');
      gradient.addColorStop(1, '#3f2b25');
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.layout.cssWidth, this.layout.cssHeight);
  }

  #cellRect(x, y) {
    const corners = [
      this.layout.logicalToCanvas(x, y),
      this.layout.logicalToCanvas(x + 1, y),
      this.layout.logicalToCanvas(x, y + 1),
      this.layout.logicalToCanvas(x + 1, y + 1),
    ];
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    return {
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  #drawBoard(context, snapshot) {
    const path = new Set(snapshot.stage.path.map(({ x, y }) => `${x},${y}`));
    const obstacles = new Set(snapshot.stage.obstacles.map(({ x, y }) => `${x},${y}`));
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        const rect = this.#cellRect(x, y);
        const key = `${x},${y}`;
        context.fillStyle = path.has(key)
          ? 'rgba(219, 180, 113, 0.32)'
          : ((x + y) % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.075)');
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.strokeStyle = 'rgba(255,255,255,0.08)';
        context.lineWidth = 1;
        context.strokeRect(rect.x + 0.5, rect.y + 0.5, Math.max(0, rect.width - 1), Math.max(0, rect.height - 1));
        if (obstacles.has(key)) {
          context.fillStyle = 'rgba(67,74,93,0.9)';
          roundedRect(context, rect.x + rect.width * 0.16, rect.y + rect.height * 0.16, rect.width * 0.68, rect.height * 0.68, 4);
          context.fill();
        }
      }
    }
    const start = snapshot.stage.path[0];
    const core = snapshot.stage.path.at(-1);
    this.#drawCellLabel(context, start.x, start.y, 'IN', '#7de9ff');
    this.#drawCellLabel(context, core.x, core.y, 'CORE', '#ffdd78');
  }

  #drawCellLabel(context, x, y, label, color) {
    const rect = this.#cellRect(x, y);
    context.save();
    context.fillStyle = `${color}33`;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.fillStyle = color;
    context.font = `800 ${Math.max(7, Math.min(rect.width, rect.height) * 0.26)}px system-ui`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
    context.restore();
  }

  #drawHeroes(context, heroes) {
    const cell = this.layout.logicalRadiusToCanvas(1);
    for (const hero of heroes) {
      if (!hero.placed) continue;
      const point = this.layout.logicalCellCenterToCanvas(hero.x, hero.y);
      this.#drawBuffGlow(context, hero, point, cell);
      let size = cell * 1.35;
      if (HERO_BY_ID[hero.id]?.attack?.archetype === 'burst') {
        size *= this.#burstPulseScale(hero);
      }
      const resolved = this.sprites.resolve({ kind: 'hero', id: hero.id, direction: hero.direction });
      if (!drawResolvedSprite(context, resolved, spriteDestination(point, size, resolved?.entry))) {
        context.save();
        context.fillStyle = ELEMENT_COLORS[hero.element] ?? '#fff';
        context.strokeStyle = '#fff';
        context.lineWidth = Math.max(1, cell * 0.05);
        context.beginPath();
        context.arc(point.x, point.y, cell * 0.36, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.fillStyle = '#1b1630';
        context.font = `900 ${Math.max(9, cell * 0.25)}px system-ui`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(hero.name.slice(0, 1), point.x, point.y);
        context.restore();
      }
      this.#drawBuffDots(context, hero, point, cell);
      this.#drawLevelBadge(context, point, hero.level, cell);
    }
  }

  #heroBuffs(hero) {
    return (hero.buffs ?? []).map((buffId) => AURA_BUFF_BY_ID[buffId]).filter(Boolean);
  }

  #drawBuffGlow(context, hero, point, cell) {
    if (this.reduced) return;
    const buffs = this.#heroBuffs(hero);
    if (buffs.length === 0) return;
    context.save();
    buffs.forEach((buff, index) => {
      const pulse = 0.5 + 0.5 * Math.sin(this.gameTimeSeconds * (Math.PI * 2 / BUFF_GLOW_PERIOD_SECONDS) + index * 1.3);
      const radius = cell * (0.56 + index * 0.1) + cell * 0.04 * pulse;
      const alphaHex = Math.round((0.2 + 0.22 * pulse) * 255).toString(16).padStart(2, '0');
      const gradient = context.createRadialGradient(point.x, point.y, radius * 0.35, point.x, point.y, radius);
      gradient.addColorStop(0, `${buff.color}00`);
      gradient.addColorStop(0.75, `${buff.color}00`);
      gradient.addColorStop(1, `${buff.color}${alphaHex}`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = `${buff.color}${alphaHex}`;
      context.lineWidth = Math.max(1, cell * 0.045);
      context.beginPath();
      context.arc(point.x, point.y, radius * 0.94, 0, Math.PI * 2);
      context.stroke();
    });
    context.restore();
  }

  #drawBuffDots(context, hero, point, cell) {
    const buffs = this.#heroBuffs(hero);
    if (buffs.length === 0) return;
    context.save();
    buffs.forEach((buff, index) => {
      const x = point.x + (index - (buffs.length - 1) / 2) * cell * 0.2;
      const y = point.y + cell * 0.5;
      context.fillStyle = '#19142ddd';
      context.beginPath();
      context.arc(x, y, cell * 0.085, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = buff.color;
      context.beginPath();
      context.arc(x, y, cell * 0.055, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  }

  #burstPulseScale(hero) {
    const previousTimer = this.lastAttackTimers.get(hero.id);
    if (previousTimer !== undefined && hero.attackTimer > previousTimer + 1) {
      this.burstPulses.set(hero.id, this.gameTimeSeconds + BURST_PULSE_SECONDS);
    }
    this.lastAttackTimers.set(hero.id, hero.attackTimer);
    const remaining = (this.burstPulses.get(hero.id) ?? 0) - this.gameTimeSeconds;
    return remaining > 0 ? 1 + 0.18 * (remaining / BURST_PULSE_SECONDS) : 1;
  }

  #drawLevelBadge(context, point, level, cell) {
    context.save();
    context.fillStyle = '#151528dd';
    context.strokeStyle = '#ffe79b';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(point.x + cell * 0.3, point.y - cell * 0.3, cell * 0.15, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#fff';
    context.font = `800 ${Math.max(7, cell * 0.16)}px system-ui`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(level, point.x + cell * 0.3, point.y - cell * 0.3);
    context.restore();
  }

  #drawEnemies(context, enemies) {
    const cell = this.layout.logicalRadiusToCanvas(1);
    for (const enemy of enemies) {
      const point = this.layout.logicalToCanvas(enemy.x, enemy.y);
      if (enemy.isBoss) {
        const size = cell * 1.65;
        const resolved = this.sprites.resolve({ kind: 'boss', id: enemy.enemyId, direction: enemy.direction });
        if (!drawResolvedSprite(context, resolved, spriteDestination(point, size, resolved?.entry))) {
          this.#drawEnemyToken(context, point, enemy.defenseType, cell * 0.5, enemy.name.slice(0, 1));
        }
      } else {
        this.#drawEnemyToken(context, point, enemy.defenseType, cell * 0.3, '');
      }
      this.#drawHealth(context, point, enemy.hp / enemy.maxHp, cell, enemy.isBoss);
      this.#drawStatuses(context, point, enemy.statuses, cell);
    }
  }

  #drawEnemyToken(context, point, defenseType, radius, label) {
    context.save();
    context.fillStyle = DEFENSE_COLORS[defenseType] ?? '#fff';
    context.strokeStyle = '#2a1836';
    context.lineWidth = Math.max(1, radius * 0.18);
    context.beginPath();
    if (defenseType === 'air') {
      context.moveTo(point.x, point.y - radius);
      context.lineTo(point.x + radius, point.y + radius * 0.7);
      context.lineTo(point.x - radius, point.y + radius * 0.7);
    } else if (defenseType === 'heavy') {
      context.rect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    } else if (defenseType === 'regeneration') {
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        const value = index % 2 ? radius * 0.55 : radius;
        const x = point.x + Math.cos(angle) * value;
        const y = point.y + Math.sin(angle) * value;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
    } else if (defenseType === 'demon') {
      context.moveTo(point.x, point.y - radius);
      context.lineTo(point.x + radius, point.y);
      context.lineTo(point.x, point.y + radius);
      context.lineTo(point.x - radius, point.y);
    } else {
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    }
    context.closePath();
    context.fill();
    context.stroke();
    if (label) {
      context.fillStyle = '#23152c';
      context.font = `900 ${Math.max(8, radius * 0.8)}px system-ui`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, point.x, point.y);
    }
    context.restore();
  }

  #drawHealth(context, point, ratio, cell, boss) {
    const width = cell * (boss ? 0.95 : 0.62);
    const height = Math.max(3, cell * 0.08);
    const x = point.x - width / 2;
    const y = point.y - cell * (boss ? 0.72 : 0.48);
    context.fillStyle = '#1a1525cc';
    context.fillRect(x, y, width, height);
    context.fillStyle = ratio > 0.5 ? '#78e58d' : ratio > 0.2 ? '#ffd55f' : '#ff6b78';
    context.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), height);
  }

  #drawStatuses(context, point, statuses, cell) {
    const ids = Object.keys(statuses ?? {}).filter((id) => id !== 'stun_immunity').slice(0, 4);
    ids.forEach((id, index) => {
      context.fillStyle = '#19142ddd';
      context.beginPath();
      context.arc(point.x + (index - (ids.length - 1) / 2) * cell * 0.16, point.y + cell * 0.42, cell * 0.075, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.font = `700 ${Math.max(5, cell * 0.08)}px system-ui`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(id.slice(0, 1).toUpperCase(), point.x + (index - (ids.length - 1) / 2) * cell * 0.16, point.y + cell * 0.42);
    });
  }
}

export default BattleRenderer;
