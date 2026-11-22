import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {DEFAULT_DECK,HERO} from '../src/content.js';
import {EXPANSION_IDS,EXPANSION_RARITIES,EXPANSION_VFX_ASSET_PATHS} from '../src/expansion-companions.js';
import {EXPANSION_VFX,EXPANSION_FX_PROFILES,EXPANSION_RASTER_VFX,drawExpansionEmblem,drawExpansionShot,drawExpansionSkill,expansionAllyPoints} from '../src/combat/expansion-vfx.js';
import {CombatFX,FX_PROFILES} from '../src/combat/effects.js';

const noop=()=>{},gradient={addColorStop:noop};
function canvas(){
  const cv={width:720,height:780,dataset:{}},state={globalAlpha:1,globalCompositeOperation:'source-over',depth:0,ops:0};
  const ctx=new Proxy(state,{
    get(o,k){
      if(k in o)return o[k];if(k==='canvas')return cv;
      if(k==='save')return ()=>{o.depth++;o.ops++;};
      if(k==='restore')return ()=>{assert.ok(o.depth>0,'unmatched restore');o.depth--;o.ops++;};
      if(String(k).startsWith('create')&&String(k).endsWith('Gradient'))return ()=>gradient;
      if(k==='createPattern')return ()=>({});
      return (...args)=>{o.ops++;return args[0];};
    },
    set(o,k,v){o[k]=v;return true;},
  });
  cv.getContext=()=>ctx;return cv;
}
globalThis.window={devicePixelRatio:1};
globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return canvas();}};

function arena(id){
  const deck=[id,...DEFAULT_DECK.filter(hero=>hero!==id)].slice(0,5),s=E.newRun({deck,seed:7319,crit:null}),template=s.board.find(Boolean);
  s.board.fill(null);s.events=[];s.shots=[];s.queue=[];s.spawnIn=1e6;s.gold=1000;s.gauge=120;
  s.board[12]={...template,uid:s.nextId++,hero:id,rank:3,birthWave:s.wave,born:0,cooldown:100,windup:0,target:null,attacks:0,harvest:12,disabled:0,stunWard:0,riposteAt:0,priority:E.targetingLocked(id)?'random':HERO[id].bossDamage||HERO[id].bossPriority?'boss':'first'};
  s.queue=Array.from({length:6},()=>({kind:'grunt',hp:1e9}));
  for(let i=0;i<6;i++){s.spawnIn=0;E.step(s,.001);}
  for(const [i,e] of s.enemies.entries())Object.assign(e,{progress:1360+i*12,speed:0,skillIn:1e6,shield:0});
  s.queue=[];s.spawnIn=1e6;s.events=[];return s;
}
function launch(s){
  const u=s.board[12];u.cooldown=0;u.windup=0;u.target=null;
  for(let i=0;i<10;i++){E.step(s,.05);const shot=s.shots.find(q=>q.source===u.uid&&q.proc!==false);if(shot)return shot;}
  assert.fail('no basic attack from '+u.hero);
}
function effect(s){
  const cv=canvas(),fx=new CombatFX(cv.getContext('2d'),{images:{}});fx.s=s;
  for(const e of s.enemies)fx.enemies.set(e.uid,{enemy:{...e},point:E.pathPoint(e.progress),hp:e.hp});
  return {fx,ctx:cv.getContext('2d')};
}

test('the sixteen expansion companions own distinct attack and ultimate silhouettes',()=>{
  assert.deepEqual(Object.keys(EXPANSION_VFX),EXPANSION_IDS);
  assert.equal(new Set(Object.values(EXPANSION_VFX).map(v=>v.motif)).size,EXPANSION_IDS.length);
  assert.equal(new Set(Object.values(EXPANSION_VFX).map(v=>v.skill)).size,EXPANSION_IDS.length);
  for(const id of EXPANSION_IDS){
    assert.equal(FX_PROFILES[id],EXPANSION_FX_PROFILES[id],id+' profile');
    const {fx,ctx}=effect(arena(id)),before=ctx.ops;
    assert.equal(drawExpansionEmblem(fx,id,360,405,220,0,.9),true,id+' emblem');
    assert.ok(ctx.ops>before,id+' emblem did not draw');assert.equal(ctx.depth,0,id+' emblem context');
  }
});

test('the four authored raster atlases map one attack and ultimate frame to every expansion hero',()=>{
  assert.deepEqual(Object.keys(EXPANSION_RASTER_VFX),EXPANSION_IDS);
  assert.equal(Object.keys(EXPANSION_VFX_ASSET_PATHS).length,4);
  for(const [rarity,ids] of Object.entries(EXPANSION_RARITIES))for(const [frame,id] of ids.entries()){
    assert.deepEqual(EXPANSION_RASTER_VFX[id],{
      atlas:'effects-card-expansion-'+rarity.toLowerCase(),attackFrame:frame,ultimateFrame:frame+4,
    },id);
  }
  const {fx}=effect(arena('ancient_soul')),calls=[];
  fx.art.images=Object.fromEntries(Object.values(EXPANSION_RASTER_VFX).map(v=>[v.atlas,{}]));
  fx.atlasStamp=(...args)=>calls.push(args);
  for(const id of EXPANSION_IDS)assert.equal(drawExpansionEmblem(fx,id,360,405,220,0,.9),true,id);
  assert.equal(calls.length,16);
  for(const [i,id] of EXPANSION_IDS.entries()){
    const spec=EXPANSION_RASTER_VFX[id],call=calls[i];
    assert.deepEqual(call.slice(0,4),[spec.atlas,spec.ultimateFrame,4,2],id);
    assert.equal(call.at(-1),'source-over',id+' blend');
  }
});

