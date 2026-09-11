import { DIRECTION } from '../core/enums.js';

const DIRECTIONS = new Set(Object.values(DIRECTION));

export function spriteAssetId(kind, entityId, direction = DIRECTION.FRONT) {
  const prefix = kind === 'boss' ? 'boss' : 'battle';
  const safeDirection = DIRECTIONS.has(direction) ? direction : DIRECTION.FRONT;
  return `${prefix}/${entityId}/${safeDirection}`;
}

export class SpriteResolver {
  constructor(assetManager) {
    this.assetManager = assetManager;
  }

  resolve({ kind = 'hero', id, direction = DIRECTION.FRONT } = {}) {
    const requestedId = spriteAssetId(kind, id, direction);
    const fallbackId = spriteAssetId(kind, id, DIRECTION.FRONT);
    const resolvedId = this.assetManager.getImage(requestedId) ? requestedId : fallbackId;
    const image = this.assetManager.getImage(resolvedId);
    if (!image) return null;
    const entry = this.assetManager.getEntry(resolvedId);
    return { image, entry, id: resolvedId, frame: entry?.frame ?? null };
  }

  resolvePortrait(heroId) {
    const id = `portrait/${heroId}`;
    const image = this.assetManager.getImage(id);
    if (!image) return null;
    const entry = this.assetManager.getEntry(id);
    return { image, entry, id, frame: entry?.frame ?? null };
  }
}

export function drawResolvedSprite(context, resolved, destination) {
  if (!resolved?.image) return false;
  const { image, frame } = resolved;
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) return false;
  if (frame) {
    context.drawImage(
      image,
      frame.x * imageWidth,
      frame.y * imageHeight,
      frame.width * imageWidth,
      frame.height * imageHeight,
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
  } else {
    context.drawImage(image, destination.x, destination.y, destination.width, destination.height);
  }
  return true;
}

export default SpriteResolver;
