import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleState } from '../../js/battle/BattleState.js';
import { createBasicAttackAction, resolveBasicAttackAction, resolveLaserHits } from '../../js/battle/systems/BasicAttackSystem.js';
import { recomputeAuras } from '../../js/battle/systems/AuraSystem.js';
import { getEffectiveRange } from '../../js/battle/systems/TargetingSystem.js';
import { placementPreview } from '../../js/battle/PlacementPreview.js';
import { calculateDirectDamage } from '../../js/battle/systems/DamageSystem.js';
import { createSkillAction, resolveSkillAction } from '../../js/battle/systems/SkillSystem.js';
import { updateStatuses } from '../../js/battle/systems/StatusSystem.js';
import { STAGES } from '../../js/content/stages.js';
import { HERO_BY_ID } from '../../js/content/heroes.js';
import { combatAnchor } from '../../js/render/CombatAnchors.js';
import { ViewportLayout } from '../../js/render/ViewportLayout.js';
import { BattleRenderer } from '../../js/render/BattleRenderer.js';
import { toggleFullscreen } from '../../js/app/Fullscreen.js';

function stateWith(ids = ['great_detective', 'flame_sage', 'siren', 'phantom']) {
  const state = createBattleState({ stageId: 'ancient_ruins', formation: { mainId: 'rumi', heroIds: ids } });
  state.heroes.forEach((h,i) => Object.assign(h, { placed: true, x: i, y: 0 }));
  state.rng = { next: () => .99 };
  return state;
}
function target(state, x, y, overrides = {}) {
  const enemy = { id:'target', x, y, hp:1000, maxHp:1000, progress:1, spawnOrder:1, defenseType:'normal', statuses:{}, ...overrides };
  state.enemies.set(enemy.id, enemy);
  return enemy;
}

for (const archetype of ['laser', 'shotgun', 'nova']) test(`${archetype}: a range-only buff reaches the same enemy in targeting, collision, preview and effects`, () => {
  const state = stateWith(), hero = state.heroes[0], base = archetype === 'laser' ? 8 : 4;
  hero.definition = { ...hero.definition, attack: { ...hero.definition.attack, archetype, range:base, radius:base,
    normalCollisionRadius:.3, bossCollisionRadius:.45, effectPreset:`basic_${archetype}_hit` } };
  const enemy = target(state, .5 + base + .5, .5);
  assert.equal(createBasicAttackAction(state, hero, 0), null);
  assert.equal(hero.stats.basicAttacks, 0);
  // An actual placed aura provider, not an injected range argument.
  const provider = state.heroes[3];
  provider.level = 6; provider.selectedTraits = { lv4:'siren_duet', lv6:'siren_starlight' };
  recomputeAuras(state);
  assert.equal(getEffectiveRange(state, hero), base + 1);
  const preview = placementPreview(state, hero.id, {x:.5,y:.5});
  assert.equal(preview.geometry.range, base + 1);
  const action = createBasicAttackAction(state, hero, 0);
  assert.ok(action.impacts.some(hit => hit.target.id === enemy.id));
  assert.deepEqual(action.geometry, preview.geometry);
  resolveBasicAttackAction(state, action);
  assert.ok(enemy.hp < enemy.maxHp, 'an attack cycle must actually deal damage beyond base range');
  const visual = state.events.filter(event => event.visualOnly);
  if (archetype === 'laser') assert.equal(visual[0].x, .5 + base + 1);
  if (archetype === 'shotgun') for (const miss of visual.filter(e => e.missed))
    assert.ok(Math.abs(Math.hypot(miss.x-.5, miss.y-.5) - (base+1)) < 1e-9);
  if (archetype === 'nova') assert.equal(visual[0].radius, base + 1);
  assert.equal(hero.definition.attack.range, base, 'the content definition stays immutable');
});

test('trait range and prospective placement aura stack without mutating live state', () => {
  const state = stateWith(), detective = state.heroes[1], siren = state.heroes[3];
  detective.level = 6; detective.selectedTraits = {lv4:'great_detective_evidence',lv6:'great_detective_search'};
  siren.level = 6; siren.selectedTraits = {lv4:'siren_duet',lv6:'siren_starlight'};
  detective.x = 10; recomputeAuras(state);
  assert.equal(getEffectiveRange(state, detective), 7.5);
  const before = [...detective.buffs.keys()];
  assert.equal(placementPreview(state, detective.id, {x:2.5,y:.5}).geometry.range, 8.5);
  assert.deepEqual([...detective.buffs.keys()], before);
  assert.equal(detective.x, 10);
});

test('new innate buffers support nearby allies while Phantom retains his independent role', () => {
  const state = stateWith();
  recomputeAuras(state);
  assert.ok(state.heroes[1].buffs.has('sun_bless'));
  assert.ok(state.heroes[1].buffs.has('moon_bless'));
  assert.equal(state.heroes[4].buffs.size, 0);
  state.heroes[3].level = 4; state.heroes[3].selectedTraits.lv4 = 'siren_duet';
  recomputeAuras(state);
  assert.ok(state.heroes[1].buffs.has('twinkle_party'), 'two placed water heroes activate the duet');
  state.heroes[1].placed = false; state.heroes[0].placed = false; recomputeAuras(state);
  assert.equal(state.heroes[3].buffs.has('twinkle_party'), false);
});

