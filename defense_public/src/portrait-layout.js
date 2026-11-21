// Optical framing belongs to UI, not to the anatomical head-size measurements.
// Offsets are tiny authored translations in the source's 512px front frame.
// Gold Dragon's compact visible face gets a 250/240 = 1.0417 UI zoom only.
// The tighter crop and +6px centre lift it slightly; battle anatomy stays intact.
// Demon King's visible eyes/chin sat high: crop 16px higher so the face moves
// about 6px down in a 95px collection icon, with its scale and battle art intact.
// Selected2026-11-08 atlases keep their measured/inferred head centres in data.js.
// These offsets reproduce the reviewed portrait crops, including Luna's272px window.
export const PORTRAIT_NUDGE=Object.freeze({toffee_apple:[-7,0],harmonious:[-7,0],time_magician:[-7,0],luna:[2,-2],siren:[1,-8],cherry_prince:[2,-5],doom:[7,-7],red_dragon:[0,-4],rumi:[0,-8],phantom:[0,8],demon_king:[0,-16],gold_dragon:[0,6]});
const PORTRAIT_SIZE=Object.freeze({gold_dragon:240});
export function portraitFrame(hero){
  const p=hero?.art?.portrait;if(!p)return null;
  const [dx,dy]=PORTRAIT_NUDGE[hero.id]||[0,0];
  return {...p,x:p.x+dx,y:p.y+dy,size:PORTRAIT_SIZE[hero.id]??p.size};
}
