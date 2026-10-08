import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import sharp from 'sharp';
import {HEROES,ARTIFACTS,ASSET_PATHS} from '../src/content.js';
import {gameRoot as game,assetFile} from './local-inputs.mjs';
import {MEMORIAL_MEDIA_PATHS,MEMORIAL_WEBP_PATHS,MEMORIAL_MEDIA_MANIFEST} from '../src/memorial-media.js';

const solo=process.argv.includes('--solo'),web=process.argv.includes('--web'),compat=process.argv.includes('--compat');
if(web&&(solo||compat))throw new Error('Choose folder or standalone distribution.');
const output=path.join(game,compat?'test-results/compat':solo?'test-results/solo':web?'test-results/web':'dist');
const filename=solo?compat?'StarGardenDefenseSoloCompat.html':'StarGardenDefenseSolo.html':compat?'StarGardenDefenseCompat.html':'StarGardenDefense.html';
const mode=web?'web':compat?'compat':'standalone',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const byteLength=value=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value));
const readText=async file=>(await fs.readFile(file,'utf8')).replace(/\r\n/g,'\n');
const assets={},media={},memorial={},memorialFallback={};
const sizes={battle:0,portraits:0,figures:0,relics:0,avif:0,webp:0,avifMax:0,webpMax:0};
for(const [id,relative] of Object.entries(ASSET_PATHS)){
  const bytes=await fs.readFile(assetFile(relative)),metadata=await sharp(bytes).metadata();
  if(!metadata.width||!metadata.height)throw new Error('Invalid canonical art: '+id);
  sizes.battle+=bytes.length;assets[id]='data:image/webp;base64,'+bytes.toString('base64');
}
for(const h of HEROES){
  const file=assetFile(ASSET_PATHS[h.art.atlas]),p=h.art.portrait;
  if(!p)throw new Error('Missing reviewed portrait frame: '+h.id);
  const crop={left:Math.round(p.x-p.size/2),top:Math.round(p.y-p.size/2),width:p.size,height:p.size};
  const portrait=await sharp(file).extract(crop).resize(240,240).webp({quality:88}).toBuffer();
  const figure=await sharp(file).extract({left:0,top:0,width:512,height:512}).webp({quality:90}).toBuffer();
  sizes.portraits+=portrait.length;sizes.figures+=figure.length;
  media['portrait:'+h.id]='data:image/webp;base64,'+portrait.toString('base64');
  media['figure:'+h.id]='data:image/webp;base64,'+figure.toString('base64');
}
for(const a of ARTIFACTS){
  const file=assetFile(ASSET_PATHS[a.atlas]),m=await sharp(file).metadata(),columns=a.atlas==='relics'?5:2,rows=a.atlas==='relics'?4:2,w=m.width/columns,h=m.height/rows;
  const bytes=await sharp(file).extract({left:a.icon%columns*w,top:Math.floor(a.icon/columns)*h,width:w,height:h}).resize(240,240,{fit:'contain'}).webp({quality:87}).toBuffer();
  sizes.relics+=bytes.length;media['relic:'+a.id]='data:image/webp;base64,'+bytes.toString('base64');
}
const expectedIds=HEROES.map(h=>h.id).sort().join(',');
for(const map of [MEMORIAL_MEDIA_PATHS,MEMORIAL_WEBP_PATHS,MEMORIAL_MEDIA_MANIFEST]){
  if(Object.keys(map).sort().join(',')!==expectedIds||HEROES.length!==30)throw new Error('Memorial roster mismatch.');
}
async function readMemorial(id,format){
  const entry=MEMORIAL_MEDIA_MANIFEST[id],record=format==='avif'?entry:entry.webp;
  const bytes=await fs.readFile(assetFile(format==='avif'?MEMORIAL_MEDIA_PATHS[id]:MEMORIAL_WEBP_PATHS[id]));
  const meta=await sharp(bytes).metadata(),sha256=record.outputSha256??record.sha256;
  if(meta.width!==720||meta.height!==1080||(meta.pages??1)!==1||Boolean(meta.hasAlpha)!==record.hasAlpha||
     (format==='avif'?meta.format!=='heif'||meta.compression!=='av1':meta.format!=='webp')||
     bytes.length!==record.bytes||hash(bytes)!==sha256||bytes.length>=100*1024)throw new Error('Memorial media contract: '+id+' '+format);
  sizes[format]+=bytes.length;sizes[format+'Max']=Math.max(sizes[format+'Max'],bytes.length);
  return bytes;
}
if(web)await fs.mkdir(path.join(output,'memorial'),{recursive:true});
for(const h of HEROES){
  // Compatibility reads WebP only. Neither standalone build re-encodes media.
  const formats=web?['avif','webp']:[compat?'webp':'avif'];
  for(const format of formats){
    const bytes=await readMemorial(h.id,format);
    if(web){
      const name=`${h.id}.${hash(bytes).slice(0,12)}.${format}`;
      await fs.writeFile(path.join(output,'memorial',name),bytes);
      (format==='avif'?memorial:memorialFallback)[h.id]='./memorial/'+name;
    }else memorial[h.id]=`data:image/${format};base64,`+bytes.toString('base64');
  }
}
if(sizes.avif>=2.5*1024*1024||sizes.webp>=2.5*1024*1024||(!web&&byteLength(memorial)>=3*1024*1024))throw new Error('Memorial aggregate budget exceeded.');
const font=await fs.readFile(assetFile('./assets/Jua-Regular.woff2')),license=await readText(assetFile('./assets/Jua-OFL.txt'));
const fontUri='data:font/woff2;base64,'+font.toString('base64');
const css=(await readText(path.join(game,'src/style.css'))).replace('__FONT__',fontUri);
const js=await build({entryPoints:[path.join(game,'src/app.js')],bundle:true,write:false,metafile:true,format:'iife',target:['es2020'],minify:true,charset:'utf8',legalComments:'inline',define:{__GARDEN_SOLO__:String(solo)}});
for(const input of Object.keys(js.metafile.inputs)){
  const relative=path.relative(game,path.resolve(input));
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('External game source in Star Garden bundle: '+input);
}
const source=(await readText(path.join(game,'index.html'))).replace('<title>드림위버: 별빛 정원</title>',solo?'<title>드림위버: 별빛 정원 · 1인 편성 테스트</title>':'<title>드림위버: 별빛 정원</title>');
for(const token of ['/*__STYLE__*/','/*__ASSETS__*/','/*__SCRIPT__*/'])if(source.split(token).length!==2)throw new Error('Build token mismatch: '+token);
const injected=`window.__ASTRA_ASSETS__=${JSON.stringify(assets)};window.__GARDEN_MEDIA__=${JSON.stringify(media)};window.__MEMORIAL_MEDIA__=${JSON.stringify(memorial)};${web?`window.__MEMORIAL_FALLBACK__=${JSON.stringify(memorialFallback)};`:''}`;
const bundle=js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=source.replace('/*__STYLE__*/',()=>css).replace('/*__ASSETS__*/',()=>injected).replace('/*__SCRIPT__*/',()=>bundle).replace('</head>',()=>`<!-- Jua font, SIL OFL 1.1\n${license.replaceAll('--','—')}\n-->\n</head>`);
if(/__FONT__|\/\*__\w+__\*\//.test(html)||/<(?:script|link)[^>]*(?:src|href)=["'](?:\.\/|https?:)/i.test(html))throw new Error('Non-offline build');
await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,filename),html);
const objects=prefix=>byteLength(Object.fromEntries(Object.entries(media).filter(([id])=>id.startsWith(prefix))));
const categories={
  css:byteLength(css)-byteLength(fontUri),javascript:byteLength(bundle),
  font:{binaryBytes:font.length,embeddedBytes:byteLength(fontUri)},
  battleAtlases:{binaryBytes:sizes.battle,embeddedBytes:byteLength(assets)},
  companionPortraits:{binaryBytes:sizes.portraits,embeddedBytes:objects('portrait:')},
  companionFigures:{binaryBytes:sizes.figures,embeddedBytes:objects('figure:')},
  relicIcons:{binaryBytes:sizes.relics,embeddedBytes:objects('relic:')},
  memorial:{format:web?'external AVIF + WebP':compat?'WebP':'AVIF',avifBinaryBytes:sizes.avif,webpBinaryBytes:sizes.webp,avifMaxBytes:sizes.avifMax,webpMaxBytes:sizes.webpMax,embeddedBytes:byteLength(memorial)+(web?byteLength(memorialFallback):0)}
};
const categorized=categories.css+categories.javascript+Object.values(categories).filter(v=>typeof v==='object').reduce((sum,v)=>sum+v.embeddedBytes,0);
const report={mode,solo,filename,htmlBytes:byteLength(html),categories,htmlAndObjectGlueBytes:byteLength(html)-categorized};
await fs.mkdir(path.join(game,'test-results'),{recursive:true});
await fs.writeFile(path.join(game,'test-results',`build-size-${mode}${solo?'-solo':''}.json`),JSON.stringify(report,null,2)+'\n');
const mib=n=>(n/1024/1024).toFixed(3)+' MiB';
console.log(`${filename} · ${mib(report.htmlBytes)} · ${mode} · ${solo?'one-person':'five-person'} deck`);
for(const [name,value] of Object.entries(categories)){
  if(typeof value==='number')console.log(`${name}: ${mib(value)}`);
  else if(name==='memorial')console.log(`Memorial ${value.format}: AVIF ${mib(sizes.avif)} / WebP ${mib(sizes.webp)} binary · ${mib(value.embeddedBytes)} embedded paths/data`);
  else console.log(`${name}: ${mib(value.binaryBytes)} binary · ${mib(value.embeddedBytes)} embedded`);
}
console.log(`HTML, license and object glue: ${mib(report.htmlAndObjectGlueBytes)}`);
