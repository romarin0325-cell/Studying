import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__GARDEN_PREVIEW__=true;
globalThis.__GARDEN_UNLOCKED__=true;

const {createProfile,command,validateProfile,parseProfile,ProfileStore,SAVE_KEY}=await import('../src/profile.js');
const E=await import('../src/combat/engine.js');
const {createBattle,resumeBattle}=await import('../src/battle.js');
const {HERO,HEROES,CHAPTERS,TIERS,TIER_IDS,BOSS_ORDER,CHALLENGE_WAVES,ARTIFACTS,DEFAULT_DECK,MAIN_STAGES}=await import('../src/content.js');
const {HOUR,calendar}=await import('../src/economy.js');
const {weeklyReward,monthlyReward}=await import('../src/monthly.js');
const {season}=await import('../src/preview/season.js');
const {oathScore,oathBosses,oathMods,OATH_BANDS,OATH_WAVES,oathState}=await import('../src/preview/oath.js');
const {twinBosses,twinBandReward,twinState,twinLocks,TWIN_WAVES,TWIN_STAGE,TWIN_SIDE}=await import('../src/preview/twin.js');
const {requestTracker,requestGoal,REQUEST,REQUEST_GAP_MIN,REQUEST_GAP_SPAN,REQUEST_MAX}=await import('../src/preview/requests.js');
const {FAVORITE}=await import('../src/bond.js');
const {REQUEST_REWARD:REQUEST_PAY,REQUEST_HEROES}=await import('../src/preview/requests-data.js');
const {testGrant,TEST_TOOLS}=await import('../src/test-unlock.js');

const NOW=Date.parse('2026-10-04T03:00:00Z');
const DAY=86400000;
const close=(a,b,m)=>{assert.ok(Math.abs(a-b)<1e-8,m||`${a} !~ ${b}`);};
const profile=()=>createProfile(NOW);
const ok=(p,action,args={},now=NOW)=>{const r=command(p,action,args,now);assert.equal(r.ok,true,r.message);return r;};
const enemyWeight={grunt:1,armor:3.5,runner:.65,wisp:.9,boss:32};
const enemyKind=(i,wave)=>i%7===6&&wave>=3?'armor':i%5===4&&wave>=2?'runner':i%9===8&&wave>=5?'wisp':'grunt';
function legacyWave(wave,chapter=0,mode='main',tier='easy'){
  if(mode==='monthly'){
    const {base}=E.challengeBase(wave,tier),hp=Math.round(base*30*(TIERS[tier]||TIERS.easy).monthly);
    return {sequence:[{kind:'boss',hp}],interval:.65,healthBudget:hp};
  }
  if(mode==='weekly'){
    const {base,oldWave}=E.challengeBase(wave,tier),oldCount=12+Math.round(oldWave)*2,count=Math.round(oldCount*Math.min(.9,.64+(oldWave/2-1)*.025));
    const sequence=Array.from({length:count},(_,i)=>{const kind=enemyKind(i,Math.ceil(oldWave/2));return {kind,hp:Math.round(base*enemyWeight[kind])};});
    const t=TIERS[tier]||TIERS.easy;
    if(wave%3===0)sequence.splice(Math.min(6,count),0,{kind:'boss',hp:Math.round(base*32*E.BOSS_HEALTH_SCALE*t.boss)});
    const k=(Math.min(wave,CHALLENGE_WAVES)-1)/(CHALLENGE_WAVES-1),grow=1+(t.weeklyLate||0)*Math.pow(k,6);
    if(grow!==1)for(const e of sequence)e.hp=Math.round(e.hp*grow);
    return {sequence,interval:Math.max(.46,1.05-(oldWave-1)*.06),healthBudget:sequence.reduce((n,e)=>n+e.hp,0)};
  }
  const oldWave=wave*2,base=E.WAVE_BASE_HEALTH*Math.pow(1.34,oldWave-1)*CHAPTERS[chapter].hp,oldCount=12+oldWave*2;
  const budget=Array.from({length:oldCount},(_,i)=>Math.round(base*enemyWeight[enemyKind(i,wave)])).reduce((a,b)=>a+b,0);
  const count=Math.round(oldCount*Math.min(.9,.64+(wave-1)*.025));
  const kinds=Array.from({length:count},(_,i)=>enemyKind(i,wave)),weight=kinds.reduce((sum,k)=>sum+enemyWeight[k],0);let assigned=0;
  const sequence=kinds.map((kind,i)=>{const hp=i===count-1?budget-assigned:Math.round(budget*enemyWeight[kind]/weight);assigned+=hp;return {kind,hp};});
  const bossHp=Math.round(Math.round(base*32)*E.BOSS_HEALTH_SCALE);
  if(wave===3||wave===6)sequence.splice(Math.min(6,count),0,{kind:'boss',hp:bossHp});
  return {sequence,interval:Math.max(.46,1.05-(oldWave-1)*.06),healthBudget:budget+(wave===3||wave===6?bossHp:0)};
}
const LEFT=['star_boy','snow_rabbit','night_rabbit','siren','great_detective'];
const RIGHT=['silver_rabbit','mushroom_king','underdog','joker','sunflower'];
const RELIC=ARTIFACTS.map(a=>a.id);
const partyOf=(left=LEFT,right=RIGHT,relicsL=RELIC.slice(0,2),relicsR=RELIC.slice(2,4))=>({left:{deck:left,relics:relicsL},right:{deck:right,relics:relicsR}});
function unit(proto,hero,uid){return {...proto,hero,uid,rank:1,cursed:false,disabled:0,invincible:0};}
function spawn(s,kind,hp,wave=s.wave){
  s.wave=wave;s.queue=[{kind,hp}];s.spawnIn=0;s.enemies=[];E.step(s,.05);return s.enemies[0];
}

