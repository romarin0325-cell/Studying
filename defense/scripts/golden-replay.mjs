// Refactor safety net. Plays ten fixed, seeded battles with the measurement auto-play and prints
// digests of the battle state, the events sent to the renderer, the battle text and the restored
// checkpoint. Run it before and after a change that must not alter combat or battle text; the two
// outputs must be identical.
//   node defense/scripts/golden-replay.mjs --write <file.json>     save the digests
//   node defense/scripts/golden-replay.mjs --compare <file.json>   exit 1 and list what differs
// Not part of the tests on purpose: a balance change is meant to change these digests.
// Compare only two runs made on the same PC with the same Node version.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {HEROES,ARTIFACTS} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {smartAutoPlay} from '../src/smart-auto.js';

const DT=.05,AUTO=.32,LIMIT_TICKS=6000,SAMPLE=200;
const ids=HEROES.map(h=>h.id),relics=ARTIFACTS.map(a=>a.id);
// Nine mixed decks walk the whole roster; the tenth is the all-common deck Underdog needs.
const decks=Array.from({length:9},(_,d)=>[ids[d],ids[d+9],ids[d+18],ids[d+27],d<ids.length-36?ids[36+d]:ids[(d+1)%9]]);
decks.push(['underdog','star_boy','snow_rabbit','night_rabbit','siren']);
const MODES=['main','main','main','main','main','main','main','weekly','monthly','main'];
const TIERS=['easy','easy','easy','easy','easy','easy','easy','hard','easy','easy'];
const bedsFor=stage=>({rose:Math.min(45,3+stage),spring:stage>=15?Math.min(30,3*(stage-14)):0,seed:stage>=30?Math.min(20,2*(stage-29)):0});
const sha=()=>createHash('sha256');
const text=value=>JSON.stringify(value)??'null';

function battleText(s){
  const out=[];
  for(const id of s.deck)out.push(text(engine.castPreview(s,id)),engine.skillCost(s,id));
  s.board.forEach((u,i)=>{if(u)out.push(text(engine.personalTrait(s,u,i)),text(engine.liveTraitTokens(s,u)),text(engine.givenEffects(s,u,i)),text(engine.combatStats(s,u)));});
  return out.join('\n');
}
function play(index){
  const deck=decks[index],stage=1+index*8+(index%2),mode=MODES[index],beds=bedsFor(stage);
  if(!engine.validDeck(deck))throw new Error('golden deck '+index+' is not valid: '+deck.join(','));
  const entry={enhance:index%4*5},meta=Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier(entry,beds),special:specialMultiplier(entry.enhance)}]));
  const artifacts=relics.slice(index*3,index*3+3),relicLevels=Object.fromEntries(artifacts.map((id,i)=>[id,1+(index+i)%4]));
  const s=engine.newRun({deck,chapter:stage-1,seed:20261115+index*7919,artifacts,meta,relicAttack:.02*index,relicLevels,mode,tier:TIERS[index],
    gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed),crit:index%2?{chance:.13,damage:1.8}:{chance:.05,damage:1.5}});
  if(mode==='monthly')s.health=engine.MONTHLY_HEALTH;
  const state=sha(),events=sha(),words=sha(),restored=sha();
  const sample=()=>{
    const raw=engine.serialize(s);state.update(raw);words.update(battleText(s));
    const back=engine.restore(raw);restored.update(back?engine.serialize(back):'restore failed');
  };
  let autoIn=0,pick=false,ticks=0;sample();
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
    const before=s.phase;
    engine.step(s,DT);ticks++;
    if(pick){smartAutoPlay(s);autoIn=0;pick=false;}
    else if(before!=='reward'&&s.phase==='reward')pick=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){smartAutoPlay(s);autoIn=0;}}
    if(s.events.length){events.update(text(s.events));s.events.length=0;}
    if(ticks%SAMPLE===0)sample();
  }
  sample();
  return {name:`${index+1}. ${mode} stage ${stage}: ${deck.join(', ')}`,relics:artifacts,end:{phase:s.phase,wave:s.wave,ticks,health:s.health,damage:Math.round(s.stats.damage)},
    state:state.digest('hex'),events:events.digest('hex'),text:words.digest('hex'),restore:restored.digest('hex')};
}
// Text that does not depend on a battle: training lines and the hero-sheet numbers at two enhancement levels.
function sheetText(){
  const h=sha();
  for(const id of ids){for(let level=0;level<=5;level++)h.update(engine.trainingBonus(id,level)+'|'+engine.trainingPower(id,level)+'\n');for(const k of [1,1.5,2])h.update(text(engine.scaledTokens(id,k))+'\n');}
  return h.digest('hex');
}

const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const writeTo=flag('--write'),compareTo=flag('--compare');
if(args.length&&!writeTo&&!compareTo){console.error('Use --write <file.json> or --compare <file.json>.');process.exit(2);}
const started=Date.now(),result={node:process.version,sheet:sheetText(),battles:decks.map((_,i)=>play(i))};
for(const b of result.battles)console.log(`${b.name}\n   ${b.end.phase} · wave ${b.end.wave} · ${b.end.ticks} ticks · state ${b.state.slice(0,12)} · events ${b.events.slice(0,12)} · text ${b.text.slice(0,12)} · restore ${b.restore.slice(0,12)}`);
console.log(`sheet ${result.sheet.slice(0,12)} · ${((Date.now()-started)/1000).toFixed(1)}s`);
if(writeTo){fs.writeFileSync(writeTo,JSON.stringify(result,null,1));console.log('saved '+writeTo);}
if(compareTo){
  const old=JSON.parse(fs.readFileSync(compareTo,'utf8')),diff=[];
  if(old.node!==result.node)diff.push(`Node version differs (${old.node} then, ${result.node} now): run both on the same Node.`);
  if(old.sheet!==result.sheet)diff.push('sheet text (trainingBonus, trainingPower or scaledTokens) changed');
  result.battles.forEach((b,i)=>{const o=old.battles[i];for(const key of ['state','events','text','restore'])if(!o||o[key]!==b[key])diff.push(`${b.name}: ${key} changed`);});
  if(diff.length){console.error('\nDIFFERENT:\n'+diff.join('\n'));process.exit(1);}
  console.log('\nIDENTICAL to '+compareTo);
}
