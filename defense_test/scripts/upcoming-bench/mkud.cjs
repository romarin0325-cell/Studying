const fs=require('fs');
const C=['star_boy','snow_rabbit','silver_rabbit','night_rabbit','siren','mushroom_king','joker'];
const comb=(a,k)=>k===0?[[]]:a.flatMap((x,i)=>comb(a.slice(i+1),k-1).map(r=>[x,...r]));
const set={hero:{joker:{damage:22}}};
const out=[];
for(const d of comb(C,4))out.push({label:'withUD: '+d.join(','),deck:['underdog',...d],stages:'3,9,15,21,27',seeds:10,set});
for(const d of comb(C,5))out.push({label:'noUD: '+d.join(','),deck:d,stages:'3,9,15,21,27',seeds:10,set});
fs.writeFileSync('ud-search.json',JSON.stringify(out));console.log(out.length);
