const fs=require('fs');
const fif=require('./fifth.out.json'),lad=require('./ladder.out.json'),cure2=require('./cure2.out.json');
const decks=['혼합','RSR','노멀','화상'],heads=['혼합','레어~슈퍼레어','노멀','화상'];
const g={};
const add=(rs,filter)=>{for(const r of rs){const m=r.cfg.label.match(/^(\S+) \+(.+?)(\(.+\))?$/);if(!m)continue;const name=m[2];if(filter&&!filter(name))continue;(g[name]=g[name]||{})[m[1]]=r.win;}};
add(fif,n=>n!=='cure_master');add(lad);
for(const r of cure2){const m=r.cfg.label.match(/^(\S+) \+(큐어 d22|flame_sage|lightning_sage)(\(대조\))?$/);if(!m)continue;const n=m[2]==='큐어 d22'?'cure_master':('cure2:'+m[2]);(g[n]=g[n]||{})[m[1]]=r.win;}
const NAME={joker:'조커 (22)',underdog:'언더독 (32 · 7배)',toffee_apple:'토피애플 (36 · 7배)',antropy:'앤트로피 (24 · 7배)',ash:'애쉬 (46 · 10배)',cure_master:'큐어마스터 (22, 200판)',venom:'베놈 (34 · 3배)',behemoth:'베히모스 (기존)'};
const fmt=v=>decks.map(d=>v?.[d]==null?'-':String(v[d])).join(' | ');
let md='| 5번째 칸 | '+heads.join(' | ')+' |\n|---|---:|---:|---:|---:|\n';
for(const id of Object.keys(NAME))md+=`| **${NAME[id]}** | ${fmt(g[id])} |\n`;
md+='| 대조군 화염의현자 / 번개의현자 (20판) | '+decks.map(d=>`${g.flame_sage?.[d]??'-'} / ${g.lightning_sage?.[d]??'-'}`).join(' | ')+' |\n';
// existing heroes: min-max-median per deck, excluding the new ones
const NEW=new Set(Object.keys(NAME).concat(Object.keys(g).filter(n=>n.startsWith('cure2:'))));
const ex=Object.keys(g).filter(n=>!NEW.has(n));
const stat=d=>{const xs=ex.map(n=>({n,v:g[n]?.[d]})).filter(x=>x.v!=null).sort((a,b)=>a.v-b.v);return `${xs[0].v}–${xs.at(-1).v} (중앙 ${xs[Math.floor(xs.length/2)].v}, ${xs.length}명)`;};
md+='| 기존 동료 전체 범위 | '+decks.map(stat).join(' | ')+' |\n';
fs.writeFileSync('sec6.md',md);
console.log(md);
console.log('existing:',ex.join(','));
