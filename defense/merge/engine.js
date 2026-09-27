import { HERO, ARTIFACTS, ARTIFACT, BOSSES, CHAPTERS, DEFAULT_DECK, VERSION, GRID, MAX_RANK } from './content.js';

export const PATH = [[76,142],[644,142],[644,684],[76,684],[76,142]];
export const PATH_LENGTH = 2220;
export const BOARD = {x:135,y:212,cell:90};
export const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
export function attackDirection(from,to){const dx=to.x-from.x,dy=to.y-from.y;return Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
export function cellPoint(i){return {x:BOARD.x+(i%GRID+.5)*BOARD.cell,y:BOARD.y+(Math.floor(i/GRID)+.5)*BOARD.cell};}
export function cellAt(x,y){const c=Math.floor((x-BOARD.x)/BOARD.cell),r=Math.floor((y-BOARD.y)/BOARD.cell);return c>=0&&c<GRID&&r>=0&&r<GRID?r*GRID+c:-1;}
export function pathPoint(distance){
  let d=clamp(distance,0,PATH_LENGTH);
  for(let i=1;i<PATH.length;i++){
    const [ax,ay]=PATH[i-1],[bx,by]=PATH[i],l=Math.hypot(bx-ax,by-ay);
    if(d<=l) return {x:ax+(bx-ax)*d/l,y:ay+(by-ay)*d/l,angle:Math.atan2(by-ay,bx-ax)};
    d-=l;
  }
  return {x:76,y:142,angle:-Math.PI/2};
}
export function random(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
function shuffle(s,values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validDeck(deck){return Array.isArray(deck)&&deck.length===6&&new Set(deck).size===6&&deck.every(id=>HERO[id]);}
export function event(s,type,data={}){s.events.push({type,time:s.time,...data});if(s.events.length>200)s.events.shift();}
export function has(s,id){return s.artifacts.includes(id);}
export function summonCost(s){return Math.max(8,Math.min(40,10+s.summons*2)-(has(s,'feather')?4:0));}
export function interest(s){return Math.min(has(s,'treasury')?16:8,Math.floor(s.gold/10));}
export function dividend(s){return Math.min(30,s.board.reduce((n,u)=>n+(u&&HERO[u.hero].trait.type==='dividend'?3+u.rank*2:0),0));}
export function upgradeCost(s,id){return 28+(s.upgrades[id]||0)*24;}
export function neighbors(index){const x=index%5,y=Math.floor(index/5);return [x>0?index-1:-1,x<4?index+1:-1,y>0?index-5:-1,y<4?index+5:-1].filter(i=>i>=0);}
export function bestUnit(s,id){return s.board.filter(u=>u?.hero===id).sort((a,b)=>b.rank-a.rank)[0];}
export function power(s,u){return HERO[u.hero].damage*Math.pow(2.35,u.rank-1)*(1+(s.upgrades[u.hero]||0)*.28);}
function addGauge(s,value){s.gauge=clamp(s.gauge+value,0,100);}
function giveGold(s,value,source){s.gold+=value;s.stats.income[source]=(s.stats.income[source]||0)+value;}
function addPoison(s,e,stacks,duration,cap=Infinity){e.poison=Math.min(cap,(e.poison||0)+stacks+(has(s,'seed')?1:0));e.poisonTime=duration;}
function makeUnit(s,hero,rank=1){return {uid:s.nextId++,hero,rank,cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:s.time,disabled:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:HERO[hero].trait.type==='expose'?'strong':'first'};}
function freeCell(s){const order=[17,12,16,18,11,13,7,6,8,21,23,2,10,14,20,24,1,3,5,9,15,19,0,4,22];return order.find(i=>!s.board[i])??-1;}
function place(s,id,rank=1,index=-1){const slot=index>=0&&!s.board[index]?index:freeCell(s);if(slot<0)return -1;s.board[slot]=makeUnit(s,id,rank);event(s,'summon',{index:slot,hero:id,rank});return slot;}

export function newRun({deck=DEFAULT_DECK,chapter=0,seed=Date.now()}={}){
  const chosen=validDeck(deck)?[...deck]:[...DEFAULT_DECK];
  const s={version:VERSION,seed:seed>>>0,rng:(seed>>>0)||1,deck:chosen,chapter:clamp(chapter|0,0,CHAPTERS.length-1),phase:'combat',wave:1,time:0,waveTime:0,
    board:Array(25).fill(null),enemies:[],shots:[],events:[],gold:65,gauge:75,health:20,summons:0,nextId:1,bag:[],artifacts:[],upgrades:Object.fromEntries(chosen.map(x=>[x,0])),
    buffs:{},queue:[],spawnIn:0,breakTime:0,shop:null,reward:null,endless:false,telegraph:null,settlement:null,
    stats:{kills:0,merges:0,summons:0,skills:0,damage:0,income:{},byHero:{}},tutorial:0,won:false};
  place(s,chosen[0],1,6);place(s,chosen[0],1,8);place(s,chosen[1],1,12);
  beginWave(s,1);return s;
}
export function drawHero(s){if(!s.bag.length)s.bag=shuffle(s,s.deck);return s.bag.pop();}
export function summon(s,preferred=-1){
  if(!['combat','intermission'].includes(s.phase))return {ok:false,reason:'전투 중에 소환할 수 있습니다.'};
  if(freeCell(s)<0)return {ok:false,reason:'전장이 가득 찼습니다. 합성하거나 영웅을 회수하세요.'};
  const cost=summonCost(s);if(s.gold<cost)return {ok:false,reason:`${cost-s.gold}골드가 더 필요합니다.`};
  s.gold-=cost;s.summons++;s.stats.summons++;const id=drawHero(s),index=place(s,id,1,preferred);s.tutorial=Math.max(s.tutorial,1);return {ok:true,index,hero:id};
}
export function canMerge(a,b){return !!a&&!!b&&a.uid!==b.uid&&a.rank===b.rank&&a.rank<MAX_RANK&&(a.hero===b.hero||a.hero==='rumi'||b.hero==='rumi');}
export function move(s,from,to){
  if(!['combat','intermission'].includes(s.phase)||from===to||!s.board[from]||to<0||to>24)return {ok:false};
  const a=s.board[from],b=s.board[to];
  if(canMerge(a,b)){
    const id=b.hero==='rumi'?a.hero:b.hero,rank=b.rank+1;
    let consumed=a;if(a.hero==='rumi'&&b.hero!=='rumi')consumed=a;
    else if(b.hero==='rumi'&&a.hero!=='rumi')consumed=b;
    const refund=HERO[consumed.hero].trait.type==='sacrifice'?18*consumed.rank:0;
    if(refund)giveGold(s,refund,'합성 환급');
    if(a.hero==='mushroom_king'||b.hero==='mushroom_king')for(const e of s.enemies)addPoison(s,e,rank*2,8);
    const unit=makeUnit(s,id,rank);unit.priority=b.priority;unit.cooldown=.06;s.board[to]=unit;s.board[from]=null;
    s.stats.merges++;addGauge(s,12+(has(s,'hourglass')?8:0));s.tutorial=Math.max(s.tutorial,2);
    event(s,'merge',{from,to,hero:id,rank,refund});return {ok:true,merged:true,index:to,refund};
  }
  s.board[to]=a;s.board[from]=b;event(s,'move',{from,to});return {ok:true,index:to};
}
export function sell(s,index){
  const u=s.board[index];if(!u||!['combat','intermission'].includes(s.phase))return {ok:false};
  if(s.board.filter(Boolean).length<=1)return {ok:false,reason:'마지막 영웅은 회수할 수 없습니다.'};
  const gold=Math.round(6*Math.pow(1.7,u.rank-1));s.board[index]=null;giveGold(s,gold,'회수');event(s,'sell',{index,gold});return {ok:true,gold};
}
export function upgrade(s,id){
  if(!s.deck.includes(id)||!['combat','intermission','shop'].includes(s.phase))return {ok:false};
  if(s.upgrades[id]>=5)return {ok:false,reason:'훈련을 모두 마쳤습니다.'};
  const cost=upgradeCost(s,id);if(s.gold<cost)return {ok:false,reason:`${cost-s.gold}골드가 더 필요합니다.`};
  s.gold-=cost;s.upgrades[id]++;event(s,'upgrade',{hero:id,level:s.upgrades[id]});return {ok:true};
}
export function cycleTarget(s,index){const u=s.board[index];if(!u)return;const values=['first','strong','last'];u.priority=values[(values.indexOf(u.priority)+1)%3];}

function beginWave(s,wave){
  s.phase='combat';s.wave=wave;s.waveTime=0;s.spawnIn=.6;s.settlement=null;s.telegraph=null;
  const n=12+wave*2,sequence=[];
  for(let i=0;i<n;i++)sequence.push(i%7===6&&wave>=3?'armor':i%5===4&&wave>=2?'runner':i%9===8&&wave>=5?'wisp':'grunt');
  if(wave%4===0){sequence.splice(7,0,'boss');event(s,'bossApproach',{wave});}
  s.queue=sequence;event(s,'wave',{wave});
}
function spawnEnemy(s,kind){
  const wave=s.wave,chapter=CHAPTERS[s.chapter],base=(88*Math.pow(1.34,wave-1))*chapter.hp;
  const isBoss=kind==='boss',bossId=isBoss?chapter.bosses[Math.min(2,Math.floor((wave-1)/4))]:null;
  const hp=Math.round(base*(isBoss?32:kind==='armor'?2.5:kind==='runner'?.65:kind==='wisp'?.9:1));
  const e={uid:s.nextId++,kind,boss:bossId,hp,maxHp:hp,progress:0,speed:isBoss?34:kind==='runner'?82:kind==='armor'?39:kind==='wisp'?67:49,
    slow:0,slowTime:0,stun:0,burn:0,burnTime:0,poison:0,poisonTime:0,exposed:0,exposeTime:0,hit:0,skillIn:7.5,channel:0,channelHp:0,dotFlash:0};
  s.enemies.push(e);if(isBoss)event(s,'boss',{id:bossId,name:BOSSES[bossId].name});
}
function chooseTarget(s,u){
  const at=cellPoint(s.board.indexOf(u));
  const enemies=s.enemies.filter(e=>e.hp>0&&Math.hypot(pathPoint(e.progress).x-at.x,pathPoint(e.progress).y-at.y)<=HERO[u.hero].range);if(!enemies.length)return null;
  return enemies.reduce((a,b)=>u.priority==='strong'?(a.hp>b.hp?a:b):u.priority==='last'?(a.progress<b.progress?a:b):(a.progress>b.progress?a:b));
}
function damage(s,e,value,hero,{dot=false,pure=false}={}){
  if(!e||e.hp<=0)return;
  let amount=value*(1+e.exposed)*(e.boss&&has(s,'lens')?1.3:1)*(e.slowTime>0&&has(s,'frost')?1.25:1);
  if(e.kind==='armor'&&!pure)amount*=.72;
  const actual=Math.min(e.hp,amount);e.hp-=amount;e.hit=.13;s.stats.damage+=actual;s.stats.byHero[hero]=(s.stats.byHero[hero]||0)+actual;
  if(!dot)event(s,'hit',{uid:e.uid,...pathPoint(e.progress),damage:Math.round(amount),hero,big:amount>100||!!e.boss});
  if(e.hp<=0){s.stats.kills++;giveGold(s,e.boss?20:e.kind==='armor'?3:2,'격파');addGauge(s,e.boss?15:1.3);event(s,'kill',{...pathPoint(e.progress),kind:e.kind,boss:e.boss,color:HERO[hero]?.color});}
}
function around(s,e,radius){const p=pathPoint(e.progress);return s.enemies.filter(x=>x.hp>0&&Math.hypot(pathPoint(x.progress).x-p.x,pathPoint(x.progress).y-p.y)<=radius);}
function applyHit(s,shot){
  const e=s.enemies.find(x=>x.uid===shot.target&&x.hp>0);if(!e)return;
  const hero=HERO[shot.hero],type=hero.trait.type;
  let amount=shot.damage;if(type==='execute'&&e.hp/e.maxHp<.35)amount*=2;
  if(type==='shatter'&&e.slowTime>0)amount*=1.75;
  if(type==='splash'&&e.burnTime>0)amount*=1.4;
  const area=['slash','fire','stone','cosmos'].includes(hero.attack)||type==='shatter'?around(s,e,hero.attack==='fire'?65:48):[e];
  for(const target of area)damage(s,target,amount,hero.id);
  if(type==='chain'||type==='gust'){
    const others=around(s,e,180).filter(x=>x.uid!==e.uid).sort((a,b)=>Math.abs(a.progress-e.progress)-Math.abs(b.progress-e.progress)).slice(0,type==='chain'?2:1);
    let from=pathPoint(e.progress);for(const target of others){damage(s,target,amount*.65,hero.id);const to=pathPoint(target.progress);event(s,'chain',{from,to,color:hero.color});from=to;}
  }
  if(type==='burn'){for(const t of around(s,e,55)){if(amount*.23>=t.burn){t.burn=amount*.23;t.burnOwner=hero.id;}t.burnTime=3;}}
  if(type==='slow'||type==='chrono'||type==='gravity'){for(const t of type==='gravity'?area:[e]){t.slow=type==='chrono'?.25:.4;t.slowTime=2.4;}}
  if(type==='poison')addPoison(s,e,shot.rank,7,40);
  if(type==='stun'&&shot.count%3===0)e.stun=Math.max(e.stun,.7);
  if(type==='fear'&&shot.count%3===0)e.progress=Math.max(0,e.progress-35);
  if(type==='expose'){e.exposed=Math.max(e.exposed,.18);e.exposeTime=4;}
  if(type==='battery')addGauge(s,.5*(s.buffs.march>0?2:1));
  if(has(s,'meteor')&&shot.count%12===0){for(const t of around(s,e,100))damage(s,t,amount*1.8,hero.id);event(s,'meteor',{...pathPoint(e.progress),color:'#f6c888'});}
}
function attack(s,u,index){
  const e=s.enemies.find(x=>x.uid===u.target&&x.hp>0)||chooseTarget(s,u);if(!e)return;
  const hero=HERO[u.hero],at=cellPoint(index),to=pathPoint(e.progress),angle=Math.atan2(to.y-at.y,to.x-at.x);
  u.aim=angle;u.facing=attackDirection(at,to);
  const from={x:at.x+Math.cos(angle)*9,y:at.y+5+Math.sin(angle)*6};
  let multiplier=1;const adjacent=neighbors(index).map(i=>s.board[i]).filter(Boolean);
  if(adjacent.some(a=>HERO[a.hero].trait.type==='powerAura'))multiplier*=1.25;
  if(has(s,'banner')&&!adjacent.length)multiplier*=1.4;
  if(has(s,'crown')&&u.rank>=3)multiplier*=1.25;
  if(s.buffs.awaken>0)multiplier*=1.7;
  u.attacks++;u.pose=.3;
  const value=power(s,u)*multiplier;
  const shot={uid:s.nextId++,target:e.uid,hero:u.hero,damage:value,rank:u.rank,count:u.attacks,from,to,life:Math.hypot(to.x-from.x,to.y-from.y)/650,total:0};shot.total=shot.life;
  s.shots.push(shot);event(s,'attack',{index,hero:u.hero,rank:u.rank,from,to,attackType:hero.attack});
  if(s.buffs.echo>0){s.shots.push({...shot,uid:s.nextId++,damage:value*.65,life:shot.life+.14,total:shot.life+.14});}
}
function speedMultiplier(s,u,index){
  let factor=1;const adjacent=neighbors(index).map(i=>s.board[i]).filter(Boolean);
  if(adjacent.some(a=>HERO[a.hero].trait.type==='hasteAura'))factor+=.22;
  if(s.buffs.haste>0)factor+=.65;if(s.buffs.march>0)factor+=.4;
  if(has(s,'chorus')&&s.board.filter(a=>a?.hero===u.hero).length>=2)factor+=.15;
  if(u.hero.endsWith('_rabbit'))factor+=(new Set(s.board.filter(a=>a?.hero.endsWith('_rabbit')).map(a=>a.hero)).size-1)*.2;
  return factor;
}

export function cast(s,id){
  if(s.phase!=='combat'||!s.enemies.some(e=>e.hp>0))return {ok:false,reason:'적이 나타나면 사용할 수 있습니다.'};
  const u=bestUnit(s,id),hero=HERO[id];if(!u||!s.deck.includes(id))return {ok:false,reason:'전장에 이 영웅이 있어야 합니다.'};
  if(s.gauge<hero.skill.cost)return {ok:false,reason:`별빛 ${hero.skill.cost}이 필요합니다.`};
  s.gauge-=hero.skill.cost;if(has(s,'lantern'))addGauge(s,15);s.stats.skills++;s.tutorial=Math.max(s.tutorial,3);
  const type=hero.skill.type,base=power(s,u),targets=s.enemies.filter(e=>e.hp>0);
  const strike=(factor,pure=false)=>targets.forEach(e=>damage(s,e,base*factor,id,{pure}));
  if(type==='echo')s.buffs.echo=8;
  else if(type==='haste')s.buffs.haste=8;
  else if(type==='awaken')s.buffs.awaken=10;
  else if(type==='march')s.buffs.march=6;
  else if(type==='freeze'){strike(2);for(const e of targets){e.stun=3;e.slow=.5;e.slowTime=6;}}
  else if(type==='avalanche'){for(const e of targets){damage(s,e,base*(e.stun>0?12:6),id);e.slow=.5;e.slowTime=4;}}
  else if(type==='inferno'||type==='dragon'){strike(type==='dragon'?8:6);for(const e of targets){e.burn=base*.6;e.burnTime=5;e.burnOwner=id;}}
  else if(type==='combust'){for(const e of targets){damage(s,e,base*(e.burnTime>0?10:4),id);e.burn=base*.65;e.burnTime=6;e.burnOwner=id;}}
  else if(type==='plague'){for(const e of targets)addPoison(s,e,u.rank*8,12);strike(3,true);}
  else if(type==='expose'){for(const e of targets){e.exposed=.6;e.exposeTime=10;}strike(3);}
  else if(type==='quake'){strike(5);for(const e of targets){e.progress=Math.max(0,e.progress-160);e.stun=2;}}
  else if(type==='nightmare'){strike(4);for(const e of targets){e.progress=Math.max(0,e.progress-220);e.exposed=.25;e.exposeTime=6;}}
  else if(type==='rewind'){for(const e of targets){e.progress=Math.max(0,e.progress-e.speed*6);e.stun=2;}strike(3);}
  else if(type==='vortex'||type==='singularity'){
    const front=targets.reduce((max,e)=>Math.max(max,e.progress),0),point=Math.max(120,front-80);
    for(const e of targets){e.progress=e.progress*.35+point*.65;e.stun=type==='singularity'?2:1.5;e.slow=.6;e.slowTime=4;}
    strike(type==='singularity'?10:5);
  }else if(type==='execute'){
    const top=[...targets].sort((a,b)=>b.maxHp-a.maxHp).slice(0,5);for(const e of top)damage(s,e,base*(e.hp/e.maxHp<.35?30:16),id,{pure:true});
  }else if(type==='flurry'){for(const e of [...targets].sort((a,b)=>b.progress-a.progress).slice(0,9))damage(s,e,base*14,id);}
  else if(type==='thunder'){strike(7);for(const e of targets)e.stun=1.2;}
  else if(type==='fortune'||type==='dividend'){strike(3);giveGold(s,type==='fortune'?25:30,'필살기');}
  event(s,'skill',{hero:id,name:hero.skill.name,kind:type,rank:u.rank});return {ok:true};
}

function bossStep(s,e,dt){
  const boss=BOSSES[e.boss];
  if(e.channel>0){
    e.channel-=dt;
    if(e.channel<=0){
      const interrupted=e.channelHp-e.hp>=e.maxHp*.06;
      if(boss.pattern==='heal'){
        if(interrupted){e.stun=2;event(s,'interrupt',{name:boss.name});}else{e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.14);event(s,'bossHeal',{uid:e.uid});}
      }else if(boss.pattern==='seal'){
        for(const i of s.telegraph?.cells||[])if(s.board[i])s.board[i].disabled=3.2;
        event(s,'seal',{cells:s.telegraph?.cells||[]});
      }else if(boss.pattern==='drain'){s.gauge=Math.max(0,s.gauge-25);event(s,'drain');}
      else if(boss.pattern==='rush'){for(const target of s.enemies)if(target.stun<=0&&target.slowTime<=0)target.progress+=130;event(s,'rush');}
      s.telegraph=null;e.skillIn=9;
    }
  }else{
    e.skillIn-=dt;
    if(e.skillIn<=0){
      e.channel=2.6;e.channelHp=e.hp;
      const row=Math.floor(random(s)*5),cells=Array.from({length:5},(_,i)=>row*5+i);
      s.telegraph={uid:e.uid,pattern:boss.pattern,text:boss.warning,cells,ends:s.time+2.6};event(s,'warning',{text:boss.warning,cells,pattern:boss.pattern});
    }
  }
}
function completeWave(s){
  const payout={base:14+Math.floor(s.wave/2),interest:interest(s),dividend:dividend(s)};
  giveGold(s,payout.base,'웨이브');giveGold(s,payout.interest,'이자');giveGold(s,payout.dividend,'배당');s.settlement=payout;addGauge(s,8);s.shots=[];s.telegraph=null;
  event(s,'clear',{wave:s.wave,...payout});
  if(s.wave===12&&!s.endless){s.phase='victory';s.won=true;return;}
  if(s.wave%4===0){s.reward=artifactOffers(s,3);if(s.reward.length){s.phase='reward';return;}s.reward=null;}
  if(s.wave%3===0){openShop(s);return;}
  s.phase='intermission';s.breakTime=4;
}
function artifactOffers(s,count){return shuffle(s,ARTIFACTS.filter(a=>!has(s,a.id)).map(a=>a.id)).slice(0,count);}
function openShop(s){s.phase='shop';s.shop={rerolls:0,items:shopItems(s)};}
function shopItems(s){const relics=artifactOffers(s,2);return [
  {kind:'hero',hero:s.deck[Math.floor(random(s)*6)],rank:2,price:38,sold:false},
  ...relics.map(id=>({kind:'artifact',artifact:id,price:ARTIFACT[id].price,sold:false})),
];}
export function rerollShop(s){if(s.phase!=='shop')return {ok:false};const cost=8+s.shop.rerolls*4;if(s.gold<cost)return {ok:false,reason:'골드가 부족합니다.'};s.gold-=cost;s.shop.rerolls++;s.shop.items=shopItems(s);return {ok:true};}
export function buy(s,index){
  if(s.phase!=='shop')return {ok:false};const item=s.shop.items[index];if(!item||item.sold)return {ok:false};
  if(s.gold<item.price)return {ok:false,reason:'골드가 부족합니다.'};
  if(item.kind==='hero'&&freeCell(s)<0)return {ok:false,reason:'전장에 빈자리가 필요합니다.'};
  if(item.kind==='artifact'&&has(s,item.artifact))return {ok:false};
  s.gold-=item.price;item.sold=true;if(item.kind==='hero')place(s,item.hero,item.rank);else{s.artifacts.push(item.artifact);event(s,'artifact',{id:item.artifact});}return {ok:true};
}
export function chooseReward(s,id){if(s.phase!=='reward'||!s.reward.includes(id))return {ok:false};s.artifacts.push(id);s.reward=null;event(s,'artifact',{id});nextWave(s);return {ok:true};}
export function nextWave(s){if(['shop','intermission','reward'].includes(s.phase)){s.shop=null;s.reward=null;beginWave(s,s.wave+1);}}
export function continueEndless(s){if(s.phase!=='victory')return;s.endless=true;beginWave(s,s.wave+1);}

export function step(s,dt){
  if(!['combat','intermission'].includes(s.phase))return;
  dt=clamp(dt,0,.05);s.time+=dt;
  for(const key of Object.keys(s.buffs))s.buffs[key]=Math.max(0,s.buffs[key]-dt);
  if(s.phase==='intermission'){s.breakTime-=dt;if(s.breakTime<=0)beginWave(s,s.wave+1);return;}
  s.waveTime+=dt;addGauge(s,dt*1.2*(s.buffs.march>0?2:1));
  s.spawnIn-=dt;if(s.spawnIn<=0&&s.queue.length){spawnEnemy(s,s.queue.shift());s.spawnIn=.72-Math.min(.25,s.wave*.016);}
  for(const e of s.enemies){
    if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.dotFlash-=dt;
    if(e.burnTime>0){damage(s,e,e.burn*dt*(has(s,'ember')?1.6:1),e.burnOwner||'flame_sage',{dot:true});e.burnTime-=dt;}
    if(e.poisonTime>0){damage(s,e,e.poison*dt*3,'mushroom_king',{dot:true,pure:true});e.poisonTime-=dt;}else e.poison=0;
    if(e.slowTime>0)e.slowTime-=dt;
    if(e.exposeTime>0)e.exposeTime-=dt;else e.exposed=0;
    if(e.stun>0){e.stun-=dt;if(s.telegraph?.uid===e.uid)s.telegraph.ends+=dt;}else{e.progress+=e.speed*dt*(e.slowTime>0?1-e.slow:1);if(e.boss)bossStep(s,e,dt);}
    if(e.progress>=PATH_LENGTH&&e.hp>0){e.hp=0;s.health-=e.boss?7:e.kind==='armor'?2:1;event(s,'leak',{boss:e.boss,health:s.health});}
  }
  for(let i=0;i<s.board.length;i++){
    const u=s.board[i];if(!u)continue;u.pose=Math.max(0,u.pose-dt);
    if(u.disabled>0){u.disabled-=dt;continue;}
    if(u.windup>0){u.windup-=dt;if(u.windup<=0)attack(s,u,i);continue;}
    u.cooldown-=dt;if(u.cooldown<=0){const target=chooseTarget(s,u);if(target){u.idleFor=0;u.target=target.uid;const p=cellPoint(i),t=pathPoint(target.progress);u.aim=Math.atan2(t.y-p.y,t.x-p.x);u.facing=attackDirection(p,t);u.windup=.13;u.cooldown=HERO[u.hero].interval/speedMultiplier(s,u,i);}else{u.cooldown=.1;u.idleFor=(u.idleFor||0)+.1;if(u.idleFor>1)u.facing='down';}}
  }
  for(const shot of s.shots){shot.life-=dt;if(shot.life<=0)applyHit(s,shot);}
  s.shots=s.shots.filter(shot=>shot.life>0);s.enemies=s.enemies.filter(e=>e.hp>0);
  if(s.telegraph&&!s.enemies.some(e=>e.uid===s.telegraph.uid))s.telegraph=null;
  if(s.health<=0){s.health=0;s.phase='defeat';event(s,'defeat');}
  else if(!s.enemies.length&&!s.queue.length)completeWave(s);
}

export function serialize(s){const {events,...value}=s;return JSON.stringify(value);}
export function restore(raw){
  try{
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(!s||s.version!==VERSION||!validDeck(s.deck)||!Array.isArray(s.board)||s.board.length!==25||!Array.isArray(s.enemies)||!Array.isArray(s.shots)||!Array.isArray(s.queue))return null;
    const numeric=(o,keys)=>o&&keys.every(k=>Number.isFinite(o[k])&&Math.abs(o[k])<1e100);
    const record=o=>o&&typeof o==='object'&&!Array.isArray(o);
    const id=n=>Number.isSafeInteger(n)&&n>0;
    const kinds=['grunt','armor','runner','wisp','boss'];
    if(!numeric(s,['gold','gauge','health','time','waveTime','spawnIn','breakTime','summons','tutorial','seed'])||s.gold<0||s.health<0||s.health>20||s.gauge<0||s.gauge>100||!Number.isInteger(s.wave)||s.wave<1||s.wave>1000||!Number.isInteger(s.rng)||!id(s.nextId))return null;
    if(!['combat','intermission','shop','reward','victory','defeat'].includes(s.phase)||!CHAPTERS[s.chapter])return null;
    if(s.board.some(u=>u&&(!s.deck.includes(u.hero)||!id(u.uid)||!Number.isInteger(u.rank)||u.rank<1||u.rank>MAX_RANK||!numeric(u,['cooldown','windup','attacks','pose','born','disabled','aim','idleFor'])||!['down','up','left','right'].includes(u.facing)||!['first','strong','last'].includes(u.priority))))return null;
    if(s.enemies.length>1000||s.queue.length>2048||s.shots.length>1000||s.queue.some(k=>!kinds.includes(k)))return null;
    if(s.enemies.some(e=>!id(e?.uid)||!kinds.includes(e.kind)||!numeric(e,['hp','maxHp','progress','speed','slow','slowTime','stun','burn','burnTime','poison','poisonTime','exposed','exposeTime','hit','skillIn','channel','channelHp','dotFlash'])||e.maxHp<=0||e.progress<0||e.progress>PATH_LENGTH||e.boss&&!BOSSES[e.boss]||e.burnOwner&&!HERO[e.burnOwner]))return null;
    if(s.shots.some(e=>!id(e?.uid)||!id(e.target)||!s.deck.includes(e.hero)||!numeric(e,['damage','rank','count','life','total'])||!numeric(e.from,['x','y'])||!numeric(e.to,['x','y'])))return null;
    const ids=[...s.board.filter(Boolean),...s.enemies,...s.shots].map(o=>o.uid);
    if(new Set(ids).size!==ids.length||ids.some(n=>n>=s.nextId))return null;
    if(!Array.isArray(s.bag)||s.bag.length>6||new Set(s.bag).size!==s.bag.length||s.bag.some(h=>!s.deck.includes(h)))return null;
    if(!Array.isArray(s.artifacts)||new Set(s.artifacts).size!==s.artifacts.length||s.artifacts.some(a=>!ARTIFACT[a]))return null;
    if(!record(s.upgrades)||s.deck.some(h=>!Number.isInteger(s.upgrades[h])||s.upgrades[h]<0||s.upgrades[h]>5)||!record(s.buffs)||Object.values(s.buffs).some(n=>!Number.isFinite(n)))return null;
    if(!numeric(s.stats,['kills','merges','summons','skills','damage'])||!record(s.stats.income)||!record(s.stats.byHero)||Object.values(s.stats.income).some(n=>!Number.isFinite(n))||Object.entries(s.stats.byHero).some(([h,n])=>!HERO[h]||!Number.isFinite(n)))return null;
    if(s.telegraph&&(!id(s.telegraph.uid)||!numeric(s.telegraph,['ends'])||!['seal','heal','drain','rush'].includes(s.telegraph.pattern)||!Array.isArray(s.telegraph.cells)||s.telegraph.cells.some(n=>!Number.isInteger(n)||n<0||n>24)))return null;
    if(s.settlement&&!numeric(s.settlement,['base','interest','dividend']))return null;
    if(s.phase==='shop'&&(!s.shop||!Number.isInteger(s.shop.rerolls)||s.shop.rerolls<0||!Array.isArray(s.shop.items)||s.shop.items.length>3||s.shop.items.some(i=>!i||!numeric(i,['price'])||i.price<0||!['hero','artifact'].includes(i.kind)||(i.kind==='hero'?(!s.deck.includes(i.hero)||i.rank!==2):!ARTIFACT[i.artifact]))))return null;
    if(s.phase==='reward'&&(!Array.isArray(s.reward)||!s.reward.length||s.reward.length>3||s.reward.some(a=>!ARTIFACT[a]||s.artifacts.includes(a))))return null;
    s.events=[];return s;
  }catch{return null;}
}
