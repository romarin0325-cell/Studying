/* Synthesized effects share the stage clock's fast-forward setting. */
export function createAudio(clock) {
  let ac = null, soundOn = true;
  function unlockAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (!soundOn || !ac || clock.fast) return;
    const t0 = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol || 0.05, t0); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, delay) {
    if (!soundOn || !ac || clock.fast) return;
    const n = Math.max(1, ac.sampleRate * dur | 0), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), g = ac.createGain();
    g.gain.value = vol || 0.08; s.buffer = buf; s.connect(g); g.connect(ac.destination); s.start(ac.currentTime + (delay || 0));
  }
  const sfx = {
    tap: () => tone(660, 0.05, 'square', 0.03),
    tick: n => tone(440 * Math.pow(2, n / 7), 0.07, 'square', 0.04),
    swing: () => { noise(0.06, 0.04); tone(300, 0.08, 'triangle', 0.04, 160); },
    hit: big => { noise(big ? 0.28 : 0.11, big ? 0.15 : 0.09); tone(big ? 86 : 150, big ? 0.28 : 0.1, 'triangle', 0.12, 46); },
    crit: () => { tone(880, 0.07, 'square', 0.05); tone(1320, 0.12, 'square', 0.045, 0, 0.06); },
    cast: () => { tone(520, 0.2, 'sine', 0.05, 980); tone(260, 0.2, 'triangle', 0.03, 520); },
    charge: () => { tone(220, 0.35, 'sawtooth', 0.04, 880); tone(110, 0.35, 'triangle', 0.05, 440); },
    buff: () => [0, 1, 2].forEach(i => tone(523 * Math.pow(1.26, i), 0.09, 'square', 0.035, 0, i * 0.06)),
    debuff: () => [0, 1].forEach(i => tone(330 - i * 70, 0.12, 'sawtooth', 0.03, 0, i * 0.08)),
    guard: () => { noise(0.05, 0.05); tone(980, 0.09, 'square', 0.04, 760); },
    miss: () => tone(700, 0.12, 'sine', 0.04, 1100),
    warn: () => { tone(104, 0.4, 'sawtooth', 0.06, 78); tone(104, 0.4, 'sawtooth', 0.05, 78, 0.45); },
    fall: () => { tone(260, 0.5, 'triangle', 0.07, 60); noise(0.3, 0.06); },
    shatter: () => [0, 1, 2, 3, 4].forEach(i => tone(1300 - i * 150, 0.09, 'square', 0.03, 0, i * 0.06)),
    relay: () => [0, 1, 2, 3].forEach(i => tone(587 * Math.pow(1.19, i), 0.1, 'square', 0.04, 0, i * 0.07)),
    heirloom: () => [0, 1, 2, 3, 4].forEach(i => tone(659 * Math.pow(1.12, i), 0.12, 'triangle', 0.05, 0, i * 0.06)),
    enter: () => { noise(0.07, 0.05); tone(196, 0.1, 'triangle', 0.06, 130); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'square', 0.045, 0, i * 0.1)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 'triangle', 0.06, 0, i * 0.22)),
    gem: () => tone(1568, 0.1, 'square', 0.035, 2093),
    awaken: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.04, 0, i * 0.07)),
    jackpot: () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.06)),
    roll: () => tone(880 + Math.random() * 440, 0.04, 'square', 0.025),
    boom: () => { noise(0.45, 0.18); tone(70, 0.45, 'triangle', 0.15, 30); },
    beam: () => { tone(1200, 0.4, 'sawtooth', 0.045, 260); tone(300, 0.4, 'square', 0.03, 120); noise(0.3, 0.05); }
  };

  return {
    sfx, unlockAudio,
    get soundOn() { return soundOn; },
    set soundOn(value) { soundOn = value; }
  };
}
