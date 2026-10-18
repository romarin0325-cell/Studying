const fs=require('fs');
const decks={'오라1':['siren','ancient_dragon','harmonious','time_magician'],'오라2(베히모스)':['siren','ancient_dragon','harmonious','behemoth'],'오라3':['siren','ancient_dragon','time_magician','lightning_sage'],'오라4':['behemoth','siren','ancient_dragon','great_detective'],'디버프':['great_detective','frost_witch','flame_sage','phantom'],'혼합':['zeke','luna','jasmine','great_detective'],'노멀':['star_boy','snow_rabbit','night_rabbit','siren'],'RSR상위':['phantom','jasmine','time_magician','rumi']};
const out=[];
for(const [dn,d] of Object.entries(decks)){
  for(const [vn,set] of [['x7',{upcoming:{antropy:{factor:7}}}],['x5',{upcoming:{antropy:{factor:5}}}]])out.push({label:`${dn} +앤트로피${vn}`,deck:['antropy',...d],stages:'3,9,15,21,27',seeds:12,set});
  out.push({label:`${dn} +가디언(대조)`,deck:['guardian',...d.filter(x=>x!=='guardian')],stages:'3,9,15,21,27',seeds:12});
}
fs.writeFileSync('ant-decks.json',JSON.stringify(out));console.log(out.length);
