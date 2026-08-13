const UINT32_RANGE = 0x1_0000_0000;
const SNAPSHOT_VERSION = 1;
const ALGORITHM = 'sfc32-v1';

function hashSeed(seed) {
  let a = 1779033703;
  let b = 3144134277;
  let c = 1013904242;
  let d = 2773480762;

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index);
    a = b ^ Math.imul(a ^ code, 597399067);
    b = c ^ Math.imul(b ^ code, 2869860233);
    c = d ^ Math.imul(c ^ code, 951274213);
    d = a ^ Math.imul(d ^ code, 2716044179);
  }

  a = Math.imul(c ^ (a >>> 18), 597399067);
  b = Math.imul(d ^ (b >>> 22), 2869860233);
  c = Math.imul(a ^ (c >>> 17), 951274213);
  d = Math.imul(b ^ (d >>> 19), 2716044179);

  const state = [
    (a ^ b ^ c ^ d) >>> 0,
    (b ^ a) >>> 0,
    (c ^ a) >>> 0,
    (d ^ a) >>> 0,
  ];

  if (state.every((value) => value === 0)) state[0] = 1;
  return state;
}

function assertString(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string`);
  }
}

function assertSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('SeededRng snapshot must be an object');
  }
  if (snapshot.version !== SNAPSHOT_VERSION || snapshot.algorithm !== ALGORITHM) {
    throw new RangeError('Unsupported SeededRng snapshot');
  }
  assertString(snapshot.seed, 'snapshot.seed');
  if (
    !Array.isArray(snapshot.state)
    || snapshot.state.length !== 4
    || snapshot.state.some((value) => !Number.isInteger(value) || value < 0 || value >= UINT32_RANGE)
  ) {
    throw new TypeError('SeededRng snapshot state must contain four uint32 values');
  }
}

/**
 * Deterministic string-seeded pseudo-random number generator.
 *
 * `fork(label)` derives an independent stream from the original seed. It does
 * not consume the parent stream, so adding draws to one subsystem cannot move
 * another labelled subsystem's sequence.
 */
export class SeededRng {
  constructor(seed) {
    assertString(seed, 'seed');
    this._seed = seed;
    this._state = hashSeed(seed);
  }

  get seed() {
    return this._seed;
  }

  _nextUint32() {
    let [a, b, c, d] = this._state;
    const result = (a + b + d) >>> 0;

    d = (d + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + result) >>> 0;

    this._state[0] = a;
    this._state[1] = b;
    this._state[2] = c;
    this._state[3] = d;
    return result;
  }

  /** Returns a floating-point value in the half-open interval [0, 1). */
  next() {
    return this._nextUint32() / UINT32_RANGE;
  }

  /**
   * Returns an integer in [0, maxExclusive), or [minInclusive, maxExclusive).
   */
  int(minInclusive, maxExclusive) {
    let min = minInclusive;
    let max = maxExclusive;
    if (max === undefined) {
      max = min;
      min = 0;
    }

    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
      throw new TypeError('SeededRng.int bounds must be safe integers');
    }
    if (max <= min) {
      throw new RangeError('SeededRng.int maxExclusive must be greater than minInclusive');
    }

    return min + Math.floor(this.next() * (max - min));
  }

  pick(items) {
    if (!Array.isArray(items)) throw new TypeError('SeededRng.pick expects an array');
    if (items.length === 0) throw new RangeError('SeededRng.pick cannot choose from an empty array');
    return items[this.int(items.length)];
  }

  /** Returns a shuffled copy; the input array is never mutated. */
  shuffle(items) {
    if (!Array.isArray(items)) throw new TypeError('SeededRng.shuffle expects an array');
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(index + 1);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  fork(label) {
    assertString(label, 'fork label');
    const derivedSeed = `${this._seed.length}:${this._seed}|${label.length}:${label}`;
    return new SeededRng(derivedSeed);
  }

  snapshot() {
    return Object.freeze({
      version: SNAPSHOT_VERSION,
      algorithm: ALGORITHM,
      seed: this._seed,
      state: Object.freeze(this._state.slice()),
    });
  }

  restore(snapshot) {
    assertSnapshot(snapshot);
    this._seed = snapshot.seed;
    this._state = snapshot.state.slice();
    return this;
  }

  static restore(snapshot) {
    assertSnapshot(snapshot);
    return new SeededRng(snapshot.seed).restore(snapshot);
  }
}

export default SeededRng;
