const fs=require('fs');
const V={U10:[30,2,8],U11:[30,2,7],U12:[32,2,7]};
const TEAMS=['star_boy,snow_rabbit,night_rabbit,siren','silver_rabbit,mushroom_king,snow_rabbit,star_boy','night_rabbit,silver_rabbit,mushroom_king,siren'];
const out=[],ult=[];
for(const [k,[d,st,f]] of Object.entries(V)){
  const set={hero:{underdog:{damage:d}},upcoming:{underdog:{stun:st,factor:f}}};
  for(const [i,t] of TEAMS.entries())out.push({label:`${k} d${d} s${st} x${f} | 활성#${i}`,heroes:['underdog'],set,teams:12,args:['--team',t]});
  ult.push({label:`${k} d${d} s${st} x${f} / 노멀 5인(발동)`,hero:'underdog',deck:['underdog','star_boy','snow_rabbit','night_rabbit','silver_rabbit'],set});
}
fs.writeFileSync('ud5-contrib.json',JSON.stringify(out));fs.writeFileSync('ud5-ult.json',JSON.stringify(ult));console.log(out.length,ult.length);
