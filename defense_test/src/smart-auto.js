// A reasonable player model for balance simulations and the unlocked test build.
// The in-game auto (battle.js autoPlay) stays a light helper; this one plays like a
// careful person: it places by range and auras, compares summon and training per gold,
// times ultimates (triggers, boss, economy, setup combos, gauge overflow), dodges lit
// boss cells and cleans curses. It only uses the public run commands, never the RNG.
import {HERO,BLESSING} from './content.js';
import * as E from './combat/engine.js';

const L=E.PATH_LENGTH,CELLS=[...Array(25).keys()];
// Later path segments matter more: an enemy there is closer to leaking.
const SAMPLES=Array.from({length:120},(_,i)=>{const d=(i+.5)*L/120;return {...E.pathPoint(d),w:.6+.8*d/L};}),SAMPLE_W=SAMPLES.reduce((n,p)=>n+p.w,0);
const coverCache=new Map();
function coverage(id,cell){
  const key=id+':'+cell;let v=coverCache.get(key);if(v!==undefined)return v;
  const h=HERO[id],at=E.cellPoint(cell);
  if(id==='flame_sage')v=1;
  else{let w=0;for(const p of SAMPLES){const dx=p.x-at.x,dy=p.y-at.y;if(Math.hypot(dx,dy)>h.range)continue;if(h.shape==='cross'&&Math.abs(dx)>h.radius/2&&Math.abs(dy)>h.radius/2)continue;w+=p.w;}v=w/SAMPLE_W;}
  coverCache.set(key,v);return v;
}
// Average enemies one attack reaches, by attack shape.
const aoe=h=>({single:1,beam:1.5,cleave:1.9,pulse:2.4,chain:2.2,bounce:1.8,cross:1.6}[h.shape]??(h.shape==='zone'?1+h.radius/45:h.shape==='splash'?1+h.radius/70:1));
// Control and team amplification are not in raw damage.
const ROLE={snow_rabbit:1.9,time_ruler:1.6,frost_witch:1.4,galaxy_whale:1.35,phantom:1.3,guardian:1.3,great_detective:1.5,storm_sage:1.1,avalanche_maid:1.1,aurora:1.1};

function unitValue(s,u,i){
  if(!u||u.cursed)return 0;
  const h=HERO[u.hero],st=E.combatStats(s,u,i);let v=st.damage/st.interval*aoe(h)*coverage(u.hero,i)*(ROLE[u.hero]||1);
  if(u.hero==='time_magician'){ // every third attack lets each neighbour fire once more at 60%
    for(const n of E.neighbors(i)){const a=s.board[n];if(!a||a.cursed)continue;const ns=E.combatStats(s,a,n);v+=ns.damage*.6*E.rankSupport(u.rank)/(3*st.interval)*aoe(HERO[a.hero])*coverage(a.hero,n);}
  }
  return v;
}
function affected(s,cells){
  const set=new Set();for(const c of cells){set.add(c);for(const n of E.neighbors(c))set.add(n);}
  for(const c of [...set])if(s.board[c]?.hero==='harmonious')for(const n of E.neighbors(c))set.add(n);
  const heroes=new Set([...set].map(c=>s.board[c]?.hero).filter(Boolean));
  for(const id of ['lightning_sage','aurora','cinderella','night_rabbit'])if(heroes.has(id)||id==='night_rabbit'&&[...heroes].some(h=>h.endsWith('_rabbit')))CELLS.forEach(c=>{if(s.board[c]?.hero===id||id==='night_rabbit'&&s.board[c]?.hero==='night_rabbit')set.add(c);});
  return [...set];
}
const valueAt=(s,cells)=>cells.reduce((n,c)=>n+unitValue(s,s.board[c],c),0);
export function boardValue(s){return valueAt(s,CELLS);}
// Value change of a temporary board edit, restored before returning.
function delta(s,cells,apply,revert){
  const before=affected(s,cells);apply();const after=affected(s,cells);revert();
  const all=[...new Set([...before,...after])],v0=valueAt(s,all);apply();const v1=valueAt(s,all);revert();return v1-v0;
}
const tempUnit=(s,hero,rank)=>({uid:-1,hero,rank,cooldown:0,windup:0,target:null,attacks:0,pose:0,born:s.time,birthWave:s.wave,harvest:12,disabled:0,facing:'down',aim:0,idleFor:0,priority:'first'});
function placeDelta(s,unit,cell){return delta(s,[cell],()=>{s.board[cell]=unit;},()=>{s.board[cell]=null;});}
function swapDelta(s,a,b){const sw=()=>{const t=s.board[a];s.board[a]=s.board[b];s.board[b]=t;};return delta(s,[a,b],sw,sw);}

