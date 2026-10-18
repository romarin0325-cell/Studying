const fs=require('fs');
const F=JSON.parse(fs.readFileSync('final-set.json','utf8'));
const merge=(...s)=>{const o={hero:{},upcoming:{}};for(const x of s){Object.assign(o.hero,x.hero||{});for(const [k,v] of Object.entries(x.upcoming||{}))o.upcoming[k]={...(o.upcoming[k]||{}),...v};}return o;};
const all=merge(...Object.values(F));
const decks={'혼합':['zeke','luna','great_detective','jasmine'],'RSR':['phantom','time_magician','avalanche_maid','guardian'],'노멀':['star_boy','snow_rabbit','night_rabbit','siren'],'화상':['red_dragon','santa','zeke','great_detective']};
const NEW=['joker','underdog','toffee_apple','antropy','ash','cure_master','venom','behemoth'];
const CTRL=['flame_sage','lightning_sage','time_magician','guardian','siren','star_boy'];
const out=[];
for(const [dn,d] of Object.entries(decks)){
  for(const id of NEW)out.push({label:`${dn} +${id}`,deck:[id,...d],stages:'3,9,15,21,27',seeds:20,set:all});
  for(const c of CTRL){if(d.includes(c))continue;out.push({label:`${dn} +${c}(대조)`,deck:[c,...d],stages:'3,9,15,21,27',seeds:20});}
}
fs.writeFileSync('fifth.json',JSON.stringify(out));console.log(out.length);