test('a season is the Monday pair that contains this week, including weeks before 1970',()=>{
  const s=season(NOW),{weekNo}=calendar(NOW);
  assert.equal(s.index,Math.floor(weekNo/2));
  assert.equal(s.id,`S${s.index}`);
  assert.equal(s.start,Date.UTC(1970,0,5)+s.index*2*7*DAY-9*HOUR);
  assert.equal(s.end,s.start+14*DAY);
  assert.equal(s.daysLeft,Math.max(1,Math.ceil((s.end-NOW)/DAY)));
  assert.equal(season(s.start).id,s.id);
  assert.equal(season(s.end-1).id,s.id);
  assert.equal(season(s.end-1).daysLeft,1);
  assert.equal(season(s.end).index,s.index+1);
  let odd=null;
  for(let t=Date.UTC(1969,10,1);t<Date.UTC(1970,0,4);t+=DAY){const w=calendar(t).weekNo;if(w<0&&w%2){odd=t;break;}}
  assert.ok(odd);
  const w=calendar(odd).weekNo,even=Math.floor(w/2)*2;
  assert.equal(season(odd).index,Math.floor(w/2));
  assert.equal(season(odd).start,Date.UTC(1970,0,5)+even*7*DAY-9*HOUR);
  assert.notEqual(even,w-w%2);
});

test('oath and twin waves sample the challenge curve and leave main, weekly and monthly plans unchanged',()=>{
  for(const chapter of [0,8,44,89])for(let wave=1;wave<=6;wave++)assert.deepEqual(E.wavePlan(wave,chapter),legacyWave(wave,chapter));
  for(const mode of ['weekly','monthly'])for(const tier of TIER_IDS)for(let wave=1;wave<=18;wave++)assert.deepEqual(E.wavePlan(wave,0,mode,tier),legacyWave(wave,0,mode,tier));
  for(let wave=1;wave<=OATH_WAVES;wave++){
    const plan=E.wavePlan(wave,0,'oath','hard');
    assert.equal(plan.sequence.filter(e=>e.kind==='boss').length,wave%3===0?1:0);
    const cw=1+(wave-1)*11/8,{base,oldWave}=E.challengeBase(cw,'hard');
    const grunt=plan.sequence.find(e=>e.kind==='grunt');
    assert.equal(grunt.hp,Math.round(base*enemyWeight.grunt));
    assert.equal(plan.interval,Math.max(.46,1.05-(oldWave-1)*.06));
    if(wave%3===0)assert.equal(plan.sequence.find(e=>e.kind==='boss').hp,Math.round(base*32*E.BOSS_HEALTH_SCALE*TIERS.hard.boss));
  }
  assert.equal(1+(OATH_WAVES-1)*11/8,12);
  for(let wave=1;wave<=TWIN_WAVES;wave++){
    const plan=E.wavePlan(wave,0,'twin','abyss');
    assert.equal(plan.sequence.filter(e=>e.kind==='boss').length,wave%3===0?1:0);
    assert.deepEqual(plan,E.wavePlan(wave,TWIN_STAGE.abyss-1,'main'));
  }
  assert.equal(E.lastWave({mode:'oath'}),9);
  assert.equal(E.lastWave({mode:'twin'}),6);
  assert.equal(E.lastWave({mode:'main'}),6);
  assert.equal(E.lastWave({mode:'weekly'}),18);
  const oath=E.newRun({mode:'oath',seed:1});oath.wave=9;oath.queue=[];oath.enemies=[];oath.spawnIn=1e9;E.step(oath,.05);assert.equal(oath.phase,'victory');
  const twin=E.newRun({mode:'twin',seed:1});twin.wave=5;twin.queue=[];twin.enemies=[];twin.spawnIn=1e9;E.step(twin,.05);assert.equal(twin.phase,'reward');
  twin.phase='combat';twin.wave=6;twin.queue=[];twin.enemies=[];E.step(twin,.05);assert.equal(twin.phase,'victory');
});

