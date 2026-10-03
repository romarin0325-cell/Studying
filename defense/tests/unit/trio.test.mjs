import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../../merge/engine.js';
import {HERO,DEFAULT_DECK} from '../../merge/content.js';
import {inspection,attackDescription,skillDescription,trainingPreview} from '../../merge/unit-info.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const tick=(s,t)=>{for(let n=0;n<Math.round(t*60);n++)E.step(s,1/60);};
function run(id,artifacts=[]){const s=E.newRun({deck:[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,6),artifacts,seed:736});const u=s.board.find(Boolean);s.board.fill(null);s.board[12]={...u,hero:id,cooldown:1000,windup:0};s.queue=[];s.events=[];return s;}
function enemy(s,kind='grunt',hp=100000,progress=180){s.queue=[{kind,hp}];s.spawnIn=0;E.step(s,1/60);s.queue=[];const e=s.enemies.at(-1);e.progress=progress;e.speed=0;e.skillIn=999;return e;}
function ally(s,index,id){return s.board[index]={...s.board[12],uid:s.nextId++,hero:id,cooldown:1000};}
function hit(s,e,proc=true,amount){const u=s.board[12],p=E.cellPoint(12);s.shots.push({uid:s.nextId++,source:u.uid,hero:u.hero,proc,rank:u.rank,count:1,damage:amount??E.combatStats(s,u).damage,target:e.uid,origin:p,from:p,to:E.pathPoint(e.progress),life:.001,total:.2});E.step(s,1/60);}
test('frost builds three primary stacks, shatters once per enemy, expires, and echoed attacks do not add stacks',()=>{
  const s=run('frost_witch'),a=enemy(s),b=enemy(s,'grunt',100000,183),base=E.combatStats(s,s.board[12]).damage;
  hit(s,a);hit(s,a);assert.equal(a.frostStacks,2);assert.equal(b.frostStacks,2);
  hit(s,a,false);assert.equal(a.frostStacks,2);hit(s,a);
  close(a.maxHp-a.hp,base*5.2);close(b.maxHp-b.hp,base*5.2);
  assert.equal(a.frostStacks,0);close(a.stun,.9);assert.equal(s.events.filter(e=>e.type==='frostBreak').length,2);
  hit(s,a);tick(s,6.1);assert.equal(a.frostStacks,0);assert.equal(a.frostTime,0);
});
test('ice court primes survivors, retains six-second slow on the next shot, and uses trained boss duration',()=>{
  const s=run('frost_witch'),a=enemy(s,'boss');s.upgrades.frost_witch=4;s.board[12].rank=3;s.gauge=100;
  const base=E.combatStats(s,s.board[12]).skillPower;E.cast(s,'frost_witch');
  close(a.maxHp-a.hp,base*5);assert.equal(a.frostStacks,2);hit(s,a);
  close(a.stun,.57);assert.ok(a.slowTime>5.9);close(a.slow,.5);
  assert.match(attackDescription(s,s.board[12]),/추가/);assert.ok(inspection(s,'frost_witch').stats.damage>HERO.frost_witch.damage);
});
test('harmony counts distinct adjacent kinds, never sums duplicate sources, and updates live after movement',()=>{
  const s=run('harmonious');ally(s,11,'zeke');ally(s,13,'zeke');ally(s,7,'rumi');ally(s,17,'snow_rabbit');
  assert.equal(E.harmonyAt(s,12),3);const u=s.board[11];close(E.combatStats(s,u).damage,E.power(s,u)*1.15);
  ally(s,10,'harmonious');assert.equal(E.harmonyAt(s,10),1);close(E.combatStats(s,u).damage,E.power(s,u)*1.15);
  s.board[7]=null;close(E.combatStats(s,u).damage,E.power(s,u)*1.1);
  s.board[17]=null;s.board[13].hero='harmonious';assert.equal(E.harmonyAt(s,12),1);
  assert.match(attackDescription(s,s.board[12]),/1종/);close(E.combatStats(s,{hero:'zeke',rank:1}).damage,HERO.zeke.damage);
});
test('harmony skill doubles trained aura, accelerates pending attacks, expires and extends with broken clock',()=>{
  const s=run('harmonious',['broken_clock']),a=ally(s,11,'zeke');enemy(s);s.upgrades.harmonious=2;s.gauge=100;const before=a.cooldown;E.cast(s,'harmonious');
  close(a.cooldown,before-1.5);assert.equal(s.buffs.harmony,10);close(E.combatStats(s,a).damage,E.power(s,a)*1.12);
  close(E.combatStats(s,a).cooldown,HERO.zeke.interval/1.088);assert.match(attackDescription(s,s.board[12]),/12%/);assert.match(skillDescription(s,'harmonious'),/10초/);
  tick(s,10.1);close(E.combatStats(s,a).damage,E.power(s,a)*1.06);assert.ok(trainingPreview(s,'harmonious').nextDamage>trainingPreview(s,'harmonious').damage);
});
test('Aurora reflection is delayed, follows original moving target and never recursively reflects',()=>{
  const s=run('aurora'),e=enemy(s),base=E.combatStats(s,s.board[12]).damage;hit(s,e);
  close(e.maxHp-e.hp,base);assert.equal(s.shots.length,1);assert.equal(s.shots[0].reflected,true);
  e.progress+=100;E.move(s,12,13);tick(s,.4);close(e.maxHp-e.hp,base);
  tick(s,.4);close(e.maxHp-e.hp,base*1.75);assert.equal(s.shots.length,0);tick(s,1);close(e.maxHp-e.hp,base*1.75);
});
test('reflections ignore dead targets and proc-false bonus shots never spawn another reflection',()=>{
  const s=run('aurora'),a=enemy(s),b=enemy(s,'grunt',100000,300);hit(s,a);a.hp=0;tick(s,.8);assert.equal(b.hp,b.maxHp);
  hit(s,b,false);assert.equal(s.shots.length,0);close(b.maxHp-b.hp,HERO.aurora.damage);
});
test('mirror records resolved armor and shield damage, does not lose stored damage on healing, and resolves once',()=>{
  const s=run('aurora'),e=enemy(s,'armor'),base=E.combatStats(s,s.board[12]).skillPower;e.shield=100;s.gauge=100;E.cast(s,'aurora');
  hit(s,e,false,100);close(e.shield,28);close(s.finishers[0].stored,72);e.hp=e.maxHp;
  const f=s.finishers[0];tick(s,3.1);assert.equal(s.finishers.length,0);close(f.stored,72);
  close(e.maxHp-e.hp,(base*10+72*.45)*.72-28);assert.equal(s.events.filter(e=>e.type==='finisherImpact').length,1);
});
test('mirror caps recorded return, locks maximum HP once, and fizzles without selecting another victim',()=>{
  const s=run('aurora'),a=enemy(s,'grunt',100000),b=enemy(s,'grunt',200000,300);b.hp=50000;s.gauge=100;E.cast(s,'aurora');assert.equal(s.finishers[0].target,b.uid);
  hit(s,b,false,10000);close(s.finishers[0].stored*.45,s.finishers[0].cap);
  b.hp=0;tick(s,3.1);assert.equal(a.hp,a.maxHp);assert.equal(s.events.filter(e=>e.type==='finisherFizzle').length,1);
});
test('mid-reflection and mirror saves resume identically; old enemies acquire empty frost fields',()=>{
  const s=run('aurora'),e=enemy(s);s.gauge=100;E.cast(s,'aurora');hit(s,e);tick(s,.1);
  const c=E.restore(E.serialize(s));assert.ok(c);tick(s,3.1);tick(c,3.1);assert.equal(E.serialize(s),E.serialize(c));
  const old=run('zeke'),a=enemy(old);delete a.frostStacks;delete a.frostTime;
  const restored=E.restore(E.serialize(old));assert.ok(restored);assert.equal(restored.enemies[0].frostStacks,0);assert.equal(restored.gold,old.gold);
});
test('save validation rejects malformed new state without losing valid old runs',()=>{
  const s=run('aurora'),e=enemy(s);s.gauge=100;E.cast(s,'aurora');hit(s,e);
  for(const [target,key,value] of [['shots','delay',-1],['shots','delay',.5],['shots','hero','zeke'],['shots','proc',true],['finishers','stored',-1],['finishers','cap',-1],['enemies','frostStacks',3],['enemies','frostTime',-1]]){
    const bad=JSON.parse(E.serialize(s));bad[target][0][key]=value;assert.equal(E.restore(bad),null,target+'.'+key);
  }
});
test('all three characters merge, train, serialize and show actual ranked damage',()=>{
  for(const id of ['frost_witch','harmonious','aurora']){const s=run(id);ally(s,13,id);assert.equal(E.move(s,12,13).merged,true);const u=s.board[13];assert.equal(u.rank,2);s.gold=1000;assert.equal(E.upgrade(s,id).ok,true);
    const info=inspection(s,id,u);close(info.stats.damage,E.combatStats(s,u).damage);assert.ok(info.stats.damage>HERO[id].damage);assert.ok(E.restore(E.serialize(s)));assert.equal(typeof attackDescription(s,u),'string');assert.equal(typeof skillDescription(s,id),'string');
  }
});
