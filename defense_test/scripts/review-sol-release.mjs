// Verify the shipped HTML and the changed SD surfaces at the target viewport.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {HERO,HEROES,LATE_COMPANIONS} from '../src/content.js';
import {createProfile,command,SAVE_KEY} from '../src/profile.js';
import {createBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
import {COMPANION_VISUALS} from '../src/combat/companion-vfx.js';
import {gameRoot} from './local-inputs.mjs';
import {loadImagePack} from './image-pack.mjs';
import {RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
const out=path.join(gameRoot,'test-results/sol-release');await fs.mkdir(out,{recursive:true});
const ids=Object.keys(COMPANION_VISUALS),selection=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/art/sol-20261023/selection.json')));
const optimized=await loadImagePack();
const filterAt=process.argv.indexOf('--heroes'),filter=filterAt>=0?process.argv[filterAt+1].split(','):null;
const browser=await chromium.launch(),errors=[],network=[],cases=[],NOW=Date.now();
function profile(deck,active=false){
  const p=createProfile(NOW);p.settings.sound=false;p.settings.auto=false;p.cleared=45;p.deck=[...deck];p.partner=deck[0];p.noticeLate=[...LATE_COMPANIONS];
  for(const h of HEROES)p.heroes[h.id].owned=true;
  if(active){
    assert.ok(command(p,'begin',{mode:'main',stage:1},NOW).ok);const s=createBattle(p),u={...s.board.find(Boolean)};s.board.fill(null);
    for(const [n,id] of deck.entries())s.board[[12,7,16,18,24][n]]={...u,uid:s.nextId++,hero:id,rank:n===4?2:1,cooldown:99,windup:0,pose:0,disabled:0,cursed:false,facing:'down'};
    s.queue=[{kind:'boss',hp:1e7}];s.spawnIn=0;E.step(s,.001);
    const e=structuredClone(s.enemies[0]);s.enemies=[680,780,890,1730,1830].map((progress,i)=>({...structuredClone(e),uid:s.nextId++,progress,speed:0,skillIn:99,kind:i?'grunt':'boss',boss:i?null:e.boss}));
    s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.gauge=120;s.gold=100;s.sunlight=3;s.events=[];
    p.active.run=E.serialize(s);assert.ok(E.restore(p.active.run),'real mobile fixture restores');
  }return p;
}
async function boot(file,p){
  const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await c.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  await page.addInitScript(({p,key})=>localStorage.setItem(key,JSON.stringify(p)),{p,key:SAVE_KEY});
  await page.goto(pathToFileURL(file).href);await c.setOffline(true);await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);
  return {c,page};
}
async function capture(page,label){
  await page.waitForFunction(()=>[...document.images].filter(i=>i.offsetParent!==null).every(i=>i.complete&&i.naturalWidth>0));
  // Finish finite sheet-entry animations before measuring the settled layout.
  await page.screenshot({path:path.join(out,label+'.png'),animations:'disabled'});
  const geometry=await page.evaluate(()=>({w:innerWidth,document:document.documentElement.scrollWidth,missing:[...document.images].filter(i=>i.offsetParent!==null&&(!i.complete||!i.naturalWidth)).map(i=>i.className),modal:!document.getElementById('overlay').hidden?{left:document.getElementById('sheet').getBoundingClientRect().left,right:document.getElementById('sheet').getBoundingClientRect().right,bottom:document.getElementById('sheet').getBoundingClientRect().bottom}:null}));
  assert.ok(geometry.document<=390,label+' horizontal overflow');assert.deepEqual(geometry.missing,[],label+' missing images');if(geometry.modal)assert.ok(geometry.modal.left>=0&&geometry.modal.right<=391&&geometry.modal.bottom<=845,label+' '+JSON.stringify(geometry.modal));
  cases.push({label,...geometry});
}
try{
  for(const [theme,name] of [['night','StarGardenDefense.html'],['bright','StarGardenDefenseBright.html']]){
    const file=path.join(gameRoot,'dist',name),html=await fs.readFile(file,'utf8');
    const begin=html.indexOf('window.__ASTRA_ASSETS__=')+'window.__ASTRA_ASSETS__='.length,end=html.indexOf(';window.__GARDEN_MEDIA__=',begin),embedded=JSON.parse(html.slice(begin,end));
    assert.equal(Object.keys(embedded).length,Object.keys(RUNTIME_ASSET_PATHS).length);for(const a of selection.assets){const source='./assets/merge/units/'+a.id+'.webp',entry=optimized.manifest.images.find(i=>i.source===source);assert.equal(entry.original.sha256,a.sha256,a.id+' preserved selection');assert.equal(createHash('sha256').update(Buffer.from(embedded['unit-'+a.id].split(',')[1],'base64')).digest('hex'),entry.output.sha256,theme+' '+a.id+' optimized selection');}
    if(!filter){const deck=[...ids.slice(0,4),'zeke'],lobby=await boot(file,profile(deck));
    await capture(lobby.page,theme+'-home');await lobby.page.locator('[data-nav="collection"]').click();
    for(const id of ids){
      await lobby.page.locator('.cc[data-hero="'+id+'"]').click();await lobby.page.locator('#sheet[data-kind="hero"]').waitFor();
      await capture(lobby.page,theme+'-portrait-'+id);await lobby.page.locator('#sheet-top [data-action="close"], .sheet-top [data-action="close"]').first().click();
    }await lobby.c.close();}
    for(const group of [ids.slice(0,4),ids.slice(4)]){
      const battle=await boot(file,profile([...group,'zeke'],true)),page=battle.page;await page.locator('[data-action="resume"]').click();await page.locator('#arena').waitFor();
      await page.evaluate(()=>{for(const u of window.STAR_GARDEN.battle.board)if(u)u.cooldown=0;});await page.waitForTimeout(500);
      await capture(page,theme+'-battle-'+group[0]);
      for(const id of group.filter(id=>!filter||filter.includes(id))){
        if(id==='ash')await page.evaluate(()=>{
          const s=window.STAR_GARDEN.battle;
          // Exercise an actual sacrifice, rather than silently sparing the
          // recipient still protected by Cure Master's preceding ultimate.
          if(s.board[12]?.hero==='cure_master'){s.board[0]=s.board[12];s.board[12]=null;}
          for(const u of s.board)if(u){u.invincible=0;if(u.hero!=='ash')u.rank=u.hero==='venom'?1:2;}
        });
        await page.evaluate(()=>{window.STAR_GARDEN.battle.gauge=120;window.STAR_GARDEN.battle.gold=200;});
        await page.waitForTimeout(80);const before=await page.evaluate(()=>window.STAR_GARDEN.battle.stats.skills);
        await page.locator('[data-skill="'+id+'"]').click();await page.waitForFunction(n=>window.STAR_GARDEN.battle.stats.skills>n,before);
        await page.locator('.cutin-art img').waitFor();assert.ok(await page.locator('.cutin-art img').evaluate(i=>i.complete&&i.naturalWidth>0));
        await capture(page,theme+'-cast-'+id);
        if(id==='ash')assert.equal(await page.evaluate(()=>window.STAR_GARDEN.battle.stats.sacrificed),1,'unprotected ally is visibly consumed');
        await page.waitForTimeout(1700);
      }
      // The embedded save remains valid after real ordinary attacks and casts.
      const state=await page.evaluate(()=>window.STAR_GARDEN.battle);assert.ok(E.restore(E.serialize(state)),'cast state survives save/restore');
      await battle.c.close();
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const report={cases:cases.length,errors,externalRequests:network,viewport:[390,844],scenarios:cases};await fs.writeFile(path.join(out,filter?'validation-'+filter.join('-')+'.json':'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,errors:errors.length,externalRequests:network.length}));
}finally{await browser.close();}