const memory=new WeakMap();
function mem(s){let m=memory.get(s);if(!m){m={dps:0,lastDamage:s.stats.damage,lastTime:s.time,nextOpt:0,sig:'',scale:0};memory.set(s,m);}return m;}
const alive=s=>s.enemies.filter(e=>e.hp>0);
const timeLeft=s=>s.mode==='main'?Math.max(20,(6-s.wave+(['reward','intermission'].includes(s.phase)?0:.5))*50):150;
const remainingFight=(s,dps)=>(alive(s).reduce((n,e)=>n+e.hp+(e.shield||0),0)+s.queue.reduce((n,q)=>n+q.hp,0))/Math.max(1,dps);
const litCells=s=>s.telegraph&&['seal','storm','stun1','judgement','thunder'].includes(s.telegraph.pattern)?new Set(s.telegraph.cells):new Set();

// Damage-equivalent of one gold: a fresh summon's value over the rest of the stage, per gold.
function goldValue(s,m){const cost=Math.max(8,E.summonCost(s)||10);return summonValue(s)*m.scale*timeLeft(s)/cost;}
function bestCell(s,unit,exclude=new Set()){let best=-1,bv=-Infinity;for(const c of CELLS){if(s.board[c]||exclude.has(c))continue;const v=placeDelta(s,unit,c);if(v>bv){bv=v;best=c;}}return {cell:best,value:bv};}
function summonValue(s){
  const m=mem(s),key=s.board.map(u=>u?u.uid+':'+u.rank:'').join(',')+'|'+s.deck.map(id=>s.upgrades[id]).join()+'|'+s.wave+'|'+Object.keys(s.buffs).filter(k=>s.buffs[k]>0).join();
  if(m.svKey===key)return m.sv;
  const free=CELLS.filter(c=>!s.board[c]);m.svKey=key;
  const units=s.board.filter(Boolean).length;
  const per=id=>{const v=Math.max(0,bestCell(s,tempUnit(s,id,1)).value),partner=s.board.some(u=>u&&!u.cursed&&u.rank===1&&(u.hero===id||u.hero==='rumi'||id==='rumi'));return v*(partner?1.6:1);};
  return m.sv=free.length?s.deck.reduce((n,id)=>n+per(id),0)/s.deck.length*(units<10?1.3:1):0;
}
function trainValue(s,id){
  if(s.upgrades[id]>=5)return 0;const cells=CELLS.filter(c=>s.board[c]?.hero===id);if(!cells.length)return 0;
  const all=affected(s,cells),v0=valueAt(s,all);s.upgrades[id]++;const v1=valueAt(s,all);s.upgrades[id]--;
  let extra=0;if(id==='queen')extra=cells.length*3*Math.max(0,6-s.wave)*0; // queen training gold is small next to her power
  return v1-v0+extra;
}

