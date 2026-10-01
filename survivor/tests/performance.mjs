// Optional isolated rAF benchmark. Not a real-phone FPS claim.
import {chromium} from 'playwright';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),label=process.argv[2]||'review';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Use an alphanumeric report label');
const output=path.join(repo,'survivor/test-results');await fs.mkdir(output,{recursive:true});
const html=await fs.readFile(repo+'/survivor/dist/AstraNocturne.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const assets=scripts.find(x=>x[1].includes('globalThis.NOCTURNE_ASSETS='))[1];
const bundle=await build({stdin:{contents:`import {Game} from '${repo}/survivor/src/engine.js';import {Renderer,loadArt} from '${repo}/survivor/src/render.js';globalThis.BENCH={Game,Renderer,loadArt};`,resolveDir:repo},bundle:true,write:false,format:'iife',target:'es2020'});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:680},deviceScaleFactor:2,offline:true});const page=await context.newPage();
await page.setContent(`<style>body{margin:0;background:#142123}canvas{width:390px;height:680px}</style><canvas id="canvas"></canvas><script>${assets}</script><script>${bundle.outputFiles[0].text}</script>`);
const quality=process.argv[3]||'high';if(!['high','auto','economy'].includes(quality))throw new Error('Unknown quality');
const result=await page.evaluate(async quality=>{
 const {Game,Renderer,loadArt}=BENCH,art=await loadArt(),g=new Game({seed:78});g.enemies=[];
 for(const id of ['blade','ember','flower','frost','storm'])g.applyOption({type:'weapon',id});for(const w of g.weapons){w.level=6;w.evolved=true;}
 for(let i=0;i<260;i++){const angle=i*Math.PI*2/260,r=90+(i%8)*24;g.spawnEnemy(['beetle','moth','stalker','wisp'][i%4],{x:800+Math.cos(angle)*r,y:800+Math.sin(angle)*r,hp:1000000,maxHp:1000000,damage:0,speed:1});}
 const renderer=new Renderer(document.getElementById('canvas'),art,{effects:true,numbers:true,quality});renderer.camera.x=800;renderer.camera.y=800;const samples=[],cadence=[];let lastFrame=performance.now();
 for(let i=0;i<330;i++){await new Promise(requestAnimationFrame);const start=performance.now();if(i>=30)cadence.push(start-lastFrame);lastFrame=start;g.step(1/60);renderer.events(g.drainEvents());renderer.render(g,1/60);const elapsed=performance.now()-start;if(i>=30)samples.push(elapsed);}
 const sorted=[...samples].sort((a,b)=>a-b),cadenceSorted=cadence.sort((a,b)=>a-b);return {quality,effectiveDPR:renderer.dpr,frames:300,viewport:[390,680],dpr:devicePixelRatio,mean:+(samples.reduce((a,b)=>a+b)/samples.length).toFixed(2),p50:+sorted[150].toFixed(2),p95:+sorted[285].toFixed(2),max:+sorted.at(-1).toFixed(2),cadenceP50:+cadenceSorted[150].toFixed(2),cadenceP95:+cadenceSorted[285].toFixed(2),enemies:g.enemies.length,shots:g.shots.length,cacheMiB:+([...renderer.cache.values(),...renderer.numbers.values(),...renderer.backdrops.values(),renderer.vignette,renderer.canvas].reduce((n,i)=>n+i.width*i.height*4,0)/1024/1024).toFixed(2),decodedMiB:+(Object.values(art.images).reduce((n,i)=>n+i.width*i.height*4,0)/1024/1024).toFixed(2)};
},quality);
await page.screenshot({path:path.join(output,`perf-${label}.png`)});await fs.writeFile(path.join(output,`perf-${label}.json`),JSON.stringify(result,null,2));console.log(label,result);await browser.close();
