const TAU = Math.PI * 2;

function colorWithAlpha(color, alpha) {
  if (color.startsWith("#") && color.length === 7) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${red},${green},${blue},${alpha})`;
  }
  return color;
}

const AREA_COLORS = Object.freeze({
  slow_field: "#67d9ff",
  damage_field: "#ff7043",
  delayed_attack: "#d4a8ff",
  arena: "#ffd56b",
  warning: "#ff4d94",
  apocalypse: "#ff4d94",
  area: "#d4a8ff",
});

export class EffectRenderer {
  constructor(context) {
    this.context = context;
  }

  drawAreas(areas, toCanvas, cellSize, time = 0) {
    const context = this.context;
    for (const area of areas ?? []) {
      const point = toCanvas(area.x, area.y);
      const radius = Math.max(2, Number(area.radius) * cellSize);
      const color = AREA_COLORS[area.colorToken] ?? AREA_COLORS[area.kind] ?? AREA_COLORS.area;
      const pulse = 0.82 + Math.sin(time * 5 + Number.parseInt(String(area.id).slice(-2), 10)) * 0.12;
      context.save();
      context.beginPath();
      context.arc(point.x, point.y, radius * pulse, 0, TAU);
      context.fillStyle = colorWithAlpha(color, area.telegraph ? 0.12 : area.active ? 0.14 : 0.08);
      context.fill();
      context.setLineDash(area.active && !area.telegraph ? [] : [Math.max(3, cellSize * 0.12), Math.max(3, cellSize * 0.08)]);
      context.lineWidth = Math.max(1.5, cellSize * 0.035);
      context.strokeStyle = colorWithAlpha(color, area.active ? 0.85 : 0.65);
      context.stroke();
      if ((area.telegraph || !area.active) && Number.isFinite(area.telegraph ? area.duration : area.delay)) {
        context.setLineDash([]);
        context.fillStyle = "rgba(255,255,255,.88)";
        context.font = `700 ${Math.max(10, cellSize * 0.22)}px system-ui`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(Math.max(0, area.telegraph ? area.duration : area.delay).toFixed(1), point.x, point.y);
      }
      context.restore();
    }
  }

  drawProjectiles(projectiles, toCanvas, cellSize) {
    const context = this.context;
    for (const projectile of projectiles ?? []) {
      const point = toCanvas(projectile.x, projectile.y);
      const destination = toCanvas(projectile.destinationX, projectile.destinationY);
      const magic = projectile.colorToken === "magic";
      const color = magic ? "#d9a8ff" : "#ffd76d";
      context.save();
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(
        point.x - (destination.x - point.x) * 0.18,
        point.y - (destination.y - point.y) * 0.18,
      );
      context.strokeStyle = colorWithAlpha(color, 0.45);
      context.lineWidth = Math.max(2, cellSize * 0.07);
      context.stroke();
      context.beginPath();
      context.arc(point.x, point.y, Math.max(2.5, cellSize * 0.07), 0, TAU);
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = cellSize * 0.18;
      context.fill();
      context.restore();
    }
  }

  drawParticles(particles, toCanvas, cellSize) {
    const context = this.context;
    const colors = { critical: "#f0b8ff", advantage: "#ffe282", magic: "#d9a8ff", physical: "#ffd76d" };
    for (const particle of (particles ?? []).slice(0, 500)) {
      const point = toCanvas(particle.x, particle.y);
      const ratio = Math.max(0, Number(particle.ttl) / Math.max(0.001, Number(particle.maxTtl) || 1));
      context.save();
      context.globalAlpha = ratio;
      context.beginPath();
      context.arc(point.x, point.y, Math.max(1.2, cellSize * 0.035 * (0.5 + ratio)), 0, TAU);
      context.fillStyle = colors[particle.colorToken] ?? "#ffffff";
      context.fill();
      context.restore();
    }
  }

  drawPooledDamagePopups(popups, toCanvas, cellSize) {
    const context = this.context;
    for (const popup of (popups ?? []).slice(0, 60)) {
      const point = toCanvas(popup.x, popup.y);
      const ratio = Math.max(0, Number(popup.ttl) / Math.max(0.001, Number(popup.maxTtl) || 1));
      const label = `${popup.critical ? "★" : ""}${Math.round(popup.amount)}${popup.advantageous ? " ↑" : ""}`;
      context.save();
      context.globalAlpha = ratio;
      context.font = `${popup.critical ? 900 : 800} ${Math.max(10, cellSize * (popup.critical ? 0.25 : 0.21))}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = Math.max(2, cellSize * 0.045);
      context.strokeStyle = "rgba(3,8,15,.9)";
      context.fillStyle = popup.advantageous ? "#ffe282" : popup.critical ? "#f0b8ff" : "#ffffff";
      const popupY = point.y - cellSize * (0.45 + Number(popup.age) * 0.55);
      context.strokeText(label, point.x, popupY);
      context.fillText(label, point.x, popupY);
      context.restore();
    }
  }

  drawDamagePopups(events, entities, toCanvas, cellSize, time = 0) {
    const byId = new Map((entities ?? []).map((entity) => [entity.id, entity]));
    const recent = (events ?? [])
      .filter((event) => event.type === "damage" && Number(event.amount) > 0 && time - Number(event.time ?? 0) <= 0.85)
      .slice(-60);
    for (const event of recent) {
      const target = byId.get(event.targetId);
      const x = Number(event.x ?? target?.x);
      const y = Number(event.y ?? target?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const age = Math.max(0, time - Number(event.time ?? 0));
      const point = toCanvas(x, y);
      const alpha = Math.max(0, 1 - age / 0.85);
      const label = `${event.critical ? "✦" : ""}${Math.round(event.amount)}${event.advantageous ? " ↑" : ""}`;
      const context = this.context;
      context.save();
      context.globalAlpha = alpha;
      context.font = `${event.critical ? 900 : 800} ${Math.max(10, cellSize * (event.critical ? 0.25 : 0.21))}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = Math.max(2, cellSize * 0.045);
      context.strokeStyle = "rgba(3,8,15,.9)";
      context.fillStyle = event.advantageous ? "#ffe282" : event.critical ? "#f0b8ff" : "#ffffff";
      const popupY = point.y - cellSize * (0.45 + age * 0.55);
      context.strokeText(label, point.x, popupY);
      context.fillText(label, point.x, popupY);
      context.restore();
    }
  }

  drawBarricades(barricades, toCanvas, cellSize) {
    const context = this.context;
    for (const barrier of barricades ?? []) {
      const point = toCanvas(barrier.x, barrier.y);
      const ratio = Math.max(0, Number(barrier.durability) / Math.max(1, Number(barrier.maxDurability)));
      context.save();
      context.translate(point.x, point.y);
      context.fillStyle = "rgba(112,206,255,.28)";
      context.strokeStyle = "rgba(162,229,255,.9)";
      context.lineWidth = Math.max(2, cellSize * 0.045);
      context.beginPath();
      const radius = cellSize * 0.34;
      for (let index = 0; index < 6; index += 1) {
        const angle = Math.PI / 3 * index - Math.PI / 6;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = "rgba(12,25,45,.82)";
      context.fillRect(-radius, radius + 4, radius * 2, Math.max(3, cellSize * 0.06));
      context.fillStyle = "#79e7ff";
      context.fillRect(-radius, radius + 4, radius * 2 * ratio, Math.max(3, cellSize * 0.06));
      context.restore();
    }
  }
}

export default EffectRenderer;
