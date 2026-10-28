// Capture pass 20 comparison frames from the portable review page (Chromium, offline).
// Usage: node defense/scripts/capture-pass20-vfx.mjs [--ring=0] [key:mode:theme:t1,t2 ...]
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {gameRoot} from './local-inputs.mjs';
import {ENTRIES} from '../docs/review/pass20-vfx/scene.js';
const out=path.join(gameRoot,'test-results/pass20-vfx');await fs.mkdir(out,{recursive:true});
const args=process.argv.slice(2),ring=!args.includes('--ring=0');
const specs=args.filter(arg=>arg!=='--ring=0');
const jobs=specs.length?specs.map(j=>{const [key,mode,theme,times]=j.split(':');if(!key||!mode||!theme||!times)throw Error('Invalid capture job: '+j);const values=times.split(',').map(Number);if(values.some(t=>!Number.isFinite(t)||t<0))throw Error('Invalid capture time: '+j);return {key,mode,theme,times:values};}):ENTRIES.map(e=>({key:e.key,mode:e.modes[0],theme:'night',times:e.moments}));
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:900,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(pathToFileURL(path.join(gameRoot,'docs/review/pass20-vfx/index.html')).href);
  await page.waitForFunction(()=>window.PASS20_REVIEW?.state?.ready,null,{timeout:60000});
  await page.waitForFunction(()=>window.PASS20_REVIEW?.galleryReady,null,{timeout:60000});
  for(const job of jobs)for(const t of job.times){
    await page.evaluate(([c,t])=>window.PASS20_REVIEW.select(c,t),[{key:job.key,mode:job.mode,theme:job.theme,ring},t]);
    const file=path.join(out,`${job.key}-${job.mode}-${job.theme}-${t.toFixed(2)}.png`);
    await page.locator('.stage').screenshot({path:file});console.log(file);
  }
}finally{console.log(JSON.stringify({errors}));await browser.close();}
if(errors.length)process.exitCode=1;