test('each starlight oath changes only its own combat rule',()=>{
  const tough=E.newRun({oaths:['tough1','haste'],seed:1});
  const grunt=spawn(tough,'grunt',1000);
  assert.equal(grunt.hp,Math.round(1000*1.25));
  let speed=49;speed*=1.1;speed*=1.15;assert.equal(grunt.speed,speed);
  const heavier=E.newRun({oaths:['tough2','tyrant'],mode:'oath',lineup:['flora','thor','ares'],seed:2});
  const boss=spawn(heavier,'boss',1000,3);
  assert.equal(boss.boss,'flora');
  assert.equal(boss.maxHp,Math.round(1000*1.5*1.5));
  assert.equal(spawn(heavier,'boss',1000,6).boss,'thor');
  assert.equal(spawn(heavier,'boss',1000,9).boss,'ares');
  const fallback=E.newRun({mode:'oath',seed:3});
  assert.equal(spawn(fallback,'boss',100,3).boss,CHAPTERS[0].bosses[0]);
  const haste=E.newRun({oaths:['tyrant'],mode:'oath',lineup:['flora'],seed:4});
  const patterned=spawn(haste,'boss',1e12,3);patterned.speed=0;patterned.progress=0;patterned.skillIn=10;
  let expected=10;for(let i=0;i<20;i++)expected-=.05*(1/.7);
  for(let i=0;i<20;i++)E.step(haste,.05);
  close(patterned.skillIn,expected);
  assert.equal(oathMods(['tyrant']).bossHaste,1/.7);
  const calm=E.newRun({seed:4});const plain=spawn(calm,'boss',1e12,3);plain.speed=0;plain.skillIn=10;
  for(let i=0;i<20;i++)E.step(calm,.05);close(plain.skillIn,9);
  const heavy=E.newRun({oaths:['heavy'],deck:['joker',...DEFAULT_DECK.filter(id=>id!=='joker')].slice(0,5),seed:5});
  assert.equal(E.skillCost(heavy,'star_boy'),HERO.star_boy.skill.cost+20);
  heavy.jokerColor='chaos';heavy.jokerSeen=E.JOKER.all;assert.equal(E.skillCost(heavy,'joker'),E.JOKER.chaosCost+20);
  const caster=heavy.board.find(Boolean);heavy.queue=[{kind:'grunt',hp:1e9}];heavy.spawnIn=0;heavy.enemies=[];E.step(heavy,.05);
  heavy.gold=99999;heavy.gauge=HERO[caster.hero].skill.cost+19;assert.equal(E.cast(heavy,caster.hero).ok,false);
  heavy.gauge=HERO[caster.hero].skill.cost+20;assert.equal(E.cast(heavy,caster.hero).ok,true);
  const dry=E.newRun({oaths:['drought'],artifacts:['hourglass'],seed:6});
  const proto=dry.board.find(Boolean);dry.board.fill(null);
  dry.board[0]=unit(proto,'star_boy',dry.nextId++);dry.board[1]=unit(proto,'star_boy',dry.nextId++);
  dry.gauge=dry.gaugeMax;const sand=dry.sandStore,gauge=dry.gauge;
  assert.equal(E.move(dry,0,1).merged,true);
  assert.equal(dry.stats.merges,1);assert.equal(dry.gauge,gauge);assert.equal(dry.sandStore,sand);
  const wet=E.newRun({artifacts:['hourglass'],seed:6});
  const base=wet.board.find(Boolean);wet.board.fill(null);
  wet.board[0]=unit(base,'star_boy',wet.nextId++);wet.board[1]=unit(base,'star_boy',wet.nextId++);
  wet.gauge=wet.gaugeMax;assert.equal(E.move(wet,0,1).merged,true);assert.ok(wet.sandStore>sand);
  const capped=E.newRun({oaths:['untrained'],seed:7});capped.gold=99999;assert.equal(E.trainCap(capped),0);assert.equal(E.trainCap(E.newRun({seed:7})),5);
  assert.deepEqual(E.upgrade(capped,capped.deck[0]),{ok:false,reason:'별빛 서약: 이번 원정에서는 훈련할 수 없습니다.'});
  assert.equal(capped.upgrades[capped.deck[0]],0);
  const sun=E.newRun({seed:11}),dusk=E.newRun({oaths:['drought'],seed:11});sun.gauge=dusk.gauge=0;E.step(sun,.05);E.step(dusk,.05);
  assert.ok(sun.gauge>0);assert.ok(Math.abs(dusk.gauge-sun.gauge/2)<1e-9);
  const glow=E.newRun({oaths:['afterglow'],seed:12});glow.queue=[];glow.enemies=[];glow.spawnIn=1e9;glow.gauge=glow.gaugeMax;E.step(glow,.05);assert.equal(glow.phase,'reward');assert.equal(glow.gauge,30);
  const kept=E.newRun({seed:12});kept.queue=[];kept.enemies=[];kept.spawnIn=1e9;kept.gauge=kept.gaugeMax;E.step(kept,.05);assert.ok(kept.gauge>30);
  assert.equal(E.newRun({seed:8}).gold,70);
  assert.equal(E.newRun({oaths:['purse'],seed:8}).gold,35);
  assert.equal(E.newRun({oaths:['purse'],startGold:1,seed:8}).gold,Math.round(71*.5));
  const glass=E.newRun({oaths:['glass'],seed:9});assert.equal(glass.health,10);assert.equal(E.coreHealthMax(glass),10);
  const leaked=spawn(glass,'grunt',1e9);leaked.progress=E.PATH_LENGTH;leaked.speed=0;E.step(glass,.05);assert.ok(glass.health<10);assert.notEqual(glass.phase,'defeat');
  const aura=E.newRun({oaths:['scatter'],deck:['ancient_dragon','siren','behemoth','star_boy','luna'],seed:10});
  const plainAura=E.newRun({deck:aura.deck,seed:10});
  const sample=aura.board.find(Boolean);
  for(const s of [aura,plainAura]){s.board.fill(null);s.board[11]=unit(sample,'ancient_dragon',1);s.board[7]=unit(sample,'siren',2);s.board[12]=unit(sample,'star_boy',3);}
  close(E.combatStats(plainAura,plainAura.board[12]).damage/E.power(plainAura,plainAura.board[12]),1.2);
  close(E.combatStats(aura,aura.board[12]).damage/E.power(aura,aura.board[12]),1.1);
  close(HERO.star_boy.interval/E.combatStats(plainAura,plainAura.board[12]).cooldown,1.15);
  close(HERO.star_boy.interval/E.combatStats(aura,aura.board[12]).cooldown,1.075);
  for(const s of [aura,plainAura])s.board[12]=unit(sample,'behemoth',4);
  close(E.combatStats(plainAura,plainAura.board[12]).damage/E.power(plainAura,plainAura.board[12]),1.4);
  close(E.combatStats(aura,aura.board[12]).damage/E.power(aura,aura.board[12]),1.2);
  close(HERO.behemoth.interval/E.combatStats(plainAura,plainAura.board[12]).cooldown,1.3);
  close(HERO.behemoth.interval/E.combatStats(aura,aura.board[12]).cooldown,1.15);
});

