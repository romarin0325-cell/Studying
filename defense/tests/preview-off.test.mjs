import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,command,validateProfile} from '../src/profile.js';
import {HEROES,TIERS} from '../src/content.js';
import {TEAM_SIZE} from '../src/team-config.js';
import {REQUEST_HEROES} from '../src/preview/requests-data.js';

const NOW=Date.parse('2026-10-04T03:00:00Z');

test('oath, twin and requests work without the preview flag and the profile still validates',()=>{
  const p=createProfile(NOW);
  assert.equal(p.oath,undefined);assert.equal(p.twin,undefined);assert.equal(p.requests,undefined);
  p.cleared=TIERS.easy.unlock;
  const oath=command(p,'begin',{mode:'oath',tier:'easy',oaths:[]},NOW);
  assert.equal(oath.ok,true,oath.message);
  assert.equal(p.active.mode,'oath');
  assert.equal(validateProfile(p),true);
  const settled=command(p,'settle',{token:p.active.token,round:1,won:true},NOW);
  assert.equal(settled.ok,true,settled.message);
  const ids=HEROES.map(h=>h.id);
  for(const id of ids.slice(0,TEAM_SIZE*2))p.heroes[id].owned=true;
  const party={left:{deck:ids.slice(0,TEAM_SIZE),relics:[]},right:{deck:ids.slice(TEAM_SIZE,TEAM_SIZE*2),relics:[]}};
  const twin=command(p,'twinParty',party,NOW);
  assert.equal(twin.ok,true,twin.message);
  const arrived=command(p,'requestArrive',{},NOW);
  assert.equal(arrived.ok,true,arrived.message);
  assert.equal(arrived.arrived.length,1);
  assert.ok(REQUEST_HEROES.some(id=>arrived.arrived[0].startsWith(id+'-')));
  assert.equal(validateProfile(p),true);
  assert.equal(command(p,'begin',{mode:'nope'},NOW).message,'원정 종류를 확인하세요.');
});
