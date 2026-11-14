import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {autoPlay} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';
import {HERO,DEFAULT_DECK,MAX_RANK} from '../src/content.js';
import {OATHS,OATH,OATH_CLOSED,OATH_BANDS,oathConflict,oathDeckProblem,oathMods} from '../src/preview/oath.js';

const CLOSED=new Set(OATH_CLOSED);
const SR=['lightning_sage','ancient_dragon','flame_sage','time_magician','storm_sage'];

test('nobeam and rabbits are mutually exclusive in either selection order',()=>{
  const rabbits=['silver_rabbit','snow_rabbit','night_rabbit','siren','santa'];
  assert.equal(HERO.silver_rabbit.shape,'beam');
  assert.equal(oathDeckProblem(['rabbits'],rabbits),'');
  assert.match(oathDeckProblem(['nobeam'],rabbits),/관통/);
  assert.equal(oathDeckProblem(['nobeam'],DEFAULT_DECK),'');
  assert.equal(OATH.nobeam.points,2);assert.equal(OATH.rabbits.points,4);
  for(const ids of [['nobeam','rabbits'],['rabbits','nobeam']])assert.match(oathConflict(ids),/함께 걸 수 없습니다/);
  for(const id of ['nobeam','rabbits'])assert.equal(oathConflict([id]),'');
});

test('oath early rewards rise while each later band still pays more',()=>{
  const old=[100,120,150,180,200,230,250,270,320,380];
  for(const [i,band] of OATH_BANDS.entries()){
    assert.equal(band.score,(i+1)*5);
    assert.ok(i<8?band.reward>old[i]:band.reward===old[i]);
    if(i)assert.ok(band.reward>OATH_BANDS[i-1].reward);
  }
});

function occupied(s){return s.board.flatMap((u,i)=>u?[{i,u}]:[]);}
function plant(s,hero,index,rank=1){
  const template=s.board.find(Boolean);
  assert.ok(template,'a live unit to copy');
  assert.equal(s.board[index]??null,null,`cell ${index} is free`);
  s.board[index]={...template,uid:s.nextId++,hero,rank,cooldown:100,windup:0,target:null,attacks:0,disabled:0,invincible:0,priority:'first'};
  delete s.board[index].form;
  delete s.board[index].mergedWave;
  delete s.board[index].clock;
  return s.board[index];
}
function ensure(s,hero){
  const at=s.board.findIndex(u=>u?.hero===hero);
  if(at>=0)return at;
  const index=s.board.findIndex((u,i)=>!u&&!E.closedCell(s,i));
  assert.ok(index>=0,hero);
  plant(s,hero,index,1);
  return index;
}
function hold(s){
  s.enemies=[];s.queue=[{kind:'grunt',hp:1e15}];s.spawnIn=0;
  E.step(s,.05);
  const e=s.enemies[0];
  assert.ok(e);
  e.speed=0;e.hp=1e15;e.maxHp=1e15;e.skillIn=1e9;e.progress=100;
  s.queue=[];s.spawnIn=1e9;
  for(const u of s.board)if(u){u.cooldown=100;u.windup=0;}
  return e;
}
function quiet(s){for(const u of s.board)if(u){u.cooldown=100;u.windup=0;}}

