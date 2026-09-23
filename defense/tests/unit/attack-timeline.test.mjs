import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../../js/battle/BattleSession.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../../js/core/enums.js';
import { ViewportLayout } from '../../js/render/ViewportLayout.js';
import { HERO_BY_ID } from '../../js/content/heroes.js';

test('a square arena can rotate with the device without changing distance scale', () => {
  const layout=new ViewportLayout({battlefield:true});
  layout.resize(360,360,3,true);
  assert.equal(layout.landscape,true);
  const a=layout.logicalToCanvas(2,3), b=layout.logicalToCanvas(6,3), c=layout.logicalToCanvas(2,7);
  assert.ok(Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-Math.hypot(c.x-a.x,c.y-a.y))<1e-9);
  assert.equal(b.x,a.x); assert.ok(b.y>a.y);
});

function fixture({ archetype = 'burst', skill = true, area = false } = {}) {
  const session = new BattleSession({ stageId: 'ancient_ruins', seed: 'arrival-regression',
    formation: { mainId: 'rumi', heroIds: ['snow_rabbit','avalanche_maid','guardian','storm_sage'] } });
  const state = session.state, hero = state.heroes[0];
  state.phase = BATTLE_PHASE.WAVE_RUNNING;
  state.stage = { ...state.stage, path: Array.from({length:12}, (_,x)=>({x,y:0})) };
  state.wave.number = 1; state.wave.spawnQueue = ['ruin_scarab']; state.wave.spawnTimer = 999;
  state.waveRng = { next: () => .99 };
  Object.assign(hero, { placed: true, x: 0, y: 1, attackTimer: skill ? 999 : 0, skillTimer: skill ? 0 : 999 });
  hero.definition = { ...hero.definition,
    attack: { ...hero.definition.attack, archetype, range:8, radius:1, interval:50, damage:40 },
    skill: { ...hero.definition.skill, cooldown:50, damage:40, shape:area?'area':'single', radius:1, onHitEffects:[] },
  };
  const addEnemy = (id, progress) => state.registry.add('enemies', {
    id, enemyId:'ruin_scarab', name:id, definition:{}, element:'nature', defenseType:'normal',
    hp:1000, maxHp:1000, speed:0, progress, spawnOrder:state.enemies.size+1,
    x:progress+.5, y:.5, statuses:{}, dead:false, reachedCore:false,
  });
  const enemy = addEnemy('target',3);
  const events = [];
  const step = () => { const snapshot = session.step(); events.push(...session.consumeVisualEvents()); return snapshot; };
  const until = predicate => { for(let i=0;i<200;i++) { if(predicate())return; step(); } assert.fail('attack phase did not resolve'); };
  return {session,state,hero,enemy,addEnemy,events,step,until};
}

test('Time Ruler clock presentation survives content creation and shares the real impact event', () => {
  const f=fixture({area:true});
  f.hero.definition={...f.hero.definition,skill:HERO_BY_ID.time_ruler.skill};
  f.until(()=>f.session.snapshot().projectiles[0]?.phase==='flight');
  assert.equal(f.session.snapshot().projectiles[0].vfx,'clock');
  assert.equal(f.enemy.hp,1000);
  f.until(()=>f.enemy.hp<1000);
  const collapse=f.events.find(event=>event.effectPreset==='skill_area_hit' && event.visualOnly);
  assert.equal(collapse.vfx,'clock');
  assert.equal(f.session.snapshot().projectiles.length,0);
});

for (const skill of [false,true]) test(`${skill?'skill':'basic missile'} applies HP, hit feedback and damage numbers only at arrival`, () => {
  const f=fixture({skill}); f.step();
  assert.equal(f.session.snapshot().projectiles[0].phase,'windup');
  assert.equal(f.enemy.hp,1000); assert.equal(f.events.some(e=>e.type==='hit'),false);
  f.until(()=>f.session.snapshot().projectiles[0]?.phase==='flight');
  assert.equal(f.enemy.hp,1000);
  const projectile=f.session.snapshot().projectiles[0];
  assert.ok(projectile.duration>0);
  f.step();
  assert.ok(f.session.snapshot().projectiles[0].progress>0);
  assert.equal(f.enemy.hp,1000);
  f.until(()=>f.enemy.hp<1000);
  assert.equal(f.session.snapshot().projectiles.length,0);
  assert.equal(f.events.filter(e=>e.type==='hit' && Number.isFinite(e.amount)).length,1);
  assert.ok(f.events.findIndex(e=>e.type==='attack_prepare') < f.events.findIndex(e=>e.type==='attack_launched'));
  assert.ok(f.events.findIndex(e=>e.type==='attack_launched') < f.events.findIndex(e=>e.type==='hit'));
});

test('a ready basic cannot consume the same hero signature skill target before arrival', () => {
  const f=fixture(); f.hero.attackTimer=0; f.hero.definition.attack.damage=2000;
  f.until(()=>f.events.some(event=>event.type==='hit' && event.amount>0));
  assert.equal(f.events.find(event=>event.type==='hit' && event.amount>0).actionKind,'skill');
  assert.equal(f.hero.stats.skills,1);
  assert.ok(f.enemy.hp>0,'the skill hit before the lethal basic');
  f.until(()=>f.enemy.dead);
  assert.equal(f.events.filter(event=>event.type==='hit' && event.amount>0).at(-1).actionKind,'basic');
});

