// Parallel stage-play comparison of many decks. Config: [{label, deck:[5 ids], stages:'3,9,15,21', seeds:12, set:{...}}]
//   node pdecks.mjs configs.json [--jobs 14] [--out result.json]  -> sorted by win rate
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const arg=(n,f)=>{const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:f;};
const configs=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),JOBS=Number(arg('jobs',14)),outFile=arg('out',null);
function runOne(cfg){
  return new Promise(ok=>{
    const child=spawn('node',['--import',pathToFileURL(path.join(HERE,'preload.mjs')).href,path.join(HERE,'compare-decks.mjs'),'--decks',cfg.deck.join(','),'--stages',cfg.stages||'3,9,15,21','--seeds',String(cfg.seeds||12),'--label',cfg.label],{env:{...process.env,UP_SET:JSON.stringify(cfg.set||{}),...(cfg.env||{})},stdio:['ignore','pipe','pipe']});
    let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
    child.on('close',()=>{const line=out.split('\n').find(l=>l.includes('| 전체 |'));if(!line)return ok({cfg,error:err.slice(-300)||out.slice(-300)});const c=line.split('|').map(x=>x.trim());ok({cfg,win:parseFloat(c[3].split('*').join('')),health:+c[4],rounds:+c[5],time:parseFloat(c[6]),disabled:+c[7],curse:+c[8],judged:+c[9],casts:+c[10],sac:+c[11]});});
  });
}
const queue=[...configs],results=[];
async function worker(){while(queue.length){const c=queue.shift();results.push(await runOne(c));}}
await Promise.all(Array.from({length:Math.min(JOBS,configs.length)},worker));
results.sort((a,b)=>(b.win||0)-(a.win||0)||(b.rounds||0)-(a.rounds||0));
for(const r of results){if(r.error){console.log(r.cfg.label,'ERROR',r.error);continue;}console.log(`${String(r.win).padStart(4)}%  체력 ${r.health.toFixed(1)}  라운드 ${r.rounds.toFixed(2)}  시간 ${r.time}s  행동불능 ${r.disabled}  필살기 ${r.casts}  환원 ${r.sac}  ${r.cfg.label}`);}
if(outFile)fs.writeFileSync(outFile,JSON.stringify(results,null,1));