test('an oath run and a twin run restore with recomputed mods and reject a bad save',()=>{
  const oath=E.newRun({mode:'oath',oaths:['lowstar','nobeam'],lineup:['flora','thor','ares'],seed:11});
  const twin=E.newRun({mode:'twin',side:'right',lineup:['love_iris','curse_iris'],seed:12});
  for(const s of [oath,twin]){
    const restored=E.restore(E.serialize(s));
    assert.ok(restored);
    assert.equal(E.serialize(restored),E.serialize(s));
    assert.deepEqual(restored.oathMods,oathMods(s.oaths));
  }
  const raw=JSON.parse(E.serialize(oath));
  raw.oathMods={core:20,hp:9};const fixed=E.restore(raw);assert.deepEqual(fixed.oathMods,oathMods(['lowstar','nobeam']));
  for(const oaths of [['tough1','tough2'],['nope'],'lowstar']){const bad=JSON.parse(E.serialize(oath));bad.oaths=oaths;assert.equal(E.restore(bad),null);}
  const side=JSON.parse(E.serialize(twin));side.side='up';assert.equal(E.restore(side),null);
  const lineup=JSON.parse(E.serialize(twin));lineup.lineup=['not-a-boss'];assert.equal(E.restore(lineup),null);
  const legacy=JSON.parse(E.serialize(E.newRun({seed:13})));delete legacy.oaths;delete legacy.oathMods;delete legacy.side;delete legacy.lineup;
  const old=E.restore(legacy);assert.ok(old);assert.deepEqual(old.oaths,[]);assert.equal(old.side,null);assert.equal(old.lineup,null);assert.deepEqual(old.oathMods,{});
  const hurt=JSON.parse(E.serialize(oath));hurt.health=21;assert.equal(E.restore(hurt),null);
});

test('starlight oath pays each band once, ignores a failed run and keeps an older lifetime',()=>{
  const p=profile();assert.equal(p.oath,undefined);
  const rng=p.rng;assert.equal(command(p,'begin',{mode:'oath',tier:'hard'},NOW).ok,false);assert.equal(p.rng,rng);
  p.cleared=2;assert.match(command(p,'begin',{mode:'oath',oaths:[]},NOW).message,/스테이지 3/);p.cleared=10;
  assert.match(command(p,'begin',{mode:'oath',tier:'hard',oaths:[]},NOW).message,/어려움/);p.cleared=90;
  assert.match(command(p,'begin',{mode:'oath',oaths:['tough1','tough2']},NOW).message,/함께 걸 수 없습니다/);
  assert.match(command(p,'begin',{mode:'oath',oaths:['lowstar'],deck:['zeke',...LEFT.slice(0,4)]},NOW).message,/C·R/);
  assert.match(command(p,'begin',{mode:'oath',oaths:['nobeam'],deck:['silver_rabbit',...LEFT.slice(0,4)]},NOW).message,/관통/);
  assert.match(command(p,'begin',{mode:'oath',oaths:['rabbits']},NOW).message,/은토끼·눈토끼·밤토끼/);
  const first=['lowstar','nobeam','drought'];
  ok(p,'begin',{mode:'oath',tier:'easy',oaths:first});
  assert.equal(p.active.stage,season(NOW).index%Math.min(p.cleared,MAIN_STAGES)+1);
  assert.deepEqual(p.active.oaths,first);
  const run=createBattle(p);assert.deepEqual(run.oaths,first);assert.deepEqual(run.lineup,oathBosses(season(p.active.started).index,9));
  p.active.run=E.serialize(run);assert.equal(validateProfile(p),true);assert.ok(resumeBattle(p));
  const dreams=p.dreams,fail=ok(p,'settle',{token:p.active.token,round:3,won:false});
  assert.equal(fail.score,0);assert.equal(fail.record,null);assert.equal(fail.newBest,false);assert.deepEqual(fail.bands,[]);assert.equal(fail.reward,0);assert.equal(p.dreams,dreams);
  ok(p,'begin',{mode:'oath',tier:'easy',oaths:first});
  const win=ok(p,'settle',{token:p.active.token,round:9,won:true,deck:['zeke']});
  assert.equal(win.score,oathScore('easy',first));assert.equal(win.score,11);assert.equal(win.newBest,true);
  assert.deepEqual(win.bands,[{score:5,reward:50},{score:10,reward:50}]);assert.equal(win.reward,100);
  assert.equal(p.dreams,dreams+100);assert.deepEqual(win.record.deck,LEFT);assert.equal(p.oath.paid,2);assert.equal(validateProfile(p),true);
  ok(p,'begin',{mode:'oath',tier:'easy',oaths:first});
  const again=ok(p,'settle',{token:p.active.token,round:9,won:true});
  assert.equal(again.newBest,false);assert.deepEqual(again.bands,[]);assert.equal(p.dreams,dreams+100);
  const more=['lowstar','nobeam','drought','heavy','untrained','purse'];
  ok(p,'begin',{mode:'oath',tier:'easy',oaths:more});
  const better=ok(p,'settle',{token:p.active.token,round:9,won:true});
  assert.equal(better.score,19);assert.deepEqual(better.bands,[{score:15,reward:60}]);assert.equal(p.dreams,dreams+160);assert.equal(p.oath.lifetime.score,19);
  ok(p,'begin',{mode:'oath',tier:'easy',oaths:first});
  const lost=ok(p,'settle',{token:p.active.token,round:1,won:false});
  assert.equal(lost.score,0);assert.equal(p.oath.best.score,19);assert.equal(p.dreams,dreams+160);
  const frozen=JSON.stringify(p);oathState(p,NOW);assert.equal(JSON.stringify(p),frozen);
});

