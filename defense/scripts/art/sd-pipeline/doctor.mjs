import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,gameRoot,sharp} from './runtime.mjs';
import {policy} from './policy.mjs';
import {policyHash,json} from './core.mjs';
import {requireAuditPaths} from './audit-environment.mjs';
const frames=[];for(const type of ['feminine','neutral','masculine'])for(const height of ['short','medium','tall']){const name=type+'-'+height;await access(path.join(gameRoot,'docs/art/sol-cast-v2/structure-masters',name+'.png'));frames.push(name);}
const report={repository:root,frames,sharp:sharp.versions.sharp,policySha256:policyHash(policy),mandatoryChecks:policy.checks.length,stages:policy.stages.map(s=>s.id),imageGenerationCalls:0,artisticApproval:false};
if(process.argv.includes('--audit')){const paths=await requireAuditPaths();report.audit={...paths,packages:JSON.parse(execFileSync(paths.python,['-c',"import json,importlib.metadata as m; print(json.dumps({k:m.version(k) for k in ['dghs-imgutils','onnxruntime','numpy','scikit-image','pillow']}))"],{encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}})),referenceCount:JSON.parse(await readFile(paths.reference,'utf8')).files.length};}
console.log(json(report));
