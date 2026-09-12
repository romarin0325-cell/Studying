// Locally synthesized soundtrack and layered effects: no downloads or audio codecs required.
export class AudioDirector {
  constructor() { this.enabled = true; this.music = true; this.context = null; this.master = null; this.timer = null; this.step = 0; this.next = 0; this.stage = 0; this.boss = false; this.lastShot = 0; this.voices = 0; }
  async start() {
    if (!this.context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext; if (!Audio) return;
      this.context = new Audio(); this.master = this.context.createGain(); this.master.gain.value = this.enabled ? .28 : 0;
      const compressor = this.context.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.ratio.value = 5;
      this.master.connect(compressor); compressor.connect(this.context.destination);
    }
    try { await this.context.resume(); } catch { return; }
    if (!this.timer) { this.next = this.context.currentTime + .08; this.timer = setInterval(() => this.schedule(), 80); }
  }
  setEnabled(value) { this.enabled = value; if (this.master) this.master.gain.setTargetAtTime(value ? .28 : 0, this.context.currentTime, .04); }
  pause() { clearInterval(this.timer); this.timer = null; this.context?.suspend().catch(() => {}); }
  note(freq, duration, gain = .12, type = 'sine', time = null, endFreq = null) {
    if (!this.context || !this.enabled || this.voices > 45 || this.context.state !== 'running') return;
    const c = this.context, at = time ?? c.currentTime, osc = c.createOscillator(), vol = c.createGain();
    this.voices++; osc.type = type; osc.frequency.setValueAtTime(freq, at); if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + duration);
    vol.gain.setValueAtTime(.0001, at); vol.gain.exponentialRampToValueAtTime(gain, at + .012); vol.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(vol); vol.connect(this.master); osc.start(at); osc.stop(at + duration + .02);
    osc.onended = () => { this.voices--; osc.disconnect(); vol.disconnect(); };
  }
  schedule() {
    if (!this.context || !this.music) return;
    const c = this.context, beat = this.boss ? .145 : .19;
    if (this.next < c.currentTime - .5) this.next = c.currentTime;
    while (this.next < c.currentTime + .22) {
      const scales = [[0, 3, 7, 10, 12, 7, 3, 10], [0, 4, 7, 11, 12, 7, 4, 11], [0, 3, 6, 10, 12, 10, 6, 3], [0, 2, 7, 10, 12, 7, 2, 10]];
      const roots = [57, 53, 56, 52], chord = [0, -5, -2, -7][Math.floor(this.step / 32) % 4], scale = scales[this.stage];
      const midi = roots[this.stage] + chord + scale[this.step % 8] + (this.step % 16 > 11 ? 12 : 0), hz = n => 440 * 2 ** ((n - 69) / 12);
      this.note(hz(midi + 12), beat * 2.8, .055, 'sine', this.next);
      if (this.step % 4 === 0) { this.note(hz(roots[this.stage] + chord - 12), beat * 3.6, .13, 'triangle', this.next); this.note(110, .10, .08, 'sine', this.next, 43); }
      if (this.step % 32 === 0) for (const n of [0, 7, 12]) this.note(hz(roots[this.stage] + chord + n), beat * 30, .025, 'triangle', this.next);
      if (this.boss && this.step % 2 === 1) this.note(1800, .03, .012, 'triangle', this.next, 500);
      this.step++; this.next += beat;
    }
  }
  event(event) {
    const t = this.context?.currentTime || 0;
    if (event.type === 'shot') { if (t - this.lastShot < .15) return; this.lastShot = t; const heavy = ['lance', 'melee','nightfall','darkglass'].includes(event.weapon); this.note(heavy ? 180 : 850, heavy ? .14 : .065, heavy ? .07 : .026, 'triangle', null, heavy ? 65 : 350); }
    if (event.type === 'kill') { this.note(event.boss ? 110 : 220, event.boss ? .8 : .13, event.boss ? .25 : .045, 'triangle', null, 45); }
    if (event.type === 'pickup') this.note(event.item === 'power' ? 1250 : 1568, .10, .026);
    if (event.type === 'graze') this.note(2100, .045, .015);
    if (event.type === 'hurt') { this.note(160, .35, .17, 'sawtooth', null, 45); this.note(55, .5, .13); }
    if (['powerup', 'heal', 'victory', 'bossDefeated'].includes(event.type)) [523, 659, 784, 1046].forEach((f, i) => this.note(f, .5, .09, 'sine', t + i * .10));
    if (event.type === 'bomb') { this.note(80, 1.5, .24, 'triangle', null, 30); [440, 554, 659, 880, 1108].forEach((f, i) => this.note(f, 1.3, .10, 'sine', t + i * .07)); }
    if (event.type === 'warning') [0, .35, .7].forEach(d => this.note(220, .25, .08, 'triangle', t + d, 160));
  }
}
