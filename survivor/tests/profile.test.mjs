import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {freshProfile,normalizeProfile,buyMeta,metaCost,settle,Storage,PROFILE_KEY} from '../src/profile.js';
test('only completed runs settle, achievements reward once and duplicate settlement is impossible',()=>{
  const p=freshProfile(),g=new Game({runId:'once'});assert.equal(settle(p,g),null);g.kills=140;g.time=180;g.finish(false);const result=settle(p,g);assert.ok(result.reward>0);assert.ok(result.earned.some(a=>a.id==='first'));const balance=p.crystals;assert.equal(settle(p,g),null);assert.equal(p.crystals,balance);assert.equal(p.runs,1);
  const next=new Game({runId:'twice'});next.kills=140;next.finish(false);assert.equal(settle(p,next).earned.some(a=>a.id==='first'),false);
});
test('memory purchases consume exact currency, cap upgrades and never affect another profile',()=>{
  const p=freshProfile();assert.equal(buyMeta(p,'power'),false);p.crystals=10000;let spent=0;for(let i=0;i<5;i++){spent+=metaCost(p,'power');assert.equal(buyMeta(p,'power'),true);}assert.equal(buyMeta(p,'power'),false);assert.equal(p.crystals,10000-spent);assert.equal(buyMeta(p,'unknown'),false);assert.equal(freshProfile().meta.power,0);
});
test('unavailable local storage is recoverable and corrupt profile bytes are preserved',()=>{
  const broken={getItem(){throw new Error();},setItem(){throw new Error();},removeItem(){throw new Error();}},store=new Storage(broken);assert.deepEqual(store.loadProfile(),freshProfile());assert.equal(store.write(PROFILE_KEY,'memory'),false);assert.equal(store.read(PROFILE_KEY),'memory');store.remove(PROFILE_KEY);assert.equal(store.read(PROFILE_KEY),null);
  const corrupt=new Storage({getItem(){return '{bad';}});assert.deepEqual(corrupt.loadProfile(),freshProfile());assert.equal(corrupt.corrupt,'{bad');
});
test('backup normalization clamps purchases, ignores unknown identities and enforces schema',()=>{
  const p=freshProfile();p.meta.power=100;p.crystals=-90;p.travelers=['rumi','hacker','rumi'];p.settings.volume=55;p.settings.effects='false';const q=normalizeProfile(p);assert.equal(q.meta.power,5);assert.equal(q.crystals,0);assert.deepEqual(q.travelers,['rumi']);assert.equal(q.settings.volume,1);assert.equal(q.settings.effects,true);assert.throws(()=>normalizeProfile({version:2}));
});

test('quota failure preserves the latest in-session run and cannot resurrect a removed run',()=>{
  const stale={getItem(){return 'old snapshot';},setItem(){throw new Error('quota');},removeItem(){throw new Error('denied');}},store=new Storage(stale);
  assert.equal(store.read('run'),'old snapshot');store.write('run','latest snapshot');assert.equal(store.read('run'),'latest snapshot');store.remove('run');assert.equal(store.read('run'),null);
});

test('later defeats with more kills retain the previously won chapter',()=>{
  const p=freshProfile(),win=new Game({runId:'dawn'});win.kills=700;win.time=365;win.finish(true);settle(p,win);
  const loss=new Game({runId:'another-night'});loss.kills=900;loss.time=300;loss.finish(false);settle(p,loss);
  assert.equal(p.best.garden.won,true);assert.equal(p.best.garden.kills,900);assert.equal(p.best.garden.time,365);
});
