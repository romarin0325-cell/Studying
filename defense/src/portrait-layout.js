// Optical framing belongs to UI, not to the anatomical head-size measurements.
// Offsets are tiny authored translations in the source's 512px front frame.
export const PORTRAIT_NUDGE=Object.freeze({toffee_apple:[-7,0],harmonious:[-7,0],time_magician:[-7,0],doom:[0,-8],rumi:[0,-8],phantom:[0,8]});
export function portraitFrame(hero){
  const p=hero?.art?.portrait;if(!p)return null;
  const [dx,dy]=PORTRAIT_NUDGE[hero.id]||[0,0];
  return {...p,x:p.x+dx,y:p.y+dy};
}
