import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validatePolicy} from './policy.mjs';
const json=v=>JSON.stringify(v,null,2)+'\n';
const digest=p=>createHash('sha256').update(json(p)).digest('hex');

// The minimum contract is not only the first hard-coded set. Every adopted
// version is frozen, so a later request cannot silently lose a newer check.
export async function enforcePolicyHistory(directory,p,{record=false}={}){
 validatePolicy(p);let files=[];
 try{files=await readdir(directory);}catch(e){if(e.code!=='ENOENT')throw e;}
 const oldIds=new Set();
 for(const file of files.filter(f=>f.endsWith('.json'))){
  const snapshot=JSON.parse(await readFile(path.join(directory,file),'utf8'));
  assert.equal(digest(snapshot.policy),snapshot.policySha256,'Corrupt historical policy snapshot');
  assert.equal(file,snapshot.policySha256+'.json','Renamed historical policy snapshot');
  for(const check of snapshot.policy.checks)if(check.required)oldIds.add(check.id);
 }
 for(const id of oldIds)assert.ok(p.checks.some(c=>c.id===id&&c.required===true),'A previously adopted mandatory check disappeared: '+id);
 const ph=digest(p);
 if(record&&!files.includes(ph+'.json')){
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,ph+'.json'),json({policySha256:ph,policy:p}),{flag:'wx'});
 }
 return{policySha256:ph,inheritedFromHistory:[...oldIds]};
}
