const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'starward-experience-'));
const url = pathToFileURL(path.resolve(__dirname, '../defense/dist-local/HeroCoreDefense.html')).href;
const state = page => page.evaluate(() => __heroDefenseV2Debug.getState().battle?.snapshot);
const click = (page, action) => page.locator('[data-action="' + action + '"]').click();
async function boardPoint(page, point) {
  return page.evaluate(({x, y}) => {
    const layout = __heroDefenseV2Debug.getState().battle.layout;
    const bounds = document.querySelector('#battle-canvas').getBoundingClientRect();
    const view = layout.landscape ? {x:12-y,y:x} : {x,y};
    return {x:bounds.x+layout.boardRect.x+view.x/12*layout.boardRect.width,
      y:bounds.y+layout.boardRect.y+view.y/12*layout.boardRect.height};
  }, point);
}
async function assertFits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
    document.documentElement.scrollHeight <= innerHeight+1), true, 'document overflows viewport');
}
async function finishWave(page) {
  for(let i=0;i<90;i++){
    const snapshot = await state(page);
    if(!snapshot || snapshot.phase !== 'WAVE_RUNNING') break;
    await page.evaluate(() => __heroDefenseV2Debug.stepTicks(600));
  }
  await page.waitForTimeout(180);
}
async function grow(page) {
  let snapshot = await state(page);
  while(snapshot.crystals > 0 && snapshot.heroes.some(h=>h.level<6)) {
    const hero = [...snapshot.heroes].filter(h=>h.level<6).sort((a,b)=>a.level-b.level)[0];
    await page.locator('[data-grow-hero="' + hero.id + '"]').click();
    if([3,5].includes(hero.level)) {
      await page.locator('[data-level-trait]').first().click();
    }
    const next = await state(page);
    assert.equal(next.heroes.find(h=>h.id===hero.id).level,hero.level+1);
    snapshot = next;
  }
}
(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    for(const difficulty of ['easy','normal']) {
      const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
      const page=await context.newPage(), errors=[], network=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
      await page.goto(url);
      await page.waitForFunction(()=>Boolean(globalThis.__heroDefenseV2Debug));
      await page.locator('[data-difficulty="'+difficulty+'"]').click();
      await click(page,'formation');
      await page.locator('[data-hero-id="cinderella"] [data-action="select"]').click();
      await click(page,'ready');
      await page.waitForTimeout(500);
      await assertFits(page);
      const before=await state(page);
      assert.equal(before.difficultyId,difficulty);
      const cell=before.stage.placementCells[0];
      const dest=await boardPoint(page,{x:cell.x+.5,y:cell.y+.5});
      const card=await page.locator('[data-hero-card="cinderella"]').boundingBox();
      await page.mouse.move(card.x+card.width/2,card.y+card.height/2);
      await page.mouse.down();
      await page.mouse.move(dest.x,dest.y,{steps:12});
      await page.mouse.up();
      const placed=(await state(page)).heroes.find(h=>h.id==='cinderella');
      assert.equal(placed.placed,true,'drag did not place hero');
      assert.deepEqual({x:placed.x,y:placed.y},cell);
      await click(page,'auto-place');
      await click(page,'start-wave');
      await click(page,'settings');
      assert.equal((await state(page)).paused,true);
      await click(page,'close-settings');
      assert.equal((await state(page)).paused,false);
      await click(page,'pause');
      const paused=await state(page);
      await page.waitForTimeout(250);
      assert.deepEqual((await state(page)).enemies,paused.enemies);
      await click(page,'resume');
      await page.waitForFunction(()=>__heroDefenseV2Debug.getState().battle.snapshot.enemies.length>2);
      await click(page,'starfall');
      const enemy=(await state(page)).enemies[0];
      const aim=await boardPoint(page,{x:enemy.x,y:enemy.y});
      await page.mouse.click(aim.x,aim.y);
      assert.equal((await state(page)).starfallReady,false,'targeted spell not consumed');
      for(let wave=1;wave<=10;wave++) {
        await finishWave(page);
        if(wave===10)break;
        assert.equal((await state(page)).phase,'INTERMISSION');
        await page.locator('[data-growth]:not([hidden])').waitFor();
        await grow(page);
        if(wave===3){
          await page.screenshot({path:path.join(output,difficulty+'-growth.png')});
          const saved=await state(page);
          await page.reload();
          await page.locator('[data-action="continue"]').waitFor();
          await click(page,'continue');
          const restored=await state(page);
          assert.equal(restored.nextWave,saved.nextWave);
          assert.equal(restored.difficultyId,difficulty);
          assert.deepEqual(restored.heroes.map(h=>[h.id,h.level,h.selectedTraits,h.stats]),
            saved.heroes.map(h=>[h.id,h.level,h.selectedTraits,h.stats]));
        }
        await click(page,'growth-next');
      }
      await page.locator('[data-screen="result"]').waitFor();
      assert.match(await page.locator('[data-screen="result"]').innerText(),/우리의 별을 지켜냈어요/);
      await page.screenshot({path:path.join(output,difficulty+'-result.png')});
      await click(page,'stages');
      assert.match(await page.locator('.journey-title').innerText(),/수호 완료/);
      await page.reload();
      if(difficulty==='normal') await page.locator('[data-difficulty="normal"]').click();
      assert.match(await page.locator('.journey-title').innerText(),/수호 완료/);
      assert.deepEqual(errors,[]);
      assert.deepEqual(network,[]);
      console.log('Offline 10-wave '+difficulty+': drag, spell, pause, growth, traits, resume, victory and medals passed');
      await context.close();
    }
    const page=await browser.newPage({viewport:{width:320,height:568}});
    await page.goto(url);
    await page.waitForFunction(()=>Boolean(globalThis.__heroDefenseV2Debug));
    await assertFits(page);
    await click(page,'formation');
    await assertFits(page);
    await click(page,'ready');
    await assertFits(page);
    await page.screenshot({path:path.join(output,'small-phone.png')});
    await page.close();
    console.log('Experience evidence: '+output);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
