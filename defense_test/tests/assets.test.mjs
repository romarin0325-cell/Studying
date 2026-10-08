import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES,ARTIFACTS,ASSET_PATHS} from '../src/content.js';
import {assetFile} from '../scripts/local-inputs.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('all collection, boss and battle textures resolve to local art with valid authored crops',async()=>{
  assert.equal(Object.keys(ASSET_PATHS).length,47);
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
  assert.equal(ARTIFACTS.length,24);assert.equal(new Set(ARTIFACTS.map(a=>a.id)).size,24);
  for(const rarity of ['C','R','SR','UR'])assert.ok(ARTIFACTS.some(a=>a.rarity===rarity));
});
