import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatFX} from '../src/combat/effects.js';
import {boltSpine,drawLightningShot,LIGHTNING_BOLT_WINDOW,LIGHTNING_IMPACT_LIFE} from '../src/combat/lightning-vfx.js';

function fakeCtx(){
  const ctx={globalAlpha:1,globalCompositeOperation:'source-over'};
  return new Proxy(ctx,{get(target,key){if(key in target)return target[key];return ()=>{};}});
}

test('lightning bolts keep their ends, stay capped, and repeat for the same seed',()=>{
  const a=boltSpine(10,20,210,90,42,0,7,16);
  assert.deepEqual(a,boltSpine(10,20,210,90,42,0,7,16));
  assert.notDeepEqual(a,boltSpine(10,20,210,90,42,1,7,16));
  assert.equal(a.length,8);
  assert.deepEqual(a[0],[10,20]);
  assert.deepEqual(a.at(-1),[210,90]);
  const chain=boltSpine(0,0,80,10,7,0,4,11);
  assert.equal(chain.length,5);
  assert.ok(chain.length<=6);
});

test('a lightning shot draws neither a sprite nor a saved field on the shot',()=>{
  const stamps=[];
  const shot={uid:9,hero:'lightning_sage',rank:4,chainRatio:.8,extraChain:1,life:.04,total:.5,from:{x:120,y:240},to:{x:360,y:180},origin:{x:110,y:250}};
  const before=JSON.stringify(shot);
  const fx={ctx:fakeCtx(),reduced:false,quality:'standard',glow(){},stamp(...args){stamps.push(args);},atlasStamp(...args){stamps.push(args);}};
  assert.equal(drawLightningShot(fx,shot,{shots:[shot]},{x:360,y:180}),true);
  assert.equal(stamps.length,0);
  assert.equal(JSON.stringify(shot),before);
  assert.ok(shot.life<LIGHTNING_BOLT_WINDOW);
});

test('lightning impact marks stay short and chain hops are weaker copies',()=>{
  const fx=new CombatFX({},{images:{}});
  fx.event({type:'impact',hero:'lightning_sage',x:10,y:20,rank:5,angle:0});
  assert.equal(fx.impacts[0].life,LIGHTNING_IMPACT_LIFE);
  assert.equal(fx.impacts[0].total,LIGHTNING_IMPACT_LIFE);
  assert.equal(fx.impacts[0].hop,undefined);
  fx.event({type:'chain',hero:'lightning_sage',from:{x:0,y:0},to:{x:30,y:12},color:'#f2db84'});
  const hop=fx.impacts.at(-1);
  assert.equal(hop.hop,true);
  assert.equal(hop.hero,'lightning_sage');
  assert.equal(hop.life,LIGHTNING_IMPACT_LIFE);
  const other=new CombatFX({},{images:{}});
  other.event({type:'impact',hero:'zeke',x:1,y:2,rank:1});
  assert.equal(other.impacts[0].life,.3);
  other.event({type:'chain',hero:'storm_sage',from:{x:0,y:0},to:{x:8,y:8},color:'#fff'});
  assert.equal(other.impacts.at(-1).hop,undefined);
  assert.equal(other.impacts.at(-1).life,.24);
});