// ── Ultimate values, in damage units (team damage per second times seconds, or direct damage).
function ultValue(s,m,id,gv){
  const h=HERO[id],u=E.bestUnit(s,id);if(!u)return -Infinity;
  const type=h.skill.type,P=E.power(s,u),list=alive(s),dps=Math.max(1,m.dps),rem=remainingFight(s,dps),cap=E.gaugeCap(s);
  const taken=e=>1+(e.takenBonus||0)+(e.boss&&HERO[id].bossDamage?HERO[id].bossDamage-1:0);
  const hit=(f,e)=>Math.min(f*P*taken(e),e.hp+(e.shield||0));
  const strike=f=>list.reduce((n,e)=>n+hit(f,e),0);
  const health=s.health,danger=list.filter(e=>e.progress>L*(e.boss?.5:.62)),urgency=1+Math.max(0,14-health)/6;
  const control=sec=>danger.reduce((n,e)=>n+Math.min(e.hp,dps*sec*(e.progress/L)),0)*urgency+dps*sec*.15*Math.min(1,list.length/4);
  const fam=(key,family,x)=>{ // gain of an ultimate-family buff given what is already active
    const cur=family==='power'?Math.max(s.buffs.awaken>0?E.ULT_BUFF.awaken.power:0,s.buffs.radiance>0?E.ULT_BUFF.radiance.power:0,s.buffs.harmony>0?E.ULT_BUFF.harmony.power:0)
      :Math.max(s.buffs.haste>0?E.ULT_BUFF.haste.speed:0,s.buffs.march>0?E.ULT_BUFF.march.speed:0,s.buffs.festive>0?E.ULT_BUFF.festive.speed:0,s.buffs.harmony>0?E.ULT_BUFF.harmony.speed:0);
    return (1+Math.max(x,cur))/(1+cur)-1;};
  const buff=(gain,sec)=>dps*gain*Math.min(sec,rem);
  const scale=E.rankControl(u.rank),boss=list.find(e=>e.boss),strongest=list.reduce((a,b)=>!a||b.maxHp>a.maxHp?b:a,null);
  const thunderCancel=()=>s.telegraph?.pattern==='thunder'&&list.some(e=>e.judging)?[...litCells(s)].reduce((n,c)=>n+(s.board[c]?unitValue(s,s.board[c],c):0),0)*m.scale*4:0;
  // A big damage ultimate that could follow a setup (exposure, mirror) right after.
  const follow=()=>Math.max(0,...s.deck.filter(o=>o!==id&&E.bestUnit(s,o)&&s.gauge-h.skill.cost>=HERO[o].skill.cost&&s.gold>=E.skillGoldCost(o)&&!['expose','mirror'].includes(HERO[o].skill.type)).map(o=>{const t=HERO[o].skill.type;return ['royal','execute','fortune','inferno','combust','thunder','ice_court','dragon','flurry','singularity','vortex','glassfall','goddess','trauma','nightmare','dividend','starfall'].includes(t)?ultValue(s,m,o,gv)*.6:0;}));
  switch(type){
    case 'echo':return buff(E.ULT_BUFF.echo.ratio*scale,8);
    case 'haste':return buff(fam('haste','speed',E.ULT_BUFF.haste.speed*scale),8);
    case 'march':return buff(fam('march','speed',E.ULT_BUFF.march.speed*scale),8)+dps*.04*Math.min(8,rem);
    case 'awaken':return buff(fam('awaken','power',E.ULT_BUFF.awaken.power*scale),8);
    case 'harmony':{const p=fam('harmony','power',E.ULT_BUFF.harmony.power),q=fam('harmony','speed',E.ULT_BUFF.harmony.speed);return buff((1+p)*(1+q)-1,8);}
    case 'goddess':{const blocked=litCells(s).size&&['seal','storm','stun1','thunder','judgement'].includes(s.telegraph?.pattern)?[...litCells(s)].reduce((n,c)=>n+(s.board[c]?unitValue(s,s.board[c],c):0),0)*m.scale*4:0;
      const freed=CELLS.reduce((n,c)=>{const a=s.board[c];return n+(a&&(a.cursed||a.disabled>0)?unitValue(s,{...a,cursed:false},c)*m.scale*Math.min(8,a.cursed?rem:a.disabled):0);},0);
      return strike(5)+buff(fam('radiance','power',E.ULT_BUFF.radiance.power*scale),8)+blocked+freed;}
    case 'trauma':{const mags=CELLS.filter(c=>s.board[c]?.hero==='time_magician');return strike(4)+mags.reduce((n,c)=>n+unitValue(s,s.board[c],c)*m.scale*(2.1*1.35-1)*Math.min(10,rem),0);}
    case 'glassfall':{const top=E.topCinderella(s),i=top?s.board.indexOf(top):-1;return strike(E.CINDERELLA.ult)+(top?unitValue(s,top,i)*m.scale*1.9*Math.min(10,rem):0);}
    case 'gift':return (summonValue(s)*m.scale*timeLeft(s))+buff(fam('festive','speed',E.ULT_BUFF.festive.speed*scale),6);
    case 'dividend':return strike(4)+(E.QUEEN_TAX+(s.edictWave!==s.wave?E.waveIncome(s.wave)*.5:0))*gv;
    case 'fortune':return strike(E.fortuneFactor(s.gold-E.skillGoldCost(id),s.upgrades[id]||0))-E.skillGoldCost(id)*gv;
    case 'expose':{const ex=E.detectiveExposure(s,u),lasting=list.reduce((n,e)=>n+e.hp,0)>dps*4;return strike(3)+(lasting?dps*ex*Math.min(10,rem):0)+follow()*ex;}
    case 'mirror':{if(!strongest)return 0;const share=strongest.boss?.75:1/Math.max(1,list.length);return Math.min(strongest.hp,12*P+E.mirrorRatio(s,u)*(dps*5*share+follow()*share));}
    case 'royal':return strongest?hit(24*(strongest.burnTime>0||strongest.divine>=3&&strongest.divineTime>0?2:1),strongest):0;
    case 'starfall':return s.gauge>=cap-2&&strongest?hit(.4*s.gauge,strongest):0;
    case 'execute':{const order=[...list].sort((a,b)=>Number(!!b.boss)-Number(!!a.boss)||b.maxHp-a.maxHp).slice(0,5);return order.reduce((n,e)=>n+hit(e.hp/e.maxHp<=E.executeThreshold(e,s)?30:16,e),0);}
    case 'inferno':return strike(7*(health<10?2:1))+strike(.6)*1.5;
    case 'combust':return list.reduce((n,e)=>n+hit(e.burnTime>0?10:4,e),0)+strike(.6)*1.5;
    case 'plague':return strike(3)+list.reduce((n,e)=>n+Math.min(e.hp,8*P*.1*12),0);
    case 'thunder':return strike(7)+control(1.2*scale)+thunderCancel();
    case 'ice_court':return strike(6)+control(3);
    case 'freeze':return strike(3)+control(2*scale+3)+thunderCancel();
    case 'avalanche':return list.reduce((n,e)=>n+hit(e.controlTime>0?12:4,e),0)+control(2);
    case 'dragon':{let best=[];for(const e of list){const p=E.pathPoint(e.progress),near=list.filter(t=>{const q=E.pathPoint(t.progress);return Math.hypot(q.x-p.x,q.y-p.y)<=180;});if(near.length>best.length)best=near;}return best.reduce((n,e)=>n+hit(14,e)+hit(.6*5*.5,e),0);}
    case 'flurry':return [...list].sort((a,b)=>b.progress-a.progress).slice(0,9+2*new Set(s.board.filter(a=>a&&a.hero!=='night_rabbit'&&a.hero.endsWith('_rabbit')).map(a=>a.hero)).size).reduce((n,e)=>n+hit(9,e),0);
    case 'vortex':return strike(5)+control(1.5*scale+2.4)*1.2+thunderCancel();
    case 'singularity':return list.reduce((n,e)=>n+hit(8*(1+.5*(e.divine||0)),e),0)+control(2*scale+2.4)+thunderCancel();
    case 'quake':return strike(3)+control(2.5*scale)+thunderCancel();
    case 'nightmare':return strike(4)+control(2)+dps*.25*Math.min(6,rem)*.6;
    case 'rewind':return strike(3)+control(6)+thunderCancel();
    default:return strike(3);
  }
}
function pickUltimate(s,m){
  if(s.phase!=='combat')return null;const list=alive(s);if(!list.length)return null;
  const gv=goldValue(s,m),cap=E.gaugeCap(s),dps=Math.max(1,m.dps);
  const ready=s.deck.filter(id=>E.bestUnit(s,id)&&s.gauge>=HERO[id].skill.cost&&s.gold>=E.skillGoldCost(id));if(!ready.length)return null;
  const options=ready.map(id=>({id,value:ultValue(s,m,id,gv),cost:HERO[id].skill.type==='starfall'?s.gauge:HERO[id].skill.cost})).filter(o=>o.value>0);
  if(!options.length)return null;
  const byRate=[...options].sort((a,b)=>b.value/b.cost-a.value/a.cost),byValue=[...options].sort((a,b)=>b.value-a.value);
  const boss=list.some(e=>e.boss),bossWave=boss||s.queue.some(q=>q.kind==='boss'),nextBoss=s.mode==='main'&&(s.wave+1)%3===0;
  const danger=list.some(e=>e.progress>L*(e.boss?.55:.72));
  // Love Iris drains a full gauge: spend it before the lit test resolves.
  if(s.telegraph?.pattern==='starlust'&&s.gauge>=cap-1)return byValue[0].id;
  if(danger&&byValue[0].value>=dps*1.5)return byValue[0].id;
  if(s.gauge>=cap-8)return byValue[0].id;
  // Early waves: economy ultimates compound.
  if(s.mode!=='monthly'&&s.wave<=2&&!bossWave){const eco=options.find(o=>['dividend','gift'].includes(HERO[o.id].skill.type));if(eco)return eco.id;}
  if(boss)return byRate[0].value>=dps*2.5?byRate[0].id:null;
  if(bossWave||nextBoss)return null; // keep the gauge for the boss
  return s.gauge>=cap*.8&&byRate[0].value>=dps*4?byRate[0].id:null;
}