test('twin parties stay disjoint, the latest run replaces that side, and each tier pays its own bands',()=>{
  const fresh=profile();const deck=[...fresh.deck],equipped=[...fresh.equipped];
  assert.match(command(fresh,'twinParty',partyOf(LEFT,[...LEFT]),NOW).message,/같은 동료/);
  assert.match(command(fresh,'twinParty',partyOf(LEFT,RIGHT,['hourglass'],['hourglass']),NOW).message,/같은 유물/);
  assert.match(command(fresh,'twinParty',partyOf(LEFT.slice(0,4),RIGHT),NOW).message,/5명/);
  assert.match(command(fresh,'begin',{mode:'twin',side:'left'},NOW).message,/5명/);
  ok(fresh,'twinParty',partyOf());assert.deepEqual(fresh.deck,deck);assert.deepEqual(fresh.equipped,equipped);
  ok(fresh,'dispatch',{slot:0,id:'star_boy'});
  assert.match(command(fresh,'twinParty',partyOf(),NOW).message,/파견 중/);
  ok(fresh,'claimDispatch',{slot:0},NOW+48*HOUR);
  ok(fresh,'twinParty',partyOf());
  ok(fresh,'begin',{mode:'twin',tier:'easy',side:'left'});
  assert.equal(command(fresh,'twinParty',partyOf(),NOW).message,'진행 중인 쌍성 원정을 먼저 마치세요.');
  assert.deepEqual(fresh.active.deck,LEFT);assert.deepEqual(fresh.active.relics,RELIC.slice(0,2));
  assert.deepEqual(Object.keys(fresh.active.relicLevels),RELIC.slice(0,2));
  const battle=createBattle(fresh);assert.deepEqual(battle.artifacts,RELIC.slice(0,2));assert.equal(battle.side,'left');
  assert.deepEqual(battle.lineup,twinBosses(season(fresh.active.started).index,'left',9));
  fresh.active.run=E.serialize(battle);assert.equal(validateProfile(fresh),true);assert.ok(resumeBattle(fresh));
  fresh.active.run=null;
  const zero=ok(fresh,'settle',{token:fresh.active.token,round:0,damage:0,won:false});
  assert.equal(zero.newBest,true);assert.equal(zero.total,0);assert.deepEqual(zero.bands,[]);assert.equal(fresh.twin.best.easy.total,0);
  ok(fresh,'begin',{mode:'twin',tier:'easy',side:'left'});
  const left=ok(fresh,'settle',{token:fresh.active.token,round:9,damage:-5,won:true});
  assert.equal(left.round,TWIN_WAVES);assert.equal(left.side,'left');assert.equal(left.total,TWIN_WAVES);
  assert.equal(fresh.twin.records.easy.left.damage,0);assert.deepEqual(fresh.twin.records.easy.left.deck,LEFT);assert.equal(fresh.results[0].round,9);
  assert.deepEqual(left.bands,[{total:4,reward:twinBandReward('easy',0)}]);
  const beforePay=fresh.dreams;
  ok(fresh,'begin',{mode:'twin',tier:'easy',side:'right'});
  const right=ok(fresh,'settle',{token:fresh.active.token,round:2,damage:4});
  assert.equal(fresh.twin.records.easy.left.round,6);assert.equal(fresh.twin.records.easy.right.round,2);assert.equal(right.total,8);
  assert.equal(fresh.twin.best.easy.total,8);
  assert.deepEqual(right.bands,[{total:8,reward:twinBandReward('easy',1)}]);
  assert.equal(fresh.dreams,beforePay+twinBandReward('easy',1));
  const dreams=fresh.dreams,lifetimeTotal=fresh.twin.lifetime.total;
  ok(fresh,'begin',{mode:'twin',tier:'easy',side:'left'});
  const replay=ok(fresh,'settle',{token:fresh.active.token,round:1,damage:100});
  assert.equal(fresh.twin.records.easy.left.round,1);assert.equal(fresh.twin.records.easy.left.damage,100);assert.equal(replay.total,3);
  assert.equal(replay.newBest,false);assert.deepEqual(replay.bands,[]);
  assert.equal(fresh.twin.best.easy.total,8);assert.equal(fresh.twin.paid.easy,2);assert.equal(fresh.twin.lifetime.total,lifetimeTotal);
  assert.equal(fresh.dreams,dreams);
  assert.equal(twinBandReward('easy',0),Math.round(60*1.3));
  ok(fresh,'twinParty',partyOf());assert.equal(fresh.twin.records.easy.left.round,1);assert.equal(fresh.twin.best.easy.total,8);
  const shifted={left:{deck:['guardian',...LEFT.slice(1)],relics:RELIC.slice(0,2)},right:{deck:RIGHT,relics:RELIC.slice(2,4)}};
  ok(fresh,'twinParty',shifted);assert.equal(fresh.twin.records.easy.left.round,1);assert.equal(fresh.twin.best.easy.total,8);assert.equal(fresh.twin.paid.easy,2);
  ok(fresh,'twinParty',partyOf());
  ok(fresh,'begin',{mode:'twin',tier:'hard',side:'left'});
  const hard=ok(fresh,'settle',{token:fresh.active.token,round:4,damage:1});
  assert.equal(hard.total,4);assert.deepEqual(hard.bands,[{total:4,reward:twinBandReward('hard',0)}]);
  assert.equal(twinBandReward('hard',0),Math.round(60*2.3));assert.equal(fresh.twin.paid.easy,2);assert.equal(fresh.twin.paid.hard,1);
  assert.equal(fresh.twin.lifetime.tier,'hard');assert.equal(fresh.twin.lifetime.total,4);
  const overlap={left:{deck:['guardian',...LEFT.slice(1)],relics:RELIC.slice(4,6)},right:{deck:['star_boy',...RIGHT.slice(1)],relics:RELIC.slice(6,8)}};
  ok(fresh,'twinParty',overlap);
  const denied=command(fresh,'begin',{mode:'twin',tier:'easy',side:'right'},NOW);
  assert.equal(denied.ok,false);
  assert.equal(denied.message,`${TWIN_SIDE.left.name} 기록에 쓴 동료·유물은 이 별길에 쓸 수 없어요. ${TWIN_SIDE.left.name}을 다시 도전하면 풀려요.`);
  assert.deepEqual(twinLocks(fresh,NOW,'easy','right').heroes,fresh.twin.records.easy.left.deck);
  assert.deepEqual(twinLocks(fresh,NOW,'easy','left').heroes,fresh.twin.records.easy.right.deck);
  ok(fresh,'begin',{mode:'twin',tier:'easy',side:'left'});
  ok(fresh,'settle',{token:fresh.active.token,round:1,damage:1});
  assert.deepEqual(fresh.twin.records.easy.left.deck,overlap.left.deck);
  ok(fresh,'begin',{mode:'twin',tier:'easy',side:'right'});
  const later=season(NOW).end,before=JSON.stringify(fresh),view=twinState(fresh,later);
  assert.equal(view.records.easy.left,null);assert.equal(view.best.hard,null);assert.equal(view.paid.hard,0);
  assert.equal(view.lifetime.tier,'hard');assert.deepEqual(view.party.left.deck,overlap.left.deck);
  assert.equal(JSON.stringify(fresh),before);assert.equal(validateProfile(fresh),true);
});

