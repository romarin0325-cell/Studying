const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(value) { this.values.add(value); }
    remove(value) { this.values.delete(value); }
    contains(value) { return this.values.has(value); }
    toggle(value, force) {
        if (force === true) this.values.add(value);
        else if (force === false) this.values.delete(value);
        else if (this.values.has(value)) this.values.delete(value);
        else this.values.add(value);
    }
}

class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = String(tagName).toUpperCase();
        this.classList = new FakeClassList();
        this.className = '';
        this.textContent = '';
        this.value = '';
        this.type = '';
        this.disabled = false;
        this.attributes = new Map();
        this.listeners = new Map();
        this.children = [];
        this.parentNode = null;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type, details = {}) {
        const event = { type, target: this, ...details };
        (this.listeners.get(type) || []).forEach(listener => listener(event));
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    replaceChildren(...children) {
        this.children.forEach(child => { child.parentNode = null; });
        this.children = [];
        children.forEach(child => this.appendChild(child));
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) || null; }
}

class FakeAudio extends FakeElement {
    constructor() {
        super('audio');
        this.paused = true;
        this.ended = false;
        this.currentTime = 0;
        this.duration = 180;
        this.defaultPlaybackRate = 1;
        this.playbackRate = 1;
        this.preservesPitch = false;
        this.src = '';
        this.loadCount = 0;
    }

    load() {
        this.loadCount++;
        this.playbackRate = this.defaultPlaybackRate;
        this.paused = true;
        this.dispatch('loadedmetadata');
    }

    play() {
        this.paused = false;
        this.ended = false;
        this.dispatch('play');
        return Promise.resolve();
    }

    pause() {
        const wasPaused = this.paused;
        this.paused = true;
        if (!wasPaused) this.dispatch('pause');
    }
}

const TRACKS = [
    {
        id: 'MUSIC_First.mp3',
        title: 'First',
        artist: 'Card RPG',
        album: 'Card RPG Music',
        src: 'MUSIC_First.mp3'
    },
    {
        id: 'nested/MUSIC_둘째.MP3',
        title: '둘째',
        artist: 'Card RPG',
        album: 'Card RPG Music',
        src: 'nested/MUSIC_둘째.MP3'
    },
    {
        id: 'MUSIC_Third.mp3',
        title: 'Third',
        artist: 'Card RPG',
        album: 'Card RPG Music',
        src: 'MUSIC_Third.mp3'
    }
];

function createHarness({ tracks = TRACKS, savedPrefs = null, includeManifest = true } = {}) {
    const elements = new Map();
    const ids = [
        'modal-music-player', 'music-track-title', 'music-track-meta', 'music-status',
        'music-progress', 'music-current-time', 'music-duration', 'music-previous',
        'music-seek-backward', 'music-play-toggle', 'music-seek-forward', 'music-next',
        'music-rate-1', 'music-rate-125', 'music-repeat-toggle', 'music-shuffle-toggle',
        'music-track-count', 'music-track-list', 'music-mode-all', 'music-mode-favorites'
    ];
    ids.forEach(id => {
        const tagName = id === 'music-progress' ? 'input' : id === 'music-track-list' ? 'div' : 'button';
        elements.set(id, new FakeElement(tagName));
    });
    const audio = new FakeAudio();
    elements.set('music-audio', audio);

    const saved = new Map();
    if (savedPrefs) saved.set('cardRpgMusicPrefs', JSON.parse(JSON.stringify(savedPrefs)));
    const Storage = {
        keys: { MUSIC_PREFS: 'cardRpgMusicPrefs' },
        load: key => saved.has(key) ? saved.get(key) : null,
        save: (key, value) => {
            saved.set(key, JSON.parse(JSON.stringify(value)));
            return true;
        }
    };
    const mediaSession = {
        handlers: {}, metadata: null, playbackState: 'none', positionState: null,
        setActionHandler(action, handler) { this.handlers[action] = handler; },
        setPositionState(state) { this.positionState = { ...state }; }
    };
    class MediaMetadata {
        constructor(value) { Object.assign(this, value); }
    }
    const sandbox = {
        console,
        document: {
            getElementById: id => elements.get(id) || null,
            createElement: tagName => new FakeElement(tagName)
        },
        navigator: { mediaSession }, MediaMetadata, Storage, Date, Math, Number,
        String, Object, Array, Set, Promise
    };
    if (includeManifest) sandbox.CARD_MUSIC_TRACKS = tracks;
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);

    const playerPath = path.join(process.cwd(), 'card', 'music_player.js');
    vm.runInContext(fs.readFileSync(playerPath, 'utf8'), sandbox, { filename: playerPath });
    return { audio, elements, mediaSession, player: sandbox.MusicPlayer, sandbox, saved };
}

