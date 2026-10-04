import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {createBattle,resumeBattle,autoPlay,clearedRounds} from '../src/battle.js';
import {HEROES,HERO,DEFAULT_DECK,CHAPTERS,BOSS_ORDER} from '../src/content.js';
import {createProfile,command,validateProfile} from '../src/profile.js';
import {heroMultiplier} from '../src/economy.js';
const NOW=1791082800000;
function active(mode='main',stage=1){
  const p=createProfile(NOW);p.cleared=stage-1;
  if(mode!=='main')p.cleared=Math.max(3,p.cleared);
  assert.ok(command(p,'begin',{mode,stage},NOW).ok);
  if(mode==='weekly')for(let i=0;i<5;i++)assert.ok(command(p,'draft',{index:0},NOW).ok);
  return p;
}
function play(s,max=500){
  for(let i=0;i<max/.05;i++){
    E.step(s,.05);if(i%6===0)autoPlay(s);
    if(['victory','defeat'].includes(s.phase))break;
  }
  return s;
}

test('the exact rarity roster has independent valid stats and all 45 stages rotate the nine guardians',()=>{
  assert.equal(HEROES.length,30);assert.equal(new Set(HEROES.map(h=>h.id)).size,30);
  assert.deepEqual(HEROES.filter(h=>h.rarity==='C').map(h=>h.name),['별똥별소년','눈토끼','은토끼','밤토끼','세이렌','머쉬룸킹']);
  assert.deepEqual(HEROES.filter(h=>h.rarity==='R').map(h=>h.name),['명탐정','가디언','메이드','산타','레드드래곤','아우로라']);
  for(const h of HEROES)for(const key of ['damage','interval','range','radius'])assert.ok(Number.isFinite(h[key])&&h[key]>=0,h.id+' '+key);
  assert.equal(CHAPTERS.length,45);assert.equal(CHAPTERS[8].hp,3.05);
  for(const c of CHAPTERS){assert.equal(c.bosses[0],BOSS_ORDER[(c.stage-1)%9]);assert.equal(new Set(c.bosses).size,1);}
  const step=CHAPTERS[1].hp-CHAPTERS[0].hp;
  for(let i=1;i<45;i++)assert.ok(Math.abs(CHAPTERS[i].hp-CHAPTERS[i-1].hp-step)<1e-12);
});

test('six main waves contain exactly two copies of one boss and stage nine keeps the old final boss HP',()=>{
  for(const chapter of [0,8,9,35,44]){
    let bosses=0;
    for(let wave=1;wave<=6;wave++){
      const plan=E.wavePlan(wave,chapter);
      assert.ok(plan.sequence.every(e=>Number.isInteger(e.hp)&&e.hp>0));
      const n=plan.sequence.filter(e=>e.kind==='boss').length;assert.equal(n,wave===3||wave===6?1:0);bosses+=n;
    }assert.equal(bosses,2);
  }
  const old=Math.round(Math.round(76*1.34**11*3.05*32)*.8);
  assert.equal(E.wavePlan(6,8).sequence.find(e=>e.kind==='boss').hp,old);
});

test('five starter heroes finish a real opening expedition with no growth or rare equipment',()=>{
  const summary=[];
  for(const seed of [0x13579bdf,1234,98765]){
    const p=active();p.active.seed=seed;const s=play(createBattle(p),330);
    assert.equal(s.phase,'victory',`seed ${seed}, wave ${s.wave}, health ${s.health}`);
    assert.equal(s.wave,6);assert.ok(s.stats.merges>0);assert.ok(s.stats.skills>0);
    assert.ok(s.time>60&&s.time<330);assert.equal(s.deck.length,5);assert.equal(clearedRounds(s),6);
    p.active.run=E.serialize(s);assert.ok(validateProfile(p));assert.ok(resumeBattle(p));
    summary.push({seed,seconds:Number(s.time.toFixed(2)),health:s.health,merges:s.stats.merges,damage:Math.round(s.stats.damage)});
  }console.log('OPENING PLAY',JSON.stringify(summary));
});

