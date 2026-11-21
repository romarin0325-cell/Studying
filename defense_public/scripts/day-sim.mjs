// Tester-day simulation of the public tempo. A fresh profile plays through the real profile commands for whole play
// sessions on a real clock: idle collection, dispatches, the gift basket and gifts to the partner, the sprout steps,
// paid ten-pulls (heroes and relics), pity exchange, enhancement, greenhouse beds, auto formation, main stages (with a
// short farm of the last cleared stage after two losses) and one run of each period challenge when its period is new
// (draft, hunt and the oath window; twin windows are skipped, so challenge income is a lower bound).
// It answers "where is a tester after N hours of play, and where did the stardust and dreams come from?".
//   node defense_public/scripts/day-sim.mjs [--players 6] [--plan dedicated|casual|marathon|day2] [--ai smart|basic] [--speed 2] [--json out.json]
// Plans are [start hour, end hour] play sessions; time between them is a break (idle, dispatch and basket keep running).
// Battle time is the engine's simulated seconds divided by --speed (2x is the in-game fast mode) plus --overhead seconds
// of menus per battle. The in-game auto never repositions (basic); smart also moves units, closer to an engaged human.
import fs from 'node:fs/promises';
import {HERO,MAIN_STAGES,TIERS,TIER_IDS,levelOf} from '../src/content.js';
import {createProfile,command,teamPower} from '../src/profile.js';
import {createBattle,clearedRounds,autoPlay as basicAuto} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';
import {autoDeck,autoRelics} from '../src/auto-team.js';
import {featureOpen,beginnerState,urChoices} from '../src/beginner.js';
import {BED_IDS,bedCost,bedOpen,HOUR,heroPool,lateOpen,combatPower,dispatchSlots,calendar} from '../src/economy.js';
import {eventOpen,season} from '../src/preview/season.js';
import {BOND_MAX} from '../src/bond.js';
import * as engine from '../src/combat/engine.js';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const PLAYERS=Number(opt('players',6)),SPEED=Number(opt('speed',2)),OVERHEAD=Number(opt('overhead',25)),PLAN=opt('plan','dedicated'),AI=opt('ai','smart');
const RELIC_SHARE=Number(opt('relic-share',.35)),JSON_OUT=opt('json',null);
const PLANS={dedicated:[[0,1.5],[3,4.5],[7,9]],casual:[[0,.75],[5,5.75]],marathon:[[0,3],[4,7],[8,11]],day2:[[0,1.5],[3,4.5],[7,9],[24,25.5],[27,28.5],[31,33]]};
const SESSIONS=PLANS[PLAN];if(!SESSIONS)throw new Error('unknown --plan '+PLAN);
if(!['smart','basic'].includes(AI))throw new Error('--ai must be smart or basic');
const autoPlay=AI==='smart'?smartAutoPlay:basicAuto;
const DT=.05,AUTO=.32,LIMIT_TICKS=1800/DT,T0=Date.parse('2026-11-23T00:30:00Z');

