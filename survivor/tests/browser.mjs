import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {Game} from '../src/engine.js';
import {HEROES,WEAPON,LIMITS} from '../src/content.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'test-results');await fs.mkdir(output,{recursive:true});
const artifact=path.join(root,'dist/AstraNocturne.html'),html=await fs.readFile(artifact,'utf8');
assert.equal(html.includes('__NOCTURNE_TEST__'),false,'production must have no test controls');
assert.ok(Buffer.byteLength(html)<6*1024*1024,'single-file mobile payload budget');
const browser=await chromium.launch({headless:true});const errors=[],requests=[];
const pageFor=async(viewport)=>{const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,offline:true});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());return {page,context};};
const noOverflow=async(page)=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflows horizontally');
const start=async(page,url)=>{await page.goto(url);await page.locator('[data-action="start"]').waitFor();await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.fonts.check('17px Nocturne','별빛 정원')),true,'embedded Korean font loads');};
const proof=async(page,name)=>{await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});};
try{
  // These checks boot the actual committed artifact, without instrumentation.
  for(const [width,height] of [[390,844],[360,640],[320,568],[844,390],[1280,900]]){
    const {page,context}=await pageFor({width,height});await start(page,pathToFileURL(artifact).href);await noOverflow(page);
    assert.equal(await page.locator('.hero-pick').count(),9);for(const id of ['jasmine','cinderella','silver_rabbit']){await page.locator(`[data-action="select-hero"][data-value="${id}"]`).click();assert.equal(await page.locator(`[data-action="select-hero"][data-value="${id}"]`).getAttribute('aria-pressed'),'true');}
    await proof(page,`home-${width}x${height}`);
    await page.locator('[data-action="tab"][data-value="library"]').click();await page.locator('[data-action="detail"][data-value="rumi"]').click();assert.match(await page.locator('.dialog-content').textContent(),/맨발/);await page.keyboard.press('Escape');assert.equal(await page.locator('[role="dialog"]').count(),0);
    await page.locator('[data-action="library-tab"][data-value="weapons"]').click();await page.locator('[data-action="detail"][data-value="star"]').click();assert.match(await page.locator('.dialog-content').textContent(),/천 갈래 프리즘/);await page.locator('[data-action="close"]').first().click();
    await page.locator('[data-action="tab"][data-value="home"]').click();await page.locator('[data-action="start"]').click();await page.locator('#battle-canvas').waitFor();await page.waitForTimeout(100);
    const begin=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')).player);
    const box=await page.locator('#battle-canvas').boundingBox(),session=await context.newCDPSession(page);const x=Math.round(box.x+box.width*.35),y=Math.round(box.y+box.height*.6);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+65,y:y-20,id:1}]});await page.waitForTimeout(350);
    assert.equal(await page.locator('#joystick').evaluate(el=>el.classList.contains('active')),true);
    const dash=await page.locator('[data-action="dash"]').boundingBox();await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x+65,y:y-20,id:1},{x:Math.round(dash.x+dash.width/2),y:Math.round(dash.y+dash.height/2),id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:Math.round(dash.x+dash.width/2),y:Math.round(dash.y+dash.height/2),id:2}]});await page.waitForTimeout(80);assert.equal(await page.locator('#joystick').evaluate(el=>el.classList.contains('active')),true,'second finger must preserve movement');
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.locator('#joystick').evaluate(el=>el.classList.contains('active')),false);
    await page.locator('[data-action="pause"]').click();const moved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')).player);assert.ok(Math.hypot(moved.x-begin.x,moved.y-begin.y)>15,'real touch movement');
    await page.locator('[data-action="leave"]').click();assert.equal(await page.locator('[data-action="resume"]').count(),1);await page.locator('[data-action="resume"]').click();await page.locator('[data-action="pause"]').click();const resumed=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')).player);assert.ok(Math.hypot(resumed.x-moved.x,resumed.y-moved.y)<5,'resume preserves position');await proof(page,`pause-${width}x${height}`);await noOverflow(page);await page.locator('[data-action="unpause"]').click();await page.keyboard.down('ArrowLeft');await page.waitForTimeout(220);await page.keyboard.up('ArrowLeft');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.locator('[data-action="unpause"]').waitFor();const keyboardMoved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')));assert.ok(keyboardMoved.player.x<resumed.x-15,'keyboard movement');assert.equal(keyboardMoved.mode,'paused','window blur safely pauses and saves');await page.reload();await page.locator('[data-action="resume"]').waitFor();await page.locator('[data-action="resume"]').click();await page.locator('#battle-canvas').waitFor();await context.close();
    console.log(`PASS actual offline artifact ${width}x${height}: touch, multi-touch, codex, pause, resume`);
  }
  // A temporary copy exposes App only for endgame/rare-state browser fixtures.
  // Assets, CSS, actual engine/UI source and release controls remain identical.
  const bundled=await build({entryPoints:[path.join(root,'src/app.js')],bundle:true,write:false,format:'iife',target:['es2020'],minify:true,charset:'utf8',plugins:[{name:'test-only-app-reference',setup(b){b.onLoad({filter:/survivor\/src\/app\.js$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('const app=new App();','const app=new App();globalThis.__NOCTURNE_TEST__=app;'),loader:'js'}));}}]});
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'nocturne-browser-'));const testFile=path.join(temp,'game.html');const scriptStart=html.lastIndexOf('<script>'),scriptEnd=html.lastIndexOf('</script>');await fs.writeFile(testFile,html.slice(0,scriptStart+8)+bundled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+html.slice(scriptEnd));
  const {page,context}=await pageFor({width:390,height:844});await start(page,pathToFileURL(testFile).href);
  await page.locator('[data-action="start"]').click();
  await page.evaluate(()=>{const app=globalThis.__NOCTURNE_TEST__;app.game.gainXP(80);});await page.locator('[data-action="choice"]').first().waitFor();await proof(page,'level-choice');
  const time=await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.time);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.time),time,'choice freezes combat');
  const rolls=await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.rerolls);await page.locator('[data-action="reroll"]').click();assert.equal(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.rerolls),rolls-1);
  await page.locator('[data-action="banish-menu"]').click();await page.locator('[data-action="banish"]:not([disabled])').first().click();assert.equal(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.banishes),1);
  for(let i=0;i<10&&await page.locator('[data-action="choice"]').count();i++)await page.locator('[data-action="choice"]').first().click();
  const snapshot=new Game({hero:'snow_rabbit',seed:10}).snapshot();snapshot.time=210;snapshot.level=23;snapshot.player.charge=100;snapshot.player.x=760;snapshot.player.y=730;
  snapshot.weapons=[['frost',6],['ember',5],['dream',4],['storm',5],['sun',4],['flower',5]].map(([id,level])=>({id,level,evolved:false,timer:.01,damage:1000}));snapshot.relics=[{id:'frost',level:2},{id:'seed',level:2},{id:'ember',level:2},{id:'lantern',level:1}];
  const g=Game.restore(snapshot);for(let i=0;i<65;i++){const a=i*Math.PI*2/65,d=110+(i%5)*24;g.spawnEnemy(i%7===0?'beetle':i%11===0?'moth':'wisp',{x:g.player.x+Math.cos(a)*d,y:g.player.y+Math.sin(a)*d,hp:220,maxHp:220});}g.spawnEnemy('boss',{x:g.player.x+100,y:g.player.y-200,hp:4500,maxHp:4500,name:'밤의 파수꾼'});g.bossesSpawned=1;
  await page.evaluate(data=>{const app=globalThis.__NOCTURNE_TEST__;const restored=app.game.constructor.restore(data);app.launch(restored);},g.snapshot());await page.waitForTimeout(300);await proof(page,'mobile-horde');await page.locator('[data-action="skill"]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.skilled),1);await proof(page,'frozen-world');
  await page.evaluate(()=>{const a=globalThis.__NOCTURNE_TEST__;a.game.mode='playing';a.game.weapons[0].level=6;a.game.openTreasure();});await page.locator('[data-action="claim-treasure"]').waitFor();await proof(page,'evolution-treasure');await page.locator('[data-action="claim-treasure"]').click();assert.equal(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.weapons[0].evolved),true);
  await page.locator('[data-action="pause"]').click();await page.locator('[data-action="settings"]').click();await page.locator('[data-action="toggle"][data-value="effects"]').click();assert.equal(await page.locator('[data-value="effects"]').getAttribute('aria-checked'),'false');await page.locator('[data-action="close"]').first().click();await page.locator('[data-action="unpause"]').click();await page.keyboard.press('Shift');assert.ok(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.dashes)>0);
  // Finish through a real damage event, including the final boss / chest race.
  await page.evaluate(()=>{const a=globalThis.__NOCTURNE_TEST__,g=a.game;g.mode='playing';g.pending=0;g.options=[];const boss=g.spawnEnemy('boss',{x:g.player.x,y:g.player.y,hp:1,maxHp:1,final:true,name:'마지막 그림자'});g.hit(boss,10000,'frost');});await page.locator('[data-action="result-home"]').waitFor();await proof(page,'victory-result');const crystals=await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.profile.crystals);assert.ok(crystals>0);assert.equal(await page.evaluate(()=>localStorage.getItem('astra.nocturne.run.v1')),null);
  await page.locator('[data-action="result-home"]').click();await page.locator('[data-action="tab"][data-value="growth"]').click();const before=await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.profile.crystals);await page.locator('[data-action="buy-meta"][data-value="power"]').click();assert.equal(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.profile.meta.power),1);assert.ok(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.profile.crystals)<before);await proof(page,'memories');await page.locator('[data-action="tab"][data-value="records"]').click();await proof(page,'journal');
  // Every hero, cardinal direction and skill is exercised by the actual renderer.
  for(const h of HEROES){const run=new Game({hero:h.id,seed:14});run.player.charge=100;run.spawnEnemy('beetle',{x:840,y:820,hp:5000,maxHp:5000,damage:0});await page.evaluate(data=>{const a=globalThis.__NOCTURNE_TEST__;if(!a.game)a.launch();a.launch(a.game.constructor.restore(data));},run.snapshot());assert.equal(await page.evaluate(()=>globalThis.__NOCTURNE_TEST__.game.hero),h.id);
    await page.evaluate(()=>{const a=globalThis.__NOCTURNE_TEST__;a.game.castSkill();a.game.player.facing=0;});await page.waitForTimeout(60);await proof(page,'hero-'+h.id);for(const direction of [1,2,3])await page.evaluate(dir=>{const a=globalThis.__NOCTURNE_TEST__;a.game.player.facing=dir;a.renderer.render(a.game,1/60);},direction);
  }
  const work=await page.evaluate(()=>{
    const a=globalThis.__NOCTURNE_TEST__,g=new a.game.constructor({seed:78});
    for(const id of ['blade','ember','flower','frost','storm'])g.applyOption({type:'weapon',id});for(const w of g.weapons){w.level=6;w.evolved=true;}
    for(let i=0;i<260;i++){const angle=i*Math.PI*2/260,r=90+(i%8)*24;g.spawnEnemy(i%4===0?'beetle':i%4===1?'moth':i%4===2?'stalker':'wisp',{x:800+Math.cos(angle)*r,y:800+Math.sin(angle)*r,hp:100000,maxHp:100000,damage:0,speed:1});}
    const renderer=a.renderer,settings=renderer.settings;renderer.settings={...settings,effects:true,numbers:true};const start=performance.now();
    for(let frame=0;frame<90;frame++){g.step(1/60);renderer.events(g.drainEvents());renderer.render(g,1/60);}
    const meanWorkMs=(performance.now()-start)/90;renderer.settings=settings;
    return{frames:90,meanWorkMs:+meanWorkMs.toFixed(2),enemies:g.enemies.length,shots:g.shots.length,fields:g.fields.length,hazards:g.hazards.length};
  });
  assert.equal(work.enemies,LIMITS.enemies);for(const key of ['shots','fields','hazards'])assert.ok(work[key]<=LIMITS[key]);assert.ok(Number.isFinite(work.meanWorkMs));
  await fs.writeFile(path.join(output,'render-work.json'),JSON.stringify(work,null,2)+'\n');console.log('PASS crowded renderer work sample (cloud CPU, not phone FPS): '+JSON.stringify(work));
  // Storage denial / corrupted run still allow a new expedition.
  const denied=await browser.newContext({viewport:{width:360,height:640},offline:true});await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked storage');}}));const deniedPage=await denied.newPage();deniedPage.on('pageerror',e=>errors.push(e.message));await start(deniedPage,pathToFileURL(artifact).href);await deniedPage.locator('[data-action="start"]').click();await deniedPage.locator('#battle-canvas').waitFor();await deniedPage.locator('[data-action="pause"]').click();await deniedPage.locator('[data-action="leave"]').click();await denied.close();
  await context.close();await fs.rm(temp,{recursive:true,force:true});assert.deepEqual(requests,[],'release must not request external resources');assert.deepEqual(errors,[],'runtime errors');
  console.log('PASS rare states: choice, reroll, banish, crowded combat, skill, evolution, reward, growth, all guardians, blocked storage');
}finally{await browser.close();}