test('crownless blocks UR decks and shares the rarity lock with lowstar',()=>{
  assert.deepEqual(OATHS.map(o=>o.id),[
    'lowstar','nobeam','rabbits','shapes','crownless',
    'drought','untrained','afterglow','heavy','purse','once','ceiling',
    'scatter','hollow','stiff',
    'tough1','tough2','haste','tyrant','glass',
  ]);
  for(const [id,group,points,name,text] of [
    ['crownless','deck',3,'왕관 없는 원정','UR 동료를 편성할 수 없습니다.'],
    ['once','tempo',2,'단 한 번의 응답','동료마다 필살기를 웨이브당 한 번만 쓸 수 있습니다.'],
    ['ceiling','tempo',3,'낮은 천장','동료는 3성까지만 오릅니다.'],
    ['hollow','board',3,'닫힌 중심','전장 가운데 9칸을 쓸 수 없습니다.'],
    ['stiff','board',2,'굳은 발걸음','전투 중 자리를 옮기면 8초 동안 다시 옮길 수 없습니다. 합성은 할 수 있습니다.'],
  ]){
    assert.equal(OATH[id].group,group,id);
    assert.equal(OATH[id].points,points,id);
    assert.equal(OATH[id].name,name,id);
    assert.equal(OATH[id].text,text,id);
  }
  assert.equal(OATH.lowstar.exclusive,'rarity');
  assert.equal(OATH.crownless.exclusive,'rarity');
  assert.equal(oathConflict(['lowstar']),'');
  assert.equal(oathConflict(['crownless']),'');
  assert.ok(oathConflict(['crownless','lowstar']));
  assert.ok(oathConflict(['lowstar','crownless']));
  const message='왕관 없는 원정: UR 동료를 편성할 수 없습니다.';
  assert.equal(oathDeckProblem(['crownless'],['zeke','luna','jasmine','queen','rumi']),message);
  assert.equal(oathDeckProblem(['crownless'],['time_ruler']),message);
  assert.equal(HERO.time_ruler.rarity,'UR');
  assert.equal(oathDeckProblem(['crownless'],DEFAULT_DECK),'');
  assert.equal(oathDeckProblem(['crownless'],SR),'');
  assert.deepEqual(oathMods(['crownless']),{});
  assert.equal(oathMods(['once']).oncePerWave,true);
  assert.equal(oathMods(['ceiling']).rankCap,3);
  assert.equal(oathMods(['hollow']).closed,OATH_CLOSED);
  assert.ok(Object.isFrozen(OATH_CLOSED));
  assert.deepEqual([...OATH_CLOSED],[6,7,8,11,12,13,16,17,18]);
  assert.equal(oathMods(['stiff']).moveCooldown,8);
});

test('hollow keeps every unit off the centre and rejects a closed-cell save',()=>{
  const s=E.newRun({mode:'oath',oaths:['hollow'],seed:3});
  assert.deepEqual(occupied(s).sort((a,b)=>a.u.uid-b.u.uid).map(p=>p.i),[21,23,2]);
  for(const i of OATH_CLOSED)assert.equal(s.board[i],null,`opening ${i}`);
  s.gold=1e7;
  for(let n=0;n<30;n++){
    if(!s.board.some((u,i)=>!u&&!CLOSED.has(i))){
      const sellAt=s.board.findIndex(u=>u);
      assert.ok(E.sell(s,sellAt).ok);
    }
    const preferred=n===0?12:-1;
    const placed=E.summon(s,preferred);
    assert.equal(placed.ok,true,placed.reason);
    assert.equal(CLOSED.has(placed.index),false,`summon ${n} on ${placed.index}`);
    if(preferred===12)assert.notEqual(placed.index,12);
    for(const i of OATH_CLOSED)assert.equal(s.board[i],null);
  }
  while(s.board.some((u,i)=>!u&&!CLOSED.has(i)))assert.equal(E.summon(s).ok,true);
  const full=E.summon(s);
  assert.deepEqual(full,{ok:false,reason:'전장이 가득 찼습니다. 합성하거나 영웅을 회수하세요.'});
  const from=s.board.findIndex(u=>u);
  const refused=E.move(s,from,12);
  assert.equal(refused.ok,false);
  assert.equal(refused.reason,'닫힌 칸에는 둘 수 없습니다.');
  assert.equal(s.board[12],null);
  assert.equal(s.board[from]?.uid>0,true);

  const saved=JSON.parse(E.serialize(s));
  assert.ok(E.restore(E.serialize(s)));
  const src=saved.board.findIndex(Boolean);
  saved.board[12]=saved.board[src];saved.board[src]=null;
  assert.equal(E.restore(JSON.stringify(saved)),null);

  const fresh=JSON.parse(E.serialize(E.newRun({seed:9})));
  delete fresh.moveCooldown;delete fresh.castWave;
  const migrated=E.restore(JSON.stringify(fresh));
  assert.ok(migrated);
  assert.equal(migrated.moveCooldown,0);
  assert.deepEqual(migrated.castWave,[]);
  const high=JSON.parse(E.serialize(E.newRun({seed:9})));
  high.moveCooldown=9;assert.equal(E.restore(JSON.stringify(high)),null);
  high.moveCooldown=8;assert.ok(E.restore(JSON.stringify(high)));
  high.moveCooldown=8;high.castWave=['not_a_hero'];assert.equal(E.restore(JSON.stringify(high)),null);
  high.castWave=['star_boy','star_boy'];assert.equal(E.restore(JSON.stringify(high)),null);
  high.castWave=['star_boy'];assert.ok(E.restore(JSON.stringify(high)));
});

