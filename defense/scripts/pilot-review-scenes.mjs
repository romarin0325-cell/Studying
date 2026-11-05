import * as Combat from '../src/combat/engine.js';

export const REVIEW_STEP = .05;
export const REVIEW_HEROES = ['cherry_prince', 'red_dragon', 'siren'];
export const REVIEW_ALLIES = ['guardian', 'snow_rabbit', 'queen', 'star_boy'];
export const REVIEW_SCENES = [
  {id:'royal', hero:'cherry_prince', name:'필살기 · 대상 잠금', detail:'최대 체력이 더 큰 보스와 남은 체력이 더 많은 적을 함께 배치했습니다.', ticks:43},
  {id:'royal-heat', hero:'cherry_prince', name:'필살기 · 잠금 후 강화', detail:'잠금 뒤 표적에 화상이 생깁니다. 명중 순간의 상태로 강화가 결정됩니다.', ticks:43},
  {id:'royal-lost', hero:'cherry_prince', name:'필살기 · 표적 소실', detail:'잠긴 적이 화상으로 먼저 쓰러집니다. 꽃받침이 닫히는 모습을 확인할 수 있습니다.', ticks:40},
  {id:'royal-basic', hero:'cherry_prince', name:'일반 공격 · 검광', detail:'화상에 걸린 단일 대상에 검광을 한 번 발사합니다.', ticks:39, basic:true},
  {id:'breath', hero:'red_dragon', name:'필살기 · 밀집 지점', detail:'착탄점 주위에 적이 모여 있고 반경 밖에도 적이 있습니다. 범위 안내를 켜면 원과 명중점이 보입니다.', ticks:47},
  {id:'breath-left', hero:'red_dragon', name:'필살기 · 왼쪽 경로', detail:'왼쪽을 향한 자세와 입에서 착탄점으로 이어지는 숨결을 확인할 수 있습니다.', ticks:47},
  {id:'breath-crowd', hero:'red_dragon', name:'필살기 · 밀집 전투', detail:'25개 칸을 채우고 보스의 위험 예고와 여러 일반 공격을 겹쳤습니다.', ticks:52},
  {id:'breath-basic', hero:'red_dragon', name:'일반 공격 · 불씨 폭격', detail:'같은 폭발 안에 화상 대상과 일반 대상이 있습니다.', ticks:43, basic:true},
  {id:'aria', hero:'siren', name:'필살기 · 지원과 합류', detail:'가속 중 빈 칸에 동료가 합류합니다. 음표가 지원 만료까지 유지되는지 볼 수 있습니다.', ticks:225},
  {id:'aria-focus', hero:'siren', name:'필살기 · 스포트라이트', detail:'가장 강한 동료에게 스포트라이트가 적용됩니다. 인접 오라와 필살기 지원 표시도 비교할 수 있습니다.', ticks:225},
  {id:'aria-basic', hero:'siren', name:'일반 공격 · 두 겹 물결', detail:'물결 한 발이 가까이 있는 적들을 함께 때립니다.', ticks:43, basic:true},
];

const CAST_TICK = 10;
const JOIN_TICK = 31;
const HERO_CELL = 12;
const PRESET_BURN = {type:'burn',source:'review:red_dragon:0',owner:'red_dragon'};
const burn = (s, e, dps=2) => e.statusEffects.push({...PRESET_BURN,amount:dps,until:s.time+3});
const dragonPack = [
  {progress:694, hp:4600}, {progress:750, hp:150}, {progress:806, hp:4100},
  {progress:862, hp:3300}, {progress:1094, hp:4100}, {progress:425, hp:3400},
];

