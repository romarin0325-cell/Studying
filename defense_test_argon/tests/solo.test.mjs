import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {createProfile as mainProfile,parseProfile as mainParse,SAVE_KEY as mainKey} from '../src/profile.js';

const src=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src');
const result=await build({stdin:{contents:`export {createProfile,validateProfile,command,parseProfile,SAVE_KEY} from './profile.js';export {createBattle,resumeBattle} from './battle.js';export {validDeck,serialize,step,summon} from './combat/engine.js';export {validRecord} from './monthly.js';`,resolveDir:src},bundle:true,write:false,format:'cjs',platform:'node',define:{__GARDEN_SOLO__:'true'}});
const compiled={exports:{}};runInNewContext(result.outputFiles[0].text,{module:compiled,structuredClone},{filename:'solo-test-bundle.cjs'});const solo=compiled.exports;
const NOW=1791198000000;

test('solo build accepts exactly one hero and has a separate save and backup format',()=>{
  const p=solo.createProfile(NOW);assert.equal(p.deck.length,1);assert.equal(Object.values(p.heroes).filter(e=>e.owned).length,5);assert.ok(solo.validateProfile(p));
  assert.notEqual(solo.SAVE_KEY,mainKey);assert.equal(mainParse(p),null);assert.equal(solo.parseProfile(mainProfile(NOW)),null);
  assert.equal(solo.command(p,'deck',{ids:['star_boy','snow_rabbit']},NOW).ok,false);
  assert.equal(solo.command(p,'deck',{ids:['snow_rabbit']},NOW).ok,true);assert.ok(solo.validDeck(p.deck));
});

test('solo summons and restored combat keep every unit in the selected single-character deck',()=>{
  const p=solo.createProfile(NOW);solo.command(p,'deck',{ids:['night_rabbit']},NOW);assert.ok(solo.command(p,'begin',{mode:'main',stage:1},NOW).ok);
  const s=solo.createBattle(p);s.gold=10000;for(let i=0;i<12;i++)solo.summon(s);for(let i=0;i<100;i++)solo.step(s,.05);
  assert.ok(s.board.filter(Boolean).length>1);assert.ok(s.board.filter(Boolean).every(u=>u.hero==='night_rabbit'));
  p.active.run=solo.serialize(s);assert.ok(solo.validateProfile(p));const restored=solo.resumeBattle(p);assert.equal(restored.deck.join(),'night_rabbit');assert.ok(restored.stats.damage>0);
});

test('solo weekly draft, dispatch replacement and monthly records use the same one-hero constraint',()=>{
  const p=solo.createProfile(NOW);p.cleared=9;assert.ok(solo.command(p,'dispatch',{slot:0,id:'star_boy'},NOW).ok);assert.equal(p.deck.length,1);assert.ok(!p.deck.includes('star_boy'));
  assert.ok(solo.command(p,'begin',{mode:'weekly',stage:10},NOW).ok);assert.equal(p.active.offers.length,2);assert.ok(solo.command(p,'draft',{index:0},NOW).ok);assert.equal(p.active.draft.length,1);assert.equal(p.active.offers.length,0);assert.ok(solo.createBattle(p));assert.ok(solo.validateProfile(p));
  const record={period:'2026-10',token:'solo',round:1,damage:123,seconds:20,at:NOW,deck:[p.deck[0]]};assert.ok(solo.validRecord(record));assert.equal(solo.validRecord({...record,deck:mainProfile(NOW).deck}),false);
});