function battle(p){
  const s=createBattle(p);let autoIn=0,pick=false,ticks=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
    const before=s.phase;engine.step(s,DT);ticks++;
    if(pick){autoPlay(s);autoIn=0;pick=false;}
    else if(before!=='reward'&&s.phase==='reward')pick=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){autoPlay(s);autoIn=0;}}
    s.events.length=0;
  }
  return {won:s.phase==='victory',round:clearedRounds(s),seconds:ticks*DT,merges:Math.min(999,s.stats.merges),perfect:s.phase==='victory'&&(s.stats.leaks||0)===0};
}
function player(index){
  const p=createProfile(T0);p.rng=(0x9e3779b9*(index+1))>>>0||1;
  let now=T0;const ok=(action,a={})=>command(p,action,a,now);
  const dust={stage:0,idle:0,dispatch:0,sprout:0},dreams={firstClear:0,perfect:0,dispatch:0,challenge:0,sprout:0,daily:0};
  const st={battles:0,wins:0,heroPulls:0,relicPulls:0,lucky:0,seen:{draft:'',rush:'',oath:''},challengeMinutes:0};
  const addReward=(bucket,r)=>{if(!r)return;if(r.dreams)dreams[bucket]+=r.dreams;if(r.dust)dust[bucket]+=r.dust;};
  function chores(){
    for(const d of beginnerState(p).days)for(const kind of ['login','task']){
      if(!d[kind].claimable)continue;
      const choice=kind==='login'&&d.day===7?(urChoices(p).find(x=>!x.owned)||urChoices(p)[0]).id:undefined;
      const r=ok('beginnerClaim',{day:d.day,kind,...(choice?{choice}:{})});if(r.ok)addReward('sprout',r.reward);
    }
    const pet=ok('pet');if(pet.ok)dreams.daily+=40;
    if(featureOpen(p,'garden')){ok('basket');for(const g of ['bouquet','letter','candy'])while(p.gifts[g]>0&&p.heroes[p.partner].bond<BOND_MAX&&ok('gift',{id:p.partner,gift:g}).ok);}
    const idle=ok('idle');if(idle.ok)dust.idle+=idle.reward;
    for(const d of [...p.dispatches])if(d.end<=now){const r=ok('claimDispatch',{slot:d.slot});if(r.ok){dust.dispatch+=r.dust;dreams.dispatch+=r.reward;}}
    for(let slot=0;slot<dispatchSlots(p.cleared);slot++){
      if(p.dispatches.some(d=>d.slot===slot))continue;
      const spare=Object.keys(p.heroes).filter(id=>p.heroes[id].owned&&!p.deck.includes(id)&&!p.dispatches.some(d=>d.hero===id)).sort((a,b)=>combatPower(b,p.heroes[b],p.beds)-combatPower(a,p.heroes[a],p.beds));
      if(!spare.length||!ok('dispatch',{slot,id:spare[0]}).ok)break;
    }
    if(!p.firstTen&&p.cleared>=1)ok('draw',{banner:'normal',count:10,first:true});
    ok('draw',{banner:'normal',count:1,free:true});if(featureOpen(p,'relic'))ok('draw',{banner:'relic',count:1,free:true});
    for(const id of ['combat','merge','idle']){const r=ok('daily',{id});if(r.ok)dreams.daily+=r.reward;}
    for(let guard=0;guard<300;guard++){
      const relicTurn=featureOpen(p,'relic')&&p.relicDraws<(p.draws+p.relicDraws)*RELIC_SHARE;
      const r=relicTurn&&p.dreams>=800?ok('draw',{banner:'relic',count:10}):p.dreams>=1000?ok('draw',{banner:'normal',count:10}):null;
      if(!r?.ok)break;if(r.lucky)st.lucky++;const n=10+(r.bonus?.length||0);if(relicTurn)st.relicPulls+=n;else st.heroPulls+=n;
    }
    if(p.pity.normal>=200){const pick=heroPool('UR',lateOpen(p.cleared)).find(id=>!p.heroes[id].owned)||heroPool('UR',lateOpen(p.cleared))[0];ok('pityClaim',{banner:'normal',id:pick});}
    for(const id of Object.keys(p.heroes))while(p.heroes[id].owned&&ok('enhance',{kind:'hero',id}).ok);
    for(const id of Object.keys(p.relics))while(p.relics[id].owned&&ok('enhance',{kind:'relic',id}).ok);
    if(!p.active){ok('deck',{ids:autoDeck(p)});ok('relics',{ids:autoRelics(p)});}
    if(featureOpen(p,'garden'))for(let guard=0;guard<600;guard++){
      const open=BED_IDS.filter(id=>bedOpen(id,p.cleared)),id=open.sort((a,b)=>bedCost(a,p.beds[a])-bedCost(b,p.beds[b]))[0];
      if(!id||!ok('bed',{id}).ok)break;
    }
  }
  const spend=r=>{now+=Math.round((r.seconds/SPEED+OVERHEAD)*1000);st.battles++;if(r.won)st.wins++;};
  function main(stage){
    const begin=ok('begin',{mode:'main',stage});if(!begin.ok)throw new Error(begin.message);
    const first=stage===p.cleared+1,r=battle(p);spend(r);
    const out=ok('settle',{token:p.active.token,won:r.won,round:r.round,merges:r.merges,perfect:r.perfect});
    dust.stage+=out.dust||0;if(out.clearReward)dreams.firstClear+=out.clearReward;if(out.firstPerfect)dreams.perfect+=out.reward-(out.clearReward||0);
    return {...r,first};
  }
  const topTier=()=>[...TIER_IDS].reverse().find(t=>p.cleared>=TIERS[t].unlock)||'easy';
  function challenge(mode){
    const start=now,tier=topTier();
    const begin=ok('begin',mode==='oath'?{mode,tier,oaths:['afterglow','heavy']}:{mode,tier});if(!begin.ok)return false;
    if(mode==='weekly')while(p.active.draft.length<5){const o=p.active.offers;const pick=o.length>1&&combatPower(o[1].id,p.heroes[o[1].id]?.owned?p.heroes[o[1].id]:{owned:true,enhance:0},p.beds)>combatPower(o[0].id,p.heroes[o[0].id]?.owned?p.heroes[o[0].id]:{owned:true,enhance:0},p.beds)?1:0;ok('draft',{index:pick});}
    const r=battle(p);spend(r);
    const out=ok('settle',{token:p.active.token,won:r.won,round:r.round,merges:r.merges,damage:0,seconds:Math.round(r.seconds)});
    if(out.ok)dreams.challenge+=out.reward||0;st.challengeMinutes+=(now-start)/60000;return true;
  }
  const marks=[];let fails=0;
  for(const [a,b] of SESSIONS){
    now=Math.max(now,T0+a*HOUR);const end=T0+b*HOUR;
    while(now<end){
      chores();
      if(p.cleared>=TIERS.easy.unlock){
        const c=calendar(now);
        if(st.seen.draft!==c.week){st.seen.draft=c.week;challenge('weekly');continue;}
        if(st.seen.rush!==c.month){st.seen.rush=c.month;challenge('monthly');continue;}
        const s=season(now).id;if(eventOpen('oath',now)&&st.seen.oath!==s){st.seen.oath=s;challenge('oath');continue;}
      }
      if(p.cleared>=MAIN_STAGES){now=end;break;}
      if(fails<2){const r=main(p.cleared+1);fails=r.won?0:fails+1;}
      else{for(let k=0;k<4&&now<end;k++)main(Math.max(1,p.cleared));chores();fails=0;const r=main(p.cleared+1);if(!r.won)fails=2;}
    }
    const owned=Object.values(p.heroes).filter(e=>e.owned).length;
    marks.push({hour:b,stage:p.cleared,power:teamPower(p),beds:{...p.beds},battles:st.battles,wins:st.wins,heroPulls:st.heroPulls,relicPulls:st.relicPulls,lucky:st.lucky,
      heroes:owned,urs:Object.keys(p.heroes).filter(id=>p.heroes[id].owned&&HERO[id].rarity==='UR').length,relics:Object.values(p.relics).filter(e=>e.owned).length,
      memorials:Object.values(p.heroes).filter(e=>e.owned&&e.bond>=BOND_MAX).length,partnerBond:p.heroes[p.partner].bond,paintings:p.study.library.unlocked.length,
      sprout:p.beginner?p.beginner.tasks.length:7,challengeMinutes:Math.round(st.challengeMinutes),dust:{...dust},dreams:{...dreams}});
  }
  return marks;
}
const started=Date.now(),runs=Array.from({length:PLAYERS},(_,i)=>player(i));
const mean=(rows,f)=>rows.reduce((s,r)=>s+f(r),0)/rows.length,median=(rows,f)=>{const v=rows.map(f).sort((a,b)=>a-b);return v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;};
console.log(`공개판 하루 시뮬레이션 · ${PLAN} ${JSON.stringify(SESSIONS)} · ${AI==='smart'?'합리 오토':'기본 오토'} · ${SPEED}배속 · ${PLAYERS}명\n`);
console.log('| 시각 | 스테이지(각자) | 중앙값 | 전투 | 동료 소환 | 유물 소환 | 행운 | 보유 동료 | UR | 유물 | 메모리얼 | 루미 그림 | 새싹 | 도전(분) |');
console.log('|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
const summary=[];
for(let m=0;m<SESSIONS.length;m++){
  const rows=runs.map(r=>r[m]),f=(k,d=0)=>mean(rows,r=>r[k]).toFixed(d);
  const dustAvg=Object.fromEntries(Object.keys(rows[0].dust).map(k=>[k,Math.round(mean(rows,r=>r.dust[k]))])),dreamAvg=Object.fromEntries(Object.keys(rows[0].dreams).map(k=>[k,Math.round(mean(rows,r=>r.dreams[k]))]));
  summary.push({hour:rows[0].hour,stages:rows.map(r=>r.stage),median:median(rows,r=>r.stage),dust:dustAvg,dreams:dreamAvg,mean:Object.fromEntries(['battles','heroPulls','relicPulls','lucky','heroes','urs','relics','memorials','paintings','sprout','challengeMinutes'].map(k=>[k,+f(k,1)]))});
  console.log(`| ${rows[0].hour}h | ${rows.map(r=>r.stage).join('/')} | ${median(rows,r=>r.stage)} | ${f('battles')} | ${f('heroPulls')} | ${f('relicPulls')} | ${f('lucky',1)} | ${f('heroes')} | ${f('urs',1)} | ${f('relics')} | ${f('memorials',1)} | ${f('paintings',1)} | ${f('sprout',1)} | ${f('challengeMinutes')} |`);
}
console.log('\n별가루 출처(평균, 누적):');for(const s of summary)console.log(`  ${s.hour}h ${JSON.stringify(s.dust)}`);
console.log('꿈의결정 출처(평균, 누적):');for(const s of summary)console.log(`  ${s.hour}h ${JSON.stringify(s.dreams)}`);
console.error(`${((Date.now()-started)/1000).toFixed(1)}s`);
if(JSON_OUT)await fs.writeFile(JSON_OUT,JSON.stringify({plan:PLAN,sessions:SESSIONS,ai:AI,speed:SPEED,players:PLAYERS,summary},null,2)+'\n');
