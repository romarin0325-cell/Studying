// Builds up/ultroll.mjs from scripts/ult-rollout.mjs: imports point at the dummy worktree, the six fixed decks are
// replaced by UP_DECKS ("a,b,c,d,e;f,g,h,i,j"), and the coverage check is dropped.
const fs=require('fs');
const SRC=require('path').join(__dirname,'..','ult-rollout.mjs'); // needs the pass-9 scripts/ult-rollout.mjs next to this folder
const OUT=require('path').join(__dirname,'ultroll.mjs');
let s=fs.readFileSync(SRC,'utf8').replace(/\r\n/g,'\n');
s=s.split("'../src/").join("'../../src/");
const a=s.indexOf('const DECKS=['),b=s.indexOf('const deckOf=');
if(a<0||b<0)throw new Error('markers');
s=s.slice(0,a)+"const DECKS=(process.env.UP_DECKS||'').split(';').map(d=>d.split(',').map(x=>x.trim()).filter(Boolean)).filter(d=>d.length);\nif(!DECKS.length||DECKS.some(deck=>!engine.validDeck(deck)))throw new Error('UP_DECKS must list valid decks');\nconst roster=HEROES.map(hero=>hero.id);\n"+s.slice(b);
s=s.replace('const DT=.05,AUTO=.32,LIMIT=900,LIMIT_TICKS=LIMIT/DT,HORIZON=12,','const DT=.05,AUTO=.32,LIMIT=900,LIMIT_TICKS=LIMIT/DT,HORIZON=Number(process.env.UP_HORIZON||12),');
if(!s.includes('UP_HORIZON'))throw new Error('horizon');
fs.writeFileSync(OUT,s);
console.log('ok',s.includes('UP_DECKS'));
