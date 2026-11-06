import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO} from '../src/content.js';
import {cellPoint,pathPoint} from '../src/combat/engine.js';
import {CombatFX} from '../src/combat/effects.js';
import {Art,Renderer} from '../src/combat/render.js';
import {UR_SPECS,DREAM} from '../src/combat/ur-vfx.js';
import {warmHero,warmUltimates} from '../src/combat/ur-warm.js';
import {ENTRIES,reviewScene} from '../docs/review/ur-vfx-20261106/scene.js';

const noop=()=>{},gradient={addColorStop:noop};
function canvas(){
  const cv={width:720,height:780,dataset:{}},state={globalAlpha:1,depth:0};
  const ctx=new Proxy(state,{get(o,k){if(k in o)return o[k];if(k==='canvas')return cv;if(k==='save')return ()=>o.depth++;if(k==='restore')return ()=>{assert.ok(o.depth>0,'unmatched restore');o.depth--;};if(k==='getImageData')return (x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h});if(k==='measureText')return text=>({width:String(text).length*8});if(String(k).startsWith('create')&&String(k).endsWith('Gradient'))return ()=>gradient;if(k==='createPattern')return ()=>({});return noop;},set(o,k,v){o[k]=v;return true;}});
  cv.getContext=()=>ctx;return cv;
}
globalThis.window={devicePixelRatio:1};globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return canvas();}};
const image={src:'atlas',naturalWidth:1024,naturalHeight:1024};
function art(){const a={images:new Proxy({}, {get:()=>image})};a.hero=(ctx,...args)=>Art.prototype.hero.call(a,ctx,...args);return a;}
function view(){return new Renderer(canvas(),art());}
function event(hero,targets=[],extra={}){return {type:'skill',hero,kind:HERO[hero].skill.type,rank:3,origin:cellPoint(12),support:[],targets,...extra};}
function snapshot(fx,enemies){for(const e of enemies)fx.enemies.set(e.uid,{enemy:{...e},point:pathPoint(e.progress),hp:e.hp});}
function checked(ctx,fn,label){const before=ctx.depth;assert.doesNotThrow(fn,label);assert.equal(ctx.depth,before,label+' save/restore');}

for(const [hero,spec] of Object.entries(UR_SPECS))test(`${hero}: real cast plans and draws its complete ultimate`,()=>{
  const entry=ENTRIES.find(e=>e.hero===hero&&e.mode==='skill');assert.ok(entry,'missing review fixture');
  const scene=reviewScene(entry,{kills:true,twin:true}),fx=new CombatFX(canvas().getContext('2d'),art()),r=view();fx.s=scene.state;snapshot(fx,scene.state.enemies);
  warmHero(r,hero,scene.state.deck);fx.urCache=r.fx.urCache;const warmed=new Set(fx.urCache.keys());
  const e=scene.cast().find(e=>e.type==='skill'&&e.hero===hero);assert.ok(e,'missing engine skill event');
  const skill={...e,uid:1};let impacts;checked(fx.ctx,()=>{impacts=spec.plan(fx,skill);},'plan');
  const life=spec.life(skill);assert.ok(Number.isFinite(life)&&life>0,'life');skill.life=skill.total=life;
  // Delayed strikes land on a later engine event (Cherry Prince, Aurora, Shooting Star Boy); support casts (Harmonious, Rumi) deal no damage.
  if(impacts==null)assert.ok(['cherry_prince','harmonious','rumi','aurora','star_boy','behemoth'].includes(hero),'unexpected missing impact map');
  else{assert.ok(impacts instanceof Map);for(const [uid,at] of impacts){assert.ok(Number.isFinite(uid));assert.ok(Number.isFinite(at)&&at>=0&&at<=life,`${uid}: ${at} / ${life}`);}}
  for(let frame=0;frame<=Math.ceil(life*60);frame++){
    const age=Math.min(life,frame/60);fx.clock=age;skill.life=life-age;
    if(frame===36&&spec.finisher)checked(fx.ctx,()=>spec.finisher(fx,skill,{type:'finisherImpact',kind:'royal',x:300,y:300}),`${hero} finisher`);
    // A delayed strike's own impact (an effect added at the engine's finisher event), hit and fizzle.
    if(spec.impact&&frame>=36){const n=Math.ceil(spec.impactLife*60),t=(frame-36)/n;if(t<=1)for(const hit of [true,false])checked(fx.ctx,()=>spec.impact(fx,{type:'urFx',hit,x:300,y:300,targetBoss:hit,total:spec.impactLife},t),`${hero} impact ${t}`);}
    for(const name of ['field','over','body'])if(spec[name])checked(fx.ctx,()=>spec[name](fx,skill,age),`${hero} ${name} ${age}`);
    if(spec.unitBody)for(const u of scene.state.board.filter(Boolean))checked(fx.ctx,()=>spec.unitBody(fx,skill,age,u),`${hero} unitBody ${age}`);
    for(const name of ['persistent','persistentOver'])if(spec[name])checked(fx.ctx,()=>spec[name](fx,scene.state,[]),`${hero} ${name} ${age}`);
  }
  assert.deepEqual([...fx.urCache.keys()].filter(key=>!warmed.has(key)),[],hero+' created an unwarmed canvas');
  // Reduced motion draws the same timeline with fewer particles: it must not throw either.
  fx.reduced=true;for(let frame=0;frame<=Math.ceil(life*30);frame++){const age=Math.min(life,frame/30);fx.clock=age;skill.life=life-age;for(const name of ['field','over','body'])if(spec[name])checked(fx.ctx,()=>spec[name](fx,skill,age),`${hero} reduced ${name} ${age}`);if(spec.impact)checked(fx.ctx,()=>spec.impact(fx,{type:'urFx',hit:true,x:300,y:300,total:spec.impactLife},Math.min(1,age/spec.impactLife)),`${hero} reduced impact`);}
});

