import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {simulateBattle} from '../src/combat/engine.js';
import {expeditionEncounter} from '../src/combat/encounter.js';
import {snapshot} from '../src/systems/growth.js';
import {newState,HOUR,DAY} from '../src/core/state.js';
import {exportSave,validateAndMigrate} from '../src/core/migrations.js';
const root=path.resolve(import.meta.dirname,'..'),url=pathToFileURL(path.join(root,'dist/AstralCompanions.html')).href;
const browser=await chromium.launch({headless:true}),errors=[],network=[],checks=[];
const observe=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});};
const ready=async p=>{await p.waitForFunction(()=>window.__ASTRAL_TEST__);await idle(p);};
const idle=p=>p.waitForFunction(()=>!window.__ASTRAL_TEST__.ui.busy&&!window.__ASTRAL_TEST__.ui.advancing);
const close=async p=>{if(await p.locator('dialog').evaluate(d=>d.open)){await p.locator('.close-dialog').click();await idle(p);}};
const imageReady=async p=>{await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));assert.equal(await p.locator('.art.failed').count(),0);};
async function shot(p,name,full=false){await imageReady(p);await p.screenshot({path:path.join(root,'docs/review/'+name+'.png'),fullPage:full,animations:'disabled',style:'#toast{visibility:hidden}'});}
async function click(p,selector){await p.locator(selector).first().click();await idle(p);}
async function tab(p,name){await close(p);await p.getByRole('button',{name,exact:true}).click();await idle(p);}
const get=p=>p.evaluate(()=>window.__ASTRAL_TEST__.state());
async function restore(p,s){await close(p);await p.evaluate(async text=>{window.__ASTRAL_TEST__.ui.line=null;await window.__ASTRAL_TEST__.store.restore(text);},exportSave(s));await idle(p);}
async function loadFixture(p,name){const s=validateAndMigrate(await fs.readFile(path.join(root,'tests/fixtures/'+name+'.json'),'utf8'));s.clockOffsetMs=s.lastTrustedLogicalMs-Date.now();await restore(p,s);return s;}
async function answer(p,wrong=false){const q=await p.evaluate(()=>window.__ASTRAL_TEST__.state().gates.challenge.question);const index=q.options.findIndex(a=>wrong?a!==q.answer:a===q.answer);await click(p,'[data-action=answer][data-index="'+index+'"]');}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 await context.setOffline(true);
 const p=await context.newPage();observe(p);await p.goto(url);await ready(p);
 assert.equal(await p.evaluate(()=>window.__ASTRAL_TEST__.store.mode),'indexedDB');
 await p.getByRole('button',{name:'우리의 첫날 시작하기'}).click();await idle(p);
 await shot(p,'mobile-home',true);
 assert.equal((await get(p)).wallets.memoryTickets,6);
 await tab(p,'영웅');const oldLevel=(await get(p)).heroes.lumi.level;await p.getByRole('button',{name:'+ 1',exact:true}).click();await idle(p);assert.equal((await get(p)).heroes.lumi.level,oldLevel+1);await shot(p,'mobile-hero',true);
 await tab(p,'원정');await click(p,'[data-action=battle][data-hero=zeke]');await imageReady(p);await shot(p,'mobile-battle');
 await click(p,'[data-action=battleFinish]');assert.equal((await get(p)).heroes.zeke.stage,1);await close(p);
 checks.push('new profile, tutorial, growth, battle and durable result');
 await tab(p,'수집');await click(p,'[data-action=summon][data-count="10"]');
 const saved=await get(p),batchId=saved.gacha.batches.at(-1).id,results=saved.gacha.batches.at(-1).results;
 await p.reload();await ready(p);assert.deepEqual((await get(p)).gacha.batches.at(-1).results,results);
 await tab(p,'수집');await click(p,'[data-action=resumeSummon]');await click(p,'[data-action=summonSkip]');await p.waitForFunction(()=>window.__ASTRAL_TEST__.state().gacha.batches.at(-1).revealed);await shot(p,'mobile-summon');
 const count=(await get(p)).gacha.counts.companion;await click(p,'[data-action=gate][data-gate=echo]');await answer(p,true);assert.equal((await get(p)).gacha.counts.companion,count);await answer(p);assert.equal((await get(p)).gacha.counts.companion,count+1);await close(p);checks.push('10-draw reload resumes committed results, wrong echo answer has no cost, normal +1 draw');
 const time=Date.now(),offline=newState(time-12*HOUR,21);offline.ui.tutorialDone=true;await restore(p,offline);await tab(p,'홈');await click(p,'[data-action=claim]');const base=await get(p);assert.ok(base.lastClaim.base.xp>=1800);assert.equal(base.gates.used.return,undefined);await shot(p,'mobile-return');
 await click(p,'[data-action=gate][data-gate=return]');assert.equal(await p.locator('[data-action=answer]').count(),0);assert.ok(await p.locator('.lecture').innerText());await click(p,'[data-action=lecture]');const before=await get(p);await answer(p,true);assert.equal((await get(p)).wallets.xp,before.wallets.xp);await answer(p);assert.equal((await get(p)).wallets.xp-before.wallets.xp,600);await close(p);
 await click(p,'[data-action=gate][data-gate=grace]');await answer(p);assert.ok((await get(p)).gates.grace);await close(p);checks.push('12h base first, mandatory grammar lecture, retry without loss, exact4h extra and grace');
 const day7=await loadFixture(p,'day7');await tab(p,'홈');await shot(p,'day7-home');
 for(const id of ['zeke','lumi','queen','jasmine','luna']){await click(p,'[data-action=heroSelect][data-hero="'+id+'"]');await shot(p,'home-'+id);}
 await tab(p,'교류');await click(p,'[data-action=scene]:not([disabled])');await imageReady(p);const sceneId=await p.evaluate(()=>document.querySelector('[data-action=sceneSkip]').dataset.scene);await shot(p,'mobile-story');await click(p,'[data-action=sceneSkip]');assert.ok((await get(p)).readScenes.includes(sceneId));await close(p);checks.push('day7 progress, five hero portrait composition and scene skip reward');
 let mixed=await get(p);for(const id of ['s01_lumi_whale','bond_jasmine_01','archive_queen_01','archive_zeke_01','bond_zeke_01'])if(!mixed.memories.includes(id))mixed.memories.push(id);await restore(p,mixed);await tab(p,'수집');await click(p,'[data-action=collectionMode][data-mode=album]');await shot(p,'mobile-album',true);
 await click(p,'[data-action=memory][data-memory=s01_lumi_whale]');await click(p,'[data-action=homeArt]');await shot(p,'mobile-shared-home',true);
 assert.match(await p.locator('.hero-nameplate').innerText(),/루미/);assert.match(await p.locator('.hero-nameplate').innerText(),/은하고래/);assert.doesNotMatch(await p.locator('.hero-nameplate').innerText(),/루나/);
 assert.equal(await p.locator('.art-home img').evaluate(i=>getComputedStyle(i).objectFit),'contain');
 assert.equal(await p.locator('.art-home img').evaluate(i=>i.naturalWidth/i.naturalHeight),1.5);
 await click(p,'.portrait-wrap');await imageReady(p);assert.equal(await p.locator('.viewer-stage img').evaluate(i=>getComputedStyle(i).objectFit),'contain');
 await shot(p,'mobile-shared-viewer');await p.locator('#art-zoom').fill('2');await p.locator('#art-zoom').dispatchEvent('input');assert.equal(await p.locator('.viewer-stage').evaluate(e=>e.classList.contains('zoomed')),true);await click(p,'[data-action=viewerReset]');await close(p);
 checks.push('mixed aspect album, shared home and viewer preserve both characters; zoom/reset');
 await loadFixture(p,'day30');await tab(p,'원정');await click(p,'[data-action=expMode][data-mode=boss]');await shot(p,'day30-bosses',true);await click(p,'[data-action=bossInfo]:not([disabled])');await shot(p,'mobile-boss-detail');await close(p);
 await tab(p,'영웅');await click(p,'[data-action=assignDialog][data-slot="1"]');await click(p,'[data-action=assign][data-companion=guardian]');let assigned=Object.values((await get(p)).heroes).flatMap(h=>h.companions).filter(Boolean);assert.equal(assigned.length,new Set(assigned).size);
 await tab(p,'원정');await click(p,'[data-action=expMode][data-mode=adventure]');await click(p,'[data-action=adventureStart]');let run=await get(p);const seed=run.adventure.seed;await shot(p,'mobile-adventure');await click(p,'[data-action=adventureAbandon]');await click(p,'[data-action=adventureStart]');assert.equal((await get(p)).adventure.seed,seed);

 for(let step=0;step<25;step++){const r=(await get(p)).adventure;if(r.failed||r.finished)break;if(r.offer.length){const pref=['patient_guard','warm_return','overflowing_mana','glass_star','little_companion'],id=pref.find(x=>r.offer.includes(x))||r.offer[0];await click(p,'[data-action=adventureRelic][data-item="'+id+'"]');}else if([1,3,5,8].includes(r.node)){await click(p,'[data-action=adventureBattle]');await click(p,'[data-action=battleFinish]');await close(p);}else await click(p,'[data-action=adventureEvent][data-choice="0"]');}
 const finalAdventure=(await get(p)).adventure;assert.equal(finalAdventure.finished,true,'representative eight-node route completes');await shot(p,'mobile-adventure-finished',true);
 checks.push('day30 boss access, unique support assignment, deterministic adventure retry, full eight-node route');
 const stalled=await loadFixture(p,'day30');let near=null;
 for(const heroId of Object.keys(stalled.heroes)){const e=expeditionEncounter(heroId,stalled.heroes[heroId].stage+1);for(const style of [0,1])for(const hold of [false,true]){const l=snapshot(stalled,heroId);l.style=style;l.tactics.hold=hold;const r=simulateBattle(l,e);const remaining=r.enemyHP/r.enemyMaxHP;if(r.winner==='enemy'&&remaining>0&&(!near||remaining<near.remaining))near={heroId,style,hold,remaining};}}
 assert.ok(near&&near.remaining<=.25,'actual day30 loadout can produce a close defeat');stalled.ui.hero=near.heroId;stalled.heroes[near.heroId].style=near.style;stalled.heroes[near.heroId].tactics.hold=near.hold;await restore(p,stalled);
 await tab(p,'원정');await click(p,'[data-action=expMode][data-mode=lanes]');await click(p,'[data-action=battle][data-hero="'+near.heroId+'"]');await click(p,'[data-action=battleFinish]');const actualFailure=(await get(p)).lastResult;assert.equal(actualFailure.winner,'enemy');await shot(p,'day30-close-defeat');
 await click(p,'[data-action=analysis]');await shot(p,'day30-analysis',true);const analysis=await p.evaluate(()=>window.__ASTRAL_TEST__.ui.analysis);assert.equal(analysis.baseline.replayDigest,actualFailure.replayDigest);
 await close(p);await tab(p,'영웅');await click(p,'[data-action=style][data-value="'+(1-near.style)+'"]');await click(p,'[data-action=tacticsPreset][data-preset=survival]');const changed=await get(p);assert.equal(changed.heroes[near.heroId].style,1-near.style);assert.equal(changed.heroes[near.heroId].tactics.preset,'survival');
 await tab(p,'원정');await click(p,'[data-action=battle][data-hero="'+near.heroId+'"]');const preview=await p.evaluate(()=>window.__ASTRAL_TEST__.getBattle().result.replayDigest);await click(p,'[data-action=battleFinish]');assert.equal((await get(p)).lastResult.replayDigest,preview);await close(p);
 checks.push('actual day30 close defeat, same-engine analysis, two free loadout changes and deterministic retry');
 await loadFixture(p,'missed');await tab(p,'홈');await click(p,'[data-action=season]');assert.ok((await get(p)).memories.includes('s01_lumi_whale'));await shot(p,'missed-day-season',true);await close(p);
 await loadFixture(p,'comeback');await tab(p,'홈');const returned=await get(p);assert.ok(returned.rewards.comebackEnd>returned.lastTrustedLogicalMs);await shot(p,'comeback-home',true);
 checks.push('one missed day still unlocks final seasonal memory; three-day return boost fixture stays active');
 await loadFixture(p,'day30');

 // No horizontal page overflow at the three actual delivery sizes.
 for(const viewport of [{width:360,height:800},{width:390,height:844},{width:1280,height:720}]){await p.setViewportSize(viewport);for(const name of ['홈','원정','영웅','교류','수집']){await tab(p,name);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow at '+viewport.width);}if(viewport.width===1280){await tab(p,'홈');await shot(p,'desktop-home');await tab(p,'수집');await click(p,'[data-action=collectionMode][data-mode=album]');await shot(p,'desktop-album',true);}}
 checks.push('360/390/1280 widths: all five tabs have no horizontal overflow');
 // Revision conflicts between two actual tabs: exactly one stale economic command wins.
 const raceFixture=await get(p);raceFixture.wallets.xp+=1000000;raceFixture.wallets.gold+=3000000;await restore(p,raceFixture);
 const p2=await context.newPage();observe(p2);await p2.goto(url);await ready(p2);
 await Promise.all([p,p2].map(page=>page.evaluate(async()=>{const t=window.__ASTRAL_TEST__,record=await t.store.readRecord();t.store.state=record.state;})));
 const beforeRace=await get(p),revision=beforeRace.revision,heroId='lumi';
 const race=await Promise.all([p,p2].map((page,i)=>page.evaluate(async({revision,i,heroId})=>{try{await window.__ASTRAL_TEST__.store.dispatch({type:'level',heroId,count:1,id:'race-'+i,expectedRevision:revision});return 'ok';}catch(e){return e.message;}},{revision,i,heroId})));
 assert.equal(race.filter(r=>r==='ok').length,1);assert.equal(race.filter(r=>r==='REVISION_CONFLICT').length,1);
 await p2.close();await p.reload();await ready(p);assert.equal((await get(p)).heroes.lumi.level,beforeRace.heroes.lumi.level+1);
 checks.push('concurrent IndexedDB tabs commit only one expected-revision purchase; reload persists');
 await tab(p,'홈');await click(p,'[data-action=settings]');const beforeImport=await get(p);const invalid={...beforeImport,schemaVersion:999};await p.locator('#save-file').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(exportSave(invalid))});await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('지원하지'));assert.equal((await get(p)).schemaVersion,1);
 const valid=validateAndMigrate(await fs.readFile(path.join(root,'tests/fixtures/new.json'),'utf8'));valid.clockOffsetMs=valid.lastTrustedLogicalMs-Date.now();await p.locator('#save-file').setInputFiles({name:'new.json',mimeType:'application/json',buffer:Buffer.from(exportSave(valid))});await click(p,'[data-action=confirmImport]');assert.equal((await get(p)).heroes.lumi.level,1);
 const backups=await p.evaluate(async()=>{const r=await window.__ASTRAL_TEST__.store.readRecord();return r.previous.length;});assert.equal(backups,2);
 checks.push('UI rejects future schema, imports valid backup and retains two previous saves');
 await close(p);await tab(p,'홈');await p.locator('.portrait-wrap').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('dialog').evaluate(d=>d.open),true);await p.keyboard.press('Escape');assert.equal(await p.locator('dialog').evaluate(d=>d.open),false);
 await p.evaluate(async()=>{const t=window.__ASTRAL_TEST__;await t.store.dispatch({type:'homeArt',itemId:null,id:'clear-art'});await t.store.dispatch({type:'settings',values:{hero:'lumi'},id:'broken-hero'});window.ASTRAL_IMAGES.lumi='data:image/webp;base64,bm90LWFuLWltYWdl';t.render();});
 await p.waitForFunction(()=>document.querySelector('.art-home.failed'));assert.equal(await p.locator('.art-home .image-fallback').evaluate(e=>e.hidden),false);await tab(p,'영웅');assert.ok(await p.locator('[data-action=level]').count());checks.push('keyboard artwork viewer and Escape work; one broken image leaves names, controls and app usable');

 await context.close();
 for(const mode of ['localStorage','memory']){
  const c=await browser.newContext({viewport:{width:390,height:844}});await c.setOffline(true);await c.addInitScript(({mode})=>{Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw new DOMException('denied','SecurityError');}}});if(mode==='memory')Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('denied','SecurityError');}});},{mode});
  const page=await c.newPage();observe(page);await page.goto(url);await ready(page);assert.equal(await page.evaluate(()=>window.__ASTRAL_TEST__.store.mode),mode);await click(page,'[data-action=tutorial]');
  if(mode==='memory'){assert.match(await page.locator('.state-note').innerText(),/백업/);await shot(page,'mobile-storage-fallback');}
  else{const before=await get(page);await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});const failed=await page.evaluate(async()=>{try{await window.__ASTRAL_TEST__.store.dispatch({type:'summon',pool:'companion',count:10,id:'quota'});return false;}catch{return true;}});assert.equal(failed,true);const after=await get(page);assert.equal(after.wallets.companionTickets,before.wallets.companionTickets);assert.equal(after.gacha.counts.companion,before.gacha.counts.companion);}
  checks.push(mode+' fallback'+(mode==='localStorage'?' with quota failure rolls back spend and RNG':' explicitly warns that persistence is unavailable'));await c.close();
 }
 assert.deepEqual(errors,[],'browser errors');assert.deepEqual(network,[],'external network attempts');
 const evidence={browser:'Chromium '+browser.version(),offlineURL:'file://AstralCompanions.html',checks,errors,externalRequests:network.length,viewports:[360,390,1280],physicalDevices:false};
 await fs.writeFile(path.join(root,'docs/browser-evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
