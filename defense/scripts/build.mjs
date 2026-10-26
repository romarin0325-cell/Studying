import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build,transform} from 'esbuild';
import sharp from 'sharp';
import {HEROES,ARTIFACTS} from '../src/content.js';
import {gameRoot as game,assetFile} from './local-inputs.mjs';
import {MEMORIAL_MEDIA_PATHS,MEMORIAL_WEBP_PATHS,MEMORIAL_MEDIA_MANIFEST} from '../src/memorial-media.js';
import {LIBRARY_ART} from '../src/library.js';
import {brightCss} from './theme-bright.mjs';
import {MUSIC} from '../src/audio-tracks.js';
import {RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {BRIGHT_ART,VISUAL_HEROES} from './image-policy.mjs';
import {loadImagePack} from './image-pack.mjs';

const solo=process.argv.includes('--solo'),web=process.argv.includes('--web'),compat=process.argv.includes('--compat'),unlocked=process.argv.includes('--unlocked'),bright=process.argv.includes('--bright');
if(unlocked&&(solo||web||compat))throw new Error('--unlocked cannot be combined with --solo, --web or --compat.');
if(web&&(solo||compat))throw new Error('Choose folder or standalone distribution.');
if(bright&&(solo||web||compat))throw new Error('--bright combines only with --unlocked.');
const outAt=process.argv.indexOf('--outdir');
if(outAt>=0&&(!process.argv[outAt+1]||process.argv[outAt+1].startsWith('--')))throw new Error('--outdir requires a directory.');
const output=outAt>=0?path.resolve(process.argv[outAt+1]):path.join(game,unlocked?'test-results/unlocked':compat?'test-results/compat':solo?'test-results/solo':web?'test-results/web':'dist');
// Every normal release builds both skins from one shared media/JS pass. Explicit
// --bright and the optional distribution flags retain their single-output mode.
const themes=!solo&&!web&&!compat&&!bright?[false,true]:[bright];
const release=!solo&&!web&&!compat&&!unlocked;
const check=process.argv.includes('--check')||(release&&process.env.CI==='true');
const mode=web?'web':compat?'compat':'standalone',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const byteLength=value=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value));
const readText=async file=>(await fs.readFile(file,'utf8')).replace(/\r\n/g,'\n');
const assets={},media={},memorial={},memorialFallback={};
const sizes={battle:0,portraits:0,figures:0,relics:0,avif:0,webp:0,avifMax:0,webpMax:0};
const pack=await loadImagePack();
for(const [id,relative] of Object.entries(RUNTIME_ASSET_PATHS)){
  const bytes=pack.read(relative),metadata=await sharp(bytes).metadata();
  if(!metadata.width||!metadata.height)throw new Error('Invalid canonical art: '+id);
  sizes.battle+=bytes.length;assets[id]='data:image/webp;base64,'+bytes.toString('base64');
}
for(const h of VISUAL_HEROES){
  const portrait=pack.readDerived('portrait:'+h.id),figure=pack.readDerived('figure:'+h.id);
  sizes.portraits+=portrait.length;sizes.figures+=figure.length;
  media['portrait:'+h.id]='data:image/webp;base64,'+portrait.toString('base64');
  media['figure:'+h.id]='data:image/webp;base64,'+figure.toString('base64');
}
for(const a of ARTIFACTS){
  const bytes=pack.readDerived('relic:'+a.id);
  sizes.relics+=bytes.length;media['relic:'+a.id]='data:image/webp;base64,'+bytes.toString('base64');
}
const expectedIds=HEROES.map(h=>h.id).sort().join(',');
for(const map of [MEMORIAL_MEDIA_PATHS,MEMORIAL_WEBP_PATHS,MEMORIAL_MEDIA_MANIFEST]){
  if(Object.keys(map).sort().join(',')!==expectedIds)throw new Error('Memorial roster mismatch.');
}
async function readMemorial(id,format){
  const entry=MEMORIAL_MEDIA_MANIFEST[id],record=format==='avif'?entry:entry.webp;
  const relative=format==='avif'?MEMORIAL_MEDIA_PATHS[id]:MEMORIAL_WEBP_PATHS[id];
  const bytes=await fs.readFile(assetFile(relative));
  const meta=await sharp(bytes).metadata(),sha256=record.outputSha256??record.sha256;
  if(meta.width!==720||meta.height!==1080||(meta.pages??1)!==1||Boolean(meta.hasAlpha)!==record.hasAlpha||
     (format==='avif'?meta.format!=='heif'||meta.compression!=='av1':meta.format!=='webp')||
     bytes.length!==record.bytes||hash(bytes)!==sha256||bytes.length>=100*1024)throw new Error('Memorial media contract: '+id+' '+format);
  const optimized=pack.read(relative);
  sizes[format]+=optimized.length;sizes[format+'Max']=Math.max(sizes[format+'Max'],optimized.length);
  return optimized;
}
if(web)await fs.mkdir(path.join(output,'memorial'),{recursive:true});
for(const h of HEROES){
  // Each standalone embeds one full-painting codec; encodings are prepared offline.
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
// The AVIF pack stays under 2.5 MiB. The WebP fallback (browsers without AVIF, compat/web builds) holds the same 35+ paintings at up to 96 KiB each, so it gets 4 MiB.
if(sizes.avif>=2.5*1024*1024||sizes.webp>=4*1024*1024||(!web&&byteLength(memorial)>=(compat?5.5:3)*1024*1024))throw new Error('Memorial aggregate budget exceeded.');
// Album thumbnails: 240x360 WebP from each memorial painting, so the album never decodes thirty full paintings.
const memorialThumbs={};let thumbBytes=0;
for(const h of HEROES){const bytes=pack.readDerived('memorialThumb:'+h.id);thumbBytes+=bytes.length;memorialThumbs[h.id]='data:image/webp;base64,'+bytes.toString('base64');}
// Star library illustrations: small WebP files embedded in every build (shown only after a constellation is finished).
const library={};let libraryBytes=0;
for(const [id,relative] of Object.entries(LIBRARY_ART)){
  const bytes=pack.read(relative),meta=await sharp(bytes).metadata();
  if(meta.format!=='webp'||!meta.width||meta.width>720||meta.height>1080||bytes.length>=150*1024)throw new Error('Library art contract: '+id);
  libraryBytes+=bytes.length;library[id]='data:image/webp;base64,'+bytes.toString('base64');
}
// Music loops: Ogg Opus, embedded as data URLs and decoded lazily by the sound module.
const audio={};let audioBytes=0;
for(const [id,track] of Object.entries(MUSIC)){const bytes=await fs.readFile(assetFile(track.path));if(bytes.subarray(0,4).toString()!=='OggS'||bytes.length>320*1024)throw new Error('Music contract: '+id);audioBytes+=bytes.length;audio[id]='data:audio/ogg;base64,'+bytes.toString('base64');}
const font=await fs.readFile(assetFile('./assets/Jua-Regular.woff2')),license=await readText(assetFile('./assets/Jua-OFL.txt'));
const fontUri='data:font/woff2;base64,'+font.toString('base64');
const night=await readText(path.join(game,'src/style.css'));
const js=await build({entryPoints:[path.join(game,'src/app.js')],bundle:true,write:false,metafile:true,format:'iife',target:['es2020'],minify:true,charset:'utf8',legalComments:'inline',define:{__GARDEN_SOLO__:String(solo),__GARDEN_UNLOCKED__:String(unlocked)}});
for(const input of Object.keys(js.metafile.inputs)){
  const relative=path.relative(game,path.resolve(input));
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('External game source in Star Garden bundle: '+input);
}
const bundle=js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const template=await readText(path.join(game,'index.html'));
const sharedInjected=`window.__GARDEN_MEDIA__=${JSON.stringify(media)};window.__MEMORIAL_MEDIA__=${JSON.stringify(memorial)};window.__LIBRARY_MEDIA__=${JSON.stringify(library)};window.__MEMORIAL_THUMBS__=${JSON.stringify(memorialThumbs)};window.__GARDEN_AUDIO__=${JSON.stringify(audio)};${web?`window.__MEMORIAL_FALLBACK__=${JSON.stringify(memorialFallback)};`:''}`;
for(const light of themes){
const filename=light?unlocked?'StarGardenDefenseUnlockedBright.html':'StarGardenDefenseBright.html':unlocked?'StarGardenDefenseUnlocked.html':solo?compat?'StarGardenDefenseSoloCompat.html':'StarGardenDefenseSolo.html':compat?'StarGardenDefenseCompat.html':'StarGardenDefense.html';
const themeAssets={...assets};let battleBytes=sizes.battle;
if(light)for(const [id,relative] of Object.entries(BRIGHT_ART)){
  const bytes=pack.read(relative);battleBytes+=bytes.length-(assets[id]?Buffer.from(assets[id].split(',')[1],'base64').length:0);
  themeAssets[id]='data:image/webp;base64,'+bytes.toString('base64');
}
const cssSource=light?brightCss(night,await readText(path.join(game,'src/theme-bright.css'))):night;
const css=(await transform(cssSource,{loader:'css',minify:true})).code.replace('__FONT__',fontUri);
const source=template.replace('<title>드림위버: 별빛 정원</title>',`<title>드림위버: 별빛 정원${light?' · 맑음':''}${unlocked?' · 전체 해금 테스트':solo?' · 1인 편성 테스트':''}</title>`).replace('content="#0a1020"',light?'content="#eaf4ff"':'content="#0a1020"');
for(const token of ['/*__STYLE__*/','/*__ASSETS__*/','/*__SCRIPT__*/'])if(source.split(token).length!==2)throw new Error('Build token mismatch: '+token);
const injected=`window.__ASTRA_ASSETS__=${JSON.stringify(themeAssets)};`+sharedInjected;
const html=source.replace('/*__STYLE__*/',()=>css).replace('/*__ASSETS__*/',()=>injected).replace('/*__SCRIPT__*/',()=>bundle).replace('</head>',()=>`<!-- Jua font, SIL OFL 1.1\n${license.replaceAll('--','—')}\n-->\n</head>`);
if(/__FONT__|\/\*__\w+__\*\//.test(html)||/<(?:script|link)[^>]*(?:src|href)=["'](?:\.\/|https?:)/i.test(html))throw new Error('Non-offline build');
await fs.mkdir(output,{recursive:true});
if(check){
  if(await readText(path.join(output,filename))!==html)throw new Error('Committed '+filename+' is stale; rebuild and commit both release skins.');
}else await fs.writeFile(path.join(output,filename),html);
const objects=prefix=>byteLength(Object.fromEntries(Object.entries(media).filter(([id])=>id.startsWith(prefix))));
const categories={
  css:byteLength(css)-byteLength(fontUri),javascript:byteLength(bundle),
  font:{binaryBytes:font.length,embeddedBytes:byteLength(fontUri)},
  battleAtlases:{binaryBytes:battleBytes,embeddedBytes:byteLength(themeAssets)},
  companionPortraits:{binaryBytes:sizes.portraits,embeddedBytes:objects('portrait:')},
  companionFigures:{binaryBytes:sizes.figures,embeddedBytes:objects('figure:')},
  relicIcons:{binaryBytes:sizes.relics,embeddedBytes:objects('relic:')},
  libraryArt:{binaryBytes:libraryBytes,embeddedBytes:byteLength(library)},
  memorialThumbs:{binaryBytes:thumbBytes,embeddedBytes:byteLength(memorialThumbs)},
  music:{binaryBytes:audioBytes,embeddedBytes:byteLength(audio)},
  memorial:{format:web?'external AVIF + WebP':compat?'WebP':'AVIF',avifBinaryBytes:sizes.avif,webpBinaryBytes:sizes.webp,avifMaxBytes:sizes.avifMax,webpMaxBytes:sizes.webpMax,embeddedBytes:byteLength(memorial)+(web?byteLength(memorialFallback):0)}
};
const categorized=categories.css+categories.javascript+Object.values(categories).filter(v=>typeof v==='object').reduce((sum,v)=>sum+v.embeddedBytes,0);
const report={mode,solo,unlocked,bright:light,filename,htmlBytes:byteLength(html),categories,htmlAndObjectGlueBytes:byteLength(html)-categorized};
await fs.mkdir(path.join(game,'test-results'),{recursive:true});
await fs.writeFile(path.join(game,'test-results',`build-size-${mode}${solo?'-solo':''}${unlocked?'-unlocked':''}${light?'-bright':''}.json`),JSON.stringify(report,null,2)+'\n');
const mib=n=>(n/1024/1024).toFixed(3)+' MiB';
console.log(`${filename} · ${mib(report.htmlBytes)} · ${mode} · ${solo?'one-person':'five-person'} deck${unlocked?' · unlocked':''}${check?' · committed output verified':''}`);
for(const [name,value] of Object.entries(categories)){
  if(typeof value==='number')console.log(`${name}: ${mib(value)}`);
  else if(name==='memorial')console.log(`Memorial ${value.format}: AVIF ${mib(sizes.avif)} / WebP ${mib(sizes.webp)} binary · ${mib(value.embeddedBytes)} embedded paths/data`);
  else console.log(`${name}: ${mib(value.binaryBytes)} binary · ${mib(value.embeddedBytes)} embedded`);
}
console.log(`HTML, license and object glue: ${mib(report.htmlAndObjectGlueBytes)}`);
}

// The review workspace shares combat code but never writes game/profile state.
if(!check&&!solo&&!web&&!compat&&!unlocked&&!bright){const {buildLab}=await import('./build-lab.mjs');await buildLab(output);}
