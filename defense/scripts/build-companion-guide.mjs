import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {loadImagePack} from './image-pack.mjs';
import {RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {HEROES} from '../src/content.js';

const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// A self-contained offline guide uses the same battle images, figure crops and
// cut-in styles as the game and the existing balance laboratory.
export async function buildCompanionGuide(output=path.join(game,'dist'),{check=false}={}){
  const pack=await loadImagePack();
  const assets={};
  for(const [id,relative] of Object.entries(RUNTIME_ASSET_PATHS)){
    assets[id]='data:image/webp;base64,'+pack.read(relative).toString('base64');
  }
  for(const hero of HEROES){
    assets['figure:'+hero.id]='data:image/webp;base64,'+pack.readDerived('figure:'+hero.id).toString('base64');
  }
  const js=await build({entryPoints:[path.join(game,'src/companion-guide/app.js')],bundle:true,write:false,format:'iife',target:'es2020',minify:true});
  const read=async file=>(await fs.readFile(path.join(game,file),'utf8')).replace(/\r\n/g,'\n');
  const template=await read('companion-guide.html');
  const guideCss=await read('src/companion-guide/style.css');
  const gameCss=await read('src/style.css');
  const cutin=gameCss.slice(gameCss.indexOf('/* ───────── Ultimate cut-in'),gameCss.indexOf('@keyframes cutin-fade'));
  const fade=gameCss.slice(gameCss.indexOf('@keyframes cutin-fade')).split('\n')[0];
  if(!cutin.startsWith('/* ───────── Ultimate cut-in')||!fade.startsWith('@keyframes cutin-fade'))throw new Error('Game cut-in styles not found');
  for(const marker of ['/*__STYLE__*/','/*__ASSETS__*/','/*__SCRIPT__*/']){
    if(!template.includes(marker))throw new Error(`Companion guide template missing ${marker}`);
  }
  const result=template
    .replace('/*__STYLE__*/',()=>guideCss+'\n'+cutin+'\n'+fade)
    .replace('/*__ASSETS__*/',()=>`window.__ASTRA_ASSETS__=${JSON.stringify(assets)};`)
    .replace('/*__SCRIPT__*/',()=>js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
  const file=path.join(output,'StarGardenCompanionGuide.html');
  if(check){
    const existing=(await fs.readFile(file,'utf8')).replace(/\r\n/g,'\n');
    if(existing!==result)throw new Error('StarGardenCompanionGuide.html is stale; rebuild the companion guide.');
    console.log('StarGardenCompanionGuide.html · committed output verified');
    return;
  }
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(file,result);
  console.log('StarGardenCompanionGuide.html · offline companion guide');
}

if(process.argv[1]===fileURLToPath(import.meta.url))await buildCompanionGuide();
