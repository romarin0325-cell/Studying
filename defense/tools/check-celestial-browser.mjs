import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import * as E from '../merge/engine.js';
import {HERO} from '../merge/content.js';
const require=createRequire(import.meta.url),{createHeroDefenseV2Server}=require('../../scripts/serve_defense.js');
const out=fileURLToPath(new URL('../docs/art/expansion/review/gameplay/',import.meta.url));await mkdir(out,{recursive:true});
const deck=['doom','santa','jasmine','star_boy','time_magician','cherry_prince'],slots=[6,8,12,16,18,22];
function fixture(id,chapter=6){const s=E.newRun({deck,chapter,seed:325,artifacts:['royal_seal','gift_ribbon','broken_clock']});const template=s.board.find(Boolean);s.board.fill(null);deck.forEach((h,i)=>s.board[slots[i]]={...template,uid:s.nextId++,hero:h,rank:2,cooldown:999,priority:'boss',facing:'right'});s.wave=12;s.queue=[];
  for(const [kind,hp,progress] of [['grunt',5e6,180],['boss',1e7,675],['armor',2e6,730]]){s.queue=[{kind,hp}];s.spawnIn=0;E.step(s,1/60);const e=s.enemies.at(-1);e.progress=progress;e.speed=0;e.skillIn=999;}
  s.queue=[];s.events=[];s.gauge=100;return E.serialize(s);
}
const server=createHeroDefenseV2Server();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true}),results=[];
try{
  for(const width of [320,390])for(const reducedMotion of ['no-preference','reduce'])for(const id of ['cherry_prince','star_boy','time_magician']){
    const context=await browser.newContext({viewport:{width,height:width===320?568:844},hasTouch:true,reducedMotion,deviceScaleFactor:1}),page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));const url=base+'/dist-local/HeroCoreDefense.html';
    await context.addInitScript(value=>localStorage.setItem('astra.confluence.run.v1',value),fixture(id));
    await context.route('**/*',route=>{if(route.request().isNavigationRequest()&&route.request().url()===url)return route.continue();requests.push(route.request().url());return route.abort();});
    try{
      const when=Date.now();await page.clock.install({time:new Date(when)});await page.goto(url);await page.waitForFunction(()=>document.querySelector('#home-deck img')?.naturalWidth>0);await page.clock.pauseAt(new Date(when+10000));await page.locator('#resume').click();await page.clock.runFor(80);
      await page.locator(`[data-skill="${id}"]`).click();const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.confluence.run.v1')));
      if(id!=='time_magician'){assert.equal(stored.finishers.length,1);assert.equal(stored.finishers[0].target,stored.enemies.find(e=>e.boss).uid);assert.equal(stored.enemies.find(e=>e.boss).hp,1e7);}
      await page.clock.runFor(120);
      if(id==='time_magician'){const box=await page.locator('#arena').boundingBox(),at=E.cellPoint(18);await page.mouse.click(box.x+box.width*at.x/720,box.y+box.height*at.y/780);await page.clock.runFor(100);assert.match(await page.locator('#unit-panel').textContent(),/트라우마/);assert.match(await page.locator('#unit-panel').textContent(),/88.8/);assert.equal(await page.locator('[data-skill="time_magician"] img').getAttribute('alt'),'트라우마');}
      const stem=`${width}-${reducedMotion}-${id}`;await page.screenshot({path:out+stem+'-lock.png'});
      if(id!=='time_magician'){await page.clock.runFor((id==='star_boy'?820:700)+(reducedMotion==='reduce'?0:140));await page.screenshot({path:out+stem+'-flight.png'});await page.clock.runFor(400);await page.screenshot({path:out+stem+'-impact.png'});}
      else {await page.clock.runFor(12400);assert.equal(await page.locator('[data-skill="time_magician"] img').getAttribute('alt'),'시간의마술사');}
      const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,summonBottom:document.querySelector('#summon').getBoundingClientRect().bottom}));
      assert.ok(geometry.scrollWidth<=geometry.width+1);assert.ok(geometry.scrollHeight<=geometry.height+1);assert.ok(geometry.summonBottom<=geometry.height+1);
      await page.getByRole('button',{name:'일시 정지',exact:true}).click();const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.confluence.run.v1')));
      if(id!=='time_magician'){assert.ok(after.enemies.find(e=>e.boss).hp<1e7,JSON.stringify({id,width,time:after.time,before:stored.time,finishers:after.finishers,phase:after.phase}));assert.equal(after.enemies.find(e=>e.kind==='grunt').hp,5e6);assert.equal(after.finishers.length,0);}
      assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);results.push({width,reducedMotion,id,geometry,errors,requests});
    }finally{await context.close();}
  }
  // Deterministic rendered contact sheet: same game Renderer, each real boss,
  // dense field, authored cardinal forms; no screenshot of an art-only mockup.
  const page=await browser.newPage({viewport:{width:1080,height:1170}});await page.goto(base);
  await page.evaluate(async()=>{const [{Art,Renderer},E,{HEROES}]=await Promise.all([import('/merge/render.js'),import('/merge/engine.js'),import('/merge/content.js')]);const art=new Art();await art.ready;const canvas=document.createElement('canvas');canvas.id='review';canvas.width=1080;canvas.height=1170;document.body.replaceChildren(canvas);const ctx=canvas.getContext('2d');
    for(let col=0;col<3;col++){const s=E.newRun({chapter:col+4,seed:71});const unit=s.board.find(Boolean);s.board=Array.from({length:25},(_,i)=>({...unit,uid:s.nextId++,hero:HEROES[i%HEROES.length].id,facing:['down','up','left','right'][i%4],born:-5}));s.board[12]={...s.board[12],hero:'time_magician'};s.buffs.trauma=10;s.wave=12;s.queue=[{kind:'boss',hp:100000}];s.spawnIn=0;E.step(s,1/60);s.enemies[0].progress=675;s.enemies[0].speed=0;s.enemies[0].skillIn=0;E.step(s,1/60);const c=document.createElement('canvas'),renderer=new Renderer(c,art);renderer.reduced=true;renderer.draw(s,0);ctx.drawImage(c,col*360,0,360,390);
      for(let row=1;row<3;row++){s.board=s.board.map((u,i)=>({...u,hero:HEROES[21+i%6].id,facing:row===1?'down':'right'}));renderer.draw(s,0);ctx.drawImage(c,col*360,row*390,360,390);}
    }});
  await page.locator('#review').screenshot({path:out+'regions-and-dense.png'});await page.close();
  await writeFile(out+'results.json',JSON.stringify({offline:true,scenarios:results},null,2)+'\n');console.log('Celestial offline Chromium: '+results.length+' mobile scenarios passed. '+out);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
