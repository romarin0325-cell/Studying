import {HERO,COMPANION,VERSION} from '../data/catalog.js';
import {baseStats} from '../systems/growth.js';
import {hash,generator,clamp} from '../core/rng.js';
import {battleSeed} from './encounter.js';
import {damagePacket,elemental} from './damage.js';
import {SUPPORTS,PASSIVES,RELICS,TEMP_RELICS,SKILLS,BOSS_PATTERNS,STATUS_IDS} from './effects.js';
export function simulateBattle(loadout,encounter,seed=battleSeed(loadout,encounter),options={}){
 const l=structuredClone(loadout),def=HERO[l.heroId];if(!def)throw Error('Unknown hero');
 const supports=l.companions.filter(Boolean);for(const id of supports)if(!SUPPORTS[id]||!PASSIVES[id])throw Error('Unregistered support '+id);
 if(l.artifact&&!RELICS[l.artifact])throw Error('Unregistered artifact '+l.artifact);
 const temps=l.temporaryItems||[];for(const id of temps)if(!TEMP_RELICS[id])throw Error('Unregistered adventure artifact '+id);
 const b=baseStats(l),passive={hp:0,atk:0,matk:0,crit:0,dodge:0,mp:0,cdr:0,healing:0,dotReduction:0,direct:0,speed:0};
 const add=x=>{for(const [k,v]of Object.entries(x||{}))if(typeof v==='number')passive[k]=(passive[k]||0)+v;};
 supports.forEach(id=>add(PASSIVES[id]));if(l.artifact)add(RELICS[l.artifact]);temps.forEach(id=>add(TEMP_RELICS[id]));
 const choiceScale=g=>g>=30?1.5:g>=15?1.25:1;
 if(l.gear.armor>=5)add(l.gearChoices.armor===0?{hp:.1*choiceScale(l.gear.armor)}:{defense:.15*choiceScale(l.gear.armor)});
 if(l.gear.accessory>=5)add(l.gearChoices.accessory===0?{mp:.5*choiceScale(l.gear.accessory)}:{critDamage:.1*choiceScale(l.gear.accessory)});
 if(supports.includes('harmonious')&&supports.length===2&&COMPANION[supports[0]].tacticalTag!==COMPANION[supports[1]].tacticalTag)add({atk:.07,matk:.07});
 if(l.heroId==='lumi'&&l.nodes>=2&&l.style===0)passive.mp++;
 if(l.heroId==='luna')passive.dodge+=.1+(l.nodes>=2?(l.style===0?.05:-.05):0);
 const h={...b,maxHP:b.hp*(1+passive.hp),hp:0,mp:50+(l.eventBonus?.mp||0),shield:0,shieldEnd:0,statuses:[],buffs:{},cd:[0,0,0],normalAt:0,lock:0,resource:0,survived:false,immuneEnd:0,moonReady:false};h.hp=h.maxHP*(l.startHPRatio??1);h.mp=Math.min(100,h.mp);
 const e={...encounter,maxHP:encounter.hp,hp:encounter.hp,shield:0,shieldEnd:0,statuses:[],normalAt:60,defense:0,defenseEnd:0,physicalReduction:0,magicReduction:0,attackBonus:0,telegraph:null,interruptDamage:0,thorPending:false};
 const rng=generator(seed),events=[],frames=[],damageBySource={},skillCounts={},supportAt=l.companions.map((id,i)=>id?i===0?60:140:Infinity),scheduled=[];
 let sequence=0,t=0,digest=2166136261,holdStart=null,royalAt=-999,holyAt=-999,mirrorAt=-999,normalCount=0,totalDamage=0;
 const has=(unit,id)=>unit.statuses.some(x=>x.id===id&&x.end>=t),stacks=(unit,id)=>unit.statuses.filter(x=>x.id===id&&x.end>=t).length;
 const buffSum=k=>Object.values(h.buffs).reduce((sum,x)=>sum+(x[k]||0),0);
 const stats=()=>{const crown=l.heroId==='queen'?h.resource*(l.nodes>=2?(l.style===0?.07:.03):.05):0,origin=l.artifact==='origin_star'&&t<160?.15:0;return {atk:b.atk*(1+passive.atk+crown+origin+buffSum('atk')+(l.eventBonus?.atk||0))*(has(h,'weaken')?.85:1),matk:b.matk*(1+passive.matk+crown+origin+buffSum('matk')+(l.eventBonus?.matk||0)),def:b.def*(1+(passive.defense||0))*(has(h,'corrosion')?.8:1),mdef:b.mdef*(1+(passive.defense||0))*(has(h,'corrosion')?.8:1)};};
 function emit(type,target,value,label,extra={}){const ev={tick:t,seq:sequence++,type,target,value:Math.round(value),label,...extra};digest=hash([digest,ev]);if(options.trace!==false)events.push(ev);}
 function buff(id,seconds,values){h.buffs[id]={...values,end:t+Math.round(seconds*20)};emit('buff','hero',seconds,id);}
 function status(unit,id,seconds,count=1){if(!STATUS_IDS.includes(id))throw Error('Unregistered status '+id);const end=t+Math.round(seconds*20),existing=unit.statuses.filter(x=>x.id===id),dot=id==='burn'||id==='poison';const limit=dot?(id==='poison'&&temps.includes('toxic_seed')?5:3):id==='divine'?3:1;
  if(!dot){for(const x of existing)x.end=Math.max(x.end,end);if(existing.length>=limit)return;}
  for(let n=0;n<count;n++){const current=unit.statuses.filter(x=>x.id===id);if(current.length>=limit){if(dot){const oldest=current.reduce((a,b)=>a.end<b.end?a:b);unit.statuses.splice(unit.statuses.indexOf(oldest),1);}else break;}
   const s=stats(),amount=id==='burn'?s.matk*.12:id==='poison'?(s.atk+s.matk)*.06:id==='curse'?h.maxHP*.02:0;
   unit.statuses.push({id,end,next:t+20,amount:amount*(unit===e?elemental(def.element,e.element):1),seq:sequence++});}
  emit('status',unit===h?'hero':'enemy',count,id);
 }
 function heal(frac){const amount=Math.min(h.maxHP-h.hp,h.maxHP*frac*(1+passive.healing));h.hp+=amount;if(amount>0){emit('heal','hero',amount,'회복');if(supports.includes('cherry_prince'))buff('cherry',5,{atk:.08,matk:.08});}}
 function shield(frac,seconds,source){const value=h.maxHP*frac;h.shield=Math.max(h.shield,value);h.shieldEnd=t+seconds*20;emit('shield','hero',h.shield,source);if(l.artifact==='rose_oath')buff('oath',6,{atk:.12,matk:.12});}
 function cleanse(){if(!h.statuses.length)return;h.statuses.sort((a,b)=>a.seq-b.seq);const id=h.statuses[0].id;h.statuses=h.statuses.filter(x=>x.id!==id);emit('cleanse','hero',0,id);if(l.artifact==='curse_mirror'&&t>=mirrorAt){mirrorAt=t+120;heal(.08);}}
 function resource(n){h.resource=Math.min(l.nodes>=6?4:3,h.resource+n);}
 function survival(){if(h.hp<=0&&l.heroId==='zeke'&&!h.survived){h.survived=true;h.hp=1;h.immuneEnd=t+40;buff('resolve',8,{atk:.3});if(l.nodes>=20)h.mp=Math.min(100,h.mp+30);emit('survive','hero',1,'불굴');}}
 function applyDamage(unit,amount,source,dot=false){if(unit===h&&t<h.immuneEnd)return 0;const old=unit.shield,absorbed=Math.min(old,amount);unit.shield-=absorbed;unit.hp=Math.max(0,unit.hp-(amount-absorbed));if(unit===e){totalDamage+=amount;damageBySource[source]=(damageBySource[source]||0)+amount;if(e.thorPending){e.interruptDamage+=amount;if(e.interruptDamage>=e.maxHP*.05){e.thorPending=false;e.telegraph=null;status(e,'exposed',4);emit('interrupt','enemy',0,'심판 저지');}}if(old>0&&unit.shield===0&&e.bossId==='love_iris')status(e,'exposed',4);}else survival();return amount;}
 function hit(p,m,source,opts={}){if(h.hp<=0||e.hp<=0)return;const s=stats(),normal=source==='normal',support=!!SUPPORTS[source],skill=!normal&&!support&&source!=='holy_echo';let direct=passive.direct+(l.eventBonus?.direct||0),critChance=.1+.002*l.gear.accessory+passive.crit;
  if(l.heroId==='luna'){if(h.hp/h.maxHP>=.7)critChance+=.1;if(has(e,'blind'))direct+=.15;}
  if(supports.includes('gold_dragon')&&h.hp/h.maxHP>=.8)direct+=.12;
  if(supports.includes('great_detective')&&has(e,'exposed'))direct+=.12;
  if(supports.includes('night_rabbit')&&has(e,'blind'))direct+=.12;
  if(supports.includes('behemoth')&&new Set(e.statuses.filter(x=>['burn','poison','divine','blind','slow','corrosion','weaken','analysis'].includes(x.id)).map(x=>x.id)).size>=3)direct+=.15;
  if(supports.includes('time_ruler')&&t>=300)direct+=.12;
  if(supports.includes('cinderella')&&h.shield>0)direct+=.10;
  if(supports.includes('avalanche_maid')&&has(e,'slow'))direct+=.12;
  if(supports.includes('ancient_soul')&&(has(e,'burn')||has(e,'divine')))direct+=.10;
  if(supports.includes('storm_sage')&&(has(e,'corrosion')||has(e,'weaken')))direct+=.10;
  if(supports.includes('flame_sage')&&has(e,'burn'))direct+=.12;
  if(supports.includes('priest_of_end')&&e.hp/e.maxHP<=.35)direct+=.15;
  if(normal){if(supports.includes('silver_rabbit'))direct+=.12;if(l.heroId==='zeke'&&l.nodes>=6&&h.shield>0)direct+=.12;if(h.moonReady){direct+=.5;h.moonReady=false;}direct+=l.eventBonus?.normal||0;}
  if(l.gear.weapon>=5&&((normal&&l.gearChoices.weapon===0)||(skill&&l.gearChoices.weapon===1)))direct+=(normal?.10:.08)*choiceScale(l.gear.weapon);
  if(l.artifact==='thunder_seal'&&e.telegraph)direct+=.2;if(l.artifact==='war_crest'&&t>=400)direct+=.18;if(l.artifact==='tide_gem'&&has(e,'exposed'))direct+=.2;if(temps.includes('exposed_heart')&&has(e,'exposed'))direct+=.25;
  let mult=opts.mult||1;if(l.heroId==='jasmine'&&stacks(e,'divine')>=3)mult*=l.nodes>=12?1.3:1.25;if(l.artifact==='bipolar_core'&&p>0&&m>0)mult*=1.12;if(support){mult*=1+.03*(l.companionRanks[source]||0);const slot=l.companions.indexOf(source);mult*=1+(l.eventBonus?.['support'+slot]||0);}
  const miss=normal&&has(h,'blind')&&rng()<.2,crit=rng()<clamp(critChance,0,.7),reduction=Math.max(0,e.defense-(l.artifact==='seal_fragment'?.25:0));
  const amount=damagePacket({p,m,...s,def:e.def*(has(e,'corrosion')?.8:1),mdef:e.mdef*(has(e,'corrosion')?.8:1),element:elemental(def.element,e.element),crit:crit?1.5+(passive.critDamage||0):1,increase:direct,exposed:has(e,'exposed')?1.25:1,reduction:1-reduction,taken:(has(e,'analysis')?1.1:1)*mult,physicalReduction:e.physicalReduction,magicReduction:e.magicReduction,miss});
  applyDamage(e,amount,source);emit(miss?'miss':'hit','enemy',amount,source,{crit,element:elemental(def.element,e.element),p,m});
 }
 function enemyHit(p,m,label,normal=false){if(h.hp<=0||e.hp<=0)return;const s=stats(),dodge=rng()<clamp(passive.dodge+buffSum('dodge'),0,.5)||(normal&&has(e,'blind')&&rng()<.2);if(dodge&&temps.includes('moon_step'))h.moonReady=true;const attack=e.atk*(1+e.attackBonus)*(has(e,'weaken')?.85:1);const amount=damagePacket({p,m,atk:attack,matk:attack,def:s.def,mdef:s.mdef,miss:dodge});applyDamage(h,amount,label);emit(dodge?'miss':'hit','hero',amount,label,{p,m});}
 const c={l,h,e,get t(){return t;},rng,hit,enemyHit,has,stacks,heal,shield,buff,status,resource,cleanse,emit,every:seconds=>t>0&&t%(seconds*20)===0,delay:(ticks,fn)=>scheduled.push({at:t+ticks,seq:sequence++,fn}),telegraph:(label,ticks)=>{e.telegraph={label,at:t+ticks};emit('warning','enemy',ticks/20,label);}};
 if(l.eventBonus?.shield)shield(l.eventBonus.shield,60,'사건의 보호');
 function eligible(i){const id=def.skills[i].id,ratio=h.hp/h.maxHP,soon=e.telegraph&&e.telegraph.at-t<=60,max=l.nodes>=6?4:3;switch(id){case 'guard':return ratio<=.7||soon;case 'barrier':return ratio<=.7||soon||h.statuses.length>0;case 'evasive_stance':return !h.buffs.evasion&&(ratio<=.8||soon);case 'moonlight_serena':return !h.buffs.serena;case 'royal_bloom':return h.resource<max||ratio<=.8;case 'dream_form':case 'finale':return h.resource>=max||encounter.maxTicks-t<=200;default:return true;}}
 const order=l.tactics.order?.length?l.tactics.order.map(id=>def.skills.findIndex(x=>x.id===id)).filter(x=>x>=0):l.tactics.preset==='survival'||!['lumi','queen'].includes(l.heroId)?[0,2,1]:[2,1,0];
 for(t=0;t<=encounter.maxTicks;t++){
  for(const unit of [h,e]){unit.statuses=unit.statuses.filter(x=>x.amount>0?x.end>=t:x.end>t);if(t>=unit.shieldEnd)unit.shield=0;}
  for(const [id,v]of Object.entries(h.buffs))if(v.end<=t)delete h.buffs[id];if(t>=e.defenseEnd)e.defense=0;
  // Stance changes take effect before this tick's attacks, including tick zero.
  if(e.bossId==='artificial_demon'){e.physicalReduction=Math.floor(t/160)%2===0?.4:0;e.magicReduction=Math.floor(t/160)%2===1?.4:0;}
  if(e.bossId==='astea'){e.physicalReduction=t>=300&&t<380?.3:0;e.magicReduction=t>=600&&t<680?.3:0;}
  if(e.bossId==='poseidon'&&t%200<100){e.defense=.4;e.defenseEnd=t+1;}
  if(t>0)h.mp=Math.min(100,h.mp+(4+passive.mp+.01*l.gear.accessory+buffSum('mp')+(l.eventBonus?.regen||0))/20);
  if(l.artifact==='verdant_seed'&&c.every(12))heal(.06);
  scheduled.sort((a,b)=>a.at-b.at||a.seq-b.seq);while(scheduled[0]?.at<=t){const ev=scheduled.shift();ev.fn();}
  for(const unit of [h,e])for(const x of unit.statuses)if(x.amount>0&&x.next<=t&&t<=x.end){const amount=Math.max(1,Math.floor(x.amount*(unit===h?Math.max(0,1-passive.dotReduction):1)));applyDamage(unit,amount,x.id,true);emit('dot',unit===h?'hero':'enemy',amount,x.id);x.next+=20;}
  for(const unit of [h,e])unit.statuses=unit.statuses.filter(x=>x.end>t);
  if(h.hp<=0||e.hp<=0)break;
  for(let i=0;i<2;i++)if(t>=supportAt[i]){const id=l.companions[i];skillCounts[id]=(skillCounts[id]||0)+1;emit('support','hero',0,id);SUPPORTS[id](c);if(l.heroId==='lumi'||l.heroId==='queen')resource(1);supportAt[i]=t+Math.round(COMPANION[id].cooldown*20*(temps.includes('little_companion')?.8:1));}
  if(e.hp<=0||h.hp<=0)break;
  if(t>=h.lock){for(const i of order){const skill=def.skills[i],cost=skill.mp+(skill.id==='dream_form'&&l.nodes>=2&&l.style===1?10:0)-(skill.id==='goddess_descent'&&l.nodes>=20?10:0);if(t<h.cd[i]||h.mp<cost||!eligible(i))continue;
    if(l.tactics.hold&&(skill.p||skill.m)&&e.defense>0&&encounter.maxTicks-t>100){if(holdStart===null)holdStart=t;if(t-holdStart<80)continue;}
    holdStart=null;h.mp-=cost;h.cd[i]=t+Math.round(skill.cd*20*(1-Math.min(.3,passive.cdr)));h.lock=t+10;skillCounts[skill.id]=(skillCounts[skill.id]||0)+1;emit(i===2?'ultimate':'skill','hero',0,skill.id);if(!SKILLS[skill.id])throw Error('Unregistered skill '+skill.id);SKILLS[skill.id](c);if(i===2&&temps.includes('royal_seal')&&t>=royalAt){h.mp=Math.min(100,h.mp+15);royalAt=t+200;}break;
   }}
  if(e.hp<=0||h.hp<=0)break;
  if(t>=h.normalAt&&t>=h.lock){hit(def.normal.p,def.normal.m,'normal');normalCount++;skillCounts.normal=normalCount;h.normalAt=t+Math.max(1,Math.round(def.normal.interval*20*(1-passive.speed-buffSum('speed'))*(has(h,'slow')?1.2:1)));if(temps.includes('burning_page')&&normalCount%3===0)status(e,'burn',8);if(temps.includes('holy_echo')&&stacks(e,'divine')>=3&&t>=holyAt){holyAt=t+20;hit(0,.3,'holy_echo');}}
  if(e.hp<=0||h.hp<=0)break;
  if(e.kind==='boss'){if(!BOSS_PATTERNS[e.bossId])throw Error('Unregistered boss');BOSS_PATTERNS[e.bossId](c);}else if(e.gate){if(t%200===160)c.telegraph('관문 강타',40);if(c.every(10)){enemyHit(2,0,'관문 강타');e.telegraph=null;}if(e.variant===0&&c.every(12)){e.defense=.3;e.defenseEnd=t+60;}if(e.variant===1&&c.every(15)){e.shield=Math.max(e.shield,e.maxHP*.08);e.shieldEnd=t+100;}if(e.variant===2&&c.every(14))status(h,'weaken',4);}
  if(t>=e.normalAt){enemyHit(1,0,'적 기본 공격',true);e.normalAt=t+Math.round(60*(has(e,'slow')?1.2:1));}
  if(options.trace!==false)frames.push({tick:t,hp:h.hp,mp:h.mp,shield:h.shield,enemyHP:e.hp,enemyShield:e.shield,resource:h.resource,warning:e.telegraph?.label||'',defense:e.defense,exposed:has(e,'exposed'),statuses:[...new Set(e.statuses.map(x=>x.id))]});
  if(h.hp<=0||e.hp<=0)break;
 }
 const elapsedTicks=Math.min(t,encounter.maxTicks),winner=h.hp>0&&e.hp<=0?'hero':'enemy';
 frames.push({tick:elapsedTicks,hp:h.hp,mp:h.mp,shield:h.shield,enemyHP:e.hp,enemyShield:e.shield,resource:h.resource,warning:'',statuses:[]});
 return {encounterId:encounter.id,difficulty:encounter.difficulty,contentVersion:VERSION,loadoutHash:hash(loadout),seed,winner,elapsedTicks,heroHP:h.hp,heroMaxHP:h.maxHP,enemyHP:e.hp,enemyMaxHP:e.maxHP,score:Math.min(1,totalDamage/e.maxHP),damageBySource,skillCounts,replayDigest:digest.toString(16),survived:h.survived,frames,events,loadout,encounter};
}