function setup(scene, E) {
  const crowd = scene.id === 'breath-crowd';
  const focus = scene.id === 'aria-focus';
  const deck = [...new Set([scene.hero,'siren',...REVIEW_ALLIES])].slice(0,5);
  const s = E.newRun({deck, chapter:0, seed:73921, artifacts:focus?['spotlight']:[], crit:{chance:0,damage:1.5}});
  const unit = {...s.board.find(Boolean)};
  s.board.fill(null);
  function place(index, hero, rank, cooldown=99) {
    s.board[index] = {...unit,uid:s.nextId++,hero,rank,cooldown,windup:0,pose:0,disabled:0,cursed:false,
      aim:0,facing:'down',born:-1,attacks:0,target:null};
  }

  s.queue = [{kind:'boss',hp:10000}];
  s.spawnIn = 0;
  E.step(s, .001);
  const foe = s.enemies[0];
  s.queue = [{kind:'grunt',hp:10000}];
  s.spawnIn = 999;
  s.time = 0;
  s.waveTime = 0;
  s.gauge = 120;
  s.gold = 100;

  place(HERO_CELL, scene.hero, crowd ? 3 : 2, scene.basic ? .13 : 99);
  place(13, 'queen', 3, scene.id.startsWith('aria') && !scene.basic ? .82 : 99);
  place(7, 'guardian', 1);
  place(20, 'snow_rabbit', 1, scene.id.startsWith('aria') && !scene.basic ? 1.15 : 99);

  let enemies;
  if (scene.id === 'royal-basic') {
    enemies = [{progress:833,hp:3000,scorched:true,kind:'armor'}];
  } else if (scene.id === 'royal-lost') {
    enemies = [{progress:812,hp:80,kind:'runner'}, {progress:419,hp:65}];
  } else if (scene.hero === 'cherry_prince') {
    enemies = [
      {progress:819,hp:6100,maxHp:6500,kind:'armor'},
      {progress:989,hp:2200,maxHp:12500,boss:true},
      {progress:490,hp:2000,kind:'runner'},
    ];
  } else if (scene.id === 'breath-basic') {
    enemies = [
      {progress:812,hp:2200,scorched:true,kind:'armor'},
      {progress:764,hp:2300},
      {progress:664,hp:2800},
    ];
  } else if (scene.hero === 'red_dragon') {
    enemies = dragonPack.map((e,i)=>({...e,kind:i%2?'runner':'armor'}));
    if (scene.id==='breath-left') {
      for (const e of enemies) e.progress = e.progress<568?568-e.progress:2788-e.progress;
    }
    if (crowd) {
      for (let i=0;i<s.board.length;i++) {
        if (i===HERO_CELL) continue;
        const hero = [scene.hero,'siren','guardian','snow_rabbit','queen'][i%5];
        place(i, hero, 1, .14 + (i%4)*.065);
      }
      enemies[4] = {...enemies[4], hp:8200, maxHp:8700, boss:true};
    }
  } else if (scene.basic) {
    enemies = [{progress:805,hp:2000,kind:'runner'},{progress:770,hp:2100},{progress:694,hp:2100}];
  } else {
    enemies = [{progress:652,hp:22000,boss:true},{progress:839,hp:9000},{progress:985,hp:9800}];
  }

  s.enemies = enemies.map(({boss,scorched,hp,maxHp=hp,kind='grunt',progress},i)=>{
    const e = {...structuredClone(foe),uid:s.nextId++,kind:boss?'boss':kind,boss:boss?foe.boss:null,
      progress,speed:scene.basic?12:scene.hero==='siren'?17:16,hp,maxHp,skillIn:crowd&&boss?.19:99};
    if (scorched) burn(s,e);
    return e;
  });
  // Keep the basic attacks' chosen target deterministic and near the camera-facing lane.
  if (scene.basic) s.board[HERO_CELL].priority = 'nearest';
  s.events = [];
  return s;
}

export function recordPilotScene(id, E=Combat) {
  const scene = REVIEW_SCENES.find(x=>x.id===id);
  if (!scene) throw new Error('Unknown VFX scene '+id);
  const s = setup(scene,E);
  const frames = [{state:structuredClone(s), events:[]}];
  for (let tick=1;tick<=scene.ticks;tick++) {
    E.step(s, REVIEW_STEP);
    if (!scene.basic && tick===CAST_TICK) {
      const cast = E.cast(s, scene.hero);
      if (!cast.ok) throw new Error(scene.id+': '+cast.reason);
    }
    if (tick===CAST_TICK+2 && (id==='royal-heat'||id==='royal-lost')) {
      const locked = s.finishers.find(f=>f.kind==='royal');
      const target = s.enemies.find(e=>e.uid===locked?.target);
      if (!target) throw new Error('Missing locked target for '+id);
      burn(s,target,id==='royal-lost'?2200:2);
    }
    if (tick===JOIN_TICK && (id==='aria'||id==='aria-focus')) {
      const join = E.summon(s,16);
      if (!join.ok) throw new Error(join.reason);
    }
    const events = s.events.splice(0);
    frames.push({state:structuredClone(s),events});
  }
  return {scene,frames};
}