test('persistent growth reaches actual direct, skill and poison damage without changing rarity base stats',()=>{
  const runFor=(id,enhance)=>{
    const p=active();p.heroes[id].owned=true;p.heroes[id].enhance=enhance;
    p.active.deck=[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,5);
    const s=createBattle(p);s.board=s.board.map(u=>u?.hero===id?u:null);s.queue=[{kind:'boss',hp:1e9}];s.spawnIn=0;
    E.step(s,.05);s.enemies[0].progress=300;s.enemies[0].speed=0;s.enemies[0].skillIn=1e9;
    return s;
  };
  for(const id of ['star_boy','night_rabbit','flame_sage','mushroom_king']){
    const base=runFor(id,0),grown=runFor(id,10);
    assert.equal(E.cast(base,id).ok,true);assert.equal(E.cast(grown,id).ok,true);
    for(let i=0;i<100;i++){E.step(base,.05);E.step(grown,.05);}
    assert.ok(base.stats.damage>0,id);assert.ok(grown.stats.damage>base.stats.damage*1.7,id);
    assert.ok(grown.stats.damage<base.stats.damage*2.7,id);
  }
});

test('support/control growth stays below its conservative bound while equipped relics apply once',()=>{
  const p=active();p.heroes.siren.enhance=100;p.relics.hourglass.owned=true;p.relics.hourglass.enhance=5;p.equipped=['hourglass'];
  const s=createBattle(p),u=s.board.find(u=>u?.hero==='star_boy');
  assert.ok(Math.abs(E.power(s,u)/HERO.star_boy.damage-1.1)<1e-12);
  assert.ok(E.special(s,'siren')<1.15);
  const base=E.newRun();base.queue=[{kind:'grunt',hp:10000}];base.spawnIn=0;E.step(base,.05);
  s.queue=[{kind:'grunt',hp:10000}];s.spawnIn=0;E.step(s,.05);
  assert.equal(E.cast(base,'siren').ok,true);assert.equal(E.cast(s,'siren').ok,true);
  assert.ok(s.buffs.haste>base.buffs.haste&&s.buffs.haste/base.buffs.haste<1.15);
});

test('weekly and monthly challenges use distinct plans and stop promptly when late-round damage is insufficient',()=>{
  const weekly=E.wavePlan(1,0,'weekly'),monthly=E.wavePlan(1,0,'monthly');
  assert.ok(weekly.sequence.length>=9);assert.ok(weekly.sequence.every(e=>e.hp===25));
  assert.deepEqual(monthly.sequence,[{kind:'boss',hp:900}]);
  assert.ok(E.wavePlan(8,0,'weekly').sequence[0].hp>25*60);
  assert.ok(E.wavePlan(8,0,'monthly').sequence[0].hp>900*40);
  for(const mode of ['weekly','monthly']){
    const p=active(mode,4),s=createBattle(p);
    s.wave=12;s.waveTime=mode==='monthly'?30:35;E.step(s,.05);
    assert.equal(s.phase,'defeat');assert.equal(clearedRounds(s),11);
    assert.equal(s.stats.kills,0);
  }
  for(let i=0;i<9;i++){
    const s=createBattle(active('monthly',4));s.wave=i+1;s.queue=E.wavePlan(i+1,0,'monthly').sequence;s.spawnIn=0;E.step(s,.05);
    assert.equal(s.enemies[0].boss,BOSS_ORDER[i]);
  }
});

test('move, merge, target priority and saved growth survive a real mid-combat resume',()=>{
  const p=active(),s=createBattle(p);for(let i=0;i<120;i++)E.step(s,.05);
  const from=s.board.findIndex(Boolean),to=s.board.findIndex(u=>!u);
  assert.ok(E.move(s,from,to).ok);E.cycleTarget(s,to);const priority=s.board[to].priority;
  for(let i=0;i<3;i++)E.summon(s);
  p.active.run=E.serialize(s);const restored=resumeBattle(p);assert.ok(restored);
  assert.equal(restored.time,s.time);assert.equal(restored.board[to].priority,priority);assert.deepEqual(restored.queue,s.queue);
  for(let i=0;i<40;i++){E.step(s,.05);E.step(restored,.05);}
  assert.equal(E.serialize(restored),E.serialize(s));
  const tampered=JSON.parse(p.active.run);tampered.deck.push('queen');p.active.run=JSON.stringify(tampered);
  assert.equal(resumeBattle(p),null);
});
