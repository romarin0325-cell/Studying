import path from 'node:path';
import {access} from 'node:fs/promises';
import {here,gameRoot,runtimeRoot} from './runtime.mjs';
export function auditPaths({env=process.env,platform=process.platform,runtime=runtimeRoot}={}){
 return{python:env.DEFENSE_ART_PYTHON||path.join(runtime,'.venv',platform==='win32'?'Scripts/python.exe':'bin/python'),checker:env.DEFENSE_ART_CHECKER||path.join(here,'checker.py'),reference:env.DEFENSE_ART_REFERENCE_REPORT||path.join(gameRoot,'docs/art/sd-pipeline/reference-cast.json'),cache:env.DEFENSE_ART_AUDIT_CACHE||path.join(runtime,'audit-cache.json')};
}
export async function requireAuditPaths(options){
 const p=auditPaths(options);
 for(const role of ['python','checker','reference'])try{await access(p[role]);}catch{throw new Error('SD audit '+role+' is missing: '+p[role]+'. Run npm run setup:defense:sd-pipeline -- --warm-models, or set the documented DEFENSE_ART_* override. No audit pass was recorded.');}
 return p;
}
