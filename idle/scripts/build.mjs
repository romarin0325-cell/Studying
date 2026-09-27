import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {prepareThumbnails} from './prepare-thumbnails.mjs';
const root=path.resolve(import.meta.dirname,'..'),hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/manifest.json'),'utf8')),images={};
const thumbs=await prepareThumbnails(),thumbImages={};
for(const [id,a]of Object.entries(thumbs.assets))thumbImages[id]='data:image/webp;base64,'+(await fs.readFile(path.join(root,a.path))).toString('base64');
for(const asset of manifest.assets){const bytes=await fs.readFile(path.join(root,asset.path));if(hash(bytes)!==asset.sha256)throw Error('Artwork checksum mismatch: '+asset.id);images[asset.id]='data:image/webp;base64,'+bytes.toString('base64');}
const result=await build({entryPoints:[path.join(root,'src/main.js')],bundle:true,write:false,format:'iife',target:['es2022'],minify:true,minifySyntax:false,legalComments:'none',logLevel:'warning'});
const css=await build({entryPoints:[path.join(root,'styles/game.css')],bundle:true,write:false,minify:true});
let html=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace(/\r\n/g,'\n');
html=html.replace('<link rel="stylesheet" href="./styles/game.css">',()=>'<style>'+css.outputFiles[0].text+'</style>');
html=html.replace('<script type="module" src="./src/main.js"></script>',()=>'<script>globalThis.ASTRAL_IMAGES='+JSON.stringify(images)+';globalThis.ASTRAL_THUMBNAILS='+JSON.stringify(thumbImages)+';<\/script><script>'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'<\/script>');
await fs.mkdir(path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/AstralCompanions.html'),html);
console.log('AstralCompanions.html · '+(Buffer.byteLength(html)/1048576).toFixed(2)+' MiB · '+Object.keys(images).length+' embedded artworks · '+hash(html).slice(0,12));