test('hollow storm telegraphs skip closed cells and Ares reseats only onto open cells',()=>{
  const storm=E.newRun({mode:'oath',oaths:['hollow'],chapter:4,seed:5});
  while(storm.board.filter(Boolean).length>1)assert.ok(E.sell(storm,storm.board.findIndex(Boolean)).ok);
  storm.enemies=[];storm.queue=[{kind:'boss',hp:1e12}];storm.spawnIn=0;
  E.step(storm,.05);
  const thor=storm.enemies.find(e=>e.boss);
  assert.equal(thor.boss,'thor');
  thor.speed=0;thor.progress=400;thor.skillIn=0;thor.hp=1e12;thor.maxHp=1e12;
  storm.queue=[];storm.spawnIn=1e9;quiet(storm);
  E.step(storm,.05);
  assert.equal(storm.telegraph?.pattern,'storm');
  assert.equal(storm.telegraph.cells.length,3);
  for(const i of storm.telegraph.cells)assert.equal(E.closedCell(storm,i),false,`storm cell ${i}`);
  assert.ok(storm.telegraph.cells.some(i=>!storm.board[i]),'empty open cells fill the rest of the telegraph');

  const s=E.newRun({mode:'oath',oaths:['hollow'],chapter:6,seed:6});
  const fixedCell=0;
  plant(s,'gold_dragon',fixedCell,1);
  const fixedUid=s.board[fixedCell].uid;
  s.goldCharge={source:fixedUid,wave:s.wave,started:s.time,ends:s.time+100};
  const uids=s.board.filter(Boolean).map(u=>u.uid).sort((a,b)=>a-b);
  s.enemies=[];s.queue=[{kind:'boss',hp:1e12}];s.spawnIn=0;
  E.step(s,.05);
  const ares=s.enemies.find(e=>e.boss);
  assert.equal(ares.boss,'ares');
  ares.speed=0;ares.progress=400;ares.skillIn=0;ares.hp=1e12;ares.maxHp=1e12;
  s.queue=[];s.spawnIn=1e9;quiet(s);
  assert.equal(s.board[fixedCell].uid,fixedUid);
  E.step(s,.05);
  assert.equal(s.telegraph?.pattern,'shuffle');
  for(let i=0;i<80&&s.telegraph;i++){quiet(s);E.step(s,.05);}
  assert.equal(s.telegraph,null);
  assert.equal(s.board[fixedCell]?.uid,fixedUid,'a charging unit keeps its cell');
  assert.deepEqual(s.board.filter(Boolean).map(u=>u.uid).sort((a,b)=>a-b),uids);
  for(const i of OATH_CLOSED)assert.equal(s.board[i],null,`shuffle left ${i}`);
  assert.equal(s.moveCooldown,0);
});

test('stiff waits eight seconds after a combat swap, still allows a merge, and clears in intermission',()=>{
  const plain=E.newRun({seed:1});
  const plainFrom=plain.board.findIndex(Boolean),plainTo=plain.board.findIndex(u=>!u);
  assert.equal(E.move(plain,plainFrom,plainTo).ok,true);
  assert.equal(plain.moveCooldown,0);
  assert.equal(E.moveWait(plain),0);

  const s=E.newRun({oaths:['stiff'],seed:2});
  const enemy=hold(s);
  const [a,b,c]=occupied(s);
  assert.equal(new Set([a.u.hero,b.u.hero,c.u.hero]).size,3);
  plant(s,a.u.hero,0,a.u.rank);
  assert.equal(E.move(s,b.i,1).ok,true);
  assert.equal(s.moveCooldown,8);
  assert.equal(E.moveWait(s),8);
  const blocked=E.move(s,c.i,4);
  assert.equal(blocked.ok,false);
  assert.equal(blocked.reason,'굳은 발걸음: 8초 뒤에 옮길 수 있습니다.');
  assert.equal(blocked.wait,8);
  assert.equal(s.board[c.i].uid,c.u.uid);
  const cd=s.moveCooldown;
  assert.equal(E.move(s,a.i,0).merged,true);
  assert.equal(s.moveCooldown,cd);
  assert.equal(s.board[0].rank,a.u.rank+1);
  const t0=s.time;
  while(s.time<t0+8-1e-9)E.step(s,Math.min(.05,t0+8-s.time));
  assert.equal(s.moveCooldown,0);
  assert.equal(E.moveWait(s),0);
  assert.equal(E.move(s,c.i,4).ok,true);
  assert.equal(s.moveCooldown,8);
  enemy.hp=0;s.queue=[];
  E.step(s,.05);
  assert.equal(s.phase,'reward');
  assert.equal(E.chooseReward(s,s.reward[0]).ok,true);
  assert.equal(s.phase,'intermission');
  assert.equal(s.moveCooldown,0);
  assert.equal(E.moveWait(s),0);
  const from=s.board.findIndex(Boolean),to=s.board.findIndex(u=>!u);
  assert.equal(E.move(s,from,to).ok,true);
  assert.equal(s.moveCooldown,0);
  assert.equal(E.moveWait(s),0);
});

