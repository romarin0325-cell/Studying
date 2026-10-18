const fs=require('fs');
const V={A:[24,9,1,3],B:[30,9,1,3],C:[36,9,1,3],D:[30,12,1,3],E:[30,9,5,3],F:[36,9,5,3],G:[30,12,5,3],H:[36,9,5,2]};
const out=[],ult=[];
for(const [k,[d,f,m,st]] of Object.entries(V)){
  const set={hero:{toffee_apple:{damage:d}},upcoming:{toffee:{factor:f,minAlive:m,stun:st}}};
  out.push({label:`${k} d${d} x${f} min${m} s${st}`,heroes:['toffee_apple'],set});
  ult.push({label:`${k} d${d} x${f} min${m} s${st} / R+UR`,hero:'toffee_apple',deck:['toffee_apple','zeke','luna','jasmine','great_detective'],set,horizon:40});
  ult.push({label:`${k} d${d} x${f} min${m} s${st} / 노멀`,hero:'toffee_apple',deck:['toffee_apple','star_boy','snow_rabbit','night_rabbit','siren'],set,horizon:40});
}
fs.writeFileSync('toffee-contrib.json',JSON.stringify(out));fs.writeFileSync('toffee-ult.json',JSON.stringify(ult));console.log(out.length,ult.length);
