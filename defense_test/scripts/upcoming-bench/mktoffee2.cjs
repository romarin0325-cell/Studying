const fs=require('fs');
const V={I:[36,7,5,3],J:[40,6,5,3],K:[36,8,5,2],L:[34,8,5,3],M:[44,5,5,3]};
const out=[],ult=[];
for(const [k,[d,f,m,st]] of Object.entries(V)){
  const set={hero:{toffee_apple:{damage:d}},upcoming:{toffee:{factor:f,minAlive:m,stun:st}}};
  out.push({label:`${k} d${d} x${f} min${m} s${st}`,heroes:['toffee_apple'],set});
  ult.push({label:`${k} d${d} x${f} min${m} s${st} / R+UR`,hero:'toffee_apple',deck:['toffee_apple','zeke','luna','jasmine','great_detective'],set,horizon:40});
  ult.push({label:`${k} d${d} x${f} min${m} s${st} / 노멀`,hero:'toffee_apple',deck:['toffee_apple','star_boy','snow_rabbit','night_rabbit','siren'],set,horizon:40});
}
fs.writeFileSync('toffee2-contrib.json',JSON.stringify(out));fs.writeFileSync('toffee2-ult.json',JSON.stringify(ult));console.log(out.length,ult.length);