test('held hit and kill callbacks land with the picture; other hits remain immediate',()=>{
  const r=view(),heard=[],p={uid:7,...pathPoint(900)},enemy={uid:7,hp:100,maxHp:100,kind:'grunt',progress:900};snapshot(r.fx,[enemy]);r.landed=e=>heard.push(e.type+':'+e.hero);
  r.event({type:'hit',hero:'frost_witch',...p,damage:30});r.event({type:'kill',...p,kind:'grunt'});r.event(event('frost_witch',[p]));r.event({type:'hit',hero:'siren',...p,damage:10});r.flushPending();
  assert.deepEqual(heard,['hit:siren']);assert.equal(r.ghosts[0].hp,100);assert.equal(r.heldHp(7,60),90);assert.equal(r.heldHp(7,90),100);
  r.clock=2;r.flushPending();assert.deepEqual(heard,['hit:siren','hit:frost_witch','kill:undefined']);assert.equal(r.heldHp(7,60),undefined);assert.equal(r.ghosts.length,0);
  r.landed=null;assert.doesNotThrow(()=>r.applyHit({hero:'siren',...p,damage:1}));
});

test('six skill visuals survive and a seventh evicts the oldest non-sequenced visual first',()=>{
  const r=view(),p={uid:4,...pathPoint(600)};r.event(event('queen',[p],{tax:20}));for(let i=0;i<5;i++)r.event(event('snow_rabbit'));
  assert.equal(r.skills.length,6);const firstNormal=r.skills[1].uid;r.event(event('snow_rabbit'));
  assert.equal(r.skills.length,6);assert.equal(r.skills[0].hero,'queen');assert.ok(!r.skills.some(s=>s.uid===firstNormal));assert.equal(r.goldHolds.length,1);
});

