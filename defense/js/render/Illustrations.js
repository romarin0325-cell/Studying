import { drawFallbackToken } from './CanvasShapes.js';
import { HERO_BY_ID } from '../content/heroes.js';
const MAIN = ["rumi", "luna", "cinderella", "zeke"];
const COMPANIONS = ["snow_rabbit", "avalanche_maid", "night_rabbit", "guardian", "storm_sage", "lightning_sage"];
const EMBER = ["red_dragon", "flame_sage", "mushroom_king"];
const TIDE = ["great_detective", "siren", "phantom"];
const CREATURES = ["ruin_scarab", "ember_scarab", "sand_wisp", "stone_guard", "regrowth_idol", "rift_shade", "rift_wing", "abyss_armor", "chaos_spawn", "lesser_demon", "flora", "pharaoh", "reaper", "demon_god", "core", "portal"];
export function heroIllustrationId(id) {
  return 'illustration/' + (MAIN.includes(id) ? 'heroes' : COMPANIONS.includes(id) ? 'companions' : EMBER.includes(id) ? 'companions-ember' : 'companions-tide');
}
export function illustration(manager, id, attacking = false) {
  let imageId, frame;
  if (MAIN.includes(id)) {
    const row = MAIN.indexOf(id);
    imageId = "illustration/heroes";
    frame = { x: attacking ? 0.5 : 0, y: row / 4, width: 0.5, height: 0.25 };
  } else if (COMPANIONS.includes(id)) {
    const index = COMPANIONS.indexOf(id);
    imageId = "illustration/companions";
    frame = { x: attacking ? 0.5 : 0, y: index / 6, width: 0.5, height: 1 / 6 };
  } else if (EMBER.includes(id) || TIDE.includes(id)) {
    const ember = EMBER.includes(id), row = (ember ? EMBER : TIDE).indexOf(id);
    imageId = ember ? 'illustration/companions-ember' : 'illustration/companions-tide';
    frame = { x: attacking ? .5 : 0, y: row / 3, width: .5, height: 1 / 3 };
  } else if (CREATURES.includes(id)) {
    const index = CREATURES.indexOf(id);
    imageId = "illustration/creatures";
    frame = { x: index % 4 / 4, y: Math.floor(index / 4) / 4, width: 0.25, height: 0.25 };
  } else return null;
  const image = manager?.getImage(imageId);
  return image ? { image, frame, entry: { pivotX: 0.5, pivotY: 0.9 } } : null;
}
export function paintPortraits(root, manager, selector = "[data-portrait]") {
  const paint = () => {
    if (!root?.isConnected) return;
    for (const canvas of root.querySelectorAll(selector)) {
      const id = canvas.dataset.portrait ?? canvas.dataset.heroAvatar;
      const art = illustration(manager, id) ?? (manager.getImage(`portrait/${id}`) ? { image: manager.getImage(`portrait/${id}`), frame: { x: 0, y: 0, width: 1, height: 1 } } : null);
      const ctx = canvas.getContext("2d");
      canvas.dataset.portraitSource = !art ? 'token' : illustration(manager, id) ? 'atlas' : 'legacy';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!art) {
        drawFallbackToken(ctx, { x: canvas.width/2, y: canvas.height/2, size: canvas.height*.85, label: HERO_BY_ID[id]?.name?.slice(0,1) ?? '?', kind: 'hero' });
        continue;
      }
      const { image, frame } = art;
      const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ratio = frame.width * iw / (frame.height * ih);
      const height = canvas.height, width = height * ratio;
      ctx.drawImage(image, frame.x * iw, frame.y * ih, frame.width * iw, frame.height * ih, (canvas.width - width) / 2, 0, width, height);
    }
  };
  paint();
  // Repaint each completed atlas independently. A hanging companion request
  // must not hide a loaded main portrait (or delay its fallback).
  const portraitIds = [...root.querySelectorAll(selector)].map(canvas => canvas.dataset.portrait ?? canvas.dataset.heroAvatar);
  for (const atlasId of new Set(portraitIds.map(heroIllustrationId))) {
    manager.preload([atlasId]).then(async summary => {
      paint();
      if (!summary.failed.length) return;
      const ids = portraitIds.filter(id => heroIllustrationId(id) === atlasId);
      await Promise.all(ids.map(id => manager.preload([`portrait/${id}`]).then(paint)));
    });
  }
}
