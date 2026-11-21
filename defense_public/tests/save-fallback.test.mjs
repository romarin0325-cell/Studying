import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileStore,SAVE_KEY,createProfile,parseProfile,command} from '../src/profile.js';
import {createBattle} from '../src/battle.js';
import * as engine from '../src/combat/engine.js';

const NOW=Date.parse('2026-11-15T03:00:00Z');
// A profile in the middle of a main-stage battle, with its checkpoint saved.
function midBattle(){
  const p=createProfile(NOW);
  assert.equal(command(p,'begin',{mode:'main',stage:1},NOW).ok,true);
  p.active.run=engine.serialize(createBattle(p));
  return p;
}
// What an update that changes a permanent growth number does to a saved checkpoint:
// the multiplier recorded in the run no longer equals today's formula.
function outdated(p){
  const run=JSON.parse(p.active.run),first=Object.keys(run.meta)[0];
  run.meta[first].power=Number((run.meta[first].power*1.01).toFixed(6));
  p.active.run=JSON.stringify(run);
  return p;
}

test('an unchanged battle checkpoint is kept as it is',()=>{
  const p=midBattle(),notes={},back=parseProfile(JSON.stringify(p),notes);
  assert.ok(back);assert.equal(back.active.run,p.active.run);assert.equal(notes.runDropped,undefined);
});

test('a checkpoint that no longer restores restarts the sortie instead of locking the save',()=>{
  const p=outdated(midBattle()),notes={},back=parseProfile(JSON.stringify(p),notes);
  assert.ok(back,'the profile stays readable');
  assert.equal(back.active.run,null,'the battle restarts from wave 1');
  assert.equal(back.active.token,p.active.token,'the same sortie, not a new entry');
  assert.equal(back.active.seed,p.active.seed);
  assert.equal(back.dreams,p.dreams);assert.equal(back.cleared,p.cleared);
  assert.equal(notes.runDropped,true);
  assert.ok(createBattle(back),'the sortie can start again');
});

test('a checkpoint from another status revision is dropped the same way',()=>{
  const p=midBattle(),run=JSON.parse(p.active.run);run.statusRevision=engine.STATUS_REVISION+1;p.active.run=JSON.stringify(run);
  const back=parseProfile(JSON.stringify(p));
  assert.ok(back);assert.equal(back.active.run,null);
});

test('a profile that is wrong for another reason is still refused',()=>{
  const p=outdated(midBattle());p.dreams=-1;
  assert.equal(parseProfile(JSON.stringify(p)),null);
});

test('the store opens such a save, reports the restart and accepts commands',()=>{
  const p=outdated(midBattle()),mem=new Map([[SAVE_KEY,JSON.stringify(p)]]);
  const store=new ProfileStore({getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v))},NOW);
  assert.equal(store.broken,false);assert.equal(store.restarted,true);
  assert.equal(store.transact('tick',{},NOW).ok,true);
  const fresh=new ProfileStore({getItem:()=>null,setItem(){}},NOW);
  assert.equal(fresh.restarted,false);
});
