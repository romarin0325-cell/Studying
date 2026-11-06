// Optical framing belongs to UI, not to the anatomical head-size measurements.
// Offsets are authored translations in the source's 512px front frame.
// Luna's hood needs room above the face and along the brim.
// Doom's new front frame uses the reviewed optical center and crop.
export const PORTRAIT_NUDGE=Object.freeze({
  toffee_apple:[-7,0],
  harmonious:[-7,0],
  time_magician:[-7,0],
  luna:[1,-13],
  doom:[3,5],
  rumi:[0,-8],
  phantom:[0,8],
  demon_king:[0,-16],
  gold_dragon:[0,6]
});
const PORTRAIT_SIZE=Object.freeze({gold_dragon:240,luna:272,doom:230});
export function portraitFrame(hero){
  const p=hero?.art?.portrait;if(!p)return null;
  const [dx,dy]=PORTRAIT_NUDGE[hero.id]||[0,0];
  return {...p,x:p.x+dx,y:p.y+dy,size:PORTRAIT_SIZE[hero.id]??p.size};
}
