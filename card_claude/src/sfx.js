/* Small synthesized UI sounds. No audio files; nothing plays before the first user gesture.
   Disabled while the music library or a listening exercise is open so study audio stays clear. */
'use strict';

const DreamSfx = {
  ctx: null,
  master: null,
  enabled: true,
  init() {
    try { this.enabled = localStorage.getItem('dwSfx') !== 'off'; } catch { /* Default on. */ }
  },
  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem('dwSfx', on ? 'on' : 'off'); } catch { /* Session only. */ }
  },
  audio() {
    if (!this.enabled) return null;
    // Listening and TOEIC dialogs own the speaker.
    if (document.querySelector('#modal-fortune-cookie.active,#modal-toeic-practice.active,#modal-music-player.active')) return null;
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  tone(freq, start, duration, { type = 'sine', gain = 0.5, slide = 0 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  },
  noise(start, duration, { gain = 0.4, filter = 1800 } = {}) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const band = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    band.type = 'bandpass';
    band.frequency.value = filter;
    amp.gain.value = gain;
    src.buffer = buffer;
    src.connect(band).connect(amp).connect(this.master);
    src.start(start);
  },
  play(name) {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const notes = {
      tap: () => this.tone(880, t, 0.06, { type: 'triangle', gain: 0.18 }),
      open: () => { this.tone(660, t, 0.08, { type: 'triangle', gain: 0.16 }); this.tone(990, t + 0.05, 0.1, { type: 'triangle', gain: 0.14 }); },
      summon: () => { this.noise(t, 0.7, { gain: 0.25, filter: 900 }); [392, 523, 659, 784].forEach((f, i) => this.tone(f, t + 0.12 * i, 0.5, { gain: 0.16 })); },
      flip: () => this.noise(t, 0.12, { gain: 0.35, filter: 3200 }),
      rare: () => [784, 988].forEach((f, i) => this.tone(f, t + 0.06 * i, 0.35, { type: 'triangle', gain: 0.22 })),
      epic: () => [659, 831, 988, 1319].forEach((f, i) => this.tone(f, t + 0.07 * i, 0.5, { type: 'triangle', gain: 0.22 })),
      legend: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, t + 0.08 * i, 0.8, { type: 'triangle', gain: 0.24 })); this.noise(t, 1.1, { gain: 0.15, filter: 6000 }); },
      hit: () => { this.noise(t, 0.16, { gain: 0.5, filter: 1200 }); this.tone(160, t, 0.12, { type: 'square', gain: 0.12, slide: -80 }); },
      crit: () => { this.noise(t, 0.25, { gain: 0.6, filter: 2400 }); this.tone(1200, t, 0.18, { type: 'sawtooth', gain: 0.1, slide: -600 }); },
      magic: () => { this.tone(520, t, 0.3, { gain: 0.2, slide: 700 }); this.noise(t + 0.05, 0.25, { gain: 0.2, filter: 4200 }); },
      cutin: () => { this.noise(t, 0.35, { gain: 0.3, filter: 5200 }); this.tone(330, t, 0.3, { type: 'sawtooth', gain: 0.08, slide: 660 }); },
      charge: () => { this.tone(110, t, 0.7, { type: 'sawtooth', gain: 0.1, slide: 220 }); this.noise(t, 0.7, { gain: 0.12, filter: 600 }); },
      heal: () => [660, 880, 1100].forEach((f, i) => this.tone(f, t + 0.07 * i, 0.3, { gain: 0.14 })),
      victory: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, t + [0, .12, .24, .36, .56, .68][i], i > 3 ? 0.5 : 0.18, { type: 'triangle', gain: 0.24 })),
      defeat: () => [392, 349, 311, 262].forEach((f, i) => this.tone(f, t + 0.2 * i, 0.4, { gain: 0.16 }))
    };
    try { notes[name]?.(); } catch { /* Audio is decorative. */ }
  }
};
DreamSfx.init();