test('production attack and skill renderers prefer their authored raster frames',()=>{
  for(const id of EXPANSION_IDS){
    const {fx}=effect(arena(id)),calls=[],spec=EXPANSION_RASTER_VFX[id];
    fx.art.images[spec.atlas]={};fx.atlasStamp=(...args)=>calls.push(args);
    assert.equal(drawExpansionShot(fx,{hero:id,rank:3,from:{x:120,y:300},origin:{x:120,y:300},to:{x:320,y:360}},null,{x:230,y:330,angle:.14,t:.5,target:{x:320,y:360}}),true,id+' shot');
    assert.ok(calls.some(call=>call[0]===spec.atlas&&call[1]===spec.attackFrame&&call[2]===4&&call[3]===2),id+' attack frame');
    calls.length=0;
    assert.equal(drawExpansionSkill(fx,{hero:id,total:1.6,life:1.22,origin:{x:180,y:390},targets:[{x:350,y:390}],allies:[]}),true,id+' skill');
    assert.ok(calls.some(call=>call[0]===spec.atlas&&call[1]===spec.ultimateFrame&&call[2]===4&&call[3]===2),id+' ultimate frame');
  }
});

test('real engine attacks and casts route every expansion hero through dedicated production CombatFX',()=>{
  for(const id of EXPANSION_IDS){
    const s=arena(id),shot=launch(s),attack=s.events.find(e=>e.type==='attack'&&e.hero===id);
    assert.ok(attack,id+' missing real attack event');assert.equal(shot.hero,id);
    const view=effect(s),mid={...shot,life:shot.total*.5},beforeShot=view.ctx.ops;
    view.fx.drawShot(mid,s);assert.ok(view.ctx.ops>beforeShot,id+' dedicated shot did not draw');assert.equal(view.ctx.depth,0,id+' shot context');

    s.events=[];shot.life=.001;E.step(s,.001);const impact=s.events.find(e=>e.type==='impact'&&e.hero===id);assert.ok(impact,id+' missing real impact event');
    const hitView=effect(s),beforeHit=hitView.ctx.ops;hitView.fx.event(impact);hitView.fx.draw(.05);
    assert.ok(hitView.ctx.ops>beforeHit,id+' dedicated impact did not draw');assert.equal(hitView.ctx.depth,0,id+' impact context');

    s.events=[];s.gauge=120;s.gold=1000;s.board[12].disabled=0;
    const cast=E.cast(s,id);assert.equal(cast.ok,true,id+' cast');const skillEvent=s.events.find(e=>e.type==='skill'&&e.hero===id);assert.ok(skillEvent,id+' missing real skill event');
    if(id==='victoria'){assert.equal(skillEvent.support,true);assert.deepEqual(expansionAllyPoints(skillEvent),skillEvent.allies);assert.deepEqual(skillEvent.targets,skillEvent.allies);}
    if(id==='archangel'){assert.equal(skillEvent.support,false);assert.deepEqual(expansionAllyPoints(skillEvent),skillEvent.allies);assert.ok(skillEvent.targets.every(p=>s.enemies.some(e=>e.uid===p.uid)),'sanctuary damage receipts stay on enemies');}
    const skillView=effect(s);skillView.fx.event(skillEvent);
    assert.ok(skillView.fx.impacts.every(e=>!['ultimate','support'].includes(e.type)),id+' borrowed a generic target emblem');
    assert.ok(skillView.fx.impacts.every(e=>e.type==='expansionReceipt'||e.type==='expansionSupport'),id+' non-dedicated skill receipt');
    const skill={...skillEvent,uid:99,life:1.05,total:1.6},beforeSkill=skillView.ctx.ops;
    skillView.fx.drawSkillField(skill);skillView.fx.draw(.05);
    assert.ok(skillView.ctx.ops>beforeSkill,id+' dedicated ultimate did not draw');assert.equal(skillView.ctx.depth,0,id+' skill context');
  }
});

test('Victoria and Archangel ward receipts keep their actual provider and dedicated art',()=>{
  for(const id of ['victoria','archangel']){
    const s=arena(id);s.gauge=120;assert.ok(E.cast(s,id).ok);s.events=[];
    assert.equal(E.stunUnit(s,12,2),false,id+' ward');const ward=s.events.find(e=>e.type==='ward');assert.equal(ward.hero,id);
    const view=effect(s),before=view.ctx.ops;view.fx.event(ward);assert.equal(view.fx.impacts.at(-1).hero,id);view.fx.draw(.05);
    assert.ok(view.ctx.ops>before,id+' ward art did not draw');assert.equal(view.ctx.depth,0,id+' ward context');
  }
});
