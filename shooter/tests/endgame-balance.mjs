import {Game} from '../engine.js';
import {pilot} from './balance.mjs';
import fs from 'node:fs/promises';
const results=[];
for(const stage of [3,4,5])for(const hero of [0,5,7,8])for(const weapon of [0,1])for(const mode of ['normal','hard']){
 const g=new Game({stage,hero,weapon,mode,seed:92,artifacts:['dream','leaf','core']});
 for(let i=0;i<60*360&&!g.finished;i++){if(i%6===0)pilot(g);g.update(1/60);}
 results.push({stage,hero,weapon,mode,result:g.phase,time:Math.round(g.totalTime),maxBullets:g.stats.maxBullets});
}
const summary={runs:results.length,stalled:results.filter(r=>!['victory','defeat'].includes(r.result)),byStage:[3,4,5].map(stage=>({stage,wins:results.filter(r=>r.stage===stage&&r.result==='victory').length,runs:16}))};
await fs.mkdir(new URL('../artifacts',import.meta.url),{recursive:true});await fs.writeFile(new URL('../artifacts/endgame-balance.json',import.meta.url),JSON.stringify({summary,results},null,2));console.log(JSON.stringify(summary,null,2));
if(summary.stalled.length)process.exitCode=1;
