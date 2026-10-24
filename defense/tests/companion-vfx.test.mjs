import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {HERO,ASSET_PATHS} from '../src/content.js';
import {COMPANION_VISUALS,drawCompanionShot} from '../src/combat/companion-vfx.js';
import {attackGeometry} from '../src/combat/engine.js';
import {CombatFX} from '../src/combat/effects.js';
import {reviewScene} from '../scripts/sol-review-scene.mjs';
import {assetFile} from '../scripts/local-inputs.mjs';
// The Sol-pass snapshots (gameplay baseline, selected SD atlases) were superseded on purpose by PR #629: the cast v2
// test in assets.test.mjs now pins the installed atlases and face centres.
test('all sixteen painted FX cells keep a transparent gutter so adjacent effects cannot leak',async()=>{
  const atlases=[...new Set(Object.values(COMPANION_VISUALS).map(p=>p.atlas))];
  let bytes=0;
  for(const id of atlases){
    // The shipped (optimized) copies carry the size budget; the packed sources are lossless.
    const file=assetFile(ASSET_PATHS[id]),stat=await fs.stat(assetFile(ASSET_PATHS[id].replace('./assets/merge/','./assets/optimized/merge/')));bytes+=stat.size;
    for(let n=0;n<8;n++){
      const data=await sharp(file).extract({left:n%4*256,top:Math.floor(n/4)*256,width:256,height:256}).ensureAlpha().raw().toBuffer();let painted=0;
      for(let y=0;y<256;y++)for(let x=0;x<256;x++){const a=data[(y*256+x)*4+3];if(a>20)painted++;if(x<12||x>=244||y<12||y>=244)assert.equal(a,0,id+' '+n+' gutter');}
      assert.ok(painted>600,id+' '+n+' empty cell');
    }
  }assert.ok(bytes<640*1024,'two shipped companion effect atlases fit the 640KiB budget');
});
test('new ultimates do not also fire borrowed generic target emblems',()=>{
  const origin={x:360,y:420},targets=[{x:76,y:440,uid:1},{x:644,y:420,uid:2}];
  for(const id of Object.keys(COMPANION_VISUALS)){
    const fx=new CombatFX({}, {images:{}});
    fx.event({type:'skill',hero:id,kind:HERO[id].skill.type,origin,targets,rank:3});
    assert.ok(fx.impacts.every(e=>!['ultimate','support'].includes(e.type)),id+' duplicate borrowed ultimate');
    if(id==='toffee_apple')assert.equal(fx.impacts.length,0,'placing a mine is not an immediate field hit');
    if(id==='cure_master')assert.ok(fx.impacts.every(e=>e.type==='lemonPop'),'protection markers belong to allies');
  }
  const legacy=new CombatFX({}, {images:{}});legacy.event({type:'skill',hero:'zeke',kind:HERO.zeke.skill.type,origin,targets,rank:3});
  assert.ok(legacy.impacts.some(e=>e.type==='ultimate'),'other heroes retain their existing effects');
  const sacrifice=new CombatFX({}, {images:{}});sacrifice.event({type:'reduce',hero:'siren',by:'ash',x:300,y:400,index:6});
  assert.equal(sacrifice.impacts[0].by,'ash','the dispatcher must preserve the cause of an ally disappearing');
});
test('the piercing glaze follows the live collision axis when an enemy moves',()=>{
  const calls=[],origin={x:360,y:420},target={x:644,y:500};
  const shot={hero:'toffee_apple',origin,to:{x:100,y:200},rank:3};
  const fx={art:{images:{[COMPANION_VISUALS.toffee_apple.atlas]:{}}},atlasStamp:(...args)=>calls.push(args)};
  assert.equal(drawCompanionShot(fx,shot,{}, {x:0,y:0,angle:0,t:.5,target}),true);
  assert.ok(Math.abs(calls[0][8]-attackGeometry(HERO.toffee_apple,origin,target).angle)<1e-10);
  assert.equal(calls[0][6],HERO.toffee_apple.range);
});
test('global candy-bomb receipts include distant and lethal hits after the mine detonates',()=>{
  const fixture=reviewScene('toffee_apple',{mode:'skill'}),s=fixture.state,ids=s.enemies.map(e=>e.uid);
  // One lethal target is far outside the old decorative 170px circle.
  const lethal=s.enemies.at(-1).uid;s.enemies.at(-1).hp=1;
  let events=[];for(let i=0;i<90;i++)events.push(...fixture.advance(1/60));
  const blast=events.find(e=>e.type==='bombBlast');assert.ok(blast);
  assert.deepEqual(blast.targets.map(p=>p.uid).sort((a,b)=>a-b),[...ids].sort((a,b)=>a-b));
  assert.ok(blast.targets.some(p=>Math.hypot(p.x-blast.x,p.y-blast.y)>170));
  assert.ok(events.some(e=>e.type==='kill'&&e.color===HERO.toffee_apple.color),'lethal damage still resolves');
  assert.ok(!s.enemies.some(e=>e.uid===lethal),'receipt survives the removal of a dead target');
});
