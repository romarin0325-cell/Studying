// Parallel contribution sweep. Config file: [{label, heroes:[ids], set:{hero:{...},upcoming:{...}}, args:[...], ranks:'1,3,5', teams:10}]
//   node psweep.mjs configs.json [--jobs 12]  -> one line per config and hero: mean index at each rank (+ scenario means at 3 stars)
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const configs=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),JOBS=Number((process.argv[process.argv.indexOf('--jobs')+1])||12);
const budget={C:1,R:1.1,SR:1.25,UR:1.5};
function runOne(cfg,index){
  return new Promise((ok,no)=>{
    const tmp=path.join(HERE,`.p-${process.pid}-${index}.json`);
    const child=spawn('node',['--import',pathToFileURL(path.join(HERE,'preload.mjs')).href,path.join(HERE,'contrib.mjs'),'--heroes',cfg.heroes.join(','),'--ranks',cfg.ranks||'1,3,5','--teams',String(cfg.teams||10),'--json',tmp,...(cfg.args||[])],{env:{...process.env,UP_SET:JSON.stringify(cfg.set||{})},stdio:['ignore','ignore','pipe']});
    let err='';child.stderr.on('data',d=>err+=d);
    child.on('close',code=>{if(code!==0)return no(new Error(cfg.label+': '+err.slice(0,400)));const j=JSON.parse(fs.readFileSync(tmp,'utf8'));fs.unlinkSync(tmp);ok({cfg,j});});
  });
}
const queue=configs.map((c,i)=>[c,i]),results=new Array(configs.length);
async function worker(){while(queue.length){const [c,i]=queue.shift();results[i]=await runOne(c,i);}}
await Promise.all(Array.from({length:Math.min(JOBS,configs.length)},worker));
const outFile=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:null,flat=[];
const rarity={joker:'C',underdog:'C',toffee_apple:'R',antropy:'R',ash:'SR',cure_master:'SR',venom:'UR',behemoth:'UR'};
for(const {cfg,j} of results){
  for(const id of cfg.heroes){
    const cells=j.ranks.map(r=>{const by=Object.keys(j.results[r]).map(k=>j.results[r][k][id].index);return by.reduce((a,b)=>a+b,0)/by.length;});
    const sc=Object.fromEntries(Object.keys(j.results[j.ranks[Math.floor(j.ranks.length/2)]]).map(k=>[k,j.results[j.ranks[Math.floor(j.ranks.length/2)]][k][id].index.toFixed(2)]));
    const b=budget[rarity[id]]||1;
    flat.push({label:cfg.label,id,ranks:Object.fromEntries(j.ranks.map((r,i)=>[r,cells[i]])),mid:sc});
    console.log(`${cfg.label.padEnd(28)} ${id.padEnd(13)} ${j.ranks.map((r,i)=>r+'★ '+cells[i].toFixed(2)).join(' | ')}  (예산 ${b})  mid:${JSON.stringify(sc)}`);
  }
}

if(outFile)fs.writeFileSync(outFile,JSON.stringify(flat,null,1));
