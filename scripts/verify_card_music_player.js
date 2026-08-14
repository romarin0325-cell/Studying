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
    constructor() {
        this.classList = new FakeClassList();
        this.textContent = '';
        this.value = '';
        this.attributes = new Map();
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type) {
        (this.listeners.get(type) || []).forEach(listener => listener({ type, target: this }));
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) || null; }
}

class FakeAudio extends FakeElement {
    constructor() {
        super();
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

async function run() {
    const elements = new Map();
    const ids = [
        'modal-music-player',
        'music-track-title',
        'music-track-meta',
        'music-status',
        'music-progress',
        'music-current-time',
        'music-duration',
        'music-play-toggle',
        'music-playback-rate',
        'music-repeat-toggle',
        'music-shuffle-toggle'
    ];
    ids.forEach(id => elements.set(id, new FakeElement()));
    const audio = new FakeAudio();
    elements.set('music-audio', audio);

    const saved = new Map([
        ['cardRpgMusicPrefs', {
            trackId: 'okaeri_aniichan',
            currentTime: 30,
            playbackRate: 1.5,
            repeatMode: 'all',
            shuffle: false
        }]
    ]);
    const Storage = {
        keys: { MUSIC_PREFS: 'cardRpgMusicPrefs' },
        load: key => saved.has(key) ? saved.get(key) : null,
        save: (key, value) => {
            saved.set(key, JSON.parse(JSON.stringify(value)));
            return true;
        }
    };
    const mediaSession = {
        handlers: {},
        metadata: null,
        playbackState: 'none',
        positionState: null,
        setActionHandler(action, handler) { this.handlers[action] = handler; },
        setPositionState(state) { this.positionState = { ...state }; }
    };
    class MediaMetadata {
        constructor(value) { Object.assign(this, value); }
    }
    const sandbox = {
        console,
        document: { getElementById: id => elements.get(id) || null },
        navigator: { mediaSession },
        MediaMetadata,
        Storage,
        Date,
        Math,
        Number,
        String,
        Object,
        Array,
        Promise
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);

    const playerPath = path.join(process.cwd(), 'card', 'music_player.js');
    vm.runInContext(fs.readFileSync(playerPath, 'utf8'), sandbox, { filename: playerPath });
    const player = sandbox.MusicPlayer;

    assert(player, 'MusicPlayer was not exported');
    assert.strictEqual(player.tracks.length, 1);
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(player.tracks[0])),
        {
            id: 'okaeri_aniichan',
            title: 'おかえり、兄ちゃん',
            artist: 'Card RPG',
            album: 'Card RPG Music',
            src: 'おかえり、兄ちゃん.mp3'
        }
    );
    assert.strictEqual(audio.src, 'おかえり、兄ちゃん.mp3');
    assert.strictEqual(audio.preservesPitch, true);
    assert.strictEqual(audio.currentTime, 30);
    assert.strictEqual(audio.defaultPlaybackRate, 1.5);
    assert.strictEqual(audio.playbackRate, 1.5);
    assert.strictEqual(mediaSession.metadata.title, 'おかえり、兄ちゃん');
    ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto']
        .forEach(action => assert.strictEqual(typeof mediaSession.handlers[action], 'function'));

    await player.next();
    assert.strictEqual(audio.defaultPlaybackRate, 1.5);
    assert.strictEqual(audio.playbackRate, 1.5, 'restored rate must survive the next track load');

    player.open();
    assert.strictEqual(elements.get('modal-music-player').classList.contains('active'), true);
    await player.toggle();
    assert.strictEqual(audio.paused, false);
    assert.strictEqual(elements.get('music-play-toggle').textContent, '⏸');
    player.close();
    assert.strictEqual(elements.get('modal-music-player').classList.contains('active'), false);
    assert.strictEqual(audio.paused, false, 'closing the modal must not stop playback');

    player.setPlaybackRate('1.25');
    assert.strictEqual(audio.defaultPlaybackRate, 1.25);
    await player.next();
    assert.strictEqual(audio.playbackRate, 1.25, 'selected rate must survive the next track load');

    player.setPlaybackRate('1.5');
    player.repeatMode = 'all';
    player.handleEnded();
    assert.strictEqual(audio.defaultPlaybackRate, 1.5);
    assert.strictEqual(audio.playbackRate, 1.5, 'selected rate must survive all-track repeat');
    player.commitSeek(50);
    assert.strictEqual(audio.currentTime, 90);
    assert.strictEqual(elements.get('music-current-time').textContent, '1:30');

    player.toggleRepeat();
    assert.strictEqual(player.repeatMode, 'one');
    player.toggleShuffle();
    assert.strictEqual(player.shuffle, true);

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

    const prefs = saved.get('cardRpgMusicPrefs');
    assert.strictEqual(prefs.trackId, 'okaeri_aniichan');
    assert.strictEqual(prefs.playbackRate, 1.5);
    assert.strictEqual(prefs.repeatMode, 'one');
    assert.strictEqual(prefs.shuffle, true);
    assert.strictEqual(mediaSession.positionState.duration, 180);
    assert.strictEqual(mediaSession.positionState.playbackRate, 1.5);

    audio.dispatch('error');
    assert(elements.get('music-status').textContent.includes('おかえり、兄ちゃん.mp3'));
    assert.strictEqual(elements.get('music-status').classList.contains('is-error'), true);

    console.log('Card music player verification passed.');
}

run().catch(error => {
    console.error(error.stack || error.message || error);
    process.exit(1);
});
