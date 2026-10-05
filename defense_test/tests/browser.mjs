import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
import {createProfile,command,SAVE_KEY} from '../src/profile.js';
import {HEROES} from '../src/content.js';
import {createBattle,autoPlay} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
import {MEMORIAL_STORIES} from '../src/memorial.js';
const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(game,'test-results'),url=pathToFileURL(path.join(game,'dist/StarGardenDefense.html')).href;
const isWebkit=process.argv.includes('--webkit'),name=isWebkit?'webkit':'chromium',NOW=Date.now();
await fs.mkdir(output,{recursive:true});
// Verify the release file in Git as well as the freshly built file. The first
// local creation has no HEAD blob; CI and every committed release must have it.
let committed=null;
try{committed=execFileSync('git',['show','HEAD:defense_test/dist/StarGardenDefense.html'],{cwd:path.dirname(game),encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','ignore']});}
catch(error){if(process.env.CI)throw error;}
if(committed!==null){
  const built=await fs.readFile(path.join(game,'dist/StarGardenDefense.html'),'utf8'),normalize=s=>s.replace(/\r\n/g,'\n');
  assert.ok(normalize(built)===normalize(committed),'committed artifact differs from its deployment inputs');
}
const browser=await (isWebkit?webkit:chromium).launch({headless:true});
const errors=[],requests=[],geometry=[],contexts=[];
async function boot(width,height,profile=createProfile(NOW),fault=false,location=url){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});
  contexts.push(context);const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  if(profile)await page.addInitScript(({key,profile})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(profile));},{key:SAVE_KEY,profile});
  if(fault)await page.addInitScript(rewardOnly=>{window.__failRewardCheckpoint=rewardOnly;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){let phase='';try{const saved=JSON.parse(v);phase=saved.active?.run?JSON.parse(saved.active.run).phase:'';}catch{}if(window.__testQuotaFailure||window.__failRewardCheckpoint&&phase==='reward')throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};},fault==='reward');
  if(fault==='avif')await page.addInitScript(()=>{const decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){return /\.avif$/.test(this.src)?Promise.reject(new DOMException('Unsupported codec','EncodingError')):decode.call(this);};});
  await page.addInitScript(()=>{window.__memorialAssignments=[];const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){if(String(value).startsWith('data:image/avif')||String(value).includes('/memorial/'))window.__memorialAssignments.push(String(value).slice(0,80));descriptor.set.call(this,value);}});});
  await page.goto(location);await context.setOffline(true);await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);
  return {context,page,width,height};
}
const profile=page=>page.evaluate(()=>window.STAR_GARDEN.profile);
const close=page=>page.getByRole('button',{name:'닫기',exact:true}).click();
const nav=(page,label)=>page.getByRole('button',{name:label,exact:true}).click();
async function shot(page,label,width,height){
  await page.screenshot({path:path.join(output,`${name}-${label}-${width}x${height}.png`),animations:'disabled'});
  const m=await page.evaluate(()=>{
    const c=document.getElementById('content'),n=document.getElementById('navigation'),s=document.getElementById('sheet');
    const bounds=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const images=[...document.images].filter(i=>i.offsetParent!==null);
    return {viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth,contentWidth:c.clientWidth,contentScrollWidth:c.scrollWidth,nav:bounds(n),sheet:bounds(s),loaded:images.every(i=>i.complete&&i.naturalWidth>0)};
  });
  assert.ok(m.documentWidth<=width+1,label+' document clipping');
  assert.ok(m.contentScrollWidth<=m.contentWidth+1,label+' content clipping');
  assert.equal(m.loaded,true,label+' missing image');
  if(await page.locator('#navigation').isVisible())assert.ok(m.nav.bottom<=height+1&&m.nav.width>=300);
  if(await page.locator('#overlay').isVisible())assert.ok(m.sheet.bottom<=height+1&&m.sheet.x>=-1&&m.sheet.right<=width+1);
  geometry.push({label,...m});
}
async function reload({page,context}){
  // WebKit's offline navigation also blocks local files. HTTP is still denied.
  if(isWebkit)await context.setOffline(false);
  await page.reload();if(isWebkit)await context.setOffline(true);await page.locator('.scene-partner').waitFor();
}
function traitFixture(deck,placements,{wave=3,gold=24}={}){
  const p=createProfile(NOW);p.settings.auto=false;
  for(const h of HEROES)p.heroes[h.id].owned=true;
  p.deck=[...deck];assert.ok(command(p,'begin',{mode:'main',stage:1},NOW).ok);
  const s=createBattle(p),template={...s.board.find(Boolean)};s.board.fill(null);s.wave=wave;s.gold=gold;
  for(const [i,hero,rank=1,birthWave=wave] of placements)s.board[i]={...template,uid:s.nextId++,hero,rank,birthWave,priority:E.targetingLocked(hero)?'random':'first',cooldown:99};
  s.queue=[{kind:'boss',hp:1e8}];s.spawnIn=0;E.step(s,.05);
  s.enemies[0].progress=E.PATH_LENGTH*.76;s.enemies[0].speed=0;s.enemies[0].skillIn=99;s.gauge=120;
  E.personalTrait(s,s.board.find(u=>u?.hero==='time_ruler')||s.board.find(Boolean));
  p.active.run=E.serialize(s);assert.ok(E.restore(p.active.run),'trait fixture is a valid saved battle');return p;
}
async function inspectCell(page,index){
  await page.locator('#arena').scrollIntoViewIfNeeded();const rect=await page.locator('#arena').boundingBox(),at=E.cellPoint(index);
  await page.mouse.click(rect.x+at.x/720*rect.width,rect.y+at.y/780*rect.height);
  await page.locator('#unit-panel').waitFor();await page.locator('#unit-panel').scrollIntoViewIfNeeded();
}
try{
  for(const [width,height] of [[320,568],[390,844],[1280,900]]){
    const memories=createProfile(NOW);for(const h of HEROES){memories.heroes[h.id].owned=true;memories.heroes[h.id].bond=10;}memories.heroes.star_boy.bond=9;
    const m=await boot(width,height,memories);assert.equal(await m.page.evaluate(()=>window.__memorialAssignments.length),0,'no memory decode at boot');
    await m.page.locator('.bond-button').click();assert.match(await m.page.locator('.memory-locked').innerText(),/호감도 10/);assert.equal(await m.page.evaluate(()=>window.__memorialAssignments.length),0,'locked preview uses collection portrait');await shot(m.page,'memorial-locked',width,height);
    await m.page.locator('[data-action="memorial-album"]').click();assert.equal(await m.page.locator('.memory-list [data-memorial]').count(),30);await shot(m.page,'memorial-album',width,height);
    await m.page.locator('.memory-list [data-memorial="zeke"]').click();await m.page.locator('#memory-art img').waitFor();assert.equal(await m.page.locator('img[data-memorial]').count(),1);assert.equal(await m.page.evaluate(()=>window.__memorialAssignments.length),1);assert.match(await m.page.locator('.memory-title h3').innerText(),new RegExp(MEMORIAL_STORIES.zeke.title));await shot(m.page,'memorial-reader',width,height);
    await m.page.locator('[data-memory-step="1"]').click();assert.equal((await profile(m.page)).memories.zeke.page,1);await close(m.page);assert.equal(await m.page.locator('img[data-memorial]').count(),0);await nav(m.page,'동료');await m.page.locator('[data-hero="zeke"]').click();await m.page.locator('.memory-entry').click();await m.page.locator('#memory-art img').waitFor();assert.equal(await m.page.locator('#memory-progress').innerText(),`${Math.round(2/MEMORIAL_STORIES.zeke.paragraphs.length*100)}% 읽음`);
    await m.page.locator('[data-action="memorial-art"]').click();assert.equal(await m.page.locator('#memory-narrative').isVisible(),false);await shot(m.page,'memorial-art',width,height);await close(m.page);
    if(width===390){
      // Open and close all thirty real pictures through buttons, never hidden preload.
      const unlocked=structuredClone(memories);unlocked.heroes.star_boy.bond=10;const chain=await boot(390,844,unlocked);
      await chain.page.locator('.bond-button').click();await chain.page.locator('#memory-art img').waitFor();await chain.page.locator('[data-action="memorial-album"]').click();
      for(const h of HEROES){await chain.page.locator(`.memory-list [data-memorial="${h.id}"]`).click();await chain.page.locator('#memory-art img').waitFor();assert.equal(await chain.page.locator('img[data-memorial]').count(),1);await chain.page.locator('[data-action="memorial-album"]').click();assert.equal(await chain.page.locator('img[data-memorial]').count(),0);}
      await chain.page.locator('.memory-list [data-memorial="zeke"]').click();await close(chain.page);await chain.page.waitForTimeout(120);assert.equal(await chain.page.locator('img[data-memorial]').count(),0,'closing a pending decode cannot resurrect an image');await chain.context.close();
    }
    await m.context.close();
  }
  const ready=createProfile(NOW);ready.settings.auto=false;command(ready,'begin',{mode:'main',stage:1},NOW);const completed=createBattle(ready);
  let finalTick=null;for(let i=0;i<5000&&completed.phase==='combat';i++){const before=E.serialize(completed);E.step(completed,.05);if(completed.phase==='reward')finalTick=E.restore(before);if(i%6===0&&completed.phase==='combat')autoPlay(completed);}assert.equal(completed.phase,'reward');assert.ok(finalTick);ready.active.run=E.serialize(completed);
  const transition=structuredClone(ready);transition.active.run=E.serialize(finalTick);
  const blocked=await boot(390,844,transition,'reward');await blocked.page.locator('[data-action="resume"]').click();await blocked.page.waitForFunction(()=>window.STAR_GARDEN.performance.saveFailures>0);assert.equal(await blocked.page.locator('[data-reward]').count(),0);assert.equal(await blocked.page.evaluate(()=>window.STAR_GARDEN.battle.phase),'reward');
  await blocked.page.evaluate(()=>window.__failRewardCheckpoint=false);await blocked.page.locator('[data-action="pause"]').click();await blocked.page.locator('[data-reward]').first().waitFor();await shot(blocked.page,'reward-restored',390,844);await blocked.page.locator('[data-reward]').first().click();await blocked.page.waitForFunction(()=>window.STAR_GARDEN.battle.phase!=='reward');await blocked.context.close();
  const automated=structuredClone(ready);automated.settings.auto=true;const manual=await boot(390,844,automated);await manual.page.locator('[data-action="resume"]').click();await manual.page.locator('[data-action="auto"]').click();await manual.page.locator('[data-reward]').first().waitFor();assert.equal((await profile(manual.page)).settings.auto,false);await shot(manual.page,'reward-auto-to-manual',390,844);await manual.page.locator('[data-reward]').first().click();await manual.context.close();

  execFileSync(process.execPath,['defense_test/scripts/build.mjs','--solo'],{cwd:path.dirname(game),stdio:'pipe'});
  execFileSync(process.execPath,['defense_test/scripts/build.mjs','--web'],{cwd:path.dirname(game),stdio:'pipe'});
  const single=await boot(390,844,null,false,pathToFileURL(path.join(game,'test-results/solo/StarGardenDefenseSolo.html')).href);
  assert.equal((await profile(single.page)).deck.length,1);await single.page.locator('[data-action="team"]').click();assert.equal(await single.page.locator('#sheet .five-line .team-slot').count(),1);await single.page.locator('[data-team-pick="star_boy"]').first().click();await single.page.locator('.choose-list [data-team-pick="snow_rabbit"]').click();await single.page.locator('[data-action="save-team"]').click();assert.deepEqual((await profile(single.page)).deck,['snow_rabbit']);
  await single.page.locator('[data-action="prepare"]').click();await single.page.locator('[data-begin="main"]').click();await single.page.locator('#arena').waitFor();assert.equal(await single.page.locator('[data-skill]').count(),1);await single.page.locator('[data-action="summon-battle"]').click();assert.ok(await single.page.evaluate(()=>window.STAR_GARDEN.battle.board.filter(Boolean).every(u=>u.hero==='snow_rabbit')));await shot(single.page,'solo-battle',390,844);await single.page.locator('[data-action="leave"]').click();await single.page.locator('[data-action="save-leave"]').click();await reload(single);await single.page.locator('[data-action="resume"]').click();assert.equal(await single.page.evaluate(()=>window.STAR_GARDEN.battle.deck.join()),'snow_rabbit');await single.context.close();
  const folder=await boot(390,844,(()=>{const p=createProfile(NOW);p.heroes.star_boy.bond=10;return p;})(),'avif',pathToFileURL(path.join(game,'test-results/web/StarGardenDefense.html')).href);assert.equal(await folder.page.evaluate(()=>window.__memorialAssignments.length),0);await folder.page.locator('.bond-button').click();await folder.page.locator('#memory-art img').waitFor();assert.match(await folder.page.locator('#memory-art img').getAttribute('src'),/\.webp$/);await shot(folder.page,'web-memorial-fallback',390,844);await close(folder.page);assert.equal(await folder.page.locator('img[data-memorial]').count(),0);await folder.context.close();
  for(const [width,height] of [[320,568],[390,844]]){
    const fire=traitFixture(['zeke','ancient_dragon','siren','snow_rabbit','great_detective'],[[12,'zeke'],[11,'ancient_dragon']],{wave:1}),fireRun=E.restore(fire.active.run);
    fireRun.enemies[0].progress=863;for(const u of fireRun.board)if(u)u.cooldown=.01;fire.active.run=E.serialize(fireRun);
    const painted=await boot(width,height,fire);await painted.page.locator('[data-action="resume"]').click();await painted.page.waitForFunction(()=>window.STAR_GARDEN.battle.stats.damage>0);await shot(painted.page,'fire-basic-attacks',width,height);await painted.context.close();
    const deck=['lightning_sage','aurora','star_boy','time_ruler','zeke'];
    const t=await boot(width,height,traitFixture(deck,[[6,deck[0]],[7,deck[0]],[11,deck[0]],[12,deck[0]],[8,deck[1]],[13,deck[1]],[16,deck[2]],[17,deck[3],2],[18,deck[3],2],[21,deck[4]]]));
    await t.page.locator('[data-action="resume"]').click();
    await inspectCell(t.page,6);assert.match(await t.page.locator('.unit-trait').innerText(),/4연결.*30%.*80%.*대상 \+1/);
    await shot(t.page,'trait-lightning',width,height);
    await inspectCell(t.page,8);assert.match(await t.page.locator('.unit-trait').innerText(),/아우로라 2기.*30%/);
    await inspectCell(t.page,16);assert.match(await t.page.locator('.unit-trait').innerText(),/등장 웨이브.*150%/);
    await inspectCell(t.page,17);assert.match(await t.page.locator('.unit-trait').innerText(),/50%/);
    await inspectCell(t.page,18);assert.match(await t.page.locator('.unit-trait').innerText(),/대기|활성|수혜/);
    await inspectCell(t.page,21);assert.match(await t.page.locator('.unit-trait').innerText(),/40%/);
    await t.page.locator('[data-action="deselect"]').click();await t.page.locator('#arena').scrollIntoViewIfNeeded();await shot(t.page,'trait-auras',width,height);await t.context.close();
    const other=['avalanche_maid','flame_sage','storm_sage','galaxy_whale','doom'];
    const f=await boot(width,height,traitFixture(other,[[6,other[0]],[8,other[1]],[12,other[2]],[16,other[3],1,1],[18,other[4]]]));
    await f.page.locator('[data-action="resume"]').click();
    await inspectCell(f.page,6);assert.equal(await f.page.locator('[data-action="target"]').count(),0);assert.match(await f.page.locator('.fixed-target').innerText(),/무작위 적/);
    await inspectCell(f.page,8);assert.equal(await f.page.locator('[data-action="target"]').count(),0);assert.match(await f.page.locator('.fixed-target').innerText(),/무작위 위치/);await shot(f.page,'trait-fixed-target',width,height);
    await inspectCell(f.page,16);assert.match(await f.page.locator('.unit-trait').innerText(),/이후 웨이브.*125%/);
    const doom=f.page.locator('[data-skill="doom"]');assert.equal(await doom.isEnabled(),false);assert.match(await doom.getAttribute('aria-label'),/25골드.*골드 부족/);assert.match(await doom.innerText(),/25G/);await f.context.close();
  }
  const paid=await boot(390,844,traitFixture(['doom','flame_sage','storm_sage','galaxy_whale','avalanche_maid'],[[6,'doom']],{gold:25}));
  await paid.page.locator('[data-action="resume"]').click();await paid.page.locator('[data-skill="doom"]').click();
  assert.equal(await paid.page.evaluate(()=>window.STAR_GARDEN.battle.gold),0);assert.equal(await paid.page.evaluate(()=>window.STAR_GARDEN.battle.stats.skills),1);await paid.context.close();
  const wind=traitFixture(['storm_sage','flame_sage','doom','galaxy_whale','avalanche_maid'],[[12,'storm_sage']]);
  const windRun=E.restore(wind.active.run),boss=windRun.enemies[0],victim={...boss,uid:windRun.nextId++,kind:'grunt',boss:null,progress:900,hp:123456,maxHp:123456,shield:200};
  windRun.enemies=[victim,boss];windRun.rng=16;
  const origin=E.cellPoint(12);windRun.shots=[{uid:windRun.nextId++,source:windRun.board[12].uid,target:victim.uid,hero:'storm_sage',proc:true,damage:14,rank:1,count:1,origin,from:origin,to:E.pathPoint(900),life:.2,total:.2}];
  wind.active.run=E.serialize(windRun);assert.ok(E.restore(wind.active.run));
  const executed=await boot(390,844,wind);await executed.page.locator('[data-action="resume"]').click();
  await executed.page.waitForFunction(()=>window.STAR_GARDEN.battle.stats.kills===1,{},{polling:16});
  await shot(executed.page,'storm-instant-kill',390,844);await executed.context.close();
  for(const [width,height] of [[320,568],[390,844],[1280,900]]){
    const test=await boot(width,height),{page,context}=test;
    assert.equal((await profile(page)).deck.length,5);
    assert.equal(await page.locator('.nav-item').count(),5);await shot(page,'home',width,height);
    const navRect=await page.locator('#navigation').boundingBox();
    assert.ok(navRect.y>height-100,'navigation remains at the bottom');
    await page.locator('[data-action="pet"]').click();assert.equal((await profile(page)).dreams,640);
    await nav(page,'동료');assert.equal(await page.locator('.collection-grid .hero-card').count(),30);
    await shot(page,'collection',width,height);
    await page.locator('[data-filter="UR"]').click();assert.equal(await page.locator('.collection-grid .hero-card').count(),12);
    await page.locator('[data-action="owned"]').click();assert.equal(await page.locator('.collection-grid .hero-card').count(),0);
    await page.locator('[data-action="owned"]').click();await page.locator('[data-filter="all"]').click();
    await page.locator('.collection-grid [data-hero="star_boy"]').click();
    assert.equal(await page.locator('#app').getAttribute('aria-hidden'),'true');
    await page.locator('[data-level="star_boy"]').click();assert.equal((await profile(page)).heroes.star_boy.level,2);
    await shot(page,'detail',width,height);await page.keyboard.press('Escape');assert.equal(await page.locator('#overlay').isVisible(),false);
    await nav(page,'소환');await shot(page,'summon',width,height);
    await page.locator('[data-action="rates"]').click();assert.match(await page.locator('#sheet-body').innerText(),/70.00%/);await close(page);
    await page.locator('[data-draw="1"]').click();
    assert.equal((await profile(page)).dreams,540);assert.equal((await profile(page)).history.length,1);
    assert.equal(await page.locator('.reveal-grid .hero-card').count(),1);await shot(page,'reveal',width,height);await close(page);
    await page.locator('[data-banner="season"]').click();await page.locator('[data-action="rates"]').click();
    assert.match(await page.locator('#sheet-body').innerText(),/0.100%/);await close(page);
    await page.locator('[data-banner="relic"]').click();await shot(page,'relic-summon',width,height);
    await nav(page,'파견');assert.equal(await page.locator('.dispatch-card.locked').count(),4);await shot(page,'dispatch-locked',width,height);
    await nav(page,'모험');assert.equal(await page.locator('.stage-row').count(),9);
    await page.locator('[data-cycle="4"]').click();assert.match(await page.locator('.stage-list').innerText(),/45/);await page.locator('[data-cycle="0"]').click();
    await page.locator('[data-prepare-stage="1"]').click();await page.locator('#sheet-footer [data-action="team"]').click();
    await page.locator('[data-action="save-team"]').click();
    assert.equal(await page.locator('[data-begin="main"]').count(),1,'team confirmation returns to preparation');
    await page.locator('[data-begin="main"]').click();await page.locator('#arena').waitFor();
    assert.equal(await page.locator('.skill-button').count(),5);
    await page.locator('[data-action="pause"]').click();
    const battleTime=await page.evaluate(()=>window.STAR_GARDEN.battle.time);await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>window.STAR_GARDEN.battle.time),battleTime);
    await shot(page,'battle',width,height);
    const skills=await page.locator('.skills').boundingBox(),controls=await page.locator('.battle-controls').boundingBox();
    assert.ok(skills.y+skills.height<=height+1,'all five skills fit the portrait viewport');
    assert.ok(controls.y+controls.height<=height+1,'primary battle controls fit the portrait viewport');
    await page.locator('[data-action="auto"]').click();await page.locator('[data-action="pause"]').click();
    const move=await page.evaluate(()=>{const s=window.STAR_GARDEN.battle,from=s.board.findIndex(Boolean),other=s.board.findIndex((u,i)=>u&&i!==from);return {from,other,hero:s.board[from].hero,priority:s.board[from].priority,otherHero:s.board[other].hero,uid:s.board[from].uid,to:s.board.findIndex(u=>!u),board:s.board.map(u=>u?.uid||null)};});
    const arena=await page.locator('#arena').boundingBox(),clickCell=async i=>{
      const point=E.cellPoint(i);await page.mouse.click(arena.x+point.x/720*arena.width,arena.y+point.y/780*arena.height);
    };
    await clickCell(move.from);await clickCell(move.other);
    assert.equal(await page.locator('#unit-panel strong').innerText(),HEROES.find(h=>h.id===move.otherHero).name,'tapping a second unit inspects it');
    assert.deepEqual(await page.evaluate(()=>window.STAR_GARDEN.battle.board.map(u=>u?.uid||null)),move.board,'tap cannot move, swap or merge');
    await clickCell(move.to);assert.deepEqual(await page.evaluate(()=>window.STAR_GARDEN.battle.board.map(u=>u?.uid||null)),move.board,'tap on empty cell cannot move');
    const from=E.cellPoint(move.from),to=E.cellPoint(move.to);
    await page.mouse.move(arena.x+from.x/720*arena.width,arena.y+from.y/780*arena.height);await page.mouse.down();await page.mouse.move(arena.x+to.x/720*arena.width,arena.y+to.y/780*arena.height,{steps:8});await page.mouse.up();
    assert.equal(await page.evaluate(i=>window.STAR_GARDEN.battle.board[i]?.uid,move.to),move.uid,'real drag moves the captured unit');
    await page.locator('[data-action="target"]').click();
    const priorities=['first','boss','strong','last'];assert.equal(await page.evaluate(i=>window.STAR_GARDEN.battle.board[i].priority,move.to),priorities[(priorities.indexOf(move.priority)+1)%4]);
    await page.locator('[data-action="deselect"]').click();
    const beforeKeys=await page.evaluate(()=>window.STAR_GARDEN.battle.board.map(u=>u?.uid||null));await page.locator('#arena').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(()=>window.STAR_GARDEN.battle.board.map(u=>u?.uid||null)),beforeKeys,'keyboard inspection cannot move a unit');
    await page.waitForFunction(()=>window.STAR_GARDEN.battle.enemies.length>0);
    await page.locator(`[data-skill="${move.hero}"]`).click();
    assert.equal(await page.evaluate(()=>window.STAR_GARDEN.battle.stats.skills),1,'real manual skill');
    await page.locator('[data-action="leave"]').click();await page.locator('[data-action="save-leave"]').click();
    const saved=await profile(page);assert.ok(saved.active.run);await reload(test);
    await page.locator('[data-action="resume"]').click();await page.locator('#arena').waitFor();await page.locator('[data-action="pause"]').click();
    assert.ok((await page.evaluate(()=>window.STAR_GARDEN.battle.time))>=battleTime);
    assert.deepEqual((await profile(page)).active.deck,saved.active.deck);
    await page.locator('[data-action="leave"]').click();await page.locator('[data-action="save-leave"]').click();
    await page.locator('[data-action="settings"]').click();
    const backup={...await profile(page),dreams:3333};
    // File.text() in WebKit requires local I/O enabled; all remote requests
    // stay blocked before, during and after import.
    if(isWebkit)await context.setOffline(false);
    await page.locator('#backup-input').setInputFiles({name:'garden.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await page.locator('#confirm-import').waitFor();await page.locator('#confirm-import').click();
    if(isWebkit)await context.setOffline(true);
    assert.equal((await profile(page)).dreams,3333);assert.ok((await profile(page)).active.run);
    await context.close();
  }
  const grown=createProfile(NOW);grown.cleared=36;grown.dreams=5000;
  for(const h of HEROES){grown.heroes[h.id].owned=true;grown.heroes[h.id].copies=3;}
  grown.relics.hourglass={owned:true,enhance:2,copies:3};grown.equipped=['hourglass'];
  const test=await boot(390,844,grown),{page}=test;
  await page.locator('[data-action="partner"]').click();await page.locator('[data-set-partner="luna"]').click();
  assert.equal((await profile(page)).partner,'luna');await shot(page,'partner-luna',390,844);
  await page.locator('[data-action="team"]').click();await page.locator('#sheet-body .five-line [data-team-pick="star_boy"]').click();
  assert.equal(await page.locator('[data-action="save-team"]').isEnabled(),false);
  await page.locator('[data-action="focus-team"]').click();await page.locator('.choose-list [data-team-pick="queen"]').click();
  await page.locator('[data-action="save-team"]').click();assert.ok((await profile(page)).deck.includes('queen'));
  await nav(page,'동료');await page.locator('[data-filter="UR"]').click();await shot(page,'ur-collection',390,844);
  await page.locator('[data-collection="relic"]').click();await page.locator('.collection-grid [data-relic="hourglass"]').click();
  await page.locator('[data-enhance-relic="hourglass"]').click();assert.equal((await profile(page)).relics.hourglass.enhance,3);await close(page);
  await nav(page,'소환');await page.locator('[data-banner="relic"]').click();await page.locator('[data-draw="10"]').click();
  assert.equal((await profile(page)).relicDraws,10);assert.equal((await profile(page)).dreams,4200);await shot(page,'ten-relics',390,844);await close(page);
  await nav(page,'파견');assert.equal(await page.locator('.dispatch-card.locked').count(),0);
  await page.locator('[data-dispatch-slot="0"]').click();await page.locator('[data-send="queen"]').click();
  assert.equal((await profile(page)).dispatches[0].hero,'queen');assert.ok(!(await profile(page)).deck.includes('queen'));
  await shot(page,'dispatch-active',390,844);
  await nav(page,'모험');await page.locator('[data-mode="weekly"]').click();await page.locator('[data-action="prepare-mode"]').click();
  await page.locator('[data-begin="weekly"]').click();await page.locator('[data-draft="0"]').waitFor();
  assert.equal(await page.locator('.draft-card').count(),2);await shot(page,'draft',390,844);
  await page.locator('[data-draft="0"]').click();const draft=await profile(page);
  await reload(test);await page.locator('[data-action="resume"]').click();
  assert.deepEqual((await profile(page)).active.draft,draft.active.draft);
  for(let i=1;i<5;i++)await page.locator('[data-draft="0"]').click();
  await page.locator('#arena').waitFor();assert.equal(await page.locator('.skill-button').count(),5);
  assert.ok(!(await profile(page)).active.deck.includes('queen'));
  await page.locator('[data-action="leave"]').click();await page.locator('[data-action="retire"]').click();await page.locator('[data-action="confirm-retire"]').click();
  assert.equal((await profile(page)).active,null);assert.ok((await profile(page)).weekly);
  assert.equal((await profile(page)).results[0].mode,'weekly');
  await test.context.close();

  const monthlyProfile=createProfile(NOW);monthlyProfile.cleared=3;monthlyProfile.settings.auto=false;
  const monthly=await boot(390,844,monthlyProfile);
  await nav(monthly.page,'모험');await monthly.page.locator('[data-mode="monthly"]').click();await shot(monthly.page,'monthly-card',390,844);
  await monthly.page.locator('[data-action="prepare-mode"]').click();await monthly.page.locator('[data-begin="monthly"]').click();
  await monthly.page.waitForFunction(()=>window.STAR_GARDEN.battle?.enemies.length>0);
  await monthly.page.locator('[data-action="pause"]').click();
  const bosses=await monthly.page.evaluate(()=>window.STAR_GARDEN.battle.enemies.map(e=>e.boss));
  assert.deepEqual(bosses,['artificial_demon']);await shot(monthly.page,'monthly-battle',390,844);
  await monthly.page.locator('[data-action="leave"]').click();await monthly.page.locator('[data-action="retire"]').click();await monthly.page.locator('[data-action="confirm-retire"]').click();
  assert.equal((await profile(monthly.page)).results[0].mode,'monthly');assert.equal((await profile(monthly.page)).dreams,600);
  assert.equal((await profile(monthly.page)).monthly,null);assert.ok((await profile(monthly.page)).monthlyBest);
  await shot(monthly.page,'monthly-record',390,844);await monthly.page.locator('#sheet-body [data-action="monthly-claim"]').click();
  assert.match(await monthly.page.locator('#sheet-body').innerText(),/한 번/);await monthly.page.locator('[data-confirm-monthly]').click();
  assert.equal((await profile(monthly.page)).dreams,750);assert.ok((await profile(monthly.page)).monthly);
  await shot(monthly.page,'monthly-claimed',390,844);await monthly.page.locator('[data-action="prepare-mode"]').click();await monthly.page.locator('[data-begin="monthly"]').click();await monthly.page.locator('#arena').waitFor();
  await monthly.page.locator('[data-action="leave"]').click();await monthly.page.locator('[data-action="retire"]').click();await monthly.page.locator('[data-action="confirm-retire"]').click();
  assert.equal((await profile(monthly.page)).dreams,750,'a second attempt cannot pay again');await monthly.context.close();

  // Live duration UI uses restored engine state, then a real cast and pause.
  const sustained=createProfile(NOW);sustained.settings.auto=false;sustained.settings.sound=false;command(sustained,'begin',{mode:'main',stage:1},NOW);const buffRun=createBattle(sustained);
  for(let i=0;i<20&&!E.bestUnit(buffRun,'siren');i++){buffRun.gold+=1000;E.summon(buffRun);}assert.ok(E.bestUnit(buffRun,'siren'));
  buffRun.queue=[{kind:'boss',hp:1e8}];buffRun.spawnIn=0;E.step(buffRun,.05);buffRun.enemies[0].speed=0;buffRun.enemies[0].skillIn=99;buffRun.gauge=120;sustained.active.run=E.serialize(buffRun);
  const timer=await boot(390,844,sustained);await timer.page.locator('[data-action="resume"]').click();await timer.page.locator('[data-skill="siren"]').click();
  await timer.page.waitForFunction(()=>document.querySelector('[data-skill="siren"] .skill-duration')?.hidden===false);await timer.page.waitForTimeout(1250);await shot(timer.page,'sustained-siren',390,844);
  await timer.page.locator('[data-action="pause"]').click();const remaining=await timer.page.evaluate(()=>window.STAR_GARDEN.battle.buffs.haste);await timer.page.waitForTimeout(250);assert.equal(await timer.page.evaluate(()=>window.STAR_GARDEN.battle.buffs.haste),remaining);
  assert.match(await timer.page.locator('[data-skill="siren"]').getAttribute('aria-label'),/발동 중/);await timer.context.close();

  const faultProfile=createProfile(NOW);faultProfile.settings.auto=false;const quota=await boot(390,844,faultProfile,true);
  await quota.page.locator('[data-action="prepare"]').click();await quota.page.locator('[data-begin="main"]').click();await quota.page.locator('#arena').waitFor();
  await quota.page.evaluate(()=>window.__testQuotaFailure=true);await quota.page.locator('[data-action="pause"]').click();
  assert.equal(await quota.page.locator('#pause-button').getAttribute('aria-label'),'전투 재개');const frozen=await quota.page.evaluate(()=>window.STAR_GARDEN.battle.time);
  await quota.page.locator('[data-action="pause"]').click();await quota.page.waitForTimeout(180);assert.equal(await quota.page.evaluate(()=>window.STAR_GARDEN.battle.time),frozen,'failed retry stays paused');
  await quota.page.locator('[data-action="leave"]').click();await quota.page.getByRole('button',{name:'닫기',exact:true}).click();await quota.page.waitForTimeout(180);assert.equal(await quota.page.evaluate(()=>window.STAR_GARDEN.battle.time),frozen,'dismissing a sheet cannot resume a failed checkpoint');
  await quota.page.evaluate(()=>window.__testQuotaFailure=false);await quota.page.locator('[data-action="pause"]').click();await quota.page.waitForTimeout(180);assert.ok(await quota.page.evaluate(t=>window.STAR_GARDEN.battle.time>t,frozen));
  await quota.page.locator('[data-action="leave"]').click();await quota.page.locator('[data-action="save-leave"]').click();assert.ok((await profile(quota.page)).active.run);await quota.context.close();

  const best=createProfile(NOW);best.cleared=3;command(best,'begin',{mode:'monthly',stage:4},NOW);const bestRun=createBattle(best);bestRun.phase='defeat';bestRun.health=0;bestRun.wave=7;bestRun.time=81;bestRun.stats.kills=6;bestRun.stats.damage=567890;bestRun.stats.byHero.star_boy=300000;bestRun.stats.byHero.siren=267890;best.active.run=E.serialize(bestRun);
  const record=await boot(390,844,best);await record.page.locator('[data-action="resume"]').click();await record.page.locator('.monthly-record').first().waitFor();assert.equal((await profile(record.page)).monthlyBest.round,6);assert.equal((await profile(record.page)).dreams,600);
  await shot(record.page,'monthly-best-result',390,844);await close(record.page);await record.page.locator('#content [data-action="monthly-claim"]').click();await shot(record.page,'monthly-confirm',390,844);await record.page.locator('[data-confirm-monthly]').click();assert.equal((await profile(record.page)).dreams,1050);await record.context.close();

  // Enter actual result/claim screens from serialized combat fixtures rather
  // than altering the running browser engine or creating fake DOM nodes.
  const end=createProfile(NOW);command(end,'begin',{mode:'main',stage:1},NOW);const won=createBattle(end);
  won.phase='victory';won.wave=6;won.won=true;won.stats.damage=2222;won.stats.byHero.star_boy=2222;end.active.run=E.serialize(won);
  const result=await boot(390,844,end);
  await result.page.locator('[data-action="resume"]').click();await result.page.locator('.battle-result').waitFor();
  assert.equal((await profile(result.page)).cleared,1);assert.equal((await profile(result.page)).dreams,770);await shot(result.page,'result',390,844);
  await result.context.close();
  const returned=createProfile(NOW-20*3600000);returned.cleared=9;returned.heroes.queen.owned=true;
  command(returned,'dispatch',{slot:0,id:'queen'},NOW-20*3600000);returned.clockAt=NOW;
  const claim=await boot(390,844,returned);await nav(claim.page,'파견');
  await claim.page.locator('[data-claim-dispatch="0"]').click();assert.equal((await profile(claim.page)).dispatches.length,0);
  assert.ok((await profile(claim.page)).dreams>600);await claim.context.close();
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await fs.writeFile(path.join(output,name+'-verification.json'),JSON.stringify({browser:name,errors,externalRequests:requests,geometry},null,2));
  console.log(`PASS ${name}: ${geometry.length} offline screen/geometry captures; five skills, gacha, dispatch, draft, resume, import, results; no page errors or external requests`);
}finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
