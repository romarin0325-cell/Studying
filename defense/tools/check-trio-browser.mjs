import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import * as E from '../merge/engine.js';
const out=fileURLToPath(new URL('../docs/art/trio/review/gameplay/',import.meta.url));
await mkdir(out,{recursive:true});
const deck=['frost_witch','harmonious','aurora','zeke','avalanche_maid','siren'],slots=[7,12,13,11,17,22];
function fixture(){
  const s=E.newRun({deck,chapter:6,seed:325}),u=s.board.find(Boolean);s.board.fill(null);
  deck.forEach((id,i)=>s.board[slots[i]]={...u,uid:s.nextId++,hero:id,rank:2,cooldown:999,facing:'up'});s.queue=[];s.wave=12;
  for(const [kind,hp,progress] of [['grunt',5e6,200],['boss',1e7,675],['armor',2e6,790]]){s.queue=[{kind,hp}];s.spawnIn=0;E.step(s,1/60);const e=s.enemies.at(-1);e.progress=progress;e.speed=0;e.skillIn=999;}
  s.queue=[];s.events=[];s.gauge=100;return E.serialize(s);
}
const url=pathToFileURL(fileURLToPath(new URL('../dist-local/HeroCoreDefense.html',import.meta.url))).href;
const browser=await chromium.launch({headless:true}),results=[];
try{
  for(const width of [320,390])for(const reducedMotion of ['no-preference','reduce'])for(const id of deck.slice(0,3)){
    const context=await browser.newContext({viewport:{width,height:width===320?568:844},hasTouch:true,deviceScaleFactor:1,reducedMotion});
    const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(value=>localStorage.setItem('astra.confluence.run.v1',value),fixture());
    await context.route('**/*',route=>{if(route.request().isNavigationRequest()&&route.request().url()===url)return route.continue();requests.push(route.request().url());return route.abort();});
    try{
      const when=Date.now();await page.clock.install({time:new Date(when)});await page.goto(url);await page.waitForFunction(()=>document.querySelector('#home-deck img')?.naturalWidth>0);await page.clock.pauseAt(new Date(when+10000));
      await page.locator('#resume').click();await page.clock.runFor(100);
      const canvas=await page.locator('#arena').boundingBox(),at=E.cellPoint(slots[deck.indexOf(id)]);
      await page.mouse.click(canvas.x+canvas.width*at.x/720,canvas.y+canvas.height*at.y/780);await page.clock.runFor(100);
      const panel=await page.locator('#unit-panel').textContent();
      assert.match(panel,{frost_witch:/서리 3중첩/,harmonious:/4종/,aurora:/반사/}[id]);assert.ok(!panel.includes('undefined'));
      const selectedBounds=await page.evaluate(()=>[...document.querySelectorAll('#arena,.battle-header,#unit-panel,.unit-actions button,#skills button,#summon,#training')].map(el=>{const r=el.getBoundingClientRect();return {element:el.id||el.className,left:r.left,right:r.right,bottom:r.bottom};}));
      for(const r of selectedBounds){assert.ok(r.left>=-1&&r.right<=width+1,JSON.stringify({id,width,...r}));assert.ok(r.bottom<=(width===320?568:844)+1,JSON.stringify(r));}
      if(width===390&&reducedMotion==='no-preference')await page.screenshot({path:out+id+'-stats.png'});
      await page.locator('[data-skill="'+id+'"]').click();await page.clock.runFor(180);
      const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.confluence.run.v1')));
      if(id==='aurora'){assert.equal(stored.finishers[0].kind,'mirror');assert.equal(stored.finishers[0].target,stored.enemies.find(e=>e.boss).uid);}
      if(id==='harmonious'){assert.ok(stored.buffs.harmony>7);assert.match(await page.locator('#active-buffs').textContent(),/디저트 앙상블/);}
      if(id==='frost_witch')assert.ok(stored.enemies.every(e=>e.frostStacks===2));
      const stem=width+'-'+reducedMotion+'-'+id;
      if(width===390&&reducedMotion==='no-preference')await page.screenshot({path:out+stem+'-skill.png'});
      // Existing skill presentation briefly slows simulation to 40% speed.
      await page.clock.runFor(id==='aurora'?3150:500);
      if(width===390&&reducedMotion==='no-preference')await page.screenshot({path:out+stem+'-resolve.png'});
      await page.getByRole('button',{name:'일시 정지',exact:true}).click();
      const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.confluence.run.v1')));
      if(id==='aurora'){assert.equal(after.finishers.length,0);assert.ok(after.enemies.find(e=>e.boss).hp<1e7);}
      const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,summonBottom:document.querySelector('#summon').getBoundingClientRect().bottom}));
      assert.ok(geometry.scrollWidth<=width+1);assert.ok(geometry.scrollHeight<=geometry.height+1);assert.ok(geometry.summonBottom<=geometry.height+1);
      assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);results.push({width,reducedMotion,id,geometry,selectedBounds,errors,requests});
    }finally{await context.close();}
  }
  // New portraits are selectable through the real deck UI, including narrow screens.
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#home-deck img')?.naturalWidth>0);
  await page.locator('[data-action="deck"]').click();
  for(const id of deck.slice(0,3)){const tile=page.locator('[data-inspect="'+id+'"]');await tile.scrollIntoViewIfNeeded();assert.equal(await tile.count(),1);await tile.click();assert.ok((await page.locator('.companion-preview').textContent()).length>30);}
  await page.screenshot({path:out+'deck.png'});await page.close();
  for(const mode of ['dense','attacks']){
    const s=E.restore(fixture()),u=s.board.find(Boolean);s.events=[];
    if(mode==='dense')s.board=Array.from({length:25},(_,i)=>({...u,uid:s.nextId++,hero:deck[i%6],rank:1,facing:['down','up','left','right'][Math.floor(i/6)%4],cooldown:999,born:-5}));
    else for(const u of s.board.filter(Boolean))u.cooldown=.08;
    assert.ok(E.restore(E.serialize(s)),mode+' review fixture must be a valid saved game');
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();
    await context.addInitScript(value=>localStorage.setItem('astra.confluence.run.v1',value),E.serialize(s));
    await context.route('**/*',r=>r.request().isNavigationRequest()?r.continue():r.abort());
    const when=Date.now();await page.clock.install({time:new Date(when)});await page.goto(url);await page.waitForFunction(()=>document.querySelector('#home-deck img')?.naturalWidth>0);await page.clock.pauseAt(new Date(when+10000));await page.locator('#resume').click();await page.clock.runFor(mode==='dense'?80:510);
    await page.screenshot({path:out+mode+'.png'});
    if(mode==='attacks'){await page.clock.runFor(320);await page.screenshot({path:out+'reflection.png'});await page.getByRole('button',{name:'일시 정지',exact:true}).click();const live=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.confluence.run.v1')));for(const id of deck.slice(0,3))assert.ok(live.stats.byHero[id]>0,id+' real attack');}
    await context.close();
  }
  await writeFile(out+'results.json',JSON.stringify({artifact:'defense/dist-local/HeroCoreDefense.html',protocol:'file:',subrequestsAllowed:false,physicalDevice:false,scenarios:results},null,2)+'\n');
  console.log('Trio offline file Chromium: '+results.length+' mobile scenarios passed.');
}finally{await browser.close();}
