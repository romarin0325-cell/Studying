import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {DEFAULT_DECK,HERO} from '../src/content.js';
import {EXPANSION_IDS} from '../src/expansion-companions.js';

function close(actual,expected,label='numeric contract',epsilon=1e-8){
  assert.ok(Math.abs(actual-expected)<=epsilon*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
}

function arena(placements,{seed=1234,deck=null}={}){
  const ids=[...new Set(placements.map(p=>p.hero))];
  const chosen=deck||[...ids,...DEFAULT_DECK.filter(id=>!ids.includes(id))].slice(0,5);
  const s=E.newRun({deck:chosen,seed,crit:null}),template=s.board.find(Boolean);
  s.board.fill(null);s.events=[];s.queue=[{kind:'grunt',hp:1e9}];s.spawnIn=1e6;
  for(const p of placements)s.board[p.index]={
    ...template,uid:s.nextId++,hero:p.hero,rank:p.rank||1,birthWave:s.wave,born:0,
    cooldown:100,windup:0,target:null,attacks:p.attacks||0,harvest:12,disabled:0,
    stunWard:0,riposteAt:0,priority:E.targetingLocked(p.hero)?'random':HERO[p.hero].bossDamage||HERO[p.hero].bossPriority?'boss':'first',
  };
  return s;
}

function enemiesFor(s,specs){
  s.queue=specs.map(p=>({kind:p.kind||'grunt',hp:p.hp||1e6}));
  for(let i=0;i<specs.length;i++){s.spawnIn=0;E.step(s,.001);}
  for(const [i,e] of s.enemies.entries())Object.assign(e,{progress:specs[i].progress??1200,speed:0,skillIn:1e6,shield:0});
  s.queue=[{kind:'grunt',hp:1e9}];s.spawnIn=1e6;return s.enemies;
}

function launch(s,u){
  u.cooldown=0;u.windup=0;u.target=null;u.disabled=0;
  for(let i=0;i<8;i++){E.step(s,.05);const shot=s.shots.find(x=>x.source===u.uid&&x.proc!==false);if(shot){u.cooldown=100;return shot;}}
  assert.fail('no basic attack from '+u.hero);
}

function land(s,shot){shot.life=.001;E.step(s,.001);}
function addStatus(s,e,type,{amount=1,duration=8,power=20}={}){e.statusEffects.push({type,source:`test:${type}:${s.nextId++}`,owner:null,amount,until:s.time+duration,...(type==='poison'?{power}:{})});}
function addSlow(s,e,amount=.2,duration=8){e.slowEffects.push({source:`test:slow:${s.nextId++}`,owner:null,amount,until:s.time+duration});}

test('formation, resonance, same-rarity and solitude traits use the authored numbers',()=>{
  const s=arena([{hero:'victoria',index:12},{hero:'star_boy',index:14},{hero:'siren',index:2},{hero:'doom',index:6}]);
  const row=s.board[14],column=s.board[2],diagonal=s.board[6],self=s.board[12];
  const rowBase=E.power(s,row),columnBase=E.power(s,column),diagonalBase=E.power(s,diagonal);
  close(E.combatStats(s,row,14).damage,rowBase*1.12,'Victoria row power');
  close(E.combatStats(s,column,2).damage,columnBase*1.12,'Victoria column power');
  close(E.combatStats(s,diagonal,6).damage,diagonalBase,'Victoria excludes diagonals');
  close(E.combatStats(s,self,12).damage,E.power(s,self),'Victoria excludes herself');
  close(E.combatStats(s,row,14).cooldown,HERO.star_boy.interval/1.1,'Victoria command speed');

  const mad=arena([{hero:'mad_scientist',index:11},{hero:'star_boy',index:12},{hero:'siren',index:14}]);
  close(E.combatStats(mad,mad.board[12],12).damage,E.power(mad,mad.board[12])*1.15,'Scientist adjacent power');
  close(E.combatStats(mad,mad.board[12],12).cooldown,HERO.star_boy.interval/1.1,'Scientist adjacent speed');
  close(E.combatStats(mad,mad.board[14],14).damage,E.power(mad,mad.board[14]),'Scientist is cardinal only');

  const skull=arena([{hero:'skull_dragon',index:0}]),dragon=skull.board[0];
  close(E.personalTrait(skull,dragon,0).damageMultiplier,1.8);close(E.combatStats(skull,dragon,0).radius,HERO.skull_dragon.radius*1.25);
  skull.board[1]={...dragon,uid:skull.nextId++,hero:'star_boy'};close(E.personalTrait(skull,dragon,0).damageMultiplier,1);close(E.combatStats(skull,dragon,0).radius,HERO.skull_dragon.radius);

  const sr=['dainichi_nyorai','gumiho','archangel','sylphid','storm_sage'];
  const fox=arena([{hero:'gumiho',index:12}],{deck:sr});close(E.personalTrait(fox,fox.board[12],12).damageMultiplier,2);
  fox.deck[4]='star_boy';close(E.personalTrait(fox,fox.board[12],12).damageMultiplier,1);

  const sun=arena([{hero:'dainichi_nyorai',index:12}]);sun.buffs.haste=4;sun.buffs.awaken=4;close(E.personalTrait(sun,sun.board[12],12).damageMultiplier,1.16);
});

test('authored basic-attack counters keep the existing burn, divine, slow and exposure systems',()=>{
  const ancient=arena([{hero:'ancient_soul',index:12}]),[soulTarget]=enemiesFor(ancient,[{}]),soul=ancient.board[12];
  let shot=launch(ancient,soul),before=ancient.stats.byHero.ancient_soul||0;land(ancient,shot);close(ancient.stats.byHero.ancient_soul-before,shot.damage,'first soul hit',1e-4);assert.equal(soulTarget.burnTime>6.9,true);assert.equal(soulTarget.divine,1);
  shot=launch(ancient,soul);before=ancient.stats.byHero.ancient_soul;land(ancient,shot);close(ancient.stats.byHero.ancient_soul-before,shot.damage*1.4,'lit soul hit',1e-3);

  const sakura=arena([{hero:'sakura',index:12,attacks:3}]),[sealA,sealB,sealFar]=enemiesFor(sakura,[{progress:1200},{progress:1270},{progress:1450}]),sealShot=launch(sakura,sakura.board[12]);sealShot.target=sealA.uid;land(sakura,sealShot);
  for(const e of [sealA,sealB]){assert.equal(e.burnTime>6.9,true);assert.equal(e.divine,1);}assert.equal(sealFar.burnTime,0);assert.equal(sealFar.divine,0);

  const charm=arena([{hero:'succubus',index:12,attacks:3}]),[charmed]=enemiesFor(charm,[{progress:1200}]),progress=charmed.progress;land(charm,launch(charm,charm.board[12]));assert.ok(charmed.progress<progress);close(charmed.slow,.35);
  const book=arena([{hero:'silent_librarian',index:12,attacks:4}]),[reader]=enemiesFor(book,[{}]);land(book,launch(book,book.board[12]));assert.ok(reader.exposed>0);assert.ok(reader.exposeTime>6.9);
});

test('exposure descriptions and previews agree with real cast values and the cap',()=>{
  for(const [hero,base] of [['succubus',.15],['mad_scientist',.15],['silent_librarian',.1]])for(const [rank,special] of [[1,1],[3,1.5],[5,10]]){
    const s=arena([{hero,index:12,rank}]),[enemy]=enemiesFor(s,[{}]);
    s.meta[hero]={...s.meta[hero],special};s.gauge=120;
    const expected=Math.min(E.DAMAGE_TAKEN_CAP,base*special*E.rankControl(rank));
    const preview=E.castPreview(s,hero).lines.join(' ');
    assert.ok(preview.includes(`노출 ${Math.round(expected*100)}%`),`${hero} rank ${rank}: ${preview}`);
    assert.ok(E.cast(s,hero).ok);
    close(E.statusState(s,enemy).exposure,expected,`${hero} cast`);
    const token=E.scaledTokens(hero,special).skill.find(([source])=>source===`${base*100}%`);
    assert.deepEqual(token,[`${base*100}%`,`${Number((Math.min(E.DAMAGE_TAKEN_CAP,base*special)*100).toFixed(1))}%`]);
  }
  const book=arena([{hero:'silent_librarian',index:12,rank:5,attacks:4}]),[target]=enemiesFor(book,[{}]);
  book.meta.silent_librarian={...book.meta.silent_librarian,special:2};
  land(book,launch(book,book.board[12]));close(target.exposed,.1,'librarian basic exposure stays fixed');
});

test('conditional ultimates use live established statuses without consuming them',()=>{
  const soul=arena([{hero:'ancient_soul',index:12}]),[marked]=enemiesFor(soul,[{}]);addStatus(soul,marked,'burn',{amount:5});addStatus(soul,marked,'stun');soul.gauge=120;const base=E.combatStats(soul,soul.board[12]).damage,hp=marked.hp;assert.ok(E.cast(soul,'ancient_soul').ok);close(hp-marked.hp,base*5);assert.ok(marked.burnTime>0&&marked.stun>0);

  const deep=arena([{hero:'deep_lord',index:12}]),[plain,loaded]=enemiesFor(deep,[{progress:1100},{progress:1300}]);for(const type of ['divine','stun','freeze'])addStatus(deep,loaded,type);deep.gauge=120;const abyss=E.combatStats(deep,deep.board[12]).damage,plainHp=plain.hp,loadedHp=loaded.hp,progress=loaded.progress;assert.ok(E.cast(deep,'deep_lord').ok);close(plainHp-plain.hp,abyss*3);close(loadedHp-loaded.hp,abyss*9);assert.ok(loaded.progress<progress);assert.ok(loaded.stun>0);

  const fox=arena([{hero:'gumiho',index:12}]),foes=enemiesFor(fox,[0,1,2,3,4,5].map(i=>({progress:1000+i*15})));addStatus(fox,foes[5],'burn',{amount:5});addStatus(fox,foes[5],'divine');fox.gauge=120;const foxBase=E.combatStats(fox,fox.board[12]).damage,hps=foes.map(e=>e.hp);assert.ok(E.cast(fox,'gumiho').ok);close(hps[5]-foes[5].hp,foxBase*12);assert.equal(foes.filter((e,i)=>e.hp<hps[i]).length,5);assert.ok(foes[5].burnTime>0&&foes[5].divineTime>0);

  const sakura=arena([{hero:'sakura',index:12}]),[hot,cold]=enemiesFor(sakura,[{progress:1200},{progress:1250}]);addStatus(sakura,hot,'burn',{amount:5});addStatus(sakura,hot,'divine');sakura.gauge=120;assert.ok(E.cast(sakura,'sakura').ok);assert.ok(hot.stun>0);assert.equal(cold.stun,0);assert.ok(hot.burnTime>0&&hot.divineTime>0);
});

test('Archangel grants one-shot stun wards and accelerates adjacent recovery',()=>{
  const heaven=arena([{hero:'archangel',index:11},{hero:'star_boy',index:12}]);enemiesFor(heaven,[{}]);heaven.gauge=120;assert.ok(E.cast(heaven,'archangel').ok);
  const sanctuary=heaven.events.find(e=>e.type==='skill'&&e.hero==='archangel');assert.equal(sanctuary.support,false);assert.deepEqual(sanctuary.allies.map(p=>p.uid).sort(),heaven.board.filter(Boolean).map(u=>u.uid).sort());assert.ok(sanctuary.targets.every(p=>heaven.enemies.some(e=>e.uid===p.uid)));
  assert.equal(heaven.board[12].stunWard,1);assert.equal(heaven.board[12].stunWardSource,'archangel');const heavenSave=E.restore(E.serialize(heaven));assert.equal(heavenSave.board[12].stunWardSource,'archangel');E.stunUnit(heaven,12,2);assert.equal(heaven.events.at(-1).hero,'archangel');assert.equal(heaven.board[12].disabled,0);E.stunUnit(heaven,12,2);E.step(heaven,.05);close(heaven.board[12].disabled,1.925,'Archangel 50% recovery');
});

test('merge traits target their authored areas and Marshmallow leaves the seeded team blessing',()=>{
  const blessing=arena([{hero:'blessing_tail',index:0},{hero:'blessing_tail',index:1}]),[far,front,near]=enemiesFor(blessing,[{progress:50},{progress:300},{progress:360}]);assert.ok(E.move(blessing,0,1).merged);assert.equal(far.divine,0);assert.equal(front.divine,1);assert.equal(near.divine,1);assert.ok(front.divineTime>7.9);

  const marsh=arena([{hero:'marshmallow',index:0},{hero:'marshmallow',index:1}]);enemiesFor(marsh,[{}]);marsh.rng=1;assert.ok(E.move(marsh,0,1).merged);assert.ok(marsh.buffs.sunBless>7.9);

  const library=arena([{hero:'silent_librarian',index:0},{hero:'silent_librarian',index:1}]),[closeEnemy,farEnemy]=enemiesFor(library,[{progress:194},{progress:1000}]),closeHp=closeEnemy.hp,farHp=farEnemy.hp;assert.ok(E.move(library,0,1).merged);assert.ok(closeEnemy.hp<closeHp);assert.equal(farEnemy.hp,farHp);
});

test('Mimic skill loot bypasses the normal cap and Sylphid kills extend only the opening window',()=>{
  const mimic=arena([{hero:'mimic',index:12}]),targets=enemiesFor(mimic,[{progress:1200,hp:100},{progress:1220,hp:100}]);mimic.mimicGold=E.EXPANSION_RULES.mimic.goldCap;mimic.gauge=120;assert.ok(E.cast(mimic,'mimic').ok);assert.equal(targets.every(e=>e.hp<=0),true);assert.equal(mimic.stats.income['미믹 보물상자'],4);assert.equal(mimic.mimicGold,10);

  const wind=arena([{hero:'sylphid',index:12}]),[victim]=enemiesFor(wind,[{hp:1,progress:1200}]);const shot=launch(wind,wind.board[12]);land(wind,shot);assert.ok(victim.hp<=0);close(wind.sylphidExtension,.5);wind.waveTime=10.25;assert.equal(E.personalTrait(wind,wind.board[12],12).active,true);wind.waveTime=10.51;assert.equal(E.personalTrait(wind,wind.board[12],12).active,false);
});

test('Crystal Dancer deterministically ripostes one boss stun per ten seconds and the state restores',()=>{
  const s=arena([{hero:'crystal_dancer',index:12}]),[boss]=enemiesFor(s,[{kind:'boss',hp:1e6,progress:900}]),u=s.board[12];boss.boss='thor';const hp=boss.hp,hit=E.combatStats(s,u,12).damage*E.EXPANSION_RULES.crystalDancer.reflectFactor;
  assert.equal(E.stunUnit(s,12,2,{boss}),false);close(hp-boss.hp,hit);assert.equal(u.disabled,0);assert.ok(boss.stun>0);assert.equal(E.stunUnit(s,12,2,{boss}),true);assert.equal(u.disabled,2);assert.ok(E.restore(E.serialize(s)),'riposte cooldown and stun restore');
});

test('a cursed Crystal Dancer takes the boss stun without dodging or riposting',()=>{
  const s=arena([{hero:'crystal_dancer',index:12}]),[boss]=enemiesFor(s,[{kind:'boss',hp:1e6,progress:900}]),u=s.board[12];
  boss.boss='love_iris';u.cursed=true;const hp=boss.hp,damage=s.stats.damage;
  assert.equal(E.stunUnit(s,12,2,{boss}),true);assert.equal(u.disabled,2);assert.equal(u.riposteAt,0);
  assert.equal(boss.hp,hp);assert.equal(s.stats.damage,damage);assert.equal(boss.stun,0);assert.equal(s.events.some(e=>e.type==='crystalRiposte'),false);
  u.cursed=false;u.disabled=0;assert.equal(E.stunUnit(s,12,2,{boss}),false,'counter remains available after curse ends');
});

test('Heartbreaker extends the longest stun with boss and consecutive ultimate control rules',()=>{
  const normal=arena([{hero:'crystal_dancer',index:12}]),[grunt]=enemiesFor(normal,[{}]);
  addStatus(normal,grunt,'stun',{duration:2});addStatus(normal,grunt,'stun',{duration:4});E.statusState(normal,grunt);
  const before=grunt.statusEffects.filter(e=>e.type==='stun').map(e=>({...e}));normal.gauge=120;assert.ok(E.cast(normal,'crystal_dancer').ok);
  const after=grunt.statusEffects.filter(e=>e.type==='stun');close(after[0].until,before[0].until);close(after[1].until,before[1].until+1);assert.equal(after[1].source,before[1].source);assert.equal(after[1].owner,before[1].owner);

  const first=arena([{hero:'crystal_dancer',index:12}]),[boss]=enemiesFor(first,[{kind:'boss'}]);boss.boss='love_iris';
  addStatus(first,boss,'stun',{duration:2});boss.statusEffects[0].source='legacy:stun';E.statusState(first,boss);const oldUntil=boss.statusEffects[0].until;first.gauge=120;assert.ok(E.cast(first,'crystal_dancer').ok);
  close(boss.statusEffects[0].until,oldUntil+.5,'first ultimate extension on boss');close(boss.ccImmune,oldUntil+.5+E.BOSS_CONTROL_IMMUNITY);close(boss.ultControl,boss.ccImmune);assert.ok(E.restore(E.serialize(first)));

  const chained=arena([{hero:'guardian',index:11},{hero:'crystal_dancer',index:12}]),[target]=enemiesFor(chained,[{kind:'boss'}]);target.boss='love_iris';chained.gauge=120;assert.ok(E.cast(chained,'guardian').ok);close(target.stun,.75);
  const prior=target.statusEffects.find(e=>e.type==='stun'),source=prior.source,until=prior.until;chained.gauge=120;assert.ok(E.cast(chained,'crystal_dancer').ok);
  close(prior.until,until+.25,'chained ultimate extension on boss');close(target.stun,1);assert.equal(prior.source,source);close(target.ultControl,prior.until+E.BOSS_CONTROL_IMMUNITY);close(target.ccImmune,target.ultControl);assert.ok(E.restore(E.serialize(chained)));
});

test('Heartbreaker does not extend stun under an active boss stun-immunity aura',()=>{
  const s=arena([{hero:'crystal_dancer',index:12}]),[foe,protector]=enemiesFor(s,[{progress:1000},{kind:'boss',progress:1000}]);
  protector.boss='artificial_demon';addStatus(s,foe,'stun',{duration:4});E.statusState(s,foe);const until=foe.statusEffects[0].until;
  s.gauge=120;assert.ok(E.cast(s,'crystal_dancer').ok);close(foe.statusEffects[0].until,until);assert.equal(foe.ultControl,0);
});

test('repeated stun extensions remain restorable at the save deadline',()=>{
  for(const kind of ['grunt','boss']){
    const s=arena([{hero:'crystal_dancer',index:12}]),[foe]=enemiesFor(s,[{kind}]);if(kind==='boss')foe.boss='love_iris';
    addStatus(s,foe,'stun',{duration:kind==='boss'?27.9:29.9});foe.statusEffects[0].source='legacy:stun';E.statusState(s,foe);
    s.gauge=120;assert.ok(E.cast(s,'crystal_dancer').ok);
    close(foe.statusEffects[0].until,s.time+(kind==='boss'?28:30));if(kind==='boss'){close(foe.ultControl,s.time+30);close(foe.ccImmune,s.time+30);}
    s.gauge=120;assert.ok(E.cast(s,'crystal_dancer').ok);assert.ok(E.restore(E.serialize(s)),kind+' extended status restores');
  }
});

test('all sixteen skill previews are side-effect free and every cast produces a restorable run',()=>{
  for(const id of EXPANSION_IDS){
    const s=arena([{hero:id,index:12}]);enemiesFor(s,[{progress:1200,hp:1e9},{progress:1250,hp:1e9}]);s.gauge=120;
    const before=E.serialize(s),preview=E.castPreview(s,id);assert.ok(preview?.lines?.length,id+' preview');assert.equal(E.serialize(s),before,id+' preview mutation');
    assert.ok(E.cast(s,id).ok,id+' cast');assert.ok(E.restore(E.serialize(s)),id+' cast restore');
  }
});
