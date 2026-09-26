export const FIXED_TIME_STEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.1;
export const MAX_CATCH_UP_STEPS = 5;

const defaultNow = () => globalThis.performance?.now?.() ?? Date.now();
const defaultRequestFrame = (callback) => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => callback(defaultNow()), 1000 / 60);
};
const defaultCancelFrame = (handle) => {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle);
  } else {
    globalThis.clearTimeout(handle);
  }
};

export class GameLoop {
  constructor({
    update,
    render = () => {},
    now = defaultNow,
    requestFrame = defaultRequestFrame,
    cancelFrame = defaultCancelFrame,
  } = {}) {
    if (typeof update !== 'function') throw new TypeError('GameLoop update must be a function');
    if (typeof render !== 'function') throw new TypeError('GameLoop render must be a function');
    if (typeof now !== 'function') throw new TypeError('GameLoop now must be a function');
    if (typeof requestFrame !== 'function') throw new TypeError('GameLoop requestFrame must be a function');
    if (typeof cancelFrame !== 'function') throw new TypeError('GameLoop cancelFrame must be a function');

    this._update = update;
    this._render = render;
    this._now = now;
    this._requestFrame = requestFrame;
    this._cancelFrame = cancelFrame;
    this._running = false;
    this._frameHandle = null;
    this._lastTime = 0;
    this._accumulator = 0;
    this._simulationTime = 0;
    this._droppedUpdates = 0;
    this._boundTick = (timestamp) => this.tick(timestamp);
  }

  get running() {
    return this._running;
  }

  get simulationTime() {
    return this._simulationTime;
  }

  get droppedUpdates() {
    return this._droppedUpdates;
  }

  start() {
    if (this._running) return false;
    this._running = true;
    this._lastTime = this._now();
    this._accumulator = 0;
    this._frameHandle = this._requestFrame(this._boundTick);
    return true;
  }

  stop() {
    if (!this._running) return false;
    this._running = false;
    if (this._frameHandle !== null) this._cancelFrame(this._frameHandle);
    this._frameHandle = null;
    return true;
  }

  reset() {
    this._accumulator = 0;
    this._simulationTime = 0;
    this._droppedUpdates = 0;
    this._lastTime = this._now();
  }

  tick(timestamp = this._now()) {
    if (!this._running) return null;
    this._frameHandle = null;

    const elapsed = Math.max(0, Math.min(MAX_FRAME_DELTA, (timestamp - this._lastTime) / 1000));
    this._lastTime = timestamp;
    this._accumulator += elapsed;

    let updates = 0;
    try {
      while (this._accumulator + Number.EPSILON >= FIXED_TIME_STEP && updates < MAX_CATCH_UP_STEPS) {
        this._update(FIXED_TIME_STEP, this._simulationTime);
        this._simulationTime += FIXED_TIME_STEP;
        this._accumulator -= FIXED_TIME_STEP;
        updates += 1;
        if (!this._running) break;
      }

      if (updates === MAX_CATCH_UP_STEPS && this._accumulator >= FIXED_TIME_STEP) {
        const dropped = Math.floor(this._accumulator / FIXED_TIME_STEP);
        this._droppedUpdates += dropped;
        this._accumulator -= dropped * FIXED_TIME_STEP;
      }

      const alpha = Math.max(0, Math.min(1, this._accumulator / FIXED_TIME_STEP));
      this._render(alpha, {
        elapsed,
        updates,
        simulationTime: this._simulationTime,
        droppedUpdates: this._droppedUpdates,
      });

      if (this._running) this._frameHandle = this._requestFrame(this._boundTick);
      return { elapsed, updates, alpha, droppedUpdates: this._droppedUpdates };
    } catch (error) {
      this.stop();
      throw error;
    }
  }
}

export default GameLoop;
