// Deterministic fixtures for the pass 21 before/after viewer. Both columns run their own copy of the same engine state and
// receive the same engine events; only the renderer differs (main's render.js/effects.js on the left, this branch on the right).
import * as E from '../../../src/combat/engine.js';
import {HERO} from '../../../src/content.js';

export const ENTRIES=Object.freeze([
  {key:'cherry',hero:'cherry_prince',mode:'skill',label:'체리프린스 · 왕자의 일격',duration:2.4,moments:[.12,.3,.45,.62,1.1],options:['kills','empowered','moving'],
    note:'발도: 웅크림 → 꽃잎 속으로 사라짐 → 대상을 지나는 한 줄의 빛 → 대상 너머의 잔상 → 엔진 판정(0.3초 지연)에 맞춰 베인 자리가 갈라지고 꽃잎이 터짐 → 칸으로 돌아와 칼집 반짝임. 강화(48배)는 금빛 두 줄.'},
  {key:'luna',hero:'luna',mode:'skill',label:'루나 · 제노사이드 스텝',duration:2.6,moments:[.15,.35,.6,.9,1.4],options:['kills','moving'],
    note:'엔진이 정한 순서(보스 → 체력 높은 순)대로 보랏빛 잔상이 한 명씩 다가가 초승달 교차 베기. 처형은 보름달. 처형으로 쓰러뜨려 늘어난 대상까지 같은 리듬으로 이어지고, 숫자·사망은 각자 베이는 순간에 보인다.'},
  {key:'frost',hero:'frost_witch',mode:'skill',label:'혹한의마녀 · 빙궁의 칙령',duration:2.8,moments:[.2,.33,.5,.7,1.8],options:['kills','moving'],
    note:'빙궁 인장이 전장 가운데에 찍히고(0.32초) 서리 고리가 길까지 퍼진다. 고리가 지나는 길마다 얼음 가시, 닿는 적마다 큰 가시와 파편, 숫자. 겨울 6초 동안 길에 서리와 눈이 남는다.'},
  {key:'harmony',hero:'harmonious',mode:'skill',label:'하모니어스 · 디저트 앙상블',duration:2.6,moments:[.2,.4,.62,.9,1.6],options:['spotlight'],
    note:'전장 가운데에 디저트 스탠드가 솟고(여섯 가지 디저트), 0.42초에 터지며 아군마다 디저트가 날아가 앉는다. 이웃한 칸은 항상 다른 디저트(행·열 색칠). 10초 동안 아군 발밑에 설탕 반짝임.'},
  {key:'basic-ur',hero:'cherry_prince',mode:'attack',label:'일반 공격 · UR 4명',duration:2.4,moments:[.25,.5,.8,1.2,1.8],options:['moving'],
    note:'체리프린스·루나·혹한의마녀·하모니어스의 평타. 그림은 그대로이고, 모든 평타에 공통으로 적의 흰 섬광(0.12초)·뒤로 2.5px 밀림·접촉 불꽃(UR은 고리와 금빛 반짝임)·숫자 팝이 더해진다.'},
  {key:'basic-rarity',hero:'snow_rabbit',mode:'attack',label:'일반 공격 · 등급별 차이',duration:2.4,moments:[.25,.5,.8,1.2,1.8],options:['moving'],
    note:'C 눈토끼 · R 명탐정 · SR 화염의현자 · UR 지크·루나. 접촉 불꽃은 영웅 색, C는 섬광만, R는 파편 둘, SR는 얇은 고리, UR는 고리와 금빛 반짝임이 더해진다.'},
  {key:'dense',hero:'siren',mode:'attack',label:'일반 공격 · 25기 동시',duration:2.4,moments:[.3,.6,1,1.5,2],options:['moving'],
    note:'25칸을 모두 채우고 동시에 쏜다. 접촉 불꽃·섬광이 얼굴·체력바·위험 칸을 가리지 않는지 본다(같은 적에 겹치는 접촉 불꽃은 밝기를 나눠 쓴다).'},
  // Pass 2 (2026-11-06): the main identity of each ultimate leads; the instant strike rides along.
  {key:'jasmine',hero:'jasmine',mode:'skill',batch:2,label:'자스민 · 여신강림',duration:2.7,moments:[.25,.55,.85,1.1,1.7],options:['kills','spotlight','freed'],
    note:'주 정체성은 전역 공격력 +50%(8초, 우측 상단 타이머)와 기절·저주 해제. 빛을 모으고 → 기도가 하늘로 → 날개 달린 후광이 열리고 → 후광에 가까운 적부터 빛기둥 심판 → 축복의 물결이 편성을 지나며 아군마다 짧은 빛기둥(풀려난 아군은 어두운 파편을 털어냄). 아군 발밑 표식은 남기지 않는다. 3차: 수직으로 떨어지던 깃털을 뺐다.'},
  {key:'queen',hero:'queen',mode:'skill',batch:2,label:'여왕 · 장미의 세금',duration:2.6,moments:[.2,.45,.75,1.3,1.75],options:['kills','repeat'],
    note:'주 정체성은 경제(즉시 20G, 웨이브 끝 수입 +50% 웨이브당 1회). 왕관 → 장미 꽃잎 폭풍 → 가까운 적부터 가시와 장미 → 여왕에게서 금화 분수가 한 번 솟아 골드 칸으로(골드는 고정 20G라 적마다 금화를 내지 않는다). 게임에서는 HUD 골드가 금화 도착 때 오른다. 이번 웨이브 첫 시전이면 판 가운데 칙령 인장.'},
  {key:'trauma',hero:'time_magician',mode:'skill',batch:2,label:'시간의마술사 · 트라우마 (SR)',duration:2.2,moments:[.2,.45,.7,.85,1.2],options:['kills','twin'],
    note:'주 정체성은 변신. 자정 → 시계가 떠올라 바늘이 거꾸로 돌다 12시 → 유리에 금이 가고 짧은 오라와 별가루가 소년을 휘감음(3차: 선 리본 대신) → 시계가 깨지며 트라우마 등장(그 전까지 이전 모습) → 유리구두 → 자정의 종소리 파동이 적을 친다. 10초 동안 발밑에 은은한 빛만 남는다(남은 시간은 우측 상단 타이머).'},
  {key:'trauma-end',hero:'time_magician',mode:'idle',batch:2,label:'시간의마술사 · 변신 해제',duration:1.4,moments:[.3,.45,.6,.8,1],options:[],
    note:'트라우마가 끝나는 순간(0.35초): 유리 파편이 모여 터지며 소년으로 돌아온다. 기존에는 아무 표시 없이 그림만 바뀌었다.'},
  {key:'whale',hero:'galaxy_whale',mode:'skill',batch:2,label:'은하고래 · 별바다의 중심',duration:2.8,moments:[.3,.6,.9,1.22,1.6],options:['kills','marks'],
    note:'끌어당김과 성광 수확이 정체성. 판이 우주로 → 별빛 고래가 판 위를 헤엄쳐 → 모이는 지점에 은하가 열리고 적이 길을 따라 미끄러져 빨려 듦(기존: 순간이동) → 성광이 금빛 별로 뜯겨 핵으로 → 은하가 붕괴하며 초신성(성광을 거둔 적은 금빛).'},
  {key:'rewind',hero:'time_ruler',mode:'skill',batch:2,label:'시간의지배자 · 아직 오지 않은 순간',duration:2.6,moments:[.2,.5,.8,1,1.8],options:['kills','moving'],
    note:'되감기와 정지가 정체성. 시간이 멈추며 판의 색이 빠지고(시간의지배자만 색 유지) 거대한 시계와 톱니 → 바늘이 거꾸로 돌며 적이 지나온 길을 따라 되돌아감(빠른 적일수록 멀리, 되돌린 길이 빛남) → 12시 종 → 모든 적 타격·정지, 정지 동안 머리 위 모래시계(기존 별 대신).'},
  // Pass 3 (2026-11-06): Cinderella, Venom, Doom, Rumi and her dream form; Red Dragon, Aurora and Shooting Star Boy; Ash for reference.
  {key:'cinderella',hero:'cinderella',mode:'skill',batch:3,label:'신데렐라 · 자정의 기적',duration:2.8,moments:[.2,.5,.8,1.1,1.7],options:['kills'],
    note:'주 정체성은 자정의 기적(10초 자정: 공격 속도 +50%, 네 번째 공격마다 종). 시간의마술사와 대칭: 트라우마의 시계는 거꾸로 돌다 깨지지만, 신데렐라의 시계는 판 곳곳의 유리 조각이 모여 완성되고 바늘이 앞으로 돌아 12시 → 시계 속 종이 세 번 울리고 종소리 고리가 닿는 적마다 유리별이 떨어짐 → 시계가 빛으로 피어나며 기적의 상징인 유리구두가 떠올랐다 발밑에 내려앉음. 자정 동안 네 번째 공격의 종도 같은 종으로 그린다.'},
  {key:'venom',hero:'venom',mode:'skill',batch:3,label:'베놈 · 플래이그',duration:2.6,moments:[.2,.45,.75,1.1,1.6],options:['kills'],
    note:'조용한 개화(폭발·섬광 없음). 판이 어두워지고 발밑에 검은 피안화가 피며 독나비가 오름 → 검은 뿌리가 바닥을 타고 적마다 뻗음 → 뿌리가 닿는 적 발밑에 피안화가 피는 순간 타격, 독기와 나비 → 꽃이 시듦. 10초 증폭은 기존 적 발밑 녹색 고리.'},
  {key:'doom',hero:'doom',mode:'skill',batch:3,label:'둠 · 왕궁의 암거래',duration:2.6,moments:[.2,.45,.75,1.1,1.6],options:['kills','rich'],
    note:'거래가 주인공. HUD 골드에서 금화가 손의 검은 봉투로 → 진홍 봉인 → 머리 위 단검 부채(1개 + 남은 골드 40마다 1개 = 보너스 배율) → 모든 적 위에 단검이 서고 동시에 진홍 X. "남은 골드 많음"을 끄면 단검이 1개다.'},
  {key:'rumi',hero:'rumi',mode:'skill',batch:3,label:'루미 · 꿈의 메아리',duration:2.2,moments:[.15,.35,.6,1,1.6],options:[],
    note:'기본 꿈의 메아리(8초 동안 모든 공격에 추가 공격)는 수수하게: 깃펜을 들어 아군을 잇는 별자리를 그리고, 한 번 반짝인 뒤 사라진다. 아군 발밑 표식은 없다(지속시간은 우측 상단 타이머).'},
  {key:'rumi-dream',hero:'rumi',mode:'skill',batch:3,label:'루미 5성 · 꿈의 형태',duration:3.2,moments:[.3,.7,1.2,1.7,2.4],options:['kills'],
    note:'궁극 필살기. 엔진의 네 번 타격(해 0.45초, 달 1.0초, 별 1.55초, 꿈 2.3초)에 맞춰 각 상징이 떠오르고 내리친다: 해(왼쪽 길 위)는 적마다 빛기둥, 달(오른쪽 길 위)은 초승달 베기, 컷인 띠가 걷힌 뒤 별(위쪽 길 위)은 별빛 폭발 → 셋이 가운데로 돌며 하나가 되고 판 전체에 파스텔 꽃이 핀다. 상징은 아군 얼굴을 가리지 않게 길 위에 둔다.'},
  {key:'red-dragon',hero:'red_dragon',mode:'skill',batch:3,label:'레드드래곤 · 용의 숨결 (R)',duration:2,moments:[.1,.25,.4,.6,1],options:['kills'],
    note:'범위 공격이 읽히게(애쉬와 비슷하거나 조금 덜). 실제 반경 180에 열기 고리가 모이는 동안 들숨과 입의 불씨 → 한 줄기 숨결이 무리 한가운데로 → 고리가 실제 경계에서 터지고 가운데 불기둥, 적마다 불꽃(가운데부터). 기존의 시전자 쪽 큰 용 문양은 뺐다.'},
  {key:'ash',hero:'ash',mode:'skill',batch:3,label:'애쉬 · 아마겟돈 (SR, 비교 기준)',duration:2.2,moments:[.15,.35,.6,.9,1.4],options:['kills'],
    note:'레드드래곤 범위 공격의 화려함 기준(변경 없음).'},
  {key:'zeke',hero:'zeke',mode:'skill',batch:3,label:'지크 · 라그나로크 (UR, 비교 기준)',duration:2.4,moments:[.2,.5,.8,1.1,1.6],options:['kills'],
    note:'색 정체성·에셋 일관성 판단용 기준(변경 없음). 전용으로 칠한 시퀀스 시트를 쓰는 기존 UR.'},
  {key:'phantom',hero:'phantom',mode:'skill',batch:3,label:'팬텀 · 끝없는 밤 (SR, 비교 기준)',duration:2,moments:[.2,.45,.7,1,1.4],options:['kills'],
    note:'색 정체성·에셋 일관성 판단용 기준(변경 없음). 판 가운데 큰 문양을 띄우는 기존 방식.'},
  {key:'aurora',hero:'aurora',mode:'skill',batch:3,label:'아우로라 · 천면경 (R)',duration:5.8,moments:[.3,1.5,3,4.6,5.3],options:['kills'],
    note:'거울 축적이 보이게(R등급 수준). 대상 위에 손거울이 서고 빛줄로 대상과 이어짐 → 대상이 맞을 때마다 빛 조각이 거울로 빨려 들고 거울 빛이 차오름(모은 피해 ÷ 12배 피해), 시간이 갈수록 금이 늘어남 → 5초에 깨지며 빛이 대상에 내리꽂힘. 축적 표시가 늘 비어 있던 버그와 "천만경" 표기(스킬 이름은 천면경)도 고쳤다.'},
  {key:'star-boy',hero:'star_boy',mode:'skill',batch:3,label:'별똥별소년 · 소원을 담은 별 (C)',duration:1.8,moments:[.1,.25,.4,.6,1],options:['kills'],
    note:'쓴 별빛이 보이게(C등급 수준). 대상 발밑 조준 고리와 쓴 별빛(★) → 하늘에서 비스듬히 떨어지는 유성(쓴 별빛 60이면 1배, 120이면 1.35배) → 별 모양 폭발.'},
]);

