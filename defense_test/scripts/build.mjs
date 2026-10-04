import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
import {HEROES,ARTIFACTS,ASSET_PATHS} from '../src/content.js';
import {gameRoot as game,assetFile} from './local-inputs.mjs';

const assets={},media={};
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
const font=await fs.readFile(assetFile('./assets/Jua-Regular.ttf')),license=await fs.readFile(assetFile('./assets/Jua-OFL.txt'),'utf8');
const css=(await fs.readFile(path.join(game,'src/style.css'),'utf8')).replace('__FONT__','data:font/ttf;base64,'+font.toString('base64'));
const js=await build({entryPoints:[path.join(game,'src/app.js')],bundle:true,write:false,metafile:true,format:'iife',target:['es2020'],minify:true,charset:'utf8',legalComments:'inline'});
for(const input of Object.keys(js.metafile.inputs)){
  const relative=path.relative(game,path.resolve(input));
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('External game source in Star Garden bundle: '+input);
}
const source=await fs.readFile(path.join(game,'index.html'),'utf8');
for(const token of ['/*__STYLE__*/','/*__ASSETS__*/','/*__SCRIPT__*/'])if(source.split(token).length!==2)throw new Error('Build token mismatch: '+token);
const html=source.replace('/*__STYLE__*/',()=>css).replace('/*__ASSETS__*/',()=>`window.__ASTRA_ASSETS__=${JSON.stringify(assets)};window.__GARDEN_MEDIA__=${JSON.stringify(media)};`).replace('/*__SCRIPT__*/',()=>js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')).replace('</head>',()=>`<!-- Jua font, SIL OFL 1.1\n${license.replaceAll('--','—')}\n-->\n</head>`);
if(/__FONT__|\/\*__\w+__\*\//.test(html)||/<(?:script|link)[^>]*(?:src|href)=["'](?:\.\/|https?:)/i.test(html))throw new Error('Non-offline build');
await fs.mkdir(path.join(game,'dist'),{recursive:true});await fs.writeFile(path.join(game,'dist/StarGardenDefense.html'),html);
console.log(`StarGardenDefense.html · ${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB · ${Object.keys(assets).length} local textures · ${HEROES.length} companions · standalone offline`);
