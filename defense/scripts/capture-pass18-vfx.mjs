// Capture before/after frames from docs/review/pass18-vfx/index.html into test-results/pass18-vfx/ (Chromium, offline).
// Usage: node defense/scripts/capture-pass18-vfx.mjs [key:mode:theme:t1,t2 ...]
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {gameRoot} from './local-inputs.mjs';
const out=path.join(gameRoot,'test-results/pass18-vfx');await fs.mkdir(out,{recursive:true});
const jobs=(process.argv.slice(2).length?process.argv.slice(2):['zeke:attack:night:.08,.16,.3','demon_king:attack:night:.1,.2,.3','demon_king:skill:night:.15,.3,.45,.8','miracle_larva:skill:night:.2,.45,.8','miracle_cocoon:attack:night:.1,.2,.35','miracle_wing:attack:night:.2,.4,.55','abyss_wing:attack:night:.2,.4,.55','miracle_larva:attack:night:.2,.45']).map(j=>{const [key,mode,theme,times]=j.split(':');return {key,mode,theme,times:times.split(',').map(Number)};});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:900,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(pathToFileURL(path.join(gameRoot,'docs/review/pass18-vfx/index.html')).href);
await page.waitForFunction(()=>window.PASS18_REVIEW?.state?.ready,null,{timeout:60000});
for(const job of jobs)for(const t of job.times){
  await page.evaluate(([c,t])=>window.PASS18_REVIEW.select(c,t),[{key:job.key,mode:job.mode,theme:job.theme},t]);
  const file=path.join(out,`${job.key}-${job.mode}-${job.theme}-${t.toFixed(2)}.png`);
  await page.locator('.stage').screenshot({path:file});console.log(file);
}
console.log(JSON.stringify({errors}));await browser.close();
