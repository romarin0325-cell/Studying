// Focused mobile regression for library ink, memorial display and exclusive deck oaths.
// Run after npm run build:defense: node defense/tests/library-lobby.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createProfile,SAVE_KEY,parseProfile} from '../src/profile.js';
import {CONSTELLATIONS} from '../src/library.js';
import {eventWindow} from '../src/preview/season.js';

const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(game,'test-results'),NOW=Date.parse('2026-11-13T06:00:00Z');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[];
const close=page=>page.locator('#sheet .sheet-top [data-action="close"]').click();
const read=page=>page.evaluate(()=>window.STAR_GARDEN.profile);
async function shot(page,name){
  await page.screenshot({path:path.join(output,`${name}-390x844.png`),animations:'disabled'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
}
async function ink(page,selector){
  const colors=await page.locator(selector).evaluateAll(es=>es.map(e=>getComputedStyle(e).color));
  assert.ok(colors.length,selector);
  const luminance=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const paper=luminance([251,247,240]);
  for(const color of colors){
    const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number);
    assert.ok((paper+.05)/(luminance(rgb)+.05)>=3,`${selector}: ${color} must read on paper`);
  }
}
// A painting is whole: its box keeps the image's own ratio, its corners stay square and no other element covers them.
async function whole(page,selector){
  const r=await page.locator(selector).evaluate(img=>{const b=img.getBoundingClientRect(),st=getComputedStyle(img),bw=parseFloat(st.borderLeftWidth),w=b.width-2*bw,h=b.height-2*bw;
    const pts=[[b.left+bw+3,b.top+bw+3],[b.right-bw-3,b.top+bw+3],[b.left+bw+3,b.bottom-bw-3],[b.right-bw-3,b.bottom-bw-3]];
    return {ratio:Math.abs((w/h)/(img.naturalWidth/img.naturalHeight)-1),corner:parseFloat(st.borderTopLeftRadius)-bw,covered:pts.filter(([x,y])=>document.elementFromPoint(x,y)!==img).length};});
  assert.ok(r.ratio<.01&&r.corner<=.5&&r.covered===0,`${selector} shows the whole painting: ${JSON.stringify(r)}`);
}
// Library lists stay inside the screen and fold long subtitles instead of cutting them.
async function rowsFit(page){
  const bad=await page.locator('.lec-row').evaluateAll(rs=>rs.filter(r=>r.getBoundingClientRect().right>innerWidth-1||[...r.querySelectorAll('b,small')].some(t=>t.scrollWidth>t.clientWidth+1)).map(r=>r.textContent.trim().slice(0,20)));
  assert.deepEqual(bad,[],'library rows fit the screen');
}
try{
  for(const bright of [false,true]){
    const skin=bright?'bright':'night',profile=createProfile(NOW);
    profile.cleared=10;profile.ftue={legacy:true,done:[],seen:[],skipped:false};profile.beginner=null;profile.firstTen=true;profile.eventSeen=eventWindow(NOW).id;
    profile.heroes.star_boy.bond=10;profile.heroes.snow_rabbit.bond=10;
    profile.study.library.index=1;profile.study.library.stars=0;profile.study.library.unlocked=[CONSTELLATIONS[0].id];
    assert.ok(parseProfile(profile));
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
    const page=await context.newPage();await page.clock.setFixedTime(NOW);
    page.on('pageerror',e=>errors.push(`${skin}: ${e.message}`));
    const url=pathToFileURL(path.join(game,`dist/StarGardenDefense${bright?'Bright':''}.html`)).href;
    await page.route('**/*',route=>/^https?:/.test(route.request().url())?route.abort():route.continue());
    await page.route(url,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture</title>'}),{times:1});
    await page.goto(url);await page.evaluate(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEY,profile});
    await page.goto(url);await page.locator('.scene-partner').waitFor();
    await page.locator('[data-action="library"]').click();
    // Seven same-size gallery cards; the gallery opens on the constellation being earned, a side card centres first.
    assert.equal(await page.locator('.gal-card').count(),CONSTELLATIONS.length);
    const boxes=await page.locator('.gal-card').evaluateAll(es=>es.map(e=>e.offsetWidth+'x'+e.offsetHeight));
    assert.equal(new Set(boxes).size,1,`gallery cards share one size: ${boxes}`);
    assert.equal(await page.locator('.gal-card.on').getAttribute('data-gallery-card'),'1');
    await page.locator('[data-gallery-card="0"]').click();await page.waitForFunction(()=>document.querySelector('.gal-card.on')?.dataset.galleryCard==='0');
    assert.equal(await page.locator('#overlay').isHidden(),true,'a side card centres before it opens');
    await whole(page,'.gal-card.on .gal-art img');
    await page.locator('.gal-card.on').click();await whole(page,'#sheet .art-frame img');
    if(bright)await ink(page,'.art-reveal figcaption');
    await shot(page,`${skin}-library-art`);await close(page);
    await page.locator('.tabbar [data-library-tab="lecture"]').click();
    if(bright)await ink(page,'.lec-info b');await rowsFit(page);
    await page.locator('[data-lecture]').first().click();
    if(bright)await ink(page,'.lecture p,.lecture b');
    await shot(page,`${skin}-lecture`);await close(page);
    await page.locator('[data-library-tab="term"]').click();await rowsFit(page);await page.locator('[data-term]').first().click();
    if(bright)await ink(page,'.term-ja,.lecture p,.lecture b');
    await shot(page,`${skin}-term`);await close(page);
    await page.locator('[data-nav="home"]').first().click();
    const openMemory=async()=>{await page.locator('.lb-name[data-action="bond"]').click();await page.locator('[data-memorial="star_boy"]').click();};
    await openMemory();
    const pin=page.locator('[data-lobby="star_boy"]');
    assert.match(await pin.textContent(),/로비에 걸기/);await pin.click();assert.equal(await pin.getAttribute('aria-pressed'),'true');
    await close(page);await page.locator('#lobby-memorial').waitFor();
    await page.locator('.lb-name[data-action="bond"]').click();await page.locator('#sheet-footer [data-action="partner"]').click();
    await page.locator('[data-set-partner="snow_rabbit"]').click();
    assert.equal((await read(page)).lobby,null);assert.equal(await page.locator('#lobby-memorial').count(),0);
    await page.locator('.lb-name[data-action="bond"]').click();await page.locator('#sheet-footer [data-action="partner"]').click();
    await page.locator('[data-set-partner="star_boy"]').click();
    await page.reload();await page.locator('.scene-partner').waitFor();await openMemory();
    assert.equal(await pin.getAttribute('aria-pressed'),'false');assert.match(await pin.textContent(),/로비에 걸기/);
    await shot(page,`${skin}-memorial-unpinned`);
    await pin.click();await close(page);await page.locator('#lobby-memorial').waitFor();
    await openMemory();await pin.click();await close(page);assert.equal(await page.locator('#lobby-memorial').count(),0);
    await page.locator('[data-nav="adventure"]').click();await page.locator('[data-mode="oath"]').click();
    await page.locator('[data-action="prepare-mode"]').click();
    const noBeam=page.locator('[data-oath="nobeam"]'),rabbits=page.locator('[data-oath="rabbits"]');
    assert.match(await noBeam.textContent(),/\+2/);assert.match(await rabbits.textContent(),/\+4/);
    await noBeam.click();await rabbits.click();
    assert.equal(await noBeam.getAttribute('aria-pressed'),'false');assert.equal(await rabbits.getAttribute('aria-pressed'),'true');
    await noBeam.click();assert.equal(await rabbits.getAttribute('aria-pressed'),'false');
    assert.equal(await noBeam.getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('[data-begin="oath"]').isDisabled(),false);
    await close(page);await page.locator('[data-mode="monthly"]').click();
    await page.locator('[data-action="mode-info"][data-kind="monthly"]').click();
    assert.match(await page.locator('#sheet-body').textContent(),/110 \+ 격파 보스당 38, 완주 시 \+165/);
    await context.close();console.log(`PASS ${skin}: library ink, memorial partner switch/reload, oath exclusivity, monthly rule text (390×844)`);
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
