// A new atlas hash invalidates the ordinary UI cache, including unchanged front crops.
// Reuse previously deployed front images only after comparing their actual crop pixels.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {imageHash, imageManifestFile} from '../../../scripts/image-pack.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../..');
const game=path.join(repo,'defense');
const base='3379bc5e9a5edf40d87a00e3be8ca207ca866185';
const priorFile=file=>execFileSync('git',['show',base+':'+file],{cwd:repo,maxBuffer:32*1024*1024});
const prior=JSON.parse(priorFile('defense/docs/ASSET_OPTIMIZATION.json'));
const current=JSON.parse(await fs.readFile(imageManifestFile,'utf8'));
const proofs=JSON.parse(await fs.readFile(path.join(here,'pixels.json'),'utf8'));
const beforeById=new Map(prior.derived.map(item=>[item.id,item]));
const summary=[];
for(const proof of proofs){
  for(const profile of ['portrait','figure']){
    const id=profile+':'+proof.id, before=beforeById.get(id), after=current.derived.find(x=>x.id===id);
    assert.equal(before.sourceSha256,proof.before.source);
    assert.equal(after.sourceSha256,proof.original.sha256);
    assert.deepEqual(before.crop,after.crop);
    assert.deepEqual(prior.derivedProfiles[profile],current.derivedProfiles[profile]);
    assert.deepEqual(prior.derivedEncoder,current.derivedEncoder);
    const samples=await Promise.all([before,after].map(async item=>{
      const source=await fs.readFile(path.resolve(game,item.source));
      assert.equal(imageHash(source),item.sourceSha256);
      return sharp(source).extract(item.crop).ensureAlpha().raw().toBuffer();
    }));
    const [a,b]=samples;
    assert.equal(a.length,b.length);
    for(let k=0;k<a.length;k+=4){
      if(a[k+3]||b[k+3])assert.ok(a.readUInt32LE(k)===b.readUInt32LE(k),id+' visible crop differs at '+k/4);
    }
    const output=priorFile('defense/'+before.output.path.replace(/^\.\//,''));
    assert.equal(imageHash(output),before.output.sha256);
    assert.equal(after.output.path,before.output.path);
    await fs.writeFile(path.resolve(game,after.output.path),output);
    after.output=before.output;
    summary.push({id,crop:after.crop,visibleCropChanges:0,originalOutputSHA256:before.output.sha256,installedOutputSHA256:imageHash(output)});
  }
}
current.totals.derivedOutputBytes=current.derived.reduce((sum,record)=>sum+record.output.bytes,0);
await fs.writeFile(imageManifestFile,JSON.stringify(current,null,2)+'\n');
await fs.writeFile(path.join(here,'front-ui.json'),JSON.stringify(summary,null,2)+'\n');
console.log('Verified and retained '+summary.length+' UI assets.');
