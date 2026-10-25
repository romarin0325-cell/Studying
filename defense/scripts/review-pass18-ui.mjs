// Pass 18 UI capture on both release skins at 390x844: auto toggle, pause/retire, library wrong notes, quiz verdict,
// the stage 45 announcement and summon spotlights. Also lists text whose contrast with its painted ground is low.
// Usage: node defense/scripts/review-pass18-ui.mjs [--only name,...]
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createProfile,SAVE_KEY} from '../src/profile.js';
import {HEROES,LATE_COMPANIONS} from '../src/content.js';
import {allQuestions} from '../src/quiz.js';
import {gameRoot} from './local-inputs.mjs';
const out=path.join(gameRoot,'test-results/pass18-ui');await fs.mkdir(out,{recursive:true});
const onlyArg=process.argv.indexOf('--only'),only=onlyArg<0?null:new Set(process.argv[onlyArg+1].split(','));
const want=name=>!only||only.has(name);
const browser=await chromium.launch({headless:true}),errors=[],report={};
function fixture({cleared=60,owned=true,auto=true,late=true,wrong=true,dreams=50000}={}){
  const p=createProfile();p.cleared=cleared;p.noticeLate=late?[...LATE_COMPANIONS]:[];p.settings={sound:false,auto,reduced:false,quality:'standard'};p.dreams=dreams;
  for(const h of HEROES)if(owned){p.heroes[h.id].owned=true;p.heroes[h.id].bond=['behemoth','cure_master','antropy','sunflower'].includes(h.id)?10:3;}
  if(wrong){const qs=['lecture','term'].flatMap(k=>allQuestions(k).slice(0,3));p.study.wrong=qs.map((q,i)=>({kind:q.kind,id:q.id,choice:0,at:Date.now()-i*1000}));}
  return JSON.stringify(p);
}
async function open(theme,options){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(theme+': '+e.message));
  await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:fixture(options)});
  await page.goto(pathToFileURL(options?.unlocked?path.join(gameRoot,'test-results/unlocked',theme==='bright'?'StarGardenDefenseUnlockedBright.html':'StarGardenDefenseUnlocked.html'):path.join(gameRoot,'dist',theme==='bright'?'StarGardenDefenseBright.html':'StarGardenDefense.html')).href);
  await page.waitForFunction(()=>window.STAR_GARDEN?.profile);await page.waitForTimeout(400);return {context,page};
}
// Text nodes whose colour is too close to the ground painted under them (pixels sampled from a screenshot with that text hidden).
async function lowContrast(page,label){
  const items=await page.evaluate(()=>{
    const out=[],seen=new Set();
    for(const el of document.querySelectorAll('body *')){
      if(!el.childNodes.length||![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
      const r=el.getBoundingClientRect(),cs=getComputedStyle(el);if(r.width<4||r.height<4||cs.visibility==='hidden'||+cs.opacity===0||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;
      const key=Math.round(r.x)+':'+Math.round(r.y);if(seen.has(key))continue;seen.add(key);
      out.push({text:el.textContent.trim().slice(0,24),color:cs.color,x:r.x,y:r.y,w:r.width,h:r.height,cls:el.className&&typeof el.className==='string'?el.className:el.tagName});
    }return out.slice(0,160);
  });
  await page.addStyleTag({content:'body *{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}'});
  const shot=await page.screenshot();await page.evaluate(()=>document.querySelector('style:last-of-type')?.remove());
  const {default:sharp}=await import('sharp');const img=sharp(shot);const {width,height}=await img.metadata();const raw=await img.removeAlpha().raw().toBuffer();
  const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
  const flagged=[];
  for(const it of items){
    const m=it.color.match(/[\d.]+/g)?.map(Number);if(!m||m[3]===0)continue;
    let sum=[0,0,0],n=0;for(let y=Math.max(0,it.y*2);y<Math.min(height,(it.y+it.h)*2);y+=3)for(let x=Math.max(0,it.x*2);x<Math.min(width,(it.x+it.w)*2);x+=3){const i=(Math.floor(y)*width+Math.floor(x))*3;sum[0]+=raw[i];sum[1]+=raw[i+1];sum[2]+=raw[i+2];n++;}
    if(!n)continue;const bg=sum.map(v=>v/n),a=lum(m.slice(0,3)),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    if(ratio<3)flagged.push({...it,ratio:+ratio.toFixed(2),bg:bg.map(Math.round)});
  }
  report[label]=flagged;return flagged;
}
const shot=async(page,name)=>{await page.screenshot({path:path.join(out,name+'.png')});};
try{
  for(const theme of ['bright','night']){
    if(want('home')){const {context,page}=await open(theme);await shot(page,theme+'-home');await lowContrast(page,theme+'-home');await context.close();}
    if(want('late')){const {context,page}=await open(theme,{cleared:45,late:false});await page.locator('.late-notice').waitFor({timeout:5000}).catch(()=>{});await page.waitForTimeout(1600);await shot(page,theme+'-late');await lowContrast(page,theme+'-late');await context.close();}
    if(want('arrival')){const {context,page}=await open(theme,{unlocked:true});await page.locator('[data-action="settings"]').first().click();await page.locator('[data-test-tool="arrival"]').click();await page.waitForTimeout(500);await shot(page,theme+'-arrival-0.5');await page.waitForTimeout(2200);await shot(page,theme+'-arrival');await lowContrast(page,theme+'-arrival');await page.locator('#sheet-footer [data-action="close"]').click();await page.waitForTimeout(1600);await shot(page,theme+'-arrival-late');await context.close();}
    if(want('memorial')){
      const {context,page}=await open(theme);await page.evaluate(()=>{});
      for(const id of ['behemoth','cure_master','antropy','sunflower']){
        await page.evaluate(id=>{const p=window.STAR_GARDEN.profile;p.heroes[id].bond=10;},id);
        await page.getByRole('button',{name:'동료',exact:true}).click();await page.locator('[data-collection="album"]').click();
        await page.locator(`[data-memorial="${id}"]`).click();await page.waitForSelector('#memory-art[aria-busy="false"]',{timeout:8000}).catch(()=>{});
        await page.locator('[data-action="memorial-story"]').click();await page.waitForTimeout(500);await shot(page,`${theme}-memorial-${id}`);
        await page.locator('.mv-controls [data-action="close"]').click();await page.waitForTimeout(300);
      }
      await context.close();
    }
    if(want('battle')){
      const {context,page}=await open(theme);await page.getByRole('button',{name:'모험',exact:true}).click();await page.waitForTimeout(300);
      await page.locator('[data-prepare-stage]').first().click();await page.locator('[data-begin="main"]').first().click();await page.locator('#arena').waitFor();await page.waitForTimeout(2500);
      await shot(page,theme+'-battle');await lowContrast(page,theme+'-battle');
      await page.locator('[data-action="leave"]').click();await page.waitForTimeout(500);await shot(page,theme+'-pause');await lowContrast(page,theme+'-pause');
      await page.locator('[data-action="retire"]').click();await page.waitForTimeout(500);await shot(page,theme+'-retire');await lowContrast(page,theme+'-retire');
      await context.close();
    }
    if(want('library')){
      const {context,page}=await open(theme);await page.locator('.lb-btn[data-action="library"]').click();await page.waitForTimeout(500);await shot(page,theme+'-library');await lowContrast(page,theme+'-library');
      for(const tab of ['lecture','term']){await page.locator(`[data-library-tab="${tab}"]`).first().click();await page.waitForTimeout(400);await shot(page,theme+'-library-'+tab);await lowContrast(page,theme+'-library-'+tab);}
      await page.locator('.wrong-row').first().click().catch(()=>{});await page.waitForTimeout(500);await shot(page,theme+'-wrong-review');await lowContrast(page,theme+'-wrong-review');
      await context.close();
    }
    if(want('summon')){
      // Every NEW spotlight of several 10-pulls: where the figure's face and feet land against the screen centre.
      const {context,page}=await open(theme,{owned:false});await page.getByRole('button',{name:'소환',exact:true}).click();await page.waitForTimeout(400);
      const spots=[];
      for(let pull=0;pull<6;pull++){
        await page.locator('[data-draw="10"]').click();await page.locator('[data-action="quiz-skip"]').click({timeout:3000}).catch(()=>{});
        await page.waitForTimeout(1200);
        for(let i=0;i<12;i++){
          const spotting=await page.evaluate(()=>!!document.querySelector('#sheet .reveal-stage.spotting'));if(!spotting)break;
          await page.waitForTimeout(2900);
          const g=await page.evaluate(()=>{const img=document.querySelector('.reveal-spot .spot-figure img'),r=img?.getBoundingClientRect(),spot=document.querySelector('.reveal-spot');return img?{alt:img.alt,src:(img.currentSrc||img.src).slice(-40),x:r.x,w:r.width,y:r.y,h:r.height,fresh:spot.dataset.fresh,name:spot.querySelector('h3')?.textContent}:null;});
          if(g)spots.push(g);
          if(g&&spots.length<=4)await shot(page,`${theme}-spot-${spots.length}`);
          await page.locator('#sheet').click({position:{x:195,y:600}});await page.waitForTimeout(250);
        }
        await page.waitForTimeout(1200);if(pull===0)await shot(page,theme+'-summon-grid');
        await page.locator('#sheet [data-action="close"]').last().click().catch(()=>{});await page.waitForTimeout(400);
      }
      report[theme+'-spots']=spots;await context.close();
    }
  }
}finally{await browser.close();}
await fs.writeFile(path.join(out,'report.json'),JSON.stringify({errors,report},null,2));
console.log(JSON.stringify({errors,flagged:Object.fromEntries(Object.entries(report).map(([k,v])=>[k,Array.isArray(v)?v.map(x=>`${x.text}(${x.ratio})`):v]))},null,1));