export const ROSTERS={
  cherry:{deck:['cherry_prince','jasmine','siren','queen','zeke'],units:[[22,'cherry_prince',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  luna:{deck:['luna','jasmine','siren','queen','zeke'],units:[[12,'luna',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  frost:{deck:['frost_witch','jasmine','siren','queen','zeke'],units:[[12,'frost_witch',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  harmony:{deck:['harmonious','siren','queen','jasmine','zeke'],units:[[12,'harmonious',3],...[0,1,2,3,4,5,7,9,10,11,13,14,15,17,19,20,21,22,23,24].map((c,i)=>[c,['siren','queen','jasmine','zeke'][i%4],1])]},
  'basic-ur':{deck:['cherry_prince','luna','frost_witch','harmonious','siren'],units:[[11,'cherry_prince',3],[10,'luna',3],[13,'frost_witch',3],[14,'harmonious',3]],road:[1745,1865,1925,1985,803,863,923,1394]},
  'basic-rarity':{deck:['snow_rabbit','great_detective','flame_sage','zeke','luna'],units:[[10,'snow_rabbit',3],[11,'great_detective',3],[13,'flame_sage',3],[20,'zeke',3],[14,'luna',3]],road:[1745,1805,1865,1925,1985,803,863,923]},
  jasmine:{deck:['jasmine','siren','queen','zeke','luna'],units:[[12,'jasmine',3],...[1,2,3,5,6,7,8,9,11,13,15,16,17,18,19,21,22,23].map((c,i)=>[c,['siren','queen','zeke','luna'][i%4],1])]},
  queen:{deck:['queen','jasmine','siren','zeke','luna'],units:[[17,'queen',3],[6,'jasmine',1],[8,'siren',1],[11,'zeke',1],[13,'luna',1]]},
  trauma:{deck:['time_magician','siren','jasmine','zeke','queen'],units:[[12,'time_magician',3],[6,'siren',1],[8,'jasmine',1],[16,'zeke',1],[18,'queen',1]]},
  'trauma-end':{deck:['time_magician','siren','jasmine','zeke','queen'],units:[[12,'time_magician',3],[6,'siren',1],[8,'jasmine',1],[16,'zeke',1]]},
  whale:{deck:['galaxy_whale','jasmine','siren','queen','zeke'],units:[[12,'galaxy_whale',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  rewind:{deck:['time_ruler','jasmine','siren','queen','zeke'],units:[[12,'time_ruler',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  cinderella:{deck:['cinderella','jasmine','siren','queen','zeke'],units:[[12,'cinderella',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  venom:{deck:['venom','jasmine','siren','queen','zeke'],units:[[12,'venom',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  doom:{deck:['doom','jasmine','siren','queen','zeke'],units:[[12,'doom',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  rumi:{deck:['rumi','jasmine','siren','queen','zeke'],units:[[12,'rumi',3],...[6,7,8,11,13,16,17,18].map((c,i)=>[c,['siren','queen','jasmine','zeke'][i%4],1])]},
  'rumi-dream':{deck:['rumi','jasmine','siren','queen','zeke'],units:[[12,'rumi',5],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  'red-dragon':{deck:['red_dragon','jasmine','siren','queen','zeke'],units:[[12,'red_dragon',3],[6,'jasmine',2],[8,'siren',2],[16,'queen',2],[18,'zeke',2]]},
  ash:{deck:['ash','jasmine','siren','queen','zeke'],units:[[12,'ash',3],[6,'jasmine',2],[8,'siren',1],[16,'queen',2],[18,'zeke',2]]},
  zeke:{deck:['zeke','jasmine','siren','queen','luna'],units:[[12,'zeke',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'luna',1]]},
  phantom:{deck:['phantom','jasmine','siren','queen','zeke'],units:[[12,'phantom',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  aurora:{deck:['aurora','siren','great_detective','zeke','luna'],units:[[12,'aurora',3],[6,'siren',2],[8,'great_detective',2],[16,'zeke',2],[18,'luna',2]]},
  'star-boy':{deck:['star_boy','jasmine','siren','queen','zeke'],units:[[12,'star_boy',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  dense:{deck:['siren','guardian','storm_sage','zeke','luna'],units:Array.from({length:25},(_,i)=>[i,['siren','guardian','storm_sage','zeke','luna'][i%5],1+(i%3)])},
};
// Enemy places along the road (distance from the start). Skill scenes spread them around the whole loop.
const SPREAD=[180,420,640,800,980,1160,1330,1520,1700,1880,2050];
const ATTACK=[300,520,760,1000,1240,1480,1720,1960];

export function reviewScene(entry,{kills=true,empowered=false,spotlight=false,moving=true,chapter=0,freed=true,repeat=false,twin=false,marks=true,rich=true}={}){
  const base=ROSTERS[entry.key],roster=entry.key==='trauma'&&twin?{...base,units:[...base.units,[14,'time_magician',2]]}:base,deck=roster.deck;
  const s=E.newRun({deck,chapter,seed:261106,crit:{chance:0,damage:1.5},artifacts:spotlight?['spotlight']:[]});
  const template={...s.board.find(Boolean)};s.board.fill(null);
  for(const [cell,hero,rank] of roster.units){
    if(!deck.includes(hero))throw Error('fixture deck missing '+hero);
    s.board[cell]={...template,uid:s.nextId++,hero,rank,cooldown:entry.mode==='attack'||entry.key==='aurora'&&hero!=='aurora'?(cell%5)*.11:99,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down',born:-1,attacks:0,idleFor:0,invincible:0,priority:'first',target:null};
    delete s.board[cell].form;
  }
  // Jasmine frees two allies that were stunned and cursed before her cast.
  if(entry.key==='jasmine'&&freed){s.board[7].disabled=3;s.board[17].cursed=true;}
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=0;E.step(s,.001);
  const proto={...s.enemies[0]};if(!proto.uid)throw Error('fixture could not spawn an enemy');
  const fork=(progress,{hp=1e7,boss=null,kind='grunt'}={})=>({...structuredClone(proto),uid:s.nextId++,kind,boss,progress,speed:moving?(kind==='runner'?82:49):0,skillIn:99,hp,maxHp:Math.max(hp,1000),statusEffects:[],slowEffects:[]});
  const skill=entry.mode==='skill';
  let enemies=(skill?SPREAD:roster.road||ATTACK).map((p,i)=>fork(p,{hp:skill&&kills?(i%3===2?1e7:60):1e7,kind:i%4===3?'runner':'grunt'}));
  if(entry.key==='luna'){
    // A sturdy lead target first, then wounded enemies under the execution line so kills carry the step onward.
    enemies=SPREAD.map((p,i)=>fork(p,i===4?{hp:9e6}:kills?{hp:250}:{hp:9e6}));
    for(const e of enemies)if(kills&&e.hp===250){e.maxHp=1000;}
  }
  if(entry.key==='cherry'){
    // The highest-HP enemy is the prince's target; with "kills" it is low enough to fall to the cut.
    enemies=SPREAD.slice(0,8).map((p,i)=>fork(p,{hp:i===5?(kills?400:9e6):kills?60:1e6}));
    if(empowered){const t=enemies[5];t.statusEffects.push({type:'divine',source:'fixture',owner:'jasmine',amount:3,until:30});}
  }
  // Divine marks for the whale to harvest: three on the toughest enemies, one on a few more.
  if(entry.key==='whale'&&marks)enemies.forEach((e,i)=>{if(i%3!==1)e.statusEffects.push({type:'divine',source:'fixture',owner:'jasmine',amount:i%3===2?3:1,until:30});});
  // The breath and Armageddon land on the densest pack: six close together in the middle of the road, three stragglers elsewhere.
  if(entry.key==='red-dragon'||entry.key==='ash')enemies=[960,1010,1060,1110,1160,1215,420,1700,1960].map((p,i)=>fork(p,{hp:kills&&i%2===0?60:1e7,kind:i%4===3?'runner':'grunt'}));
  // Aurora's mirror goes on the toughest enemy while the allies keep attacking.
  if(entry.key==='aurora')enemies=SPREAD.slice(0,7).map((p,i)=>fork(p,{hp:i===3?2e7:1e7}));
  if(entry.key==='dense')enemies=[...ATTACK,...ATTACK.map(p=>p+110)].map(p=>fork(p));
  s.enemies=enemies;
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.events=[];s.time=0;s.shots=[];s.finishers=[];s.volleys=[];s.zones=[];s.telegraph=null;s.gauge=entry.key==='star-boy'?120:200;s.gold=entry.key==='doom'&&!rich?60:400;s.phase='combat';s.health=99;
  if(entry.key==='queen'&&repeat)s.edictWave=s.wave;
  // The transformation ending: Trauma has 0.35 s left when the scene starts.
  if(entry.key==='trauma-end'){s.buffs.trauma=.35;s.buffTotals.trauma=10;}
  // The viewer draws one frame before the cast, as the game always has a previous frame when an ultimate fires.
  const cast=()=>{
    if(!skill)return [];
    const result=E.cast(s,entry.hero);if(!result.ok)throw Error(entry.key+': '+(result.reason||'cast failed'));
    if(!s.events.some(e=>e.type==='skill'&&e.hero===entry.hero))throw Error(entry.key+': missing skill event');
    return s.events.splice(0);
  };
  return {state:s,cast,advance(dt){E.step(s,dt);return s.events.splice(0);}};
}
export const isUltimateUR=entry=>entry.mode==='skill'&&(HERO[entry.hero].hidden||HERO[entry.hero].rarity==='UR');
