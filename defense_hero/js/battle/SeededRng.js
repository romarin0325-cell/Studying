import { SeededRng as CoreSeededRng } from "../core/SeededRng.js";

/**
 * Battle-local convenience surface over the app's canonical SeededRng.
 * Two-bound `int` is inclusive for compact spawn-range data; one-bound `int`
 * retains the canonical exclusive behavior used by pick/shuffle.
 */
export class SeededRng extends CoreSeededRng {
  int(minInclusive, maxInclusive) {
    if (maxInclusive === undefined) return super.int(minInclusive);
    return super.int(minInclusive, maxInclusive + 1);
  }

  weighted(entries, weightSelector = (entry) => entry?.weight ?? 1) {
    if (!Array.isArray(entries) || entries.length === 0) return undefined;
    const weights = entries.map((entry) => Math.max(0, Number(weightSelector(entry)) || 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return this.pick(entries);
    let cursor = this.next() * total;
    for (let index = 0; index < entries.length; index += 1) {
      cursor -= weights[index];
      if (cursor < 0) return entries[index];
    }
    return entries[entries.length - 1];
  }

  fork(label) {
    const forked = super.fork(String(label));
    return new SeededRng(forked.seed).restore(forked.snapshot());
  }

  serialize() {
    return this.snapshot();
  }

  static restore(snapshot) {
    return new SeededRng(snapshot.seed).restore(snapshot);
  }
}

export default SeededRng;
