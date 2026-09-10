/**
 * Celestial Azure SFX Engine — Pure Web Audio procedural sound effects
 * Zero external audio files required. Synthesizes crisp crystal clicks,
 * card whooshes, combat slashes, magic blasts, and victory fanfares.
 */
const SFX = {
    ctx: null,
    muted: false,

    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playTone(freq, type, duration, gainStart, gainEnd = 0.001) {
        try {
            this.init();
            if (!this.ctx || this.muted) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(gainStart, now);
            gain.gain.exponentialRampToValueAtTime(gainEnd, now + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            // AudioContext not allowed before user gesture, silent ignore
        }
    },

    // Soft celestial crystal click for UI buttons
    click() {
        this.playTone(880, 'sine', 0.08, 0.15, 0.001);
        setTimeout(() => this.playTone(1320, 'triangle', 0.06, 0.08, 0.001), 30);
    },

    // Card hover or draw whoosh
    whoosh() {
        try {
            this.init();
            if (!this.ctx || this.muted) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(720, now + 0.12);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {}
    },

    // Physical sword slash / attack impact
    slash() {
        try {
            this.init();
            if (!this.ctx || this.muted) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.18);
        } catch (e) {}
    },

    // Magic cast / starlight explosion
    magic() {
        try {
            this.init();
            if (!this.ctx || this.muted) return;
            const now = this.ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
            freqs.forEach((f, i) => {
                setTimeout(() => {
                    this.playTone(f, 'sine', 0.25, 0.12, 0.001);
                }, i * 40);
            });
        } catch (e) {}
    },

    // Heavy critical hit impact
    crit() {
        this.slash();
        setTimeout(() => this.playTone(150, 'triangle', 0.25, 0.35, 0.01), 30);
    },

    // Victory fanfare
    fanfare() {
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((n, i) => {
            setTimeout(() => this.playTone(n, 'triangle', 0.3, 0.18, 0.01), i * 110);
        });
    },

    victory() {
        this.fanfare();
    },

    // Defeat solemn chime
    defeat() {
        const notes = [392, 349.23, 311.13, 261.63];
        notes.forEach((n, i) => {
            setTimeout(() => this.playTone(n, 'sine', 0.4, 0.15, 0.01), i * 150);
        });
    },

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
};

window.SFX = SFX;
