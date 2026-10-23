import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES,ARTIFACTS,ASSET_PATHS} from '../src/content.js';
import {assetFile} from '../scripts/local-inputs.mjs';
import {loadImagePack} from '../scripts/image-pack.mjs';
import {BUILD_ONLY_ATLASES,RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {Art} from '../src/combat/render.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('all collection, boss and battle textures resolve to local art with valid authored crops',async()=>{
  assert.equal(Object.keys(ASSET_PATHS).length,70);
  // Greenhouse (stage art, 4 growth stages x 3 beds) and three large ultimate emblems.
  for(const [id,w,h] of [['greenhouse',720,1290],['greenhouse-beds',768,576],['greenhouse-dawn',720,1290],['greenhouse-beds-dawn',768,576],['fx-emblems',1536,512],['gifts',768,256],['effects-sol-sweet',1024,512],['effects-sol-twilight',1024,512]]){const m=await sharp(assetFile(ASSET_PATHS[id])).metadata();assert.equal(m.format,'webp',id);assert.equal(m.width,w,id);assert.equal(m.height,h,id);}
  // The summon altar (UI part 1) is a single portrait stage painting.
  const altar=await sharp(assetFile(ASSET_PATHS['summon-altar'])).metadata();
  assert.equal(altar.format,'webp');assert.equal(altar.width,720);assert.equal(altar.height,1290);
  for(const h of HEROES){
    const file=assetFile(ASSET_PATHS[h.art.atlas]),meta=await sharp(file).metadata();
    assert.equal(meta.width,1024);assert.equal(meta.height,1024);assert.equal(meta.hasAlpha,true);
    const p=h.art.portrait;assert.ok(p.x-p.size/2>=0&&p.y-p.size/2>=0&&p.x+p.size/2<=1024&&p.y+p.size/2<=1024,h.id);
  }
  const provenance=JSON.parse(await fs.readFile(path.join(root,'defense_test/docs/ASSET_PROVENANCE.json'),'utf8'));
  for(const a of provenance.assets){
    const bytes=await fs.readFile(path.join(root,a.source));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256,a.id);
  }
  assert.equal(ARTIFACTS.length,27);assert.equal(new Set(ARTIFACTS.map(a=>a.id)).size,27);
  // Rows of three in the collection: 12 C, 6 R, 6 SR, 3 UR.
  assert.deepEqual(['C','R','SR','UR'].map(rarity=>ARTIFACTS.filter(a=>a.rarity===rarity).length),[12,6,6,3]);
});

test('every unit faces outward: the left cell looks left, the right cell is its mirror view and looks right',async()=>{
  const {reversedUnits,notMirrored}=await import('../scripts/art/check-facing.mjs');
  assert.deepEqual(await reversedUnits(),[],'a left/right cell pair that faces the wrong way');
  assert.deepEqual(await notMirrored(),[],'a right cell that is not the mirror view of the left cell');
});

test('optimized images preserve the source pack, codec, alpha and sprite geometry',async()=>{
  const {manifest,read}=await loadImagePack();
  assert.ok(manifest.totals.outputBytes<manifest.totals.deployableSourceBytes);
  assert.deepEqual(Object.keys(BUILD_ONLY_ATLASES).sort(),['blessings','relics','relics-expansion','relics-new']);
  for(const image of manifest.images){
    if(image.id.startsWith('atlas:unit-')){
      const m=await sharp(read(image.source)).metadata();
      assert.equal(m.width,640,image.id);assert.equal(m.height,640,image.id);assert.equal(m.hasAlpha,true,image.id);
      assert.notEqual(image.output.path,image.source,'both pre-pass and optimized files must exist');
    }
    if(image.profile===null)assert.equal(image.output,null,'build-only atlases must not gain a deployed copy');
  }
});

test('battle preload requests exactly the runtime pack, without build-only file fallbacks',async()=>{
  const requests=[],previousWindow=globalThis.window,previousImage=globalThis.Image;
  try{
    globalThis.window={__ASTRA_ASSETS__:Object.fromEntries(Object.keys(RUNTIME_ASSET_PATHS).map(id=>[id,'embedded:'+id]))};
    globalThis.Image=class{
      naturalWidth=640;
      set src(value){requests.push(value);queueMicrotask(()=>this.onload());}
    };
    const art=new Art();await art.ready;
    assert.deepEqual(requests.sort(),Object.keys(RUNTIME_ASSET_PATHS).map(id=>'embedded:'+id).sort());
    assert.deepEqual(art.failed,[]);
    for(const id of Object.keys(BUILD_ONLY_ATLASES))assert.equal(art.images[id],undefined);
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;
  }
});
