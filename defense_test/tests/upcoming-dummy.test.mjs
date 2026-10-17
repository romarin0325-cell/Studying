import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {HERO,DEFAULT_DECK} from '../src/content.js';
import {smartAutoPlay,boardValue} from '../src/smart-auto.js';

function close(actual,expected,label='numeric contract'){
  assert.ok(Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),label+': '+actual+' != '+expected);
}
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
function resolveNormal(s,shot){shot.life=.001;E.step(s,.001);return shot;}
function quiet(s){for(const u of s.board)if(u){u.cooldown=100;u.windup=0;u.disabled=100;}s.shots=[];s.zones=[];}
function readyCast(s,id){s.gauge=120;assert.ok(E.cast(s,id).ok,id+' ultimate');}
function fireBoss(s,boss,pattern,cells){
  for(const u of s.board)if(u){u.cooldown=100;u.windup=0;u.disabled=0;}s.shots=[];s.zones=[];
  boss.channel=.001;boss.skillIn=99;
  s.telegraph={uid:boss.uid,pattern,text:'t',cells,ends:s.time+.001,total:3.5};
  E.step(s,.05);
}

test('joker colour cycle, shared state and per-colour basic hits',()=>{
  const s=traitArena([{hero:'joker',index:12},{hero:'joker',index:13}]),[e]=enemiesFor(s,[{}]);
  assert.equal(s.jokerColor,'red');
  const hitColor=(color)=>{
    s.jokerColor=color;e.statusEffects=[];e.slowEffects=[];E.statusState(s,e);
    const shot=launchNormal(s,s.board[12]);const before=e.hp;resolveNormal(s,shot);quiet(s);
    return {hp:before-e.hp,burn:e.burn,slow:e.slow,poison:e.poison,divine:e.divine,exposed:e.exposed};
  };
  const red=hitColor('red');close(red.burn,HERO.joker.damage*E.UPCOMING.joker.burn);assert.equal(red.slow,0);
  const blue=hitColor('blue');close(blue.slow,E.UPCOMING.joker.slowAmount);assert.equal(blue.burn,0);
  const green=hitColor('green');assert.equal(green.poison,1);close(green.poison?E.statusState(s,e).poisonDps:0,HERO.joker.damage*E.POISON_POWER_RATIO);
  const white=hitColor('white');assert.equal(white.divine,1);
  const black=hitColor('black');close(black.exposed,E.UPCOMING.joker.exposure);
  s.jokerColor='red';readyCast(s,'joker');assert.equal(s.jokerColor,'blue');
  readyCast(s,'joker');assert.equal(s.jokerColor,'green');
  readyCast(s,'joker');assert.equal(s.jokerColor,'white');
  readyCast(s,'joker');assert.equal(s.jokerColor,'black');
  readyCast(s,'joker');assert.equal(s.jokerColor,'red');
  e.statusEffects=[];e.slowEffects=[];E.statusState(s,e);
  const hp=e.hp;readyCast(s,'joker');close(hp-e.hp,HERO.joker.damage*E.UPCOMING.joker.roulette);
  assert.equal(s.jokerColor,'blue','both jokers share the colour');
  try{
    E.UPCOMING.joker.fixed='green';s.jokerColor='red';readyCast(s,'joker');assert.equal(s.jokerColor,'green');
    E.UPCOMING.joker.fixed=null;E.UPCOMING.joker.order='random';s.jokerColor='red';readyCast(s,'joker');
    assert.notEqual(s.jokerColor,'red');
  }finally{E.UPCOMING.joker.fixed=null;E.UPCOMING.joker.order='cycle';}
  assert.ok(E.castPreview(s,'joker'));
});

