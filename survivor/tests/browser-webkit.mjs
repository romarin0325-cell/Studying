import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {webkit} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifact=path.join(root,'dist/AstraNocturne.html'),output=path.join(root,'test-results');
await fs.mkdir(output,{recursive:true});
const browser=await webkit.launch({headless:true}),errors=[],requests=[];
// Fast early growth can legitimately interrupt a tap with a mandatory reward.
// Complete that real UI choice before checking pause; never dismiss the modal or
// alter the production game state from the test.
const pauseRun=async page=>{
  for(let attempt=0;attempt<12;attempt++){
    if(await page.locator('[data-action="unpause"]').count())return;
    const action=await page.evaluate(()=>document.querySelector('.dialog [data-action="choice"],.dialog [data-action="claim-treasure"],.dialog [data-action="encounter-choice"]')?.dataset.action);
    if(action){await page.locator(`.dialog [data-action="${action}"]`).first().tap();continue;}
    try{await page.locator('[data-action="pause"]').tap({timeout:1500});await page.locator('[data-action="unpause"]').waitFor({timeout:1500});return;}
    catch(error){if(!await page.locator('.dialog').count())throw error;}
  }
  throw new Error('Unable to pause after completing rewards');
};
try{
  for(const [width,height] of [[390,844],[844,390],[1280,900]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
    // WebKit treats file navigation as offline network navigation. Block HTTP
    // before loading, then disconnect the context for all playback checks.
    await page.goto(pathToFileURL(artifact).href);await context.setOffline(true);await page.locator('[data-action="start"]').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.fonts.check('17px Nocturne','별빛 정원')),true);
    assert.equal(await page.locator('.hero-pick').count(),9);
    await page.locator('[data-action="select-hero"][data-value="jasmine"]').tap();
    assert.equal(await page.locator('[data-value="jasmine"]').getAttribute('aria-pressed'),'true');
    await page.screenshot({path:path.join(output,`webkit-home-${width}x${height}.png`)});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('[data-action="start"]').tap();await page.locator('#battle-canvas').waitFor();
    const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')).player.x);
    await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.locator('[data-action="unpause"]').waitFor();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')));
    assert.ok(saved.player.x>initial+15,'WebKit keyboard movement');assert.equal(saved.mode,'paused');
    await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')).time),saved.time);
    await page.locator('[data-action="leave"]').tap();await context.setOffline(false);await page.reload();await context.setOffline(true);await page.locator('[data-action="resume"]').waitFor();await page.locator('[data-action="resume"]').tap();await pauseRun(page);
    const resumed=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')));assert.ok(Math.abs(resumed.player.x-saved.player.x)<5);
    // Import a real user backup through the file control; keep active-run stats.
    await page.locator('[data-action="settings"]').tap();
    const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.profile.v1')));profile.crystals=90;profile.meta.power=2;profile.settings.effects=false;
    // DevTools offline also blocks WebKit's local File.text() I/O. HTTP remains
    // blocked while reading a user file, then playback is disconnected again.
    await context.setOffline(false);await page.locator('#import-file').setInputFiles({name:'memories.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(profile))});
    await page.locator('[data-action="confirm-import"]').waitFor();await page.locator('[data-action="confirm-import"]').tap();await context.setOffline(true);
    const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.profile.v1')));assert.equal(imported.meta.power,2);assert.equal(imported.settings.effects,false);assert.equal(resumed.meta.power,0,'memories apply to the next expedition');
    await page.setViewportSize({width:height,height:width});await page.waitForTimeout(160);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.ok(await page.locator('#battle-canvas').evaluate(c=>c.width>0&&c.height>0));
    await page.locator('[data-action="unpause"]').tap();await page.locator('[data-action="dash"]').tap();await pauseRun(page);
    const finalRun=await page.evaluate(()=>JSON.parse(localStorage.getItem('astra.nocturne.run.v1')));assert.ok(finalRun.dashes>0);assert.equal(finalRun.meta.power,0,'import does not change the active expedition');
    await context.close();console.log(`PASS actual offline WebKit ${width}x${height}: tap, keyboard, blur, reload, resume, backup import, rotation, dash`);
  }
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
}finally{await browser.close();}
