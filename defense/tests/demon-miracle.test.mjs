import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {HERO,HEROES,ROSTER} from '../src/content.js';
import {bedCost,legacyCritCost,critChance,critStats,specialMultiplier} from '../src/economy.js';
import {createProfile,parseProfile} from '../src/profile.js';
import {autoPlay} from '../src/battle.js';
const deck=['demon_king','miracle_larva','rumi','snow_rabbit','great_detective'];
function setup(crit=null){
  const s=E.newRun({deck,seed:11,crit});const template=structuredClone(s.board.find(Boolean));s.board.fill(null);s.spawnIn=0;E.step(s,.01);s.queue=[];
  const enemy=s.enemies[0];Object.assign(enemy,{hp:1e8,maxHp:1e8,progress:900,speed:0,statusEffects:[],slowEffects:[]});
  const unit=(hero,index,rank=1,form)=>{const u={...structuredClone(template),uid:s.nextId++,hero,rank,cooldown:0,windup:0,attacks:0,cursed:false,...(hero==='miracle_larva'?{form:form||'miracle_larva'}:{})};delete u.form;if(hero==='miracle_larva')u.form=form||'miracle_larva';s.board[index]=u;return u;};
  s.gauge=120;s.events=[];return {s,enemy,unit};
}
function effect(s,e,type,amount=1,until=s.time+8){
  const a={type,amount,until,owner:'demon_king',source:`attack:demon_king:${s.nextId++}`,...(type==='poison'?{power:10}:{})};
  (type==='slow'?e.slowEffects:e.statusEffects).push(a);return a;
}
test('simple auto skips an unavailable evolution and casts the other ready skill',()=>{
  const {s,enemy,unit}=setup();s.deck=['miracle_larva','demon_king','rumi','snow_rabbit','great_detective'];
  unit('miracle_larva',12,1,'miracle_wing');unit('demon_king',14);s.gold=0;s.freeSummons=0;enemy.boss=true;
  const hp=enemy.hp;autoPlay(s);assert.equal(s.gauge,50);assert.ok(enemy.hp<hp);assert.equal(s.stats.skills,1);
});
test('only two new collectible identities, with requested rarities',()=>{
  assert.equal(HERO.demon_king.rarity,'R');assert.equal(HERO.miracle_larva.rarity,'SR');
  for(const id of ['miracle_cocoon','miracle_wing','abyss_wing'])assert.equal(HERO[id],undefined);
  assert.ok(ROSTER.R.includes('demon_king')&&ROSTER.SR.includes('miracle_larva'));assert.equal(new Set(HEROES.map(h=>h.id)).size,HEROES.length);
});
test('Deathhand counts distinct live types, including separate stun/freeze, without a five-type cap',()=>{
  const {s,enemy}=setup();for(const type of ['slow','exposure','stun','freeze','divine','poison','burn'])effect(s,enemy,type);
  effect(s,enemy,'poison',15);effect(s,enemy,'slow',.5);effect(s,enemy,'unrelated');effect(s,enemy,'burn',1,s.time);
  assert.equal(E.demonDebuffTypes(s,enemy).length,7);assert.equal(E.deathhandFactor(s,enemy),26);
  enemy.statusEffects=[];enemy.slowEffects=[];assert.equal(E.deathhandFactor(s,enemy),5);
  effect(s,enemy,'slow',.25);effect(s,enemy,'freeze');assert.equal(E.deathhandFactor(s,enemy),11);
});
test('Deathhand applies each target factor independently and preserves its debuffs',()=>{
  const {s,enemy,unit}=setup();unit('demon_king',12);effect(s,enemy,'slow',.25);effect(s,enemy,'freeze');
  const second=structuredClone(enemy);second.uid=s.nextId++;second.progress+=30;second.statusEffects=[];second.slowEffects=[];s.enemies.push(second);
  const before=JSON.stringify([enemy.statusEffects,enemy.slowEffects]);const preview=E.castPreview(s,'demon_king'),rng=s.rng;
  assert.match(preview.lines.join(' '),/5~11배/);assert.equal(s.rng,rng);assert.equal(E.cast(s,'demon_king').ok,true);
  assert.equal(1e8-enemy.hp,38*11);assert.equal(1e8-second.hp,38*5);assert.equal(s.gauge,50);assert.equal(JSON.stringify([enemy.statusEffects,enemy.slowEffects]),before);
});
test('Deathhand selects densest radius with deterministic forward tie break',()=>{
  const {s,enemy}=setup();enemy.progress=100;
  for(const progress of [120,140,1500])s.enemies.push({...structuredClone(enemy),uid:s.nextId++,progress});
  const cluster=E.deathhandTargets(s);assert.equal(cluster.targets.length,3);assert.equal(cluster.centre.progress,140);
});
test('all eligible bodies evolve independently, keeping uid, rank, cooldown and training',()=>{
  const {s,unit}=setup();const bodies=Array.from({length:10},(_,i)=>unit('miracle_larva',i,1+i%3,i%2?'miracle_cocoon':'miracle_larva'));
  unit('miracle_larva',15,6,'abyss_wing');s.upgrades.miracle_larva=4;
  const before=bodies.map(u=>[u.uid,u.rank,u.cooldown,u.priority]);
  assert.match(E.castPreview(s,'miracle_larva').lines[0],/10기/);assert.equal(E.cast(s,'miracle_larva').ok,true);
  assert.deepEqual(bodies.map(u=>[u.uid,u.rank,u.cooldown,u.priority]),before);assert.equal(s.upgrades.miracle_larva,4);
  assert.ok(bodies.every(u=>['miracle_wing','abyss_wing'].includes(u.form)));assert.equal(new Set(bodies.map(u=>u.form)).size,2);assert.equal(s.board[15].form,'abyss_wing');assert.equal(s.gauge,70);
});
test('a useless evolution is refused before spending or refunding',()=>{
  const {s,unit}=setup();unit('miracle_larva',12,3,'miracle_wing');s.artifacts=['lantern','twin'];
  const snapshot=[s.gauge,s.rng,s.stats.skills,s.finishers.length];assert.equal(E.castLock(s,'miracle_larva').kind,'evolution');assert.equal(E.cast(s,'miracle_larva').ok,false);assert.deepEqual([s.gauge,s.rng,s.stats.skills,s.finishers.length],snapshot);
});
test('every pair of miracle forms, and Rumi in either drag direction, merges to a cocoon',()=>{
  for(const a of Object.keys(E.MIRACLE_FORMS))for(const b of Object.keys(E.MIRACLE_FORMS)){
    const {s,unit}=setup();unit('miracle_larva',6,2,a);unit('miracle_larva',7,2,b);assert.equal(E.move(s,6,7).merged,true);assert.equal(s.board[7].form,'miracle_cocoon');assert.equal(s.board[7].rank,3);
  }
  for(const reverse of [false,true]){const {s,unit}=setup();unit('miracle_larva',6,2,'miracle_wing');unit('rumi',7,2);E.move(s,reverse?7:6,reverse?6:7);assert.equal(s.board[reverse?6:7].hero,'miracle_larva');assert.equal(s.board[reverse?6:7].form,'miracle_cocoon');}
});
test('form changes power, cadence and geometry, without trauma bonuses',()=>{
  const {s,unit}=setup();const u=unit('miracle_larva',12);
  for(const [form,h] of Object.entries(E.MIRACLE_FORMS)){u.form=form;const stats=E.combatStats(s,u);assert.equal(stats.damage,h.damage);assert.equal(stats.cooldown,h.interval);assert.equal(stats.range,h.range);assert.equal(E.unitHero(s,u).shape,h.shape);}
});
test('Abyss attacks add slow and poison with canonical ownership; in-flight form is retained',()=>{
  const {s,enemy,unit}=setup();const u=unit('miracle_larva',14,1,'abyss_wing');for(let i=0;i<4;i++)E.step(s,.05);assert.ok(s.shots.length);assert.equal(s.shots[0].form,'abyss_wing');
  u.form='miracle_cocoon';for(let i=0;i<20;i++)E.step(s,.05);
  assert.ok(enemy.slowTime>0&&enemy.slow>=.25);assert.ok(enemy.poison>0);assert.ok(enemy.statusEffects.some(e=>e.type==='poison'&&e.owner==='miracle_larva'));
});
test('enhanced Abyss hit slow matches its live description, applies special once and caps at80%',()=>{
  for(const [rank,enhance,expected] of [[1,0,.25],[1,10,.3],[3,10,.36],[5,50,.7],[7,150,.8]]){
    const {s,enemy,unit}=setup(),u=unit('miracle_larva',14,rank,'abyss_wing');s.meta.miracle_larva={special:specialMultiplier(enhance)};
    for(let i=0;i<28;i++)E.step(s,.05);
    assert.ok(enemy.slowTime>0);assert.ok(Math.abs(enemy.slow-expected)<1e-9,`rank${rank}, enhance${enhance}: ${enemy.slow}`);
    assert.equal(E.liveTraitTokens(s,u)[0][1],`${expected*100}%`);assert.match(E.personalTrait(s,u).label,new RegExp(`${expected*100}%`));
  }
});
test('wing aura is orthogonal, strongest-only, curse-aware and doubled for Behemoth',()=>{
  const {s,unit}=setup({chance:.05,damage:1.5});const d=unit('demon_king',12),w=unit('miracle_larva',11,1,'miracle_wing');unit('miracle_larva',13,1,'miracle_wing');
  assert.deepEqual(E.unitCrit(s,d),{chance:.25,damage:2});const far=unit('demon_king',0);assert.deepEqual(E.unitCrit(s,far),{chance:.05,damage:2});
  w.cursed=true;s.board[13]=null;assert.equal(E.unitCrit(s,d).chance,.05);w.cursed=false;
  d.hero='behemoth';assert.equal(E.unitCrit(s,d).chance,.45);d.hero='demon_king';d.cursed=true;assert.equal(E.unitCrit(s,d).damage,1.5);
});
test('critical settings snapshot belongs to each attacking copy',()=>{
  const {s,unit}=setup({chance:.05,damage:1.5});unit('miracle_larva',13,1,'miracle_wing');unit('demon_king',14);unit('demon_king',7);
  for(let i=0;i<4;i++)E.step(s,.05);const shots=s.shots.filter(x=>x.hero==='demon_king');assert.equal(shots.length,2);assert.deepEqual(shots.map(x=>x.crit.chance).sort((a,b)=>a-b),[.05,.25]);assert.ok(shots.every(x=>x.crit.damage===2));
});
test('forms and pending shots round-trip; malformed forms/crit snapshots are rejected',()=>{
  const {s,unit}=setup({chance:.05,damage:1.5});unit('miracle_larva',14,2,'abyss_wing');for(let i=0;i<4;i++)E.step(s,.05);const restored=E.restore(E.serialize(s));assert.ok(restored);assert.equal(restored.board[14].form,'abyss_wing');assert.equal(restored.shots[0].form,'abyss_wing');
  const bad=JSON.parse(E.serialize(s));bad.board[14].form='trauma';assert.equal(E.restore(bad),null);
  const badCrit=JSON.parse(E.serialize(s));badCrit.shots[0].crit={chance:2,damage:1.5};assert.equal(E.restore(badCrit),null);
});
test('new runs have base5% crits and a separate random stream; explicit legacy null stays null',()=>{
  const a=E.newRun({deck,seed:55}),b=E.newRun({deck,seed:55,crit:null});assert.deepEqual(a.crit,{chance:.05,damage:1.5});assert.equal(b.crit,null);assert.equal(a.rng,b.rng);assert.deepEqual(a.board.map(u=>u?.hero),b.board.map(u=>u?.hero));
  assert.deepEqual(critStats({crit:30,critDamage:20},44),{chance:.05,damage:1.5});assert.ok(Math.abs(critChance(30)-.2)<1e-12);
});
test('crit budget to20% matches the old budget, then joins the half-price tail without resetting investments',()=>{
  const old=Array.from({length:38},(_,i)=>legacyCritCost(i)).reduce((a,b)=>a+b),now=Array.from({length:30},(_,i)=>bedCost('crit',i)).reduce((a,b)=>a+b);
  assert.ok(now>=old&&now-old<=30);for(let n=1;n<250;n++)assert.ok(bedCost('crit',n)>=bedCost('crit',n-1),'no price reversal at '+n);
  for(const n of [41,42,60,100])assert.equal(bedCost('crit',n),Math.ceil(legacyCritCost(38+n-30)/2));
  const p=createProfile();p.cleared=45;p.beds.crit=38;const next=parseProfile(JSON.stringify(p));assert.equal(next.beds.crit,38);assert.equal(next.bedRev,p.bedRev);assert.ok(Math.abs(critStats(next.beds,45).chance-.24)<1e-12);
});
