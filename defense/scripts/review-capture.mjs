// Before/after strips from a built review page (docs/review/<page>/index.html) for self-review of VFX; serves the game folder itself.
//   node defense/scripts/review-capture.mjs --key <scene> --times 0.2,0.5 [--page ur-vfx-20261106] [--config {"theme":"bright"}] [--only after]
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {gameRoot} from './local-inputs.mjs';

const args=process.argv.slice(2),value=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing value for '+name);return args[i+1];};
const key=value('--key'),timesArg=value('--times'),pageName=value('--page','ur-vfx-20261106'),config=JSON.parse(value('--config','{}')),scale=Number(value('--scale','0.5')),only=value('--only');
if(!key||!timesArg)throw new Error('Usage: --key <scene> --times <seconds,...> [--page <folder>] [--config <json>] [--scale <number>] [--only after] [--out <file.png>]');
if(!pageName||pageName==='.'||pageName==='..'||/[/\\]/.test(pageName))throw new Error('Invalid review page folder');
if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('--config must be a JSON object');
const times=timesArg.split(',').map(s=>s.trim()===''?NaN:Number(s));
if(times.some(t=>!Number.isFinite(t))||!Number.isFinite(scale)||scale<=0||Math.round(720*scale)<1||Math.round(780*scale)<1)throw new Error('Invalid times or scale');
if(only&&only!=='after')throw new Error('--only must be after');
const safe=s=>String(s).replace(/[^a-zA-Z0-9_.-]/g,'_'),flags=Object.entries(config).map(([k,v])=>safe(k)+safe(v)).join('_');
const output=path.resolve(value('--out',path.join(gameRoot,'test-results/review-captures',pageName,safe(key)+(flags?'-'+flags:'')+'.png')));
const server=http.createServer(async(req,res)=>{
  try{
    const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(gameRoot,relative),inside=path.relative(gameRoot,file);
    if(inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside)){res.writeHead(403).end();return;}
    const bytes=await fs.readFile(file),ext=path.extname(file).toLowerCase();
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png'})[ext]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
let browser;
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1300,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/review/${encodeURIComponent(pageName)}/index.html`);
  await page.waitForFunction(()=>window.UR_REVIEW?.state?.ready);
  const keys=await page.evaluate(()=>window.UR_REVIEW.entries.map(entry=>entry.key));
  if(!keys.includes(key))throw new Error('Unknown review key '+key+'; available keys: '+keys.join(', '));
  const W=Math.round(720*scale),H=Math.round(780*scale),tiles=[];
  for(const [i,t] of times.entries()){
    const shot=await page.evaluate(([c,time])=>{const st=window.UR_REVIEW.select(c,time);return {st,before:document.getElementById('before').toDataURL('image/png'),after:document.getElementById('after').toDataURL('image/png')};},[{...config,key},t]);
    for(const [row,url] of (only?[shot.after]:[shot.before,shot.after]).entries())tiles.push({input:await sharp(Buffer.from(url.split(',')[1],'base64')).resize(W,H).png().toBuffer(),left:i*(W+4),top:row*(H+4)});
    console.log(t,JSON.stringify(shot.st.after));
  }
  await fs.mkdir(path.dirname(output),{recursive:true});
  await sharp({create:{width:times.length*(W+4)-4,height:only?H:2*H+4,channels:3,background:'#444'}}).composite(tiles).png().toFile(output);
  console.log(output);
}finally{
  try{if(browser)await browser.close();}finally{if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
