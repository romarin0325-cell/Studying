import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MANUAL_BALANCE } from '../docs/manual-data.js';
import { MANUAL_TABS, renderManual } from '../docs/manual-content.js';
import { HEROES, DUNGEONS } from '../content.js';
import { COLLECTIBLE_ARTIFACTS as ARTIFACTS, DIFFICULTIES } from '../meta.js';

test('manual measurements reproduce from current combat sources',()=>{
  assert.doesNotThrow(()=>execFileSync(process.execPath,[fileURLToPath(new URL('../docs/generate-manual.mjs',import.meta.url)),'--check'],{stdio:'pipe'}));
});
test('manual covers every hero, weapon, stage, difficulty and artifact',()=>{
  assert.equal(MANUAL_BALANCE.heroes.length,HEROES.length);
  assert.equal(MANUAL_BALANCE.stages.length,DUNGEONS.length*3);
  const heroHTML=renderManual('heroes'),stageHTML=renderManual('stages'),artifactHTML=renderManual('artifacts');
  HEROES.forEach((hero,i)=>{
    const row=MANUAL_BALANCE.heroes[i];assert.equal(row.id,hero.id);
    assert.ok(heroHTML.includes(`data-manual-hero="${hero.id}"`));
    hero.weapons.forEach((weapon,j)=>{assert.equal(row.weapons[j].id,weapon.id);assert.ok(heroHTML.includes(weapon.name));for(const p of [1,3,5])assert.ok(row.weapons[j].dps[p]>0);});
  });
  const scores=[];
  DUNGEONS.forEach(d=>{
    assert.ok(stageHTML.includes(`data-manual-dungeon="${d.id}"`));
    for(let room=0;room<3;room++){
      const stage=MANUAL_BALANCE.stages.find(s=>s.dungeon===d.id&&s.room===room);assert.ok(stage);
      const ordered=DIFFICULTIES.map(mode=>stage.modes[mode.id].score);
      ordered.forEach(score=>{assert.ok(Number.isInteger(score)&&score>=1&&score<=100);scores.push(score);});
      assert.deepEqual(ordered,[...ordered].sort((a,b)=>a-b));
    }
  });
  assert.equal(scores.length,144);assert.equal(Math.min(...scores),1);assert.equal(Math.max(...scores),100);
  ARTIFACTS.forEach(a=>assert.ok(artifactHTML.includes(`data-manual-artifact="${a.id}"`)));
  assert.deepEqual(MANUAL_BALANCE.heroes.map(h=>h.bomb.damage),[1058,1300,1248,773,1058,1305,1900,1058,80]);
  assert.equal(MANUAL_BALANCE.heroes[8].bomb.invincibility,2);
  assert.equal(MANUAL_BALANCE.corona.damage,2000);
  assert.equal(MANUAL_BALANCE.holyflame.damage,5500);
  assert.equal(MANUAL_BALANCE.holyflame.invincibility,2);
  for(const [id] of MANUAL_TABS)assert.ok(renderManual(id).length>500);
});
