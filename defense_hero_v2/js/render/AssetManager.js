const ASSET_TYPES = new Set(['image', 'audio']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeType(value) {
  const type = String(value ?? '').trim().toLowerCase();
  if (type === 'img') return 'image';
  if (type === 'sound' || type === 'sfx' || type === 'music') return 'audio';
  return type;
}

function normalizeManifest(manifest) {
  let entries;
  if (Array.isArray(manifest)) {
    entries = manifest;
  } else if (isRecord(manifest) && Array.isArray(manifest.assets)) {
    entries = manifest.assets;
  } else if (isRecord(manifest) && Array.isArray(manifest.entries)) {
    entries = manifest.entries;
  } else if (isRecord(manifest)) {
    entries = Object.entries(manifest).map(([id, entry]) => ({ id, ...entry }));
  } else {
    throw new TypeError('AssetManager manifest must be an array or object.');
  }

  const ids = new Set();
  return entries.map((rawEntry) => {
    if (!isRecord(rawEntry)) throw new TypeError('Asset manifest entries must be objects.');
    const id = String(rawEntry.id ?? '').trim();
    const type = normalizeType(rawEntry.type);
    const path = String(rawEntry.path ?? rawEntry.url ?? '').trim();
    if (!id) throw new TypeError('Asset manifest entries require a non-empty id.');
    if (ids.has(id)) throw new TypeError(`Duplicate asset id: ${id}`);
    if (!ASSET_TYPES.has(type)) throw new TypeError(`Unsupported asset type for ${id}: ${type || '(missing)'}`);
    if (!path) throw new TypeError(`Asset manifest entry ${id} requires a non-empty path.`);
    ids.add(id);
    return Object.freeze({ ...rawEntry, id, type, path });
  });
}

function isGeneratedLightBackground(red, green, blue) {
  return Math.min(red, green, blue) >= 224
    && Math.max(red, green, blue) - Math.min(red, green, blue) <= 14;
}

function removeConnectedGeneratedBackground(image, entry) {
  if (entry?.backgroundStatus !== 'opaque-checkerboard-from-generation') return image;
  const canvas = globalThis.document?.createElement?.('canvas');
  const context = canvas?.getContext?.('2d', { willReadFrequently: true });
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!context || !width || !height) return image;

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const visited = new Uint8Array(width * height);
  const pending = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (index) => {
    if (visited[index]) return;
    const offset = index * 4;
    if (!isGeneratedLightBackground(data[offset], data[offset + 1], data[offset + 2])) return;
    visited[index] = 1;
    pending[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = pending[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    data[index * 4 + 3] = 0;
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function defaultImageLoader(path, entry) {
  if (typeof globalThis.Image !== 'function') {
    return Promise.reject(new Error('Image loading is unavailable in this environment.'));
  }
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image();
    image.decoding = 'async';
    image.onload = () => {
      try {
        resolve(removeConnectedGeneratedBackground(image, entry));
      } catch {
        resolve(image);
      }
    };
    image.onerror = () => reject(new Error(`Could not load image: ${path}`));
    image.src = globalThis.__HERO_DEFENSE_V2_EMBEDDED_ASSETS__?.[path] ?? path;
  });
}

function defaultAudioLoader(path) {
  if (typeof globalThis.Audio !== 'function') {
    return Promise.reject(new Error('Audio loading is unavailable in this environment.'));
  }
  return new Promise((resolve, reject) => {
    const audio = new globalThis.Audio();
    const cleanup = () => {
      audio.removeEventListener?.('canplaythrough', onReady);
      audio.removeEventListener?.('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve(audio);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Could not load audio: ${path}`));
    };
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = globalThis.__HERO_DEFENSE_V2_EMBEDDED_ASSETS__?.[path] ?? path;
    audio.load?.();
  });
}

/**
 * Loads manifest assets without making optional media a startup dependency.
 * getImage/getAudio are intentionally synchronous: render code receives either
 * a cached resource or null and can immediately draw its code fallback.
 */
export class AssetManager {
  constructor(manifestOrOptions = [], maybeOptions = {}) {
    const usingOptionsObject = isRecord(manifestOrOptions)
      && (Object.hasOwn(manifestOrOptions, 'manifest')
        || Object.hasOwn(manifestOrOptions, 'imageLoader')
        || Object.hasOwn(manifestOrOptions, 'audioLoader'));
    const options = usingOptionsObject ? manifestOrOptions : maybeOptions;
    const manifest = usingOptionsObject ? (manifestOrOptions.manifest ?? []) : manifestOrOptions;
    const {
      imageLoader = defaultImageLoader,
      audioLoader = defaultAudioLoader,
      logger = console,
    } = options;
    if (typeof imageLoader !== 'function') throw new TypeError('imageLoader must be a function.');
    if (typeof audioLoader !== 'function') throw new TypeError('audioLoader must be a function.');

    this.entries = normalizeManifest(manifest);
    this.entryById = new Map(this.entries.map((entry) => [entry.id, entry]));
    this.imageLoader = imageLoader;
    this.audioLoader = audioLoader;
    this.logger = logger;
    this.resourcesById = new Map();
    this.resourcesByRequest = new Map();
    this.pendingByRequest = new Map();
    this.failedUrls = new Set();
    this.errorsByUrl = new Map();
  }

  async preload(selection) {
    const { entries, missing } = this.#selectEntries(selection);
    const results = await Promise.all(entries.map((entry) => this.#load(entry)));
    const summary = { loaded: [], failed: [], cached: [], missing };
    results.forEach(({ id, status }) => {
      if (status === 'loaded') summary.loaded.push(id);
      else if (status === 'cached') summary.cached.push(id);
      else summary.failed.push(id);
    });
    return summary;
  }

  getImage(id) {
    return this.#get(id, 'image');
  }

  getAudio(id) {
    return this.#get(id, 'audio');
  }

  has(id) {
    return this.resourcesById.has(String(id));
  }

  getEntry(id) {
    return this.entryById.get(String(id)) ?? null;
  }

  #get(id, expectedType) {
    const key = String(id);
    const entry = this.entryById.get(key);
    if (!entry || entry.type !== expectedType) return null;
    return this.resourcesById.get(key) ?? null;
  }

  #selectEntries(selection) {
    if (selection === undefined || selection === null) return { entries: [...this.entries], missing: [] };
    if (Array.isArray(selection)) {
      const entries = [];
      const missing = [];
      const seen = new Set();
      for (const rawId of selection) {
        const id = String(rawId);
        const entry = this.entryById.get(id);
        if (!entry) missing.push(id);
        else if (!seen.has(id)) {
          entries.push(entry);
          seen.add(id);
        }
      }
      return { entries, missing };
    }

    const value = String(selection);
    const exact = this.entryById.get(value);
    if (exact) return { entries: [exact], missing: [] };
    const entries = this.entries.filter((entry) => {
      const groups = Array.isArray(entry.preloadGroup) ? entry.preloadGroup : [entry.preloadGroup];
      return groups.some((group) => String(group ?? '') === value);
    });
    return { entries, missing: entries.length ? [] : [value] };
  }

  async #load(entry) {
    if (this.resourcesById.has(entry.id)) return { id: entry.id, status: 'cached' };
    const requestKey = `${entry.type}:${entry.path}`;
    if (this.resourcesByRequest.has(requestKey)) {
      this.resourcesById.set(entry.id, this.resourcesByRequest.get(requestKey));
      return { id: entry.id, status: 'cached' };
    }
    if (this.failedUrls.has(entry.path)) return { id: entry.id, status: 'failed' };

    let pending = this.pendingByRequest.get(requestKey);
    const alreadyPending = Boolean(pending);
    if (!pending) {
      const loader = entry.type === 'image' ? this.imageLoader : this.audioLoader;
      pending = Promise.resolve()
        .then(() => loader(entry.path, entry))
        .then((resource) => {
          if (resource === null || resource === undefined) {
            throw new Error(`Loader returned no resource for ${entry.path}`);
          }
          this.resourcesByRequest.set(requestKey, resource);
          return resource;
        })
        .catch((error) => {
          this.failedUrls.add(entry.path);
          this.errorsByUrl.set(entry.path, error);
          if (typeof this.logger?.warn === 'function') {
            this.logger.warn(`Asset failed to load: ${entry.path}`, error);
          }
          return null;
        })
        .finally(() => this.pendingByRequest.delete(requestKey));
      this.pendingByRequest.set(requestKey, pending);
    }

    const resource = await pending;
    if (resource === null) return { id: entry.id, status: 'failed' };
    this.resourcesById.set(entry.id, resource);
    return { id: entry.id, status: alreadyPending ? 'cached' : 'loaded' };
  }
}

export default AssetManager;
