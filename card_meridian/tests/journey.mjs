import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'dist/DREAMWEAVER-Meridian.html');
const output = path.join(root, '../test-results/meridian');
await fs.mkdir(output, {recursive:true});
const html = await fs.readFile(file, 'utf8');
const core = await fs.readFile(path.join(root, '../card/game/index.html'), 'utf8');
const ids = str => new Set([...str.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]));
const present = ids(html);
assert.deepEqual([...ids(core)].filter(id => !present.has(id)), [], 'Shared view contracts');
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
const errors = [];
const remote = [];
async function open(width, height, source = file) {
  const context = await browser.newContext({viewport:{width,height}, reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await context.route(/^https?:/, route => { remote.push(route.request().url()); return route.abort(); });
  await page.goto(pathToFileURL(source).href);
  await page.waitForFunction(() => Meridian.ready && Astra.ready && CardChainChallenge.ready);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function shot(page, name) {
  await page.screenshot({path:path.join(output, name + '.png')});
}
async function reachable(page, selector) {
  const ok = await page.locator(selector).first().evaluate(el => {
    const b = el.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width/2,b.y + b.height/2);
    return b.width > 0 && b.height > 0 && b.x >= -1 && b.y >= -1 &&
      b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && el.contains(hit);
  });
  assert.ok(ok, selector + ' is reachable');
}
async function roster(page) {
  await page.evaluate(() => {
    Object.assign(RPG.state, {mode:'origin',gameType:'endless',enemyScale:0,tickets:12,
      deck:['luna','marshmallow','golem'],inventory:['luna','marshmallow','golem','kobold',...CARDS.slice(0,12).map(c => c.id)]});
    RPG.clearPendingEnemySelection();
    RPG.toMenu();
  });
}
async function strike(page, fastFinish = false) {
  await page.waitForFunction(() => RPG.battle.phase === 'player-ready');
  if (fastFinish) await page.evaluate(() => { RPG.battle.enemy.hp=1; RPG.renderBattlefield(); });
  const buttons = page.locator('#battle-controls .skill-btn:enabled');
  // Use available damaging skills of the current party; never call winBattle.
  const ordinal = await buttons.evaluateAll(nodes => {
    const offensive = nodes.map((node,i) => ({i, type:node.dataset.skillType})).filter(s => ['mag','phy'].includes(s.type));
    return offensive.at(-1)?.i || 0;
  });
  await buttons.nth(fastFinish ? 0 : ordinal).click();
}
try {
  const mobile = await open(390,844);
  const duplicateIds = await mobile.evaluate(() => { const list=[...document.querySelectorAll('[id]')].map(el=>el.id);return list.filter((id,i)=>list.indexOf(id)!==i); });
  assert.deepEqual(duplicateIds,[]);
  await shot(mobile,'title-mobile');
  await mobile.click('#btn-start-load');
  await mobile.waitForSelector('#screen-menu.active');
  assert.equal(await mobile.locator('.modal.active').count(),0);
  assert.equal(await mobile.locator('#astra-depart').getAttribute('data-action'),'summon');
  const before = await mobile.evaluate(() => RPG.state.tickets);
  await mobile.click('#astra-depart');
  await mobile.waitForSelector('#modal-gacha.md-single.active');
  assert.equal(await mobile.evaluate(() => RPG.state.tickets),before-1);
  await shot(mobile,'summon-mobile');
  await mobile.click('#md-equip');
  const first = await mobile.evaluate(() => RPG.state.deck[0]);
  assert.ok(first);
  assert.equal(await mobile.locator('#astra-depart').getAttribute('data-action'),'battle');
  await mobile.reload();
  await mobile.waitForFunction(() => Meridian.ready);
  assert.equal(await mobile.locator('#md-start-label').textContent(),'여정 이어가기');
  await mobile.click('#btn-start-load');
  assert.equal(await mobile.evaluate(() => RPG.state.deck[0]),first);
  assert.equal(await mobile.evaluate(() => RPG.state.tickets),before-1);
  assert.equal(await mobile.locator('.modal.active').count(),0);
  console.log('First visit, explicit ticket debit, direct equip and resume passed');

  await mobile.evaluate(() => { RPG.state.tickets = 1; RPG.toMenu(); });
  await mobile.click('#btn-normal-gacha');
  await mobile.click('#modal-gacha .md-dismiss');
  const normalSummon = mobile.locator('#btn-normal-gacha');
  const quizSummon = mobile.locator('#btn-challenge-gacha');
  assert.ok(await normalSummon.isDisabled() && await quizSummon.isDisabled());
  await mobile.click('[onclick="RPG.openChaosBlessing()"]');
  await mobile.click('#modal-chaos button[onclick*="great_sage"]');
  await mobile.click('#confirm-no');
  const answer = await mobile.evaluate(() => {
    const question = document.getElementById('quiz-question').innerText;
    const options = [...document.querySelectorAll('#quiz-options button')].map(button => button.innerText);
    return GRAMMAR_DATA.flatMap(lecture => lecture.quizzes)
      .find(quiz => quiz.question === question && quiz.options.every(option => options.includes(option))).answer;
  });
  await mobile.locator('#quiz-options').getByRole('button', {name:answer, exact:true}).click();
  await mobile.click('#modal-info.active button');
  assert.equal(await mobile.locator('#ui-tickets').innerText(), '1');
  assert.ok(await normalSummon.isEnabled() && await quizSummon.isEnabled(), 'Blessing ticket unlocks both summons in place');
  await normalSummon.click();
  assert.equal(await mobile.evaluate(() => RPG.state.tickets), 0);
  await mobile.click('#modal-gacha.active .md-dismiss');
  console.log('A sage blessing ticket can be spent immediately in the same lobby');

  await roster(mobile);
  await mobile.waitForFunction(() => [...document.querySelectorAll('.md-party-card img,#next-enemy-img')].every(el=>el.complete && el.naturalWidth));
  await shot(mobile,'lobby-mobile');
  await mobile.click('#md-scout');
  const scoutingHP=await mobile.locator('#info-content dd').first().textContent();
  assert.equal(scoutingHP, await mobile.evaluate(()=>String(buildBattleEnemy(RPG).maxHp)));
  await mobile.keyboard.press('Escape');
  await mobile.click('#btn-normal-gacha');
  const picked = await mobile.evaluate(() => RPG.state.inventory.at(-1));
  await mobile.click('#md-equip');
  await mobile.locator('#md-slot-picker button').nth(1).click();
  assert.equal(await mobile.evaluate(() => RPG.state.deck[1]),picked);
  await mobile.click('[data-nav=deck]');
  await mobile.fill('#ae-deck-search','루나');
  await mobile.click('.ae-deck-entry:visible .ae-card-info');
  await mobile.waitForSelector('#modal-card.active');
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('.ae-card-info:visible').first().evaluate(el=>document.activeElement===el),true);
  await mobile.fill('#ae-deck-search','');
  await shot(mobile,'formation-mobile');
  await mobile.click('#md-confirm-deck');
  await mobile.click('[data-nav=collection]');
  await mobile.click('#ae-tab-book');
  await mobile.fill('#card-search','루나');
  await shot(mobile,'collection-mobile');
  await mobile.click('[data-nav=study]');
  await shot(mobile,'study-mobile');
  await mobile.click('[onclick="RPG.openMagicClass()"]:visible');
  await mobile.locator('#lecture-list button').first().click();
  assert.equal(await mobile.locator('#lecture-content').innerText(),await mobile.evaluate(()=>GRAMMAR_DATA[0].content));
  await mobile.keyboard.press('Escape'); await mobile.keyboard.press('Escape');
  await mobile.click('[data-nav=menu]');
  await roster(mobile);
  await mobile.click('#astra-depart');
  await mobile.waitForFunction(() => RPG.battle.phase === 'player-ready');
  await reachable(mobile,'#battle-controls button:last-child');
  await mobile.click('#md-skill-help');
  assert.equal(await mobile.locator('#info-content .skill-detail').count(),4);
  assert.equal(await mobile.evaluate(()=>RPG.battle.turn),1);
  await mobile.keyboard.press('Escape');
  await shot(mobile,'battle-mobile');
  let turns=0;
  while (!await mobile.locator('#modal-voyage-result.active').count() && turns<28) {
    await strike(mobile);
    await mobile.waitForFunction(() => RPG.battle.phase === 'player-ready' || RPG.battle.isFinished);
    turns++;
  }
  await mobile.waitForSelector('#modal-voyage-result.active');
  assert.equal(await mobile.evaluate(()=>RPG.state.enemyScale),1);
  const earned=await mobile.evaluate(()=>RPG.state.tickets - Meridian.encounter.tickets);
  assert.equal(await mobile.locator('#md-win-tickets').textContent(),'+'+earned+'장');
  const paid=await mobile.evaluate(()=>Storage.loadDetailed(Storage.keys.SAVE).data);
  assert.equal(paid.enemyScale,1);
  assert.equal(paid.tickets,await mobile.evaluate(()=>RPG.state.tickets));
  await shot(mobile,'victory-mobile');
  await mobile.click('#md-win-next');
  assert.equal(await mobile.evaluate(()=>Meridian.encounter.stage),2);
  await strike(mobile,true);
  await mobile.waitForSelector('#modal-voyage-result.active');
  await mobile.click('#md-win-quiz');
  await mobile.waitForSelector('#modal-quiz.active');
  await mobile.locator('#quiz-options button').first().click();
  await mobile.waitForSelector('#screen-menu.active');
  const info=mobile.locator('#modal-info.active button:visible').last();
  if (await info.count()) await info.click();
  assert.equal(await mobile.evaluate(()=>RPG.state.enemyScale),2);
  console.log('Full-party replacement, detail focus, study, natural victory ('+turns+' actions), next fight and bonus quiz passed');

  const desktop=await open(1440,900);
  await shot(desktop,'title-desktop');
  await desktop.click('#btn-start-load');
  await roster(desktop);
  await shot(desktop,'lobby-desktop');
  for (const [width,height] of [[320,568],[360,640],[390,844],[768,800],[1440,900]]) {
    await desktop.setViewportSize({width,height});
    await desktop.evaluate(()=>RPG.toMenu());
    await reachable(desktop,'#astra-depart');
    await reachable(desktop,'#md-party-count');
    const sizes=await desktop.locator('#md-scout .portrait,.md-party-card .portrait').evaluateAll(els=>els.map(el=>{
      const r=el.getBoundingClientRect(); return [r.width,r.height];
    }));
    for(const [w,h] of sizes) assert.ok(Math.abs(w/h-.6)<.025,'3:5 card well at '+width+'px: '+w+'x'+h);
    assert.ok(await desktop.locator('#md-scout .portrait').evaluate(el => {
      const art=el.getBoundingClientRect(), hero=el.closest('.md-route').getBoundingClientRect();
      return art.top >= hero.top + 2 && art.bottom <= hero.bottom - 2;
    }), 'Opponent artwork clears the stage frame at '+width);
    const over=await desktop.evaluate(()=>document.documentElement.scrollWidth>innerWidth || document.querySelector('#screen-menu').scrollWidth>document.querySelector('#screen-menu').clientWidth+1);
    assert.equal(over,false,'No horizontal overflow at '+width);
    await desktop.click('#astra-depart');
    await desktop.waitForFunction(()=>RPG.battle.phase==='player-ready');
    await reachable(desktop,'#battle-controls button:last-child');
    if(width===1440) await shot(desktop,'battle-desktop');
    if(width===360) await shot(desktop,'battle-small');
  }
  const special=await open(390,844);
  await special.click('#btn-start-new');
  await special.click('[onclick="RPG.selectGameType(\'challenge\')"]');
  await special.click('#md-mode-groups [data-group="학습"]');
  await special.click('#mode-btn-puzzle');
  await shot(special,'mode-mobile');
  await special.click('#btn-enter-mode');
  await special.waitForSelector('#screen-menu.active');
  assert.equal(await special.locator('#astra-depart').getAttribute('data-action'),'puzzle');
  await special.click('#astra-depart'); await special.waitForSelector('#modal-quiz.active');
  assert.ok((await special.locator('#modal-quiz').innerText()).includes('퍼즐조각'));
  const modes=await open(360,640);
  await modes.click('#btn-start-load');
  await modes.click('[data-nav=deck]');
  await reachable(modes,'#md-deck-recruit');
  await modes.click('#md-deck-recruit');
  await modes.click('#modal-gacha .md-dismiss');
  await modes.click('#astra-depart');
  assert.equal(await modes.locator('#md-confirm-deck').textContent(),'편성 후 출전');
  await modes.locator('#deck-card-list .card-item').first().click();
  await modes.click('#md-confirm-deck');
  await modes.waitForSelector('#screen-battle.active');
  await modes.reload(); await modes.waitForFunction(()=>Meridian.ready);
  const initialSave=await modes.evaluate(()=>localStorage.getItem(Storage.keys.SAVE));
  await modes.click('#btn-start-new');
  await modes.click('[onclick="RPG.selectGameType(\'challenge\')"]'.replace('challenge','challenge'));
  await modes.click('#md-mode-groups [data-group="파티 빌딩"]');
  await modes.click('#mode-btn-factory'); await modes.click('#btn-enter-mode');
  await modes.click('#confirm-no');
  assert.equal(await modes.evaluate(()=>localStorage.getItem(Storage.keys.SAVE)),initialSave);
  await modes.click('#btn-enter-mode'); await modes.click('#confirm-yes');
  await modes.waitForSelector('#screen-factory-draft.active');
  await modes.click('#factory-select-0');
  await modes.click('[onclick="RPG.openFactoryViewDeck()"]');
  assert.equal(await modes.locator('#collection-grid .card-item').count(),4);
  await modes.click('#collection-back');
  await modes.click('#screen-factory-draft [onclick="RPG.toMenu()"]');
  assert.equal(await modes.locator('#astra-depart').getAttribute('data-action'),'factory');
  await modes.click('#astra-depart');
  assert.equal(await modes.locator('#factory-round-text').textContent(),'2/10 라운드');
  console.log('Empty inventory recovery, formation-to-battle, protected existing save, factory selection and resume passed');
  const paidQuiz=await open(390,844);
  await paidQuiz.click('#btn-start-load');
  const wallet=await paidQuiz.evaluate(()=>RPG.state.tickets);
  await paidQuiz.click('#btn-challenge-gacha');
  const pickAnswer=async (page,correct)=>{
    const index=await page.evaluate(correct=>{
      const word=document.getElementById('quiz-question').textContent;
      const meaning=VOCAB_DATA.find(entry=>entry.word===word).meaning;
      return [...document.querySelectorAll('#quiz-options button')].findIndex(b=>(b.textContent===meaning)===correct);
    },correct);
    assert.ok(index>=0);
    await page.locator('#quiz-options button').nth(index).click();
  };
  await pickAnswer(paidQuiz,false);
  await paidQuiz.waitForSelector('#modal-info.active');
  await paidQuiz.click('#modal-info button');
  assert.deepEqual(await paidQuiz.evaluate(()=>[RPG.state.tickets,RPG.state.inventory.length]),[wallet-1,0]);
  await paidQuiz.click('#cc-chain-gacha');
  await paidQuiz.click('#cc-chain button');
  await pickAnswer(paidQuiz,true);
  await paidQuiz.waitForSelector('#modal-gacha.cc-result-active');
  assert.equal(await paidQuiz.locator('.cc-result-card').count(),1);
  assert.equal(await paidQuiz.locator('#md-pull-actions').isVisible(),false);
  await paidQuiz.click('#modal-gacha .md-dismiss');
  assert.deepEqual(await paidQuiz.evaluate(()=>[RPG.state.tickets,RPG.state.inventory.length]),[wallet-2,1]);
  console.log('Paid quiz failure and stopping a successful chain preserve tickets and the earned card');

  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'meridian-portrait-'));
  const siblingHtml=path.join(temp,'game.html');
  const siblingPng=path.join(temp,'루나.png');
  try {
    await fs.copyFile(file,siblingHtml);
    await sharp({create:{width:30,height:50,channels:3,background:'#adbdb5'}}).png().toFile(siblingPng);
    const art=await open(360,640,siblingHtml);
    const actual=await art.evaluate(async ()=>{
      const load=async entity=>{
        const img=document.createElement('img');
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('Portrait did not settle')),3000);
          img.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});
          ImageAssets.load(img,entity);
        });
        return img;
      };
      const local=await load(RPG.getCardData('luna'));
      const alternate=await load(RPG.getCardData('entropy'));
      const missing=await load('portrait-test-missing.png');
      return [local.src.startsWith('file:'),local.naturalWidth,
        !window.MERIDIAN_PORTRAITS['앤트로피.png'] || alternate.src===window.MERIDIAN_PORTRAITS['앤트로피.png'],
        missing.dataset.fallback];
    });
    assert.deepEqual(actual,[true,30,true,'true']);
    await art.context().close();
  } finally {
    await fs.unlink(siblingPng).catch(()=>{});
    await fs.unlink(siblingHtml).catch(()=>{});
    await fs.rmdir(temp);
  }
  console.log('Adjacent originals, renamed card art and missing-image fallback passed');
  for(const theme of ['dreamsky','strawberry','astra']) {
    await desktop.evaluate(theme=>{ RPG.toMenu(); Astra.setTheme(theme); },theme);
    await reachable(desktop,'#astra-depart');
  }
  assert.deepEqual(errors,[]); assert.deepEqual(remote,[]);
  console.log('Responsive controls at five sizes, theme switches and puzzle prerequisites passed; no runtime errors or remote requests');
} finally { await browser.close(); }
