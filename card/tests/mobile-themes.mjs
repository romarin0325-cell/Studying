import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch();
const errors=[];
const path=name=>fileURLToPath(new URL(`../test-results/${name}.png`,import.meta.url));
const url=new URL('../dist/DREAMWEAVER.html',import.meta.url).href;
async function assertContrast(page,textSelector,surfaceSelector) {
 const colors=await page.locator(textSelector).evaluate((el,surface)=>{
  const paint=getComputedStyle(document.querySelector(surface));
  return {text:getComputedStyle(el).color,background:paint.backgroundImage==='none'?paint.backgroundColor:paint.backgroundImage};
 },surfaceSelector);
 const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
 const luminance=value=>rgb(value).slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const paints=colors.background.match(/rgba?\([^)]+\)/g)||[];
 assert.ok(paints.length,`${surfaceSelector} has a measurable background`);
 for(const color of paints) {
  assert.ok((rgb(color)[3]??1)===1,`${surfaceSelector} requires an opaque theme surface`);
  const a=luminance(colors.text),b=luminance(color);
  const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(contrast>=4.5,`${textSelector}: contrast ${contrast.toFixed(2)} against ${color}`);
 }
}
try {
 // Exercise artifact modes explicitly: the artifact button is hidden in origin mode.
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:960},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>Astra.ready);
  const geometry={};
  for(const theme of ['strawberry','dreamsky']) {
   await page.evaluate(theme=>{
    Astra.setTheme(theme);RPG.loadGlobalData();
    Object.assign(RPG.state,{mode:'artifact',gameType:'endless',tickets:20,enemyScale:0,artifacts:[],deck:['marshmallow','kobold','golem'],inventory:['marshmallow','kobold','golem']});RPG.toMenu();
   },theme);
   await assertContrast(page,'.ticket-counter small','.ticket-counter');
   await assertContrast(page,'#ui-tickets','.ticket-counter');
   if(width>760) {
    assert.ok(await page.locator('.route-track').isVisible());
    const route=await page.locator('.route-track i').first().evaluate(el=>({line:getComputedStyle(el).backgroundColor,current:getComputedStyle(el,'::before').backgroundColor,inactive:getComputedStyle(el.nextElementSibling,'::before').backgroundColor}));
    assert.notEqual(route.current,route.inactive,'Current route point remains distinct');
    assert.ok(!route.line.startsWith('rgba'),'Route line is opaque on light panels');
   }
   await page.screenshot({path:path(`contrast-${theme}-lobby-${width}`)});
   await page.locator('#astra-depart').click();
   await page.locator('#btn-battle-artifact-check').waitFor({state:'visible'});
   await assertContrast(page,'#btn-battle-artifact-check','#btn-battle-artifact-check');
   const box=await page.locator('#btn-battle-artifact-check').boundingBox();
   if(theme==='strawberry')geometry.artifact=box;else assert.deepEqual(box,geometry.artifact);
   await page.screenshot({path:path(`contrast-${theme}-artifact-${width}`)});
   await page.locator('#btn-battle-artifact-check').click();
   await page.locator('#modal-artifact-check').waitFor({state:'visible'});
   await page.keyboard.press('Escape');
   await page.evaluate(()=>{RPG.tempGameType='endless';RPG.openModeSelect();});
   await page.locator('#btn-chaos-roulette').waitFor({state:'visible'});
   await assertContrast(page,'#btn-chaos-roulette','#btn-chaos-roulette');
   await page.keyboard.press('Escape');
  }
  await page.close();
 }
 for(const size of [{width:360,height:640},{width:390,height:844},{width:412,height:915}]) {
  const page=await browser.newPage({viewport:size,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>Astra.ready);
  await page.locator('#btn-game-fullscreen').click();
  await page.waitForFunction(()=>!!document.fullscreenElement);
  assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
  await page.locator('#btn-game-fullscreen').click();
  await page.waitForFunction(()=>!document.fullscreenElement);
  const baseline={};
  for(const theme of ['astra','strawberry','dreamsky']) {
   await page.evaluate(()=>RPG.toTitle());
   await page.locator('[aria-label="설정"]').click();
   await page.locator(`[data-theme-choice=${theme}]`).click();
   assert.equal(await page.locator(`[data-theme-choice=${theme}]`).getAttribute('aria-pressed'),'true');
   await page.locator('[onclick="Astra.closeSettings()"]:visible').click();
   const title=await page.locator('.title-copy h1').boundingBox();
   assert.ok(title.y<140,'Title has no empty lead-in');
   assert.equal(await page.locator('.title-word').evaluate(el=>getComputedStyle(el).fontSize),await page.locator('.title-copy h1').evaluate(el=>getComputedStyle(el).fontSize));
   await page.screenshot({path:path(`theme-${theme}-title-${size.width}`)});
   await page.evaluate(()=>{RPG.loadGlobalData();Object.assign(RPG.state,{mode:'origin',gameType:'endless',tickets:20,enemyScale:0,deck:['marshmallow','kobold','golem'],inventory:CARDS.slice(0,18).map(c=>c.id)});RPG.toMenu();});
   await page.locator('[data-nav=deck]').click();
   const visible=await page.locator('#deck-card-list .card-item').evaluateAll(els=>{
    const grid=document.getElementById('deck-card-list').getBoundingClientRect();
    return els.filter(el=>{const r=el.getBoundingClientRect();return r.top>=grid.top-1&&r.bottom<=grid.bottom+1;}).length;
   });
   assert.ok(visible>=6,`${theme} ${size.width}: only ${visible} full deck cards`);
   await page.waitForFunction(()=>document.querySelector('#deck-card-list img')?.dataset.fallback==='true');
   if(theme!=='astra') assert.equal(await page.locator('#deck-card-list img').first().getAttribute('src'),await page.evaluate(theme=>window.DREAMWEAVER_THEME_CARDS[theme],theme));
   const deck=await page.locator('#deck-card-list').boundingBox();
   if(theme==='astra')baseline.deck=deck;else assert.deepEqual(deck,baseline.deck,'Theme must preserve deck geometry');
   await page.screenshot({path:path(`theme-${theme}-deck-${size.width}`)});
   await page.locator('#slot-0').click();
   if(theme!=='astra') assert.equal(await page.locator('#slot-0 small').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)','Selected formation labels remain readable');
   await page.locator('#deck-card-list .card-item').first().click();
   await page.locator('[onclick="RPG.confirmDeck()"]:visible').click();
   await page.locator('[data-nav=collection]').click();
   await page.locator('#grade-picker-open').click();
   await page.screenshot({path:path(`theme-${theme}-grades-${size.width}`)});
   await page.locator('[data-grade-choice=legend]').click();
   assert.equal(await page.locator('#card-grade').inputValue(),'legend');
   await page.locator('#collection-grid .card-item').first().click();
   await page.screenshot({path:path(`theme-${theme}-detail-${size.width}`)});
   const skill=await page.locator('#md-skills p').nth(2).boundingBox();
   const scroll=await page.locator('#modal-card .modal-scroll').boundingBox();
   assert.ok(skill.y+skill.height<=scroll.y+scroll.height,'At least one named skill fits');
   await page.locator('#modal-card button').click();
   await page.locator('[data-nav=study]').click();
   for(const button of await page.locator('#screen-study button').all()) {
    const r=await button.boundingBox();assert.ok(r.y+r.height<size.height-80,'Study menu fits above nav');
   }
   await page.screenshot({path:path(`theme-${theme}-study-${size.width}`)});
   await page.evaluate(()=>{RPG.state.wrongWords=[VOCAB_DATA[0].id];});
   await page.locator('[onclick="RPG.openPrivateTutoring()"]:visible').click();
   await page.screenshot({path:path(`theme-${theme}-tutoring-${size.width}`)});
   await page.locator('[onclick="RPG.closePrivateTutoring()"]:visible').click();
   await page.locator('[onclick="RPG.openLumiQuestion()"]:visible').click();
   await page.screenshot({path:path(`theme-${theme}-chat-${size.width}`)});
   await page.locator('#lumi-chat-close-btn').click();
   await page.locator('[data-nav=menu]').click();await page.locator('#astra-depart').click();
   await page.waitForFunction(()=>document.querySelectorAll('#battle-controls .skill-btn').length>=4);
   const controls=await page.locator('#battle-controls').evaluate(el=>({h:el.clientHeight,scroll:el.scrollHeight}));
   assert.ok(controls.scroll<=controls.h+1,'All combat actions fit without internal scrolling');
   for(const b of await page.locator('#battle-controls .skill-btn').all()) {const r=await b.boundingBox();assert.ok(r.y+r.height<=size.height);}
   const battle=await page.locator('.visual-stage').boundingBox();if(theme==='astra')baseline.battle=battle;else assert.deepEqual(battle,baseline.battle);
   await page.screenshot({path:path(`theme-${theme}-battle-${size.width}`)});
  }
  await page.reload();await page.waitForFunction(()=>Astra.ready);
  assert.equal(await page.locator('body').getAttribute('data-theme'),'dreamsky');
  await page.locator('#btn-title-mission').click();
  const missionColors=await page.locator('#mission-hub-list button').first().evaluate(el=>({button:getComputedStyle(el).color,description:getComputedStyle(el.querySelector('span')).color}));
  assert.equal(missionColors.button,missionColors.description,'Mission descriptions retain contrast in light themes');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{
   const set=TOEIC_DATA.find(set=>set.type==='part6'&&set.questions.length);
   RPG.state.completedToeicSets=TOEIC_DATA.filter(item=>item.id!==set.id).map(item=>item.id);
   RPG.startToeicPractice({ignoreSessionLimit:true,suppressDate:true,countHiddenUnlock:false});
   RPG.showToeicPassage();
  });
  assert.equal(await page.locator('#toeic-passage-scroll').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(222, 240, 250)','TOEIC passage uses the light theme surface');
  await page.reload();await page.waitForFunction(()=>Astra.ready);
  await page.locator('#btn-title-question').click();
  await page.setViewportSize({width:size.width,height:410});
  await page.locator('#lumi-chat-input').fill('키보드 표시 영역 검증');
  const input=await page.locator('#lumi-chat-input').boundingBox();assert.ok(input.y>=0&&input.y+input.height<=410);
  await page.close();
 }
 // A live skin change repaints only missing-image card backs, never selected portraits.
 const artPage=await browser.newPage();
 artPage.on('pageerror',e=>errors.push(e.message));
 await artPage.goto(url);await artPage.waitForFunction(()=>Astra.ready);
 await artPage.evaluate(()=>{RPG.state.inventory=['luna','kobold'];RPG.openCollection();});
 await artPage.waitForFunction(()=>document.querySelectorAll('#collection-grid img[data-fallback=true]').length===2);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1kAAAAASUVORK5CYII=','base64');
 await artPage.evaluate(bytes=>Astra.selectPortraitFiles([new File([new Uint8Array(bytes)],'루나.png',{type:'image/png'})]),[...png]);
 await artPage.waitForFunction(()=>document.querySelector('[data-card-id=luna] img')?.naturalWidth===1 && document.querySelector('[data-card-id=kobold] img')?.dataset.fallback==='true');
 const portrait=await artPage.locator('[data-card-id=luna] img').getAttribute('src');
 for(const theme of ['strawberry','dreamsky','astra']) {
  await artPage.evaluate(theme=>Astra.setTheme(theme),theme);
  assert.equal(await artPage.locator('[data-card-id=luna] img').getAttribute('src'),portrait);
  assert.equal(await artPage.locator('[data-card-id=kobold] img').getAttribute('src'),await artPage.evaluate(()=>Astra.fallback(RPG.getCardData('kobold'))));
 }
 await artPage.close();
 assert.deepEqual(errors,[]);
 console.log('PASS three persistent themes with identical deck/battle geometry, themed card backs preserving local portraits, six visible cards, compact details/study/chat, fullscreen shortcut, themed grade picker and unscrolled combat controls');
}finally{await browser.close();}
