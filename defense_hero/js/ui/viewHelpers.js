const ICONS = {
  water: "◉",
  fire: "▲",
  nature: "♧",
  light: "✦",
  dark: "◐",
  normal: "●",
  rush: "➤",
  swarm: "⁙",
  armored: "⬢",
  magic: "◇",
  aerial: "⌁",
  split: "⑂",
  cleanse: "✚",
  support: "♢",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function iconFor(id) {
  return ICONS[id] ?? "◆";
}

export function elementPill(element, elements) {
  const definition = elements.find((item) => item.id === element);
  const name = definition?.name ?? element;
  return `<span class="element-pill" data-element="${escapeHtml(element)}" title="${escapeHtml(definition?.description ?? name)}">${iconFor(element)} ${escapeHtml(name)}</span>`;
}

export function threatPill(threat, enemies = []) {
  const definition = enemies.find((item) => item.id === threat);
  return `<span class="threat-pill">${iconFor(threat)} ${escapeHtml(definition?.name ?? threat)}</span>`;
}

export function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function hashSeed(value) {
  const text = String(value || "STAR-0001").trim().toUpperCase();
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
}
