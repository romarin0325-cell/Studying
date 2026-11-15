// New-player progression bench. A fresh profile plays the main stages in order through the real profile commands:
// the first ten, ten-pulls whenever 1,000 dreams are on hand, the free daily summons, enhancement, auto formation,
// rose watering and the first-week board, then a real battle with the in-game auto. A lost stage is tried again.
// It answers "how far does a new player get in the first sitting, and where do they stall?".
//   node defense/scripts/progression-sim.mjs [--stages 27] [--players 8] [--ai basic|smart] [--tries 4] [--days 1] [--json out.json]
// --ai basic: the in-game auto with no repositioning (a lazy player). smart: the measurement auto that also moves units.
// --days N: the run spans N login days (day changes are spread evenly over the stage range), so the first-week
// login rewards and dailies of later days arrive part-way.
import fs from 'node:fs/promises';
import * as content from '../src/content.js';
const {HERO,MAIN_STAGES,CHAPTERS}=content,levelOf=content.levelOf??(stage=>stage);
import {createProfile,command,teamPower} from '../src/profile.js';
import {createBattle,clearedRounds,autoPlay as basicAuto} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';
import {autoDeck,autoRelics} from '../src/auto-team.js';
import {beginnerState,featureOpen} from '../src/beginner.js';
import {BED_IDS,bedCost,bedOpen,HOUR} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const STAGES=Math.min(MAIN_STAGES,Number(opt('stages',27))),PLAYERS=Number(opt('players',8)),TRIES=Number(opt('tries',4)),DAYS=Number(opt('days',1));
const AI=opt('ai','basic');if(!['basic','smart'].includes(AI))throw new Error('--ai must be basic or smart');
const JSON_OUT=opt('json',null),autoPlay=AI==='smart'?smartAutoPlay:basicAuto;
const DT=.05,AUTO=.32,LIMIT_TICKS=900/DT,T0=Date.parse('2026-11-16T01:00:00Z');

