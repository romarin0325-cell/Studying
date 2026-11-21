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
  assert.deepEqual(Object.fromEntries(GIFT_IDS.map(gift=>[gift,Object.values(FAVORITE).filter(g=>g===gift).length])),{candy:14,letter:13,bouquet:15});
});

test('hearts fill by points and cap at ten',()=>{
  const e={bond:0,bondXp:0};assert.equal(addBond(e,39),0);assert.equal(addBond(e,1),1);assert.equal(e.bondXp,0);
  const total=BOND_STEPS.reduce((a,b)=>a+b,0);assert.equal(addBond(e,total-BOND_STEPS[0]),9);
  assert.equal(addBond(e,50),0);assert.equal(e.bond,BOND_MAX);assert.equal(e.bondXp,0);
});

test('the basket grows a gift every 15 minutes up to eight, and favourites count double',()=>{
  const p=createProfile(NOW),quarter=15*60000,id=p.partner,fav=FAVORITE[id],other=GIFT_IDS.find(g=>g!==fav);
  assert.equal(command(p,'basket',{},NOW+quarter-1).ok,false);
  assert.deepEqual(act(p,'basket',{},NOW+2.5*quarter).gifts,['candy','letter']);assert.deepEqual(p.gifts,{candy:1,letter:1,bouquet:0});
  // Collecting keeps the elapsed part of the next interval.
  assert.equal(command(p,'basket',{},NOW+3*quarter-1).ok,false);assert.deepEqual(act(p,'basket',{},NOW+3*quarter).gifts,['bouquet']);
  // A full basket stops growing until it is emptied.
  const full=NOW+5*DAY;assert.deepEqual(act(p,'basket',{},full).gifts,['candy','letter','bouquet','candy','letter','bouquet','candy','letter']);
  assert.equal(command(p,'basket',{},full+quarter-1).ok,false);assert.deepEqual(act(p,'basket',{},full+quarter).gifts,['bouquet']);
  // Missions, dispatch and shooting stars no longer drop gifts; the third mission adds a crystal bonus.
  const q=createProfile(NOW);q.daily.combat=true;q.daily.merges=5;q.daily.idle=true;act(q,'daily',{id:'combat'});act(q,'daily',{id:'merge'});
  const last=act(q,'daily',{id:'idle'});assert.equal(last.all,true);assert.equal(last.reward,30+TUNING.dailyBonus);assert.deepEqual(q.gifts,{candy:0,letter:0,bouquet:0});
  q.idleAt=NOW-10*HOUR;act(q,'idle',{});assert.deepEqual(q.gifts,{candy:0,letter:0,bouquet:0});
  p.gifts={candy:3,letter:3,bouquet:3};
  const a=act(p,'gift',{id,gift:fav});assert.equal(a.points,100);assert.equal(a.line,FAVORITE_LINES[id]);
  const b=act(p,'gift',{id,gift:other});assert.equal(b.points,50);assert.equal(b.line,GIFT_LINES[id]);assert.equal(p.heroes[id].bondXp,0);
  p.gifts.candy=0;assert.equal(command(p,'gift',{id,gift:'candy'},NOW).ok,false);
  assert.equal(command(p,'gift',{id:'queen',gift:'letter'},NOW).ok,false,'only owned companions');
  p.petDay='';act(p,'pet',{},NOW+300*DAY);assert.equal(p.heroes[id].bond,3);assert.equal(p.heroes[id].bondXp,50);
});