async function verifyMainPlayerFlow() {
    const harness = createHarness({
        savedPrefs: {
            trackId: TRACKS[1].id,
            currentTime: 30,
            playbackRate: 1.25,
            repeatMode: 'all',
            shuffle: false
        }
    });
    const { audio, elements, mediaSession, player, sandbox, saved } = harness;

    assert(player, 'MusicPlayer was not exported');
    assert.strictEqual(player.tracks.length, 3);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(player.tracks)), TRACKS);
    assert.strictEqual(player.playlistMode, 'all', 'old preferences must default to all tracks');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(player.favoriteTrackIds)), []);
    assert.strictEqual(audio.src, TRACKS[1].src);
    assert.strictEqual(audio.preservesPitch, true);
    assert.strictEqual(audio.currentTime, 30);
    assert.strictEqual(audio.defaultPlaybackRate, 1.25);
    assert.strictEqual(audio.playbackRate, 1.25);
    assert.strictEqual(mediaSession.metadata.title, TRACKS[1].title);
    assert.strictEqual(elements.get('music-rate-1').getAttribute('aria-pressed'), 'false');
    assert.strictEqual(elements.get('music-rate-125').getAttribute('aria-pressed'), 'true');
    assert.strictEqual(elements.get('music-track-count').textContent, '3곡');
    assert.strictEqual(elements.get('music-track-list').children.length, 3);
    assert.strictEqual(elements.get('music-play-toggle').disabled, false);
    ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto']
        .forEach(action => assert.strictEqual(typeof mediaSession.handlers[action], 'function'));

    await player.next();
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[2].id);
    assert.strictEqual(audio.paused, true, 'selecting the next track while paused must remain paused');
    assert.strictEqual(audio.playbackRate, 1.25, 'restored rate must survive a track load');

    player.open();
    assert.strictEqual(elements.get('modal-music-player').classList.contains('active'), true);
    await player.toggle();
    assert.strictEqual(audio.paused, false);
    assert.strictEqual(elements.get('music-play-toggle').textContent, '⏸');
    player.close();
    assert.strictEqual(elements.get('modal-music-player').classList.contains('active'), false);
    assert.strictEqual(audio.paused, false, 'closing the modal must not stop playback');

    await player.selectTrack(TRACKS[0].id);
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[0].id);
    assert.strictEqual(audio.paused, false, 'selecting a track while playing must continue playback');
    player.pause();
    await player.selectTrack(TRACKS[2].id);
    assert.strictEqual(audio.paused, true, 'selecting a track while paused must remain paused');

    player.setPlaybackRate('1');
    assert.strictEqual(audio.defaultPlaybackRate, 1);
    await player.next();
    assert.strictEqual(audio.playbackRate, 1, 'selected rate must survive the next track load');
    player.setPlaybackRate(1.5);
    assert.strictEqual(audio.playbackRate, 1, 'unsupported rates must fall back to 1x');
    player.cyclePlaybackRate();
    assert.strictEqual(audio.playbackRate, 1.25);
    assert.strictEqual(elements.get('music-rate-1').getAttribute('aria-pressed'), 'false');
    assert.strictEqual(elements.get('music-rate-125').getAttribute('aria-pressed'), 'true');
    [1, 1.25].forEach(expectedRate => {
        player.cyclePlaybackRate();
        assert.strictEqual(audio.playbackRate, expectedRate);
    });

    player.commitSeek(50);
    assert.strictEqual(audio.currentTime, 90);
    assert.strictEqual(elements.get('music-current-time').textContent, '1:30');
    player.toggleRepeat();
    assert.strictEqual(player.repeatMode, 'one');
    player.toggleShuffle();
    assert.strictEqual(player.shuffle, true);

    const studyAudio = new FakeAudio();
    studyAudio.paused = false;
    sandbox.FortuneCookie = { audio: studyAudio };
    await player.play();
    assert.strictEqual(studyAudio.paused, true, 'music playback must pause study audio');
    player.pauseForStudy();
    assert.strictEqual(audio.paused, true);
    await player.resumeAfterStudy();
    assert.strictEqual(audio.paused, false);

    audio.currentTime = 12;
    await mediaSession.handlers.previoustrack();
    assert.strictEqual(audio.currentTime, 0);
    mediaSession.handlers.seekforward({ seekOffset: 15 });
    assert.strictEqual(audio.currentTime, 15);
    mediaSession.handlers.seekto({ seekTime: 30 });
    assert.strictEqual(audio.currentTime, 30);

    await player.toggleFavorite(TRACKS[0].id);
    await player.toggleFavorite(TRACKS[2].id);
    await player.setPlaylistMode('favorites');
    assert.strictEqual(player.playlistMode, 'favorites');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(player.getActiveTrackIndexes())), [0, 2]);
    assert.strictEqual(elements.get('music-mode-favorites').getAttribute('aria-pressed'), 'true');

    await player.selectTrack(TRACKS[1].id);
    assert.strictEqual(player.playlistMode, 'all', 'selecting a nonfavorite from the full list must leave favorites-only mode');
    await player.setPlaylistMode('favorites');

    await player.selectTrack(TRACKS[0].id);
    audio.currentTime = 0;
    player.shuffle = false;
    await player.next();
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[2].id, 'next must stay inside favorites');
    audio.currentTime = 0;
    await mediaSession.handlers.nexttrack();
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[0].id, 'Media Session next must stay inside favorites');
    audio.currentTime = 0;
    await mediaSession.handlers.previoustrack();
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[2].id, 'Media Session previous must stay inside favorites');

    player.repeatMode = 'off';
    audio.currentTime = 180;
    player.handleEnded();
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[2].id, 'repeat off must stop at the active playlist end');
    assert.strictEqual(audio.currentTime, 0);
    player.repeatMode = 'all';
    player.handleEnded();
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[0].id, 'repeat all must wrap inside favorites');

    await player.toggleFavorite(TRACKS[2].id);
    player.shuffle = true;
    await player.next();
    assert.strictEqual(player.getCurrentTrack().id, TRACKS[0].id, 'one-track shuffle must not loop or leave favorites');

    await player.play();
    const playingSource = audio.src;
    const loadCount = audio.loadCount;
    await player.toggleFavorite(TRACKS[0].id);
    assert.strictEqual(player.playlistMode, 'all', 'removing the last favorite must return to all tracks');
    assert.strictEqual(audio.src, playingSource, 'removing the last favorite must not reload the current audio');
    assert.strictEqual(audio.loadCount, loadCount, 'removing the last favorite must not load another track');
    assert.strictEqual(audio.paused, false, 'removing the last favorite must not stop playback');
    assert(elements.get('music-status').textContent.includes('전체 곡'));

    const emptyFavoriteResult = await player.setPlaylistMode('favorites');
    assert.strictEqual(emptyFavoriteResult, false);
    assert.strictEqual(player.playlistMode, 'all');
    assert.strictEqual(audio.paused, false);
    assert.strictEqual(audio.loadCount, loadCount);
    assert.strictEqual(elements.get('music-status').textContent, '즐겨찾기 곡이 없습니다.');

    const prefs = saved.get('cardRpgMusicPrefs');
    assert.strictEqual(prefs.playbackRate, 1.25);
    assert.strictEqual(prefs.repeatMode, 'all');
    assert.strictEqual(prefs.shuffle, true);
    assert.deepStrictEqual(prefs.favoriteTrackIds, []);
    assert.strictEqual(prefs.playlistMode, 'all');
    assert.strictEqual(mediaSession.positionState.duration, 180);
    assert.strictEqual(mediaSession.positionState.playbackRate, 1.25);

    audio.dispatch('error');
    assert(elements.get('music-status').textContent.includes(player.getCurrentTrack().src));
    assert.strictEqual(elements.get('music-status').classList.contains('is-error'), true);
}