test('companion requests arrive on a cadence, progress from the active deck, and pay a thank-you once',()=>{
  const tracker=requestTracker();
  tracker.observe({board:[{hero:'silver_rabbit'},{hero:'snow_rabbit'}]},[{type:'skill',hero:'night_rabbit'},{type:'kill',boss:'flora'},{type:'kill',boss:null}]);
  tracker.observe({board:[]},[{type:'reduce',by:'ash'},{type:'skill',hero:'ash'}]);
  const feats=tracker.feats(true);assert.equal(feats.casts.night_rabbit,1);assert.equal(feats.bosses,1);assert.deepEqual(feats.flags,['moonlit']);
  const spared=requestTracker();spared.observe({board:[]},[{type:'skill',hero:'ash'}]);assert.deepEqual(spared.feats(false).flags,['spared']);
  const p=profile();p.heroes.underdog.owned=false;p.heroes.ash.owned=false;
  const first=ok(p,'requestArrive');assert.deepEqual(first.arrived,['night_rabbit-1']);
  assert.ok(p.requests.next>=NOW+REQUEST_GAP_MIN&&p.requests.next<NOW+REQUEST_GAP_MIN+REQUEST_GAP_SPAN);
  const rng=p.rng,next=p.requests.next;assert.deepEqual(command(p,'requestArrive',{},next-1).arrived,[]);assert.equal(p.rng,rng);assert.equal(p.requests.next,next);
  ok(p,'requestDecline',{id:'night_rabbit-1'});assert.deepEqual(p.requests.active,[]);
  assert.deepEqual(ok(p,'requestArrive',{},next).arrived,['night_rabbit-1']);
  p.heroes.underdog.owned=true;p.heroes.ash.owned=true;
  const secondAt=p.requests.next;const second=ok(p,'requestArrive',{},secondAt).arrived[0];
  const thirdAt=p.requests.next;const third=ok(p,'requestArrive',{},thirdAt).arrived[0];
  assert.equal(new Set(['night_rabbit-1',second,third]).size,3);assert.equal(p.requests.active.length,REQUEST_MAX);
  const capped=p.rng,full=p.requests.next;assert.deepEqual(ok(p,'requestArrive',{},full).arrived,[]);assert.equal(p.rng,capped);assert.equal(p.requests.next,full);
  ok(p,'requestSeen',{id:'night_rabbit-1'});assert.equal(p.requests.active.find(e=>e.id==='night_rabbit-1').seen,true);
  assert.equal(command(p,'requestSeen',{id:'missing'},NOW).message,'부탁을 찾을 수 없습니다.');
  const deck=['star_boy','snow_rabbit','night_rabbit','siren','mushroom_king'];
  p.requests={next:NOW+REQUEST_GAP_MIN,active:[
    {id:'night_rabbit-1',at:NOW,seen:true,count:0,done:false},
    {id:'underdog-2',at:NOW,seen:false,count:0,done:false},
    {id:'ash-2',at:NOW,seen:false,count:0,done:false},
  ],claimed:['underdog-1','ash-1'],after:[],read:[]};
  ok(p,'begin',{mode:'main',deck});
  const progressed=ok(p,'settle',{token:p.active.token,round:1,won:false,deck:['ash'],feats:{won:true,casts:{ash:10},bosses:4,flags:[]}});
  assert.deepEqual(progressed.requestsDone,['night_rabbit-1','underdog-2','ash-2']);
  const ash=p.requests.active.find(e=>e.id==='ash-2');assert.equal(ash.count,2);assert.equal(ash.done,true);
  assert.equal(validateProfile(p),true);
  p.requests={next:NOW+REQUEST_GAP_MIN,active:[{id:'underdog-1',at:NOW,seen:false,count:0,done:false}],claimed:[],after:[],read:[]};
  ok(p,'begin',{mode:'main',deck:LEFT});
  ok(p,'settle',{token:p.active.token,round:1,won:true,deck:['underdog'],feats:{won:false,casts:{},bosses:3,flags:['spared']}});
  assert.equal(p.requests.active[0].count,0);
  p.requests={next:NOW+REQUEST_GAP_MIN,active:[{id:'underdog-1',at:NOW,seen:false,count:0,done:false},{id:'ash-3',at:NOW,seen:false,count:0,done:false}],claimed:['ash-1','ash-2'],after:[],read:[]};
  ok(p,'begin',{mode:'main',deck:['underdog',...LEFT.slice(1)]});
  const flagged=ok(p,'settle',{token:p.active.token,round:1,won:true,feats:{won:false,casts:{},bosses:2,flags:['spared']}});
  assert.deepEqual(flagged.requestsDone,['underdog-1','ash-3']);
  const dust=p.dust;ok(p,'begin',{mode:'main'});const quiet=ok(p,'settle',{token:p.active.token,round:1,won:true});
  assert.equal(quiet.requestsDone,undefined);assert.equal(p.dust,dust+40+p.results[0].stage*8);assert.equal(quiet.reward,0);
  ok(p,'begin',{mode:'weekly',tier:'easy'});
  while(p.active.draft.length<5)ok(p,'draft',{index:0});
  const weekly=ok(p,'settle',{token:p.active.token,round:4,won:false});
  assert.equal(weekly.reward,weeklyReward('easy',4,false));assert.equal(weekly.requestsDone,undefined);
  p.heroes.night_rabbit.bond=0;p.heroes.night_rabbit.bondXp=0;p.gifts.letter=998;
  p.requests={next:NOW,active:[{id:'night_rabbit-1',at:NOW,seen:true,count:1,done:true}],claimed:[],after:[],read:[]};
  assert.equal(command(p,'requestDecline',{id:'night_rabbit-1'},NOW).message,'이미 끝낸 부탁은 거절할 수 없습니다.');
  const thanked=ok(p,'requestThank',{id:'night_rabbit-1'});
  assert.equal(thanked.hero,'night_rabbit');assert.equal(thanked.gift,FAVORITE.night_rabbit);assert.equal(thanked.points,REQUEST_PAY.bond);assert.equal(thanked.afterword,false);
  assert.equal(p.gifts.letter,999);assert.equal(p.heroes.night_rabbit.bond,1);
  p.requests.active.push({id:'night_rabbit-2',at:NOW,seen:false,count:3,done:true});
  assert.equal(ok(p,'requestThank',{id:'night_rabbit-2'}).afterword,false);
  p.requests.active.push({id:'night_rabbit-3',at:NOW,seen:false,count:1,done:true});
  assert.equal(ok(p,'requestThank',{id:'night_rabbit-3'}).afterword,true);
  assert.deepEqual(p.requests.after,['night_rabbit']);
  ok(p,'requestAfterRead',{hero:'night_rabbit'});ok(p,'requestAfterRead',{hero:'night_rabbit'});assert.deepEqual(p.requests.read,['night_rabbit']);
  assert.equal(command(p,'requestAfterRead',{hero:'ash'},NOW).message,'아직 후기를 볼 수 없습니다.');
  assert.equal(command(p,'requestThank',{id:'night_rabbit-1'},NOW).message,'부탁을 찾을 수 없습니다.');
  assert.equal(validateProfile(p),true);
  assert.equal(testGrant(p,'request-now'),'동료의 부탁이 바로 도착할 수 있게 했어요');assert.equal(p.requests.next,0);
  ok(p,'begin',{mode:'oath',oaths:['glass'],tier:'abyss'});
  assert.equal(testGrant(p,'season-reset'),'서약·쌍성 시즌 기록을 초기화했어요');
  assert.equal(p.active,null);assert.equal(p.oath,undefined);
  ok(p,'twinParty',partyOf());ok(p,'begin',{mode:'main'});
  testGrant(p,'season-reset');assert.equal(p.active.mode,'main');assert.deepEqual(p.twin.party.left.deck,LEFT);assert.equal(p.twin.best,undefined);
  assert.ok(TEST_TOOLS.some(t=>t.kind==='request-now'&&t.label==='부탁 바로 도착'));
  assert.ok(TEST_TOOLS.some(t=>t.kind==='season-reset'&&t.label==='서약·쌍성 시즌 초기화'));
});