test('underdog bonus is all-C only and bigshow stuns the team',()=>{
  const all=traitArena([{hero:'underdog',index:12}]),u=all.board[12];
  assert.equal(all.deck.every(id=>HERO[id].rarity==='C'&&!HERO[id].hidden),true);
  close(E.personalTrait(all,u).damageMultiplier,1+E.UPCOMING.underdog.bonus);
  close(E.power(all,u),HERO.underdog.damage*(1+E.UPCOMING.underdog.bonus));
  const mixed=traitArena([{hero:'underdog',index:12},{hero:'luna',index:0}]);
  close(E.personalTrait(mixed,mixed.board[12]).damageMultiplier,1);
  const [e]=enemiesFor(all,[{}]);const hp=e.hp;readyCast(all,'underdog');
  close(hp-e.hp,E.combatStats(all,u).damage*E.UPCOMING.underdog.factor);
  assert.ok(all.board[12].disabled>=E.UPCOMING.underdog.stun-1e-9);
});

test('toffee bombs refuse at max 3, explode on approach, persist across a wave and stun the caster',()=>{
  const s=traitArena([{hero:'toffee_apple',index:12}]),[e]=enemiesFor(s,[{}]);quiet(s);
  s.gauge=1000;const gold=s.gold;
  for(let i=0;i<3;i++)assert.ok(E.cast(s,'toffee_apple').ok,'bomb '+i);
  assert.equal(s.bombs.length,3);assert.ok(s.board[12].disabled>=E.UPCOMING.toffee.stun-1e-9);
  const denied=E.cast(s,'toffee_apple');assert.equal(denied.ok,false);assert.equal(denied.reason,'폭탄이 가득 찼습니다.');
  assert.equal(s.gold,gold);assert.equal(s.bombs.length,3);
  for(const b of s.bombs)assert.ok(b.progress>=E.PATH_LENGTH*.12&&b.progress<=E.PATH_LENGTH*.9);
  const bomb=s.bombs[0],kept=s.bombs[1],hp=e.hp;s.bombs=[bomb];e.progress=bomb.progress-E.UPCOMING.toffee.trigger;e.speed=0;quiet(s);
  E.step(s,.05);assert.equal(s.events.some(ev=>ev.type==='bombBlast'&&ev.uid===bomb.uid),true);
  close(hp-e.hp,bomb.damage);assert.equal(s.bombs.length,0);
  s.bombs=[kept];s.enemies=[];s.queue=[];s.spawnIn=1e9;E.step(s,.05);
  assert.ok(['reward','victory'].includes(s.phase));assert.equal(s.bombs.length,1);assert.equal(s.bombs[0].uid,kept.uid);
  const restored=E.restore(E.serialize(s));assert.ok(restored);assert.equal(restored.bombs.length,1);
  assert.ok(E.castPreview(s,'toffee_apple'));
});

test('antropy requiem clears then hits, including bosses',()=>{
  const s=traitArena([{hero:'antropy',index:12}]),[e]=enemiesFor(s,[{kind:'boss'}]);
  e.statusEffects=[{type:'burn',source:'legacy:burn',owner:'flame_sage',amount:40,until:s.time+5},{type:'divine',source:'legacy:divine',owner:null,amount:1,until:s.time+6}];
  e.slowEffects=[{source:'legacy:slow',owner:null,amount:.4,until:s.time+4}];E.statusState(s,e);
  assert.ok(e.burn>0&&e.slow>0);const hp=e.hp;readyCast(s,'antropy');
  assert.equal(e.statusEffects.length,0);assert.equal(e.slowEffects.length,0);
  assert.equal(e.burn,0);assert.equal(e.poison,0);assert.equal(e.exposed,0);assert.equal(e.divine,0);assert.equal(e.slow,0);
  close(hp-e.hp,HERO.antropy.damage*E.UPCOMING.antropy.factor);
  assert.ok(E.immune(s,12));
});

