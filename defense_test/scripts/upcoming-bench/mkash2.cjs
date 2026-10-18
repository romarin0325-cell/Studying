const fs=require('fs');
const decks={'화상':['red_dragon','santa','zeke','great_detective'],'혼합':['zeke','luna','great_detective','jasmine'],'노멀':['star_boy','snow_rabbit','night_rabbit','siren'],'RSR':['phantom','time_magician','avalanche_maid','guardian']};
const V={'A0 x17':{hero:{ash:{damage:30}},upcoming:{ash:{factor:17,radius:180}}},'A1 x12':{hero:{ash:{damage:30}},upcoming:{ash:{factor:12,radius:180}}},'A8 d40 x10':{hero:{ash:{damage:40}},upcoming:{ash:{factor:10,radius:180}}},'A7 x12 c60':{hero:{ash:{damage:30,'skill.cost':60}},upcoming:{ash:{factor:12,radius:180}}}};
const out=[];
for(const [dn,d] of Object.entries(decks)){
  for(const [vn,set] of Object.entries(V))out.push({label:`${dn} +애쉬 ${vn}`,deck:['ash',...d],stages:'3,9,15,21,27',seeds:12,set});
  for(const c of ['flame_sage','lightning_sage'])out.push({label:`${dn} +${c}(대조)`,deck:[c,...d.filter(x=>x!==c)].slice(0,5),stages:'3,9,15,21,27',seeds:12});
}
fs.writeFileSync('ash-decks.json',JSON.stringify(out));console.log(out.length);