test('a stored oath and twin expedition still validates inside the profile store',async()=>{
  let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{assert.equal(k,SAVE_KEY);raw=v;}};
  const store=new ProfileStore(storage,NOW);const p=store.value;
  const call=(action,args,now=NOW)=>{const r=store.transact(action,args,now);assert.equal(r.ok,true,r.message);return r;};
  call('twinParty',partyOf());
  call('begin',{mode:'oath',tier:'abyss',oaths:['glass','purse']});
  const battle=createBattle(store.value);assert.equal(battle.health,10);const {seedGold}=await import('../src/economy.js');assert.equal(battle.gold,Math.round((70+seedGold(store.value.beds.seed))*.5));
  store.saveRun(E.serialize(battle));assert.equal(validateProfile(store.value),true);
  call('settle',{token:store.value.active.token,round:9,won:true});
  assert.equal(store.value.oath.best.score,27);assert.equal(store.value.oath.paid,5);
  call('begin',{mode:'twin',tier:'easy',side:'right'});
  call('settle',{token:store.value.active.token,round:4,damage:Number.POSITIVE_INFINITY});
  assert.equal(store.value.twin.records.easy.right.damage,0);assert.equal(store.value.twin.best.easy.total,4);
  assert.equal(monthlyReward({round:1,tier:'easy'})>0,true);
  assert.equal(HEROES.length,42);
});

