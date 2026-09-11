function assertEventType(type) {
  if (typeof type !== 'string' && typeof type !== 'symbol') {
    throw new TypeError('Event type must be a string or symbol');
  }
}

function assertListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('Event listener must be a function');
  }
}

export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(type, listener) {
    assertEventType(type);
    assertListener(listener);
    let listeners = this._listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this._listeners.set(type, listeners);
    }
    listeners.add(listener);
    return () => this.off(type, listener);
  }

  once(type, listener) {
    assertListener(listener);
    let unsubscribe = null;
    const wrapped = (...args) => {
      unsubscribe?.();
      return listener(...args);
    };
    unsubscribe = this.on(type, wrapped);
    return unsubscribe;
  }

  off(type, listener) {
    assertEventType(type);
    assertListener(listener);
    const listeners = this._listeners.get(type);
    if (!listeners) return false;
    const removed = listeners.delete(listener);
    if (listeners.size === 0) this._listeners.delete(type);
    return removed;
  }

  emit(type, ...args) {
    assertEventType(type);
    const listeners = this._listeners.get(type);
    if (!listeners || listeners.size === 0) return 0;

    const snapshot = [...listeners];
    for (const listener of snapshot) listener(...args);
    return snapshot.length;
  }

  clear(type) {
    if (type === undefined) {
      this._listeners.clear();
      return;
    }
    assertEventType(type);
    this._listeners.delete(type);
  }

  listenerCount(type) {
    assertEventType(type);
    return this._listeners.get(type)?.size ?? 0;
  }
}

export default EventBus;