test('ash removes the lowest-rank non-caster and respects immunity',()=>{
  const s=traitArena([{hero:'ash',index:12,rank:3},{hero:'star_boy',index:0,rank:1},{hero:'siren',index:1,rank:2}]),[e]=enemiesFor(s,[{}]);
  const uid0=s.board[0].uid,hp=e.hp;readyCast(s,'ash');
  assert.equal(s.board[0],null);assert.ok(s.board[12]);assert.ok(s.board[1]);assert.equal(s.stats.sacrificed,1);
  assert.ok(hp-e.hp>0);void uid0;
  const shielded=traitArena([{hero:'ash',index:12},{hero:'antropy',index:0}]);enemiesFor(shielded,[{}]);
  readyCast(shielded,'ash');assert.ok(shielded.board[0],'immune victim survives');assert.equal(!!shielded.stats.sacrificed,false);
  const aura=traitArena([{hero:'ash',index:12,rank:2},{hero:'star_boy',index:11,rank:1},{hero:'cure_master',index:10}]);enemiesFor(aura,[{}]);
  readyCast(aura,'ash');assert.ok(aura.board[11],'cure aura blocks the sacrifice');
});

test('cure master aura blocks storm/seal/stun1/thunder/curse/judgement and self-stuns; lemonade ticks invincible',()=>{
  const board=()=>traitArena([{hero:'cure_master',index:12},{hero:'star_boy',index:11},{hero:'siren',index:0}]);
  const far=s=>s.board[0],near=s=>s.board[11];
  {
    const s=board();s.chapter=0;const [boss]=enemiesFor(s,[{kind:'boss',progress:400}]);fireBoss(s,boss,'seal',[11,0]);
    assert.ok(!(near(s).disabled>0),'seal skipped on aura');assert.ok(far(s).disabled>0,'seal still hits a far unit');
  }
  {
    const s=board();s.chapter=4;s.gauge=80;const [boss]=enemiesFor(s,[{kind:'boss',progress:400}]);fireBoss(s,boss,'storm',[11,0]);
    assert.ok(!(near(s).disabled>0));assert.ok(far(s).disabled>0);assert.ok(s.gauge>74&&s.gauge<76.2,'storm drains only the non-immune cell');
  }
  {
    const s=board();s.chapter=1;const [boss]=enemiesFor(s,[{kind:'boss',progress:400}]);fireBoss(s,boss,'stun1',[11]);
    assert.ok(!(near(s).disabled>0));
  }
  {
    const s=board();s.chapter=4;const [boss]=enemiesFor(s,[{kind:'boss',progress:E.PATH_LENGTH*.6}]);fireBoss(s,boss,'thunder',[11,0]);
    assert.ok(!(near(s).disabled>0));assert.ok(far(s).disabled>0);
  }
  {
    const s=traitArena([{hero:'antropy',index:12},{hero:'antropy',index:11},{hero:'antropy',index:0}]);s.chapter=3;
    const [boss]=enemiesFor(s,[{kind:'boss',progress:400}]);boss.speed=0;boss.skillIn=0;E.step(s,.05);
    assert.equal(s.board.filter(u=>u?.cursed).length,0,'curse pool empty when everyone is immune');
  }
  {
    const s=board();s.chapter=8;const [boss]=enemiesFor(s,[{kind:'boss',progress:400}]);fireBoss(s,boss,'judgement',[11]);
    assert.ok(s.board[11]);const ev=s.events.findLast(e=>e.type==='judgement');assert.equal(ev.hit,false);
  }
  {
    const s=traitArena([{hero:'underdog',index:11},{hero:'cure_master',index:12}]);enemiesFor(s,[{}]);readyCast(s,'underdog');
    assert.ok(!(s.board[11].disabled>0),'aura blocks underdog self stun');assert.ok(s.board[12].disabled>0);
  }
  {
    const s=traitArena([{hero:'toffee_apple',index:11},{hero:'cure_master',index:12}]);enemiesFor(s,[{}]);readyCast(s,'toffee_apple');
    assert.ok(!(s.board[11].disabled>0),'aura blocks toffee self stun');
  }
  {
    const s=traitArena([{hero:'cure_master',index:12},{hero:'star_boy',index:11}]);enemiesFor(s,[{}]);
    s.board[11].disabled=5;s.board[11].cursed=true;readyCast(s,'cure_master');
    assert.equal(s.board[11].disabled,0);assert.equal(s.board[11].cursed,false);
    close(s.board[11].invincible,E.UPCOMING.cure.seconds);close(s.board[12].invincible,E.UPCOMING.cure.seconds);
    quiet(s);const left=s.board[11].invincible,until=s.time+1;
    for(let i=0;s.time<until-1e-9&&i<40;i++)E.step(s,Math.min(.05,until-s.time));
    close(s.board[11].invincible,left-1);
    assert.ok(E.immune(s,11));
  }
});

