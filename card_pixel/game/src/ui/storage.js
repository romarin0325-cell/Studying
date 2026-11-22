export const SESSION_KEY = 'relaymare.session';
export const DAILY_KEY = 'relaymare.daily';
export const DAMAGED_DAILY_KEY = 'relaymare.dailyDamaged';
export const SETTINGS_KEY = 'relaymare.settings';
export const LAST_GOOD_KEY = 'relaymare.lastGood';
const POINTER = 'relaymare.activeSlot';
const SLOT_KEYS = [SESSION_KEY, DAILY_KEY, DAMAGED_DAILY_KEY, SETTINGS_KEY, LAST_GOOD_KEY];
const alternateKey = (slot, key) => slot === 'b' ? 'relaymare.slotB.' + key : key;
const rawByAdapter = new WeakMap();

// Slot A is the existing browser save. All three live stores follow the same pointer.
export function backupSlots(adapter) {
  const raw = rawByAdapter.get(adapter) ?? adapter;
  const active = () => raw.getItem(POINTER) === 'b' ? 'b' : 'a';
  function write(slot, key, value) {
    const target = alternateKey(slot, key);
    if (value === null) return raw.removeItem(target);
    const result = raw.setItem(target, value);
    if (result === false) throw new Error('Storage write failed');
    return result;
  }
  return {
    active,
    read: (slot, key) => raw.getItem(alternateKey(slot, key)),
    write,
    affectsSession: (changed, key) => changed === null || changed === POINTER || changed === key || changed === alternateKey('b', key),
    activate(slot) {
      if (raw.setItem(POINTER, slot) === false) throw new Error('Storage write failed');
    },
    clear(extraKey) {
      for (const slot of ['a', 'b']) {
        for (const key of new Set([...SLOT_KEYS, extraKey])) {
          if (key) write(slot, key, null);
        }
      }
      raw.removeItem(POINTER);
    }
  };
}

export function slotStorage(raw) {
  if (rawByAdapter.has(raw)) return raw;
  const slots = backupSlots(raw);
  const adapter = {
    getItem: key => SLOT_KEYS.includes(key) ? slots.read(slots.active(), key) : raw.getItem(key),
    setItem: (key, value) => SLOT_KEYS.includes(key) ? slots.write(slots.active(), key, value) : raw.setItem(key, value),
    removeItem: key => SLOT_KEYS.includes(key) ? slots.write(slots.active(), key, null) : raw.removeItem(key)
  };
  rawByAdapter.set(adapter, raw);
  return adapter;
}

export const storage = slotStorage({
  getItem(key) {
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
  }
});

export function withSessionWrite(write) {
  // Keep the revision check and both copies in one cross-tab critical section. Browsers without Web Locks
  // (older Safari, insecure contexts) still save: the revision check alone then refuses a stale tab.
  const locks = globalThis.navigator?.locks;
  return locks?.request ? locks.request(SESSION_KEY, write) : Promise.resolve().then(write);
}
