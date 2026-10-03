import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {freshProfile,normalizeProfile,buyMeta,metaCost,settle,Storage,PROFILE_KEY} from '../src/profile.js';
import {META} from '../src/content.js';
test('only completed runs settle, achievements reward once and duplicate settlement is impossible',()=>{
  const p=freshProfile(),g=new Game({runId:'once'});assert.equal(settle(p,g),null);g.kills=140;g.time=180;g.finish(false);const result=settle(p,g);assert.ok(result.reward>0);assert.ok(result.earned.some(a=>a.id==='first'));const balance=p.crystals;assert.equal(settle(p,g),null);assert.equal(p.crystals,balance);assert.equal(p.runs,1);
  const next=new Game({runId:'twice'});next.kills=140;next.finish(false);assert.equal(settle(p,next).earned.some(a=>a.id==='first'),false);
});
test('memory purchases consume exact currency, cap upgrades and never affect another profile',()=>{
  const p=freshProfile();assert.equal(buyMeta(p,'power'),false);p.crystals=1000000;let spent=0;for(let i=0;i<20;i++){spent+=metaCost(p,'power');assert.equal(buyMeta(p,'power'),true);}assert.equal(buyMeta(p,'power'),false);assert.equal(p.crystals,1000000-spent);assert.equal(buyMeta(p,'unknown'),false);assert.equal(freshProfile().meta.power,0);
});
test('memory prices climb by 1.45 and twenty ranks stay a long goal',()=>{
  const power=freshProfile();
  assert.deepEqual([0,1,2,3,4,5,6,7,8,9].map(level=>{power.meta.power=level;return metaCost(power,'power');}),[60,85,125,185,265,385,560,810,1170,1700]);
  let total=0;
  for(const def of META){const profile=freshProfile();for(let level=0;level<def.max;level++){profile.meta[def.id]=level;total+=metaCost(profile,def.id);}}
  assert.equal(total,1274570);assert.equal(metaCost(freshProfile(),'missing'),Infinity);
});
test('unavailable local storage is recoverable and corrupt profile bytes are preserved',()=>{
  const broken={getItem(){throw new Error();},setItem(){throw new Error();},removeItem(){throw new Error();}},store=new Storage(broken);assert.deepEqual(store.loadProfile(),freshProfile());assert.equal(store.write(PROFILE_KEY,'memory'),false);assert.equal(store.read(PROFILE_KEY),'memory');store.remove(PROFILE_KEY);assert.equal(store.read(PROFILE_KEY),null);
  const corrupt=new Storage({getItem(){return '{bad';}});assert.deepEqual(corrupt.loadProfile(),freshProfile());assert.equal(corrupt.corrupt,'{bad');
});
test('backup normalization clamps purchases, ignores unknown identities and enforces schema',()=>{
  const p=freshProfile();p.meta.power=100;p.crystals=-90;p.travelers=['rumi','hacker','rumi'];p.settings.volume=55;p.settings.effects='false';const q=normalizeProfile(p);assert.equal(q.meta.power,20);assert.equal(q.crystals,0);assert.deepEqual(q.travelers,['rumi']);assert.equal(q.settings.volume,1);assert.equal(q.settings.effects,true);assert.throws(()=>normalizeProfile({version:2}));
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