test('venom basic applies poison and burn; plague amps only burn/poison DOT',()=>{
  const s=traitArena([{hero:'venom',index:12}]),[e]=enemiesFor(s,[{hp:1e7}]);
  const shot=launchNormal(s,s.board[12]),before=e.hp;resolveNormal(s,shot);quiet(s);
  assert.equal(e.poison,1);close(e.burn,HERO.venom.damage*.23);close(before-e.hp,HERO.venom.damage);
  const hp=e.hp;E.step(s,.05);
  const tick=e.burn*.05+E.statusState(s,e).poisonDps*.05;close(hp-e.hp,tick,'unbuffed DOT');
  readyCast(s,'venom');
  assert.ok(s.buffs.venom>E.UPCOMING.venom.seconds-1e-6);assert.equal(e.poison,1+E.UPCOMING.venom.stacks);
  e.statusEffects=e.statusEffects.filter(x=>x.type==='burn'||x.type==='poison');
  e.statusEffects.push({type:'burn',source:'legacy:burn',owner:'venom',amount:100,until:s.time+3});
  E.statusState(s,e);quiet(s);const hp2=e.hp,dps=e.burn+E.statusState(s,e).poisonDps;E.step(s,.05);
  close(hp2-e.hp,dps*.05*(1+E.UPCOMING.venom.amp),'buffed DOT is doubled');
  const basic=traitArena([{hero:'star_boy',index:12}]),[f]=enemiesFor(basic,[{hp:1e7}]);
  basic.buffs.venom=10;const shot2=launchNormal(basic,basic.board[12]),pre=f.hp;resolveNormal(basic,shot2);
  close(pre-f.hp,HERO.star_boy.damage*1.5,'basic hits are not amped');
});

test('restore(serialize) keeps bombs, joker colour, invincible and the venom buff',()=>{
  const s=traitArena([{hero:'joker',index:12},{hero:'toffee_apple',index:11},{hero:'venom',index:0},{hero:'cure_master',index:1}]);
  enemiesFor(s,[{}]);s.jokerColor='black';s.bombs=[{uid:s.nextId++,progress:900,damage:123}];
  s.board[12].invincible=2.5;s.buffs.venom=8;s.stats.sacrificed=2;
  const restored=E.restore(E.serialize(s));assert.ok(restored);
  assert.equal(restored.jokerColor,'black');assert.equal(restored.bombs.length,1);close(restored.bombs[0].damage,123);
  close(restored.board[12].invincible,2.5);close(restored.buffs.venom,8);assert.equal(restored.stats.sacrificed,2);
  const round=E.restore(E.serialize(restored));assert.ok(round);assert.equal(E.serialize(round),E.serialize(restored));
  const missing=JSON.parse(E.serialize(s));delete missing.bombs;delete missing.jokerColor;
  const migrated=E.restore(missing);assert.ok(migrated);assert.deepEqual(migrated.bombs,[]);assert.equal(migrated.jokerColor,'red');
  for(const id of ['joker','underdog','toffee_apple','antropy','ash','cure_master','venom'])assert.ok(E.castPreview(traitArena([{hero:id,index:12}]),id));
});

test('smart auto does not crash with the new heroes on the board',()=>{
  const s=traitArena([{hero:'joker',index:12},{hero:'underdog',index:11},{hero:'ash',index:10},{hero:'venom',index:6},{hero:'cure_master',index:7}]);
  enemiesFor(s,[{progress:800},{progress:1400}]);s.gauge=120;s.gold=400;
  assert.ok(Number.isFinite(boardValue(s)));
  for(let i=0;i<8;i++)smartAutoPlay(s);
  assert.ok(s.phase==='combat'||s.phase==='reward'||s.phase==='victory');
});
