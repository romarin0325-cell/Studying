import './september-rules.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({ headless: true });
const out = new URL('../test-results/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const errors = [], requests = [];
const baseline = process.env.PATCH_BASELINE === '1';
const url = new URL(baseline ? '../test-results/patch-before.html' : '../dist/DREAMWEAVER.html', import.meta.url).href;
const shot = async (page, name) => page.screenshot({ path: fileURLToPath(new URL('patch-' + (baseline ? 'before-' : 'after-') + name + '.png', out)) });
async function close(page) { await page.evaluate(() => document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'))); }
async function seed(page) {
    await page.evaluate(() => {
        RPG.loadGlobalData();
        Object.assign(RPG.state, { mode: 'origin', gameType: 'endless', enemyScale: 6, tickets: 30, artifacts: [],
            deck: ['marshmallow', 'kobold', 'golem'], inventory: ['marshmallow', 'kobold', 'golem'],
            wrongWords: [VOCAB_DATA[0].word], wrongCollocations: [COLLOCATION_DATA[0].id] });
        RPG.toMenu();
    });
}
async function contrast(locator) {
    const samples = await locator.evaluateAll(nodes => nodes.map(el => {
        const rgb = color => (color.match(/[\d.]+/g) || []).map(Number);
        const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * (fg[3] ?? 1) + bg[i] * (1 - (fg[3] ?? 1)));
        const paint = node => {
            if (!node) return [[255, 255, 255]];
            const css = getComputedStyle(node), bg = rgb(css.backgroundColor);
            const base = bg[3] === 0 ? paint(node.parentElement) : (bg[3] ?? 1) === 1 ? [bg] : paint(node.parentElement).map(b => over(bg, b));
            if (!css.backgroundImage.includes('linear-gradient')) return base;
            return (css.backgroundImage.match(/rgba?\([^)]+\)/g) || []).flatMap(c => base.map(b => over(rgb(c), b)));
        };
        return { name: el.textContent, text: rgb(getComputedStyle(el).color), backgrounds: paint(el) };
    }));
    assert.ok(samples.length);
    const luminance = c => c.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    for (const sample of samples) for (const bg of sample.backgrounds) {
        const a = luminance(sample.text), b = luminance(bg);
        assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, 'Contrast: ' + JSON.stringify(sample));
    }
}
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.goto(url); await page.waitForFunction(() => Astra.ready && RPG._featuresInstalled);
    await seed(page);
    if (!baseline) {
        const records = await page.evaluate(() => {
            localStorage.removeItem(Storage.keys.MODE_RECORDS);
            Object.assign(RPG.state, { mode: 'origin', gameType: 'endless', enemyScale: 4 });
            RPG.toMenu(); const first = ModeRecords.read().data;
            RPG.battle.isFinished = false; RPG.loseBattle(); RPG.battle.isFinished = false; RPG.toMenu();
            const repeat = ModeRecords.read().data;
            RPG.startBattleInit();
            const finish = RPG.finishWinBattle, rng = Math.random;
            RPG.finishWinBattle = () => {}; Math.random = () => .99;
            try { RPG.winBattle(); } finally { RPG.finishWinBattle = finish; Math.random = rng; }
            if (RPG.state.enemyScale !== 5) throw Error('Actual win did not advance the stage');
            RPG.saveRecord(); const beforeEntry = ModeRecords.read().data.modes.origin.maxStage;
            RPG.toMenu(); const next = ModeRecords.read().data;
            RPG.tempGameType = 'endless'; RPG.initNewGame('artifact'); RPG.toMenu();
            const switched = ModeRecords.read().data;
            Object.assign(RPG.state, { enemyScale: 10, endlessReachedStage: 10 });
            RPG.initNewGame('origin');
            const rollover = ModeRecords.read().data.modes.artifact.maxStage;
            return { first, repeat, beforeEntry, next, switched, rollover };
        });
        assert.equal(records.first.modes.origin.maxStage, 5);
        assert.equal(records.repeat.modes.origin.maxStage, 5);
        assert.equal(records.beforeEntry, 5);
        assert.equal(records.next.modes.origin.maxStage, 6);
        assert.equal(records.switched.modes.artifact.maxStage, 1);
        assert.equal(records.switched.modes.origin.maxStage, 6);
        assert.equal(records.rollover, 10, 'Pending next stage cannot be credited when a new run replaces the old one');
        await close(page);
        await page.reload(); await page.waitForFunction(() => Astra.ready);
        assert.equal(await page.evaluate(() => ModeRecords.read().data.modes.origin.maxStage), 6, 'New record survives a real release reload');
        const backup = await page.evaluate(() => {
            const old = { format: 'astra-progress', version: 1, values: { [Storage.keys.RECORDS]: ['최대 스테이지: 9'] } };
            const missing = !Object.hasOwn(Astra.validateImport(old), Storage.keys.MODE_RECORDS);
            const fresh = { ...old, values: { ...old.values, [Storage.keys.MODE_RECORDS]: ModeRecords.read().data } };
            const pass = Astra.validateImport(fresh)[Storage.keys.MODE_RECORDS].version;
            let rejected = 0;
            for (const value of [{ version: 2 }, { version: 1, metric: 'max_reached_stage', modes: { origin: { maxStage: -1 } } }]) {
                try { Astra.validateImport({ ...old, values: { ...old.values, [Storage.keys.MODE_RECORDS]: value } }); } catch { rejected++; }
            }
            return { missing, pass, rejected, noKey: !Astra.backupKeys().includes(Storage.keys.API_KEY) };
        });
        assert.deepEqual(backup, { missing: true, pass: 1, rejected: 2, noKey: true });
        const seasons = await page.evaluate(() => {
            RPG.ensureCardPoolConfigState();
            const specials = GameUtils.getSpecialCards(); let cases = 0;
            RPG.global.unlocked_special_cards = specials.map(c => c.id);
            for (const variant of specials) {
                const base = RPG.getCardData(variant.specialBaseId);
                const filler = CARDS.find(c => c.id !== base.id && c.grade === 'normal');
                for (const inBase of [false, true]) {
                    const snap = { source: 'basic_set', baseCardIds: inBase ? [filler.id, base.id] : [filler.id], extraCardIds: inBase ? [] : [base.id] };
                    RPG.state.runCardPool = snap; RPG.state.mode = 'origin';
                    RPG.state.activeSpecialCardSelections = RPG.normalizeSpecialCardSelections({ [base.id]: variant.id });
                    const pool = GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions());
                    if (pool.length !== 2 || pool.filter(c => c.id === variant.id).length !== 1 || pool.some(c => c.id === base.id)) throw Error('Bad replacement: ' + variant.id);
                    if (pool.find(c => c.id === variant.id).grade !== base.grade) throw Error('Changed grade: ' + variant.id);
                    RPG.state.runCardPool.extraCardIds = []; RPG.state.runCardPool.baseCardIds = [filler.id];
                    if (GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions()).some(c => c.id === variant.id)) throw Error('Added absent source');
                    cases++;
                }
                const wrongFamily = specials.find(c => c.specialBaseId !== base.id);
                if (Object.keys(RPG.normalizeSpecialCardSelections({ [base.id]: wrongFamily.id })).length) throw Error('Wrong family accepted');
            }
            const variant = specials.find(c => BONUS_CARDS.some(b => b.id === c.specialBaseId)) || specials[0];
            // Force a draw through the real gacha path using a base outside this run's base set.
            RPG.state.mode = 'origin'; RPG.state.inventory = [];
            RPG.state.runCardPool = { source: 'basic_set', baseCardIds: [], extraCardIds: [variant.specialBaseId] };
            RPG.state.activeSpecialCardSelections = { [variant.specialBaseId]: variant.id };
            const resolve = GameUtils.resolveGachaGrade; GameUtils.resolveGachaGrade = () => variant.grade;
            RPG.runGacha(false); GameUtils.resolveGachaGrade = resolve;
            const drawn = RPG.state.inventory[0];
            const beforePool = GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions()).map(c => c.id);
            RPG.global.activeSpecialCardSelections = {}; RPG.global.cardPoolConfig.selectedSetId = 'classic';
            const afterPool = GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions()).map(c => c.id);
            if (JSON.stringify(beforePool) !== JSON.stringify(afterPool)) throw Error('Future edit changed active run');
            const persisted = SaveDataMigrator.serializeRunState(RPG.state);
            if (persisted.activeSpecialCardSelections[variant.specialBaseId] !== variant.id) throw Error('Variant lost on save');
            for (const maxGrade of ['rare', 'epic']) {
                const filtered = GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions({ maxGrade }));
                const expected = maxGrade === 'rare' ? ['normal', 'rare'] : ['normal', 'rare', 'epic'];
                if (filtered.some(c => !expected.includes(c.grade))) throw Error('Grade limit bypassed');
            }
            for (const mode of ['factory', 'perfect_plan']) {
                RPG.state.mode = mode; RPG.state.factoryPool = [variant.specialBaseId];
                const limited = GameUtils.buildCardPool(RPG.global, RPG.getRunCardPoolBuildOptions());
                if (limited.length !== 1 || limited[0].id !== variant.id) throw Error('Limited pool replacement failed');
            }
            RPG.state.mode = 'origin';
            RPG.global.unlocked_special_cards = [];
            if (Object.keys(RPG.normalizeSpecialCardSelections({ [variant.specialBaseId]: variant.id })).length) throw Error('Unowned accepted');
            return { variants: specials.length, cases, drawn, expected: variant.id };
        });
        assert.ok(seasons.variants > 0); assert.equal(seasons.cases, seasons.variants * 2); assert.equal(seasons.drawn, seasons.expected);
        console.log('PASS: all seasonal base/extra replacements (' + seasons.cases + ') and actual gacha draw');
    }
    await seed(page);
    for (const theme of ['astra', 'strawberry', 'dreamsky']) {
        await page.evaluate(t => Astra.setTheme(t), theme); await close(page);
        await page.evaluate(() => RPG.openCardPoolEditor('extras'));
        if (!baseline) {
            const sorted = await page.evaluate(() => {
                const ids = [...document.querySelectorAll('.card-pool-extra-grid [data-card-id]')].map(n => n.dataset.cardId);
                const snapshot = JSON.stringify(RPG._cardPoolEditorDraft);
                let random = 0; const rng = Math.random; Math.random = () => { random++; return .5; };
                RPG.renderCardPoolEditor(); Math.random = rng;
                return { ids, expected: RPG.sortCardIdsByGrade(ids), unchanged: snapshot === JSON.stringify(RPG._cardPoolEditorDraft), random,
                    headings: [...document.querySelectorAll('.card-pool-grade-heading')].map(n => n.dataset.grade) };
            });
            assert.deepEqual(sorted.ids, sorted.expected); assert.equal(sorted.unchanged, true); assert.equal(sorted.random, 0);
            assert.equal(new Set(sorted.headings).size, sorted.headings.length);
            const filters = await page.evaluate(() => {
                const check = filter => {
                    RPG._cardPoolEditorFilter = filter; RPG.renderCardPoolEditor();
                    const ids = [...document.querySelectorAll('.card-pool-extra-grid [data-card-id]')].map(n => n.dataset.cardId);
                    return JSON.stringify(ids) === JSON.stringify(RPG.sortCardIdsByGrade(ids));
                };
                const ok = ['selected', 'base', 'all'].every(check);
                const cards = [{ id: 'z', name: '가', grade: 'rare' }, { id: 'a', name: '가', grade: 'rare' }, { id: 'b', name: '나', grade: 'normal' }];
                const before = JSON.stringify(cards);
                return { ok, ties: RPG.sortCardDataByGrade(cards).map(c => c.id), unchanged: before === JSON.stringify(cards) };
            });
            assert.deepEqual(filters, { ok: true, ties: ['a', 'z', 'b'], unchanged: true });
            const search = page.locator('.card-pool-search'); await search.fill('프');
            assert.equal(await search.evaluate(n => n === document.activeElement), true); await search.fill('');
            const ime = await search.evaluate(n => {
                n.focus(); n.value = '푸'; n.setSelectionRange(1, 1);
                n.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
                const during = n.isConnected;
                n.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '푸' }));
                const fresh = document.querySelector('.card-pool-search');
                return { during, value: fresh.value, focused: fresh === document.activeElement, cursor: fresh.selectionStart };
            });
            assert.deepEqual(ime, { during: true, value: '푸', focused: true, cursor: 1 });
            await page.locator('.card-pool-search').fill('');
        }
        await shot(page, theme + '-deck'); await close(page);
        await page.evaluate(() => { RPG.state.mode = 'origin'; RPG.openWordbook(); });
        if (!baseline) { await contrast(page.locator('.wordbook-word,.wordbook-meaning,.wordbook-wrong-badge,.wordbook-help,#modal-wordbook label')); assert.equal(await page.locator('.wordbook-wrong-badge').count(), 1); }
        await shot(page, theme + '-words');
        if (!baseline) {
            const empty = await page.evaluate(() => { RPG.state.wrongWords = []; document.getElementById('wordbook-filter-wrong').checked = true; RPG.openWordbook(); return document.querySelector('.wordbook-empty')?.textContent; });
            assert.equal(empty, '표시할 단어가 없습니다.');
            await page.evaluate(() => { document.getElementById('wordbook-filter-wrong').checked = false; RPG.openCollocationBook(); });
            await contrast(page.locator('.wordbook-word,.wordbook-meaning,.wordbook-wrong-badge'));
            assert.equal(await page.locator('.wordbook-wrong-badge').count(), 1);
        }
        await close(page); await seed(page);
        await page.evaluate(isBaseline => {
            RPG.startBattleInit(); const p = RPG.battle.players[0]; const all = GameUtils.getAllCards();
            p.skills = ['phy', 'mag', 'sup'].map(type => structuredClone(all.flatMap(c => c.skills).find(s => s.type === type)));
            p.buffs = isBaseline ? { guard: 3 } : { guard: 1, damage_half: 3 }; p.guardDamageReduction = .75; p.guardEnhancedTurns = 1;
            p.mp = 10; RPG.setupControls(p); RPG.renderBattlefield();
        }, baseline);
        if (!baseline) {
            await contrast(page.locator('#battle-controls .skill-name,#battle-controls .skill-cost'));
            assert.equal(await page.locator('#battle-controls .skill-btn svg').count(), 0);
            const types = await page.locator('#battle-controls .skill-btn').evaluateAll(ns => ns.map(n => ({ type: n.dataset.skillType, art: getComputedStyle(n, '::after').backgroundImage, opacity: getComputedStyle(n).opacity })));
            assert.deepEqual(types.map(t => t.type), ['phy', 'phy', 'mag', 'sup']); assert.equal(new Set(types.map(t => t.art)).size, 3);
            assert.ok(types.every(t => t.art.includes('data:image/svg+xml') && t.opacity === '1'));
            await page.evaluate(() => RPG.showBattleStat('player', 0));
            assert.match(await page.locator('#modal-info').innerText(), /피해 75% 감소/); assert.match(await page.locator('#modal-info').innerText(), /마법/); await close(page);
        }
        if (!baseline) {
            const fallback = await page.locator('#p-img').evaluate(img => ({ marked: img.dataset.fallback, src: img.src, expected: Astra.fallback(img._astraEntity) }));
            assert.equal(fallback.marked, 'true'); assert.equal(fallback.src, fallback.expected, 'Fallback must follow the active theme after repeated render');
        }
        await shot(page, theme + '-battle'); await close(page);
        await page.evaluate(() => { RPG.openPrivateTutoring(); document.getElementById('tutoring-content').textContent = '오늘 배운 단어를 문장으로 연결해 보자. '.repeat(40); });
        await shot(page, theme + '-tutoring'); await close(page);
        await page.evaluate(async () => { RPG.ensureApiKey = () => 'local-fixture'; GameAPI.getDateContent = async () => '오늘은 작은 구름 아래에서 함께 걸었어.\nLet us take a walk together.\n'.repeat(20); await RPG.startDate(); });
        await shot(page, theme + '-date'); await close(page);
        if (!baseline) await page.evaluate(() => { ModeRecords.update({ modeId: 'origin', gameType: 'endless', reachedStage: 42 }); RPG.toMenu(); RPG.showRecords(); });
        else await page.evaluate(() => { RPG.saveRecord(42); RPG.showRecords(); });
        await shot(page, theme + '-records'); await close(page);
    }
    if (!baseline) {
        for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
            await page.setViewportSize(viewport);
            for (const theme of ['astra', 'strawberry', 'dreamsky']) {
                await page.evaluate(t => Astra.setTheme(t), theme);
                for (const modal of ['modal-date', 'modal-tutoring']) {
                    await close(page); await page.evaluate(id => document.getElementById(id).classList.add('active'), modal);
                    const portrait = await page.locator('#' + modal + ' .lumi-modal-portrait').boundingBox();
                    assert.ok(Math.abs(portrait.width / portrait.height - .6) < .01, 'Lumi 3:5: ' + viewport.width + '/' + theme);
                    const content = page.locator('#' + modal + ' .modal-scroll'); assert.ok((await content.boundingBox()).height > 50, 'Body remains scrollable'); await contrast(content);
                    for (const btn of await page.locator('#' + modal + ' button:visible').all()) {
                        const b = await btn.boundingBox(); assert.ok(b.y >= 0 && b.y + b.height <= viewport.height + 1, 'Accessible controls: ' + modal + '/' + viewport.width);
                    }
                    const art = await page.locator('#' + modal + ' .lumi-modal-portrait').evaluate(n => getComputedStyle(n, '::after').backgroundImage);
                    assert.equal(art.includes('data:image/svg+xml'), theme === 'strawberry'); await shot(page, theme + '-' + modal + '-' + viewport.width);
                }
                await close(page); await seed(page); await page.evaluate(() => RPG.startBattleInit());
                for (const button of await page.locator('#battle-controls .skill-btn').all()) {
                    await button.scrollIntoViewIfNeeded(); const b = await button.boundingBox();
                    assert.ok(b.y >= 0 && b.y + b.height <= viewport.height + 1, 'Battle controls: ' + viewport.width + '/' + theme);
                }
                await contrast(page.locator('#battle-controls .skill-name,#battle-controls .skill-cost'));
                await page.evaluate(() => RPG.openWordbook());
                assert.equal(await page.locator('#modal-wordbook .modal-content').evaluate(n => n.scrollWidth <= n.clientWidth), true, 'Wordbook horizontal overflow');
                await close(page); await page.evaluate(() => RPG.openCardPoolEditor('extras'));
                assert.equal(await page.locator('#card-pool-editor-body').evaluate(n => n.scrollWidth <= n.clientWidth), true, 'Deck editor overflow');
                await close(page);
            }
        }
        await close(page); await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { RPG.tempGameType = 'endless'; RPG.openModeSelect(); }); await page.locator('#mode-btn-artifact').click();
        assert.match(await page.locator('#mode-desc').innerText(), /최고 도달: 10 스테이지/);
        await close(page); await seed(page); await page.evaluate(() => RPG.startBattleInit());
        const action = await page.evaluate(() => {
            const p = RPG.battle.players[0]; p.mp = 100; RPG.battle.phase = 'player-ready';
            p.skills = [{ name: 'fixture support', type: 'sup', tier: 1, cost: 20, effects: [{ type: 'buff', id: 'damage_half', duration: 3 }] }]; RPG.setupControls(p);
            const original = BattleRuntime.TurnManager.endPlayerTurn; BattleRuntime.TurnManager.endPlayerTurn = () => { RPG.battle.phase = 'enemy-pending'; };
            let calls = 0; const execute = RPG.executeSkill; RPG.executeSkill = function (...args) { calls++; return execute.apply(this, args); };
            document.querySelector('#battle-controls .sup .skill-name').click(); document.querySelector('#battle-controls .sup .skill-cost').click();
            RPG.executeSkill = execute; BattleRuntime.TurnManager.endPlayerTurn = original;
            return { calls, mp: p.mp, half: p.buffs.damage_half };
        });
        assert.deepEqual(action, { calls: 1, mp: 80, half: 3 }); assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    }
    console.log('PASS: ' + (baseline ? 'baseline captures' : 'offline release, themes, contrast, sort, Lumi, records, backups and single-action controls'));
} finally { await browser.close(); }
