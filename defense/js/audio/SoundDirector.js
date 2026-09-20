// Original 16-bar score: a restrained harp ostinato, soft sustained chords and
// percussion. Browser audio starts only after a gesture and needs no network.
const CHORDS = [[50,57,62,65],[46,53,58,62],[53,60,65,69],[48,55,60,64]];
const MELODY = [74,0,77,76,74,69,72,0,70,0,74,77,76,74,69,0];
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
export class SoundDirector {
  constructor() { this.enabled = true; this.musicEnabled = true; this.mode = 'menu'; this.step = 0; this.lastHit = 0; }
  unlock() {
    if (!this.enabled) return null;
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Audio) return null;
    try {
      if (!this.context) {
        this.context = new Audio();
        this.master = this.context.createGain(); this.master.gain.value = .32;
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor); compressor.connect(this.context.destination);
        this.music = this.context.createGain(); this.music.gain.value = .45; this.music.connect(this.master);
        this.noise = this.context.createBuffer(1, this.context.sampleRate * .3, this.context.sampleRate);
        const samples = this.noise.getChannelData(0); let seed = 12345;
        for (let i = 0; i < samples.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; samples[i] = (seed / 4294967296 * 2 - 1); }
        this.nextAt = this.context.currentTime + .08;
        this.timer = setInterval(() => this.schedule(), 100);
      }
      this.context.resume().catch(() => {});
      return this.context;
    } catch { return null; }
  }
  setSettings(settings) {
    this.enabled = settings.sound; this.musicEnabled = settings.music !== false;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? .32 : 0, this.context.currentTime, .04);
    if (this.music) this.music.gain.setTargetAtTime(this.musicEnabled ? .45 : 0, this.context.currentTime, .1);
  }
  setMode(mode) { this.mode = mode; }
  tone(note, at, duration, gain, type = 'sine', bus = this.master) {
    const ctx = this.context, oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = hz(note);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(bus); oscillator.start(at); oscillator.stop(at + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  percussion(at, strength = .04, low = false) {
    const ctx = this.context, source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    source.buffer = this.noise; filter.type = low ? 'lowpass' : 'highpass'; filter.frequency.value = low ? 500 : 5000;
    gain.gain.setValueAtTime(strength, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .09);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(at); source.stop(at+.11);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  schedule() {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || !this.enabled || !this.musicEnabled || this.mode === 'paused') return;
    if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + .05;
    let queued = 0;
    while (this.nextAt < ctx.currentTime + .25 && queued++ < 4) {
      const battle = this.mode === 'battle', step = this.step % 64, chord = CHORDS[Math.floor(step / 16)];
      const note = chord[[0,1,2,1,3,2,1,2][step % 8]] + 12;
      this.tone(note, this.nextAt, .65, battle ? .09 : .07, 'triangle', this.music);
      if (step % 8 === 0) for (const n of chord.slice(0,3)) this.tone(n, this.nextAt, 2.3, .024, 'sine', this.music);
      if (step % 2 === 0 && MELODY[Math.floor(step / 2) % 16]) this.tone(MELODY[Math.floor(step / 2) % 16], this.nextAt, 1.1, .05, 'sine', this.music);
      if (battle && step % 4 === 0) { this.tone(38, this.nextAt, .18, .09, 'sine', this.music); this.percussion(this.nextAt,.012); }
      this.step++; this.nextAt += battle ? .235 : .31;
    }
  }
  event(event) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (event.type === 'hit') {
      if (event.visualOnly || !event.amount || !/^(basic_|skill_)/.test(event.effectPreset ?? '') || now - this.lastHit < .07) return;
      this.lastHit = now;
      const note = ({fire:48,water:81,nature:64,light:86,dark:52})[event.element] ?? 74;
      this.tone(note,now,event.critical?.2:.12,event.critical?.16:.085,event.element==='fire'?'triangle':'sine');
      if (event.actionKind === 'skill' || event.attackArchetype === 'melee') this.percussion(now,.065,true);
      return;
    }
    if (event.type === 'core_damaged') { this.tone(35,now,.32,.2,'triangle'); this.percussion(now,.14,true); }
    if (event.type === 'starfall') [74,81,86,93].forEach((note,i)=>this.tone(note,now+i*.045,.45,.1));
    if (event.type === 'wave_completed') [74,77,81].forEach((note,i)=>this.tone(note,now+i*.09,.55,.13,'triangle'));
    if (event.type === 'victory') [62,69,74,77,81,86].forEach((note,i)=>this.tone(note,now+i*.12,1,.13,'triangle'));
    if (event.type === 'select') this.tone(81,now,.075,.06);
  }
  suspend() { this.context?.suspend?.().catch(() => {}); }
  destroy() { clearInterval(this.timer); this.context?.close?.().catch(() => {}); }
}
