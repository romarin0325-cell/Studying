import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
import {createProfile,command,SAVE_KEY} from '../src/profile.js';
import {HEROES} from '../src/content.js';
import {createBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
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
async function boot(width,height,profile=createProfile(NOW)){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});
  contexts.push(context);const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  await page.addInitScript(({key,profile})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(profile));},{key:SAVE_KEY,profile});
  await page.goto(url);await context.setOffline(true);await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);
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
try{
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
    const move=await page.evaluate(()=>({uid:window.STAR_GARDEN.battle.board[12].uid,to:window.STAR_GARDEN.battle.board.findIndex(u=>!u)}));
    const arena=await page.locator('#arena').boundingBox(),clickCell=async i=>{
      const point=E.cellPoint(i);await page.mouse.click(arena.x+point.x/720*arena.width,arena.y+point.y/780*arena.height);
    };
    await clickCell(12);await clickCell(move.to);
    assert.equal(await page.evaluate(i=>window.STAR_GARDEN.battle.board[i]?.uid,move.to),move.uid,'real tap selection and movement');
    await page.locator('[data-action="target"]').click();
    assert.equal(await page.evaluate(i=>window.STAR_GARDEN.battle.board[i].priority,move.to),'boss');
    await page.locator('[data-action="deselect"]').click();
    await page.waitForFunction(()=>window.STAR_GARDEN.battle.enemies.length>0);
    await page.locator('[data-skill="star_boy"]').click();
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
  assert.equal((await profile(monthly.page)).results[0].mode,'monthly');assert.equal((await profile(monthly.page)).dreams,750);
  assert.ok((await profile(monthly.page)).monthly);await monthly.context.close();

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
