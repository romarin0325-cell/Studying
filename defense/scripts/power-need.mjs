// How much hero power a stage asks for. For each stage it searches the smallest power multiplier (the same factor the
// greenhouse rose and duplicates give) at which a deck clears the stage in at least half of the plays, then prints it
// relative to stage 45. Part two keeps the stage-1..45 slope, so the ratio shows how much extra growth stages 46-90 need
// and where a +20% crit garden (dawn full) lands.
//   node defense/scripts/power-need.mjs [--stages 45,50,55,60,70,80,90] [--seeds 8] [--deck "a,b,c,d,e"] [--target 0.5] [--json out.json]
import fs from 'node:fs/promises';
import {specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {clearedRounds} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';

const DT=.05,AUTO=.32,LIMIT_TICKS=900/DT;
const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const STAGES=opt('stages','45,50,55,60,70,80,90').split(',').map(Number),SEEDS=Number(opt('seeds',8)),TARGET=Number(opt('target',.5));
const DECK=opt('deck','zeke,luna,jasmine,ancient_dragon,great_detective').split(',');
if(!engine.validDeck(DECK))throw new Error('Invalid deck');
if(STAGES.some(s=>!Number.isInteger(s)||s<1||s>90))throw new Error('--stages must be 1..90');
// The late-game greenhouse a player has: full starlight spring and gold seed.
const SPRING=30,SEED=20;
function wins(stage,power,seeds){
  let won=0;
  for(let seed=1;seed<=seeds;seed++){
    const meta=Object.fromEntries(DECK.map(id=>[id,{power,special:specialMultiplier(0)}]));
    const s=engine.newRun({deck:DECK,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(SPRING),startGold:seedGold(SEED)});
    let autoIn=0,pick=false,ticks=0;
    while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
      const before=s.phase;engine.step(s,DT);ticks++;
      if(pick){smartAutoPlay(s);autoIn=0;pick=false;}
      else if(before!=='reward'&&s.phase==='reward')pick=true;
      else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){smartAutoPlay(s);autoIn=0;}}
      s.events.length=0;
    }
    if(s.phase==='victory')won++;
  }
  return won/seeds;
}
// Win rate rises with power, so a bisection on a log scale finds the 50% point.
function need(stage){
  let lo=1,hi=1;
  while(wins(stage,hi,SEEDS)<TARGET&&hi<4000)hi*=2;
  lo=hi/2<1?1:hi/2;
  for(let i=0;i<7;i++){const mid=Math.sqrt(lo*hi);if(wins(stage,mid,SEEDS)>=TARGET)hi=mid;else lo=mid;}
  return hi;
}
const rows=[];
for(const stage of STAGES){const m=need(stage);rows.push({stage,power:m});console.error('stage',stage,m.toFixed(2));}
const base=rows.find(r=>r.stage===45)?.power??rows[0].power;
console.log(`덱 ${DECK.join(',')} · 시드 ${SEEDS} · 승률 ${TARGET*100}% 지점의 위력 배율(샘 ${SPRING}, 씨 ${SEED})\n`);
console.log('| 스테이지 | 필요 위력 배율 | 스테이지 45 대비 |','\n|---:|---:|---:|');
for(const r of rows)console.log(`| ${r.stage} | ${r.power.toFixed(1)} | ×${(r.power/base).toFixed(2)} |`);
const JSON_OUT=opt('json',null);if(JSON_OUT)await fs.writeFile(JSON_OUT,JSON.stringify({deck:DECK,seeds:SEEDS,target:TARGET,rows},null,1));
