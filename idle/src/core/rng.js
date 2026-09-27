export const clone = value => structuredClone(value);
export function canonical(value){
 if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function hash(value){let h=2166136261;for(const c of typeof value==='string'?value:canonical(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function next(seed){let x=(seed||0x9e3779b9)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;}
export function random(state,stream){state.rng[stream]=next(state.rng[stream]);return state.rng[stream]/4294967296;}
export function generator(seed){let s=seed;return ()=>{s=next(s);return s/4294967296;};}
export function weighted(rows,r){let sum=0;for(const row of rows){sum+=row.chance;if(r<sum)return row;}return rows.at(-1);}
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function requireThat(ok,message){if(!ok)throw Error(message);}
