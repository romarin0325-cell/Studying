import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {loadImagePack} from './image-pack.mjs';
import {RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// check: compare with the committed lab instead of writing (the release check in CI), line endings aside.
export async function buildLab(output=path.join(game,'dist'),{check=false}={}){
 const pack=await loadImagePack();const assets={};for(const [id,relative]of Object.entries(RUNTIME_ASSET_PATHS))assets[id]='data:image/webp;base64,'+pack.read(relative).toString('base64');
 const js=await build({entryPoints:[path.join(game,'src/lab/app.js')],bundle:true,write:false,format:'iife',target:'es2020',minify:true});
 // Read styles before replacement so the standalone never contains a Promise string.
 const template=await fs.readFile(path.join(game,'lab.html'),'utf8'),css=await fs.readFile(path.join(game,'src/lab/style.css'),'utf8');
 const result=template.replace('/*__STYLE__*/',()=>css).replace('/*__ASSETS__*/',()=>`window.__ASTRA_ASSETS__=${JSON.stringify(assets)};`).replace('/*__SCRIPT__*/',()=>js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
 const file=path.join(output,'StarGardenBalanceLab.html'),lf=text=>text.replace(/\r\n/g,'\n');
 if(check){if(lf(await fs.readFile(file,'utf8'))!==lf(result))throw new Error('Committed StarGardenBalanceLab.html is stale; rebuild and commit it with both release skins.');console.log('StarGardenBalanceLab.html · committed output verified');return;}
 await fs.mkdir(output,{recursive:true});await fs.writeFile(file,result);console.log('StarGardenBalanceLab.html · offline balance & motion workspace');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildLab();
