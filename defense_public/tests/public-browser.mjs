import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
import {buildPublicWeb} from '../scripts/public-web.mjs';
import {servePublic} from '../scripts/serve-public.mjs';
import {createProfile,command,parseProfile,SAVE_KEY} from '../src/profile.js';
import {createBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
import {eventWindow} from '../src/preview/season.js';
import {cleanEvent} from '../src/analytics-schema.js';

const game=fileURLToPath(new URL('..',import.meta.url)),out=path.join(game,'test-results/public-web');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'garden-http-')),NOW=Date.UTC(2026,10,22,4);
await fs.mkdir(out,{recursive:true});
const configFile=path.join(scratch,'config.json');await fs.writeFile(configFile,JSON.stringify({channel:'test',analytics:{enabled:true}}));
await buildPublicWeb({outdir:path.join(scratch,'on'),configFile});
await buildPublicWeb({outdir:path.join(scratch,'off')});
const on=await servePublic(path.join(scratch,'on')),off=await servePublic(path.join(scratch,'off'));
const veteran=p=>({...p,ftue:{legacy:true,done:[],seen:[],skipped:false},beginner:null,firstTen:true,eventSeen:eventWindow(NOW).id,requests:{next:NOW+86400000,active:[],claimed:[],after:[],read:[]}});
const stored=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
const close=page=>page.locator('#sheet .sheet-top [data-action="close"]').click();
async function flush(page){
  for(let i=0;i<3;i++){
    const sent=page.waitForResponse(r=>r.url().endsWith('/api/event'),{timeout:1200}).catch(()=>null);
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));if(!await sent)break;
  }
}
function combatFixture(phase='combat',wave=1){
  const p=veteran(createProfile(NOW));p.settings.auto=false;p.settings.sound=false;
  assert.ok(command(p,'begin',{mode:'main',stage:1},NOW).ok);
  const run=createBattle(p),unit={...run.board.find(Boolean)};
  run.board.fill(null);run.board[0]={...unit,uid:run.nextId++};run.board[1]={...unit,uid:run.nextId++};
  run.gold=100;run.gauge=120;run.queue=[{kind:'boss',hp:1e8}];run.spawnIn=0;E.step(run,.05);
  run.enemies[0].progress=E.PATH_LENGTH*.7;run.enemies[0].speed=0;run.enemies[0].skillIn=99;
  if(phase==='victory'){run.phase='victory';run.wave=6;run.won=true;}
  if(phase==='defeat'){run.phase='defeat';run.health=0;run.wave=wave;}
  p.active.run=E.serialize(run);assert.ok(E.restore(p.active.run));return {p,hero:unit.hero};
}
const reports=[];
try{
  for(const name of (process.argv.includes('--chromium-only')?['chromium']:process.argv.includes('--webkit-only')?['webkit']:['chromium','webkit'])){
    const browser=await (name==='webkit'?webkit:chromium).launch({headless:true}).catch(error=>{if(name==='webkit'||process.env.CI)throw error;return chromium.launch({headless:true,channel:'chrome'});});
    const errors=[],csp=[],external=[],events=[],captures=[];
    async function boot({width=390,height=844,profile=veteran(createProfile(NOW)),bright=false,enabled=true,storageBlocked=false}={}){
      const base=enabled?on.url:off.url,url=base+(bright?'/bright.html':'/');
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
      const page=await context.newPage();page.setDefaultTimeout(15000);await page.clock.setFixedTime(NOW);
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Content Security Policy|violates.*directive|Refused to/i.test(m.text()))csp.push(m.text());});
      page.on('request',r=>{if(new URL(r.url()).origin!==base&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
      await page.route('**/api/event',async route=>{
        const req=route.request(),headers=await req.allHeaders();assert.equal(headers.cookie,undefined);assert.equal(headers.referer,undefined);
        const data=req.postDataJSON();assert.deepEqual(Object.keys(data),['events']);assert.ok(data.events.every(e=>cleanEvent(e)));events.push(...data.events);
        await route.fulfill({status:429}); // Collection failure must not affect the game.
      });
      await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture</title>'}),{times:1});await page.goto(url);
      if(profile)await page.evaluate(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEY,profile});
      await context.addCookies([{name:'unrelated',value:'must-not-send',url:base}]);
      await page.addInitScript(blocked=>{
        if(blocked==='read'){
          Storage.prototype.getItem=function(){throw new DOMException('blocked','SecurityError');};
        }
        const set=Storage.prototype.setItem;
        Storage.prototype.setItem=function(k,v){if(blocked||window.__quota)throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};
      },storageBlocked);
      await page.goto(url);await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.evaluate(()=>typeof window.STAR_GARDEN),'undefined');
      return {page,context,width,height};
    }
    async function shot(t,label){
      await t.page.evaluate(()=>Promise.allSettled([...document.images].filter(i=>i.offsetParent!==null).map(i=>i.decode())));
      const m=await t.page.evaluate(()=>({width:innerWidth,height:innerHeight,document:document.documentElement.scrollWidth,content:document.getElementById('content').clientWidth,scroll:document.getElementById('content').scrollWidth,loaded:[...document.images].filter(i=>i.offsetParent!==null).every(i=>i.complete&&i.naturalWidth>0)}));
      assert.ok(m.document<=t.width+1,label+' document overflow');assert.ok(m.scroll<=m.content+1,label+' content overflow');assert.ok(m.loaded,label+' image decoding');
      await t.page.screenshot({path:path.join(out,`${name}-${label}-${t.width}x${t.height}.png`),animations:'disabled'});captures.push({label,...m});
    }
    try{
      const fresh=await boot({profile:createProfile(NOW)}),p=fresh.page;
      await p.locator('.coach:not([hidden]) .coach-line').waitFor();await shot(fresh,'tutorial');
      await p.locator('.lb-depart').click();await p.locator('#sheet[data-kind="prepare"]').waitFor();
      assert.ok((await stored(p)).ftue.done.includes('lobby'));
      await p.locator('[data-begin="main"]').click();await p.locator('#arena').waitFor();
      await p.locator('[data-action="summon-battle"]').click();
      await p.locator('.coach-line').filter({hasText:/같은 동료/}).waitFor();
      const mergeShown=()=>events.filter(e=>e.event==='tutorial_step'&&e.fields.step==='merge'&&e.fields.status==='shown');
      // Let the normal timer deliver multiple batches if another send is already in flight.
      const deadline=Date.now()+25000;
      while(!mergeShown().length&&Date.now()<deadline)await flush(p);
      assert.equal(mergeShown().length,1,JSON.stringify(events));
      await p.locator('.coach-skip').click();await p.locator('[data-action="leave"]').click();await p.locator('[data-action="save-leave"]').click();
      assert.ok((await stored(p)).active.run);await flush(p);await fresh.context.close();

      for(const [width,height,bright] of [[320,740,false],[390,844,false],[430,932,true],[844,390,true]]){
        const t=await boot({width,height,bright}),page=t.page;
        await shot(t,bright?'bright-home':'home');await page.locator('[data-action="settings"]').click();await page.locator('.analytics-settings').scrollIntoViewIfNeeded();await shot(t,'settings');
        assert.match(await page.locator('.analytics-settings').innerText(),/날짜별 건수/);
        assert.equal(await page.locator('.analytics-settings input,.analytics-settings button').count(),0);
        await close(page);await flush(page);await t.context.close();
      }
      const fixture=combatFixture(),t=await boot({profile:fixture.p}),page=t.page;
      await page.locator('[data-action="resume"]').click();await page.locator('#arena').waitFor();
      const skill=page.locator('[data-skill]').first(),box=await skill.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.locator('#skill-tip').waitFor();await page.mouse.up();
      const rect=await page.locator('#arena').boundingBox(),point=i=>{const p=E.cellPoint(i);return {x:rect.x+p.x/720*rect.width,y:rect.y+p.y/780*rect.height};},a=point(0),b=point(1);
      await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();
      await page.locator(`[data-skill="${fixture.hero}"]`).click();await page.locator('[data-action="summon-battle"]').click();
      await page.locator('[data-action="pause"]').click();await shot(t,'battle-paused');
      for(const selector of ['.skills','.battle-controls']){const r=await page.locator(selector).boundingBox();assert.ok(r.y+r.height<=844+1,selector+' fits portrait');}
      let run=E.restore((await stored(page)).active.run);assert.equal(run.stats.merges,1);assert.equal(run.stats.skills,1);
      const time=run.time;await page.waitForTimeout(250);await page.evaluate(()=>dispatchEvent(new Event('pagehide')));assert.equal(E.restore((await stored(page)).active.run).time,time);
      await page.locator('[data-action="auto"]').click();assert.equal((await stored(page)).settings.auto,true);
      await page.locator('[data-action="auto"]').click();
      await page.locator('[data-action="pause"]').click();await page.waitForTimeout(150);
      await page.evaluate(()=>window.__quota=true);await page.locator('[data-action="pause"]').click();assert.equal(await page.locator('#pause-button').getAttribute('aria-label'),'전투 재개');
      await page.evaluate(()=>window.__quota=false);await page.locator('[data-action="pause"]').click();
      await t.context.setOffline(true);await page.locator('[data-action="summon-battle"]').click();await page.locator('[data-action="leave"]').click();await page.locator('[data-action="save-leave"]').click();
      const saved=await stored(page);assert.ok(parseProfile(JSON.stringify(saved)).active.run);
      await t.context.setOffline(false);await page.reload();await page.locator('[data-action="resume"]').click();await page.locator('#arena').waitFor();
      await page.locator('[data-action="leave"]').click();await page.locator('[data-action="retire"]').click();await page.locator('[data-action="confirm-retire"]').click();await page.locator('#sheet[data-kind="result"]').waitFor();assert.equal((await stored(page)).active,null);await close(page);
      await page.locator('[data-action="settings"]').click();const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const file=await download;
      assert.ok(parseProfile(await fs.readFile(await file.path(),'utf8')));
      await page.locator('#backup-input').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.locator('#confirm-import').click();assert.ok((await stored(page)).active.run);
      const keys=await page.evaluate(()=>Object.keys(localStorage));assert.deepEqual(keys,[SAVE_KEY]);await flush(page);await t.context.close();

      for(const [phase,wave,band] of [['victory',6,'4_6'],['defeat',1,'1_3'],['defeat',4,'4_6'],['defeat',7,'7_9'],['defeat',10,'10_plus']]){
        const before=events.length;
        const t=await boot({profile:combatFixture(phase,wave).p});await t.page.locator('[data-action="resume"]').click();await t.page.locator('#sheet[data-kind="result"]').waitFor();const saved=await stored(t.page);assert.equal(saved.active,null);assert.equal(saved.cleared,phase==='victory'?1:0);
        await flush(t.page);
        const ends=events.slice(before).filter(e=>e.event==='battle_end');
        assert.deepEqual(ends.map(e=>[e.fields.result,e.fields.wave]),[[phase==='victory'?'win':'loss',band]]);
        if(phase==='victory'||wave===1)await shot(t,phase);
        await t.context.close();
      }
      for(const fault of ['read','sortie']){
        const before=events.length,t=await boot({storageBlocked:fault==='read'?'read':false});
        if(fault==='sortie'){
          await t.page.locator('.lb-depart').click();
          await t.page.evaluate(()=>window.__quota=true);
          await t.page.locator('[data-begin="main"]').click();
          await t.page.locator('[data-begin="main"]').click();
          assert.equal((await stored(t.page)).active,null);
        }
        await flush(t.page);
        assert.equal(events.slice(before).filter(e=>e.event==='game_error'&&e.fields.code==='save_unavailable').length,1,fault);
        await t.context.close();
      }
      const memoryProfile=veteran(createProfile(NOW));memoryProfile.heroes.star_boy.bond=10;memoryProfile.partner='star_boy';
      const memory=await boot({profile:memoryProfile});await memory.page.route('**/*.avif',r=>r.abort());
      await memory.page.locator('[data-action="bond"]').click();await memory.page.locator('.bond-memory').click();
      await memory.page.waitForFunction(()=>document.getElementById('memory-art')?.getAttribute('aria-busy')==='false');
      const memorial=memory.page.locator('img[data-memorial]');assert.match(await memorial.getAttribute('src'),/\.webp$/);assert.ok(await memorial.evaluate(i=>i.complete&&i.naturalWidth>0));await shot(memory,'memorial-fallback');await memory.context.close();
      const disabledBefore=events.length,disabled=await boot({enabled:false,storageBlocked:true});
      await disabled.page.locator('[data-action="settings"]').click();assert.match(await disabled.page.locator('.analytics-settings').innerText(),/수집하지 않습니다/);await disabled.page.evaluate(()=>dispatchEvent(new Event('pagehide')));await disabled.context.close();assert.equal(events.length,disabledBefore);
      assert.deepEqual(errors,[]);assert.deepEqual(csp,[]);assert.deepEqual(external,[]);
      for(const event of ['game_boot','tutorial_step','battle_start','battle_end','backup_action'])assert.ok(events.some(e=>e.event===event),'received '+event);
      reports.push({browser:name,captures,events:events.length,errors,csp,external});
      console.log(`PASS ${name}: ${captures.length} HTTP captures; tutorial, touch-sized controls, drag/skill, save/resume, backup, quota/offline, settlement, aggregate schema`);
    }finally{await browser.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(reports,null,2));}
  }
}finally{await on.close();await off.close();await fs.rm(scratch,{recursive:true,force:true});}
