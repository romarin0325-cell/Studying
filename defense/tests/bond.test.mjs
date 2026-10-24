import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,TUNING} from '../src/content.js';
import {createProfile,parseProfile,validateProfile,command,weeklyStage} from '../src/profile.js';
import {BOND_MAX,BOND_STEPS,FAVORITE,FAVORITE_LINES,GIFT_LINES,GIFT_IDS,addBond} from '../src/bond.js';
import {HOUR,calendar} from '../src/economy.js';
const NOW=Date.parse('2026-10-04T03:00:00Z'),DAY=24*HOUR;
const act=(p,action,args={},now=NOW)=>{const r=command(p,action,args,now);assert.ok(validateProfile(p),action+' keeps the profile valid');return r;};

test('every companion has one favourite gift with its line, its own line for the other gifts; ten of each gift',()=>{
  assert.equal(Object.keys(FAVORITE).length,HEROES.length);
  for(const h of HEROES){assert.ok(GIFT_IDS.includes(FAVORITE[h.id]),h.id);assert.ok(FAVORITE_LINES[h.id],h.id);assert.ok(GIFT_LINES[h.id],h.id);}
  assert.equal(new Set(Object.values(GIFT_LINES)).size,HEROES.length,'no shared gift line');
  assert.deepEqual(Object.fromEntries(GIFT_IDS.map(gift=>[gift,Object.values(FAVORITE).filter(g=>g===gift).length])),{candy:14,letter:13,bouquet:14});
});

test('hearts fill by points; a fully fed companion reaches ten hearts in two to three weeks',()=>{
  const e={bond:0,bondXp:0};assert.equal(addBond(e,39),0);assert.equal(addBond(e,1),1);assert.equal(e.bondXp,0);
  const total=BOND_STEPS.reduce((a,b)=>a+b,0),daily=10+20+10+10;
  assert.ok(total/daily>=14&&total/daily<=21,`${total/daily} days at the best daily pace`);
  addBond(e,1e6);assert.equal(e.bond,BOND_MAX);assert.equal(e.bondXp,0);
});

test('gifts grow in the basket (one every 8 hours, candy → letter → bouquet, three at most); favourites count double',()=>{
  const p=createProfile(NOW);const id=p.partner,fav=FAVORITE[id],other=GIFT_IDS.find(g=>g!==fav);
  assert.equal(command(p,'basket',{},NOW+7*HOUR).ok,false,'nothing before 8 hours');
  assert.deepEqual(act(p,'basket',{},NOW+17*HOUR).gifts,['candy','letter']);assert.deepEqual(p.gifts,{candy:1,letter:1,bouquet:0});
  // The clock keeps the hour already grown: the next gift is due 24 hours after the start.
  assert.equal(command(p,'basket',{},NOW+23*HOUR).ok,false);assert.deepEqual(act(p,'basket',{},NOW+24*HOUR).gifts,['bouquet']);
  // A full basket stops growing until it is emptied.
  assert.deepEqual(act(p,'basket',{},NOW+24*HOUR+5*DAY).gifts,['candy','letter','bouquet']);assert.equal(command(p,'basket',{},NOW+24*HOUR+5*DAY+7*HOUR).ok,false);
  // Missions, dispatch and shooting stars no longer drop gifts; the third mission adds a crystal bonus.
  const q=createProfile(NOW);q.daily.combat=true;q.daily.merges=5;q.daily.idle=true;act(q,'daily',{id:'combat'});act(q,'daily',{id:'merge'});
  const last=act(q,'daily',{id:'idle'});assert.equal(last.all,true);assert.equal(last.reward,30+TUNING.dailyBonus);assert.deepEqual(q.gifts,{candy:0,letter:0,bouquet:0});
  q.idleAt=NOW-10*HOUR;act(q,'idle',{});assert.deepEqual(q.gifts,{candy:0,letter:0,bouquet:0});
  // Giving: favourite 20 points with its line, others 10.
  p.gifts={candy:3,letter:3,bouquet:3};
  const a=act(p,'gift',{id,gift:fav});assert.equal(a.points,20);assert.equal(a.line,FAVORITE_LINES[id]);
  const b=act(p,'gift',{id,gift:other});assert.equal(b.points,10);assert.equal(b.line,GIFT_LINES[id]);assert.equal(p.heroes[id].bondXp,30);
  p.gifts.candy=0;assert.equal(command(p,'gift',{id,gift:'candy'},NOW).ok,false);
  assert.equal(command(p,'gift',{id:'queen',gift:'letter'},NOW).ok,false,'only owned companions');
  // The greeting adds points instead of a heart.
  p.petDay='';act(p,'pet',{},NOW+300*DAY);assert.equal(p.heroes[id].bond,1);assert.equal(p.heroes[id].bondXp,0);
});

test('a memorial can become the lobby once its companion reaches ten hearts',()=>{
  const p=createProfile(NOW),id='snow_rabbit';
  assert.equal(command(p,'lobby',{id},NOW).ok,false);
  p.heroes[id].bond=BOND_MAX;act(p,'lobby',{id});assert.equal(p.lobby,id);assert.equal(p.partner,id);
  act(p,'lobby',{id:null});assert.equal(p.lobby,null);
});

test('old saves keep their hearts, gain a gift bag, and over-capped greetings clamp to ten',()=>{
  const old=createProfile(NOW);delete old.gifts;delete old.lobby;delete old.daily.bouquet;delete old.basket;
  for(const e of Object.values(old.heroes))delete e.bondXp;old.heroes.star_boy.bond=14;old.heroes.snow_rabbit.bond=3;
  const p=parseProfile(JSON.stringify(old));assert.ok(p);
  assert.equal(p.heroes.star_boy.bond,10);assert.equal(p.heroes.snow_rabbit.bond,3);assert.equal(p.heroes.snow_rabbit.bondXp,0);
  assert.deepEqual(p.gifts,{candy:0,letter:0,bouquet:0});assert.equal(p.lobby,null);assert.equal(p.daily.bouquet,false);assert.deepEqual(p.basket,{at:old.clockAt,next:0});
});

test('weekly entry is open from stage 3 whatever this week is, using only met bosses',()=>{
  for(let w=0;w<9;w++){
    const p=createProfile(NOW),now=NOW+w*7*DAY;p.cleared=3;
    assert.ok(weeklyStage(p,now)<=3);const r=command(p,'begin',{mode:'weekly',tier:'easy'},now);assert.ok(r.ok,r.message);assert.ok(p.active.stage<=3);
  }
  const p=createProfile(NOW);p.cleared=20;assert.equal(weeklyStage(p,NOW),calendar(NOW).weekNo%9+1);
});
