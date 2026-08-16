/**
 * Persistent music player for the Card RPG single-page UI.
 * The audio element stays mounted when the modal closes so mobile browsers can
 * keep the active media session alive while the page remains open.
 */
(function () {
    'use strict';

    const TRACKS = Array.isArray(window.CARD_MUSIC_TRACKS)
        ? Object.freeze(window.CARD_MUSIC_TRACKS.slice())
        : Object.freeze([]);

    const PLAYBACK_RATES = Object.freeze([0.75, 1, 1.25, 1.5, 2]);

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
        favoriteTrackIds: [],
        playlistMode: 'all',
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
            const knownTrackIds = new Set(this.tracks.map(track => track.id));
            this.favoriteTrackIds = Array.isArray(prefs.favoriteTrackIds)
                ? [...new Set(prefs.favoriteTrackIds.filter(id => typeof id === 'string' && knownTrackIds.has(id)))]
                : [];
            this.playlistMode = prefs.playlistMode === 'favorites' && this.favoriteTrackIds.length > 0
                ? 'favorites'
                : 'all';
            if (this.playlistMode === 'favorites' && !this.favoriteTrackIds.includes(prefs.trackId)) {
                this.currentIndex = this.getActiveTrackIndexes()[0];
            }
            this.applyPlaybackRate(prefs.playbackRate);
            if ('preservesPitch' in this.audio) this.audio.preservesPitch = true;

            this.bindAudioEvents();
            this.bindMediaSession();
            if (this.tracks.length > 0) {
                this.loadTrack(this.currentIndex, {
                    autoplay: false,
                    startTime: this.currentIndex === savedIndex && Number.isFinite(Number(prefs.currentTime))
                        ? Number(prefs.currentTime)
                        : 0
                });
            } else {
                this.render();
            }
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

        getActiveTrackIndexes() {
            if (this.playlistMode !== 'favorites') {
                return this.tracks.map((track, index) => index);
            }
            const favoriteIds = new Set(this.favoriteTrackIds);
            return this.tracks
                .map((track, index) => favoriteIds.has(track.id) ? index : -1)
                .filter(index => index >= 0);
        },

        loadTrack(index, options = {}) {
            if (!this.audio || this.tracks.length === 0) {
                this.render();
                return Promise.resolve(false);
            }
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
            if (!this.audio || !this.getCurrentTrack()) return Promise.resolve(false);
            return this.audio.paused ? this.play() : this.pause();
        },

        play() {
            if (!this.audio || !this.getCurrentTrack()) return Promise.resolve(false);
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
            if (!this.audio || this.getActiveTrackIndexes().length === 0) return Promise.resolve(false);
            if (this.audio.currentTime > 3) {
                this.seekTo(0);
                return Promise.resolve(true);
            }
            return this.loadTrack(this.pickAdjacentIndex(-1), { autoplay: !this.audio.paused });
        },

        next() {
            if (!this.audio || this.getActiveTrackIndexes().length === 0) return Promise.resolve(false);
            return this.loadTrack(this.pickAdjacentIndex(1), { autoplay: !this.audio.paused });
        },

        pickAdjacentIndex(direction) {
            const activeIndexes = this.getActiveTrackIndexes();
            if (activeIndexes.length === 0) return this.currentIndex;
            if (activeIndexes.length === 1) return activeIndexes[0];
            const currentPosition = activeIndexes.indexOf(this.currentIndex);
            if (this.shuffle) {
                const candidates = activeIndexes.filter(index => index !== this.currentIndex);
                return candidates[Math.floor(Math.random() * candidates.length)];
            }
            if (currentPosition < 0) {
                return direction < 0 ? activeIndexes[activeIndexes.length - 1] : activeIndexes[0];
            }
            const nextPosition = ((currentPosition + direction) % activeIndexes.length + activeIndexes.length)
                % activeIndexes.length;
            return activeIndexes[nextPosition];
        },

        selectTrack(trackId) {
            const nextIndex = this.tracks.findIndex(track => track.id === trackId);
            if (nextIndex < 0) return Promise.resolve(false);
            if (this.playlistMode === 'favorites' && !this.favoriteTrackIds.includes(trackId)) {
                this.playlistMode = 'all';
            }
            if (nextIndex === this.currentIndex) {
                this.render();
                this.savePrefs(true);
                return Promise.resolve(true);
            }
            return this.loadTrack(nextIndex, { autoplay: !this.audio.paused });
        },

        toggleFavorite(trackId) {
            if (!this.tracks.some(track => track.id === trackId)) return Promise.resolve(false);
            const isFavorite = this.favoriteTrackIds.includes(trackId);
            this.favoriteTrackIds = isFavorite
                ? this.favoriteTrackIds.filter(id => id !== trackId)
                : [...this.favoriteTrackIds, trackId];

            if (this.playlistMode === 'favorites') {
                const activeIndexes = this.getActiveTrackIndexes();
                if (activeIndexes.length === 0) {
                    this.playlistMode = 'all';
                    this.setStatus('즐겨찾기가 없어 전체 곡으로 전환했습니다.', false);
                } else if (!activeIndexes.includes(this.currentIndex)) {
                    return this.loadTrack(activeIndexes[0], { autoplay: !this.audio.paused });
                }
            }
            this.render();
            this.savePrefs(true);
            return Promise.resolve(true);
        },

        setPlaylistMode(mode) {
            if (mode !== 'favorites') {
                this.playlistMode = 'all';
                this._statusOverride = '';
                this.render();
                this.savePrefs(true);
                return Promise.resolve(true);
            }

            const favoriteIndexes = this.tracks
                .map((track, index) => this.favoriteTrackIds.includes(track.id) ? index : -1)
                .filter(index => index >= 0);
            if (favoriteIndexes.length === 0) {
                this.playlistMode = 'all';
                this.setStatus('즐겨찾기 곡이 없습니다.', false);
                this.render();
                this.savePrefs(true);
                return Promise.resolve(false);
            }

            this.playlistMode = 'favorites';
            this._statusOverride = '';
            if (!favoriteIndexes.includes(this.currentIndex)) {
                return this.loadTrack(favoriteIndexes[0], { autoplay: !this.audio.paused });
            }
            this.render();
            this.savePrefs(true);
            return Promise.resolve(true);
        },

        handleEnded() {
            const activeIndexes = this.getActiveTrackIndexes();
            if (activeIndexes.length === 0) {
                this.render();
                return;
            }
            if (this.repeatMode === 'one') {
                this.seekTo(0);
                this.play();
                return;
            }
            const atLastTrack = activeIndexes.indexOf(this.currentIndex) === activeIndexes.length - 1;
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

        cyclePlaybackRate() {
            if (!this.audio || !this.getCurrentTrack()) return;
            const currentRate = Number(this.audio.playbackRate) || 1;
            const currentRateIndex = PLAYBACK_RATES.indexOf(currentRate);
            const nextRate = PLAYBACK_RATES[(currentRateIndex + 1 + PLAYBACK_RATES.length) % PLAYBACK_RATES.length];
            this.setPlaybackRate(nextRate);
        },

        applyPlaybackRate(value) {
            const rate = Number(value);
            const normalizedRate = PLAYBACK_RATES.includes(rate) ? rate : 1;
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
                shuffle: this.shuffle,
                favoriteTrackIds: this.tracks
                    .filter(item => this.favoriteTrackIds.includes(item.id))
                    .map(item => item.id),
                playlistMode: this.playlistMode
            });
        },

        updateMetadata() {
            if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
            const track = this.getCurrentTrack();
            if (!track) {
                navigator.mediaSession.metadata = null;
                return;
            }
            if (typeof MediaMetadata === 'undefined') return;
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

        renderTrackList() {
            const list = document.getElementById('music-track-list');
            const count = document.getElementById('music-track-count');
            const allMode = document.getElementById('music-mode-all');
            const favoritesMode = document.getElementById('music-mode-favorites');
            if (count) count.textContent = `${this.tracks.length}곡`;
            if (allMode) {
                const isActive = this.playlistMode === 'all';
                allMode.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                allMode.classList.toggle('is-active', isActive);
                allMode.disabled = this.tracks.length === 0;
            }
            if (favoritesMode) {
                const isActive = this.playlistMode === 'favorites';
                favoritesMode.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                favoritesMode.classList.toggle('is-active', isActive);
                favoritesMode.disabled = this.tracks.length === 0;
            }
            if (!list || typeof document.createElement !== 'function') return;
            if (typeof list.replaceChildren === 'function') list.replaceChildren();
            else list.textContent = '';

            if (this.tracks.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'music-track-empty';
                empty.textContent = '등록된 음악이 없습니다.';
                list.appendChild(empty);
                return;
            }

            this.tracks.forEach((track, index) => {
                const row = document.createElement('div');
                const favoriteButton = document.createElement('button');
                const trackButton = document.createElement('button');
                const title = document.createElement('span');
                const artist = document.createElement('span');
                const isFavorite = this.favoriteTrackIds.includes(track.id);
                const isCurrent = index === this.currentIndex;

                row.className = `music-track-row${isCurrent ? ' is-current' : ''}`;
                row.setAttribute('role', 'listitem');
                if (isCurrent) row.setAttribute('aria-current', 'true');

                favoriteButton.type = 'button';
                favoriteButton.className = 'music-favorite-toggle';
                favoriteButton.textContent = isFavorite ? '★' : '☆';
                favoriteButton.setAttribute('aria-label', `${track.title} 즐겨찾기 ${isFavorite ? '해제' : '등록'}`);
                favoriteButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
                favoriteButton.addEventListener('click', () => this.toggleFavorite(track.id));

                trackButton.type = 'button';
                trackButton.className = 'music-track-select';
                trackButton.setAttribute('aria-label', `${track.title} 선택`);
                trackButton.addEventListener('click', () => this.selectTrack(track.id));
                title.className = 'music-track-row-title';
                title.textContent = track.title;
                artist.className = 'music-track-row-artist';
                artist.textContent = track.artist;
                trackButton.appendChild(title);
                trackButton.appendChild(artist);

                row.appendChild(favoriteButton);
                row.appendChild(trackButton);
                list.appendChild(row);
            });
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
            if (rate) {
                const playbackRate = Number(this.audio.playbackRate) || 1;
                rate.value = String(playbackRate);
                if (rate.tagName !== 'SELECT') {
                    rate.textContent = `${Number.isInteger(playbackRate) ? playbackRate.toFixed(1) : playbackRate}×`;
                }
                rate.setAttribute('aria-label', `재생 배속 ${playbackRate}배. 눌러서 변경`);
            }
            if (repeat) repeat.textContent = REPEAT_LABELS[this.repeatMode];
            if (shuffle) {
                shuffle.textContent = this.shuffle ? '셔플 ON' : '셔플 OFF';
                shuffle.setAttribute('aria-pressed', this.shuffle ? 'true' : 'false');
            }
            if (status && !this._statusOverride) {
                status.textContent = track ? (this.audio.paused ? '일시정지' : '재생 중') : '음악 데이터 파일을 확인해주세요.';
                status.classList.remove('is-error');
            }
            const hasTrack = Boolean(track);
            [
                'music-previous',
                'music-seek-backward',
                'music-play-toggle',
                'music-seek-forward',
                'music-next',
                'music-playback-rate',
                'music-repeat-toggle',
                'music-shuffle-toggle',
                'music-progress'
            ].forEach(id => {
                const control = document.getElementById(id);
                if (control) control.disabled = !hasTrack;
            });
            this.renderTrackList();
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
