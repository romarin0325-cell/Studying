const fs=require('fs');
const decks={'혼합':['zeke','luna','great_detective','jasmine'],'RSR':['phantom','time_magician','avalanche_maid','guardian'],'노멀':['star_boy','snow_rabbit','night_rabbit','siren'],'화상':['red_dragon','santa','zeke','great_detective']};
const out=[];
for(const [dn,d] of Object.entries(decks)){
  for(const dm of [22,26,30])out.push({label:`${dn} +큐어 d${dm}`,deck:['cure_master',...d],stages:'3,9,15,21,27',seeds:40,set:{hero:{cure_master:{damage:dm}}}});
  for(const c of ['flame_sage','lightning_sage'])out.push({label:`${dn} +${c}(대조)`,deck:[c,...d],stages:'3,9,15,21,27',seeds:40});
}
fs.writeFileSync('cure2.json',JSON.stringify(out));console.log(out.length);
// ladder of existing heroes (same decks, 20 seeds)
const lad=[];
const C=['snow_rabbit','silver_rabbit','night_rabbit','mushroom_king'],R=['red_dragon','santa','avalanche_maid','aurora'],SR=['storm_sage','ancient_dragon','phantom'];
for(const [dn,d] of Object.entries(decks))for(const h of [...C,...R,...SR]){if(d.includes(h))continue;lad.push({label:`${dn} +${h}(기존)`,deck:[h,...d],stages:'3,9,15,21,27',seeds:20});}
fs.writeFileSync('ladder.json',JSON.stringify(lad));console.log(lad.length);
