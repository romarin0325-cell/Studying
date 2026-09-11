import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const url = new URL('../dist/DREAMWEAVER.html',import.meta.url).href;
const shot = name => fileURLToPath(new URL(`../test-results/${name}.png`,import.meta.url));
const browser = await chromium.launch({headless:true});
const errors=[];
const names=['隠すな、最後まで','泡より先に','風だけ知ってる','何回目、まだ','放課後、心臓はメロンソーダ','早口で好き','ミュート、してある','さきにいくもんみないでよ','生クリーム、まだ泡立ててる','終電には間に合った','おすわりは犬のほう','ホットミルク、何杯目？','ドライヤー、まだ'];
try {
  for (const size of [{width:360,height:800},{width:390,height:844},{width:412,height:915},{width:390,height:667}]) {
    const page=await browser.newPage({viewport:size});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(()=>Astra.ready);
    assert.equal(await page.title(),'DREAMWEAVER — Card RPG');
    assert.equal(await page.locator('.title-copy h1').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:shot(`dream-title-${size.width}-${size.height}`)});
    await page.locator('#btn-title-question').click();
    const controls=await page.locator('.lumi-chat-controls button').evaluateAll(els=>els.map(el=>({top:el.getBoundingClientRect().top,right:el.getBoundingClientRect().right,scroll:el.scrollWidth,width:el.clientWidth})));
    assert.ok(controls.every(el=>Math.abs(el.top-controls[0].top)<2 && el.right<=size.width && el.scroll<=el.width+1),JSON.stringify(controls));
    await page.screenshot({path:shot(`dream-question-${size.width}-${size.height}`)});
    await page.locator('#lumi-chat-close-btn').click();
    await page.locator('#btn-title-music').click();
    const library=await page.locator('#music-track-list').boundingBox();
    assert.ok(library.height>=size.height*.30,`Music library too small: ${library.height}/${size.height}`);
    const tracks=await page.evaluate(()=>CARD_MUSIC_TRACKS.map(t=>({id:t.id,src:t.src})));
    for(const name of names) assert.equal(tracks.filter(t=>t.id===`${name}.mp3`&&t.src===`${name}.mp3`).length,1);
    await page.screenshot({path:shot(`dream-music-${size.width}-${size.height}`)});
    await page.locator('.music-close-button').click();
    await page.evaluate(()=>{RPG.loadGlobalData();Object.assign(RPG.state,{mode:'origin',gameType:'endless',tickets:20,enemyScale:0,deck:['marshmallow','kobold','golem'],inventory:['marshmallow','kobold','golem']});RPG.toMenu();});
    await page.locator('#astra-depart').click();
    await page.waitForFunction(()=>document.querySelectorAll('#battle-controls .skill-btn').length>0);
    const log=await page.locator('#battle-log').boundingBox();
    const portrait=await page.locator('.battle-actor .portrait').first().boundingBox();
    assert.ok(log.height>=110 || size.height<680&&log.height>=85);
    assert.ok(portrait.height<=140);
    await page.screenshot({path:shot(`dream-battle-${size.width}-${size.height}`)});
    await page.evaluate(()=>{RPG.toMenu();window.originalGrade=GameUtils.resolveGachaGrade;});
    for(const grade of ['epic','legend','normal']) {
      await page.evaluate(grade=>{GameUtils.resolveGachaGrade=()=>grade;RPG.runGacha(false);},grade);
      assert.equal(await page.locator('#gacha-result').getAttribute('data-grade'),grade);
      const motion=await page.locator('#gacha-result>.portrait').evaluate(el=>getComputedStyle(el).animationName);
      assert.equal(motion.includes('dream-reveal'),grade!=='normal');
      await page.locator('#gacha-result>.portrait').evaluate(async el=>{await Promise.all(el.getAnimations().map(animation=>animation.finished));});
      await page.screenshot({path:shot(`dream-summon-${grade}-${size.width}-${size.height}`)});
      await page.locator('#modal-gacha button').click();
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{GameUtils.resolveGachaGrade=()=> 'legend';RPG.runGacha(false);});
    assert.equal(await page.locator('#gacha-result>.portrait').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.notEqual(await page.locator('#gacha-result>.portrait').evaluate(el=>getComputedStyle(el).boxShadow),'none');
    await page.evaluate(()=>{GameUtils.resolveGachaGrade=window.originalGrade;});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS DREAMWEAVER mobile title, single-row chat controls, music density and 13 tracks, combat log space, rarity reveals and reset');
} finally {await browser.close();}
