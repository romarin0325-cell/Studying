// Plays decks on stages with the smart auto and prints a compact comparison table (win rate, health, rounds, time,
// unit-seconds disabled, curses, units lost to judgement, ultimates cast, sacrificed units).
//   node --import ./preload.mjs compare-decks.mjs --decks "a,b,c,d,e;f,g,h,i,j" --stages 1,5,9 --seeds 8 [--label "A;B"]
import {playStage,HERO,mean} from './play.mjs';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:f;};
const decks=opt('decks','').split(';').map(d=>d.split(',').map(x=>x.trim()).filter(Boolean)).filter(d=>d.length);
const stages=opt('stages','9,21,33,45').split(',').map(Number),seeds=Number(opt('seeds',6)),labels=(opt('label','')||'').split(';');
const castOf=(r,ids)=>ids.map(id=>r.track.casts[id]||0).reduce((a,b)=>a+b,0);
console.log('| 덱 | 스테이지 | 승률 | 체력 | 라운드 | 시간 | 행동불능(유닛·초) | 저주 | 천벌 제거 | 필살기 | 환원 |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const [i,deck] of decks.entries()){
  const name=labels[i]||deck.map(id=>HERO[id].name).join('·');
  const all=[];
  for(const stage of stages){
    const rows=[];for(let seed=1;seed<=seeds;seed++)rows.push(playStage(deck,stage,seed));all.push(...rows);
    console.log(`| ${name} | ${stage} | ${(mean(rows,r=>+r.won)*100).toFixed(0)}% | ${mean(rows,r=>r.health).toFixed(1)} | ${mean(rows,r=>r.rounds).toFixed(2)} | ${mean(rows,r=>r.time).toFixed(0)}s | ${mean(rows,r=>r.track.disabledSeconds).toFixed(1)} | ${mean(rows,r=>r.track.cursed).toFixed(2)} | ${mean(rows,r=>r.track.judged).toFixed(2)} | ${mean(rows,r=>r.skills).toFixed(1)} | ${mean(rows,r=>r.sacrificed).toFixed(1)} |`);
  }
  console.log(`| **${name}** | 전체 | **${(mean(all,r=>+r.won)*100).toFixed(0)}%** | ${mean(all,r=>r.health).toFixed(1)} | ${mean(all,r=>r.rounds).toFixed(2)} | ${mean(all,r=>r.time).toFixed(0)}s | ${mean(all,r=>r.track.disabledSeconds).toFixed(1)} | ${mean(all,r=>r.track.cursed).toFixed(2)} | ${mean(all,r=>r.track.judged).toFixed(2)} | ${mean(all,r=>r.skills).toFixed(1)} | ${mean(all,r=>r.sacrificed).toFixed(1)} |`);
}
