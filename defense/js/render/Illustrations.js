const MAIN = ["rumi", "luna", "cinderella", "zeke"];
const COMPANIONS = ["snow_rabbit", "avalanche_maid", "night_rabbit", "guardian", "storm_sage", "lightning_sage"];
const CREATURES = ["ruin_scarab", "ember_scarab", "sand_wisp", "stone_guard", "regrowth_idol", "rift_shade", "rift_wing", "abyss_armor", "chaos_spawn", "lesser_demon", "flora", "pharaoh", "reaper", "demon_god", "core", "portal"];
const COMPANION_BOUNDS = [
  [[18, 0, 305, 368], [336, 0, 380, 368]],
  [[730, 0, 303, 368], [1035, 0, 409, 368]],
  [[25, 370, 276, 350], [332, 370, 386, 350]],
  [[739, 367, 295, 355], [1038, 367, 404, 355]],
  [[10, 722, 292, 360], [323, 716, 395, 367]],
  [[729, 722, 282, 363], [1002, 722, 442, 363]]
];
export function illustration(manager, id, attacking = false) {
  let imageId, frame;
  if (MAIN.includes(id)) {
    const row = MAIN.indexOf(id);
    const boundaries = [0, 0.254, 0.501, 0.736, 1];
    imageId = "illustration/heroes";
    frame = { x: attacking ? 0.5 : 0, y: boundaries[row], width: 0.5, height: boundaries[row + 1] - boundaries[row] };
  } else if (COMPANIONS.includes(id)) {
    const index = COMPANIONS.indexOf(id);
    imageId = "illustration/companions";
    const [x, y, w, h] = COMPANION_BOUNDS[index][Number(attacking)];
    frame = { x: x / 1448, y: y / 1086, width: w / 1448, height: h / 1086 };
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
      const art = illustration(manager, id);
      if (!art) continue;
      const ctx = canvas.getContext("2d");
      const { image, frame } = art;
      const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ratio = frame.width * iw / (frame.height * ih);
      const height = canvas.height, width = height * ratio;
      ctx.drawImage(image, frame.x * iw, frame.y * ih, frame.width * iw, frame.height * ih, (canvas.width - width) / 2, 0, width, height);
    }
  };
  paint();
  manager.preload(["illustration/heroes", "illustration/companions"]).then(paint);
}
