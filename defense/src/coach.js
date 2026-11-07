// First-session coach marks. One dimmed layer with a hole over the real control, a pulsing ring, a tap or drag hint and
// one line from the guide. Input outside the hole is swallowed; the hole passes input straight to the real control, so
// the tutorial teaches the real gesture instead of a picture of it. The layer sits above the sheet overlay.
const PAD=6;
export function createCoach({onSkip}={}){
  const root=document.createElement('div');root.className='coach';root.hidden=true;root.setAttribute('aria-live','polite');
  root.innerHTML='<i class="coach-shade" data-side="t"></i><i class="coach-shade" data-side="b"></i><i class="coach-shade" data-side="l"></i><i class="coach-shade" data-side="r"></i>'
    +'<span class="coach-ring" aria-hidden="true"></span><span class="coach-tap" aria-hidden="true"><i></i><i></i></span><span class="coach-drag" aria-hidden="true"><i class="coach-path"></i><i class="coach-dot"></i></span>'
    +'<div class="coach-say"><span class="coach-face"></span><p><b class="coach-name"></b><span class="coach-line"></span></p><button class="coach-skip" type="button">건너뛰기</button></div>';
  document.body.append(root);
  const $=s=>root.querySelector(s),shades=[...root.querySelectorAll('.coach-shade')];
  let state=null,timer=0;
  // Swallow presses on the dim area (the hole has no element over it).
  for(const s of shades)for(const type of ['pointerdown','click','touchstart'])s.addEventListener(type,e=>{e.preventDefault();e.stopPropagation();$('.coach-ring').classList.remove('nudge');void root.offsetWidth;$('.coach-ring').classList.add('nudge');},{passive:false});
  $('.coach-skip').addEventListener('click',e=>{e.stopPropagation();state?.onSkip?.();onSkip?.();});
  // A target is an element, a rect, or a function returning either (looked up again on every frame).
  const rectOf=t=>{if(typeof t==='function')t=t();if(!t)return null;if(t.getBoundingClientRect){if(!t.isConnected)return null;const r=t.getBoundingClientRect();return r.width||r.height?r:null;}return Number.isFinite(t.left)?t:null;};
  function place(){
    if(!state)return;const r=rectOf(state.target),W=innerWidth,H=innerHeight;
    if(!r){root.classList.add('waiting');return;}root.classList.remove('waiting');
    const x0=Math.max(0,r.left-PAD),y0=Math.max(0,r.top-PAD),x1=Math.min(W,r.right+PAD),y1=Math.min(H,r.bottom+PAD);
    const [t,b,l,rr]=shades;
    Object.assign(t.style,{left:'0px',top:'0px',width:W+'px',height:y0+'px'});Object.assign(b.style,{left:'0px',top:y1+'px',width:W+'px',height:Math.max(0,H-y1)+'px'});
    Object.assign(l.style,{left:'0px',top:y0+'px',width:x0+'px',height:(y1-y0)+'px'});Object.assign(rr.style,{left:x1+'px',top:y0+'px',width:Math.max(0,W-x1)+'px',height:(y1-y0)+'px'});
    Object.assign($('.coach-ring').style,{left:x0+'px',top:y0+'px',width:(x1-x0)+'px',height:(y1-y0)+'px'});
    const tap=$('.coach-tap'),cx=(x0+x1)/2,cy=(y0+y1)/2;Object.assign(tap.style,{left:cx+'px',top:cy+'px'});
    if(state.drag){const a=state.drag.from(),z=state.drag.to();if(a&&z){const d=$('.coach-drag');d.style.setProperty('--ax',a.x+'px');d.style.setProperty('--ay',a.y+'px');d.style.setProperty('--dx',(z.x-a.x)+'px');d.style.setProperty('--dy',(z.y-a.y)+'px');d.style.setProperty('--len',Math.hypot(z.x-a.x,z.y-a.y)+'px');d.style.setProperty('--ang',Math.atan2(z.y-a.y,z.x-a.x)+'rad');}}
    // The line sits on the far side of the target so it never covers it.
    const say=$('.coach-say'),above=cy>H*.52;say.classList.toggle('above',above);
    say.style.top=above?'':Math.min(H-120,y1+14)+'px';say.style.bottom=above?Math.max(8,H-y0+14)+'px':'';
  }
  function show(opts){
    state=opts;root.hidden=false;root.dataset.hand=opts.drag?'drag':opts.hand===false?'none':'tap';root.classList.toggle('soft',!!opts.soft);
    $('.coach-face').innerHTML=opts.face||'';$('.coach-name').textContent=opts.name||'';$('.coach-line').textContent=opts.line||'';
    $('.coach-skip').hidden=!opts.skippable;
    const say=$('.coach-say');say.classList.remove('in');void say.offsetWidth;say.classList.add('in');
    place();clearInterval(timer);timer=setInterval(place,200);
  }
  function hide(){state=null;clearInterval(timer);root.hidden=true;root.classList.remove('waiting');}
  addEventListener('resize',()=>place());
  return {show,hide,place,get active(){return !!state;},get id(){return state?.id||null;}};
}
