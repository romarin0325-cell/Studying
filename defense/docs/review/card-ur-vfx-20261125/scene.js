// Card companion UR ultimates (2026-11-25): Victoria and Sakura, with the cast's buff and single-strike ultimates as references.
// The fixtures are the shared pass-21 ones (../ur-vfx-20261106/scene.js), so tests/ur-vfx.test.mjs plays the same casts.
import {ENTRIES as ALL,ROSTERS,reviewScene,isUltimateUR} from '../ur-vfx-20261106/scene.js';
const KEYS=['victoria','victoria-charge','sakura','sakura-top','jasmine','harmony','rumi','cherry','red-dragon'];
const REFERENCE=new Set(['jasmine','harmony','rumi','cherry','red-dragon']);
export const ENTRIES=Object.freeze(KEYS.map(key=>{const e=ALL.find(x=>x.key===key);if(!e)throw Error('missing scene '+key);
  return REFERENCE.has(key)?{...e,batch:0,note:'비교 기준(이번에 바꾸지 않음). '+e.note}:e;}));
export {ROSTERS,reviewScene,isUltimateUR};
