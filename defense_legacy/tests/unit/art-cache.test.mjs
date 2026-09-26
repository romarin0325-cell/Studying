import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {prepareArt} from '../../../scripts/prepare_defense_art.mjs';

test('committed prepared-asset hashes skip decodes, invalidate changes, and reject opaque replacements',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'defense-art-cache-'));
  try {
    const sprite=await sharp({create:{width:8,height:8,channels:4,background:'#00000000'}})
      .composite([{input:await sharp({create:{width:4,height:4,channels:4,background:'#ffffff'}}).png().toBuffer(),left:2,top:2}])
      .webp({lossless:true}).toBuffer();
    const file=path.join(root,'hero.webp'); await writeFile(file,sprite);
    const options={appRoot:root,cachePath:path.join(root,'manifest.json'),manifest:[{id:'hero',path:'hero.webp',hasAlpha:true}],processorHash:'policy-1',quiet:true};
    const first=await prepareArt(options); assert.equal(first.decoded,1); assert.equal(first.reused,0);
    const committed=await readFile(options.cachePath,'utf8');
    const cached=await prepareArt({...options,inspect:()=>assert.fail('cache hit must perform zero Sharp work')});
    assert.equal(cached.decoded,0); assert.equal(cached.reused,1); assert.equal(cached.cacheChanged,false);
    assert.equal(await readFile(options.cachePath,'utf8'),committed);
    const policy=await prepareArt({...options,processorHash:'policy-2'}); assert.equal(policy.decoded,1);
    const changed=await sharp(sprite).resize(10,10).webp({lossless:true}).toBuffer();
    await writeFile(file,changed);
    const revalidated=await prepareArt({...options,processorHash:'policy-2'}); assert.equal(revalidated.decoded,1);
    assert.notEqual(revalidated.sourceHash,first.sourceHash);
    const lastGood=await readFile(options.cachePath,'utf8');
    await writeFile(file,await sharp({create:{width:8,height:8,channels:3,background:'#ffffff'}}).webp().toBuffer());
    await assert.rejects(prepareArt({...options,processorHash:'policy-2'}),/Unprepared opaque/);
    assert.equal(await readFile(options.cachePath,'utf8'),lastGood,'failed validation must not certify the new bytes');
    await rm(file);
    await assert.rejects(prepareArt(options),/ENOENT/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('forced CI validation bypasses cache without modifying the committed record',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'defense-art-force-'));
  try{
    await writeFile(path.join(root,'art.webp'),'fixture');
    let calls=0;
    const options={appRoot:root,cachePath:path.join(root,'manifest.json'),manifest:[{id:'art',path:'art.webp',hasAlpha:true}],processorHash:'policy',quiet:true,
      inspect:async()=>{calls++;return {hasAlpha:true,minimumAlpha:0,width:8,height:8};}};
    await prepareArt(options); const before=await readFile(options.cachePath,'utf8');
    const forced=await prepareArt({...options,force:true,checkOnly:true});
    assert.equal(forced.decoded,1); assert.equal(calls,2); assert.equal(await readFile(options.cachePath,'utf8'),before);
    await assert.rejects(prepareArt({...options,manifest:[{id:'escape',path:'../escape.webp',hasAlpha:true}]}),/escapes defense/);
  }finally{await rm(root,{recursive:true,force:true});}
});
