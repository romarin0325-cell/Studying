const fs=require('fs');
const V={U0:[20,3,10],U1:[24,3,10],U2:[28,3,10],U3:[24,2,10],U4:[28,2,10],U5:[28,2,8],U6:[32,2,8],U7:[28,1.5,8]};
const out=[];
for(const [k,[d,st,f]] of Object.entries(V)){
  const set={hero:{underdog:{damage:d}},upcoming:{underdog:{stun:st,factor:f}}};
  out.push({label:`${k} d${d} stun${st} x${f} | 비활성(무작위 팀)`,heroes:['underdog','silver_rabbit','mushroom_king'],set,teams:8});
  out.push({label:`${k} d${d} stun${st} x${f} | 활성(노멀 팀)`,heroes:['underdog','silver_rabbit','mushroom_king'],set,teams:8,args:['--team','star_boy,snow_rabbit,night_rabbit,siren']});
}
fs.writeFileSync('ud-sweep.json',JSON.stringify(out));console.log(out.length);
