import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
import {HEROES,ARTIFACTS,ASSET_PATHS} from '../src/content.js';
import {gameRoot as game,assetFile} from './local-inputs.mjs';
import {MEMORIAL_MEDIA_PATHS} from '../src/memorial.js';

const solo=process.argv.includes('--solo'),web=process.argv.includes('--web');
if(solo&&web)throw new Error('Choose one local test variant at a time.');
const output=path.join(game,solo?'test-results/solo':web?'test-results/web':'dist');
const filename=solo?'StarGardenDefenseSolo.html':'StarGardenDefense.html';

const assets={},media={},memorial={},memorialFallback={};let memorialBytes=0,memorialMax=0;
for(const [id,relative] of Object.entries(ASSET_PATHS)){
  const source=assetFile(relative),bytes=await fs.readFile(source);
  const metadata=await sharp(bytes).metadata();if(!metadata.width||!metadata.height)throw new Error('Invalid canonical art: '+id);
  assets[id]='data:image/webp;base64,'+bytes.toString('base64');
}
for(const h of HEROES){
  const file=assetFile(ASSET_PATHS[h.art.atlas]),p=h.art.portrait;
  if(!p)throw new Error('Missing reviewed portrait frame: '+h.id);
  const crop={left:Math.round(p.x-p.size/2),top:Math.round(p.y-p.size/2),width:p.size,height:p.size};
  const portrait=await sharp(file).extract(crop).resize(240,240).webp({quality:88}).toBuffer();
  const figure=await sharp(file).extract({left:0,top:0,width:512,height:512}).webp({quality:90}).toBuffer();
  media['portrait:'+h.id]='data:image/webp;base64,'+portrait.toString('base64');
  media['figure:'+h.id]='data:image/webp;base64,'+figure.toString('base64');
}
for(const a of ARTIFACTS){
  const file=assetFile(ASSET_PATHS[a.atlas]),m=await sharp(file).metadata(),columns=a.atlas==='relics'?5:2,rows=a.atlas==='relics'?4:2,w=m.width/columns,h=m.height/rows;
  const bytes=await sharp(file).extract({left:a.icon%columns*w,top:Math.floor(a.icon/columns)*h,width:w,height:h}).resize(240,240,{fit:'contain'}).webp({quality:87}).toBuffer();
  media['relic:'+a.id]='data:image/webp;base64,'+bytes.toString('base64');
}
for(const h of HEROES){
  const bytes=await fs.readFile(assetFile(MEMORIAL_MEDIA_PATHS[h.id])),meta=await sharp(bytes).metadata();
  if(meta.width!==720||meta.height!==1080||meta.hasAlpha||bytes.length>100*1024)throw new Error('Memorial media contract: '+h.id);
  memorialBytes+=bytes.length;memorialMax=Math.max(memorialMax,bytes.length);
  if(web){
    const {createHash}=await import('node:crypto'),hash=createHash('sha256').update(bytes).digest('hex').slice(0,12),stem=`${h.id}.${hash}`;
    await fs.mkdir(path.join(output,'memorial'),{recursive:true});await fs.writeFile(path.join(output,'memorial',stem+'.avif'),bytes);
    const fallback=await sharp(bytes).webp({quality:82,effort:6,smartSubsample:true}).toBuffer(),fallbackHash=createHash('sha256').update(fallback).digest('hex').slice(0,12),fallbackName=`${h.id}.${fallbackHash}.webp`;
    await fs.writeFile(path.join(output,'memorial',fallbackName),fallback);
    memorial[h.id]=`./memorial/${stem}.avif`;memorialFallback[h.id]=`./memorial/${fallbackName}`;
  }else memorial[h.id]='data:image/avif;base64,'+bytes.toString('base64');
}
if(Object.keys(memorial).length!==30||memorialBytes>=2.5*1024*1024||(!web&&Buffer.byteLength(JSON.stringify(memorial))>=3*1024*1024))throw new Error('Memorial count or aggregate budget exceeded.');
const font=await fs.readFile(assetFile('./assets/Jua-Regular.ttf')),license=await fs.readFile(assetFile('./assets/Jua-OFL.txt'),'utf8');
const css=(await fs.readFile(path.join(game,'src/style.css'),'utf8')).replace('__FONT__','data:font/ttf;base64,'+font.toString('base64'));
const js=await build({entryPoints:[path.join(game,'src/app.js')],bundle:true,write:false,metafile:true,format:'iife',target:['es2020'],minify:true,charset:'utf8',legalComments:'inline',define:{__GARDEN_SOLO__:String(solo)}});
for(const input of Object.keys(js.metafile.inputs)){
  const relative=path.relative(game,path.resolve(input));
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('External game source in Star Garden bundle: '+input);
}
const source=(await fs.readFile(path.join(game,'index.html'),'utf8')).replace('<title>ASTRA · 별빛 정원</title>',solo?'<title>ASTRA · 별빛 정원 · 1인 편성 테스트</title>':'<title>ASTRA · 별빛 정원</title>');
for(const token of ['/*__STYLE__*/','/*__ASSETS__*/','/*__SCRIPT__*/'])if(source.split(token).length!==2)throw new Error('Build token mismatch: '+token);
const html=source.replace('/*__STYLE__*/',()=>css).replace('/*__ASSETS__*/',()=>`window.__ASTRA_ASSETS__=${JSON.stringify(assets)};window.__GARDEN_MEDIA__=${JSON.stringify(media)};window.__MEMORIAL_MEDIA__=${JSON.stringify(memorial)};${web?`window.__MEMORIAL_FALLBACK__=${JSON.stringify(memorialFallback)};`:''}`).replace('/*__SCRIPT__*/',()=>js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')).replace('</head>',()=>`<!-- Jua font, SIL OFL 1.1\n${license.replaceAll('--','—')}\n-->\n</head>`);
if(/__FONT__|\/\*__\w+__\*\//.test(html)||/<(?:script|link)[^>]*(?:src|href)=["'](?:\.\/|https?:)/i.test(html))throw new Error('Non-offline build');
await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,filename),html);
console.log(`${filename} · ${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB · ${Object.keys(assets).length} battle textures · ${HEROES.length} companions · ${solo?'isolated one-person deck':web?'folder distribution':'standalone offline'}`);
console.log(`Memorial: 30 AVIF · total ${(memorialBytes/1024/1024).toFixed(3)} MiB · mean ${(memorialBytes/30/1024).toFixed(2)} KiB · max ${(memorialMax/1024).toFixed(2)} KiB · current image only`);
