// Orchestration helpers: run the bench scripts as child processes with UP_SET overrides and parse the results.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const run=(script,args,env)=>execFileSync('node',['--import',pathToFileURL(path.join(HERE,'preload.mjs')).href,path.join(HERE,script),...args],{env:{...process.env,...env},encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
// Contribution indices: {heroId:{rank:{mean,crowd,boss,crisis,long,casts}}}
export function contrib({heroes,set={},ranks='1,3,5',teams=10,args=[]}){
  const tmp=path.join(HERE,`.tmp-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  run('contrib.mjs',['--heroes',heroes.join(','),'--ranks',ranks,'--teams',String(teams),'--json',tmp,...args],{UP_SET:JSON.stringify(set)});
  const j=JSON.parse(fs.readFileSync(tmp,'utf8'));fs.unlinkSync(tmp);
  const out={};
  for(const id of heroes){out[id]={};for(const rank of j.ranks){const by=Object.fromEntries(Object.keys(j.results[rank]).map(k=>[k,j.results[rank][k][id].index]));const casts=Object.keys(j.results[rank]).reduce((n,k)=>n+j.results[rank][k][id].casts,0)/4;out[id][rank]={...by,mean:Object.values(by).reduce((a,b)=>a+b,0)/4,casts};}}
  return out;
}
// Ultimate value rows from up/ultroll.mjs (per 100 starlight etc.): {heroId:{per100,seconds,kills,samples,byKind}}
export function ultroll({decks,heroes,set={},stages='9,13,17,21',seeds=3,horizon=12}){
  const tmp=path.join(HERE,`.tmp-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  run('ultroll.mjs',['--stages',stages,'--seeds',String(seeds),'--heroes',heroes.join(','),'--json',tmp],{UP_SET:JSON.stringify(set),UP_DECKS:decks.map(d=>d.join(',')).join(';'),UP_HORIZON:String(horizon)});
  const j=JSON.parse(fs.readFileSync(tmp,'utf8'));fs.unlinkSync(tmp);
  return Object.fromEntries(j.rows.map(r=>[r.id,r]));
}
export const fmt=n=>n==null?'—':n.toFixed(2);
