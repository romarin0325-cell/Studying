import { ViewportLayout } from "./ViewportLayout.js";
import { SpriteResolver, drawResolvedSprite } from "./SpriteResolver.js";
import { illustration } from "./Illustrations.js";
import { HERO_BY_ID } from "../content/heroes.js";
import { JOURNEYS } from "../content/presentation.js";
import { roundedRect, drawFallbackToken } from './CanvasShapes.js';
export function spriteDestination(point, size, entry = null) {
  return { x: point.x - size * (entry?.pivotX ?? 0.5), y: point.y - size * (entry?.pivotY ?? 0.75), width: size, height: size };
}
export function clampSpriteToBoard(dest, rect) {
  dest.x = Math.min(Math.max(dest.x, rect.x), rect.x + rect.width - dest.width);
  dest.y = Math.min(Math.max(dest.y, rect.y), rect.y + rect.height - dest.height);
  return dest;
}
const COLORS = { water: "#8ddfe9", fire: "#ffad76", nature: "#bbdf8f", light: "#ffedac", dark: "#c7b0f0" };
export class BattleRenderer {
  constructor({ canvas, assetManager, effectRenderer = null } = {}) {
    if (!canvas?.getContext) throw new TypeError("BattleRenderer requires a canvas");
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.assetManager = assetManager;
    this.layout = new ViewportLayout({ canvas, dprCap: 2, battlefield: true });
    this.sprites = new SpriteResolver(assetManager);
    this.effectRenderer = effectRenderer;
    this.gameTimeSeconds = 0;
    this.reduced = false;
    this.attacks = /* @__PURE__ */ new Map();
    this.impacts = new Map();
    this.departures = new Map();
    this.selectedHeroId = null;
    this.aim = null;
    this.cache = null;
    this.hitMasks = new WeakMap();
  }
  setReduced(value) {
    this.reduced = Boolean(value);
  }
  advanceGameTime(delta) {
    if (Number.isFinite(delta) && delta > 0) this.gameTimeSeconds += delta;
    for (const [id, hit] of this.impacts) if (hit.until < this.gameTimeSeconds) this.impacts.delete(id);
    for (const [id, death] of this.departures) if (death.until < this.gameTimeSeconds) this.departures.delete(id);
  }
  resize() {
    this.cache = null;
    const b = this.canvas.parentElement.getBoundingClientRect();
    const view = this.canvas.ownerDocument?.defaultView;
    const landscape = view ? view.innerWidth > view.innerHeight : null;
    return this.layout.resize(b.width, b.height, globalThis.devicePixelRatio ?? 1, landscape);
  }
  clientToLogical(x, y) {
    return this.layout.clientToLogical(x, y, this.canvas.getBoundingClientRect());
  }
  feedback(event) {
    if (event.sourceId && ["attack_prepare", "attack_launched", "skill_cast"].includes(event.type))
      this.attacks.set(event.sourceId, { until: this.gameTimeSeconds + (event.actionKind === 'skill' ? .42 : .28), x: event.targetX ?? event.x, y: event.targetY ?? event.y });
    if (event.type === 'hit' && event.amount > 0 && !event.visualOnly) {
      this.impacts.set(event.targetId, { until: this.gameTimeSeconds + .13, strength: event.critical ? 1 : .6 });
    }
    if (event.type === 'enemy_defeated' && this.departures.size < 24)
      this.departures.set(event.enemy.id, { enemy: event.enemy, until: this.gameTimeSeconds + .24 });
  }
  render(snapshot) {
    this.lastSnapshot = snapshot;
    const ctx = this.context;
    this.layout.beginFrame(ctx);
    this.drawTerrain(ctx, snapshot);
    this.drawPlacements(ctx, snapshot);
    const entities = [...snapshot.heroes.filter((h) => h.placed).map((h) => ({ ...h, hero: true })), ...snapshot.enemies];
    entities.sort((a, b) => this.point(a).y - this.point(b).y);
    for (const entity of entities) this.drawEntity(ctx, entity, snapshot);
    if (!this.reduced) for (const { enemy, until } of this.departures.values()) {
      ctx.save(); ctx.globalAlpha = Math.max(0, (until - this.gameTimeSeconds) / .24);
      this.drawEntity(ctx, { ...enemy, departing: true }, snapshot); ctx.restore();
    }
    if (this.draggingHeroId && this.aim) {
      const hero = snapshot.heroes.find((h) => h.id === this.draggingHeroId);
      if (hero) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        this.drawEntity(ctx, { ...hero, hero: true, x: this.aim.x - 0.5, y: this.aim.y - 0.5 }, snapshot);
        ctx.restore();
      }
    }
    this.effectRenderer?.render(ctx, this.layout, snapshot.projectiles ?? []);
    if (!this.reduced) this.drawMotes(ctx);
  }
  point(entity) {
    return entity.hero ? this.layout.logicalCellCenterToCanvas(entity.x, entity.y) : this.layout.logicalToCanvas(entity.x, entity.y);
  }
  drawTerrain(ctx, snapshot) {
    const w = this.layout.cssWidth, h = this.layout.cssHeight, world = this.assetManager.getImage("illustration/worlds");
    const key = `${snapshot.stage.id}:${w}:${h}:${Boolean(world)}`;
    if (this.cache?.key !== key) {
      const surface = document.createElement("canvas");
      surface.width = Math.ceil(w * this.layout.dpr);
      surface.height = Math.ceil(h * this.layout.dpr);
      const c = surface.getContext("2d");
      c.scale(this.layout.dpr, this.layout.dpr);
      c.fillStyle = "#aac6af";
      c.fillRect(0, 0, w, h);
      if (world) {
        const index = JOURNEYS[snapshot.stage.id]?.art ?? 0, iw = world.naturalWidth || world.width, ih = world.naturalHeight || world.height;
        c.drawImage(world, index % 3 * iw / 3, Math.floor(index / 3) * ih / 2, iw / 3, ih / 2, 0, 0, w, h);
      }
      const path = snapshot.stage.path, cell2 = this.layout.logicalRadiusToCanvas(1), dark = snapshot.stage.theme === "chaos";
      const trace = () => {
        c.beginPath();
        path.forEach((p, i) => {
          const q = this.layout.logicalCellCenterToCanvas(p.x, p.y);
          if (i) c.lineTo(q.x, q.y);
          else c.moveTo(q.x, q.y);
        });
      };
      c.lineJoin = "round";
      c.lineCap = "round";
      c.save();
      c.translate(0, 3);
      c.strokeStyle = dark ? "#28294088" : "#526d5c70";
      c.lineWidth = cell2 * 0.98;
      trace();
      c.stroke();
      c.restore();
      c.strokeStyle = dark ? "#737c9d" : "#c3b99c";
      c.lineWidth = cell2 * 0.94;
      trace();
      c.stroke();
      c.strokeStyle = dark ? "#a0a6bc" : "#ebe0c5";
      c.lineWidth = cell2 * 0.78;
      trace();
      c.stroke();
      c.strokeStyle = dark ? "#b4b7c6" : "#f5ebd5";
      c.lineWidth = cell2 * 0.54;
      trace();
      c.stroke();
      for (let i = 1; i < path.length - 1; i++) {
        const p = this.layout.logicalCellCenterToCanvas(path[i].x, path[i].y), next = this.layout.logicalCellCenterToCanvas(path[i + 1].x, path[i + 1].y), angle = Math.atan2(next.y - p.y, next.x - p.x);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(angle);
        c.strokeStyle = dark ? "#727c9444" : "#b4a78b55";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, -cell2 * 0.3);
        c.lineTo(0, cell2 * 0.3);
        c.stroke();
        c.restore();
      }
      this.cache = { key, surface };
    }
    ctx.drawImage(this.cache.surface, 0, 0, w, h);
    const cell = this.layout.logicalRadiusToCanvas(1), first = snapshot.stage.path[0], last = snapshot.stage.path[snapshot.stage.path.length - 1];
    if (first) this.drawProp(ctx, "portal", this.layout.logicalCellCenterToCanvas(first.x, first.y), cell * 1.9);
    if (last) this.drawProp(ctx, "core", this.layout.logicalCellCenterToCanvas(last.x, last.y), cell * 1.9);
    if (snapshot.phase === "PREPARATION") for (let i = 4; i < snapshot.stage.path.length - 1; i += 7) {
      const p = snapshot.stage.path[i], n = snapshot.stage.path[i + 1], q = this.layout.logicalCellCenterToCanvas(p.x, p.y), r = this.layout.logicalCellCenterToCanvas(n.x, n.y);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(Math.atan2(r.y - q.y, r.x - q.x));
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#716c57";
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-3, -4);
      ctx.lineTo(-3, 4);
      ctx.fill();
      ctx.restore();
    }
  }
  drawProp(ctx, id, point, size) {
    const art = illustration(this.assetManager, id);
    if (art) drawResolvedSprite(ctx, art, { x: point.x - size / 2, y: point.y - size * 0.8, width: size, height: size });
    else drawFallbackToken(ctx, { x: point.x, y: point.y-size*.2, size: size*.65, kind: id, label: id === 'core' ? '✦' : '→', color: id === 'core' ? '#298fa5' : '#79609d' });
  }
  hitMask(art) {
    const frame = art.frame ?? {x:0,y:0,width:1,height:1};
    const key = `${frame.x}:${frame.y}:${frame.width}:${frame.height}`;
    let frames = this.hitMasks.get(art.image);
    if (!frames) { frames = new Map(); this.hitMasks.set(art.image, frames); }
    if (frames.has(key)) return frames.get(key);
    const surface = this.canvas.ownerDocument.createElement('canvas');
    const iw = art.image.naturalWidth || art.image.width, ih = art.image.naturalHeight || art.image.height;
    surface.width = Math.min(256, Math.max(1, Math.ceil(frame.width * iw)));
    surface.height = Math.min(256, Math.max(1, Math.ceil(frame.height * ih)));
    const context = surface.getContext('2d');
    drawResolvedSprite(context, art, {x:0,y:0,width:surface.width,height:surface.height});
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = '#ffffff'; context.fillRect(0,0,surface.width,surface.height);
    frames.set(key, surface);
    return surface;
  }
  drawPlacements(ctx, snapshot) {
    const canPlace = ["PREPARATION", "INTERMISSION"].includes(snapshot.phase), cell = this.layout.logicalRadiusToCanvas(1);
    const hero = snapshot.heroes.find((h) => h.id === this.selectedHeroId);
    const center = this.aim ?? (hero?.placed ? { x: hero.x + 0.5, y: hero.y + 0.5 } : null);
    const preview = canPlace && !this.spellAiming && center ? this.getPlacementPreview?.(center) : null;
    if (center && (canPlace || this.spellAiming)) {
      const origin = preview?.geometry.source ?? center;
      const p = this.layout.logicalToCanvas(origin.x, origin.y), range = this.spellAiming ? 2.6 : preview?.geometry.range ?? this.selectedRange ?? HERO_BY_ID[hero?.id]?.attack.range ?? 3;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.layout.boardRect.x, this.layout.boardRect.y, this.layout.boardRect.width, this.layout.boardRect.height);
      ctx.clip();
      ctx.fillStyle = this.spellAiming ? "#b9e8ff30" : "#d5f2ea25";
      ctx.strokeStyle = this.spellAiming ? "#e2f8ff" : "#fcfff4";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, range * this.layout.boardRect.width / 12, range * this.layout.boardRect.height / 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (preview) {
        const geometry = preview.geometry;
        ctx.setLineDash([]);
        if (['laser', 'shotgun'].includes(geometry.archetype)) for (const ray of geometry.rays) {
          const end = this.layout.logicalToCanvas(ray.end.x, ray.end.y);
          ctx.strokeStyle = '#fff1ba'; ctx.lineWidth = geometry.archetype === 'laser' ? Math.max(2, cell * .14) : 2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        }
        for (const link of preview.links) {
          const from = this.layout.logicalToCanvas(link.source.x, link.source.y), to = this.layout.logicalToCanvas(link.target.x, link.target.y);
          ctx.strokeStyle = '#c7adff'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (!canPlace) return;
    for (const spot of snapshot.stage.placementCells) {
      if (snapshot.heroes.some((h) => h.placed && h.x === spot.x && h.y === spot.y)) continue;
      const p = this.layout.logicalCellCenterToCanvas(spot.x, spot.y);
      ctx.save();
      ctx.fillStyle = "#233449e6";
      ctx.strokeStyle = '#d8c89c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cell * 0.42, cell * 0.29, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d8c89c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(11, cell * .42)}px system-ui`;
      ctx.fillText('＋', p.x, p.y);
      ctx.restore();
    }
  }
  drawEntity(ctx, e, snapshot) {
    const p = this.point(e), cell = this.layout.logicalRadiusToCanvas(1), pulse = this.attacks.get(e.id), attack = e.hero && pulse?.until > this.gameTimeSeconds;
    const t = this.gameTimeSeconds, air = !e.hero && e.defenseType === "air";
    const bob = this.reduced ? 0 : e.hero ? Math.sin(t * 2 + e.slot) * 1 : Math.sin(t * (air ? 5 : 12) + e.progress) * cell * 0.035;
    const size = cell * (e.hero ? 2.15 : e.isBoss ? 2.6 : 1.18);
    let art = illustration(this.assetManager, e.hero ? e.id : e.enemyId, attack);
    if (!art && (e.hero || e.isBoss)) art = this.sprites.resolve({ kind: e.hero ? "hero" : "boss", id: e.hero ? e.id : e.enemyId, direction: e.direction });
    ctx.save();
    ctx.fillStyle = "#1d334b30";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 3, size * 0.23, cell * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (e.hero && e.id === this.selectedHeroId && snapshot.phase !== "WAVE_RUNNING") {
      ctx.strokeStyle = "#fffbe1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cell * 0.6, cell * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.bossState && !e.departing) {
      const cast=e.bossState;
      if(['windup','active'].includes(cast.phase) || cast.interrupted) {
        ctx.save();
        ctx.strokeStyle=cast.interrupted?'#fff5b4':cast.phase==='windup'?'#ffca81':COLORS[e.element];
        ctx.lineWidth=3;ctx.globalAlpha=.85;
        ctx.beginPath();ctx.ellipse(p.x,p.y+2,cell*.85,cell*.35,0,0,Math.PI*2);ctx.stroke();
        if(cast.phase==='windup') {
          ctx.beginPath();ctx.arc(p.x,p.y-size*.46,cell*.98,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-cast.remaining/cast.duration));ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (e.hero && e.buffs?.length) {
      ctx.strokeStyle = COLORS[e.element];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cell * 0.57, cell * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (art) {
      const iw = art.image.naturalWidth || art.image.width, ih = art.image.naturalHeight || art.image.height;
      const ratio = art.frame ? art.frame.width * iw / (art.frame.height * ih) : 1;
      const height = size, width = height * ratio;
      const lunge = attack && !this.reduced ? Math.sin((pulse.until - t) / 0.3 * Math.PI) * cell * 0.13 : 0;
      const flip = e.direction === "left";
      ctx.save();
      ctx.translate(p.x + (flip ? -lunge : lunge), p.y - bob - (air ? cell * 0.17 : 0));
      const hit = !e.hero && this.impacts.get(e.id);
      const hitStrength = hit && !this.reduced ? Math.max(0,(hit.until-t)/.13*hit.strength) : 0;
      if (hit && !this.reduced) {
        ctx.scale(1 + hitStrength * .075, 1 - hitStrength * .06);
      }
      if (flip) ctx.scale(-1, 1);
      if (attack && !this.reduced) ctx.rotate(flip ? -0.035 : 0.035);
      drawResolvedSprite(ctx, art, { x: -width / 2, y: -height * (e.hero ? .94 : .87), width, height });
      if (hitStrength) {
        // Cache a small alpha silhouette once per frame. Per-hit Canvas filters
        // otherwise create costly intermediate surfaces on high-DPR displays.
        ctx.globalAlpha *= hitStrength * .62;
        ctx.drawImage(this.hitMask(art), -width/2, -height*.87, width, height);
      }
      ctx.restore();
    }
    if (!art) drawFallbackToken(ctx, { x: p.x, y: p.y-size*.35, size: size*.7, label: e.name?.slice(0,1) ?? '?', color: COLORS[e.element] ?? '#7b638f', kind: e.isBoss ? 'boss' : e.defenseType });
    if (e.hero) {
      ctx.save();
      ctx.fillStyle = "#fffdf0ee";
      ctx.beginPath();
      roundedRect(ctx, p.x - cell * 0.42, p.y + cell * 0.12, cell * 0.84, 13, 5);
      ctx.fill();
      ctx.fillStyle = "#536763";
      ctx.font = "bold 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`Lv.${e.level}`, p.x, p.y + cell * 0.12 + 10);
      ctx.restore();
    } else if (!e.departing) {
      const width = cell * (e.isBoss ? 1.4 : 0.67), y = p.y - size * 0.82;
      ctx.fillStyle = "#233c4277";
      ctx.fillRect(p.x - width / 2, y, width, 3);
      ctx.fillStyle = e.isBoss ? "#e6a5bd" : "#bfe4a0";
      ctx.fillRect(p.x - width / 2, y, width * Math.max(0, e.hp / e.maxHp), 3);
      if (e.statuses?.slow || e.statuses?.stun) {
        ctx.strokeStyle = e.statuses.stun ? "#fdf6bd" : "#a5e4ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, cell * 0.4, cell * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  drawMotes(ctx) {
    ctx.save();
    for (let i = 0; i < 9; i++) {
      const t = this.gameTimeSeconds * 0.14 + i * 1.7, x = (Math.sin(i * 43) * 0.5 + 0.5) * this.layout.cssWidth, y = (i / 9 + this.gameTimeSeconds * 8e-3) % 1 * this.layout.cssHeight;
      ctx.globalAlpha = 0.15 + 0.2 * (0.5 + 0.5 * Math.sin(t));
      ctx.fillStyle = "#fff9d8";
      ctx.beginPath();
      ctx.arc(x + Math.sin(t) * 9, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
export default BattleRenderer;
