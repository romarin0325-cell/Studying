import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES,ARTIFACTS,ASSET_PATHS,TRANSFORM_ART} from '../src/content.js';
import {assetFile} from '../scripts/local-inputs.mjs';
import {loadImagePack} from '../scripts/image-pack.mjs';
import {BUILD_ONLY_ATLASES,RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {Art} from '../src/combat/render.js';
import {portraitFrame} from '../src/portrait-layout.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

test('installed cast v2 matches the 40 selected masters and keeps anatomy separate from optical crops',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'defense/docs/art/sol-cast-v2/manifest.json'),'utf8'));
  assert.equal(manifest.assets.length,40);
  const art=new Map([...HEROES.map(h=>[h.id,h.art]),...Object.entries(TRANSFORM_ART)]);
  assert.equal(art.size,40);
  for(const entry of manifest.assets){
    const frame=entry.frames.find(f=>f.direction==='down'),installed=art.get(entry.id);assert.ok(installed,entry.id);
    assert.deepEqual(entry.frames.map(f=>f.direction),['down','up','left','right']);
    assert.equal(installed.foot,.9375);assert.equal(installed.scale,1);assert.equal(installed.columns,2);assert.equal(installed.directional,true);
    assert.equal(installed.portrait.x,Math.round(frame.ellipse[0]));assert.equal(installed.portrait.y,Math.round(frame.ellipse[1]));
    assert.equal(ASSET_PATHS[installed.atlas],'./'+entry.sourceWebp.file.replace(/^defense\//,''));
    for(const record of [entry.sourcePng,entry.sourceWebp]){
      const bytes=await fs.readFile(path.join(root,record.file));
      assert.equal(bytes.length,record.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,record.file);
    }
    for(const view of entry.frames){assert.deepEqual(view.sole,[256,480]);assert.equal(view.commonScale,entry.commonScale);assert.equal(view.paintedClipping,0);}
    assert.ok(entry.measurementUncertaintyPacked>0,'covered head estimates must not imply exact ground truth');
  }
});
test('summon face crops and prepared portraits share optical framing without moving anatomy',async()=>{
  const {derivedImageInputs}=await import('../scripts/image-policy.mjs');
  const crops=new Map(derivedImageInputs().filter(x=>x.id.startsWith('portrait:')).map(x=>[x.id.slice(9),x]));
  for(const hero of HEROES){
    const anatomy={...hero.art.portrait},frame=portraitFrame(hero),prepared=crops.get(hero.id);
    assert.ok(prepared,hero.id);
    assert.equal(frame.size,anatomy.size,'optical centering cannot rescale the face');
    assert.ok(Math.abs(frame.x-anatomy.x)<=8&&Math.abs(frame.y-anatomy.y)<=8,'only small optical translations');
    assert.deepEqual(hero.art.portrait,anatomy,'anatomical measurement is preserved');
    assert.deepEqual(prepared.crop,{left:Math.round(frame.x-frame.size/2),top:Math.round(frame.y-frame.size/2),width:frame.size,height:frame.size},hero.id);
  }
  assert.equal(portraitFrame(HEROES.find(h=>h.id==='toffee_apple')).x, HEROES.find(h=>h.id==='toffee_apple').art.portrait.x-7);
});

test('all collection, boss and battle textures resolve to local art with valid authored crops',async()=>{
  assert.equal(Object.keys(ASSET_PATHS).length,74);
  // Greenhouse (stage art, 4 growth stages x 3 beds) and three large ultimate emblems.
  for(const [id,w,h] of [['greenhouse',720,1290],['greenhouse-beds',768,576],['greenhouse-dawn',720,1290],['greenhouse-beds-dawn',768,576],['fx-emblems',1536,512],['gifts',768,256],['effects-sol-sweet',1024,512],['effects-sol-twilight',1024,512],['effects-companion-sweet',1024,512],['effects-companion-twilight',1024,512],['ultimates-extra-a',1024,512],['ultimates-extra-b',768,512]]){const m=await sharp(assetFile(ASSET_PATHS[id])).metadata();assert.equal(m.format,'webp',id);assert.equal(m.width,w,id);assert.equal(m.height,h,id);}
  // The summon altar (UI part 1) is a single portrait stage painting.
  const altar=await sharp(assetFile(ASSET_PATHS['summon-altar'])).metadata();
  assert.equal(altar.format,'webp');assert.equal(altar.width,720);assert.equal(altar.height,1290);
  for(const h of HEROES){
    const file=assetFile(ASSET_PATHS[h.art.atlas]),meta=await sharp(file).metadata();
    assert.equal(meta.width,1024);assert.equal(meta.height,1024);assert.equal(meta.hasAlpha,true);
    const p=h.art.portrait;assert.ok(p.x-p.size/2>=0&&p.y-p.size/2>=0&&p.x+p.size/2<=1024&&p.y+p.size/2<=1024,h.id);
  }
  const provenance=JSON.parse(await fs.readFile(path.join(root,'defense/docs/ASSET_PROVENANCE.json'),'utf8'));
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
  assert.deepEqual(Object.keys(BUILD_ONLY_ATLASES).sort(),['blessings','effects-sol-sweet','effects-sol-twilight','relics','relics-expansion','relics-new']);
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
