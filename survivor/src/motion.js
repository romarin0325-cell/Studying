import {clamp} from './content.js';

export const FIXED_DT=1/60;
export const visualX=(actor,alpha=1)=>(actor.prevX??actor.x)+(actor.x-(actor.prevX??actor.x))*clamp(alpha,0,1);
export const visualY=(actor,alpha=1)=>(actor.prevY??actor.y)+(actor.y-(actor.prevY??actor.y))*clamp(alpha,0,1);
export const cameraBlend=dt=>-Math.expm1(-9*Math.max(0,dt));
// Integrate a linearly moving target over this render interval. Exponential
// damping alone follows a stationary target exactly; this also removes dt-sized
// lag changes when the render cadence fluctuates while the player keeps walking.
export function followCamera(value,previousTarget,target,dt){
  if(dt<=0)return value;const blend=cameraBlend(dt);
  return target+(value-previousTarget)*(1-blend)-(target-previousTarget)*blend/(9*dt);
}
export function playerPose(player,alpha=1,input={x:0,y:0}){
  const distance=(player.prevMoveDistance??player.moveDistance??0)+((player.moveDistance??0)-(player.prevMoveDistance??player.moveDistance??0))*clamp(alpha,0,1);
  return {x:visualX(player,alpha),y:visualY(player,alpha),distance,moving:!!player.moving||player.dash>0||Math.hypot(input.x,input.y)>.08};
}
