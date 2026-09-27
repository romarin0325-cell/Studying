import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDirections} from '../../../scripts/validate_defense_directions.mjs';
test('production art records anatomical estimates, source hashes, 21 alpha atlases and 84 distinct frames; this is not visual approval',async()=>{
  assert.deepEqual(await validateDirections(),{heroes:21,directions:84,releaseAssets:27});
});
