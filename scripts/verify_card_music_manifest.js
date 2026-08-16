const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const {
    collectMusicTracks,
    generateManifest,
    renderManifest
} = require('./generate_card_music_manifest');

function touch(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'fixture', 'utf8');
}

function run() {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'card-music-manifest-'));

    try {
        [
            'TOEIC_TEST_01.mp3',
            'DAY05_02_1번.mp3',
            'LISTEN_003.mp3',
            'voice.mp3',
            'music_lowercase.mp3',
            'prefix_MUSIC_hidden.mp3',
            'MUSIC_not-audio.wav',
            'MUSIC_Zeta.MP3',
            'MUSIC_おかえり、兄ちゃん.mp3',
            path.join('albums', 'MUSIC_明日へのメロディ.mP3'),
            path.join('albums', 'deep', 'MUSIC_Alpha.mp3')
        ].forEach(relativePath => touch(path.join(fixtureRoot, relativePath)));

        const tracks = collectMusicTracks(fixtureRoot);
        assert.deepStrictEqual(
            tracks.map(track => track.id),
            [
                'MUSIC_Zeta.MP3',
                'MUSIC_おかえり、兄ちゃん.mp3',
                'albums/MUSIC_明日へのメロディ.mP3',
                'albums/deep/MUSIC_Alpha.mp3'
            ],
            'only MUSIC_*.mp3 files should be collected in deterministic relative-path order'
        );
        assert.deepStrictEqual(
            tracks.map(track => track.title),
            ['Zeta', 'おかえり、兄ちゃん', '明日へのメロディ', 'Alpha']
        );
        tracks.forEach(track => {
            assert.strictEqual(track.src, track.id);
            assert.strictEqual(track.artist, 'Card RPG');
            assert.strictEqual(track.album, 'Card RPG Music');
            assert(!track.id.includes('\\'), 'browser paths must use forward slashes');
        });

        const outputPath = path.join(fixtureRoot, 'generated', 'music_manifest.js');
        const firstGeneration = generateManifest(fixtureRoot, outputPath);
        const firstContent = fs.readFileSync(outputPath, 'utf8');
        const secondGeneration = generateManifest(fixtureRoot, outputPath);
        assert.strictEqual(secondGeneration.content, firstGeneration.content);
        assert.strictEqual(fs.readFileSync(outputPath, 'utf8'), firstContent);
        assert.strictEqual(firstContent, renderManifest(tracks));

        const sandbox = { window: {} };
        vm.createContext(sandbox);
        vm.runInContext(firstContent, sandbox, { filename: outputPath });
        const manifestTracks = sandbox.window.CARD_MUSIC_TRACKS;
        assert.strictEqual(Object.isFrozen(manifestTracks), true);
        assert.strictEqual(manifestTracks.length, tracks.length);
        manifestTracks.forEach(track => assert.strictEqual(Object.isFrozen(track), true));
        assert.deepStrictEqual(
            JSON.parse(JSON.stringify(manifestTracks)),
            tracks
        );

        const emptyRoot = path.join(fixtureRoot, 'empty-card');
        fs.mkdirSync(emptyRoot);
        const emptyTracks = collectMusicTracks(emptyRoot);
        assert.deepStrictEqual(emptyTracks, []);
        assert(renderManifest(emptyTracks).includes('Object.freeze([])'));

        console.log('Card music manifest verification passed.');
    } finally {
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
}

try {
    run();
} catch (error) {
    console.error(error.stack || error.message || error);
    process.exit(1);
}
