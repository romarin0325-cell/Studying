const fs=require('fs');
const V={A0:[30,17,180,70],A1:[30,12,180,70],A2:[30,10,180,70],A3:[36,12,180,70],A4:[36,10,180,70],A5:[30,14,180,70],A6:[36,12,150,70],A7:[30,12,180,60],A8:[40,10,180,70]};
const decks={'화상 덱':['ash','red_dragon','flame_sage','zeke','santa'],'노멀 덱':['ash','star_boy','snow_rabbit','night_rabbit','siren'],'UR 덱':['ash','zeke','luna','jasmine','great_detective']};
const out=[],ult=[];
for(const [k,[d,f,r,c]] of Object.entries(V)){
  const set={hero:{ash:{damage:d,'skill.cost':c}},upcoming:{ash:{factor:f,radius:r}}};
  const lab=`${k} d${d} x${f} r${r} c${c}`;
  out.push({label:lab,heroes:['ash'],set});
  for(const [dn,dk] of Object.entries(decks))ult.push({label:`${lab} / ${dn}`,hero:'ash',deck:dk,set});
}
fs.writeFileSync('ash-contrib.json',JSON.stringify(out));fs.writeFileSync('ash-ult.json',JSON.stringify(ult));console.log(out.length,ult.length);
