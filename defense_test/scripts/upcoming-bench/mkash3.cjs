const fs=require('fs');
const decks={'화상':['red_dragon','santa','zeke','great_detective'],'혼합':['zeke','luna','great_detective','jasmine'],'노멀':['star_boy','snow_rabbit','night_rabbit','siren'],'RSR':['phantom','time_magician','avalanche_maid','guardian']};
const V={'B1 d40 x10':[40,10,180],'B2 d46 x10':[46,10,180],'B3 d52 x8':[52,8,180],'B4 d46 x12':[46,12,180],'B5 d40 x14':[40,14,180],'B6 d46 x10 r220':[46,10,220]};
const out=[];
for(const [dn,d] of Object.entries(decks)){
  for(const [vn,[dm,f,r]] of Object.entries(V))out.push({label:`${dn} +애쉬 ${vn}`,deck:['ash',...d],stages:'3,9,15,21,27',seeds:20,set:{hero:{ash:{damage:dm}},upcoming:{ash:{factor:f,radius:r}}}});
  for(const c of ['flame_sage','lightning_sage'])out.push({label:`${dn} +${c}(대조)`,deck:[c,...d.filter(x=>x!==c)].slice(0,5),stages:'3,9,15,21,27',seeds:20});
}
fs.writeFileSync('ash-decks2.json',JSON.stringify(out));console.log(out.length);
