import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch();
const url=new URL('../dist/DREAMWEAVER.html',import.meta.url).href;
const shot=name=>fileURLToPath(new URL(`../test-results/polish-${name}.png`,import.meta.url));
const errors=[];
async function readable(locator) {
 const samples=await locator.evaluateAll(els=>els.map(el=>{
  const rgb=color=>color.match(/[\d.]+/g).map(Number);
  const over=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*(fg[3]??1)+bg[i]*(1-(fg[3]??1)));
  const backgrounds=node=>{
   if(!node)return [[255,255,255]];
   const css=getComputedStyle(node),solid=rgb(css.backgroundColor);
   const base=solid[3]===0?backgrounds(node.parentElement):(solid[3]??1)===1?[solid]:backgrounds(node.parentElement).map(bg=>over(solid,bg));
   if(!css.backgroundImage.includes('linear-gradient'))return base;
   return (css.backgroundImage.match(/rgba?\([^)]+\)/g)||[]).flatMap(color=>base.map(bg=>over(rgb(color),bg)));
  };
  return {text:rgb(getComputedStyle(el).color),paint:backgrounds(el)};
 }));
 assert.ok(samples.length,'Text sample is present');
 const luminance=color=>color.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 for(const {text,paint} of samples) for(const bg of paint) {
  const a=luminance(text),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(ratio>=4.5,`${await locator.first().textContent()}: ${text} on ${bg}, contrast=${ratio.toFixed(2)}`);
 }
}
try {
 for(const size of [{width:360,height:640},{width:390,height:844}]) {
  const page=await browser.newPage({viewport:size,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>Astra.ready);
  for(const theme of ['astra','strawberry','dreamsky']) {
   await page.evaluate(theme=>{
    Astra.setTheme(theme);RPG.loadGlobalData();
    const representatives=[...new Map(GameUtils.getAllCards().map(c=>[c.grade,c])).values()];
    Object.assign(RPG.state,{mode:'origin',gameType:'endless',tickets:30,enemyScale:0,artifacts:[],deck:['marshmallow','kobold','golem'],inventory:representatives.map(c=>c.id),wrongWords:[VOCAB_DATA[0].id]});RPG.toMenu();
   },theme);
   await readable(page.locator('#astra-depart'));
   await page.locator('[aria-label="설정"]').click();
   assert.equal(await page.locator('[data-theme-choice=strawberry]').textContent(),'마법소녀');
   const lines=await page.locator('.settings-grid .menu-btn').evaluateAll(els=>els.map(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;}));
   assert.ok(lines.every(n=>n===1),`Menu buttons wrap: ${lines}`);
   await readable(page.locator('.settings-grid .menu-btn'));
   await readable(page.locator('.theme-choices button[aria-pressed="true"],#modal-astra-settings .primary'));
   await page.locator('[onclick="Astra.closeSettings()"]:visible').click();
   await page.locator('[data-nav=deck]').click();
   const deckCard=await page.locator('#deck-card-list .card-item').first().boundingBox();
   const deckPortrait=await page.locator('#deck-card-list .portrait').first().boundingBox();
   await page.locator('[data-nav=collection]').click();
   const collectionCard=await page.locator('#collection-grid .card-item').first().boundingBox();
   const collectionPortrait=await page.locator('#collection-grid .portrait').first().boundingBox();
   assert.equal(collectionCard.width,deckCard.width);assert.equal(collectionCard.height,deckCard.height,'Both catalog destinations share one card size');
   assert.equal(collectionPortrait.height,deckPortrait.height);
   assert.ok(Math.abs(collectionPortrait.width/collectionPortrait.height-.6)<.01,'Catalog portrait is 3:5');
   assert.ok((await page.locator('#collection-grid .portrait').first().boundingBox()).height>=104);
   const accents=await page.locator('#collection-grid .card-item').evaluateAll(els=>els.map(el=>getComputedStyle(el).borderTopColor));
   assert.equal(new Set(accents).size,accents.length,'Every actual grade has its own border color');
   assert.equal(await page.locator('#collection-grid .card-grade').count(),0,'No overlaid grade labels');
   await readable(page.locator('#collection-grid .card-meta'));
   assert.ok(await page.locator('#collection-grid .card-meta').evaluateAll(els=>els.every(el=>{const card=el.closest('.card-item').getBoundingClientRect(),r=el.getBoundingClientRect();return r.left-card.left>=8&&card.right-r.right>=8&&card.bottom-r.bottom>=7&&parseFloat(getComputedStyle(el).fontSize)>=11;})),'Metadata stays inside the frame safe area');
   await page.screenshot({path:shot(`${theme}-collection-${size.width}`)});
   await page.locator('#collection-grid .card-item').first().click();
   const detailPortrait=await page.locator('#modal-card .portrait').boundingBox();
   assert.ok(detailPortrait.height>=170);assert.ok(Math.abs(detailPortrait.width/detailPortrait.height-.6)<.01);
   await readable(page.locator('#md-grade'));
   await page.screenshot({path:shot(`${theme}-detail-${size.width}`)});
   await page.keyboard.press('Escape');
   // A real 3:5 image request through the local portrait adapter, with edge markers to expose cropping.
   await page.evaluate(()=>{
    const id=document.querySelector('#collection-grid .card-item').dataset.cardId,card=RPG.getCardData(id);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#d7e8ed"/><path d="M0 5H300M0 495H300M5 0V500M295 0V500" stroke="#517487" stroke-width="10"/><circle cx="150" cy="130" r="60" fill="#90aab8"/><path d="M60 425V280a90 90 0 0 1 180 0v145Z" fill="#90aab8"/><text x="150" y="468" font-size="24" text-anchor="middle" fill="#263f4a">3:5 TEST IMAGE</text></svg>';
    Astra.localPortraits.set((card.imageFile||`${card.name}.png`).normalize('NFC'),URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})));Astra.renderCollection();
   });
   await page.waitForFunction(()=>document.querySelector('#collection-grid img').naturalHeight===500);
   const imageFit=await page.locator('#collection-grid img').first().evaluate(el=>({width:el.clientWidth,height:el.clientHeight,fit:getComputedStyle(el).objectFit}));
   assert.ok(Math.abs(imageFit.width/imageFit.height-.6)<.02);assert.equal(imageFit.fit,'contain');
   await page.screenshot({path:shot(`${theme}-portrait-fit-${size.width}`)});
   await page.evaluate(()=>{
    RPG.state.mode='artifact_reserve';RPG.battle={players:[],enemy:null};
    RPG.state.artifactReservePool=ARTIFACT_LIST.slice(0,12).map(a=>({id:a.id,remainingUses:2}));RPG.state.artifacts=[];RPG.openArtifactCheck();
   });
   assert.equal(await page.locator('#artifact-check-list .reserve-option').count(),12);
   await page.locator('#artifact-check-list .reserve-option').first().click();
   assert.equal(await page.locator('#artifact-check-list .reserve-option[aria-pressed=true]').count(),1);
   await readable(page.locator('.reserve-option b,.reserve-option-state,.reserve-option-desc'));
   assert.ok(await page.locator('.reserve-option').evaluateAll(els=>els.every(el=>{const box=el.getBoundingClientRect();return [...el.querySelectorAll('b,span')].every(node=>{const r=node.getBoundingClientRect();return r.left-box.left>=12&&box.right-r.right>=12;});})),'Artifact text stays away from the decorative border');
   await page.screenshot({path:shot(`${theme}-reserve-${size.width}`)});
   await page.keyboard.press('Escape');
   await page.evaluate(()=>{RPG.state.mode='origin';RPG.state.artifacts=[];});
   await page.locator('[data-nav=study]').click();
   await page.locator('[onclick="RPG.openMagicClass()"]:visible').click();
   await page.locator('#lecture-list button').first().click();
   const lecture=await page.locator('#modal-lecture-view .lumi-modal-portrait').boundingBox();
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');
   await page.locator('[onclick="RPG.openPrivateTutoring()"]:visible').click();
   const tutoring=await page.locator('#modal-tutoring .lumi-modal-portrait').boundingBox();
   assert.equal(tutoring.height,lecture.height);assert.ok(tutoring.height>=133);
   assert.ok((await page.locator('#tutoring-content').boundingBox()).height>=170);
   await page.screenshot({path:shot(`${theme}-tutoring-${size.width}`)});
   await page.locator('[onclick="RPG.closePrivateTutoring()"]:visible').click();
   // Real date entry with an explicit local API fixture; no account or network required.
   await page.evaluate(async()=>{
    RPG.ensureApiKey=()=> 'test-only';GameAPI.getDateContent=async()=> '오늘의 산책은 작은 구름 아래에서 시작했어.\nLet us take a walk together.';
    await RPG.startDate();
   });
   const date=await page.locator('#modal-date .lumi-modal-portrait').boundingBox();
   assert.equal(date.height,lecture.height);
   await readable(page.locator('#date-content'));
   await page.screenshot({path:shot(`${theme}-date-${size.width}`)});
   await page.evaluate(()=>document.getElementById('modal-date').classList.remove('active'));
   await page.locator('[data-nav=menu]').click();await page.locator('#astra-depart').click();
   await page.evaluate(()=>{RPG.battle.players[RPG.battle.currentPlayerIdx].buffs={};RPG.battle.enemy.buffs={};RPG.renderBattlefield();});
   const emptyPositions=await page.locator('.battle-actor .portrait').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
   await page.evaluate(()=>{const many={weak:2,corrosion:3,burn:3,darkness:1,silence:1,stun:1,evasion:1,guard:1,barrier:1,magic_guard:1,curse:2,divine:2};RPG.battle.players[RPG.battle.currentPlayerIdx].buffs={...many};RPG.battle.enemy.buffs={...many};RPG.renderBattlefield();});
   const crowdedPositions=await page.locator('.battle-actor .portrait').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
   assert.deepEqual(crowdedPositions,emptyPositions,'Accumulating statuses never shifts either portrait');
   await page.screenshot({path:shot(`${theme}-crowded-statuses-${size.width}`)});
   await page.locator('#enemy-actor-box').click();
   assert.doesNotMatch(await page.locator('#modal-info').innerText(),/치명타율|회피율/,'Enemy details omit rates that combat does not use');
   await page.keyboard.press('Escape');
   await page.evaluate(()=>{
    const p=RPG.battle.players[RPG.battle.currentPlayerIdx];p.buffs={weak:1,evasion:1,corrosion:2};
    RPG.battle.enemy.buffs={silence:1,burn:3,evasion:1};RPG.battle.fieldBuffs=[{name:'moon_bless',duration:3}];RPG.renderBattlefield();
   });
   await readable(page.locator('.status-positive'));await readable(page.locator('.status-negative'));await readable(page.locator('.field-buffs'));
   assert.match(await page.locator('#p-buffs').innerText(),/− 약화/);assert.doesNotMatch(await page.locator('#p-buffs').innerText(),/약화 1/);assert.match(await page.locator('#p-buffs').innerText(),/\+/);
   for(const button of await page.locator('#battle-controls .skill-btn').all()) {const r=await button.boundingBox();assert.ok(r.y+r.height<=size.height,'All skills stay visible with status badges');}
   await page.screenshot({path:shot(`${theme}-statuses-${size.width}`)});
   await page.locator('#player-actor-box').click();
   assert.match(await page.locator('#modal-info').innerText(),/치명타율/);
   for(const kind of ['up','down','neutral']) await readable(page.locator(`.stat-${kind}`));
   await page.screenshot({path:shot(`${theme}-stats-${size.width}`)});
   await page.keyboard.press('Escape');
   await page.evaluate(()=>{RPG.toMenu();window.originalGachaGrade=GameUtils.resolveGachaGrade;});
   for(const grade of ['normal','epic','legend']) {
    await page.evaluate(grade=>{GameUtils.resolveGachaGrade=()=>grade;RPG.runGacha(false);},grade);
    assert.equal(await page.locator('.summon-seal').count(),grade==='normal'?0:1);
    if(grade!=='normal') {assert.equal(await page.locator('.summon-rarity').count(),0);assert.equal(await page.locator('.summon-particles').isVisible(),false);}
    await page.locator('#modal-gacha button').click();
   }
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>{GameUtils.resolveGachaGrade=()=> 'legend';RPG.runGacha(false);});
   assert.equal(await page.locator('.summon-particles i').count(),12);
   await page.locator('#gacha-result').evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=750;}));
   await page.screenshot({path:shot(`${theme}-summon-${size.width}`)});
   await page.locator('#modal-gacha button').click();
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.evaluate(()=>{GameUtils.resolveGachaGrade=window.originalGachaGrade;});
   await page.evaluate(()=>{RPG.global.chaosTickets=1;RPG.global.pendingTranscendenceCards=[];RPG.spinChaosRoulette();});
   assert.equal(await page.locator('.summon-seal').count(),1);
   assert.equal(await page.locator('.summon-rarity').count(),0);
   await page.locator('#modal-gacha button').click();
   for(const scene of ['weekly','monthly','blessing','music']) {
    await page.evaluate(scene=>({weekly:()=>RPG.openWeeklyMission(),monthly:()=>RPG.openMonthlyMission(),blessing:()=>RPG.openChaosBlessing(),music:()=>MusicPlayer.open()})[scene](),scene);
    const selectors={weekly:'.mission-item-title:visible,.mission-item-progress:visible,#weekly-mission-reward-name',monthly:'.mission-item-title:visible,.mission-item-progress:visible,#monthly-mission-reward-name',blessing:'.chaos-desc,.chaos-uses',music:'#music-current-time,#music-duration,#music-rate-1,#music-mode-all'};
    await readable(page.locator(selectors[scene]));
    await page.evaluate(()=>document.querySelectorAll('.modal.active').forEach(el=>el.classList.remove('active')));
   }
   for(const answer of ['yes','no']) {
    await page.evaluate(()=>QuizEngine.show({question:'A readable question',desc:'A readable hint',options:['yes','no'],answer:'yes',correctDelay:500,wrongDelay:500}));
    await readable(page.locator('#quiz-question,#quiz-desc'));
    await page.locator('#quiz-options button').filter({hasText:new RegExp(`^${answer}$`)}).click();
    await readable(page.locator('#quiz-feedback'));
    await page.waitForFunction(()=>!document.getElementById('modal-quiz').classList.contains('active'));
   }
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS readable status badges/stats, distinct grade colors, larger collection/tutoring/date portraits, single-line settings and themed summons with reduced motion');
}finally{await browser.close();}
