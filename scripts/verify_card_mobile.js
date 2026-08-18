const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const BOOT_TIMEOUT_MS = 20000;
const MUSIC_FIXTURE_TRACKS = Array.from({ length: 12 }, (_, index) => ({
    id: `fixtures/MUSIC_Test_${String(index + 1).padStart(2, '0')}.mp3`,
    title: index === 0 ? '모바일 레이아웃 테스트 음악' : `테스트 음악 ${index + 1}`,
    artist: 'Card RPG',
    album: 'Card RPG Music',
    src: `fixtures/MUSIC_Test_${String(index + 1).padStart(2, '0')}.mp3`
}));

async function preparePage(browser, viewport) {
    const page = await browser.newPage({ viewport });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
        try {
            localStorage.clear();
        } catch (error) {
            console.error(error);
        }
    });
    return { page, pageErrors };
}

async function waitForLoader(page) {
    await page.waitForFunction(
        () => window._scriptLoadComplete === true,
        null,
        { timeout: BOOT_TIMEOUT_MS }
    );
}

async function run() {
    const browser = await chromium.launch({ headless: true });
    const cardRoot = path.join(process.cwd(), 'card');
    const fileUrl = pathToFileURL(path.join(cardRoot, 'index.html')).href;

    try {
        const normal = await preparePage(browser, { width: 390, height: 844 });
        await normal.page.route('**/music_data.js', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `window.CARD_MUSIC_TRACKS = Object.freeze(${JSON.stringify(MUSIC_FIXTURE_TRACKS)});`
        }));
        await normal.page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
        await waitForLoader(normal.page);
        await normal.page.waitForFunction(
            () => [...document.querySelectorAll('.title-screen-actions button')]
                .every(button => !button.disabled),
            null,
            { timeout: BOOT_TIMEOUT_MS }
        );

        const bootState = await normal.page.evaluate(() => ({
            featureInstalled: RPG._featuresInstalled,
            listeningReady: typeof LISTENING_DATA !== 'undefined' && LISTENING_DATA.length > 0,
            fortuneReady: typeof FortuneCookie !== 'undefined',
            musicReady: typeof MusicPlayer !== 'undefined' && Array.isArray(MusicPlayer.tracks),
            scriptErrors: [...window._scriptLoadErrors]
        }));
        assert.deepStrictEqual(bootState, {
            featureInstalled: true,
            listeningReady: true,
            fortuneReady: true,
            musicReady: true,
            scriptErrors: []
        });

        const portraitTitleLayout = await normal.page.evaluate(() => {
            const screen = document.getElementById('screen-title');
            const heading = screen.querySelector('h1');
            const actions = screen.querySelector('.title-screen-actions');
            const screenRect = screen.getBoundingClientRect();
            const headingRect = heading.getBoundingClientRect();
            const actionsRect = actions.getBoundingClientRect();
            return {
                scrollable: screen.scrollHeight > screen.clientHeight,
                topSpace: headingRect.top - screenRect.top,
                bottomSpace: screenRect.bottom - actionsRect.bottom,
                actionsLeft: actionsRect.left,
                actionsRight: actionsRect.right
            };
        });
        assert.strictEqual(portraitTitleLayout.scrollable, false);
        assert(Math.abs(portraitTitleLayout.topSpace - portraitTitleLayout.bottomSpace) <= 2);
        assert(portraitTitleLayout.actionsLeft >= 0 && portraitTitleLayout.actionsRight <= 390);

        const musicModalLayout = await normal.page.evaluate(async () => {
            MusicPlayer.open();
            const modal = document.getElementById('modal-music-player');
            const panel = modal.querySelector('.modal-content');
            const rect = panel.getBoundingClientRect();
            const controlsRect = panel.querySelector('.music-control-row').getBoundingClientRect();
            const library = panel.querySelector('.music-track-library');
            const libraryRect = library.getBoundingClientRect();
            const list = document.getElementById('music-track-list');
            const favoriteRect = list.querySelector('.music-favorite-toggle').getBoundingClientRect();
            MusicPlayer.setPlaybackRate(1.25);
            const result = {
                active: modal.classList.contains('active'),
                noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth + 1,
                panelDoesNotScroll: panel.scrollHeight <= panel.clientHeight + 1,
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                controlsVisible: controlsRect.top >= rect.top - 1
                    && controlsRect.bottom <= rect.bottom + 1,
                libraryVisible: libraryRect.top >= rect.top - 1 && libraryRect.bottom <= rect.bottom + 1,
                listOwnsOverflow: ['auto', 'scroll'].includes(getComputedStyle(list).overflowY),
                listHasOwnScroll: list.scrollHeight > list.clientHeight,
                favoriteWidth: favoriteRect.width,
                favoriteHeight: favoriteRect.height,
                trackCount: MusicPlayer.tracks.length,
                title: document.getElementById('music-track-title').textContent,
                source: document.getElementById('music-audio').getAttribute('src'),
                visibleHeadingRemoved: !document.getElementById('music-player-heading'),
                rateOneTag: document.getElementById('music-rate-1').tagName,
                rateBoostTag: document.getElementById('music-rate-125').tagName,
                playbackRate: MusicPlayer.audio.playbackRate,
                defaultPlaybackRate: MusicPlayer.audio.defaultPlaybackRate
            };
            MusicPlayer.setPlaybackRate(1);
            MusicPlayer.close();
            return result;
        });
        assert.strictEqual(musicModalLayout.active, true);
        assert.strictEqual(musicModalLayout.noHorizontalOverflow, true);
        assert.strictEqual(musicModalLayout.panelDoesNotScroll, true);
        assert(musicModalLayout.left >= -1 && musicModalLayout.right <= 391);
        assert(musicModalLayout.top >= -1 && musicModalLayout.bottom <= 845);
        assert.strictEqual(musicModalLayout.controlsVisible, true);
        assert.strictEqual(musicModalLayout.libraryVisible, true);
        assert.strictEqual(musicModalLayout.listOwnsOverflow, true);
        assert.strictEqual(musicModalLayout.trackCount, MUSIC_FIXTURE_TRACKS.length);
        assert.strictEqual(musicModalLayout.title, MUSIC_FIXTURE_TRACKS[0].title);
        assert.strictEqual(musicModalLayout.source, MUSIC_FIXTURE_TRACKS[0].src);
        assert.strictEqual(musicModalLayout.visibleHeadingRemoved, true);
        assert.strictEqual(musicModalLayout.rateOneTag, 'BUTTON');
        assert.strictEqual(musicModalLayout.rateBoostTag, 'BUTTON');
        assert.strictEqual(musicModalLayout.listHasOwnScroll, true);
        assert(musicModalLayout.favoriteWidth >= 44);
        assert(musicModalLayout.favoriteHeight >= 44);
        assert.strictEqual(musicModalLayout.playbackRate, 1.25);
        assert.strictEqual(musicModalLayout.defaultPlaybackRate, 1.25);

        const imageState = await normal.page.evaluate(async () => {
            const waitUntil = async predicate => {
                const deadline = performance.now() + 3000;
                while (!predicate()) {
                    if (performance.now() > deadline) throw new Error('image state timeout');
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            };

            const successParent = document.createElement('div');
            const successImage = document.createElement('img');
            successParent.appendChild(successImage);
            document.body.appendChild(successParent);
            const pixel = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
            const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
            let pixelSourceAssignments = 0;
            Object.defineProperty(HTMLImageElement.prototype, 'src', {
                ...srcDescriptor,
                set(value) {
                    if (value === pixel) pixelSourceAssignments++;
                    srcDescriptor.set.call(this, value);
                }
            });
            try {
                ImageAssets.load(successImage, pixel, { parent: successParent, toggleParent: true });
                await waitUntil(() => successImage.style.display === 'block');
            } finally {
                Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor);
            }

            const failureParent = document.createElement('div');
            const failureImage = document.createElement('img');
            failureParent.appendChild(failureImage);
            document.body.appendChild(failureParent);
            ImageAssets.load(failureImage, '__missing_mobile_test_image__.png', {
                parent: failureParent,
                toggleParent: true
            });
            await waitUntil(() => failureParent.style.display === 'none'
                && !failureImage.hasAttribute('src'));

            const result = {
                successVisible: successImage.style.display === 'block' && successParent.style.display !== 'none',
                successSourceAssignments: pixelSourceAssignments,
                failedImageHidden: failureImage.style.display === 'none',
                failedParentHidden: failureParent.style.display === 'none',
                failedSourceRemoved: !failureImage.hasAttribute('src')
            };
            successParent.remove();
            failureParent.remove();
            return result;
        });
        assert.deepStrictEqual(imageState, {
            successVisible: true,
            successSourceAssignments: 1,
            failedImageHidden: true,
            failedParentHidden: true,
            failedSourceRemoved: true
        });

        await normal.page.setViewportSize({ width: 1200, height: 800 });
        const desktopModalWidth = await normal.page.evaluate(() => {
            const modal = document.getElementById('modal-date');
            modal.classList.add('active');
            const width = modal.querySelector('.modal-content').getBoundingClientRect().width;
            modal.classList.remove('active');
            return width;
        });
        assert(desktopModalWidth > 500 && desktopModalWidth <= 601);

        await normal.page.setViewportSize({ width: 320, height: 568 });
        const compactTitleLayout = await normal.page.evaluate(() => {
            const screen = document.getElementById('screen-title');
            const headingRect = screen.querySelector('h1').getBoundingClientRect();
            const actionsRect = screen.querySelector('.title-screen-actions').getBoundingClientRect();
            const screenRect = screen.getBoundingClientRect();
            return {
                scrollable: screen.scrollHeight > screen.clientHeight,
                topSpace: headingRect.top - screenRect.top,
                bottomSpace: screenRect.bottom - actionsRect.bottom,
                actionsLeft: actionsRect.left,
                actionsRight: actionsRect.right
            };
        });
        assert.strictEqual(compactTitleLayout.scrollable, false);
        assert(Math.abs(compactTitleLayout.topSpace - compactTitleLayout.bottomSpace) <= 2);
        assert(compactTitleLayout.actionsLeft >= 0 && compactTitleLayout.actionsRight <= 320);

        const compactMusicModalBounds = await normal.page.evaluate(() => {
            MusicPlayer.open();
            const panel = document.querySelector('#modal-music-player .modal-content');
            const rect = panel.getBoundingClientRect();
            const controlsRect = panel.querySelector('.music-control-row').getBoundingClientRect();
            const library = panel.querySelector('.music-track-library');
            const libraryRect = library.getBoundingClientRect();
            const list = document.getElementById('music-track-list');
            const favoriteRect = list.querySelector('.music-favorite-toggle').getBoundingClientRect();
            const result = {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth + 1,
                panelDoesNotScroll: panel.scrollHeight <= panel.clientHeight + 1,
                controlsVisible: controlsRect.top >= rect.top - 1 && controlsRect.bottom <= rect.bottom + 1,
                libraryVisible: libraryRect.top >= rect.top - 1 && libraryRect.bottom <= rect.bottom + 1,
                listOwnsOverflow: ['auto', 'scroll'].includes(getComputedStyle(list).overflowY),
                listHasOwnScroll: list.scrollHeight > list.clientHeight,
                favoriteWidth: favoriteRect.width,
                favoriteHeight: favoriteRect.height,
                rateOneTag: document.getElementById('music-rate-1').tagName,
                rateBoostTag: document.getElementById('music-rate-125').tagName
            };
            MusicPlayer.close();
            return result;
        });
        assert(compactMusicModalBounds.left >= -1 && compactMusicModalBounds.right <= 321);
        assert(compactMusicModalBounds.top >= -1 && compactMusicModalBounds.bottom <= 569);
        assert.strictEqual(compactMusicModalBounds.noHorizontalOverflow, true);
        assert.strictEqual(compactMusicModalBounds.panelDoesNotScroll, true);
        assert.strictEqual(compactMusicModalBounds.controlsVisible, true);
        assert.strictEqual(compactMusicModalBounds.libraryVisible, true);
        assert.strictEqual(compactMusicModalBounds.listOwnsOverflow, true);
        assert.strictEqual(compactMusicModalBounds.listHasOwnScroll, true);
        assert(compactMusicModalBounds.favoriteWidth >= 44);
        assert(compactMusicModalBounds.favoriteHeight >= 44);
        assert.strictEqual(compactMusicModalBounds.rateOneTag, 'BUTTON');
        assert.strictEqual(compactMusicModalBounds.rateBoostTag, 'BUTTON');

        const portraitModalBounds = await normal.page.evaluate(() => {
            RPG.openInfoModal('모바일 경계 검사', '긴 내용 '.repeat(300));
            const rect = document.querySelector('#modal-info .modal-content').getBoundingClientRect();
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        });
        assert(portraitModalBounds.left >= -1 && portraitModalBounds.right <= 321);
        assert(portraitModalBounds.top >= -1 && portraitModalBounds.bottom <= 569);

        await normal.page.evaluate(() => RPG.closeInfoModal());
        const learningModalLayout = await normal.page.evaluate(() => {
            const measureModal = id => {
                const modal = document.getElementById(id);
                modal.classList.add('active');
                const rect = modal.querySelector('.modal-content').getBoundingClientRect();
                modal.classList.remove('active');
                return {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                };
            };

            const lectureModal = document.getElementById('modal-lecture-view');
            const lectureContent = document.getElementById('lecture-content');
            lectureContent.textContent = '긴 문법 강의 내용 '.repeat(300);
            lectureModal.classList.add('active');
            const lecturePanelRect = lectureModal.querySelector('.modal-content').getBoundingClientRect();
            const lectureContentRect = lectureContent.getBoundingClientRect();
            const lectureCloseRect = lectureModal.querySelector('button').getBoundingClientRect();
            const lecture = {
                left: lecturePanelRect.left,
                top: lecturePanelRect.top,
                right: lecturePanelRect.right,
                bottom: lecturePanelRect.bottom,
                width: lecturePanelRect.width,
                height: lecturePanelRect.height,
                contentHeight: lectureContentRect.height,
                contentScrollable: lectureContent.scrollHeight > lectureContent.clientHeight,
                closeVisible: lectureCloseRect.top >= lecturePanelRect.top - 1
                    && lectureCloseRect.bottom <= lecturePanelRect.bottom + 1
            };
            lectureModal.classList.remove('active');
            lectureContent.textContent = '';

            const tutoring = document.getElementById('modal-tutoring');
            tutoring.classList.add('active');
            const portrait = tutoring.querySelector('.lumi-modal-portrait');
            const portraitRect = portrait.getBoundingClientRect();
            const portraitWidth = portrait.clientWidth;
            const portraitHeight = portrait.clientHeight;
            const dialogueHeight = document.getElementById('tutoring-content').getBoundingClientRect().height;
            const portraitFlexShrink = getComputedStyle(portrait).flexShrink;
            tutoring.classList.remove('active');

            return {
                modals: [
                    'modal-wordbook',
                    'modal-tutoring',
                    'modal-lumi-question',
                    'modal-date'
                ].map(measureModal),
                lecture,
                portraitWidth,
                portraitHeight,
                portraitOuterWidth: portraitRect.width,
                portraitOuterHeight: portraitRect.height,
                portraitFlexShrink,
                dialogueHeight
            };
        });
        learningModalLayout.modals.forEach(bounds => {
            assert(bounds.left >= 7 && bounds.right <= 313);
            assert(bounds.top >= 0 && bounds.bottom <= 568);
            assert(bounds.width >= 303 && bounds.width <= 305);
            assert(bounds.height >= 482 && bounds.height <= 484);
        });
        assert(learningModalLayout.lecture.left >= 7 && learningModalLayout.lecture.right <= 313);
        assert(learningModalLayout.lecture.top >= 7 && learningModalLayout.lecture.bottom <= 561);
        assert(learningModalLayout.lecture.width >= 303 && learningModalLayout.lecture.width <= 305);
        assert(learningModalLayout.lecture.height >= 521 && learningModalLayout.lecture.height <= 524);
        assert(learningModalLayout.lecture.contentHeight >= 200);
        assert.strictEqual(learningModalLayout.lecture.contentScrollable, true);
        assert.strictEqual(learningModalLayout.lecture.closeVisible, true);
        assert.strictEqual(learningModalLayout.portraitFlexShrink, '0');
        assert(Math.abs(
            learningModalLayout.portraitHeight / learningModalLayout.portraitWidth - (4 / 3)
        ) < 0.02);
        assert(Math.abs(
            learningModalLayout.portraitOuterHeight / learningModalLayout.portraitOuterWidth - (4 / 3)
        ) < 0.03);
        assert(learningModalLayout.dialogueHeight > 100);

        await normal.page.setViewportSize({ width: 568, height: 320 });
        const landscapeState = await normal.page.evaluate(() => {
            const screen = document.getElementById('screen-title');
            const lastButton = document.getElementById('btn-title-music');
            const heading = screen.querySelector('h1');
            const screenRectBeforeScroll = screen.getBoundingClientRect();
            const headingRect = heading.getBoundingClientRect();
            screen.scrollTop = screen.scrollHeight;
            const screenRect = screen.getBoundingClientRect();
            const buttonRect = lastButton.getBoundingClientRect();
            return {
                scrollable: screen.scrollHeight > screen.clientHeight,
                topGap: headingRect.top - screenRectBeforeScroll.top,
                lastButtonVisible: buttonRect.top >= screenRect.top - 1 && buttonRect.bottom <= screenRect.bottom + 1
            };
        });
        assert.strictEqual(landscapeState.scrollable, true);
        assert(landscapeState.topGap >= -1 && landscapeState.topGap <= 2);
        assert.strictEqual(landscapeState.lastButtonVisible, true);

        const landscapeMusicLayout = await normal.page.evaluate(() => {
            MusicPlayer.open();
            const panel = document.querySelector('#modal-music-player .music-player-panel');
            const controls = panel.querySelector('.music-control-row');
            const options = panel.querySelector('.music-option-row');
            const library = panel.querySelector('.music-track-library');
            const list = document.getElementById('music-track-list');
            const close = panel.querySelector('.music-close-button');
            const panelRect = panel.getBoundingClientRect();
            const controlsRect = controls.getBoundingClientRect();
            const optionsRect = options.getBoundingClientRect();
            const libraryRect = library.getBoundingClientRect();
            const closeRect = close.getBoundingClientRect();
            const controlButtonRect = controls.querySelector('button').getBoundingClientRect();
            const modeButtonRect = document.getElementById('music-mode-all').getBoundingClientRect();
            const favoriteRect = list.querySelector('.music-favorite-toggle').getBoundingClientRect();
            const result = {
                left: panelRect.left,
                top: panelRect.top,
                right: panelRect.right,
                bottom: panelRect.bottom,
                noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth + 1,
                panelDoesNotScroll: panel.scrollHeight <= panel.clientHeight + 1,
                controlsVisible: controlsRect.top >= panelRect.top - 1 && controlsRect.bottom <= panelRect.bottom + 1,
                optionsVisible: optionsRect.top >= panelRect.top - 1 && optionsRect.bottom <= panelRect.bottom + 1,
                libraryVisible: libraryRect.top >= panelRect.top - 1 && libraryRect.bottom <= panelRect.bottom + 1,
                closeVisible: closeRect.top >= panelRect.top - 1 && closeRect.bottom <= panelRect.bottom + 1,
                sideBySide: controlsRect.right <= libraryRect.left,
                listOwnsOverflow: ['auto', 'scroll'].includes(getComputedStyle(list).overflowY),
                listHasOwnScroll: list.scrollHeight > list.clientHeight,
                controlButtonHeight: controlButtonRect.height,
                modeButtonHeight: modeButtonRect.height,
                favoriteWidth: favoriteRect.width,
                favoriteHeight: favoriteRect.height
            };
            MusicPlayer.close();
            return result;
        });
        assert(landscapeMusicLayout.left >= 7 && landscapeMusicLayout.right <= 561);
        assert(landscapeMusicLayout.top >= 7 && landscapeMusicLayout.bottom <= 313);
        assert.strictEqual(landscapeMusicLayout.noHorizontalOverflow, true);
        assert.strictEqual(landscapeMusicLayout.panelDoesNotScroll, true);
        assert.strictEqual(landscapeMusicLayout.controlsVisible, true);
        assert.strictEqual(landscapeMusicLayout.optionsVisible, true);
        assert.strictEqual(landscapeMusicLayout.libraryVisible, true);
        assert.strictEqual(landscapeMusicLayout.closeVisible, true);
        assert.strictEqual(landscapeMusicLayout.sideBySide, true);
        assert.strictEqual(landscapeMusicLayout.listOwnsOverflow, true);
        assert.strictEqual(landscapeMusicLayout.listHasOwnScroll, true);
        assert(landscapeMusicLayout.controlButtonHeight >= 36);
        assert(landscapeMusicLayout.modeButtonHeight >= 36);
        assert(landscapeMusicLayout.favoriteWidth >= 44);
        assert(landscapeMusicLayout.favoriteHeight >= 44);

        await normal.page.setViewportSize({ width: 390, height: 844 });
        const artifactChaosMenuLayout = await normal.page.evaluate(() => {
            RPG.initNewGame('artifact_chaos');
            RPG.toMenu();

            const area = document.getElementById('menu-chaos-area');
            const artifactButton = document.getElementById('btn-menu-artifact-check');
            const shuffleButton = area.querySelector('button[onclick="RPG.reshuffleChaosPool()"]');
            const areaStyle = getComputedStyle(area);
            const artifactRect = artifactButton.getBoundingClientRect();
            const shuffleRect = shuffleButton.getBoundingClientRect();

            return {
                areaDisplay: areaStyle.display,
                flexDirection: areaStyle.flexDirection,
                artifactVisible: getComputedStyle(artifactButton).display !== 'none',
                artifactLeft: artifactRect.left,
                artifactRight: artifactRect.right,
                artifactWidth: artifactRect.width,
                shuffleLeft: shuffleRect.left,
                shuffleWidth: shuffleRect.width
            };
        });
        assert.strictEqual(artifactChaosMenuLayout.areaDisplay, 'flex');
        assert.strictEqual(artifactChaosMenuLayout.flexDirection, 'row');
        assert.strictEqual(artifactChaosMenuLayout.artifactVisible, true);
        assert(artifactChaosMenuLayout.artifactRight <= artifactChaosMenuLayout.shuffleLeft);
        assert(Math.abs(
            artifactChaosMenuLayout.artifactWidth - artifactChaosMenuLayout.shuffleWidth
        ) <= 1);

        const corruptSaveState = await normal.page.evaluate(() => {
            const raw = '{broken-json';
            RPG.toTitle();
            RPG.closeInfoModal();
            document.getElementById('modal-type-select').classList.remove('active');
            Storage.setRaw(Storage.keys.SAVE, raw);
            const stateBefore = JSON.stringify(RPG.state);
            RPG.startGame('load');
            const backupValues = Object.keys(localStorage)
                .filter(key => key.startsWith(`${Storage.keys.SAVE}_corrupt_`))
                .map(key => Storage.getRaw(key));
            return {
                raw: Storage.getRaw(Storage.keys.SAVE),
                stateUnchanged: JSON.stringify(RPG.state) === stateBefore,
                typeSelectOpen: document.getElementById('modal-type-select').classList.contains('active'),
                titleActive: document.getElementById('screen-title').classList.contains('active'),
                message: document.getElementById('info-content').textContent,
                backupValues
            };
        });
        assert.strictEqual(corruptSaveState.raw, '{broken-json');
        assert.strictEqual(corruptSaveState.stateUnchanged, true);
        assert.strictEqual(corruptSaveState.typeSelectOpen, false);
        assert.strictEqual(corruptSaveState.titleActive, true);
        assert(corruptSaveState.message.includes('손상'));
        assert(corruptSaveState.backupValues.includes('{broken-json'));

        const invalidSaveState = await normal.page.evaluate(() => {
            const raw = '[]';
            RPG.closeInfoModal();
            Storage.setRaw(Storage.keys.SAVE, raw);
            const stateBefore = JSON.stringify(RPG.state);
            RPG.startGame('load');
            return {
                raw: Storage.getRaw(Storage.keys.SAVE),
                stateUnchanged: JSON.stringify(RPG.state) === stateBefore,
                typeSelectOpen: document.getElementById('modal-type-select').classList.contains('active'),
                message: document.getElementById('info-content').textContent
            };
        });
        assert.strictEqual(invalidSaveState.raw, '[]');
        assert.strictEqual(invalidSaveState.stateUnchanged, true);
        assert.strictEqual(invalidSaveState.typeSelectOpen, false);
        assert(invalidSaveState.message.includes('형식'));

        const futureSaveState = await normal.page.evaluate(() => {
            const raw = JSON.stringify({ saveSchemaVersion: SaveDataMigrator.CURRENT_VERSION + 1, futureFlag: true });
            RPG.closeInfoModal();
            Storage.setRaw(Storage.keys.SAVE, raw);
            RPG.startGame('load');
            return {
                raw: Storage.getRaw(Storage.keys.SAVE),
                typeSelectOpen: document.getElementById('modal-type-select').classList.contains('active'),
                message: document.getElementById('info-content').textContent
            };
        });
        assert.strictEqual(JSON.parse(futureSaveState.raw).saveSchemaVersion, 2);
        assert.strictEqual(futureSaveState.typeSelectOpen, false);
        assert(futureSaveState.message.includes('최신 버전'));

        const legacySaveState = await normal.page.evaluate(() => {
            const legacy = {
                mode: 'origin',
                tickets: 7,
                inventory: [],
                deck: [null, null, null],
                enemyScale: 0,
                futureSaveField: { keep: true }
            };
            RPG.closeInfoModal();
            Storage.setRaw(Storage.keys.SAVE, JSON.stringify(legacy));
            RPG.startGame('load');
            const normalized = {
                menuActive: document.getElementById('screen-menu').classList.contains('active'),
                tickets: RPG.state.tickets,
                draftOptions: Array.isArray(RPG.state.draft.currentOptions),
                factoryPool: Array.isArray(RPG.state.factoryPool),
                factoryBundles: Array.isArray(RPG.state.factoryDraft.currentBundles),
                activeEventCards: Array.isArray(RPG.state.activeEventCards),
                futureSaveField: RPG.state.futureSaveField,
                schemaVersion: RPG.state.saveSchemaVersion
            };
            RPG.state.currentToeicSession = { temporary: true };
            const saveOk = RPG.saveGame(false);
            const persisted = JSON.parse(Storage.getRaw(Storage.keys.SAVE));
            RPG.closeInfoModal();
            RPG.toTitle();
            Storage.remove(Storage.keys.SAVE);
            return {
                ...normalized,
                saveOk,
                persistedFutureField: persisted.futureSaveField,
                persistedSchemaVersion: persisted.saveSchemaVersion,
                persistedToeicSession: Object.hasOwn(persisted, 'currentToeicSession')
            };
        });
        assert.deepStrictEqual(legacySaveState, {
            menuActive: true,
            tickets: 7,
            draftOptions: true,
            factoryPool: true,
            factoryBundles: true,
            activeEventCards: true,
            futureSaveField: { keep: true },
            schemaVersion: 1,
            saveOk: true,
            persistedFutureField: { keep: true },
            persistedSchemaVersion: 1,
            persistedToeicSession: false
        });

        const corruptGlobalState = await normal.page.evaluate(() => {
            RPG.toTitle();
            RPG.closeInfoModal();
            document.getElementById('modal-mission-hub').classList.remove('active');
            const validRun = SaveDataMigrator.serializeRunState(RPG.state);
            Storage.save(Storage.keys.SAVE, validRun);
            const runRaw = Storage.getRaw(Storage.keys.SAVE);
            Storage.remove(`${Storage.keys.GLOBAL}_backup`);
            Storage.setRaw(Storage.keys.GLOBAL, '{broken-global');
            RPG._globalLoaded = false;
            RPG._globalStorageBroken = false;
            const stateBefore = JSON.stringify(RPG.state);
            const searchBefore = RPG.global.lumiSearchEnabled;

            RPG.startGame('load');
            const message = document.getElementById('info-content').textContent;
            const menuActive = document.getElementById('screen-menu').classList.contains('active');
            const titleActive = document.getElementById('screen-title').classList.contains('active');
            RPG.closeInfoModal();
            RPG.openMissionHub();
            RPG.toggleLumiSearch();

            return {
                broken: RPG._globalStorageBroken,
                menuActive,
                titleActive,
                message,
                globalRaw: Storage.getRaw(Storage.keys.GLOBAL),
                runRawUnchanged: Storage.getRaw(Storage.keys.SAVE) === runRaw,
                stateUnchanged: JSON.stringify(RPG.state) === stateBefore,
                missionHubOpen: document.getElementById('modal-mission-hub').classList.contains('active'),
                searchUnchanged: RPG.global.lumiSearchEnabled === searchBefore
            };
        });
        assert.deepStrictEqual(corruptGlobalState, {
            broken: true,
            menuActive: false,
            titleActive: true,
            message: '⚠️ 해금 데이터가 손상되었습니다.\n자동 초기화가 차단되었습니다.\n복구/백업을 확인해주세요.',
            globalRaw: '{broken-global',
            runRawUnchanged: true,
            stateUnchanged: true,
            missionHubOpen: false,
            searchUnchanged: true
        });
        assert.deepStrictEqual(normal.pageErrors, []);

        const missingScript = await preparePage(browser, { width: 390, height: 844 });
        await missingScript.page.route('**/fortune_cookie.js', route => route.abort('failed'));
        await missingScript.page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
        await waitForLoader(missingScript.page);
        await missingScript.page.waitForFunction(
            () => document.getElementById('title-loading').textContent.includes('fortune_cookie.js'),
            null,
            { timeout: BOOT_TIMEOUT_MS }
        );
        const missingState = await missingScript.page.evaluate(() => ({
            allDisabled: [...document.querySelectorAll('.title-screen-actions button')]
                .every(button => button.disabled),
            hasRetry: !!document.querySelector('#title-loading button'),
            errors: [...window._scriptLoadErrors]
        }));
        assert.strictEqual(missingState.allDisabled, true);
        assert.strictEqual(missingState.hasRetry, true);
        assert(missingState.errors.includes('fortune_cookie.js'));
        assert.deepStrictEqual(missingScript.pageErrors, []);

        const stalledScript = await preparePage(browser, { width: 390, height: 844 });
        await stalledScript.page.addInitScript(() => {
            window._scriptLoadTimeoutMs = 300;
        });
        const fortuneSource = fs.readFileSync(path.join(cardRoot, 'fortune_cookie.js'), 'utf8');
        await stalledScript.page.route('**/fortune_cookie.js', async route => {
            await new Promise(resolve => setTimeout(resolve, 1200));
            try {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/javascript',
                    body: fortuneSource
                });
            } catch (error) {
                // The timed-out script element is intentionally removed before this response arrives.
            }
        });
        await stalledScript.page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
        await waitForLoader(stalledScript.page);
        await stalledScript.page.waitForFunction(
            () => document.getElementById('title-loading').textContent.includes('fortune_cookie.js'),
            null,
            { timeout: BOOT_TIMEOUT_MS }
        );
        const stalledState = await stalledScript.page.evaluate(() => ({
            allDisabled: [...document.querySelectorAll('.title-screen-actions button')]
                .every(button => button.disabled),
            hasRetry: !!document.querySelector('#title-loading button'),
            errors: [...window._scriptLoadErrors]
        }));
        assert.strictEqual(stalledState.allDisabled, true);
        assert.strictEqual(stalledState.hasRetry, true);
        assert(stalledState.errors.includes('fortune_cookie.js'));
        assert.deepStrictEqual(stalledScript.pageErrors, []);

        const installFailure = await preparePage(browser, { width: 390, height: 844 });
        const featureSource = fs.readFileSync(path.join(cardRoot, 'rpg_features.js'), 'utf8');
        await installFailure.page.route('**/rpg_features.js', route => route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: `${featureSource}\nwindow.RPGFeatureModules.install = function () { throw new Error('mobile-install-test'); };`
        }));
        await installFailure.page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
        await waitForLoader(installFailure.page);
        await installFailure.page.waitForFunction(
            () => document.getElementById('title-loading').textContent.includes('게임 초기화 실패'),
            null,
            { timeout: BOOT_TIMEOUT_MS }
        );
        const installState = await installFailure.page.evaluate(() => ({
            allDisabled: [...document.querySelectorAll('.title-screen-actions button')]
                .every(button => button.disabled),
            text: document.getElementById('title-loading').textContent
        }));
        assert.strictEqual(installState.allDisabled, true);
        assert(installState.text.includes('mobile-install-test'));
        assert.deepStrictEqual(installFailure.pageErrors, []);
    } finally {
        await browser.close();
    }

    console.log('Card mobile browser verification passed.');
}

run().catch(error => {
    console.error(error.stack || error.message || error);
    process.exit(1);
});
