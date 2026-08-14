/**
 * Persistent music player for the Card RPG single-page UI.
 * The audio element stays mounted when the modal closes so mobile browsers can
 * keep the active media session alive while the page remains open.
 */
(function () {
    'use strict';

    const TRACKS = Object.freeze([
        Object.freeze({
            id: 'okaeri_aniichan',
            title: 'おかえり、兄ちゃん',
            artist: 'Card RPG',
            album: 'Card RPG Music',
            src: 'おかえり、兄ちゃん.mp3'
        })
    ]);

    const REPEAT_LABELS = {
        off: '반복 OFF',
        all: '전체 반복',
        one: '한 곡 반복'
    };

    const MusicPlayer = {
        tracks: TRACKS,
        audio: null,
        currentIndex: 0,
        repeatMode: 'all',
        shuffle: false,
        _initialized: false,
        _pendingSeek: 0,
        _resumeAfterStudy: false,
        _lastSavedAt: 0,
        _statusOverride: '',

        init() {
            if (this._initialized) return;
            this.audio = document.getElementById('music-audio');
            if (!this.audio) return;
            this._initialized = true;

            const prefs = this.loadPrefs();
            const savedIndex = this.tracks.findIndex(track => track.id === prefs.trackId);
            this.currentIndex = savedIndex >= 0 ? savedIndex : 0;
            this.repeatMode = ['off', 'all', 'one'].includes(prefs.repeatMode) ? prefs.repeatMode : 'all';
            this.shuffle = prefs.shuffle === true;
            this.applyPlaybackRate(prefs.playbackRate);
            if ('preservesPitch' in this.audio) this.audio.preservesPitch = true;

            this.bindAudioEvents();
            this.bindMediaSession();
            this.loadTrack(this.currentIndex, {
                autoplay: false,
                startTime: Number.isFinite(Number(prefs.currentTime)) ? Number(prefs.currentTime) : 0
            });
        },

        bindAudioEvents() {
            this.audio.addEventListener('loadedmetadata', () => {
                if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
                    this.audio.currentTime = Math.min(Math.max(0, this._pendingSeek), this.audio.duration);
                }
                this._pendingSeek = 0;
                this._statusOverride = '';
                this.render();
                this.updatePositionState();
            });
            this.audio.addEventListener('timeupdate', () => {
                this.renderProgress();
                this.updatePositionState();
                this.savePrefs(false);
            });
            this.audio.addEventListener('play', () => {
                this._statusOverride = '';
                this._resumeAfterStudy = false;
                this.pauseStudyAudio();
                this.render();
                this.updatePlaybackState('playing');
            });
            this.audio.addEventListener('pause', () => {
                this.render();
                this.updatePlaybackState('paused');
                this.savePrefs(true);
            });
            this.audio.addEventListener('ratechange', () => {
                this.render();
                this.updatePositionState();
                this.savePrefs(true);
            });
            this.audio.addEventListener('ended', () => this.handleEnded());
            this.audio.addEventListener('error', () => {
                const track = this.getCurrentTrack();
                this.setStatus(`음원 파일을 확인해주세요: ${track ? track.src : ''}`, true);
            });
        },

        bindMediaSession() {
            if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
            const handlers = {
                play: () => this.play(),
                pause: () => this.pause(),
                previoustrack: () => this.previous(),
                nexttrack: () => this.next(),
                seekbackward: details => this.seekBy(-(details.seekOffset || 10)),
                seekforward: details => this.seekBy(details.seekOffset || 10),
                seekto: details => this.seekTo(details.seekTime)
            };
            Object.keys(handlers).forEach(action => {
                try {
                    navigator.mediaSession.setActionHandler(action, handlers[action]);
                } catch (error) {
                    // Older browsers expose Media Session with only a subset of actions.
                }
            });
        },

        getCurrentTrack() {
            return this.tracks[this.currentIndex] || null;
        },

        loadTrack(index, options = {}) {
            if (!this.audio || this.tracks.length === 0) return Promise.resolve(false);
            const normalized = ((index % this.tracks.length) + this.tracks.length) % this.tracks.length;
            this.currentIndex = normalized;
            const startTime = Math.max(0, Number(options.startTime) || 0);
            this._pendingSeek = startTime;
            const track = this.getCurrentTrack();
            this._statusOverride = '';
            this.audio.src = track.src;
            this.audio.load();
            this.updateMetadata();
            this.render();
            this.savePrefs(true, startTime);
            return options.autoplay ? this.play() : Promise.resolve(true);
        },

        open() {
            const modal = document.getElementById('modal-music-player');
            if (modal) modal.classList.add('active');
            this.render();
        },

        close() {
            const modal = document.getElementById('modal-music-player');
            if (modal) modal.classList.remove('active');
            this.savePrefs(true);
        },

        toggle() {
            return this.audio && this.audio.paused ? this.play() : this.pause();
        },

        play() {
            if (!this.audio) return Promise.resolve(false);
            this.pauseStudyAudio();
            const playResult = this.audio.play();
            if (!playResult || typeof playResult.then !== 'function') return Promise.resolve(true);
            return playResult
                .then(() => true)
                .catch(error => {
                    this.setStatus(error && error.name === 'NotAllowedError'
                        ? '재생 버튼을 다시 눌러주세요.'
                        : '음원을 재생할 수 없습니다.', true);
                    return false;
                });
        },

        pause() {
            if (!this.audio) return false;
            this.audio.pause();
            return true;
        },

        previous() {
            if (!this.audio) return Promise.resolve(false);
            if (this.audio.currentTime > 3) {
                this.seekTo(0);
                return Promise.resolve(true);
            }
            return this.loadTrack(this.pickAdjacentIndex(-1), { autoplay: !this.audio.paused });
        },

        next() {
            if (!this.audio) return Promise.resolve(false);
            return this.loadTrack(this.pickAdjacentIndex(1), { autoplay: !this.audio.paused });
        },

        pickAdjacentIndex(direction) {
            if (this.shuffle && this.tracks.length > 1) {
                let nextIndex = this.currentIndex;
                while (nextIndex === this.currentIndex) {
                    nextIndex = Math.floor(Math.random() * this.tracks.length);
                }
                return nextIndex;
            }
            return this.currentIndex + direction;
        },

        handleEnded() {
            if (this.repeatMode === 'one') {
                this.seekTo(0);
                this.play();
                return;
            }
            const atLastTrack = this.currentIndex === this.tracks.length - 1;
            if (this.repeatMode === 'off' && atLastTrack) {
                this.seekTo(0);
                this.render();
                return;
            }
            this.loadTrack(this.pickAdjacentIndex(1), { autoplay: true });
        },

        seekBy(seconds) {
            if (!this.audio) return;
            this.seekTo((Number(this.audio.currentTime) || 0) + Number(seconds || 0));
        },

        seekTo(seconds) {
            if (!this.audio) return;
            const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : Infinity;
            this.audio.currentTime = Math.min(Math.max(0, Number(seconds) || 0), duration);
            this.renderProgress();
            this.updatePositionState();
            this.savePrefs(true);
        },

        previewSeek(percent) {
            const duration = Number(this.audio && this.audio.duration);
            if (!Number.isFinite(duration) || duration <= 0) return;
            const current = duration * Math.min(100, Math.max(0, Number(percent) || 0)) / 100;
            const currentLabel = document.getElementById('music-current-time');
            if (currentLabel) currentLabel.textContent = this.formatTime(current);
        },

        commitSeek(percent) {
            const duration = Number(this.audio && this.audio.duration);
            if (!Number.isFinite(duration) || duration <= 0) return;
            this.seekTo(duration * Math.min(100, Math.max(0, Number(percent) || 0)) / 100);
        },

        setPlaybackRate(value) {
            if (!this.audio) return;
            this.applyPlaybackRate(value);
            this.render();
        },

        applyPlaybackRate(value) {
            const rate = Number(value);
            const normalizedRate = [0.75, 1, 1.25, 1.5, 2].includes(rate) ? rate : 1;
            this.audio.defaultPlaybackRate = normalizedRate;
            this.audio.playbackRate = normalizedRate;
            return normalizedRate;
        },

        toggleRepeat() {
            this.repeatMode = this.repeatMode === 'off' ? 'all' : this.repeatMode === 'all' ? 'one' : 'off';
            this.render();
            this.savePrefs(true);
        },

        toggleShuffle() {
            this.shuffle = !this.shuffle;
            this.render();
            this.savePrefs(true);
        },

        pauseStudyAudio() {
            if (typeof window === 'undefined' || !window.FortuneCookie) return;
            const studyAudio = window.FortuneCookie.audio;
            if (studyAudio && studyAudio !== this.audio && !studyAudio.paused) studyAudio.pause();
        },

        pauseForStudy() {
            if (!this.audio || this.audio.paused) return;
            this._resumeAfterStudy = true;
            this.audio.pause();
        },

        resumeAfterStudy() {
            if (!this._resumeAfterStudy) return Promise.resolve(false);
            this._resumeAfterStudy = false;
            return this.play();
        },

        loadPrefs() {
            if (typeof Storage === 'undefined' || !Storage.keys || !Storage.keys.MUSIC_PREFS) return {};
            const saved = Storage.load(Storage.keys.MUSIC_PREFS);
            return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
        },

        savePrefs(force, currentTimeOverride) {
            if (!this.audio || typeof Storage === 'undefined' || !Storage.keys || !Storage.keys.MUSIC_PREFS) return;
            const now = Date.now();
            if (!force && now - this._lastSavedAt < 5000) return;
            this._lastSavedAt = now;
            const track = this.getCurrentTrack();
            const overriddenTime = Number(currentTimeOverride);
            Storage.save(Storage.keys.MUSIC_PREFS, {
                trackId: track ? track.id : null,
                currentTime: Number.isFinite(overriddenTime)
                    ? Math.max(0, overriddenTime)
                    : Math.max(0, Number(this.audio.currentTime) || 0),
                playbackRate: Number(this.audio.playbackRate) || 1,
                repeatMode: this.repeatMode,
                shuffle: this.shuffle
            });
        },

        updateMetadata() {
            if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
            if (typeof MediaMetadata === 'undefined') return;
            const track = this.getCurrentTrack();
            if (!track) return;
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                album: track.album
            });
        },

        updatePlaybackState(state) {
            if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
            try {
                navigator.mediaSession.playbackState = state;
            } catch (error) {
                // Playback state is a progressive enhancement.
            }
        },

        updatePositionState() {
            if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
            if (typeof navigator.mediaSession.setPositionState !== 'function') return;
            const duration = Number(this.audio && this.audio.duration);
            if (!Number.isFinite(duration) || duration <= 0) return;
            try {
                navigator.mediaSession.setPositionState({
                    duration,
                    playbackRate: Number(this.audio.playbackRate) || 1,
                    position: Math.min(Math.max(0, Number(this.audio.currentTime) || 0), duration)
                });
            } catch (error) {
                // Ignore incomplete implementations.
            }
        },

        setStatus(message, isError) {
            this._statusOverride = message || '';
            const status = document.getElementById('music-status');
            if (!status) return;
            status.textContent = this._statusOverride;
            status.classList.toggle('is-error', isError === true);
        },

        render() {
            if (!this.audio) return;
            const track = this.getCurrentTrack();
            const title = document.getElementById('music-track-title');
            const meta = document.getElementById('music-track-meta');
            const playButton = document.getElementById('music-play-toggle');
            const rate = document.getElementById('music-playback-rate');
            const repeat = document.getElementById('music-repeat-toggle');
            const shuffle = document.getElementById('music-shuffle-toggle');
            const status = document.getElementById('music-status');

            if (title) title.textContent = track ? track.title : '재생할 곡 없음';
            if (meta) meta.textContent = track ? `${track.artist} · ${this.currentIndex + 1}/${this.tracks.length}` : '';
            if (playButton) {
                playButton.textContent = this.audio.paused ? '▶' : '⏸';
                playButton.setAttribute('aria-label', this.audio.paused ? '재생' : '일시정지');
            }
            if (rate) rate.value = String(Number(this.audio.playbackRate) || 1);
            if (repeat) repeat.textContent = REPEAT_LABELS[this.repeatMode];
            if (shuffle) {
                shuffle.textContent = this.shuffle ? '셔플 ON' : '셔플 OFF';
                shuffle.setAttribute('aria-pressed', this.shuffle ? 'true' : 'false');
            }
            if (status && !this._statusOverride) {
                status.textContent = this.audio.paused ? '일시정지' : '재생 중';
                status.classList.remove('is-error');
            }
            this.renderProgress();
        },

        renderProgress() {
            if (!this.audio) return;
            const current = Math.max(0, Number(this.audio.currentTime) || 0);
            const duration = Number(this.audio.duration);
            const progress = document.getElementById('music-progress');
            const currentLabel = document.getElementById('music-current-time');
            const durationLabel = document.getElementById('music-duration');
            if (progress) {
                progress.value = Number.isFinite(duration) && duration > 0 ? String(current / duration * 100) : '0';
                progress.setAttribute('aria-valuetext', `${this.formatTime(current)} / ${this.formatTime(duration)}`);
            }
            if (currentLabel) currentLabel.textContent = this.formatTime(current);
            if (durationLabel) durationLabel.textContent = this.formatTime(duration);
        },

        formatTime(seconds) {
            if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0) return '0:00';
            const total = Math.floor(Number(seconds));
            return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
        }
    };

    window.MusicPlayer = MusicPlayer;
    MusicPlayer.init();
}());
