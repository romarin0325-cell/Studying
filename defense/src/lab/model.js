import {HEROES,HERO,DEFAULT_DECK} from '../content.js';
import {MIRACLE_FORMS} from '../new-companions.js';
import * as E from '../combat/engine.js';
export const shapes={single:'단일',splash:'범위',pulse:'주변 범위',beam:'관통',cross:'십자 관통',chain:'연쇄',bounce:'도탄',zone:'장판'};
export const roster=[...HEROES,...Object.entries(MIRACLE_FORMS).filter(([id])=>id!=='miracle_larva').map(([id,f])=>({...HERO.miracle_larva,...f,id,owner:'miracle_larva'}))];
export const effects=['감속','노출','기절','빙결','성광','중독','화상'];
export function tags(h){const text=h.trait.text+' '+h.skill.text;return effects.filter(t=>text.includes(t)||t==='중독'&&/독 \d|독이|독 피해/.test(text)||t==='화상'&&/불태|불타|불타는/.test(text)||t==='빙결'&&/얼리|얼어|얼립/.test(text)||t==='성광'&&h.trait.type==='battery');}
export function skillType(h){const t=h.skill.type;if(['echo','haste','awaken','march','harmony','gift','lemonade','miracle_eclose'].includes(t))return '보조';if(['execute','royal','starfall','mirror'].includes(t))return '단일';if(['avalanche','dragon','deathhand','armageddon','crush','singularity'].includes(t))return '범위';return '전체';}
export const defaults={rank:1,training:0,targets:5,seconds:20,boss:false,low:false,slow:false,burn:false,divine:false,poison:false,exposure:false,stun:false,freeze:false,sun:0,patch:false};
export function arena(h,opt={},draft={}){
 const o={...defaults,...opt},id=h.owner||h.id,deck=[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,5),s=E.newRun({deck,chapter:2,seed:20261026,crit:null});
 const u={...s.board.find(Boolean),uid:1000,hero:id,rank:o.rank,form:h.owner?h.id:undefined,cooldown:0,windup:0,target:null,attacks:0,born:-10,birthWave:1,disabled:0,invincible:0};
 s.board.fill(null);s.board[2]=u;s.wave=2;s.health=20;s.gold=200;s.upgrades[id]=o.training;s.sunlight=o.sun;
 const factor=(draft.power||1)*(o.patch?(h.id==='underdog'?1.15:h.id==='miracle_larva'?.8:h.id==='miracle_cocoon'?.4:1):1);
 s.meta[id]={power:factor,special:1};
 s.queue=Array.from({length:o.targets},()=>({kind:(o.boss||h.id==='storm_sage')?'boss':'grunt',hp:1e12}));
 for(let i=0;i<o.targets;i++){s.spawnIn=0;E.step(s,.001);}
 s.queue=[{kind:'grunt',hp:1e12}];s.spawnIn=1e8;s.events=[];s.shots=[];s.stats.damage=0;s.stats.byHero={};
 s.enemies.forEach((e,i)=>{Object.assign(e,{progress:250+(i-(o.targets-1)/2)*24,speed:0,skillIn:1e8,hp:1e12,maxHp:o.low?4e12:1e12});
 const add=(type,amount,power=0)=>e.statusEffects.push({type,amount,power,until:1e6,source:'lab:'+type,owner:'lab'});
 if(o.burn)add('burn',.001);if(o.divine)add('divine',3);if(o.poison)add('poison',20,.001);if(o.exposure)add('exposure',.35);if(o.stun)add('stun',1);if(o.freeze)add('freeze',1);if(o.slow)e.slowEffects.push({source:'lab',owner:'lab',amount:.35,until:1e6});
 E.statusState(s,e);});
 u.cooldown=0;u.windup=0;u.target=null;u.attacks=0;
 return {s,u,o,h,draft};
}
export function advance(a,dt){const count=a.u.attacks;E.step(a.s,dt);if(a.draft.interval&&a.u.attacks!==count){a.u.cooldown=Math.max(.02,a.draft.interval-.13);}if(a.o.patch&&a.s.buffs.festive>6)a.s.buffs.festive=6;}
export function castArena(a){const {s,h}=a;s.gauge=h.skill.type==='starfall'?120:h.skill.cost;const result=E.cast(s,h.owner||h.id);if(a.o.patch&&h.id==='ash'){
 // Armageddon is instantaneous. Adjust only its strike receipts, without changing shared definitions.
 const events=s.events.filter(e=>e.type==='hit'&&e.hero==='ash');let extra=0;for(const e of events){const n=e.damage*2/18;extra+=n;const target=s.enemies.find(t=>t.uid===e.uid);if(target)target.hp-=n;}s.stats.byHero.ash=(s.stats.byHero.ash||0)+extra;s.stats.damage+=extra;
 }return result;}
export function measure(h,opt={},draft={}){
 const a=arena(h,opt,draft),stats=E.combatStats(a.s,a.u,2,true),preview=E.castPreview(a.s,h.owner||h.id);
 const run=cast=>{const b=arena(h,opt,draft);let immediate=0,ok={ok:true};if(cast){const before=b.s.stats.damage;ok=castArena(b);immediate=b.s.stats.damage-before;}for(let t=0;t<b.o.seconds;t+=.05)advance(b,.05);const damage=Object.entries(b.s.stats.byHero).filter(([id])=>id!=='lab').reduce((n,[,d])=>n+d,0);return {damage,immediate,ok};};
 const normal=run(false),skill=run(true),cost=draft.cost||((opt.patch&&h.id==='avalanche_maid')?h.skill.cost-5:h.skill.cost),gain=skill.damage-normal.damage;
 return {base:h.damage,power:stats.damage,interval:draft.interval||stats.interval,dps:normal.damage/a.o.seconds,direct:stats.damage/stats.interval,skill:skill.immediate,gain,value:gain/(h.skill.type==='starfall'?120:cost)*100,cost,preview,bonuses:stats.bonuses,ok:skill.ok.ok};
}
