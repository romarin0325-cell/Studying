import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadImagePack,imageManifestFile} from '../scripts/image-pack.mjs';
import {derivedImageInputs} from '../scripts/image-policy.mjs';

const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.dirname(game);
// The real builder must succeed without invoking an encoder or repairing a cache.
const guard='data:text/javascript;base64,'+Buffer.from(`import sharp from ${JSON.stringify(import.meta.resolve('sharp'))};
sharp.prototype.toBuffer=sharp.prototype.toFile=function(){throw new Error('Build attempted image encoding; prepare UI assets first.');};`).toString('base64');
function build(args){
  const start=performance.now();
  const result=spawnSync(process.execPath,['--import',guard,path.join(game,'scripts/build.mjs'),...args],{
    cwd:repo,env:{...process.env,CI:'true'},encoding:'utf8',maxBuffer:4*1024*1024,timeout:30000,
  });
  return {...result,seconds:(performance.now()-start)/1000};
}
const assignment=(html,name)=>{
  const marker='window.'+name+'=',start=html.indexOf(marker)+marker.length;
  assert.ok(start>=marker.length,'missing '+name);
  let depth=0,quoted=false,escaped=false;
  for(let end=start;end<html.length;end++){
    const c=html[end];
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;
    else if(c==='{'||c==='[')depth++;
    else if(c==='}'||c===']'){if(--depth===0)return JSON.parse(html.slice(start,end+1));}
  }
  throw new Error('Unterminated '+name);
};

test('all prepared UI images match the existing release bytes and current source recipes',async()=>{
  const pack=await loadImagePack(),html=await fs.readFile(path.join(game,'dist/StarGardenDefense.html'),'utf8');
  const media=assignment(html,'__GARDEN_MEDIA__'),thumbs=assignment(html,'__MEMORIAL_THUMBS__');
  assert.equal(pack.manifest.derived.length,derivedImageInputs().length);
  for(const image of pack.manifest.derived){
    const embedded=image.profile==='memorialThumb'?thumbs[image.id.slice('memorialThumb:'.length)]:media[image.id];
    assert.ok(embedded?.startsWith('data:image/webp;base64,'),image.id);
    assert.deepEqual(pack.readDerived(image.id),Buffer.from(embedded.split(',')[1],'base64'),image.id+' changed image bytes');
  }
});

test('missing or stale prepared UI files fail with an explicit refresh command instead of silent repair',async()=>{
  const readFile=fs.readFile,manifest=JSON.parse(await readFile(imageManifestFile,'utf8'));
  const missing=path.resolve(game,manifest.derived[0].destination);
  for(const change of ['crop','profile','source','output','missing']){
    const altered=structuredClone(manifest);
    if(change==='crop')altered.derived[0].crop.left++;
    if(change==='profile')altered.derivedProfiles.portrait.quality--;
    if(change==='source')altered.derived[0].sourceSha256='0'.repeat(64);
    if(change==='output')altered.derived[0].output.sha256='0'.repeat(64);
    fs.readFile=async(file,...args)=>{
      if(path.resolve(file)===imageManifestFile)return JSON.stringify(altered);
      if(change==='missing'&&path.resolve(file)===missing)throw Object.assign(new Error('missing test file'),{code:'ENOENT'});
      return readFile(file,...args);
    };
    try{await assert.rejects(loadImagePack(),/optimize-images\.mjs --derived-only/,change);}
    finally{fs.readFile=readFile;}
  }
});

test('CI creates fresh temporary variants without image encoding and still checks release artifacts',async t=>{
  const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'star-garden-build-'));
  const scratchReal=await fs.realpath(scratch),tempReal=await fs.realpath(os.tmpdir());
  const inside=path.relative(tempReal,scratchReal);
  assert.ok(inside&&!inside.startsWith('..')&&!path.isAbsolute(inside)&&path.basename(scratchReal).startsWith('star-garden-build-'));
  const results=[];
  t.after(async()=>{await fs.rm(scratchReal,{recursive:true,force:true});});
  for(const [name,args,filename] of [
    ['solo',['--solo'],'StarGardenDefenseSolo.html'],
    ['compat',['--compat'],'StarGardenDefenseCompat.html'],
    ['web',['--web'],'StarGardenDefense.html'],
    ['solo-compat',['--solo','--compat'],'StarGardenDefenseSoloCompat.html'],
    ['unlocked',['--unlocked'],'StarGardenDefenseUnlocked.html'],
    ['bright-unlocked',['--bright','--unlocked'],'StarGardenDefenseUnlockedBright.html'],
  ]){
    const output=path.join(scratchReal,name);
    await assert.rejects(fs.access(output));
    const result=build([...args,'--outdir',output]);
    assert.equal(result.status,0,name+': '+(result.error?.message||result.stderr));
    const html=await fs.readFile(path.join(output,filename),'utf8');
    assert.ok(html.includes('window.__GARDEN_MEDIA__='),name+' missing media');
    if(name==='web'){
      const primary=assignment(html,'__MEMORIAL_MEDIA__'),fallback=assignment(html,'__MEMORIAL_FALLBACK__');
      for(const relative of [...Object.values(primary),...Object.values(fallback)])await fs.access(path.join(output,relative));
    }
    results.push({name,seconds:Number(result.seconds.toFixed(3))});
  }
  // --check is explicit and remains available for a previously generated test artifact.
  const solo=path.join(scratchReal,'solo');
  assert.equal(build(['--solo','--check','--outdir',solo]).status,0);
  const checkedFile=path.join(solo,'StarGardenDefenseSolo.html');
  await fs.appendFile(checkedFile,'\n<!-- stale -->');
  const staleTest=build(['--solo','--check','--outdir',solo]);
  assert.notEqual(staleTest.status,0);assert.match(staleTest.stderr,/is stale/);

  // Default CI invocation must compare both skins, including Bright.
  const release=path.join(scratchReal,'release');await fs.mkdir(release);
  for(const name of ['StarGardenDefense.html','StarGardenDefenseBright.html'])await fs.copyFile(path.join(game,'dist',name),path.join(release,name));
  const brightFile=path.join(release,'StarGardenDefenseBright.html');
  await fs.appendFile(brightFile,'\n<!-- stale -->');
  const staleRelease=build(['--outdir',release]);
  assert.notEqual(staleRelease.status,0);assert.match(staleRelease.stderr,/Committed StarGardenDefenseBright.html is stale/);
  assert.ok((await fs.readFile(brightFile,'utf8')).endsWith('<!-- stale -->'),'CI overwrote the stale release');
  // ...and the balance lab, which bundles the same content and combat code.
  await fs.copyFile(path.join(game,'dist','StarGardenDefenseBright.html'),brightFile);
  const labFile=path.join(release,'StarGardenBalanceLab.html');
  await fs.copyFile(path.join(game,'dist','StarGardenBalanceLab.html'),labFile);
  await fs.appendFile(labFile,'\n<!-- stale -->');
  const staleLab=build(['--outdir',release]);
  assert.notEqual(staleLab.status,0);assert.match(staleLab.stderr,/Committed StarGardenBalanceLab.html is stale/);
  assert.ok((await fs.readFile(labFile,'utf8')).endsWith('<!-- stale -->'),'CI overwrote the stale lab');
  console.log('CI build contracts: '+JSON.stringify({encodingCalls:0,variants:results}));
});