test('once spends a cast only after it succeeds and returns it next wave',()=>{
  const deck=['queen','siren','star_boy','snow_rabbit','night_rabbit'];
  const s=E.newRun({oaths:['once'],deck,seed:4});
  hold(s);
  ensure(s,'queen');ensure(s,'siren');
  s.gold=9999;
  s.gauge=E.skillCost(s,'queen')-1;
  const broke=E.cast(s,'queen');
  assert.equal(broke.ok,false);
  assert.match(broke.reason,/별빛이 부족합니다/);
  assert.equal(E.castSpent(s,'queen'),false);
  assert.deepEqual(s.castWave,[]);
  s.gauge=120;
  assert.equal(E.cast(s,'queen').ok,true);
  assert.equal(E.castSpent(s,'queen'),true);
  assert.deepEqual(s.castWave,['queen']);
  const extra=s.board.findIndex(u=>!u);
  plant(s,'queen',extra,1);
  const spent=E.cast(s,'queen');
  const lock=E.castLock(s,'queen');
  assert.equal(spent.ok,false);
  assert.equal(spent.kind,'spent');
  assert.equal(spent.reason,'단 한 번의 응답: 이번 웨이브에 이미 썼습니다.');
  assert.equal(lock.kind,'spent');
  assert.equal(lock.reason,spent.reason);
  s.gauge=120;
  assert.equal(E.cast(s,'siren').ok,true);
  assert.equal(E.castSpent(s,'siren'),true);
  assert.deepEqual(s.castWave,['queen','siren']);
  for(const e of s.enemies)e.hp=0;
  s.queue=[];
  E.step(s,.05);
  assert.equal(s.phase,'reward');
  assert.equal(E.chooseReward(s,s.reward[0]).ok,true);
  assert.equal(s.phase,'intermission');
  while(s.phase==='intermission'||!s.enemies.length){quiet(s);E.step(s,.05);}
  assert.equal(s.wave,2);
  assert.equal(s.phase,'combat');
  assert.deepEqual(s.castWave,[]);
  assert.equal(E.castSpent(s,'queen'),false);
  const foe=s.enemies[0];
  foe.speed=0;foe.hp=1e15;foe.maxHp=1e15;foe.skillIn=1e9;
  s.queue=[];s.spawnIn=1e9;quiet(s);
  s.gauge=120;s.gold=9999;
  assert.equal(E.cast(s,'queen').ok,true);
  assert.deepEqual(s.castWave,['queen']);
});

