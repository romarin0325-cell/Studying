export function nextFloat(rng) {
  rng.state = (rng.state + 0x6D2B79F5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// The battle bridge uses a callable source local to a single battle.
export function mulberry32(seed) {
  const rng = { state: seed >>> 0 };
  return () => nextFloat(rng);
}

export function pick(rng, list) {
  return list.length ? list[Math.floor(nextFloat(rng) * list.length)] : undefined;
}

export function shuffle(rng, list) {
  const shuffled = list.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