async function verifySavedFavoritesAndEmptyStates() {
    const favoriteHarness = createHarness({
        savedPrefs: {
            trackId: TRACKS[1].id,
            currentTime: 77,
            playbackRate: 1,
            repeatMode: 'all',
            shuffle: false,
            favoriteTrackIds: [TRACKS[0].id, 'missing/MUSIC_Old.mp3', TRACKS[2].id, TRACKS[0].id],
            playlistMode: 'favorites'
        }
    });
    assert.strictEqual(favoriteHarness.player.playlistMode, 'favorites');
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(favoriteHarness.player.favoriteTrackIds)),
        [TRACKS[0].id, TRACKS[2].id],
        'stale and duplicate favorites must be ignored'
    );
    assert.strictEqual(favoriteHarness.player.getCurrentTrack().id, TRACKS[0].id);
    assert.strictEqual(favoriteHarness.audio.currentTime, 0, 'saved time from a different track must not be restored');

    for (const includeManifest of [true, false]) {
        const emptyHarness = createHarness({ tracks: [], includeManifest });
        const { audio, elements, mediaSession, player } = emptyHarness;
        assert.strictEqual(player.tracks.length, 0);
        assert.strictEqual(audio.loadCount, 0);
        assert.strictEqual(elements.get('music-track-title').textContent, '재생할 곡 없음');
        assert.strictEqual(elements.get('music-status').textContent, '음악 데이터 파일을 확인해주세요.');
        assert.strictEqual(elements.get('music-track-count').textContent, '0곡');
        assert.strictEqual(elements.get('music-track-list').children.length, 1);
        assert.strictEqual(elements.get('music-track-list').children[0].textContent, '등록된 음악이 없습니다.');
        assert.strictEqual(elements.get('music-play-toggle').disabled, true);
        assert.strictEqual(elements.get('music-mode-all').disabled, true);
        assert.strictEqual(mediaSession.metadata, null);
        assert.strictEqual(await player.play(), false);
        assert.strictEqual(await player.next(), false);
        mediaSession.handlers.seekforward({ seekOffset: 10 });
        mediaSession.handlers.seekto({ seekTime: 10 });
    }
}

