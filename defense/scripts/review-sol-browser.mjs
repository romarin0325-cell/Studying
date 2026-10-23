// Focused visual verification of the new eight, not the whole game's UI suite.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {COMPANION_VISUALS} from '../src/combat/companion-vfx.js';
import {HERO} from '../src/content.js';
import {gameRoot} from './local-inputs.mjs';
const output=path.join(gameRoot,'test-results/sol-vfx'),review=path.join(gameRoot,'docs/review/sol-vfx');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1120,height:1000},hasTouch:true});
const page=await context.newPage(),errors=[],network=[],cases=[];let peakImpacts=0;
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
const contacts={attack:[],skill:[]},allIds=Object.keys(COMPANION_VISUALS);
const filterAt=process.argv.indexOf('--heroes'),filter=filterAt>=0?process.argv[filterAt+1].split(','):null,ids=allIds.filter(id=>!filter||filter.includes(id));
try{
  await page.goto(pathToFileURL(path.join(review,'index.html')).href);await context.setOffline(true);
  await page.waitForFunction(()=>window.SOL_REVIEW?.galleryReady);
  async function scene(config,time=.3){
    const result=await page.evaluate(({config,time})=>window.SOL_REVIEW.select(config,time),{config,time});
    for(const field of ['damage','gauge','sacrificed','bombs','shots'])assert.equal(result.draws[0][field],result.draws[1][field],config.hero+' '+field);
    for(const draw of result.draws){assert.ok(draw.impacts<=128);peakImpacts=Math.max(peakImpacts,draw.impacts);}
    cases.push({config,time:result.time,draws:result.draws});return result;
  }
  for(const hero of ids){const index=allIds.indexOf(hero);
    for(const mode of ['attack','skill']){
      const time=mode==='skill'?(hero==='toffee_apple'?1.48:.24):hero==='toffee_apple'?.22:.3;
      await scene({hero,mode,theme:'night',dense:true,crowded:false,reduced:false},time);
      const pair=[];for(const name of ['before','after'])pair.push(await page.locator('#'+name).screenshot());
      const label=Buffer.from(`<svg width="780" height="30"><rect width="780" height="30" fill="#191722"/><text x="12" y="21" font-family="sans-serif" font-size="16" fill="#eed4a0">${hero} · ${mode} | before / after</text></svg>`);
      contacts[mode].push({input:label,left:index%2*780,top:Math.floor(index/2)*452});
      for(const [i,input] of pair.entries())contacts[mode].push({input:await sharp(input).resize(390,422).png().toBuffer(),left:index%2*780+i*390,top:Math.floor(index/2)*452+30});
      if(['underdog','toffee_apple','ash','antropy'].includes(hero)&&mode==='skill')await page.locator('#player').screenshot({path:path.join(output,hero+'-pair.png')});
    }
    for(const side of ['left','right']){
      const result=await scene({hero,mode:'attack',dense:false,crowded:false,side,reduced:false},.4);
      assert.equal(result.draws[1].facing,side,hero+' actual engine facing '+side);
      await page.locator('#after').screenshot({path:path.join(output,hero+'-'+side+'.png')});
    }
    for(const mode of ['attack','skill'])await scene({hero,mode,theme:'bright',dense:true,crowded:false,reduced:true},hero==='toffee_apple'&&mode==='skill'?1.6:.4);
    await scene({hero,mode:'attack',theme:'night',dense:true,crowded:true,reduced:false},2);
    await page.locator('#after').screenshot({path:path.join(output,hero+'-crowded.png')});
  }
  for(const mode of ['attack','skill']){
    const existing=filter?await fs.readFile(path.join(review,'contact-'+mode+'.webp')):null;
    const image=existing?sharp(existing):sharp({create:{width:1560,height:1808,channels:4,background:'#191722'}});
    await image.composite(contacts[mode]).webp({quality:86}).toFile(path.join(review,'contact-'+mode+'.webp'));
  }
  // Operate the public controls as well as the deterministic seek API.
  await page.selectOption('#hero','joker');await page.selectOption('#mode','skill');await page.check('#reduced');await page.uncheck('#crowded');
  await page.locator('#play').click();await page.waitForTimeout(250);await page.locator('#play').click();
  assert.ok(await page.evaluate(()=>window.SOL_REVIEW.state.time)>0);
  await page.setViewportSize({width:390,height:844});
  await scene({hero:filter?ids[0]:'venom',mode:'skill',crowded:false,reduced:false,theme:'night'},.24);
  const geometry=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,canvases:[...document.querySelectorAll('.stage canvas')].map(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}))}));
  assert.ok(geometry.document<=geometry.width);assert.ok(geometry.canvases.every(c=>c.width>=350&&c.width<=390));
  await page.locator('#player').screenshot({path:path.join(output,'mobile-player.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const report={cases:cases.length,errors,externalRequests:network,peakImpacts,geometry,scenarios:cases,limits:'Offline desktop Chromium emulation, not physical Android/iOS, thermal or long-duration certification.'};
  await fs.writeFile(path.join(output,filter?'validation-'+filter.join('-')+'.json':'validation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({cases:cases.length,errors:errors.length,externalRequests:network.length,peakImpacts,geometry}));
}finally{await browser.close();}
