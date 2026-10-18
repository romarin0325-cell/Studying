const fs=require('fs');
// final candidate numbers per hero (proposal)
const F={
  joker:{hero:{joker:{damage:22}}},
  underdog:{hero:{underdog:{damage:32}},upcoming:{underdog:{stun:2,factor:7}}},
  toffee_apple:{hero:{toffee_apple:{damage:36}},upcoming:{toffee:{factor:7,minAlive:5,stun:3}}},
  antropy:{upcoming:{antropy:{factor:7}}},
  ash:{hero:{ash:{damage:46}},upcoming:{ash:{factor:10,radius:180}}},
  cure_master:{hero:{cure_master:{damage:22}}},
  venom:{},
};
const merge=(...s)=>{const o={hero:{},upcoming:{}};for(const x of s){Object.assign(o.hero,x.hero||{});for(const [k,v] of Object.entries(x.upcoming||{}))o.upcoming[k]={...(o.upcoming[k]||{}),...v};}return o;};
const contrib=[],ult=[];
for(const [id,set] of Object.entries(F)){contrib.push({label:'final '+id,heroes:[id],set});}
// the underdog active-team is handled in the ult configs by deck choice
const base=JSON.parse(fs.readFileSync('ult1.json','utf8'));
for(const c of base){const set=F[c.hero]||{};ult.push({...c,label:'final '+c.label,set,horizon:c.hero==='toffee_apple'?40:c.horizon});}
fs.writeFileSync('final-contrib.json',JSON.stringify(contrib));fs.writeFileSync('final-ult.json',JSON.stringify(ult));
// final set bundle reused by other scripts
fs.writeFileSync('final-set.json',JSON.stringify(F,null,1));
console.log(contrib.length,ult.length);