test('detective fifth basic attack is critical; skills and the next basic do not inherit it', () => {
  const state = stateWith(), hero = state.heroes[1], enemy = target(state,2.5,.5);
  hero.level = 4; hero.selectedTraits.lv4 = 'great_detective_evidence';
  const critical = [];
  for(let i=0;i<6;i++) {
    hero.attackTimer=0; const action=createBasicAttackAction(state,hero,0); resolveBasicAttackAction(state,action);
    critical.push(state.events.filter(e=>e.type==='hit' && e.amount && e.effectPreset!=='critical_hit').at(-1).critical);
  }
  assert.deepEqual(critical, [false,false,false,false,true,false]);
  hero.stats.basicAttacks=5;
  assert.equal(calculateDirectDamage({state,source:hero,target:enemy,baseDamage:10,attackType:'holy',attackKind:'skill'}).critical,false);
});

test('new fire and spore effects apply through real actions, expire, and use finite periodic damage', () => {
  const state = stateWith(['red_dragon','flame_sage','mushroom_king','siren']);
  const enemy = target(state, 2.5, .5);
  const dragon = state.heroes[1], mushroom = state.heroes[3];
  resolveSkillAction(state,createSkillAction(state,dragon,0));
  assert.equal(enemy.statuses.burn.remaining,4);
  resolveBasicAttackAction(state,createBasicAttackAction(state,mushroom,0));
  assert.equal(enemy.statuses.poison.stacks,1);
  const ticks=[];
  for(let i=0;i<61;i++) updateStatuses(state,.1,(e,amount,id)=>ticks.push({id,amount}));
  assert.ok(ticks.some(t=>t.id==='burn'&&t.amount===5));
  assert.ok(ticks.some(t=>t.id==='poison'&&t.amount===3));
  assert.equal(enemy.statuses.burn,undefined); assert.equal(enemy.statuses.poison,undefined);
});

test('all maps have true straight-line shots and late defensive cells with distinct coverage', () => {
  for (const stage of STAGES) {
    const cells=stage.map.placementCells, path=stage.map.pathCells.map((p,i)=>({...p,id:String(i),spawnOrder:i}));
    assert.equal(cells.length,15);
    for(const role of ['line','bend','crossing','support','last']) assert.ok(cells.some(c=>c.role===role));
    const beamHits=cell=>Math.max(...path.map(p=>resolveLaserHits(cell,p,path,{range:8,normalRadius:.35}).length));
    const aligned=cells.filter(c=>c.role==='line');
    assert.ok(aligned.some(c=>beamHits(c)>=6),stage.id+' has a piercing corridor');
    const straight=aligned.reduce((best,c)=>beamHits(c)>beamHits(best)?c:best);
    assert.ok(beamHits(straight)>Math.min(...cells.filter(c=>c.role==='support').map(beamHits)),stage.id+' center is not always the best laser cell');
    for(const cell of cells.filter(c=>c.role==='last')) {
      assert.ok(Math.hypot(cell.x-stage.map.core.x,cell.y-stage.map.core.y)<=2);
      assert.ok(path.slice(0,Math.floor(path.length/4)).every(p=>Math.hypot(cell.x-p.x,cell.y-p.y)>2.3),stage.id+' late cells cannot cover opening enemies with a nova');
    }
  }
});

test('placement markers reveal no role, recommended hero, reward or drawback', () => {
  const labels=[], strokes=[];
  const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{if(key==='fillText')labels.push(args[0]);},set:(_,key,value)=>{if(key==='strokeStyle')strokes.push(value);return true;}});
  const renderer=new BattleRenderer({canvas:{getContext:()=>ctx,style:{}},assetManager:{getImage:()=>null}});
  renderer.layout.resize(390,600,1);
  for(const stage of STAGES) renderer.drawPlacements(ctx,{phase:'PREPARATION',stage:{placementCells:stage.map.placementCells},heroes:[]});
  assert.equal(labels.length,60); assert.deepEqual([...new Set(labels)],['＋']);
  assert.equal(new Set(strokes).size,1,'all five internal roles have the same marker color');
});

test('fullscreen supports standard/prefixed APIs and explains unavailable or denied entry', async () => {
  let entered=0,exited=0;
  const doc={documentElement:{requestFullscreen:async()=>entered++},exitFullscreen:async()=>exited++};
  assert.equal(await toggleFullscreen(doc),''); assert.equal(entered,1);
  doc.fullscreenElement={}; assert.equal(await toggleFullscreen(doc),''); assert.equal(exited,1);
  const prefixed={documentElement:{webkitRequestFullscreen(){entered++;}},webkitExitFullscreen(){exited++;}};
  assert.equal(await toggleFullscreen(prefixed),''); assert.equal(entered,2);
  prefixed.webkitFullscreenElement={}; assert.equal(await toggleFullscreen(prefixed),''); assert.equal(exited,2);
  assert.match(await toggleFullscreen({documentElement:{}}),/홈 화면/);
  assert.match(await toggleFullscreen({documentElement:{requestFullscreen:async()=>{throw new Error('denied');}}}),/허용하지/);
});

test('combat attachment stays above the hero feet in portrait and rotated landscape', () => {
  const layout=new ViewportLayout({canvas:{style:{}},battlefield:true});
  for(const [width,height] of [[390,600],[900,390]]) {
    layout.resize(width,height,1);
    const feet=layout.logicalToCanvas(5.5,5.5), chest=combatAnchor(layout,5.5,5.5,'hero');
    assert.equal(chest.x,feet.x); assert.ok(chest.y<feet.y);
    assert.ok(Math.abs(feet.y-chest.y-layout.logicalRadiusToCanvas(.92))<1e-8);
  }
});

test('new companion identities preserve the requested genders and remain normal roster choices', () => {
  for(const [id,gender] of Object.entries({flame_sage:'male',mushroom_king:'male',great_detective:'male',phantom:'male',red_dragon:'female',siren:'female'})) {
    assert.equal(HERO_BY_ID[id].gender,gender);
    assert.equal(HERO_BY_ID[id].position,'normal');
  }
});
