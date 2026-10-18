// Parallel ultimate-value runs. Config file: [{label, deck:[5 ids], hero, set, horizon, stages, seeds}]
//   node pult.mjs configs.json [--jobs 12] [--out result.json]
// Prints per config: samples, seconds of team damage per cast, value per 100 starlight, kills, gold, per-kind seconds.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const arg=(n,f)=>{const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]:f;};
const configs=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),JOBS=Number(arg('jobs',12)),outFile=arg('out',null);
function runOne(cfg,index){
  return new Promise((ok,no)=>{
    const tmp=path.join(HERE,`.u-${process.pid}-${index}.json`);
    const child=spawn('node',['--import',pathToFileURL(path.join(HERE,'preload.mjs')).href,path.join(HERE,'ultroll.mjs'),'--stages',cfg.stages||'9,13,17,21','--seeds',String(cfg.seeds||3),'--heroes',cfg.hero,'--json',tmp],{env:{...process.env,UP_SET:JSON.stringify(cfg.set||{}),UP_DECKS:cfg.deck.join(','),UP_HORIZON:String(cfg.horizon||12)},stdio:['ignore','ignore','pipe']});
    let err='';child.stderr.on('data',d=>err+=d);
    child.on('close',code=>{if(code!==0)return no(new Error(cfg.label+': '+err.slice(-400)));let j;try{j=JSON.parse(fs.readFileSync(tmp,'utf8'));fs.unlinkSync(tmp);}catch(e){return no(new Error(cfg.label+' no json: '+err.slice(-300)));}ok({cfg,row:j.rows.find(r=>r.id===cfg.hero)||null,restoreFails:j.restoreFails});});
  });
}
const queue=configs.map((c,i)=>[c,i]),results=new Array(configs.length);
async function worker(){while(queue.length){const [c,i]=queue.shift();try{results[i]=await runOne(c,i);}catch(e){results[i]={cfg:c,error:e.message};}}}
await Promise.all(Array.from({length:Math.min(JOBS,configs.length)},worker));
const flat=[];
for(const r of results){
  if(r.error){console.log(`${r.cfg.label.padEnd(30)} ERROR ${r.error}`);continue;}
  const w=r.row;if(!w){console.log(`${r.cfg.label.padEnd(30)} (표본 없음)`);continue;}
  const k=w.seconds;flat.push({label:r.cfg.label,hero:r.cfg.hero,samples:w.samples,seconds:w.seconds?.overall,per100:w.per100,kills:w.kills,gold:w.gold,health:w.health,byKind:w.seconds});
  console.log(`${r.cfg.label.padEnd(30)} n=${String(w.samples).padStart(2)} 시전당 ${w.seconds.overall.toFixed(1)}s · 100당 ${w.per100.toFixed(2)} · 처치 ${w.kills.toFixed(2)} · 골드 ${w.gold.toFixed(1)} · 체력 ${w.health.toFixed(2)} · 보스3 ${w.seconds.boss3?.toFixed(1)??'—'} 보스6 ${w.seconds.boss6?.toFixed(1)??'—'} 밀집 ${w.seconds.crowd?.toFixed(1)??'—'}`);
}
if(outFile)fs.writeFileSync(outFile,JSON.stringify(flat,null,1));