function battle(p,seedOffset){
  const s=createBattle(p);let autoIn=0,pick=false,ticks=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
    const before=s.phase;engine.step(s,DT);ticks++;
    if(pick){autoPlay(s);autoIn=0;pick=false;}
    else if(before!=='reward'&&s.phase==='reward')pick=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){autoPlay(s);autoIn=0;}}
    s.events.length=0;
  }
  return {won:s.phase==='victory',round:clearedRounds(s),seconds:ticks*DT,merges:Math.min(999,s.stats.merges),perfect:s.phase==='victory'&&(s.stats.leaks||0)===0,health:s.health};
}
// Everything a player taps between battles, in the order a reward-chasing player would.
function chores(p,now){
  const ok=(action,a={})=>command(p,action,a,now).ok;
  const st=beginnerState(p);
  for(const d of st.days)for(const kind of ['login','task']){
    if(!d[kind].claimable)continue;
    if(kind==='login'&&d.day===7){const pick=st.days&&['rumi','zeke','luna','jasmine','queen'].find(id=>!p.heroes[id].owned)||'rumi';ok('beginnerClaim',{day:7,kind,choice:pick});}
    else ok('beginnerClaim',{day:d.day,kind});
  }
  ok('pet');if(featureOpen(p,'garden'))ok('basket');ok('idle');
  if(!p.firstTen&&p.cleared>=1)ok('draw',{banner:'normal',count:10,first:true});
  ok('draw',{banner:'normal',count:1,free:true});
  if(featureOpen(p,'relic'))ok('draw',{banner:'relic',count:1,free:true});
  while(p.dreams>=1000&&ok('draw',{banner:'normal',count:10}));
  for(const id of Object.keys(p.heroes))while(p.heroes[id].owned&&ok('enhance',{kind:'hero',id}));
  for(const id of Object.keys(p.relics))while(p.relics[id].owned&&ok('enhance',{kind:'relic',id}));
  for(const m of ['combat','merge','idle'])ok('daily',{id:m});
  ok('deck',{ids:autoDeck(p)});ok('relics',{ids:autoRelics(p)});
  if(featureOpen(p,'garden'))for(let guard=0;guard<400;guard++){
    const open=BED_IDS.filter(id=>bedOpen(id,p.cleared)),id=open.sort((a,b)=>bedCost(a,p.beds[a])-bedCost(b,p.beds[b]))[0];
    if(!id||!ok('bed',{id}))break;
  }
}
function player(index){
  const p=createProfile(T0);p.rng=(0x9e3779b9*(index+1))>>>0||1;
  let now=T0,battleSeconds=0;const rows=[];
  const dayLength=STAGES/DAYS;
  for(let stage=1;stage<=STAGES;stage++){
    const dayNo=Math.min(DAYS-1,Math.floor((stage-1)/dayLength));
    if(dayNo>0&&now<T0+dayNo*24*HOUR)now=T0+dayNo*24*HOUR+60000;
    let tries=0,last=null;
    while(tries<TRIES){
      chores(p,now);
      const begin=command(p,'begin',{mode:'main',stage},now);if(!begin.ok)throw new Error(begin.message);
      tries++;last=battle(p,tries);battleSeconds+=last.seconds;now+=Math.round(last.seconds*1000)+30000;
      command(p,'settle',{token:p.active.token,won:last.won,round:last.round,merges:last.merges,perfect:last.perfect},now);
      if(last.won)break;
    }
    const ranks={C:0,R:0,SR:0,UR:0};for(const id of p.deck)ranks[HERO[id].rarity]++;
    rows.push({stage,tries,won:last.won,round:last.round,health:last.health,power:teamPower(p),deck:[...p.deck],ranks,rose:p.beds.rose,minutes:battleSeconds/60});
    if(!last.won)break;
  }
  return rows;
}
const started=Date.now(),players=Array.from({length:PLAYERS},(_,i)=>player(i));
console.log(`신규 플레이어 진행 · ${AI==='smart'?'합리 오토':'기본 오토'} · ${PLAYERS}명 · 스테이지당 ${TRIES}회까지 · ${DAYS}일\n`);
console.log('| 스테이지 | 레벨 | 체력 배율 | 도달 | 첫 시도 클리어 | 평균 시도 | 막힘 | 평균 전투력 | 덱(C/R/SR/UR) | 장미 | 누적 전투(분) |');
console.log('|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|');
const summary=[];
for(let stage=1;stage<=STAGES;stage++){
  const rows=players.map(r=>r[stage-1]).filter(Boolean);if(!rows.length)break;
  const n=rows.length,mean=f=>rows.reduce((a,r)=>a+f(r),0)/n;
  const row={stage,level:levelOf(stage),hp:CHAPTERS[stage-1].hp,reached:n,firstTry:rows.filter(r=>r.won&&r.tries===1).length/n,tries:mean(r=>r.tries),stuck:rows.filter(r=>!r.won).length,
    power:mean(r=>r.power),deck:['C','R','SR','UR'].map(k=>mean(r=>r.ranks[k]).toFixed(1)).join('/'),rose:mean(r=>r.rose),minutes:mean(r=>r.minutes)};
  summary.push(row);
  console.log(`| ${stage} | ${row.level} | ${row.hp.toFixed(2)} | ${n}/${PLAYERS} | ${Math.round(row.firstTry*100)}% | ${row.tries.toFixed(2)} | ${row.stuck} | ${Math.round(row.power).toLocaleString('en-US')} | ${row.deck} | ${row.rose.toFixed(0)} | ${row.minutes.toFixed(0)} |`);
}
console.error(`${((Date.now()-started)/1000).toFixed(1)}s`);
if(JSON_OUT)await fs.writeFile(JSON_OUT,JSON.stringify({ai:AI,players:PLAYERS,tries:TRIES,days:DAYS,summary},null,2)+'\n');
