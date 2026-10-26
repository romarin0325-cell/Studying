import {HEROES,HERO,DEFAULT_DECK} from '../content.js';
import {MIRACLE_FORMS} from '../new-companions.js';
import * as E from '../combat/engine.js';
export const shapes={single:'단일',splash:'범위',pulse:'주변 범위',beam:'관통',cross:'십자 관통',chain:'연쇄',bounce:'도탄',zone:'장판'};
export const roster=[...HEROES,...Object.entries(MIRACLE_FORMS).filter(([id])=>id!=='miracle_larva').map(([id,f])=>({...HERO.miracle_larva,...f,id,owner:'miracle_larva'}))];
export const effects=['감속','노출','기절','빙결','성광','중독','화상'];
export function tags(h){const text=h.trait.text+' '+h.skill.text;return effects.filter(t=>text.includes(t)||t==='중독'&&/독 \d|독이|독 피해/.test(text)||t==='화상'&&/불태|불타|불타는/.test(text)||t==='빙결'&&/얼리|얼어|얼립/.test(text)||t==='성광'&&h.trait.type==='battery');}
export function skillType(h){const t=h.skill.type;if(['echo','haste','awaken','march','harmony','gift','lemonade','miracle_eclose'].includes(t))return '보조';if(['execute','royal','starfall','mirror'].includes(t))return '단일';if(['avalanche','dragon','deathhand','armageddon','crush','singularity'].includes(t))return '범위';return '전체';}
export const conditionDefaults={coreNear:false,coreCrisis:false,auroraEven:false,normalDeck:false,lightningTeam:false,rabbitTeam:false,powerAura:false,speedAura:false,harmonyTeam:false,falseCinderella:false,supportTeam:false,appleApproach:false,prism:false,heroMax:false,age:1,joker:0,gold:200,gauge:120};
const nativeConditions={
 zeke:{coreNear:true,coreCrisis:true},aurora:{auroraEven:true},underdog:{normalDeck:true},lightning_sage:{lightningTeam:true},night_rabbit:{rabbitTeam:true},sunflower:{sun:3},star_boy:{age:0},time_ruler:{age:2},behemoth:{powerAura:true,speedAura:true},harmonious:{harmonyTeam:true},time_magician:{supportTeam:true},doom:{gold:240},cinderella:{falseCinderella:false},joker:{joker:5},toffee_apple:{appleApproach:true},
};
export const conditionNotes={
 zeke:'적이 경로 마지막 25%: 공격력 +40% / 코어 체력 50% 미만: 필살기 2배',aurora:'전장 아우로라 짝수: 공격력 +50% / 거울은 5초간 받은 피해를 기록',underdog:'노멀 등급만 편성: 공격력 +80%',lightning_sage:'연결 2~4기: 공격력·연쇄 배율·연쇄 수 증가',night_rabbit:'다른 토끼 1종당 공속 +20%, 필살기 표적 +2',star_boy:'등장 / 다음 / 이후 웨이브: 공격력 150% / 100% / 75%, 5타 강화는 항상 계산',time_ruler:'등장 / 다음 / 이후 웨이브: 공격력 75% / 100% / 125%',sunflower:'햇빛 0~3: 폭발 범위·필살기 배율 증가',behemoth:'인접 공격력·공속 오라를 2배 적용',harmonious:'인접 동료 종류마다 공격력·공속 오라 증가',time_magician:'3타마다 인접 동료가 추가 공격 / 필살기 변신은 순증에 포함',cinderella:'진짜 1기만 공격력 +50%·시계 발동 / 필살기는 항상 진짜가 사용',santa:'4타마다 선물 공격을 측정에 포함',joker:'선택 색상의 일반 공격 효과 / 카오스는 5종 부여·필살기 100별빛',doom:'소모 후 남는 골드 40당 필살기 +1배, 추가 최대 5배',rumi:'5성 이상 꿈의 형태: 4회 전체 공격 / 이하 메아리 지원',ash:'희생 대상 존재·무적 여부에 따라 팀 손실 변화',miracle_larva:'현재 형태 및 우화 전후 피해를 순증에 포함',
};
export function baselineOptions(o){return {...o,...conditionDefaults,low:false,slow:false,burn:false,divine:false,poison:false,exposure:false,stun:false,freeze:false,sun:0};}
export function sortRows(rows,key){return [...rows].sort((a,b)=>key==='name'?a.h.name.localeCompare(b.h.name,'ko'):key==='normal'?b.normal.dps-a.normal.dps:key==='normalSkill'?b.normal.skillDamage-a.normal.skillDamage:(b.r[key]??0)-(a.r[key]??0));}
export const defaults={...conditionDefaults,rank:1,training:0,targets:5,seconds:20,boss:false,low:false,slow:false,burn:false,divine:false,poison:false,exposure:false,stun:false,freeze:false,sun:0};
export function arena(h,opt={},draft={}){
 const o={...defaults,...opt,...(opt.heroMax?nativeConditions[h.id]||{}:{})},id=h.owner||h.id;
 const normalPool=HEROES.filter(x=>x.rarity==='C'&&!x.hidden).map(x=>x.id);
 const deck=[id,...(o.normalDeck?normalPool:[...new Set(['great_detective',...DEFAULT_DECK])]).filter(x=>x!==id)].slice(0,5),s=E.newRun({deck,chapter:2,seed:20261026,crit:null,artifacts:o.prism?['prism']:[]});
 const index=o.coreNear?10:o.harmonyTeam||o.supportTeam?7:2;
 const u={...s.board.find(Boolean),uid:1000,hero:id,rank:o.rank,form:h.owner?h.id:undefined,cooldown:0,windup:0,target:null,attacks:0,born:-10,birthWave:2-o.age,disabled:0,invincible:0};
 s.board.fill(null);s.board[index]=u;s.wave=2;s.health=o.coreCrisis?9:20;s.gold=o.gold;s.jokerColor=o.joker===5?'chaos':E.JOKER.colors[o.joker]||'red';s.jokerSeen=o.joker===5?E.JOKER.all:1|(1<<Math.max(0,E.JOKER.colors.indexOf(s.jokerColor)));s.upgrades[id]=o.training;s.sunlight=o.sun;
 const factor=draft.power||1;
 s.meta[id]={power:factor,special:1};
 const helpers=[];
 const addHelper=(hero,cell,extra={})=>{if(cell===undefined||s.board[cell])return;const ally={...u,hero,form:undefined,uid:(s.nextId++)+2000,cooldown:1e8,windup:0,target:null,attacks:0,...extra};s.board[cell]=ally;helpers.push(ally);s.upgrades[hero]??=0;s.meta[hero]??={power:1,special:1};};
 if(o.auroraEven&&id==='aurora')addHelper(id,24);
 if(o.lightningTeam&&id==='lightning_sage'){for(const cell of [1,6,11])addHelper(id,cell);}
 if(o.rabbitTeam&&id==='night_rabbit'){addHelper('snow_rabbit',24);addHelper('silver_rabbit',23);}
 if(o.falseCinderella&&id==='cinderella')addHelper(id,24,{uid:u.uid-1});
 if(o.harmonyTeam&&id==='harmonious')E.neighbors(index).forEach((cell,i)=>addHelper(['star_boy','queen','snow_rabbit','silver_rabbit'][i],cell));
 if(o.supportTeam&&id==='time_magician')E.neighbors(index).forEach((cell,i)=>addHelper(['star_boy','queen','snow_rabbit','silver_rabbit'][i],cell));
 const adjacent=E.neighbors(index);
 if(o.powerAura)addHelper('ancient_dragon',adjacent.find(cell=>!s.board[cell]));
 if(o.speedAura)addHelper('siren',adjacent.find(cell=>!s.board[cell]));
 s.queue=Array.from({length:o.targets},()=>({kind:(o.boss||h.id==='storm_sage')?'boss':'grunt',hp:1e12}));
 for(let i=0;i<o.targets;i++){s.spawnIn=0;E.step(s,.001);}
 s.queue=[{kind:'grunt',hp:1e12}];s.spawnIn=1e8;s.events=[];s.shots=[];s.stats.damage=0;s.stats.byHero={};
 s.enemies.forEach((e,i)=>{Object.assign(e,{progress:(o.coreNear?1970:250)+(i-(o.targets-1)/2)*24,speed:0,skillIn:1e8,hp:1e12,maxHp:o.low?4e12:1e12});
 const add=(type,amount,power=0)=>e.statusEffects.push({type,amount,power,until:1e6,source:'lab:'+type,owner:'lab'});
 if(o.burn)add('burn',.001);if(o.divine)add('divine',3);if(o.poison){add('poison',20,E.power(s,u));e.statusEffects.at(-1).until=s.time+12;}if(o.exposure)add('exposure',.35);if(o.stun)add('stun',1);if(o.freeze)add('freeze',1);if(o.slow)e.slowEffects.push({source:'lab',owner:'lab',amount:.35,until:1e6});
 E.statusState(s,e);});
 u.cooldown=0;u.windup=0;u.target=null;u.attacks=0;
 return {s,u,o,h,draft,index,helpers};
}
export function advance(a,dt){
 const count=a.u.attacks;
 // Explicit contact fixture: one target approaches the first random apple.
 if(a.o.appleApproach&&a.s.bombs.length){const target=a.s.enemies.find(e=>e.hp>0);if(target)target.progress=Math.max(0,a.s.bombs[0].progress-E.APPLEBOMB.trigger/2);}
 E.step(a.s,dt);if(a.draft.interval&&a.u.attacks!==count)a.u.cooldown=Math.max(.02,a.draft.interval-.13);
}
export function castArena(a){const {s,h}=a;s.gauge=h.skill.type==='starfall'?a.o.gauge:E.skillCost(s,h.owner||h.id);return E.cast(s,h.owner||h.id);}
export function measure(h,opt={},draft={}){
 const a=arena(h,opt,draft),stats=E.combatStats(a.s,a.u,a.index,true),preview=E.castPreview(a.s,h.owner||h.id);
 const run=(cast,isolated=false)=>{const b=arena(h,opt,draft);let immediate=0,ok={ok:true};if(cast){const before=b.s.stats.damage;ok=castArena(b);immediate=b.s.stats.damage-before;}for(let t=0;t<b.o.seconds;t+=.05){if(isolated)for(const unit of b.s.board)if(unit){unit.cooldown=1e8;unit.windup=0;}advance(b,.05);}const damage=Object.entries(b.s.stats.byHero).filter(([id])=>id!=='lab').reduce((n,[,d])=>n+d,0);return {damage,immediate,ok};};
 const normal=run(false),skill=run(true),isolated=run(true,true),cost=draft.cost||E.skillCost(a.s,h.owner||h.id),gain=skill.damage-normal.damage;
 return {base:h.damage,power:stats.damage,interval:draft.interval||stats.interval,dps:normal.damage/a.o.seconds,direct:stats.damage/stats.interval,skill:skill.immediate,skillDamage:isolated.damage,gain,conditions:a.o,conditionNote:conditionNotes[h.id]||'개인 적중·주기·형태 효과는 실제 엔진에 포함',value:gain/(h.skill.type==='starfall'?a.o.gauge:cost)*100,cost,preview,bonuses:stats.bonuses,ok:skill.ok.ok};
}