test('evicting a sequenced visual lands its queued hits, kills, coins and slide',()=>{
  for(const flushFirst of [false,true]){
    const r=view(),heard=[],p={uid:4,...pathPoint(600)},enemy={uid:4,hp:100,maxHp:100,kind:'grunt',progress:600};snapshot(r.fx,[enemy]);r.landed=e=>heard.push(e.type);
    r.event({type:'hit',hero:'queen',...p,damage:30});r.event({type:'kill',...p,kind:'grunt'});r.event(event('queen',[p],{tax:20}));const uid=r.skill.uid;r.moves.set(4,{skillUid:uid,from:900,start:0,dur:2,ease:x=>x});if(flushFirst)r.flushPending();
    for(let i=0;i<6;i++)r.event(event('queen',[],{tax:20}));
    assert.equal(r.skills.length,6);assert.ok(!r.skills.some(s=>s.uid===uid));assert.ok(!r.moves.has(4));assert.equal(r.goldHolds.length,6);assert.equal(r.takeGoldPulse(),true);
    r.flushPending();assert.deepEqual(heard,['hit','kill']);assert.equal(r.releases.length,0);assert.equal(r.ghosts.length,0);assert.ok(!r.holds.some(h=>h.skillUid===uid));
  }
});

test('evicting one of two same-hero casts leaves the other cast held',()=>{
  const r=view(),heard=[],p={uid:4,...pathPoint(600)},enemy={uid:4,hp:100,maxHp:100,kind:'grunt',progress:600};snapshot(r.fx,[enemy]);r.landed=e=>heard.push(e.damage);
  r.event({type:'hit',hero:'queen',...p,damage:10});r.event(event('queen',[p]));const old=r.skill.uid;
  r.event({type:'hit',hero:'queen',...p,damage:20});r.event(event('queen',[p]));const kept=r.skill.uid;
  for(let i=0;i<5;i++)r.event(event('queen',[]));assert.ok(!r.skills.some(s=>s.uid===old));r.flushPending();
  assert.deepEqual(heard,[10]);assert.equal(r.releases.length,1);assert.equal(r.releases[0].skillUid,kept);r.clock=2;r.flushPending();assert.deepEqual(heard,[10,20]);
});

test('gold holds preserve affordability, land on a spend, and never make the HUD negative',()=>{
  const r=view();r.watchGold(100);r.goldHolds.push({skillUid:1,amount:20,until:2});assert.equal(r.displayGold(100,[70,120]),80);assert.equal(r.takeGoldPulse(),false);
  assert.equal(r.displayGold(100,[90]),100);assert.equal(r.takeGoldPulse(),true);assert.equal(r.takeGoldPulse(),false);
  r.goldHolds.push({skillUid:2,amount:20,until:2});r.watchGold(95);assert.equal(r.heldGold(),0);assert.equal(r.takeGoldPulse(),true);
  r.goldHolds.push({skillUid:3,amount:20,until:2});r.settleGold();assert.equal(r.heldGold(),0);assert.equal(r.takeGoldPulse(),true);
  r.goldHolds.push({skillUid:4,amount:20,until:2});assert.equal(r.displayGold(5,[]),5);assert.equal(r.takeGoldPulse(),true);
  r.goldHolds.push({skillUid:5,amount:20,until:2});assert.equal(r.displayGold(5,[]),0);assert.equal(r.takeGoldPulse(),false);
});

test('white flashes cache by image identity and full cell geometry',()=>{
  const r=view(),a={src:'aaa'},b={src:'bbb'},one=r.white(a,0,0,64,64);assert.equal(r.white(a,0,0,64,64),one);assert.notEqual(r.white(b,0,0,64,64),one);assert.notEqual(r.white(a,0,0,32,64),one);
});

test('warm-up shares only the cache, preserves the random stream, and reuses warmed pieces',()=>{
  const r=view(),random=Math.random,marker=()=>.123;r.fx.palette='v1';r.fx.impacts.push({type:'original'});r.shake=7;r.hitstop=.3;const fxBefore=r.fx.impacts.slice();Math.random=marker;
  try{warmHero(r,'queen');assert.equal(Math.random,marker);assert.ok(r.fx.urCache.size>0);assert.ok([...r.fx.urCache.keys()].some(k=>k.startsWith('v1|')));const n=r.fx.urCache.size;warmHero(r,'queen');assert.equal(r.fx.urCache.size,n);assert.deepEqual(r.fx.impacts,fxBefore);assert.equal(r.shake,7);assert.equal(r.hitstop,.3);assert.deepEqual(r.floats,[]);}
  finally{Math.random=random;}
});

