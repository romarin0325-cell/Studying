// Lightweight DOM effects for menus: tap sparkles, hearts and reveal bursts.
// The layer never takes pointer input, and "reduced motion" turns it off.
let layer=null;
const reduced=()=>document.getElementById('app')?.dataset.reduced==='true';
function host(){
  if(!layer){layer=document.createElement('div');layer.className='fx-layer';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);}
  return layer;
}
export function burst(x,y,{count=8,color='#ffe39a',spread=46,size=10,duration=620,shape='star',rise=0}={}){
  if(reduced()||!Number.isFinite(x)||!Number.isFinite(y))return;
  const parent=host();
  for(let i=0;i<count;i++){
    const el=document.createElement('i'),angle=Math.random()*Math.PI*2,distance=spread*(.45+Math.random()*.7),s=size*(.6+Math.random()*.6);
    el.className='fx-spark '+shape;el.style.cssText=`left:${x}px;top:${y}px;width:${s}px;height:${s}px;--c:${color}`;parent.appendChild(el);
    const dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance-rise;
    const animation=el.animate([
      {transform:'translate(-50%,-50%) scale(.2) rotate(0deg)',opacity:1},
      {transform:`translate(calc(-50% + ${dx*.7}px),calc(-50% + ${dy*.7}px)) scale(1) rotate(${(Math.random()-.5)*160}deg)`,opacity:1,offset:.55},
      {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.4) rotate(${(Math.random()-.5)*260}deg)`,opacity:0},
    ],{duration:duration*(.75+Math.random()*.5),easing:'cubic-bezier(.2,.7,.3,1)'});
    animation.onfinish=()=>el.remove();animation.oncancel=()=>el.remove();
  }
}
export const tapSpark=(x,y,color)=>burst(x,y,{count:5,spread:28,size:8,duration:460,color});
export const hearts=(x,y)=>burst(x,y,{count:7,spread:54,size:15,duration:1000,shape:'heart',color:'#ff9fc0',rise:40});
export function centerOf(element){const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}
