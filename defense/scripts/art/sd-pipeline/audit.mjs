import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {here} from './runtime.mjs';
import {ref,json,setArtifact,requirePrevious} from './core.mjs';
import {requireAuditPaths} from './audit-environment.mjs';
const exec=promisify(execFile);
export async function independentAudit(run,state){
 await requirePrevious(state,'review');
 const {python,checker,reference,cache}=await requireAuditPaths();
 const code=await ref(checker),environment=JSON.parse((await exec(python,[path.join(here,'audit-environment.py')],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}})).stdout),{packages,environmentFingerprint}=environment;
 const out=path.join(path.dirname(state.artifacts.packing.file),'audit-report.json');let report,reused=false;
 try{
  const c=JSON.parse(await readFile(cache,'utf8'));
  if(c.checkerSha256===code.sha256&&c.environmentFingerprint===environmentFingerprint&&Object.keys(packages).every(k=>c.packages[k]===packages[k])&&c.referenceDistribution.sha256===(await ref(reference)).sha256){
   const row=c.files.find(r=>r.sourceSha256===state.artifacts.atlas.sha256);
   if(row){assert.equal((await ref(row.path)).sha256,row.sourceSha256,'Cached measurement source changed');report={...c,files:[row],cacheReuse:{...await ref(cache),reason:'Exact image/code/environment/reference match; measurement was actually executed.'}};reused=true;}
  }
 }catch(e){if(e.code!=='ENOENT')throw e;}
 if(!reused){
  await exec(python,[path.join(here,'check-images.py'),state.artifacts.atlas.file,out,checker,reference],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1',HF_HUB_OFFLINE:'1'},maxBuffer:2**20});report=JSON.parse(await readFile(out,'utf8'));
 }
 assert.equal(report.files[0].sourceSha256,state.artifacts.atlas.sha256);assert.equal(report.checkerSha256,code.sha256);assert.deepEqual(report.packages,packages);assert.equal(report.environmentFingerprint,environmentFingerprint);
 await writeFile(out,json(report));await setArtifact(state,'auditReport',out);await setArtifact(state,'checkerSource',checker);
 return{reused,sourceSha256:state.artifacts.atlas.sha256,flags:report.files[0].review_reasons,packages};
}