test('battle bond pays eight for a win or a twelve-round draft loss and skips unowned and maxed heroes',()=>{
  const p=createProfile(NOW),id=p.deck[0];p.cleared=3;Object.assign(p.heroes[id],{bond:9,bondXp:98});
  const main=()=>{assert.ok(act(p,'begin',{mode:'main',stage:1}).ok);return act(p,'settle',{token:p.active.token,round:6,won:true});};
  assert.deepEqual(main().bond,p.deck.map(hero=>({id:hero,points:8,hearts:Number(hero===id),opened:hero===id})));
  assert.equal(p.heroes[id].bond,10);assert.deepEqual(main().bond,p.deck.slice(1).map(id=>({id,points:8,hearts:0,opened:false})));
  assert.ok(act(p,'begin',{mode:'weekly'}).ok);
  while(p.active.draft.length<p.deck.length){const at=p.active.offers.findIndex(o=>!p.heroes[o.id].owned);assert.ok(act(p,'draft',{index:Math.max(0,at)}).ok);}
  const draft=p.active.deck,pick=draft.find(hero=>!p.heroes[hero].owned);assert.ok(pick);p.heroes[pick].owned=true;
  const unowned=draft.filter(hero=>!p.heroes[hero].owned),before=unowned.map(hero=>structuredClone(p.heroes[hero]));assert.ok(unowned.length);
  const eligible=draft.filter(hero=>p.heroes[hero].owned&&p.heroes[hero].bond<BOND_MAX);assert.ok(eligible.length);
  const xp=eligible.map(hero=>p.heroes[hero].bondXp),lost=act(p,'settle',{token:p.active.token,round:12,won:false});
  assert.deepEqual(lost.bond,eligible.map(id=>({id,points:8,hearts:0,opened:false})));
  assert.deepEqual(eligible.map(hero=>p.heroes[hero].bondXp),xp.map(n=>n+8));
  assert.deepEqual(unowned.map(hero=>p.heroes[hero]),before);assert.equal(lost.dust,0);assert.equal(lost.star,null);
});

test('a memorial can become the lobby once its companion reaches ten hearts',()=>{
  const p=createProfile(NOW),id='snow_rabbit';
  assert.equal(command(p,'lobby',{id},NOW).ok,false);
  p.heroes[id].bond=BOND_MAX;act(p,'lobby',{id});assert.equal(p.lobby,id);assert.equal(p.partner,id);
  act(p,'lobby',{id:null});assert.equal(p.lobby,null);
});

test('changing partners clears the displayed memorial, including a stale saved selection',()=>{
  const p=createProfile(NOW),id='snow_rabbit';p.heroes[id].bond=BOND_MAX;
  act(p,'lobby',{id});
  assert.equal(act(p,'partner',{id:'missing'}).ok,false);assert.equal(p.lobby,id);
  act(p,'partner',{id});assert.equal(p.lobby,id,'reselecting the current partner keeps the memorial');
  act(p,'partner',{id:'star_boy'});assert.equal(p.lobby,null);
  assert.equal(parseProfile(JSON.stringify(p)).lobby,null);
  act(p,'partner',{id});assert.equal(p.lobby,null,'returning to the partner does not silently hang the memorial');
  p.lobby=id;p.partner='star_boy';
  const migrated=parseProfile(JSON.stringify(p));assert.ok(migrated);assert.equal(migrated.lobby,null);
  act(migrated,'lobby',{id});assert.equal(migrated.lobby,id);assert.equal(migrated.partner,id);
});

test('old saves keep their hearts, gain a gift bag, and over-capped greetings clamp to ten',()=>{
  const old=createProfile(NOW);delete old.gifts;delete old.lobby;delete old.daily.bouquet;delete old.basket;
  for(const e of Object.values(old.heroes))delete e.bondXp;old.heroes.star_boy.bond=14;old.heroes.snow_rabbit.bond=3;
  const p=parseProfile(JSON.stringify(old));assert.ok(p);
  assert.equal(p.heroes.star_boy.bond,10);assert.equal(p.heroes.snow_rabbit.bond,3);assert.equal(p.heroes.snow_rabbit.bondXp,0);
  assert.deepEqual(p.gifts,{candy:0,letter:0,bouquet:0});assert.equal(p.lobby,null);assert.equal(p.daily.bouquet,false);assert.deepEqual(p.basket,{at:old.clockAt,next:0});
});

test('draft entry opens at stage 3 and rotates between met bosses',()=>{
  for(let w=0;w<9;w++){
    const p=createProfile(NOW),now=NOW+w*4*HOUR;p.cleared=3;
    assert.ok(weeklyStage(p,now)<=3);const r=command(p,'begin',{mode:'weekly',tier:'easy'},now);assert.ok(r.ok,r.message);assert.ok(p.active.stage<=3);
  }
  const p=createProfile(NOW);p.cleared=20;assert.equal(weeklyStage(p,NOW),calendar(NOW).weekNo%9+1);
});
