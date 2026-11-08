import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {policy,validatePolicy} from './policy.mjs';
import {enforcePolicyHistory} from './history.mjs';
const historyDirectory=path.join(path.dirname(fileURLToPath(import.meta.url)),'policies');

export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const json=value=>JSON.stringify(value,null,2)+'\n';
export const policyHash=p=>sha(json(validatePolicy(p)));
export const STAGES=policy.stages.map(s=>s.id);
export const inputsFor={
 inputs:s=>['brief','inputs',...s.referenceKeys],
 generation:s=>['job','raw','generation',...(s.mode==='production'?['nativeOutput']:[]),...(s.artifacts.compositeProof?['compositeProof']:[])],
 anatomy:()=>['anatomy'],
 pack:()=>['packing','atlas','webp','portrait','down','up','left','right'],
 review:s=>['auditReport','checkerSource','reviewHtml','reviewEvidence',...Object.keys(s.artifacts).filter(k=>k.startsWith('capture:'))],
 decision:()=>['decision'],
 release:s=>['releaseManifest',...Object.keys(s.artifacts).filter(k=>k.startsWith('export:'))],
};
export async function implementationHash(){
 const directory=path.dirname(fileURLToPath(import.meta.url));
 return sha(Buffer.concat(await Promise.all(['core.mjs','policy.mjs','history.mjs','runtime.mjs','source-views.mjs','artifacts.mjs','review.mjs','audit.mjs','audit-environment.mjs','audit-environment.py','checker.py','check-images.py','pipeline.mjs'].map(f=>readFile(path.join(directory,f))))));
}
export async function ref(file){const absolute=path.resolve(file);return{file:absolute,sha256:sha(await readFile(absolute))};}
export async function load(run){return JSON.parse(await readFile(path.join(run,'run.json'),'utf8'));}
export async function save(run,state){
 await mkdir(run,{recursive:true});
 const temp=path.join(run,'run.json.tmp');await writeFile(temp,json(state));await rename(temp,path.join(run,'run.json'));
}
export function event(state,type,details){state.events.push({at:new Date().toISOString(),type,...details});}
export async function setArtifact(state,key,file){
 const next=await ref(file),previous=state.artifacts[key];state.artifacts[key]=next;
 event(state,'artifact',{key,from:previous?.sha256||null,to:next.sha256});return next;
}
export async function inspect(state,p=policy){
 await enforcePolicyHistory(historyDirectory,p);
 const ph=policyHash(p),implementation=await implementationHash(),files={};
 for(const [key,r]of Object.entries(state.artifacts)){
  try{const actual=sha(await readFile(r.file));files[key]={...r,actual,valid:actual===r.sha256};}
  catch(e){files[key]={...r,valid:false,error:e.code||e.message};}
 }
 const result=[];
 for(const [index,id]of STAGES.entries()){
  const own=inputsFor[id](state),missing=own.filter(k=>!files[k]),changed=own.filter(k=>files[k]&&!files[k].valid);
  const parent=index?result[index-1]:null,receipt=state.stages[id];
  const signature=sha(json({policy:ph,implementation,parent:parent?.signature||null,files:own.map(k=>[k,files[k]?.actual||null]),runMode:state.mode}));
  let status='pending',reasons=[];
  if(missing.length)reasons.push('missing: '+missing.join(', '));
  if(changed.length)reasons.push('changed outside receipt: '+changed.join(', '));
  if(parent&&parent.status!=='pass')reasons.push('previous stage is '+parent.status+': '+parent.id);
  if(receipt){
   if(receipt.signature!==signature||changed.length||(parent&&parent.status!=='pass'))status='stale';
   else status=receipt.outcome;
   if(receipt.policySha256!==ph)reasons.push('policy changed; old reviews cannot be reused');
   if(status==='blocked')reasons.push(...receipt.reasons);
  }
  result.push({id,title:p.stages[index].title,status,signature,reasons,missing,changed,receipt:receipt||null});
 }
 const decision=result.find(s=>s.id==='decision');
 const badFiles=Object.entries(files).filter(([,r])=>!r.valid).map(([k])=>k);
 return {policySha256:ph,implementationSha256:implementation,mode:state.mode,files,stages:result,badFiles,next:result.find(s=>s.status!=='pass')?.id||null,eligibleToExport:state.mode==='production'&&result.slice(0,6).every(s=>s.status==='pass'),ready:state.mode==='production'&&result.every(s=>s.status==='pass')&&decision.status==='pass'};
}
export async function requirePrevious(state,id,p=policy){
 const info=await inspect(state,p),index=STAGES.indexOf(id);assert.ok(index>=0,'Unknown stage '+id);
 if(index&&info.stages[index-1].status!=='pass')throw new Error('Stage order: '+id+' requires '+STAGES[index-1]+' to pass; current '+info.stages[index-1].status);
 return info;
}
export async function receipt(state,id,{outcome='pass',reasons=[],detail={}}={},p=policy){
 await enforcePolicyHistory(historyDirectory,p,{record:true});
 const info=await requirePrevious(state,id,p),current=info.stages.find(s=>s.id===id);
 assert.deepEqual(current.missing,[],'Required stage artifacts missing');assert.deepEqual(current.changed,[],'Stage artifacts changed');
 assert.ok(['pass','blocked'].includes(outcome));
 state.stages[id]={signature:current.signature,policySha256:info.policySha256,implementationSha256:info.implementationSha256,outcome,reasons,detail,at:new Date().toISOString()};
 event(state,'stage',{id,outcome,reasons});return state.stages[id];
}
export function validateDecisions(record,p=policy){
 validatePolicy(p);const rows=record.checks;
 assert.ok(Array.isArray(rows),'A decision must contain the full checklist');
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'Duplicate quality decision');
 assert.deepEqual([...rows.map(r=>r.id)].sort(),[...p.checks.map(c=>c.id)].sort(),'The complete cumulative checklist is required');
 assert.ok(typeof record.reviewer==='string'&&record.reviewer.length>0,'Reviewer required');
 for(const r of rows){
  assert.ok(['pass','caution','fail','unreviewed'].includes(r.status),'Invalid status '+r.id);
  assert.ok(typeof r.note==='string'&&r.note.trim().length>=8,'Explain each quality decision: '+r.id);
  assert.ok(Array.isArray(r.evidence),'Evidence list required '+r.id);
  if(r.status==='pass')assert.ok(r.evidence.length>0,'A pass needs bound evidence: '+r.id);
  if(r.status==='pass')for(const tag of p.checks.find(c=>c.id===r.id).evidence)assert.ok(r.evidence.includes(tag),'Missing required evidence '+tag+' for '+r.id);
  if(r.id==='anatomical-head'&&r.status==='pass')assert.ok(r.method==='fixed-scale-visual-plus-landmarks','Normalization or detector boxes alone cannot pass anatomical-head');
 }
 return {pass:rows.every(r=>r.status==='pass'),problems:rows.filter(r=>r.status!=='pass').map(r=>r.id+': '+r.status)};
}
export function invalidationDescription(change){
 if(['raw','original','style','structure','anatomy','policy','whole-painting','body-regeneration'].includes(change))return ['anatomical-head','face-shape-expression','directional-registration','body-proportions','equipment-handedness','silhouette-perceived-size','outline-weight','shading-material','cast-consistency','game-size-readability','portrait-alignment','seams-contact'];
 // This first implementation deliberately reopens the complete final review
 // after any packed-output change. It does not pretend to reuse unaffected
 // checks until finer per-check reuse has been implemented and tested.
 if(['portrait','webp'].includes(change))return [...invalidationDescription('whole-painting'),'package-integrity'];
 return [...invalidationDescription('whole-painting')];
}