function chooseBlessing(s,m){
  const gv=goldValue(s,m),dps=Math.max(1,m.dps),T=timeLeft(s),nextBoss=(s.wave+1)%3===0;
  const score={arrival:summonValue(s)*2.35*m.scale*T,surge:dps*.25*50*(nextBoss?1.6:1),training:30*gv*Math.max(0,6-s.wave)/3,oath:dps*.06*T,purse:35*gv,
    mend:dps*(s.health<14?3*(1+(14-s.health)/4):.4)*3+dps*20*.06};
  return [...s.reward].sort((a,b)=>(score[b]||0)-(score[a]||0))[0];
}

function dodge(s,m){
  const lit=litCells(s);if(!lit.size)return false;
  // A person moves the key units out, not the whole board: two per stun, every unit for the judgement.
  const key=s.telegraph.uid+":"+s.telegraph.ends.toFixed(2);if(m.dodgeKey!==key){m.dodgeKey=key;m.dodged=0;}
  if(s.telegraph.pattern!=="judgement"&&m.dodged>=2)return false;
  const judgement=s.telegraph.pattern==='judgement',units=[...lit].filter(c=>s.board[c]&&!s.board[c].cursed).sort((a,b)=>unitValue(s,s.board[b],b)-unitValue(s,s.board[a],a));
  for(const c of units){
    const u=s.board[c];s.board[c]=null;const free=bestCell(s,u,lit);s.board[c]=u;
    if(free.cell>=0){E.move(s,c,free.cell);m.dodged++;return true;}
    // No safe empty cell: swap with the weakest unit outside the light.
    const weak=CELLS.filter(i=>!lit.has(i)&&s.board[i]).sort((a,b)=>unitValue(s,s.board[a],a)-unitValue(s,s.board[b],b))[0];
    if(weak!==undefined&&unitValue(s,s.board[weak],weak)<unitValue(s,u,c)*.6){E.move(s,c,weak);m.dodged++;return true;}
  }
  return false;
}
function bestMerge(s,m,gv){
  let best=null;const cells=CELLS.filter(c=>s.board[c]);
  for(let x=0;x<cells.length;x++)for(let y=0;y<cells.length;y++){
    const a=cells[x],b=cells[y];if(a===b||!E.canMerge(s.board[a],s.board[b]))continue;
    const A=s.board[a],B=s.board[b],hero=B.hero==='rumi'?A.hero:B.hero,rank=B.rank+1;
    const d=delta(s,[a,b],()=>{s.board[b]={...tempUnit(s,hero,rank),priority:B.priority};s.board[a]=null;},()=>{s.board[a]=A;s.board[b]=B;});
    let v=d+12*Math.max(1,m.dps)*.06/Math.max(1e-9,m.scale);
    if(hero==='queen')v+=(E.queenIncome(rank,s.wave)-2*E.queenIncome(B.rank,s.wave))*Math.max(0,6-s.wave)*gv/Math.max(1e-9,m.scale)/Math.max(1,timeLeft(s));
    if(HERO[hero].trait.type==='sacrifice')v+=E.doomRefund(A.rank)*gv/Math.max(1e-9,m.scale)/Math.max(1,timeLeft(s));
    if(A.cursed||B.cursed)v+=Math.abs(d)+1;
    if(!best||v>best.v)best={from:a,to:b,v};
  }
  const free=CELLS.filter(c=>!s.board[c]).length;
  return best&&(best.v>0||free<=2)?best:null;
}
function spendGold(s,m){
  const reserve=s.deck.includes('doom')&&E.bestUnit(s,'doom')&&(s.enemies.some(e=>e.boss)||s.queue.some(q=>q.kind==='boss'))&&s.gauge>=HERO.doom.skill.cost-20?85:0;
  const budget=s.gold-reserve,free=CELLS.filter(c=>!s.board[c]).length,options=[];
  const sc=E.summonCost(s);if(free>0)options.push({kind:'summon',cost:sc,value:summonValue(s)*(free<=2?.6:1)});
  for(const id of s.deck){const c=E.upgradeCost(s,id),v=trainValue(s,id);if(v>0)options.push({kind:'train',id,cost:c,value:v});}
  if(!options.length)return false;
  options.sort((a,b)=>b.value/Math.max(1,b.cost)-a.value/Math.max(1,a.cost));
  const best=options[0];
  if(best.cost<=budget)return act(s,best);
  // Save for the best option when it is close; otherwise take the best affordable one that is nearly as good.
  if(budget>=best.cost*.6)return false;
  const alt=options.find(o=>o.cost<=budget&&o.value/Math.max(1,o.cost)>=best.value/Math.max(1,best.cost)*.75);
  return alt?act(s,alt):false;
}
function act(s,o){
  if(o.kind==='summon'){const r=E.summon(s);if(r.ok){placeNew(s,r.index);return true;}return false;}
  return E.upgrade(s,o.id).ok;
}
function placeNew(s,index){
  const u=s.board[index];if(!u)return;s.board[index]=null;const {cell}=bestCell(s,u,litCells(s));s.board[index]=u;
  if(cell>=0&&cell!==index&&placeDelta(s,u,cell)>0)E.move(s,index,cell);
}
function optimize(s,m){
  const lit=litCells(s),total=Math.max(1e-9,boardValue(s));let best=null;
  const units=CELLS.filter(c=>s.board[c]&&!s.board[c].cursed).sort((a,b)=>unitValue(s,s.board[b],b)-unitValue(s,s.board[a],a));
  const support=new Set(['siren','ancient_dragon','harmonious','time_magician','lightning_sage']);
  const pick=[...new Set([...units.slice(0,10),...units.filter(c=>support.has(s.board[c].hero))])];
  for(const a of pick)for(const b of CELLS){if(a===b||lit.has(b))continue;const d=swapDelta(s,a,b);if(!best||d>best.d)best={a,b,d};}
  if(best&&best.d>total*.03){E.move(s,best.a,best.b);return true;}
  return false;
}

