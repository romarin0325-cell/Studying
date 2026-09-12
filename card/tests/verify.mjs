import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'test-results');
await fs.mkdir(output, {recursive:true});
const htmlPath = path.join(root, 'dist/DREAMWEAVER.html');
const html = await fs.readFile(htmlPath, 'utf8');
assert.equal(/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis/.test(html), false, 'The distribution must not depend on external JS/CSS/fonts');
const original = await fs.readFile(path.join(root, 'game/index.html'), 'utf8');
const originalIds = [...original.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]);
const bundleIds = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]));
assert.deepEqual(originalIds.filter(id => !bundleIds.has(id)), [], 'All legacy DOM contracts must survive the new shell');
const browser = await chromium.launch({headless:true});
const errors = [];
const results = [];
async function newPage(viewport, offline = true) {
  const context = await browser.newContext({viewport, reducedMotion:'reduce', offline});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(htmlPath).href, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => Astra.ready && RPG._featuresInstalled);
  return page;
}
async function shot(page, name) { await page.screenshot({path:path.join(output, `${name}.png`)}); }
async function fits(page, selector, requireVisible = true) {
  const geometry = await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:el.scrollWidth,client:el.clientWidth};
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.width + 1, `${selector} horizontal viewport: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.scroll <= geometry.client + 1, `${selector} horizontal overflow: ${JSON.stringify(geometry)}`);
  if (requireVisible) assert.ok(geometry.top >= -1 && geometry.bottom <= geometry.height + 1, `${selector} vertical viewport: ${JSON.stringify(geometry)}`);
}
async function seed(page) {
  await page.evaluate(() => {
    RPG.loadGlobalData();
    Object.assign(RPG.state,{mode:'origin',gameType:'endless',tickets:20,enemyScale:0,
      deck:['marshmallow','kobold','golem'],inventory:['marshmallow','kobold','golem','marshmallow','luna','deep_lord'],
      quiz_stats:{correct:7,total:9}});
    document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active'));
    RPG.toMenu();
  });
}

try {
  const mobile = await newPage({width:390,height:844});
  assert.deepEqual(await mobile.evaluate(() => RPG.getMissingRequiredData().map(item => item.name)), []);
  assert.equal(await mobile.locator('#btn-start-new').isEnabled(), true);
  const ids = await mobile.evaluate(() => [...document.querySelectorAll('[id]')].map(el => el.id));
  assert.equal(ids.length, new Set(ids).size, 'Duplicate runtime IDs');
  await shot(mobile,'title-390');

  // Exercise real new-game UI, both confirmations, draw, selection and save/load.
  await mobile.locator('#btn-start-load').click();
  await mobile.locator('[onclick="RPG.selectGameType(\'endless\')"]').click();
  await mobile.locator('#mode-btn-origin').click();
  assert.equal(await mobile.locator('#mode-btn-origin').getAttribute('aria-pressed'),'true');
  await shot(mobile,'mode-390');
  await mobile.locator('#btn-enter-mode').click();
  await mobile.locator('#confirm-yes').click();
  await mobile.waitForFunction(() => document.getElementById('confirm-msg').textContent.includes('정말'));
  await mobile.locator('#confirm-yes').click();
  await mobile.locator('#modal-info button').click();
  assert.equal(await mobile.locator('#screen-menu').getAttribute('class'),'screen active');
  assert.equal(await mobile.locator('#astra-depart').isEnabled(),false);
  const tickets = await mobile.evaluate(() => RPG.state.tickets);
  await mobile.locator('#btn-normal-gacha').click();
  assert.equal(await mobile.evaluate(() => RPG.state.inventory.length),1);
  assert.equal(await mobile.evaluate(() => RPG.state.tickets),tickets - 1);
  await mobile.locator('#modal-gacha button').click();
  await mobile.locator('[data-nav=deck]').click();
  await mobile.locator('#slot-0').click();
  await mobile.locator('#deck-card-list .card-item').click();
  assert.equal(await mobile.evaluate(() => RPG.state.deck[0] === RPG.state.inventory[0]),true);
  await mobile.locator('[onclick="RPG.confirmDeck()"]:visible').click();
  assert.equal(await mobile.locator('#astra-depart').isEnabled(),true);
  const save = await mobile.evaluate(() => { RPG.saveGame(false); return localStorage.getItem(Storage.keys.SAVE); });
  await mobile.reload();
  await mobile.waitForFunction(() => Astra.ready);
  await mobile.locator('#btn-start-load').click();
  await mobile.locator('#modal-info button').click();
  assert.equal(await mobile.evaluate(() => localStorage.getItem(Storage.keys.SAVE)),save);
  assert.equal(await mobile.locator('#astra-depart').isEnabled(),true);
  results.push('Offline file:// boot, real new game, draw, deck selection and save/reload');

  await seed(mobile);
  await mobile.locator('[data-nav=collection]').click();
  assert.equal(await mobile.locator('#collection-grid .card-item').count(),5);
  await mobile.locator('#card-search').fill('루나');
  assert.equal(await mobile.locator('#collection-grid .card-item').count(),1);
  await mobile.locator('#collection-grid .card-item').click();
  assert.equal(await mobile.locator('#md-name').textContent(),'루나');
  await mobile.keyboard.press('Escape');
  await mobile.locator('#card-search').fill('');
  await mobile.locator('#grade-picker-open').click();
  await mobile.locator('[data-grade-choice=normal]').click();
  assert.ok(await mobile.locator('#collection-grid .card-item').count() > 0);
  await mobile.locator('#collection-scope').click();
  assert.ok(await mobile.locator('#collection-grid .card-item').count() > 3);
  const categoryIds = await mobile.evaluate(() => {
    const cards = [CARDS[0],BONUS_CARDS[0],TRANSCENDENCE_CARDS[0],SPECIAL_CARDS[0]].filter(Boolean);
    RPG.state.inventory = cards.map(card => card.id);
    Astra.allCards = false;
    document.getElementById('card-search').value = '';
    document.getElementById('card-grade').value = 'all';
    Astra.renderCollection();
    return cards.map(card => card.id);
  });
  const ownedCategoryIds = await mobile.locator('#collection-grid .card-item').evaluateAll(items => items.map(item => item.dataset.cardId));
  assert.deepEqual(new Set(ownedCategoryIds),new Set(categoryIds));
  await mobile.locator('#collection-scope').click();
  const allCategoryIds = new Set(await mobile.locator('#collection-grid .card-item').evaluateAll(items => items.map(item => item.dataset.cardId)));
  for (const id of categoryIds) assert.equal(allCategoryIds.has(id),true,`${id} must remain visible in the full collection`);
  await mobile.locator('#card-search').fill('no-matching-card');
  assert.equal(await mobile.locator('#collection-empty').isVisible(),true);
  results.push('Collection search, all/owned filter, real normal grade and detail dialog');

  await mobile.locator('[data-nav=study]').click();
  await mobile.locator('[onclick="RPG.openMagicClass()"]:visible').click();
  assert.equal(await mobile.locator('#lecture-list button').count(),await mobile.evaluate(() => GRAMMAR_DATA.length));
  await mobile.locator('#lecture-list button').first().click();
  assert.equal(await mobile.locator('#lecture-content').innerText(),await mobile.evaluate(() => GRAMMAR_DATA[0].content));
  await shot(mobile,'lecture-390');
  await mobile.keyboard.press('Escape');
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('#screen-study').isVisible(),true);
  await mobile.evaluate(() => {
    const show = QuizEngine.show.bind(QuizEngine);
    QuizEngine.show = config => { window.testAnswer = config.answer; return show(config); };
    RPG.toMenu();
  });
  await mobile.locator('#btn-challenge-gacha').click();
  const answer = await mobile.evaluate(() => window.testAnswer);
  await shot(mobile,'quiz-390');
  await mobile.locator('#modal-quiz').getByRole('button',{name:answer,exact:true}).click();
  await mobile.locator('#modal-gacha.active').waitFor();
  await mobile.locator('#modal-gacha button').click();
  results.push('Grammar content parity, nested dialog return, vocabulary quiz and reward');

  // Explicit missing-image and local-folder loading paths. Fixture is test-only.
  const tinyPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1kAAAAASUVORK5CYII=','base64');
  await mobile.evaluate(() => { RPG.state.inventory=['luna']; RPG.openCollection(); Astra.allCards=false; document.getElementById('card-search').value=''; document.getElementById('card-grade').value='all'; Astra.renderCollection(); });
  await mobile.waitForFunction(() => document.querySelector('#collection-grid img')?.dataset.fallback === 'true');
  await mobile.evaluate(bytes => {
    Astra.selectPortraitFiles([new File([new Uint8Array(bytes)], '루나.png', {type:'image/png'})]);
  }, [...tinyPNG]);
  await mobile.waitForFunction(() => { const img=document.querySelector('[data-card-id=luna] img'); return img?.naturalWidth === 1 && !img.dataset.fallback; });
  assert.equal(await mobile.evaluate(() => Astra.setPortraitPath('https://external.example/')),false);
  results.push('Missing-portrait emblems, local file selection, external portrait URL rejection');

  await mobile.evaluate(() => {
    const weekly = RPG.ensureWeeklyMissionState();
    weekly.claimed = false;
    Object.values(weekly.missions).forEach(mission => { mission.progress = mission.target; });
    RPG.saveGame(false);
    Storage.setRaw(Storage.keys.FORTUNE_LAST_USED,'2026-09-10');
    Storage.save(Storage.keys.API_KEY,'test-key-not-a-secret');
    Astra.settings();
  });
  const [download] = await Promise.all([mobile.waitForEvent('download'),mobile.locator('[onclick="Astra.exportSave()"]').click()]);
  const downloadPath = await download.path();
  const backup = JSON.parse(await fs.readFile(downloadPath,'utf8'));
  assert.equal(backup.format,'astra-progress');
  assert.equal('cardRpgApiKey' in backup.values,false);
  assert.equal(backup.values.fortuneCookieLastUsedDate,'2026-09-10');
  await mobile.evaluate(() => {
    RPG.global.chaosTickets = 2;
    RPG._globalLoaded = true;
    Storage.save(Storage.keys.GLOBAL,RPG.global);
  });
  backup.values.cardRpgGlobal.chaosTickets = 99;
  await mobile.locator('#astra-import').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await Promise.all([
    mobile.waitForEvent('load'),
    mobile.locator('#confirm-yes').click()
  ]);
  await mobile.waitForFunction(() => Astra.ready);
  assert.equal(await mobile.locator('#screen-title').isVisible(),true);
  assert.match(await mobile.locator('#astra-toast').textContent(),/기록을 가져왔습니다.*초상화/);
  assert.equal(await mobile.evaluate(() => Storage.getRaw(Storage.keys.FORTUNE_LAST_USED)),'2026-09-10');
  await mobile.locator('#btn-title-mission').click();
  await mobile.locator('#mission-hub-list button').filter({hasText:'주간'}).click();
  await mobile.locator('#btn-claim-weekly-mission').click();
  assert.equal(await mobile.evaluate(() => JSON.parse(localStorage.getItem(Storage.keys.GLOBAL)).chaosTickets),102);

  const invalidPayloads = [
    {format:'astra-progress',version:1,values:{cardRpgSave:null}},
    {format:'astra-progress',version:1,values:{cardRpgSave:false}},
    {format:'astra-progress',version:1,values:{cardRpgSave:0}},
    {format:'astra-progress',version:1,values:{cardRpgGlobal:{}}},
    {format:'astra-progress',version:1,values:{cardRpgGlobal:{unlocked_bonus_cards:false,unlocked_modes:[],achievements:{}}}},
    {format:'astra-progress',version:99,values:{}}
  ];
  for (const payload of invalidPayloads) {
    const result = await mobile.evaluate(async payload => {
      document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active'));
      const keys = Astra.backupKeys();
      const before = Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)]));
      await Astra.importFile(new File([JSON.stringify(payload)],'invalid.json',{type:'application/json'}));
      const after = Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)]));
      return {before,after,notice:document.getElementById('astra-toast').textContent,confirm:document.getElementById('modal-confirm').classList.contains('active')};
    },payload);
    assert.deepEqual(result.after,result.before);
    assert.equal(result.confirm,false);
    assert.match(result.notice,/(기록|버전|여정)/);
  }
  results.push('Atomic backup import, invalid value rejection, reload hydration, credentials excluded and future format rejection');

  for (const viewport of [{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:390,height:667},{width:1440,height:960}]) {
    const page = await newPage(viewport);
    await fits(page,'#screen-title');
    await seed(page);
    await page.waitForFunction(() => [...document.querySelectorAll('#astra-party img')].every(img => img.naturalWidth > 0));
    await fits(page,'#screen-menu');
    const separation = await page.evaluate(() => ({
      layout:document.querySelector('.lobby-layout').getBoundingClientRect().bottom,
      shortcuts:document.querySelector('.lobby-shortcuts').getBoundingClientRect().top
    }));
    assert.ok(separation.shortcuts >= separation.layout,'Lobby shortcuts must not overlap the party');
    if (viewport.height < 740) await page.locator('#astra-depart').scrollIntoViewIfNeeded();
    await fits(page,'#astra-depart');
    await fits(page,'.astra-nav');
    await shot(page,`lobby-${viewport.width}-${viewport.height}`);
    await page.locator('[data-nav=deck]').click();
    await fits(page,'.deck-formation');
    await fits(page,'.deck-confirm');
    assert.equal(await page.locator('#deck-card-list .card-item').evaluateAll(cards => cards.every(card => {
      const name = card.querySelector('.card-meta').getBoundingClientRect();
      return name.bottom <= card.getBoundingClientRect().bottom;
    })),true,'Every card name and count must fit inside its card');
    await shot(page,`deck-${viewport.width}-${viewport.height}`);
    await page.locator('[data-nav=collection]').click();
    await fits(page,'#screen-collection');
    await shot(page,`collection-${viewport.width}-${viewport.height}`);
    await page.locator('[data-nav=study]').click();
    await fits(page,'#screen-study');
    await shot(page,`study-${viewport.width}-${viewport.height}`);
    await page.locator('[data-nav=menu]').click();
    await page.locator('#astra-depart').click();
    await page.waitForFunction(() => document.querySelector('#screen-battle.active') && document.querySelectorAll('#battle-controls .skill-btn').length > 0);
    await fits(page,'#battle-controls');
    await fits(page,'.visual-stage');
    assert.equal(await page.locator('.astra-nav').isVisible(),false);
    await shot(page,`battle-${viewport.width}-${viewport.height}`);
    const before = await page.evaluate(() => ({hp:RPG.battle.enemy.hp,phase:RPG.battle.phase,turn:RPG.battle.turn}));
    await page.locator('#battle-controls .skill-btn').first().click();
    await page.waitForFunction(before => RPG.battle.enemy.hp !== before.hp || RPG.battle.turn !== before.turn || document.querySelector('#modal-quiz.active'),before);
    await page.context().close();
  }
  results.push('360/390/412 mobile, short viewport and desktop geometry; combat action executes');
  assert.deepEqual(errors,[],'Uncaught browser errors');
  console.log(results.map(item => `PASS ${item}`).join('\n'));
  await fs.writeFile(path.join(output,'verification.json'), JSON.stringify({passed:results,errors},null,2));
} finally { await browser.close(); }