function verifyHtmlIntegration() {
    const html = fs.readFileSync(path.join(process.cwd(), 'card', 'index.html'), 'utf8');
    const dataPosition = html.indexOf("{ src: 'music_data.js'");
    const playerPosition = html.indexOf("{ src: 'music_player.js'");
    assert(dataPosition >= 0 && dataPosition < playerPosition, 'music data must load before the player');
    assert(html.includes('id="music-track-list"'));
    assert(html.includes('id="music-mode-favorites"'));
    assert(html.includes('id="music-rate-1" type="button"'), '1x rate must use a themed toggle');
    assert(html.includes('id="music-rate-125" type="button"'), '1.25x rate must use a themed toggle');
    assert(!html.includes('id="music-playback-rate"'), 'legacy single rate control must be removed');
    assert(!html.includes('music-background-note'), 'browser-policy note must be removed');
    assert(!html.includes('창을 닫아도 음악은 계속 재생됩니다'));
    assert(!html.includes('<h3 id="music-player-heading">음악재생</h3>'), 'redundant visible heading must be removed');
    const musicData = fs.readFileSync(path.join(process.cwd(), 'card', 'music_data.js'), 'utf8');
    assert(!musicData.includes('スキの未払金'), 'unpaid-love track must be removed from the playlist');
}

async function run() {
    verifyHtmlIntegration();
    await verifyMainPlayerFlow();
    await verifySavedFavoritesAndEmptyStates();
    console.log('Card music player verification passed.');
}

run().catch(error => {
    console.error(error.stack || error.message || error);
    process.exit(1);
});