test('an old twin set is dropped on load and overlapping side records are rejected',()=>{
  const p=profile();
  ok(p,'twinParty',partyOf());
  p.twin.period=season(NOW).id;
  p.twin.set={key:'old',tier:'easy',left:{round:2,damage:1},right:null};
  p.twin.best={easy:{total:2,left:{round:2,damage:1},right:{round:0,damage:0},key:'legacy',at:NOW},hard:null,abyss:null};
  p.twin.paid={easy:0,hard:0,abyss:0};
  p.twin.lifetime={tier:'easy',total:2,at:NOW};
  const loaded=parseProfile(JSON.stringify(p));
  assert.ok(loaded);
  assert.equal(loaded.twin.set,undefined);
  assert.equal(loaded.twin.best.easy.total,2);
  assert.equal(loaded.twin.best.easy.key,'legacy');
  assert.equal(loaded.twin.paid.easy,0);
  assert.deepEqual(loaded.twin.party.left.deck,LEFT);
  assert.equal(validateProfile(loaded),true);
  loaded.twin.records={
    easy:{left:{round:1,damage:0,deck:[...LEFT],relics:[],at:NOW},right:{round:1,damage:0,deck:[...LEFT],relics:[],at:NOW}},
    hard:{left:null,right:null},abyss:{left:null,right:null},
  };
  assert.equal(validateProfile(loaded),false);
});

test('a rank goal counts once, a clear goal can require every listed hero, and arrivals span the request heroes',()=>{
  REQUEST['star_boy-rank']={id:'star_boy-rank',hero:'star_boy',order:1,goal:{type:'rank',hero:'star_boy',n:4}};
  REQUEST['siren-clear']={id:'siren-clear',hero:'siren',order:1,goal:{type:'clear',with:['siren','star_boy'],n:1}};
  try{
    assert.equal(requestGoal('star_boy-rank'),1);
    assert.equal(requestGoal('siren-clear'),1);
    const tracker=requestTracker();
    tracker.observe({board:[{hero:'star_boy',rank:3},{hero:'siren',rank:1},null,{rank:6}]},[]);
    tracker.observe({board:[{hero:'star_boy',rank:2},{hero:'star_boy',rank:4}]},[]);
    const feats=tracker.feats(true);
    assert.equal(feats.ranks.star_boy,4);assert.equal(feats.ranks.siren,1);assert.equal(feats.ranks.undefined,undefined);
    const p=profile();
    p.requests={next:NOW+REQUEST_GAP_MIN,active:[
      {id:'star_boy-rank',at:NOW,seen:false,count:0,done:false},
      {id:'siren-clear',at:NOW,seen:false,count:0,done:false},
    ],claimed:[],after:[],read:[]};
    ok(p,'begin',{mode:'main',deck:LEFT});
    const low=ok(p,'settle',{token:p.active.token,round:1,won:true,feats:{won:true,casts:{},bosses:0,flags:[],ranks:{star_boy:3,siren:1}}});
    assert.deepEqual(low.requestsDone,['siren-clear']);
    assert.equal(p.requests.active.find(e=>e.id==='star_boy-rank').done,false);
    p.requests={next:NOW+REQUEST_GAP_MIN,active:[{id:'star_boy-rank',at:NOW,seen:false,count:0,done:false}],claimed:[],after:[],read:[]};
    ok(p,'begin',{mode:'main',deck:LEFT});
    const ranked=ok(p,'settle',{token:p.active.token,round:1,won:false,feats});
    assert.deepEqual(ranked.requestsDone,['star_boy-rank']);
    assert.equal(p.requests.active[0].count,1);assert.equal(p.requests.active[0].done,true);assert.equal(validateProfile(p),true);
    p.requests={next:NOW+REQUEST_GAP_MIN,active:[{id:'siren-clear',at:NOW,seen:false,count:0,done:false}],claimed:[],after:[],read:[]};
    ok(p,'begin',{mode:'main',deck:['star_boy','snow_rabbit','night_rabbit','guardian','great_detective']});
    const missed=ok(p,'settle',{token:p.active.token,round:1,won:true,feats:{won:true,casts:{},bosses:0,flags:[]}});
    assert.deepEqual(missed.requestsDone,[]);assert.equal(p.requests.active[0].count,0);
    p.requests={next:NOW+REQUEST_GAP_MIN,active:[{id:'star_boy-rank',at:NOW,seen:false,count:0,done:false}],claimed:[],after:[],read:[]};
    ok(p,'begin',{mode:'main',deck:LEFT});
    const bad=ok(p,'settle',{token:p.active.token,round:1,won:true,feats:{won:true,casts:{},bosses:0,flags:[],ranks:{star_boy:9}}});
    assert.deepEqual(bad.requestsDone,[]);assert.equal(p.requests.active[0].count,0);assert.equal(validateProfile(p),true);
    const q=profile();
    for(const id of REQUEST_HEROES)q.heroes[id].owned=true;
    const seen=[];let t=NOW;
    for(let i=0;i<REQUEST_HEROES.length+1;i++){
      const r=ok(q,'requestArrive',{},t);
      if(!r.arrived.length)break;
      seen.push(r.arrived[0]);t=q.requests.next;
    }
    assert.equal(seen.length,Math.min(REQUEST_MAX,REQUEST_HEROES.length));
    const heroes=seen.map(id=>REQUEST[id].hero);
    assert.equal(new Set(heroes).size,heroes.length);
    assert.ok(heroes.every(id=>REQUEST_HEROES.includes(id)));
    assert.equal(validateProfile(q),true);
  }finally{
    delete REQUEST['star_boy-rank'];delete REQUEST['siren-clear'];
  }
});