export function smartAutoPlay(s){
  if(s.phase==='reward'){const id=chooseBlessing(s,mem(s));return E.chooseReward(s,id);}
  if(!['combat','intermission'].includes(s.phase))return;
  const m=mem(s),list=alive(s),bv=boardValue(s);
  if(s.phase==='combat'&&list.length&&s.time>m.lastTime+.2){const rate=(s.stats.damage-m.lastDamage)/(s.time-m.lastTime);m.dps=m.dps?m.dps*.85+rate*.15:rate;}
  m.lastDamage=s.stats.damage;m.lastTime=s.time;
  if(bv>0&&m.dps>0&&s.time>8)m.scale=m.scale?m.scale*.9+(m.dps/bv)*.1:m.dps/bv;
  if(!m.scale)m.scale=.6;
  m.dps=Math.max(m.dps||0,bv*m.scale*.7);
  if(dodge(s,m))return;
  // A cursed low-rank unit with no partner only blocks a cell.
  for(const c of CELLS){const u=s.board[c];if(u?.cursed&&u.rank<=2&&!CELLS.some(o=>o!==c&&E.canMerge(u,s.board[o]))&&s.board.filter(Boolean).length>1){E.sell(s,c);return;}}
  const gv=goldValue(s,m),merge=bestMerge(s,m,gv);if(merge){E.move(s,merge.from,merge.to);return;}
  const ult=pickUltimate(s,m);if(ult&&E.cast(s,ult).ok)return;
  if(spendGold(s,m))return;
  const sig=s.board.map(u=>u?u.uid+':'+u.rank:'').join(',');
  if(sig!==m.sig||s.time>=m.nextOpt){m.sig=sig;m.nextOpt=s.time+4;optimize(s,m);}
}
