const fs=require('fs');
const C=['star_boy','snow_rabbit','silver_rabbit','night_rabbit','siren','mushroom_king','joker'];
const comb=(a,k)=>k===0?[[]]:a.flatMap((x,i)=>comb(a.slice(i+1),k-1).map(r=>[x,...r]));
const base={hero:{joker:{damage:22}}};
const mk=(d,st,f)=>({hero:{...base.hero,underdog:{damage:d}},upcoming:{underdog:{stun:st,factor:f}}});
const out=[];
for(const [k,s] of [['U2',mk(28,3,10)],['U4',mk(28,2,10)]])for(const d of comb(C,4))out.push({label:`${k} withUD: ${d.join(',')}`,deck:['underdog',...d],stages:'3,9,15,21,27',seeds:10,set:s});
// non-Normal decks: random 5 of the non-hidden R/SR/UR roster, fixed shuffle
const P=['great_detective','guardian','avalanche_maid','santa','red_dragon','aurora','storm_sage','flame_sage','lightning_sage','time_magician','ancient_dragon','phantom','zeke','luna','jasmine','queen','rumi','cherry_prince'];
let x=12345;const rnd=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};
const seen=new Set();
while(out.filter(o=>o.label.startsWith('RSR')).length<70){const a=[...P];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}const d=a.slice(0,5);const key=[...d].sort().join();if(seen.has(key))continue;seen.add(key);out.push({label:`RSR: ${d.join(',')}`,deck:d,stages:'3,9,15,21,27',seeds:10,set:base});}
fs.writeFileSync('ud-search4.json',JSON.stringify(out));console.log(out.length);