test('warm-up yields between idle slices, preserves RNG and stops for an old renderer',()=>{
  const r=view(),old=globalThis.requestIdleCallback,random=Math.random,marker=()=>.123,queue=[];globalThis.requestIdleCallback=fn=>queue.push(fn);Math.random=marker;
  try{let active=true;warmUltimates(r,['queen','luna','queen','siren'],()=>active);for(let i=0;i<6;i++){assert.equal(queue.length,1);queue.shift()({timeRemaining:()=>0});assert.equal(Math.random,marker);}assert.ok(r.fx.urCache.size>0);const n=r.fx.urCache.size;active=false;queue.shift()({timeRemaining:()=>0});assert.equal(r.fx.urCache.size,n);assert.equal(queue.length,0);}
  finally{Math.random=random;if(old===undefined)delete globalThis.requestIdleCallback;else globalThis.requestIdleCallback=old;}
});

test('behemoth: the three engine blows land in order, the finale reaches every crater, and the warm-up covers them',()=>{
  const entry=ENTRIES.find(e=>e.key==='behemoth'),scene=reviewScene(entry,{kills:false}),fx=new CombatFX(canvas().getContext('2d'),art()),r=view();fx.s=scene.state;snapshot(fx,scene.state.enemies);
  warmHero(r,'behemoth',scene.state.deck);fx.urCache=r.fx.urCache;const warmed=new Set(fx.urCache.keys()),spec=UR_SPECS.behemoth;
  const events=scene.cast(),cast=events.find(e=>e.type==='skill'&&e.hero==='behemoth');assert.equal(cast?.kind,'crush');
  const skill={...cast,uid:1,life:2.4,total:2.4};checked(fx.ctx,()=>spec.plan(fx,skill),'plan');for(const e of events)fx.event(e);
  const phases=[];let finale=null;
  for(let frame=0;frame<=200;frame++){
    const age=frame/60;fx.clock=age;skill.life=Math.max(0,2.4-age);
    for(const e of scene.advance(1/60)){if(e.type==='crushPhase')phases.push(e.phase);fx.event(e);}snapshot(fx,scene.state.enemies);
    finale=finale||fx.impacts?.find?.(e=>e.type==='urFx'&&e.phase===2)||null;
    checked(fx.ctx,()=>{for(const name of ['field','over','body'])spec[name](fx,skill,age);fx.draw(1/60);},'behemoth '+age);
  }
  assert.deepEqual(phases,[0,1,2]);assert.equal(fx.crushHits.filter(Boolean).length,3);
  if(finale)assert.equal(finale.prev.length,2);
  assert.deepEqual([...fx.urCache.keys()].filter(key=>!warmed.has(key)),[],'behemoth created an unwarmed canvas');
});

test('rumi dream form: the four engine volleys rise and strike in order and every layer draws cleanly',()=>{
  const entry=ENTRIES.find(e=>e.key==='rumi-dream'),scene=reviewScene(entry,{kills:true}),fx=new CombatFX(canvas().getContext('2d'),art());fx.s=scene.state;snapshot(fx,scene.state.enemies);
  const events=scene.cast(),cast=events.find(e=>e.type==='skill'&&e.hero==='rumi');assert.equal(cast?.kind,'dream');for(const e of events)fx.event(e);
  const skill={...cast,uid:1,life:2.9,total:2.9},phases=[];
  for(let frame=0;frame<=200;frame++){
    const age=frame/60;fx.clock=age;skill.life=Math.max(0,2.9-age);
    for(const e of scene.advance(1/60)){if(e.type==='dreamPhase')phases.push(e.phase);fx.event(e);}snapshot(fx,scene.state.enemies);
    checked(fx.ctx,()=>{DREAM.field(fx,skill,age);DREAM.over(fx,skill,age);fx.draw(1/60);},'dream '+age);
  }
  assert.deepEqual(phases,[0,1,2,3]);assert.equal(fx.dreamStrikes.size,4);
});
