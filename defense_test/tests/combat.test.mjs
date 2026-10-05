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
function ensureHero(s,id){for(let i=0;i<20&&!E.bestUnit(s,id);i++){s.gold+=1000;E.summon(s);}assert.ok(E.bestUnit(s,id),id);return s;}

function close(actual,expected,label='numeric contract'){
  assert.ok(Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),label+': '+actual+' != '+expected);
}
function distanceToPath(point){
  let best=Infinity;
  for(let i=1;i<E.PATH.length;i++){
    const [ax,ay]=E.PATH[i-1],[bx,by]=E.PATH[i],dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((point.x-ax)*dx+(point.y-ay)*dy)/l2));
    best=Math.min(best,Math.hypot(point.x-(ax+dx*t),point.y-(ay+dy*t)));
  }
  return best;
}
// Start with the real run schema, then place isolated, valid pre-battle units.
// All behavior under assertion is exercised through engine commands and step.
function traitArena(placements,{artifacts=[],seed=1234,wave=1}={}){
  const ids=[...new Set(placements.map(p=>p.hero))];
  const deck=[...ids,...DEFAULT_DECK.filter(id=>!ids.includes(id))].slice(0,5);
  const s=E.newRun({deck,artifacts,seed}),template=s.board.find(Boolean);
  s.board.fill(null);s.wave=wave;s.events=[];s.queue=[{kind:'grunt',hp:1e9}];s.spawnIn=1e6;
  for(const p of placements)s.board[p.index]={
    ...template,uid:s.nextId++,hero:p.hero,rank:p.rank||1,birthWave:p.birthWave||wave,
    born:p.born||0,cooldown:100,windup:0,target:null,attacks:0,harvest:12,disabled:0,
    priority:E.targetingLocked(p.hero)?'random':HERO[p.hero].bossDamage?'boss':'first',
  };
  return s;
}
function enemiesFor(s,specs){
  s.queue=specs.map(p=>({kind:p.kind||'grunt',hp:p.hp||1e6}));
  for(let i=0;i<specs.length;i++){s.spawnIn=0;E.step(s,.001);}
  for(const [i,e] of s.enemies.entries()){
    Object.assign(e,{progress:specs[i].progress??1200,speed:0,skillIn:1e6,shield:specs[i].shield||0});
  }
  s.queue=[{kind:'grunt',hp:1e9}];s.spawnIn=1e6;
  return s.enemies;
}
function launchNormal(s,u){
  u.cooldown=0;u.windup=0;u.target=null;u.disabled=0;
  for(let i=0;i<8;i++){
    E.step(s,.05);
    const shot=s.shots.find(shot=>shot.source===u.uid&&shot.proc!==false);
    if(shot){u.cooldown=100;return shot;}
  }
  assert.fail('no actual normal attack launched for '+u.hero);
}
function resolveNormal(s,shot){
  shot.life=.001;E.step(s,.001);return shot;
}
function advanceTo(s,until){
  for(let i=0;s.time<until-1e-9&&i<20000;i++)E.step(s,Math.min(.05,until-s.time));
  close(s.time,until,'requested absolute combat time');
}
function quiet(s){for(const u of s.board)if(u){u.cooldown=100;u.windup=0;u.disabled=100;}s.shots=[];s.zones=[];}
function readyCast(s,id){s.gauge=120;assert.ok(E.cast(s,id).ok,id+' ultimate');}
function landZone(s,u,e){const shot=launchNormal(s,u);if(shot.ground)shot.to=E.pathPoint(e.progress);resolveNormal(s,shot);return shot;}
function rulerWinner(s){
  const rulers=s.board.filter(u=>u?.hero==='time_ruler');
  const boosted=rulers.filter(u=>E.personalTrait(s,u).damageMultiplier===1.5);
  assert.equal(boosted.length,1,'exactly one Time Ruler has the personal bonus');
  assert.equal(boosted[0].rank,Math.max(...rulers.map(u=>u.rank)));
  for(const u of rulers)close(E.power(s,u),HERO.time_ruler.damage*2.35**(u.rank-1)*(u===boosted[0]?1.5:1),'Time Ruler power');
  assert.equal(s.timeRulerUid,boosted[0].uid);
  return boosted[0];
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
    const s=ensureHero(createBattle(p),id);s.board=s.board.map(u=>u?.hero===id?u:null);s.queue=[{kind:'boss',hp:1e9}];s.spawnIn=0;
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
  const s=ensureHero(ensureHero(createBattle(p),'star_boy'),'siren'),u=s.board.find(u=>u?.hero==='star_boy');
  assert.ok(Math.abs(E.power(s,u)/(HERO.star_boy.damage*1.5)-1.1)<1e-12);
  assert.ok(E.special(s,'siren')<1.15);
  const base=ensureHero(E.newRun({seed:1234}),'siren');base.queue=[{kind:'grunt',hp:10000}];base.spawnIn=0;E.step(base,.05);
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

test('a new battle draws three distinct seeded companions from a five-person deck and entry advances the seed',()=>{
  const seen=new Set();for(let i=1;i<=80;i++){const seed=i*0x9e3779b1>>>0,a=E.newRun({seed}),b=E.newRun({seed});assert.equal(a.board.filter(Boolean).length,3);assert.equal(new Set(a.board.filter(Boolean).map(u=>u.hero)).size,3);assert.equal(E.serialize(a),E.serialize(b));a.board.filter(Boolean).forEach(u=>{assert.ok(DEFAULT_DECK.includes(u.hero));seen.add(u.hero);});}
  assert.equal(seen.size,5);const p=active();const seed=p.active.seed;command(p,'settle',{token:p.active.token,round:0},NOW);command(p,'begin',{mode:'main',stage:1},NOW);assert.notEqual(p.active.seed,seed);
});

test('gauge caps and restores at 120, both delayed strikes hit at 0.3 seconds, and mirror keeps its recording window',()=>{
  for(const id of ['star_boy','cherry_prince','aurora']){
    const deck=[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,5),s=ensureHero(E.newRun({deck,seed:1234}),id);s.queue=[{kind:'boss',hp:1e9}];s.spawnIn=0;E.step(s,.05);
    for(const u of s.board)if(u)u.disabled=20;s.enemies[0].speed=0;s.enemies[0].skillIn=99;s.gauge=120;
    assert.ok(E.restore(E.serialize(s)));assert.ok(E.cast(s,id).ok);const f=s.finishers[0];assert.equal(f.total,id==='aurora'?3:.3);
    const before=s.stats.damage;for(let i=0;i<5;i++)E.step(s,.05);assert.equal(s.stats.damage,before);
    E.step(s,.05);if(id==='aurora'){assert.equal(s.stats.damage,before);for(let i=6;i<60;i++)E.step(s,.05);}assert.ok(s.stats.damage>before);assert.equal(s.finishers.length,0);
  }
  const s=E.newRun({seed:1234});s.gauge=119.99;E.step(s,.05);assert.equal(s.gauge,120);const bad=JSON.parse(E.serialize(s));bad.gauge=120.01;assert.equal(E.restore(bad),null);
});

test('sustained skill timers, total durations and numeric attack stats survive resume without a cosmetic damage change',()=>{
  for(const id of Object.keys(E.ACTIVE_SKILLS)){
    const deck=[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,5),s=ensureHero(E.newRun({deck,seed:1234}),id);s.queue=[{kind:'boss',hp:1e9}];s.spawnIn=0;E.step(s,.05);s.gauge=120;assert.ok(E.cast(s,id).ok);
    const active=E.activeSkill(s,id);assert.ok(active);E.step(s,.05);const saved=E.restore(E.serialize(s));assert.ok(saved);assert.equal(E.activeSkill(saved,id).total,active.total);assert.ok(E.activeSkill(saved,id).remaining<active.remaining);
    const u=E.bestUnit(s,id),fast=E.combatStats(s,u),detail=E.combatStats(s,u,undefined,true);assert.equal(fast.damage,detail.damage);assert.equal(fast.interval,detail.interval);assert.deepEqual(fast.bonuses,[]);
    for(let i=0;i<260;i++)E.step(s,.05);assert.equal(E.activeSkill(s,id),null,id);
  }
});

test('cardinal Lightning components use the exact 2, 3 and 4+ power and chain thresholds',()=>{
  for(const [cells,multiplier,ratio,extra] of [
    [[6],1,.65,0],[[6,7],1.10,.70,0],[[6,7,12],1.18,.75,0],
    [[6,7,12,11],1.30,.80,1],[[6,7,12,11,16],1.30,.80,1],
  ]){
    const s=traitArena(cells.map(index=>({hero:'lightning_sage',index})));
    for(const index of cells){
      const u=s.board[index],trait=E.personalTrait(s,u),stats=E.combatStats(s,u,index,true);
      assert.equal(trait.size,cells.length);close(trait.damageMultiplier,multiplier);
      close(E.power(s,u),HERO.lightning_sage.damage*multiplier);
      close(stats.damage,HERO.lightning_sage.damage*multiplier);
      close(stats.skillPower,E.power(s,u));close(stats.chainRatio,ratio);assert.equal(stats.extraChain,extra);
    }
  }
});

test('Lightning adjacency rejects diagonal and row-wrap links and immediately follows a real move',()=>{
  for(const cells of [[6,12],[4,5],[0,6,12]]){
    const s=traitArena(cells.map(index=>({hero:'lightning_sage',index})));
    for(const index of cells){assert.equal(E.personalTrait(s,s.board[index]).size,1);close(E.power(s,s.board[index]),HERO.lightning_sage.damage);}
  }
  const s=traitArena([6,7,12,13].map(index=>({hero:'lightning_sage',index})));
  const moved=s.board[13],uid=moved.uid;
  assert.equal(E.personalTrait(s,s.board[6]).size,4);
  assert.ok(E.move(s,13,24).ok);assert.equal(s.board[24].uid,uid);
  for(const index of [6,7,12]){assert.equal(E.personalTrait(s,s.board[index]).size,3);close(E.power(s,s.board[index]),HERO.lightning_sage.damage*1.18);}
  assert.equal(E.personalTrait(s,s.board[24]).size,1);
  assert.ok(E.move(s,24,13).ok);
  for(const index of [6,7,12,13])assert.equal(E.personalTrait(s,s.board[index]).size,4);
  const restored=E.restore(E.serialize(s));assert.ok(restored);
  assert.equal(E.personalTrait(restored,restored.board[6]).size,4);
});

test('Lightning normal hits apply the enhanced chain ratio and only the 4+ component gets another recipient',()=>{
  for(const [cells,ratio,extra,multiplier] of [
    [[12,13],.70,0,1.10],[[12,13,18],.75,0,1.18],[[12,13,18,17],.80,1,1.30],
  ]){
    const s=traitArena(cells.map(index=>({hero:'lightning_sage',index})));
    const enemies=enemiesFor(s,[1200,1220,1240,1260,1280].map(progress=>({progress})));
    const shot=launchNormal(s,s.board[12]),primary=enemies.find(e=>e.uid===shot.target);
    const before=new Map(enemies.map(e=>[e.uid,e.hp]));resolveNormal(s,shot);
    const chains=s.events.filter(e=>e.type==='chain'&&e.hero==='lightning_sage');
    assert.equal(chains.length,2+extra);
    close(before.get(primary.uid)-primary.hp,HERO.lightning_sage.damage*multiplier,'primary Lightning hit');
    const chainVictims=enemies.filter(e=>e!==primary&&e.hp<before.get(e.uid));
    assert.equal(chainVictims.length,2+extra);
    for(const e of chainVictims)close(before.get(e.uid)-e.hp,HERO.lightning_sage.damage*multiplier*ratio,'chain Lightning hit');
    assert.equal(enemies.filter(e=>e.hp===before.get(e.uid)).length,2-extra);
  }
});

test('Maid has exactly 50% more base damage and chooses random eligible targets without priority cycling',()=>{
  close(HERO.avalanche_maid.damage,24*1.5,'Maid authored base damage');
  assert.equal(E.targetingLocked('avalanche_maid'),true);
  const selected=[];
  for(const seed of [1,1584200935]){
    const s=traitArena([{hero:'avalanche_maid',index:0}]);
    const enemies=enemiesFor(s,[100,300,800,1150].map(progress=>({progress})));
    const u=s.board[0],priority=u.priority;
    for(let i=0;i<6;i++)E.cycleTarget(s,0);
    assert.equal(u.priority,priority);
    const at=E.cellPoint(0),eligible=enemies.filter(e=>Math.hypot(E.pathPoint(e.progress).x-at.x,E.pathPoint(e.progress).y-at.y)<=HERO.avalanche_maid.range);
    assert.equal(eligible.length,3);s.rng=seed;
    const shot=launchNormal(s,u);assert.ok(eligible.some(e=>e.uid===shot.target));
    assert.notEqual(shot.target,enemies[3].uid);selected.push(shot.target);
    close(shot.damage,24*1.5);
  }
  assert.notEqual(selected[0],selected[1],'controlled low and high rolls choose different eligible targets');
});

test('Star Boy and Whale use birth-wave age for exact power, displayed power and skill damage',()=>{
  for(const [id,factors] of [['star_boy',[1.5,1,.75,.75]],['galaxy_whale',[.75,1,1.25,1.25]]]){
    for(const [age,factor] of factors.entries()){
      const s=traitArena([{hero:id,index:12,birthWave:3}],{wave:3+age}),u=s.board[12];
      const [enemy]=enemiesFor(s,[{progress:1200}]);
      close(E.personalTrait(s,u).damageMultiplier,factor);
      close(E.power(s,u),HERO[id].damage*factor);
      close(E.combatStats(s,u).damage,HERO[id].damage*factor);
      close(E.combatStats(s,u).skillPower,HERO[id].damage*factor);
      s.gauge=120;const before=enemy.hp;assert.ok(E.cast(s,id).ok);
      if(id==='star_boy'){
        close(s.finishers[0].damage,HERO[id].damage*factor*32);
        for(let i=0;i<6;i++)E.step(s,.05);
        close(before-enemy.hp,HERO[id].damage*factor*32);
      }else close(before-enemy.hp,HERO[id].damage*factor*10);
    }
  }
});

test('ordinary moves retain birth age while same-hero and both Rumi merge directions create a fresh age',()=>{
  for(const id of ['star_boy','galaxy_whale']){
    const moved=traitArena([{hero:id,index:12,birthWave:1,born:2}],{wave:5});
    moved.time=40;const old=moved.board[12],power=E.power(moved,old);
    assert.ok(E.move(moved,12,13).ok);assert.equal(moved.board[13],old);
    assert.equal(old.birthWave,1);assert.equal(old.born,2);close(E.power(moved,old),power);
    for(const [fromHero,toHero] of [[id,id],[id,'rumi'],['rumi',id]]){
      const s=traitArena([{hero:fromHero,index:0,rank:2,birthWave:1},{hero:toHero,index:1,rank:2,birthWave:1}],{wave:5});
      s.time=40;const oldIds=s.board.filter(Boolean).map(u=>u.uid);
      const result=E.move(s,0,1);assert.ok(result.ok&&result.merged);
      const u=s.board[1];assert.equal(u.hero,id);assert.equal(u.rank,3);
      assert.equal(u.birthWave,5);assert.equal(u.born,40);assert.ok(!oldIds.includes(u.uid));
      close(E.personalTrait(s,u).damageMultiplier,id==='star_boy'?1.5:.75);
      const restored=E.restore(E.serialize(s));assert.ok(restored);assert.equal(restored.board[1].birthWave,5);
    }
  }
});

test('arrival rewards enter the next actual combat wave with fresh Star Boy and Whale bonuses',()=>{
  for(const [hero,factor] of [['star_boy',1.5],['galaxy_whale',.75]]){
    const s=traitArena([{hero,index:0,birthWave:1}],{wave:3}),old=s.board[0];
    s.queue=[];E.step(s,.001);assert.equal(s.phase,'reward');
    s.reward=['arrival','purse','mend'];s.rng=1;
    assert.ok(E.chooseReward(s,'arrival').ok);assert.equal(s.phase,'intermission');
    const newcomer=s.board.find(u=>u&&u.uid!==old.uid);
    assert.equal(newcomer.hero,hero);assert.equal(newcomer.rank,2);
    assert.equal(newcomer.birthWave,4);assert.equal(old.birthWave,1);
    const restored=E.restore(E.serialize(s));assert.ok(restored,'next-wave arrival checkpoint restores');
    assert.equal(E.serialize(restored),E.serialize(s));
    for(let i=0;i<32&&s.phase==='intermission';i++){E.step(s,.05);E.step(restored,.05);}
    assert.equal(s.phase,'combat');assert.equal(s.wave,4);
    assert.equal(E.personalTrait(s,newcomer).age,0);close(E.personalTrait(s,newcomer).damageMultiplier,factor);
    assert.equal(E.serialize(restored),E.serialize(s));
    enemiesFor(s,[{progress:1200}]);const shot=launchNormal(s,newcomer);
    close(shot.damage,HERO[hero].damage*2.35*factor,'arrival first-wave normal attack');
  }
});

test('intermission summons and merges retain a next-wave birth through save and the first combat transition',()=>{
  for(const [hero,factor] of [['star_boy',1.5],['galaxy_whale',.75]]){
    const s=traitArena([{hero,index:0,birthWave:1}],{wave:3});s.phase='intermission';s.breakTime=.1;s.rng=1;
    const summoned=E.summon(s,12);assert.ok(summoned.ok);assert.equal(summoned.hero,hero);
    assert.equal(s.board[12].birthWave,4);assert.ok(E.restore(E.serialize(s)),'intermission summon checkpoint restores');
    const merged=E.move(s,0,12);assert.ok(merged.ok&&merged.merged);
    const u=s.board[12];assert.equal(u.rank,2);assert.equal(u.birthWave,4);
    const restored=E.restore(E.serialize(s));assert.ok(restored,'intermission merge checkpoint restores');
    assert.equal(restored.board[12].birthWave,4);
    for(let i=0;i<4&&s.phase==='intermission';i++){E.step(s,.05);E.step(restored,.05);}
    assert.equal(s.phase,'combat');assert.equal(s.wave,4);assert.equal(E.personalTrait(s,u).age,0);
    close(E.power(s,u),HERO[hero].damage*2.35*factor);assert.equal(E.serialize(restored),E.serialize(s));
    enemiesFor(s,[{progress:1200}]);const shot=launchNormal(s,u);
    close(shot.damage,HERO[hero].damage*2.35*factor,'intermission merge first-wave normal attack');
  }
});

test('restore permits exactly the pending next birth only in reward or intermission and rejects future combat births',()=>{
  for(const phase of ['reward','intermission','combat','victory','defeat']){
    const s=traitArena([{hero:'star_boy',index:12}],{wave:3});s.phase=phase;
    if(phase==='reward')s.reward=['arrival','purse','mend'];
    const pending=JSON.parse(E.serialize(s));pending.board[12].birthWave=4;
    const allowed=phase==='reward'||phase==='intermission',restored=E.restore(pending);
    assert.equal(Boolean(restored),allowed,phase+' next-wave birth validation');
    if(allowed){assert.equal(restored.board[12].birthWave,4);assert.ok(E.restore(E.serialize(restored)));}
    for(const invalidBirth of [5,0,3.5]){
      const invalid=JSON.parse(E.serialize(s));invalid.board[12].birthWave=invalidBirth;
      assert.equal(E.restore(invalid),null,phase+' invalid birth '+invalidBirth);
    }
  }
});

test('Doom refunds once in either Rumi merge direction and the ordinary alchemy merge hit still resolves',()=>{
  for(const [fromHero,toHero] of [['doom','rumi'],['rumi','doom'],['doom','doom']]){
    const s=traitArena([{hero:fromHero,index:0,rank:2},{hero:toHero,index:1,rank:2}],{artifacts:['alchemy']});
    const [enemy]=enemiesFor(s,[{progress:1200}]);s.gold=100;s.gauge=30;s.upgrades.doom=2;
    const before=enemy.hp,refund=E.doomRefund(2,2),result=E.move(s,0,1);
    assert.ok(result.ok&&result.merged);assert.equal(result.refund,refund);assert.equal(s.gold,100+refund);
    assert.equal(s.stats.income['합성 환급'],refund);assert.equal(s.stats.merges,1);assert.equal(s.gauge,42);
    assert.equal(s.board[1].hero,'doom');assert.equal(s.board[1].rank,3);
    close(before-enemy.hp,E.power(s,s.board[1])*1.5,'alchemy hit survives Doom refund');
    close(s.stats.byHero.doom,before-enemy.hp);
  }
});

test('Mushroom merges keep poison, seed and alchemy effects in either Rumi direction and reset harvest time',()=>{
  for(const [fromHero,toHero] of [['mushroom_king','rumi'],['rumi','mushroom_king'],['mushroom_king','mushroom_king']]){
    const s=traitArena([{hero:fromHero,index:0},{hero:toHero,index:1}],{artifacts:['alchemy','seed']});
    const enemies=enemiesFor(s,[{progress:100},{progress:1200}]);
    for(const u of s.board)if(u)u.harvest=.2;
    const before=enemies.map(e=>e.hp),gold=s.gold,result=E.move(s,0,1);
    assert.ok(result.ok&&result.merged);assert.equal(result.refund,0);assert.equal(s.gold,gold);
    assert.equal(s.board[1].hero,'mushroom_king');assert.equal(s.board[1].harvest,12);
    for(const [i,e] of enemies.entries()){
      assert.equal(e.poison,5);assert.equal(e.poisonTime,8);
      close(before[i]-e.hp,E.power(s,s.board[1])*1.5,'alchemy hit accompanies poison');
    }
    const restored=E.restore(E.serialize(s));assert.ok(restored);assert.equal(restored.enemies[0].poison,5);
  }
});

test('Aurora base damage is reduced once and only an even count of at least two gains 50%',()=>{
  close(HERO.aurora.damage,14*.85,'Aurora authored base damage');
  for(const count of [1,2,3,4,5]){
    const s=traitArena([12,0,4,20,24].slice(0,count).map(index=>({hero:'aurora',index})));
    const multiplier=count>=2&&count%2===0?1.5:1;
    for(const u of s.board.filter(Boolean)){
      close(E.personalTrait(s,u).damageMultiplier,multiplier);
      close(E.power(s,u),14*.85*multiplier);
      close(E.combatStats(s,u).damage,14*.85*multiplier);
    }
  }
});

test('Aurora counts only Auroras when other companions change the whole-board parity',()=>{
  for(const count of [1,2,3,4]){
    const placements=[12,0,4,20].slice(0,count).map(index=>({hero:'aurora',index}));
    const s=traitArena([...placements,{hero:'night_rabbit',index:24}]);
    const [enemy]=enemiesFor(s,[{progress:1200}]),multiplier=count%2===0?1.5:1;
    assert.equal(s.board.filter(Boolean).length,count+1);
    for(const u of s.board.filter(u=>u?.hero==='aurora')){
      assert.equal(E.personalTrait(s,u).count,count);
      close(E.personalTrait(s,u).damageMultiplier,multiplier);
    }
    const shot=launchNormal(s,s.board[12]),hp=enemy.hp;resolveNormal(s,shot);
    close(hp-enemy.hp,14*.85*multiplier,'mixed-board Aurora normal hit');
  }
});

test('overlapping mirrors from different cast sources never record each other but keep recording ordinary resolved hits',()=>{
  const s=traitArena([{hero:'aurora',index:0},{hero:'aurora',index:1},{hero:'star_boy',index:12}]);
  const [enemy]=enemiesFor(s,[{progress:1200,shield:10}]);
  s.gauge=120;assert.ok(E.cast(s,'aurora').ok);const first=s.finishers[0];
  assert.ok(E.move(s,0,1).merged);s.gauge=120;assert.ok(E.cast(s,'aurora').ok);const second=s.finishers[1];
  assert.notEqual(first.source,second.source);
  const star=s.board[12],shot=launchNormal(s,star),hp=enemy.hp,shield=enemy.shield;
  resolveNormal(s,shot);
  const actual=hp-enemy.hp+shield-enemy.shield;
  close(actual,shot.damage);close(first.stored,actual);close(second.stored,actual);
  const saved=E.restore(E.serialize(s));assert.ok(saved);assert.deepEqual(saved.finishers,s.finishers);
  first.life=.001;E.step(s,.001);
  close(second.stored,actual,'another mirror explosion is excluded');
  const another=launchNormal(s,star),before=s.stats.damage;resolveNormal(s,another);
  close(second.stored,actual+s.stats.damage-before,'later ordinary attacks still record');
  const recorded=second.stored;second.life=.001;E.step(s,.001);
  const impacts=s.events.filter(e=>e.type==='finisherImpact'&&e.kind==='mirror');
  assert.equal(impacts.length,2);close(impacts[0].echoDamage,actual*.45);
  close(impacts[1].echoDamage,recorded*.45);
  assert.equal(s.finishers.length,0);
});

test('mirror recording keeps the full resolved damage without an echo ceiling and rejects tampered records',()=>{
  const s=traitArena([{hero:'aurora',index:0},{hero:'star_boy',index:12,rank:5}]);
  const [enemy]=enemiesFor(s,[{progress:1200,shield:50}]);s.gauge=120;assert.ok(E.cast(s,'aurora').ok);
  const mark=s.finishers[0],shot=launchNormal(s,s.board[12]),hp=enemy.hp,shield=enemy.shield;resolveNormal(s,shot);
  const actual=hp-enemy.hp+shield-enemy.shield;
  assert.equal(mark.cap,undefined);close(mark.stored,actual);assert.ok(actual>shot.damage*.45||actual>0);
  const restored=E.restore(E.serialize(s));assert.ok(restored);close(restored.finishers[0].stored,actual);
  for(const change of [{stored:-1},{cap:-1},{life:mark.total+.001}]){
    const bad=JSON.parse(E.serialize(s));Object.assign(bad.finishers[0],change);assert.equal(E.restore(bad),null);
  }
  for(let i=0;i<65;i++){E.step(s,.05);E.step(restored,.05);}
  assert.equal(E.serialize(restored),E.serialize(s));
  const impact=s.events.find(e=>e.type==='finisherImpact'&&e.kind==='mirror');assert.ok(impact);
  close(impact.echoDamage,actual*.45);
});

test('Storm rolls separately for each actual ordinary recipient including the off-axis gust chain',()=>{
  for(const [seed,which] of [[1,'primary'],[193,'chain'],[160,'neither']]){
    const probe={rng:seed},first=E.random(probe),second=E.random(probe);
    assert.equal(first<.01,which==='primary');assert.equal(second<.01,which==='chain');
    const s=traitArena([{hero:'storm_sage',index:12}]),enemies=enemiesFor(s,[{progress:1200},{progress:1280}]);
    const shot=launchNormal(s,s.board[12]),primary=enemies.find(e=>e.uid===shot.target),chain=enemies.find(e=>e!==primary);
    s.rng=seed;resolveNormal(s,shot);
    assert.equal(primary.hp<=0,which==='primary');assert.equal(chain.hp<=0,which==='chain');
    assert.equal(s.events.filter(e=>e.type==='instantKill').length,which==='neither'?0:1);
    assert.equal(s.events.filter(e=>e.type==='chain'&&e.hero==='storm_sage').length,1);
    assert.equal(s.stats.kills,which==='neither'?0:1);
  }
});

test('Storm rolls once per recipient when beam and gust overlap, then rolls afresh on a distinct attack',()=>{
  // Seed 229 fails its first two rolls, succeeds on the third, then fails the fourth.
  // A duplicate gust roll would therefore kill an enemy on the first attack.
  const probe={rng:229},rolls=[];for(let i=0;i<4;i++)rolls.push(E.random(probe));
  assert.deepEqual(rolls.map(roll=>roll<.01),[false,false,true,false]);
  const firstTwo={rng:229};E.random(firstTwo);E.random(firstTwo);
  const s=traitArena([{hero:'storm_sage',index:12}]),enemies=enemiesFor(s,[{progress:1200},{progress:1201}]);
  const first=launchNormal(s,s.board[12]),before=enemies.map(e=>e.hp);s.rng=229;resolveNormal(s,first);
  assert.equal(s.rng,firstTwo.rng,'two distinct recipients consume exactly two rolls');
  assert.equal(s.events.filter(e=>e.type==='instantKill').length,0);
  assert.equal(s.events.filter(e=>e.type==='hit'&&e.hero==='storm_sage').length,3,'beam and gust both really hit');
  close(before[0]-enemies[0].hp,first.damage*(1+.65));close(before[1]-enemies[1].hp,first.damage);
  const second=launchNormal(s,s.board[12]);resolveNormal(s,second);
  assert.equal(s.rng,probe.rng,'a new attack gives both recipients a fresh roll');
  assert.equal(enemies[0].hp<=0,true);assert.equal(enemies[1].hp>0,true);
  const kills=s.events.filter(e=>e.type==='instantKill');assert.equal(kills.length,1);assert.equal(kills[0].uid,enemies[0].uid);
});

test('Storm uses a strict 1% boundary and an instant kill accounts for shield and remaining health exactly once',()=>{
  for(const [seed,shouldKill] of [[4170010728,true],[171496769,false]]){
    const probe={rng:seed};assert.equal(E.random(probe)<.01,shouldKill);
    const s=traitArena([{hero:'storm_sage',index:12}]),[enemy]=enemiesFor(s,[{progress:1200,hp:1000,shield:50}]);
    const shot=launchNormal(s,s.board[12]),gold=s.gold;s.rng=seed;resolveNormal(s,shot);
    assert.equal(enemy.hp<=0,shouldKill);assert.equal(s.stats.kills,shouldKill?1:0);
    if(shouldKill){
      assert.equal(enemy.shield,0);close(s.stats.damage,1050);close(s.stats.byHero.storm_sage,1050);
      assert.equal(s.gold,gold+2);assert.equal(s.events.filter(e=>e.type==='instantKill').length,1);
    }else{close(s.stats.damage,shot.damage);assert.equal(s.gold,gold);}
  }
});

test('Storm instant kill never triggers on bosses, damage over time, ultimate attacks, echoes or a vanished target',()=>{
  {
    const s=traitArena([{hero:'storm_sage',index:12}]),[boss]=enemiesFor(s,[{kind:'boss',progress:1200}]);
    const shot=launchNormal(s,s.board[12]);s.rng=1;resolveNormal(s,shot);
    assert.ok(boss.hp>0);assert.equal(s.events.some(e=>e.type==='instantKill'),false);assert.equal(s.rng,1);
  }
  {
    const s=traitArena([{hero:'storm_sage',index:12}]),[enemy]=enemiesFor(s,[{progress:1200}]);
    enemy.statusEffects.push({type:'burn',source:'legacy:burn',owner:'storm_sage',amount:100,until:s.time+1});s.rng=1;E.step(s,.05);
    close(enemy.maxHp-enemy.hp,5);assert.equal(s.events.some(e=>e.type==='instantKill'),false);assert.equal(s.rng,1);
    s.gauge=120;assert.ok(E.cast(s,'storm_sage').ok);
    assert.ok(enemy.hp>0);assert.equal(s.events.some(e=>e.type==='instantKill'),false);assert.equal(s.rng,1);
  }
  {
    const s=traitArena([{hero:'storm_sage',index:12}]);enemiesFor(s,[{progress:1200}]);s.buffs.echo=8;s.buffTotals.echo=8;
    launchNormal(s,s.board[12]);const echo=s.shots.find(shot=>shot.proc===false);assert.ok(echo);
    s.shots=[echo];echo.life=.001;s.rng=1;assert.ok(E.restore(E.serialize(s)));E.step(s,.001);
    assert.ok(s.enemies[0].hp>0);assert.equal(s.events.some(e=>e.type==='instantKill'),false);assert.equal(s.rng,1);
  }
  {
    const s=traitArena([{hero:'storm_sage',index:12}]),[enemy]=enemiesFor(s,[{progress:1200}]);
    const shot=launchNormal(s,s.board[12]);enemy.hp=0;s.rng=1;resolveNormal(s,shot);
    assert.equal(s.events.some(e=>e.type==='instantKill'),false);assert.equal(s.rng,1);
  }
});

test('Flame fires at a seeded path point independently of enemy position, locks targeting and boosts only its ground zone by 30%',()=>{
  const locations=[];
  for(const [progress,artifacts] of [[0,[]],[1110,[]],[1110,['roots']]]){
    const s=traitArena([{hero:'flame_sage',index:0}],{artifacts}),[enemy]=enemiesFor(s,[{progress}]),u=s.board[0];
    assert.equal(E.targetingLocked('flame_sage'),true);const priority=u.priority;
    E.cycleTarget(s,0);assert.equal(u.priority,priority);close(E.power(s,u),HERO.flame_sage.damage);
    s.rng=1;const shot=launchNormal(s,u);
    assert.equal(shot.ground,true);assert.equal(shot.target,null);locations.push(shot.to);
    assert.ok(distanceToPath(shot.to)<1,'flame zone lands on the path');
    assert.ok(shot.to.x>=E.GROUND_BOUNDS.left&&shot.to.x<=E.GROUND_BOUNDS.right);
    assert.ok(shot.to.y>=E.GROUND_BOUNDS.top&&shot.to.y<=E.GROUND_BOUNDS.bottom);
    assert.ok(E.restore(E.serialize(s)),'ground-target shot is resumable');
    const hp=enemy.hp;resolveNormal(s,shot);assert.equal(enemy.hp,hp,'landing does not invent a direct enemy hit');
    assert.equal(s.zones.length,1);const zone=s.zones[0];
    close(zone.x,shot.to.x);close(zone.y,shot.to.y);close(zone.damage,shot.damage*1.3);
    close(zone.radius,HERO.flame_sage.radius*1.3);
    close(zone.life,3*1.3*(artifacts.includes('roots')?1.5:1));close(zone.total,zone.life);
    const restored=E.restore(E.serialize(s));assert.ok(restored);assert.deepEqual(restored.zones,s.zones);
    if(progress===0){E.step(s,.001);close(hp-enemy.hp,zone.damage*.22,'boosted ground tick resolves against a nearby path enemy');}
  }
  assert.deepEqual(locations[0],locations[1]);assert.deepEqual(locations[1],locations[2]);
});

test('Mushroom fields add one poison stack per spore tick and skill detail uses the highest field rank',()=>{
  const s=traitArena([{hero:'mushroom_king',index:0,rank:1},{hero:'mushroom_king',index:12,rank:5},{hero:'aurora',index:4,rank:2},{hero:'aurora',index:5,rank:4}]);
  const [enemy]=enemiesFor(s,[{progress:1200}]);
  landZone(s,s.board[12],enemy);
  enemy.statusEffects=enemy.statusEffects.filter(effect=>effect.type!=='poison');E.statusState(s,enemy);
  E.step(s,.001);
  assert.equal(enemy.statusEffects.find(effect=>effect.source.startsWith('zone:')).amount,1);
  const preview=E.castPreview(s,'aurora');
  assert.equal(preview.rank,4);
  assert.match(preview.lines[0],/4성/);
  assert.match(preview.lines.join('\n'),/상한은 없습니다/);
});

test('Time Ruler keeps its highest-rank incumbent when a merge creates a tie or either tied unit moves',()=>{
  const s=traitArena([{hero:'time_ruler',index:0,rank:3},{hero:'time_ruler',index:1,rank:2},{hero:'time_ruler',index:2,rank:2}]);
  const winner=rulerWinner(s);assert.equal(winner.uid,s.board[0].uid);
  assert.ok(E.move(s,1,2).merged);assert.equal(s.board[2].rank,3);assert.equal(rulerWinner(s).uid,winner.uid);
  assert.ok(E.move(s,0,24).ok);assert.equal(rulerWinner(s).uid,winner.uid);
  assert.ok(E.move(s,2,23).ok);assert.equal(rulerWinner(s).uid,winner.uid);
  const restored=E.restore(E.serialize(s));assert.ok(restored);assert.equal(rulerWinner(restored).uid,winner.uid);
  for(let i=0;i<5;i++){E.step(s,.05);E.step(restored,.05);}
  assert.equal(E.serialize(restored),E.serialize(s));
});

test('Time Ruler hands off after its current winner is merged or sold and serialized ties resume deterministically',()=>{
  for(const seed of [1,193,1234]){
    const s=traitArena([{hero:'time_ruler',index:0,rank:3},{hero:'time_ruler',index:1,rank:3},{hero:'time_ruler',index:2,rank:2},{hero:'star_boy',index:12}],{seed});
    const winner=rulerWinner(s),from=s.board.indexOf(winner),to=from===0?1:0;
    const restored=E.restore(E.serialize(s));assert.ok(restored);assert.equal(rulerWinner(restored).uid,winner.uid);
    assert.ok(E.move(s,from,to).merged);const merged=s.board[to];
    assert.equal(merged.rank,4);assert.notEqual(merged.uid,winner.uid);assert.equal(rulerWinner(s).uid,merged.uid);
    assert.ok(E.sell(s,to).ok);assert.equal(rulerWinner(s).uid,s.board[2].uid);
    const after=E.restore(E.serialize(s));assert.ok(after);assert.equal(rulerWinner(after).uid,s.board[2].uid);
  }
});

test('Zeke gains 40% haste exactly when a living enemy reaches the last quarter of the path',()=>{
  const s=traitArena([{hero:'zeke',index:12}]),[enemy]=enemiesFor(s,[{progress:E.PATH_LENGTH*.75-1e-6}]),u=s.board[12];
  close(E.personalTrait(s,u).speedBonus,0);close(E.combatStats(s,u).cooldown,HERO.zeke.interval);
  enemy.progress=E.PATH_LENGTH*.75;
  close(E.personalTrait(s,u).speedBonus,.4);close(E.combatStats(s,u).cooldown,HERO.zeke.interval/1.4);
  close(E.combatStats(s,u).interval,HERO.zeke.interval/1.4+E.ATTACK_WINDUP);
  enemy.hp=0;close(E.personalTrait(s,u).speedBonus,0);
});

test('Zeke ultimate deals five times power and doubles only below ten health',()=>{
  for(const [health,factor] of [[20,5],[10,5],[9.999,10],[9,10]]){
    const s=traitArena([{hero:'zeke',index:12}]),enemies=enemiesFor(s,[{progress:100},{progress:1200}]);
    s.health=health;s.gauge=120;const before=enemies.map(e=>e.hp);assert.ok(E.cast(s,'zeke').ok);
    for(const [i,e] of enemies.entries())close(before[i]-e.hp,E.power(s,s.board[12])*factor,'Zeke health '+health);
    close(s.stats.damage,E.power(s,s.board[12])*factor*enemies.length);
  }
});

test('Detective ultimate resolves its own hit with only the old exposure before installing its stronger debuff',()=>{
  for(const previousExposure of [0,.18]){
    const s=traitArena([{hero:'great_detective',index:12}]),enemies=enemiesFor(s,[{progress:1200},{kind:'boss',progress:1280}]);
    for(const e of enemies)if(previousExposure)e.statusEffects.push({type:'exposure',source:'legacy:exposure',owner:null,amount:previousExposure,until:s.time+4});
    s.gauge=120;const before=enemies.map(e=>e.hp);assert.ok(E.cast(s,'great_detective').ok);
    for(const [i,e] of enemies.entries()){
      close(before[i]-e.hp,HERO.great_detective.damage*3*(1+previousExposure)*(e.boss?1.25:1));
      close(e.exposed,.6);assert.equal(e.exposeTime,10);
    }
    const shot=launchNormal(s,s.board[12]),target=enemies.find(e=>e.uid===shot.target),hp=target.hp;
    resolveNormal(s,shot);close(hp-target.hp,shot.damage*(1+.6)*(target.boss?1.25:1));
    close(target.exposed,.6);
  }
});

test('Doom ultimate atomically spends 25 gold for ten-times damage and leaves every state field untouched on insufficient funds',()=>{
  for(const [gold,gauge] of [[24,120],[25,HERO.doom.skill.cost-.01]]){
    const s=traitArena([{hero:'doom',index:12}]);enemiesFor(s,[{progress:1200}]);s.gold=gold;s.gauge=gauge;
    const before=E.serialize(s),events=structuredClone(s.events);assert.equal(E.cast(s,'doom').ok,false);
    assert.equal(E.serialize(s),before);assert.deepEqual(s.events,events);
  }
  const s=traitArena([{hero:'doom',index:12}]),enemies=enemiesFor(s,[{progress:100},{kind:'boss',progress:1200}]);
  s.gold=25;s.gauge=120;const before=enemies.map(e=>e.hp);assert.ok(E.cast(s,'doom').ok);
  assert.equal(s.gold,0);assert.equal(s.gauge,120-HERO.doom.skill.cost);assert.equal(s.stats.skills,1);
  assert.equal(s.stats.income['필살기'],undefined);
  for(const [i,e] of enemies.entries())close(before[i]-e.hp,E.power(s,s.board[12])*10);
  close(s.stats.damage,E.power(s,s.board[12])*10*enemies.length);
});

test('autoPlay skips unaffordable Doom and still casts another ready ultimate against a boss',()=>{
  const s=traitArena([{hero:'doom',index:0},{hero:'star_boy',index:12}]);
  const [boss]=enemiesFor(s,[{kind:'boss',progress:1200}]);
  s.gold=24;s.gauge=120;s.freeSummons=0;s.paidSummons=100;
  assert.equal(s.deck[0],'doom');assert.ok(E.summonCost(s)>s.gold);
  assert.equal(E.skillGoldCost('doom'),25);assert.equal(E.skillGoldCost('star_boy'),0);
  const hp=boss.hp;autoPlay(s);
  assert.equal(s.stats.skills,1);assert.equal(s.gold,24);
  assert.equal(s.gauge,120-HERO.star_boy.skill.cost);
  assert.equal(s.paidSummons,100);assert.equal(s.stats.merges,0);assert.equal(s.board.filter(Boolean).length,2);
  assert.equal(s.finishers.length,1);assert.equal(s.finishers[0].source,s.board[12].uid);
  for(let i=0;i<6;i++)E.step(s,.05);
  close(hp-boss.hp,E.power(s,s.board[12])*32);assert.equal(s.stats.byHero.doom,undefined);
});

test('poison uses one 40-stack cap and an ordinary shot or overlapping field cannot truncate the ultimate contribution',()=>{
  const s=traitArena([{hero:'mushroom_king',index:12,rank:3}]),[e]=enemiesFor(s,[{}]),u=s.board[12],base=E.power(s,u);
  e.statusEffects.push({type:'poison',source:'legacy:poison',owner:'mushroom_king',amount:40,power:base,until:s.time+7});
  E.statusState(s,e);assert.equal(e.poison,40);const castAt=s.time;readyCast(s,'mushroom_king');
  const ultimate=e.statusEffects.find(effect=>effect.type==='poison'&&effect.source.startsWith('skill:'));
  assert.equal(e.poison,40);assert.equal(ultimate.amount,24);close(ultimate.until,castAt+12);close(e.poisonTime,12);
  landZone(s,u,e);assert.equal(e.poison,40);close(ultimate.until,castAt+12);
  E.step(s,.05);assert.equal(e.poison,40);close(ultimate.until,castAt+12);
  quiet(s);const restored=E.restore(E.serialize(s));assert.ok(restored);
  advanceTo(s,castAt+11);advanceTo(restored,castAt+11);
  assert.equal(e.poison,24);close(e.poisonTime,1);assert.equal(E.serialize(restored),E.serialize(s));
  advanceTo(s,castAt+12);assert.equal(e.poison,0);assert.equal(e.poisonTime,0);
});

test('Phantom poisons all live enemies without requiring Mushroom and snapshots its own rank, growth and training power once',()=>{
  const s=traitArena([{hero:'phantom',index:12,rank:2}]),enemies=enemiesFor(s,[{},{kind:'armor'},{kind:'boss'}]),u=s.board[12];
  assert.equal(s.deck.includes('mushroom_king'),false);
  s.meta.phantom={power:2,special:1};s.relicAttack=.1;s.globalAttack=.06;s.upgrades.phantom=2;
  const base=E.power(s,u);readyCast(s,'phantom');
  for(const e of enemies){assert.equal(e.poison,8);close(e.poisonTime,12);const effect=e.statusEffects.find(effect=>effect.type==='poison');assert.equal(effect.owner,'phantom');close(effect.power,base);}
  quiet(s);const before=s.stats.byHero.phantom,restored=E.restore(E.serialize(s));assert.ok(restored);
  E.step(s,.05);E.step(restored,.05);
  close(s.stats.byHero.phantom-before,enemies.length*8*base*E.POISON_POWER_RATIO*.05*1.25,'Phantom pure poison DPS');
  assert.equal(s.stats.byHero.mushroom_king,undefined);assert.equal(E.serialize(restored),E.serialize(s));
});

test('shared poison attributes actual shield and HP damage to each caster while high-power stacks survive lower-power additions',()=>{
  const s=traitArena([{hero:'mushroom_king',index:0},{hero:'phantom',index:12}]),[e]=enemiesFor(s,[{shield:1000}]);
  readyCast(s,'mushroom_king');readyCast(s,'phantom');quiet(s);
  const old={...s.stats.byHero},shield=e.shield,hp=e.hp;
  E.step(s,.05);
  const mushroom=8*HERO.mushroom_king.damage*E.POISON_POWER_RATIO*.05*1.25,phantom=4*HERO.phantom.damage*E.POISON_POWER_RATIO*.05*1.25;
  close(s.stats.byHero.mushroom_king-old.mushroom_king,mushroom);close(s.stats.byHero.phantom-old.phantom,phantom);
  close(shield-e.shield,mushroom+phantom);assert.equal(e.hp,hp);
  e.statusEffects=e.statusEffects.filter(effect=>effect.type!=='poison');
  e.statusEffects.push({type:'poison',source:'legacy:poison',owner:'mushroom_king',amount:40,power:1000,until:s.time+10});
  E.statusState(s,e);readyCast(s,'phantom');assert.equal(e.poison,40);
  assert.equal(e.statusEffects.filter(effect=>effect.type==='poison').length,2,'suppressed weak poison retains its independent expiry');
  close(E.statusState(s,e).poisonDps,40*1000*E.POISON_POWER_RATIO);
  const strongUntil=e.statusEffects.find(effect=>effect.type==='poison'&&effect.power===1000).until;
  advanceTo(s,strongUntil);assert.equal(e.poison,4);close(E.statusState(s,e).poisonDps,4*HERO.phantom.damage*E.POISON_POWER_RATIO);
});

test('exposure independently expires from Detective ultimate to Phantom to Detective basic without borrowing a deadline',()=>{
  const s=traitArena([{hero:'great_detective',index:12},{hero:'phantom',index:0}]),[e]=enemiesFor(s,[{}]),start=s.time;
  readyCast(s,'great_detective');const strong=e.statusEffects.find(effect=>effect.type==='exposure');quiet(s);
  advanceTo(s,start+5);readyCast(s,'phantom');assert.equal(e.exposed,.6);close(strong.until,start+10);
  const phantom=e.statusEffects.find(effect=>effect.type==='exposure'&&effect.owner==='phantom');close(phantom.until,start+11);
  quiet(s);advanceTo(s,start+9.5);const shot=launchNormal(s,s.board[12]);resolveNormal(s,shot);
  const weak=e.statusEffects.find(effect=>effect.type==='exposure'&&effect.source.startsWith('attack:'));assert.ok(weak);close(strong.until,start+10);
  quiet(s);const restored=E.restore(E.serialize(s));assert.ok(restored);
  advanceTo(s,start+10);advanceTo(restored,start+10);close(e.exposed,.25);assert.equal(E.serialize(restored),E.serialize(s));
  advanceTo(s,start+11);close(e.exposed,.18);
  advanceTo(s,weak.until);assert.equal(e.exposed,0);assert.equal(e.exposeTime,0);
});

test('burn selects the strongest live owner, reveals a weaker live skill on expiry and cannot resurrect stale strong fire',()=>{
  const s=traitArena([{hero:'zeke',index:0,rank:3},{hero:'red_dragon',index:4},{hero:'flame_sage',index:12}]),[e]=enemiesFor(s,[{}]),start=s.time;
  const strong=E.power(s,s.board[0])*.6,weak=E.power(s,s.board[4])*.6;
  assert.ok(strong>weak);readyCast(s,'zeke');quiet(s);advanceTo(s,start+1);readyCast(s,'red_dragon');
  close(e.burn,strong);assert.equal(e.burnOwner,'zeke');quiet(s);
  const restored=E.restore(E.serialize(s));assert.ok(restored);
  advanceTo(s,start+5);advanceTo(restored,start+5);close(e.burn,weak);assert.equal(e.burnOwner,'red_dragon');assert.equal(E.serialize(restored),E.serialize(s));
  advanceTo(s,start+6);assert.equal(e.burn,0);assert.equal(e.burnOwner,null);
  const shot=landZone(s,s.board[12],e);E.step(s,.001);
  close(e.burn,shot.damage*1.3*.23);assert.equal(e.burnOwner,'flame_sage');assert.ok(e.burn<strong);
  assert.ok(e.statusEffects.filter(effect=>effect.type==='burn').every(effect=>effect.owner==='flame_sage'));
});

test('DOT integrates exact intra-frame expirations with additive taken damage and original owner accounting',()=>{
  const s=traitArena([{hero:'zeke',index:0},{hero:'flame_sage',index:4},{hero:'mushroom_king',index:12}]),[e]=enemiesFor(s,[{shield:5}]),start=s.time;
  e.statusEffects=[
    {type:'burn',source:`skill:zeke:${s.board[0].uid}`,owner:'zeke',amount:100,until:start+.025},
    {type:'burn',source:`skill:flame_sage:${s.board[4].uid}`,owner:'flame_sage',amount:20,until:start+.08},
    {type:'poison',source:`skill:mushroom_king:${s.board[12].uid}`,owner:'mushroom_king',amount:10,power:11,until:start+.03},
    {type:'exposure',source:'legacy:exposure',owner:null,amount:.6,until:start+.025},
    {type:'divine',source:'legacy:divine',owner:null,amount:3,until:start+.04},
  ];
  E.statusState(s,e);close(e.takenBonus,.66);const hp=e.hp;E.step(s,.05);
  const zeke=100*.025*1.66,flame=20*.015*1.06+20*.01,poison=30*.025*1.66+30*.005*1.06;
  close(s.stats.byHero.zeke,zeke);close(s.stats.byHero.flame_sage,flame);close(s.stats.byHero.mushroom_king,poison);
  close(s.stats.damage,zeke+flame+poison);assert.equal(e.shield,0);close(hp-e.hp,zeke+flame+poison-5);
  assert.equal(e.poison,0);assert.equal(e.exposed,0);assert.equal(e.divine,0);close(e.burn,20);assert.equal(e.burnOwner,'flame_sage');
  advanceTo(s,start+.08);assert.equal(e.burn,0);assert.equal(e.burnOwner,null);
});

test('freeze and stun keep separate latest deadlines and a shorter skill cannot shorten the actual stop or freeze bonus',()=>{
  const s=traitArena([{hero:'snow_rabbit',index:0},{hero:'lightning_sage',index:4},{hero:'avalanche_maid',index:12}]),[e]=enemiesFor(s,[{}]),start=s.time;
  e.speed=100;readyCast(s,'snow_rabbit');quiet(s);advanceTo(s,start+.5);readyCast(s,'lightning_sage');
  close(e.freeze,2.5);close(e.stun,1.2);close(e.controlTime,2.5);
  const before=s.stats.byHero.avalanche_maid||0;readyCast(s,'avalanche_maid');close((s.stats.byHero.avalanche_maid||0)-before,HERO.avalanche_maid.damage*12);
  const saved=E.restore(E.serialize(s));assert.ok(saved);const position=e.progress;
  advanceTo(s,start+1.7);advanceTo(saved,start+1.7);assert.equal(e.stun,0);close(e.freeze,1.3);assert.equal(e.progress,position);assert.equal(E.serialize(saved),E.serialize(s));
  advanceTo(s,start+3);assert.equal(e.freeze,0);assert.equal(e.controlTime,0);assert.equal(e.progress,position);
  E.step(s,.05);close(e.progress-position,2.5,'movement resumes for only the unfrozen frame');
});

test('divine is three independently timed stacks, adds 2% per stack to exposure and never duplicates a conditional bonus',()=>{
  const s=traitArena([{hero:'great_detective',index:0},{hero:'jasmine',index:4},{hero:'night_rabbit',index:12},{hero:'cherry_prince',index:24}]),[e]=enemiesFor(s,[{}]);
  readyCast(s,'great_detective');readyCast(s,'jasmine');const divine=e.statusEffects.find(effect=>effect.type==='divine'),until=divine.until;
  assert.equal(e.divine,3);close(divine.until-s.time,6);close(e.takenBonus,.66);
  const night=launchNormal(s,s.board[12]),beforeNight=s.stats.byHero.night_rabbit||0;resolveNormal(s,night);
  close(s.stats.byHero.night_rabbit-beforeNight,night.damage*1.66,'ally generic taken bonuses add rather than multiply');
  e.statusEffects.push({type:'burn',source:'legacy:burn',owner:'flame_sage',amount:1,until:s.time+1});
  const prince=launchNormal(s,s.board[24]),beforePrince=s.stats.byHero.cherry_prince||0;resolveNormal(s,prince);
  close(s.stats.byHero.cherry_prince-beforePrince,prince.damage*1.6*1.66,'burn OR three-divine conditional triggers once');
  const jasmine=launchNormal(s,s.board[4]),beforeJasmine=s.stats.byHero.jasmine;resolveNormal(s,jasmine);
  close(s.stats.byHero.jasmine-beforeJasmine,jasmine.damage*1.65*1.66,'Jasmine outgoing conditional stays separate');
  assert.equal(e.divine,3);assert.equal(divine.amount,2);const fresh=e.statusEffects.find(effect=>effect.type==='divine'&&effect!==divine);quiet(s);
  advanceTo(s,until);assert.equal(e.divine,1);close(e.takenBonus,.62);
  advanceTo(s,fresh.until);assert.equal(e.divine,0);close(e.takenBonus,.6);
  e.statusEffects.push({type:'exposure',source:'legacy:exposure',owner:null,amount:.79,until:s.time+1},{type:'divine',source:'legacy:divine',owner:null,amount:3,until:s.time+1});
  E.statusState(s,e);close(e.takenBonus,.8);
  const capped=launchNormal(s,s.board[12]),beforeCap=s.stats.byHero.night_rabbit;resolveNormal(s,capped);close(s.stats.byHero.night_rabbit-beforeCap,capped.damage*1.8);
});

test('frost buildup expires per application, shatters only on the third live stack and its short freeze preserves an existing long freeze',()=>{
  const s=traitArena([{hero:'frost_witch',index:12},{hero:'snow_rabbit',index:0}]),[e]=enemiesFor(s,[{}]),u=s.board[12];
  resolveNormal(s,launchNormal(s,u));assert.equal(e.frostStacks,1);const first=e.statusEffects.find(effect=>effect.type==='frost');quiet(s);
  advanceTo(s,first.until-.5);resolveNormal(s,launchNormal(s,u));assert.equal(e.frostStacks,2);quiet(s);
  advanceTo(s,first.until);assert.equal(e.frostStacks,1);resolveNormal(s,launchNormal(s,u));assert.equal(e.frostStacks,2);
  readyCast(s,'snow_rabbit');const long=e.statusEffects.find(effect=>effect.type==='freeze'),third=launchNormal(s,u),before=s.stats.byHero.frost_witch;
  resolveNormal(s,third);assert.equal(e.frostStacks,0);assert.equal(e.frostTime,0);assert.equal(s.events.filter(event=>event.type==='frostBreak').length,1);
  close(s.stats.byHero.frost_witch-before,third.damage*2.2);close(e.freeze,long.until-s.time);assert.equal(e.stun,0);assert.ok(E.restore(E.serialize(s)));
});

test('each ground hit creates an independently ticking field even for the same caster and preserves the earlier field power and lifetime',()=>{
  for(const hero of ['mushroom_king','flame_sage','phantom','time_ruler','galaxy_whale']){
    const s=traitArena([{hero,index:12}]),[e]=enemiesFor(s,[{}]),u=s.board[12];
    landZone(s,u,e);const first=s.zones[0],firstDamage=first.damage,firstUntil=s.time+first.life;
    s.upgrades[hero]=1;landZone(s,u,e);assert.equal(s.zones.length,2,hero);const second=s.zones[1];
    assert.equal(first.source,second.source);assert.notEqual(first.uid,second.uid);close(first.damage,firstDamage);close(first.life,firstUntil-s.time);assert.ok(second.damage>firstDamage);
    for(const zone of s.zones)zone.tick=0;u.disabled=100;
    const dps=e.burn+e.statusEffects.filter(effect=>effect.type==='poison').reduce((sum,effect)=>sum+effect.amount*effect.power*E.POISON_POWER_RATIO,0),hp=e.hp;
    E.step(s,.001);close(hp-e.hp,dps*.001+(first.damage+second.damage)*.22,hero+' two independent ground ticks');
    const restored=E.restore(E.serialize(s));assert.ok(restored);assert.deepEqual(restored.zones,s.zones);
    close(E.combatStats(s,u).cooldown,HERO[hero].interval*(hero==='flame_sage'?1:1.15));
  }
});

test('orbit fields also overlap independently and the 75-field quota deterministically removes the oldest field',()=>{
  {
    const s=traitArena([{hero:'mushroom_king',index:12,rank:3}],{artifacts:['orbit']}),[e]=enemiesFor(s,[{}]),u=s.board[12];
    landZone(s,u,e);landZone(s,u,e);assert.equal(s.zones.length,4);assert.equal(s.zones.filter(zone=>zone.orbit).length,2);
    assert.equal(new Set(s.zones.map(zone=>zone.uid)).size,4);assert.ok(E.restore(E.serialize(s)));
  }
  const s=traitArena([{hero:'mushroom_king',index:12}]),[e]=enemiesFor(s,[{}]),u=s.board[12],created=[];
  for(let i=0;i<76;i++){
    u.windup=.001;u.target=e.uid;u.cooldown=100;E.step(s,.001);
    const shot=s.shots.find(shot=>shot.source===u.uid);assert.ok(shot);resolveNormal(s,shot);created.push(s.zones.at(-1).uid);
  }
  assert.equal(s.zones.length,75);assert.equal(s.zones[0].uid,created[1]);assert.equal(s.zones.at(-1).uid,created.at(-1));
  assert.equal(s.zones.some(zone=>zone.uid===created[0]),false);assert.ok(E.restore(E.serialize(s)));
  const tooMany=JSON.parse(E.serialize(s));tooMany.zones.push({...tooMany.zones[0],uid:tooMany.nextId++});assert.equal(E.restore(tooMany),null);
});

test('Night Rabbit ultimate selects 9 plus two targets per distinct other rabbit species, excluding duplicate rabbits and unrelated allies',()=>{
  for(const [others,count] of [[[],9],[['snow_rabbit'],11],[['snow_rabbit','snow_rabbit','night_rabbit'],11],[['silver_rabbit'],11],[['snow_rabbit','silver_rabbit','siren'],13]]){
    const s=traitArena([{hero:'night_rabbit',index:12},...others.map((hero,index)=>({hero,index}))]),enemies=enemiesFor(s,Array.from({length:16},(_,i)=>({progress:900+i*10}))),before=enemies.map(e=>e.hp);
    assert.equal(E.nightRabbitTargetCount(s),count);readyCast(s,'night_rabbit');
    assert.equal(enemies.filter((e,index)=>e.hp<before[index]).length,count);
    assert.equal(s.events.findLast(event=>event.type==='skill').targets.length,count);
    for(let i=0;i<16;i++)close(before[i]-enemies[i].hp,i>=16-count?HERO.night_rabbit.damage*14:0,'furthest-progress flurry target '+i);
  }
});

test('legacy status migration preserves deadlines and old poison attribution once, clamps old excess to 40 and clears stale burn immediately',()=>{
  const s=traitArena([{hero:'phantom',index:12}]),[e]=enemiesFor(s,[{}]),raw=JSON.parse(E.serialize(s));delete raw.statusRevision;
  const old=raw.enemies[0];delete old.statusEffects;Object.assign(old,{poison:64,poisonTime:12,burn:100,burnTime:.025,burnOwner:'zeke',exposed:.6,exposeTime:10,stun:3,divine:3,divineTime:6,frostStacks:1,frostTime:6,slow:.5,slowTime:6,slowEffects:[{source:'attack:phantom',amount:.25,until:s.time+2},{source:'skill:phantom',amount:.5,until:s.time+6}]});
  const migrated=E.restore(raw);assert.ok(migrated);const now=migrated.enemies[0];assert.equal(migrated.statusRevision,1);assert.equal(now.poison,40);close(now.poisonTime,12);close(now.takenBonus,.66);
  assert.equal(now.statusEffects.find(effect=>effect.type==='poison').owner,'mushroom_king');assert.equal(now.burnOwner,'zeke');assert.equal(now.slowEffects.length,2);
  const again=E.restore(E.serialize(migrated));assert.ok(again);assert.equal(E.serialize(again),E.serialize(migrated));
  E.step(migrated,.05);E.step(again,.05);assert.equal(E.serialize(again),E.serialize(migrated));assert.equal(now.burn,0);assert.equal(now.burnOwner,null);assert.ok(migrated.stats.byHero.mushroom_king>0);
  const stale=structuredClone(raw);stale.enemies[0].burnTime=0;stale.enemies[0].burn=999;const cleared=E.restore(stale);assert.ok(cleared);assert.equal(cleared.enemies[0].burn,0);assert.equal(cleared.enemies[0].burnOwner,null);
});

test('restore rejects malformed status ownership, unknown revisions, uncapped stacks, impossible deadlines and invalid zone state',()=>{
  const s=traitArena([{hero:'mushroom_king',index:12},{hero:'phantom',index:0},{hero:'snow_rabbit',index:4},{hero:'jasmine',index:20}]);enemiesFor(s,[{}]);
  readyCast(s,'phantom');readyCast(s,'snow_rabbit');readyCast(s,'jasmine');landZone(s,s.board[12],s.enemies[0]);quiet(s);
  // Keep one real field to validate its complete save schema too.
  s.board[12].disabled=0;landZone(s,s.board[12],s.enemies[0]);s.board[12].disabled=100;assert.ok(E.restore(E.serialize(s)));
  const mutations=[
    bad=>{bad.statusRevision=2;},bad=>{delete bad.enemies[0].statusEffects;},bad=>{bad.enemies[0].statusEffects='bad';},
    bad=>{bad.enemies[0].statusEffects[0].type='unknown';},bad=>{bad.enemies[0].statusEffects[0].owner='not_a_hero';},
    bad=>{bad.enemies[0].statusEffects[0].source='skill:phantom:'+bad.nextId;},bad=>{bad.enemies[0].statusEffects[0].owner='siren';},
    bad=>{bad.enemies[0].statusEffects[0].until=-1;},bad=>{bad.enemies[0].statusEffects[0].until=bad.time+30.001;},
    bad=>{bad.enemies[0].statusEffects.push({...bad.enemies[0].statusEffects[0]});},
    bad=>{bad.enemies[0].statusEffects.find(effect=>effect.type==='poison').amount=41;},
    bad=>{bad.enemies[0].statusEffects.find(effect=>effect.type==='poison').amount=.5;},
    bad=>{bad.enemies[0].statusEffects.find(effect=>effect.type==='poison').power=0;},
    bad=>{bad.enemies[0].statusEffects.find(effect=>effect.type==='divine').amount=4;},
    bad=>{bad.enemies[0].statusEffects.find(effect=>effect.type==='freeze').amount=2;},
    bad=>{bad.enemies[0].slowEffects[0].amount=.81;},bad=>{bad.enemies[0].slowEffects[0].owner='doom';},
    bad=>{bad.enemies[0].slowEffects.push({...bad.enemies[0].slowEffects[0]});},
    bad=>{bad.zones[0].life=bad.zones[0].total+.01;},bad=>{bad.zones[0].radius=0;},bad=>{bad.zones[0].tick=.51;},bad=>{bad.zones[0].damage=-1;},bad=>{bad.zones[0].source=bad.nextId;},
  ];
  for(const mutate of mutations){const bad=JSON.parse(E.serialize(s));mutate(bad);assert.equal(E.restore(bad),null,mutate.toString());}
});

test('a stronger short poison cannot erase the remaining lifetime of a suppressed long ultimate poison',()=>{
  const s=traitArena([{hero:'mushroom_king',index:12,rank:5}]),[e]=enemiesFor(s,[{}]),u=s.board[12],start=s.time;
  readyCast(s,'mushroom_king');const ultimate=e.statusEffects.find(effect=>effect.type==='poison'),base=ultimate.power;
  assert.equal(ultimate.amount,40);s.upgrades.mushroom_king=5;
  for(let i=0;i<8;i++)resolveNormal(s,launchNormal(s,u));quiet(s);
  assert.equal(e.poison,40);assert.ok(E.statusState(s,e).poisonDps>40*base*E.POISON_POWER_RATIO);
  assert.equal(ultimate.amount,40);close(ultimate.until,start+12);
  const saved=E.restore(E.serialize(s));assert.ok(saved);
  advanceTo(s,start+11);advanceTo(saved,start+11);assert.equal(E.serialize(saved),E.serialize(s));
  assert.equal(e.poison,40);close(E.statusState(s,e).poisonDps,40*base*E.POISON_POWER_RATIO);
  advanceTo(s,start+12);assert.equal(e.poison,0);
});

test('an earlier Poseidon rush cannot delete a later enemy mid-frame DOT and freeze segment',()=>{
  const s=traitArena([{hero:'flame_sage',index:12}]);s.chapter=5;
  const [boss,e]=enemiesFor(s,[{kind:'boss',progress:50},{progress:100}]);quiet(s);
  assert.equal(boss.boss,'poseidon');boss.channel=.001;boss.channelHp=boss.hp;boss.skillIn=1000;
  s.telegraph={uid:boss.uid,pattern:'rush',text:'test',cells:[],ends:s.time+.001};e.speed=100;
  e.statusEffects=[{type:'burn',source:'legacy:burn',owner:'flame_sage',amount:100,until:s.time+.025},{type:'freeze',source:'legacy:freeze',owner:null,amount:1,until:s.time+.025}];
  const before=e.hp;E.step(s,.05);close(before-e.hp,2.5,'last partial burn segment');close(e.progress,232.5,'push plus only unfrozen movement');
  assert.equal(e.burn,0);assert.equal(e.freeze,0);assert.equal(s.events.filter(event=>event.type==='rush').length,1);
});
