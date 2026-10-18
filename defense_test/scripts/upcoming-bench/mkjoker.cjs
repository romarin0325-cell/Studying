const fs=require('fs');
const out=[];
for(const [label,hero] of [['d12',{damage:12}],['d16',{damage:16}],['d19',{damage:19}],['d22',{damage:22}]])
  for(const c of ['red','blue','green','white','black'])
    out.push({label:label+'/'+c,heroes:['joker'],set:{hero:{joker:hero},upcoming:{joker:{fixed:c}}}});
fs.writeFileSync('joker-sweep1.json',JSON.stringify(out));console.log(out.length);
