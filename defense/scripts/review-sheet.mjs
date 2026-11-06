// One contact sheet of every sequenced ultimate at its peak, plus three unchanged references (Ash, Zeke, Phantom), from the built
// review page (docs/review/<page>/index.html, "after" column). Used for the colour-identity and consistency judgement (pass 3).
//   node defense/scripts/review-sheet.mjs [--theme night|bright|dawn] [--palette v2|v1] [--page ur-vfx-20261106] [--out <file.png>]
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {gameRoot} from './local-inputs.mjs';
const args=process.argv.slice(2),value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const theme=value('--theme','night'),palette=value('--palette','v2'),pageName=value('--page','ur-vfx-20261106');
if(/[/\\]/.test(pageName)||pageName==='.'||pageName==='..')throw new Error('Invalid review page folder');
const out=path.resolve(value('--out',path.join(gameRoot,'test-results/review-captures',`review-sheet-${theme}-${palette}.png`)));
// [scene key, seconds, caption]: the moment each one's identity peaks.
const SHOTS=[['cherry',.62,'체리프린스 UR'],['luna',.62,'루나 UR'],['frost',.5,'혹한의마녀 UR'],['harmony',.62,'하모니어스 UR'],['jasmine',1.05,'자스민 UR'],
  ['queen',1,'여왕 UR'],['trauma',.9,'시간의마술사 SR'],['whale',1.25,'은하고래 UR'],['rewind',.85,'시간의지배자 UR'],['cinderella',1.6,'신데렐라 UR'],
  ['venom',1,'베놈 UR'],['doom',1.07,'둠 UR'],['rumi',.9,'루미 UR'],['rumi-dream',1.45,'루미 꿈의 형태'],['red-dragon',.52,'레드드래곤 R'],
  ['aurora',3.8,'아우로라 R'],['star-boy',.42,'별똥별소년 C'],['ash',.62,'애쉬 SR (기준)'],['zeke',.8,'지크 UR (기준)'],['phantom',.5,'팬텀 SR (기준)']];
const server=http.createServer(async(req,res)=>{
  try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(gameRoot,relative),inside=path.relative(gameRoot,file);
    if(inside.startsWith('..')||path.isAbsolute(inside)){res.writeHead(403).end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'}).end(await fs.readFile(file));}
  catch{res.writeHead(404).end();}
});
let browser;
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1300,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}/docs/review/${encodeURIComponent(pageName)}/index.html`);await page.waitForFunction(()=>window.UR_REVIEW?.state?.ready);
  const W=360,H=390,cols=5,tiles=[];
  for(const [i,[key,t,caption]] of SHOTS.entries()){
    const data=await page.evaluate(([c,time])=>{window.UR_REVIEW.select(c,time);return document.getElementById('after').toDataURL('image/png');},[{key,theme,palette},t]);
    const left=(i%cols)*(W+4),top=Math.floor(i/cols)*(H+4),label=Buffer.from(`<svg width="${W}" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="30" fill="#000000b0"/><text x="8" y="21" font-family="Malgun Gothic, sans-serif" font-size="17" fill="#ffffff">${caption} · ${t}s</text></svg>`);
    tiles.push({input:await sharp(Buffer.from(data.split(',')[1],'base64')).resize(W,H).png().toBuffer(),left,top},{input:label,left,top:top+H-30});
  }
  await fs.mkdir(path.dirname(out),{recursive:true});
  await sharp({create:{width:cols*(W+4)-4,height:Math.ceil(SHOTS.length/cols)*(H+4)-4,channels:3,background:'#222222'}}).composite(tiles).png().toFile(out);console.log(out);
}finally{
  try{if(browser)await browser.close();}finally{if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
