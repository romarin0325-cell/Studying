// Optical framing belongs to UI, not to the anatomical head-size measurements.
// Offsets are tiny authored translations in the source's 512px front frame.
// Demon King's visible eyes/chin sat high: crop 16px higher so the face moves
// about 6px down in a 95px collection icon, with its scale and battle art intact.
export const PORTRAIT_NUDGE=Object.freeze({toffee_apple:[-7,0],harmonious:[-7,0],time_magician:[-7,0],doom:[0,-8],rumi:[0,-8],phantom:[0,8],demon_king:[0,-16]});
export function portraitFrame(hero){
  const p=hero?.art?.portrait;if(!p)return null;
  const [dx,dy]=PORTRAIT_NUDGE[hero.id]||[0,0];
  return {...p,x:p.x+dx,y:p.y+dy};
}