test('melee skills impact at release without a projectile flight', () => {
  const f=fixture(); f.hero.definition.skill.shape='melee'; f.step();
  assert.equal(f.session.snapshot().projectiles[0].phase,'windup');
  f.until(()=>f.enemy.hp<1000);
  assert.equal(f.session.snapshot().projectiles.length,0);
  assert.equal(f.events.find(event=>event.type==='attack_launched').duration,0);
});

test('pause freezes a live projectile and rotation does not alter its impact tick', () => {
  const f=fixture(); f.until(()=>f.session.snapshot().projectiles[0]?.phase==='flight');
  const before=f.session.snapshot(), beforeTick=f.state.tick; f.state.paused=true;
  for(let i=0;i<60;i++) f.session.step(FIXED_TICK_SECONDS,{landscape:true});
  assert.deepEqual(f.session.snapshot().projectiles,before.projectiles);
  assert.equal(f.state.tick,beforeTick); assert.equal(f.enemy.hp,1000);
  f.state.paused=false; f.until(()=>f.enemy.hp<1000);
  const control=fixture();
  while(control.enemy.hp===1000) control.session.step(FIXED_TICK_SECONDS,{landscape:true});
  assert.equal(f.state.tick,control.state.tick); assert.equal(f.enemy.hp,control.enemy.hp);
});

test('1x and 2x presentation produce the same simulation impact and damage', () => {
  const results=[];
  for(const speed of [1,2]) {
    const f=fixture(); f.state.speed=speed;
    for(let frame=0;frame<200 && f.enemy.hp===1000;frame++)
      for(let i=0;i<speed && f.enemy.hp===1000;i++) f.step();
    results.push([f.state.tick,f.enemy.hp]);
  }
  assert.deepEqual(results[0],results[1]);
});

test('a committed missile does not damage or silently switch from a dead target', () => {
  const f=fixture(); f.until(()=>f.session.snapshot().projectiles[0]?.phase==='flight');
  f.enemy.dead=true; f.enemy.hp=0;
  const other=f.addEnemy('other',4);
  f.until(()=>!f.state.registry.projectiles.size);
  assert.equal(other.hp,1000); assert.equal(f.hero.stats.damage,0);
  assert.equal(f.events.filter(e=>e.type==='hit' && Number.isFinite(e.amount)).length,0);
});

test('ground-targeted AoE checks occupants at arrival rather than at launch', () => {
  const f=fixture({area:true}), entrant=f.addEnemy('entrant',0);
  f.until(()=>f.session.snapshot().projectiles[0]?.phase==='flight');
  const landing=f.session.snapshot().projectiles[0].targetX;
  f.enemy.progress=9; entrant.progress=3;
  f.until(()=>!f.state.registry.projectiles.size);
  assert.equal(f.enemy.hp,1000); assert.ok(entrant.hp<1000);
  const burst=f.events.find(e=>e.effectPreset==='skill_area_hit' && e.visualOnly);
  assert.equal(burst.x,landing);
});

test('laser damage and the full beam occur together on release with no fake flight', () => {
  const f=fixture({skill:false,archetype:'laser'}); f.step();
  assert.equal(f.enemy.hp,1000);
  f.until(()=>f.enemy.hp<1000);
  assert.equal(f.state.registry.projectiles.size,0);
  assert.ok(f.events.some(e=>e.effectPreset==='basic_laser_hit' && e.visualOnly));
  assert.ok(f.events.some(e=>e.effectPreset==='basic_laser_hit' && e.amount>0));
});

test('wave completion waits for in-flight attacks to settle', () => {
  const f=fixture(); f.until(()=>f.session.snapshot().projectiles[0]?.phase==='flight');
  f.state.wave.spawnIndex=1; f.enemy.dead=true; f.enemy.hp=0; f.step();
  assert.equal(f.state.phase,BATTLE_PHASE.WAVE_RUNNING);
  f.until(()=>!f.state.registry.projectiles.size);
  assert.equal(f.state.phase,BATTLE_PHASE.INTERMISSION);
});

for(const [width,height] of [[320,400],[390,650],[844,320],[1024,768]])
  test(`12x12 arena preserves circular range and input mapping at ${width}x${height}`,()=>{
    const layout=new ViewportLayout({battlefield:true}); layout.resize(width,height,2);
    assert.equal(layout.boardRect.width,layout.boardRect.height);
    const center=layout.logicalToCanvas(6,6), east=layout.logicalToCanvas(9,6), north=layout.logicalToCanvas(6,3);
    const distance=point=>Math.hypot(point.x-center.x,point.y-center.y);
    assert.ok(Math.abs(distance(east)-distance(north))<1e-8);
    assert.ok(Math.abs(distance(east)-layout.logicalRadiusToCanvas(3))<1e-8);
    const mapped=layout.clientToLogical(east.x,east.y,{left:0,top:0,width,height});
    assert.ok(Math.abs(mapped.x-9)<1e-8 && Math.abs(mapped.y-6)<1e-8);
  });
