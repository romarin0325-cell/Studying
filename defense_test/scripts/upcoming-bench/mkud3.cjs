const fs=require('fs');
const V={U0:[20,3,10],U2:[28,3,10],U3:[24,2,10],U4:[28,2,10],U6:[32,2,8],U8:[26,2,10],U9:[30,2,10]};
const TEAMS=['star_boy,snow_rabbit,night_rabbit,siren','silver_rabbit,mushroom_king,snow_rabbit,star_boy','night_rabbit,silver_rabbit,mushroom_king,siren'];
const out=[];
for(const [k,[d,st,f]] of Object.entries(V))for(const [i,t] of TEAMS.entries()){
  const set={hero:{underdog:{damage:d}},upcoming:{underdog:{stun:st,factor:f}}};
  out.push({label:`${k} d${d} s${st} x${f} | 활성#${i}`,heroes:['underdog'],set,teams:12,args:['--team',t]});
}
fs.writeFileSync('ud-sweep3.json',JSON.stringify(out));console.log(out.length);
