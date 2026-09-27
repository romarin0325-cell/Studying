import test from 'node:test';
import assert from 'node:assert/strict';
import {previousSkullBox} from '../../../scripts/build_defense_head_review.mjs';
import {anatomicalScale} from '../../../scripts/pack_defense_directions.mjs';

test('before overlay transforms only the previous skull using its own feet, scale and anchor',()=>{
  const previous={id:'zeke',anchor:[240,470],source:{anatomy:{skull:[10,20,50,80]},feet:[[30,100]],scale:.5}};
  assert.deepEqual(previousSkullBox(previous),[230,430,250,460]);
  // A stale separate annotation must not override a snapshot's own anatomy.
  assert.deepEqual(previousSkullBox(previous,{id:'zeke',packedSkull:[1,2,3,4]}),[230,430,250,460]);
});

test('a legacy snapshot requires an explicit annotation tied to that previous atlas hash',()=>{
  const previous={id:'zeke',sha256:'old-atlas',source:{feet:[[30,100]],scale:.5}};
  const annotation={id:'zeke',atlasSha256:'old-atlas',packedSkull:[190,215,316,332]};
  assert.deepEqual(previousSkullBox(previous,annotation),annotation.packedSkull);
  assert.throws(()=>previousSkullBox(previous),/previous skull landmarks missing/);
  assert.throws(()=>previousSkullBox(previous,{...annotation,atlasSha256:'different-atlas'}),/previous skull landmarks missing/);
});

test('malformed previous anatomy fails rather than silently borrowing another coordinate system',()=>{
  const previous={id:'zeke',anchor:[256,480],source:{anatomy:{skull:[50,20,10,80]},feet:[[30,100]],scale:.5}};
  assert.throws(()=>previousSkullBox(previous),/invalid previous skull transform/);
});

test('a documented Cinderella head override leaves every other companion scale unchanged',()=>{
  const profile={head:{frontWidth:160,height:150},headOverrides:{cinderella:{scale:.95}}},skull=[0,0,160,150];
  assert.equal(anatomicalScale(skull,profile,'cinderella'),.95);
  assert.equal(anatomicalScale(skull,profile,'zeke'),1);assert.equal(anatomicalScale(skull,profile),1);
  assert.throws(()=>anatomicalScale(skull,{...profile,headOverrides:{cinderella:{scale:0}}},'cinderella'),/Invalid documented/);
});
