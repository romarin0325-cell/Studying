// Bright skin ("맑은 정원") for the comparison build: node scripts/build.mjs --bright.
// The night skin stays the source of truth. This pass reads every colour in style.css by the role it plays
// (surface, ink, line, shadow) and maps it onto a daylight palette; src/theme-bright.css then adds the
// component decisions a mapping cannot make (selection, navigation, titles, panels over art).
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
function parse(token){
  let m=token.match(/^#([0-9a-f]{3,8})$/i);
  if(m){let h=m[1];if(h.length<=4)h=[...h].map(c=>c+c).join('');const n=parseInt(h.slice(0,6),16);return {r:n>>16&255,g:n>>8&255,b:n&255,a:h.length===8?parseInt(h.slice(6),16)/255:1};}
  m=token.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if(m){const a=m[4]===undefined?1:m[4].endsWith('%')?parseFloat(m[4])/100:parseFloat(m[4]);return {r:+m[1],g:+m[2],b:+m[3],a};}
  if(/^white$/i.test(token))return {r:255,g:255,b:255,a:1};
  if(/^black$/i.test(token))return {r:0,g:0,b:0,a:1};
  return null;
}
function hsl({r,g,b}){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;let h=0,s=0;
  if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return {h,s,l};}
function rgb(h,s,l){const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return {r:Math.round(f(0)*255),g:Math.round(f(8)*255),b:Math.round(f(4)*255)};}
const out=({r,g,b},a)=>a>=.999?'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''):`rgba(${r},${g},${b},${+a.toFixed(3)})`;
// The night palette's surfaces are navy/indigo; anything else that is saturated is an accent (gold, teal, rose, rarity).
const isNavy=({h,s})=>h>=200&&h<=262||s<.18;
const isAccent=c=>{const x=hsl(c);return !isNavy(x)&&x.s>.38&&x.l>.12&&x.l<.93;};
function accentInk({h,s,l}){
  if(h>=28&&h<66)return rgb(38,.95,.37);        // gold -> amber that reads on white
  if(h>=145&&h<200)return rgb(170,.85,.29);     // teal / mint
  if(h>=200&&h<262)return rgb(214,.8,.45);      // sky / gem -> azure
  if(h>=300||h<12)return rgb(h,.72,.47);        // rose / coral
  if(h>=12&&h<28)return rgb(h,.8,.45);
  return rgb(h,clamp(s,.5,.85),.38);
}
const ROLE={
  surface(c){const x=hsl(c);
    if(x.l>.62||isAccent(c))return out(c,c.a);                        // light fills and accent fills stay
    if(c.r+c.g+c.b<40&&c.a<.95)return out({r:24,g:44,b:86},c.a*.55);    // black veils become a soft navy veil
    return out(rgb(x.h||220,clamp(x.s*.55,.08,.45),clamp(.985-x.l*.16,.9,.99)),c.a<1?Math.min(.94,c.a*1.05+.08):1);},
  ink(c,keep){const x=hsl(c);
    if(keep||x.l<.36)return out(c,c.a);                               // text on an accent fill, or already dark
    if(x.s<.42||x.l>.9)return out(rgb(222,.34,clamp(.15+(1-x.l)*.5,.15,.48)),Math.max(c.a,.85));
    return out(accentInk(x),Math.max(c.a,.9));},
  line(c){const x=hsl(c);
    if(isAccent(c)&&x.l>.35)return out(rgb(x.h,clamp(x.s,.5,.9),clamp(x.l*.8,.32,.62)),Math.min(1,c.a*1.1));
    return out({r:58,g:96,b:168},clamp(c.a*(x.l>.5?1.05:.6),.06,.4));},
  shadow(c,keep){const x=hsl(c);
    if(x.l<.3)return out({r:46,g:78,b:140},clamp(c.a*.42,.04,.2));
    if(isAccent(c))return out(c,c.a*(keep?.8:.5));
    return out({r:255,g:255,b:255},clamp(c.a,.3,.9));},
  textShadow(c,keep){const x=hsl(c);
    if(keep)return out(c,c.a);
    if(x.l<.35)return out({r:255,g:255,b:255},clamp(c.a*.7,.2,.7));
    if(isAccent(c))return out(c,c.a*.35);
    return out({r:120,g:150,b:210},c.a*.3);},
};
function roleOf(prop){
  if(/^(color|fill|caret-color|-webkit-text-fill-color|text-decoration-color|accent-color|stroke)$/.test(prop))return 'ink';
  if(prop==='text-shadow')return 'textShadow';
  if(/^(box-shadow|filter|-webkit-filter)$/.test(prop))return 'shadow';
  if(/^(border|outline|column-rule)/.test(prop))return 'line';
  if(/^(background|border-image|--)/.test(prop)||/mask|gradient/.test(prop))return 'surface';
  return null;
}
const COLOR=/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;
const mapValue=(value,fn)=>{const urls=[];const masked=value.replace(/url\([^)]*\)/g,u=>{urls.push(u);return `\u0000${urls.length-1}\u0000`;});
  return masked.replace(COLOR,t=>{const c=parse(t);return c?fn(c):t;}).replace(/\u0000(\d+)\u0000/g,(_,i)=>urls[i]);};
export function brightCss(css,overrides){
  // Innermost declaration blocks. A block whose own background keeps an accent fill (gold button, teal badge)
  // keeps its light text and its glows: that text sits on colour, not on a panel.
  const mapped=css.replace(/\{([^{}]*)\}/g,(all,body)=>{
    const bg=[...body.matchAll(/(?:^|;)\s*background(?:-color|-image)?\s*:([^;]*)/g)].map(m=>m[1]).join(' ');
    const keep=[...bg.matchAll(COLOR)].some(m=>{const c=parse(m[0]);return c&&c.a>.5&&isAccent(c);});
    const next=body.replace(/(^|;)(\s*)(--?[\w-]+|[a-z-]+)\s*:([^;]*)/gi,(d,lead,ws,prop,value)=>{
      const role=roleOf(prop.toLowerCase());if(!role)return d;
      return `${lead}${ws}${prop}:${mapValue(value,c=>ROLE[role](c,keep))}`;});
    return `{${next}}`;
  });
  return mapped+'\n/* bright skin overrides */\n'+overrides;
}
