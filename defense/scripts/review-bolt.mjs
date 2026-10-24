// 390x844 Lightning Sage basic-attack frames. Uses the production renderer.
// Output stays in defense/test-results/bolt and is not committed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {ASSET_PATHS} from '../src/content.js';
import {assetFile} from './local-inputs.mjs';

const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const label=process.argv[2]==='before'?'before':'after';
const outDir=path.join(game,'test-results','bolt');
await fs.mkdir(outDir,{recursive:true});

function mime(file){
  const ext=path.extname(file).toLowerCase();
  if(ext==='.webp')return 'image/webp';
  if(ext==='.png')return 'image/png';
  throw new Error('Unknown image type '+file);
}
async function dataUrl(relative){
  const file=assetFile(relative);
  const bytes=await fs.readFile(file);
  return `data:${mime(file)};base64,${bytes.toString('base64')}`;
}

const ids=['garden','creatures','bosses','effects','unit-lightning_sage'];
const images={};
for(const id of ids)images[id]=await dataUrl(ASSET_PATHS[id]);
images['bright-garden']=await dataUrl('./assets/bright/garden.webp');

const bundle=await build({
  entryPoints:[path.join(game,'scripts','bolt-review-view.js')],
  bundle:true,
  write:false,
  format:'esm',
  target:['es2022'],
  charset:'utf8',
  legalComments:'none',
});
const html=`<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=390,height=844">
<title>번개의현자 일반 공격</title>
<style>
html,body{margin:0;width:390px;height:844px;overflow:hidden;background:#08101e}
canvas{display:block;width:390px;height:422px;margin:118px 0 0}
</style>
<canvas id="board" width="720" height="780"></canvas>
<script>window.BOLT_DATA=${JSON.stringify({images})};</script>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script>
</html>
`;
const htmlPath=path.join(outDir,'review.html');
await fs.writeFile(htmlPath,html);

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
await page.goto(pathToFileURL(htmlPath).href,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>window.BOLT&&window.BOLT.ready,null,{timeout:120000});
const times=await page.evaluate(()=>window.BOLT.times);
if(!times?.length)throw new Error('No Lightning Sage attack frames');
// Locked to the engine clock from the staged volley: launch, mid-flight,
// the first chain, the busiest bolt frame, the next held flicker, then the fade.
const frames=[
  {name:'01-fire',t:.167},
  {name:'02-travel',t:.25},
  {name:'03-chain',t:.333},
  {name:'04-strike',t:.45},
  {name:'05-flicker',t:.533},
  {name:'06-fade',t:.75},
];
const shots=frames.map(frame=>({...frame,file:`${label}-${frame.name}.png`,quality:'standard',reduced:false,theme:'night'}));
shots.push(
  {name:'07-bright',t:.45,file:`${label}-07-bright.png`,quality:'standard',reduced:false,theme:'bright'},
  {name:'08-low',t:.45,file:`${label}-08-low.png`,quality:'low',reduced:false,theme:'night'},
  {name:'09-reduced',t:.45,file:`${label}-09-reduced.png`,quality:'standard',reduced:true,theme:'night'},
);
const written=[];
for(const shot of shots){
  const shown=await page.evaluate(spec=>window.BOLT.show(spec),shot);
  const file=path.join(outDir,shot.file);
  await page.screenshot({path:file,animations:'disabled'});
  written.push({file:shot.file,...shown,shots:shot.shots,bolt:shot.bolt,chains:shot.chains,impacts:shot.impacts});
  console.log(`${shot.file} t=${shot.t} theme=${shot.theme} quality=${shot.quality} reduced=${shot.reduced}`);
}
const samples=await page.evaluate(()=>window.BOLT.samples);
await fs.writeFile(path.join(outDir,`${label}-frames.json`),JSON.stringify({label,times,samples,written,errors},null,2)+'\n');
await browser.close();
if(errors.length)throw new Error(errors.join('\n'));
