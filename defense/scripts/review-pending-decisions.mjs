// Build the portable pending-decisions comparison page (docs/review/pending-decisions/index.html).
// Compares Cinderella's miracle emblem (slipper vs wishing star), cut-in dialogue/expression, deck-based image
// decoding, and the unused ur-kit3 envelope cell offline using the actual engine, renderer and verified assets.
//   node defense/scripts/review-pending-decisions.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
import {HERO,TRANSFORM_ART} from '../src/content.js';
import {RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {gameRoot} from './local-inputs.mjs';
import {loadImagePack} from './image-pack.mjs';

const dir=path.join(gameRoot,'docs/review/pending-decisions');
const ROSTER_HEROES=['cinderella','jasmine','siren','queen','zeke'];
const CUTIN_HEROES=['cinderella','siren','cherry_prince','luna','frost_witch','time_magician'];
const NON_COMBAT_UI=new Set(['summon-altar','greenhouse','greenhouse-beds','greenhouse-dawn','greenhouse-beds-dawn','gifts']);

const pack=await loadImagePack();
const unitNeeded=new Set([
  ...ROSTER_HEROES.map(id=>HERO[id].art.atlas),
  ...Object.values(TRANSFORM_ART).map(art=>art.atlas),
]);

const images={},assetsMeta=[];
for(const [id,relative] of Object.entries(RUNTIME_ASSET_PATHS)){
  const bytes=pack.read(relative),meta=await sharp(bytes).metadata();
  if(!meta.width||!meta.height)throw new Error('Invalid runtime image: '+id);
  assetsMeta.push({id,width:meta.width,height:meta.height,fileBytes:bytes.length,decodedBytes:meta.width*meta.height*4});
  if(id.startsWith('unit-')&&!unitNeeded.has(id))continue;
  if(NON_COMBAT_UI.has(id))continue;
  images[id]='data:image/webp;base64,'+bytes.toString('base64');
}
images['bright-garden']='data:image/webp;base64,'+pack.read('./assets/bright/garden.webp').toString('base64');

const figures={};
for(const id of CUTIN_HEROES){
  figures[id]='data:image/webp;base64,'+pack.readDerived('figure:'+id).toString('base64');
}

// Resolve source files through Node so esbuild never enumerates protected ancestor directories.
const virtualFiles={name:'pending-review-files',setup(b){
  b.onResolve({filter:/.*/},args=>({path:args.kind==='entry-point'?path.join(dir,'review.js'):path.resolve(path.dirname(args.importer),args.path),namespace:'pending-review'}));
  b.onLoad({filter:/.*/,namespace:'pending-review'},async args=>({contents:await fs.readFile(args.path,'utf8'),loader:'js'}));
}};

const bundle=await build({
  entryPoints:['pending-review-entry'],
  plugins:[virtualFiles],
  bundle:true,
  write:false,
  format:'iife',
  target:['es2020'],
  minify:true,
  charset:'utf8',
  define:{__GARDEN_SOLO__:'false',__GARDEN_UNLOCKED__:'false',__GARDEN_PREVIEW__:'false'},
});

const template=await fs.readFile(path.join(dir,'template.html'),'utf8');
const html=template
  .replace('/*__DATA__*/',()=>`window.PENDING_DECISION_DATA=${JSON.stringify({images,figures,assetsMeta})};`)
  .replace('/*__SCRIPT__*/',()=>bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));

await fs.writeFile(path.join(dir,'index.html'),html.trimEnd()+'\n');
console.log(path.join(dir,'index.html')+' · '+(Buffer.byteLength(html)/1048576).toFixed(2)+' MB · '+Object.keys(images).length+' embedded textures');