test('ceiling swaps two 3-star units and still merges 2-star units into 3',()=>{
  const s=E.newRun({oaths:['ceiling'],seed:8});
  assert.equal(E.rankCap(s),3);
  assert.equal(E.rankCap(E.newRun({seed:8})),6);
  assert.equal(E.rankCap(null),MAX_RANK);
  const template=s.board.find(Boolean);
  s.board.fill(null);
  s.board[0]={...template,uid:s.nextId++,hero:'star_boy',rank:3,cooldown:100,windup:0,target:null,attacks:0,disabled:0,invincible:0,priority:'first'};
  s.board[1]={...template,uid:s.nextId++,hero:'star_boy',rank:3,cooldown:100,windup:0,target:null,attacks:0,disabled:0,invincible:0,priority:'first'};
  delete s.board[0].form;delete s.board[1].form;
  const left=s.board[0].uid,right=s.board[1].uid,gauge=s.gauge,gold=s.gold,merges=s.stats.merges;
  assert.equal(E.canMerge(s.board[0],s.board[1],s),false);
  const swapped=E.move(s,0,1);
  assert.equal(swapped.ok,true);
  assert.equal(swapped.merged,undefined);
  assert.equal(s.board[0].uid,right);
  assert.equal(s.board[1].uid,left);
  assert.equal(s.board[0].rank,3);
  assert.equal(s.board[1].rank,3);
  assert.equal(s.gauge,gauge);
  assert.equal(s.gold,gold);
  assert.equal(s.stats.merges,merges);
  s.board[0].rank=2;s.board[1].rank=2;
  assert.equal(E.canMerge(s.board[0],s.board[1],s),true);
  const merged=E.move(s,0,1);
  assert.equal(merged.merged,true);
  assert.equal(s.board[1].rank,3);
  assert.equal(s.board[0],null);
  assert.equal(s.stats.merges,merges+1);
  assert.equal(s.gauge,gauge+E.MERGE_STARLIGHT);
  assert.equal(s.gold,gold);

  const capped=E.newRun({oaths:['ceiling'],seed:4});
  const seen=new Set(capped.board.filter(Boolean).map(u=>u.uid));
  capped.reserves.push({hero:capped.deck[0],rank:MAX_RANK});
  E.step(capped,.05);
  const born=capped.board.find(u=>u&&!seen.has(u.uid));
  assert.ok(born);
  assert.equal(born.rank,3);
  assert.equal(born.hero,capped.deck[0]);
  assert.ok(capped.board.every(u=>!u||u.rank<=3));
});

test('basic auto does not spend the turn on a board whose only gaps are closed',()=>{
  const s=E.newRun({oaths:['hollow','ceiling'],seed:12,startGold:5000});
  s.gold=1e6;
  while(s.board.some((u,i)=>!u&&!E.closedCell(s,i))){
    const placed=E.summon(s);
    assert.equal(placed.ok,true,placed.reason);
    assert.equal(E.closedCell(s,placed.index),false);
  }
  for(const u of s.board)if(u)u.rank=3;
  const summons=s.stats.summons;
  autoPlay(s);
  assert.equal(s.stats.summons,summons);
  assert.ok(Object.values(s.upgrades).some(n=>n>0));
  for(const i of OATH_CLOSED)assert.equal(s.board[i],null);
});

test('smart auto clears five oaths without closed cells, ranks above 3, or a second cast',{timeout:180000},()=>{
  const deck=SR,meta=Object.fromEntries(deck.map(id=>[id,{power:2000,special:1}]));
  const s=E.newRun({mode:'oath',oaths:['crownless','once','ceiling','hollow','stiff'],deck,meta,seed:1,startGold:2000});
  assert.equal(oathDeckProblem(s.oaths,s.deck),'');
  assert.deepEqual(occupied(s).sort((a,b)=>a.u.uid-b.u.uid).map(p=>p.i),[21,23,2]);
  const casts=new Map();
  const watch=()=>{
    for(const ev of s.events){
      if(ev.type!=='skill')continue;
      const key=`${s.wave}:${ev.hero}`;
      const n=(casts.get(key)||0)+1;
      casts.set(key,n);
      assert.equal(n,1,`second cast ${key}`);
    }
    s.events.length=0;
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u)continue;
      assert.equal(E.closedCell(s,i),false,`cell ${i} wave ${s.wave}`);
      assert.ok(u.rank<=3,`rank ${u.rank}`);
    }
  };
  watch();
  let autoIn=0,pickBlessing=false,ticks=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<20000){
    const before=s.phase;
    E.step(s,.05);ticks++;
    if(pickBlessing){smartAutoPlay(s);autoIn=0;pickBlessing=false;}
    else if(before!=='reward'&&s.phase==='reward')pickBlessing=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=.05;if(autoIn>=.32){smartAutoPlay(s);autoIn=0;}}
    watch();
  }
  assert.equal(s.phase,'victory',`phase ${s.phase} wave ${s.wave} health ${s.health} time ${s.time}`);
});
