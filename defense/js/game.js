import { TAU, DPR_CAP, GRID, CORE_CELL, SAVE_KEY, DIFFICULTIES, TOWERS, BIOMES, MUTATORS, SPECIALS, ENEMIES, BOSSES, TECHS, RELICS } from './config.js';
import { rand, irand, clamp, lerp, dist, fmt, rgba, weightedPick, shuffle, keyOf } from './utils.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const ctx = canvas.getContext('2d');

const ui = {
  app: $('#app'),
  hud: $('#hudLayer'),
  statBar: $('#statBar'),
  brandSub: $('#brandSub'),
  contextTitle: $('#contextTitle'),
  contextText: $('#contextText'),
  stageBadge: $('#stageBadge'),
  startWaveBtn: $('#startWaveBtn'),
  startWaveSub: $('#startWaveSub'),
  towerTray: $('#towerTray'),
  abilityBtn: $('#abilityBtn'),
  abilitySmall: $('#abilitySmall'),
  upgradeBtn: $('#upgradeBtn'),
  upgradeSmall: $('#upgradeSmall'),
  sellBtn: $('#sellBtn'),
  sellSmall: $('#sellSmall'),
  joystick: $('#joystick'),
  stickBase: $('#stickBase'),
  stickThumb: $('#stickThumb'),
  hintLine: $('#hintLine'),
  toast: $('#toast'),
  title: $('#titleScreen'),
  heroGrid: $('#heroGrid'),
  diffGrid: $('#diffGrid'),
  startRunBtn: $('#startRunBtn'),
  bestScore: $('#bestScore'),
  bestStage: $('#bestStage'),
  clearCount: $('#clearCount'),
  modalLayer: $('#modalLayer'),
  modalTitle: $('#modalTitle'),
  modalText: $('#modalText'),
  modalChoices: $('#modalChoices'),
  modalReroll: $('#modalReroll'),
  modalSecondary: $('#modalSecondary'),
};

const G = {
  width: 0,
  height: 0,
  dpr: 1,
  now: 0,
  dt: 0,
  state: 'title',
  modal: null,
  run: null,
  hoverCell: null,
  stats: null,
  meta: loadMeta(),
  selectedHero: 'vanguard',
  selectedDiff: 'standard',
  pointer: {x:0, y:0},
  input: {
    keys: {},
    buildType: null,
    joystick: {active:false, id:null, x:0, y:0, rect:null},
  },
  layout: {
    portrait: false,
    hudH: 0,
    dockH: 0,
    field: {x:0,y:0,w:0,h:0},
    board: {x:0,y:0,w:0,h:0},
    cell: 0,
  },
  toastTimer: 0,
  hintTimer: 0,
  hintText: '',
  shake: 0,
  frame: 0,
  hudTick: 0,
  hudStatEls: null,
};
window.__riftDebug = G;


const HEROES = {
  vanguard: {
    id:'vanguard',
    name:'선봉대장',
    color:'linear-gradient(135deg,#6cb8ff,#7f7cff)',
    desc:'탄막과 폭발이 안정적인 만능형.',
    bulletColor:'#8fe7ff',
    perks:['공격 속도 빠름','수류탄으로 취약 부여'],
    base:{ hp:120, speed:190, range:210, damage:13, rate:4.4, crit:0.07, abilityCd:12 },
    abilityName:'충격 수류탄',
    ability(run){
      const target = findClusterTarget(run, 180);
      if (!target) return false;
      burst(run, target.x, target.y, 84 * run.mods.abilityPower, 86, 'explosive', { vuln: 4.5, color:'#89f0ff' });
      run.hero.abilityTimer = run.hero.stats.abilityCd;
      toast('충격 수류탄');
      return true;
    }
  },
  arcanist: {
    id:'arcanist',
    name:'비전술사',
    color:'linear-gradient(135deg,#bb7cff,#73e8ff)',
    desc:'연쇄 사격과 감속장으로 흐름을 끊는 제어형.',
    bulletColor:'#d7beff',
    perks:['연쇄 비전탄','정지장으로 광역 감속'],
    base:{ hp:110, speed:185, range:220, damage:11, rate:3.5, crit:0.05, abilityCd:14 },
    abilityName:'정지장',
    ability(run){
      const target = findClusterTarget(run, 220) || { x: run.hero.x, y: run.hero.y };
      run.fields.push({ kind:'stasis', x:target.x, y:target.y, r:96, t:4.8, tick:0, color:'#a493ff' });
      run.hero.abilityTimer = run.hero.stats.abilityCd;
      toast('정지장 전개');
      return true;
    }
  },
  machinist: {
    id:'machinist',
    name:'기계감독',
    color:'linear-gradient(135deg,#ffb76c,#ff8080)',
    desc:'현장 증폭으로 타워 화력을 폭발시키는 운영형.',
    bulletColor:'#ffddb2',
    perks:['타워 강화 효율 우수','오버클럭 버프'],
    base:{ hp:125, speed:180, range:190, damage:9, rate:4.0, crit:0.05, abilityCd:15 },
    abilityName:'현장 오버클럭',
    ability(run){
      run.hero.overclock = 6.5;
      run.hero.abilityTimer = run.hero.stats.abilityCd;
      toast('현장 오버클럭');
      return true;
    }
  },
};

function loadMeta(){
  try {
    return Object.assign({ bestScore:0, bestStage:0, clears:0 }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
  } catch {
    return { bestScore:0, bestStage:0, clears:0 };
  }
}
function saveMeta(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(G.meta));
}

function cellCenter(x,y){
  const s = G.layout.cell;
  return { x:G.layout.board.x + x*s + s/2, y:G.layout.board.y + y*s + s/2 };
}
function worldToCell(x,y){
  const s = G.layout.cell;
  return { x: Math.floor((x - G.layout.board.x) / s), y: Math.floor((y - G.layout.board.y) / s) };
}
function inGrid(x,y){ return x >= 0 && x < GRID.cols && y >= 0 && y < GRID.rows; }
function boardContains(x,y){
  const b = G.layout.board;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
function roundRect(ctx,x,y,w,h,r){
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function text(str,x,y,size,color,align='left',weight='700'){
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Inter, Pretendard, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str,x,y);
}

function mapBoardPoint(x, y, fromBoard, toBoard){
  if (!fromBoard.w || !fromBoard.h) return { x, y };
  const nx = clamp((x - fromBoard.x) / fromBoard.w, 0, 1);
  const ny = clamp((y - fromBoard.y) / fromBoard.h, 0, 1);
  return {
    x: toBoard.x + nx * toBoard.w,
    y: toBoard.y + ny * toBoard.h,
  };
}

function reflowRunAfterResize(run, prevBoard){
  const nextBoard = G.layout.board;
  const scale = prevBoard.w > 0 ? nextBoard.w / prevBoard.w : 1;

  const heroPoint = mapBoardPoint(run.hero.x, run.hero.y, prevBoard, nextBoard);
  run.hero.x = heroPoint.x;
  run.hero.y = heroPoint.y;

  for (const tower of run.towers) {
    const pos = cellCenter(tower.cx, tower.cy);
    tower.x = pos.x;
    tower.y = pos.y;
  }

  for (const enemy of run.enemies) {
    const pos = mapBoardPoint(enemy.x, enemy.y, prevBoard, nextBoard);
    enemy.x = pos.x;
    enemy.y = pos.y;
    enemy.radius = G.layout.cell * (enemy.isBoss ? 0.34 * enemy.def.size : 0.28 * enemy.def.size);
    if (Number.isInteger(enemy.routeIndex) && run.currentStage?.paths?.[enemy.routeIndex]) {
      enemy.path = run.currentStage.paths[enemy.routeIndex].map(c => cellCenter(c.x, c.y));
    } else {
      enemy.path = enemy.path.map(p => mapBoardPoint(p.x, p.y, prevBoard, nextBoard));
    }
  }

  for (const projectile of run.projectiles) {
    const pos = mapBoardPoint(projectile.x, projectile.y, prevBoard, nextBoard);
    projectile.x = pos.x;
    projectile.y = pos.y;
    if (projectile.kind === 'mortar') {
      const s = mapBoardPoint(projectile.sx, projectile.sy, prevBoard, nextBoard);
      const t = mapBoardPoint(projectile.tx, projectile.ty, prevBoard, nextBoard);
      projectile.sx = s.x;
      projectile.sy = s.y;
      projectile.tx = t.x;
      projectile.ty = t.y;
      projectile.aoe *= scale;
    }
  }

  for (const field of run.fields) {
    const pos = mapBoardPoint(field.x, field.y, prevBoard, nextBoard);
    field.x = pos.x;
    field.y = pos.y;
    field.r *= scale;
  }

  for (const particle of run.particles) {
    const pos = mapBoardPoint(particle.x, particle.y, prevBoard, nextBoard);
    particle.x = pos.x;
    particle.y = pos.y;
  }

  for (const popup of run.popups) {
    const pos = mapBoardPoint(popup.x, popup.y, prevBoard, nextBoard);
    popup.x = pos.x;
    popup.y = pos.y;
  }
}

function gainGold(run, amount){
  const gained = Math.round(Math.max(0, amount) * run.mods.gold);
  run.gold += gained;
  return gained;
}

function updateMetaUI(){
  ui.bestScore.textContent = fmt(G.meta.bestScore);
  ui.bestStage.textContent = fmt(G.meta.bestStage);
  ui.clearCount.textContent = fmt(G.meta.clears);
}

function initTitle(){
  ui.heroGrid.innerHTML = '';
  Object.values(HEROES).forEach(hero => {
    const el = document.createElement('button');
    el.className = 'heroCard' + (hero.id === G.selectedHero ? ' active' : '');
    el.style.setProperty('--hero', hero.color);
    el.innerHTML = `<div class="heroBadge"></div><h3>${hero.name}</h3><p>${hero.desc}</p><ul>${hero.perks.map(p => `<li>${p}</li>`).join('')}</ul>`;
    el.onclick = () => {
      G.selectedHero = hero.id;
      [...ui.heroGrid.children].forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    };
    ui.heroGrid.appendChild(el);
  });
  ui.diffGrid.innerHTML = '';
  Object.values(DIFFICULTIES).forEach(diff => {
    const el = document.createElement('button');
    el.className = 'diffCard' + (diff.id === G.selectedDiff ? ' active' : '');
    el.innerHTML = `<h3>${diff.name}</h3><p>${diff.desc}</p><div class="diffDots">${'<i></i>'.repeat(diff.stars)}</div>`;
    el.onclick = () => {
      G.selectedDiff = diff.id;
      [...ui.diffGrid.children].forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    };
    ui.diffGrid.appendChild(el);
  });
  updateMetaUI();
}

function resize(){
  const prevBoard = { ...G.layout.board };
  const viewport = window.visualViewport;
  G.width = Math.round(viewport?.width || window.innerWidth);
  G.height = Math.round(viewport?.height || window.innerHeight);
  G.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  canvas.width = Math.floor(G.width * G.dpr);
  canvas.height = Math.floor(G.height * G.dpr);
  canvas.style.width = `${G.width}px`;
  canvas.style.height = `${G.height}px`;
  ctx.setTransform(G.dpr,0,0,G.dpr,0,0);

  G.layout.portrait = G.height > G.width * 1.05;
  G.layout.hudH = G.layout.portrait ? 152 : 78;
  G.layout.dockH = G.layout.portrait ? 206 : 162;
  G.layout.field.x = 10;
  G.layout.field.y = G.layout.hudH;
  G.layout.field.w = G.width - 20;
  G.layout.field.h = G.height - G.layout.hudH - G.layout.dockH;

  const cell = Math.floor(Math.min((G.layout.field.w - 16) / GRID.cols, (G.layout.field.h - 16) / GRID.rows));
  G.layout.cell = Math.max(24, cell);
  G.layout.board.w = G.layout.cell * GRID.cols;
  G.layout.board.h = G.layout.cell * GRID.rows;
  G.layout.board.x = Math.floor(G.layout.field.x + (G.layout.field.w - G.layout.board.w) / 2);
  G.layout.board.y = Math.floor(G.layout.field.y + (G.layout.field.h - G.layout.board.h) / 2);

  G.input.joystick.rect = null;
  if (G.run && prevBoard.w > 0 && prevBoard.h > 0) {
    reflowRunAfterResize(G.run, prevBoard);
  }
}

function createRun(heroId, diffId){
  const heroDef = HEROES[heroId];
  const diff = DIFFICULTIES[diffId];
  const heroPos = cellCenter(CORE_CELL.x - 1, CORE_CELL.y + 0.5);
  const run = {
    heroId,
    diffId,
    heroDef,
    diff,
    state:'prepare',
    stageIndex:0,
    score:0,
    gold:150,
    level:1,
    xp:0,
    xpNeed:40,
    rerolls:1,
    cardCounts:{},
    relicIds:new Set(),
    mods: {
      cost:1,
      towerDamage:1,
      towerRate:1,
      towerRange:1,
      ballistic:1,
      explosive:1,
      energy:1,
      frost:1,
      poison:1,
      splash:1,
      crit:0,
      critDamage:0,
      heroDamage:1,
      heroRate:1,
      heroSpeed:1,
      abilityPower:1,
      abilityCd:1,
      gold:1,
      xp:1,
      sellRefund:0.75,
      shatter:1,
      vulnDamage:1,
      freeze:1,
      poisonSpread:1,
      execute:0,
      chain:0,
      extraBolt:0,
      burning:false,
      arcVuln:0,
      frostSplash:false,
      sporeBurst:false,
      specialBoost:1,
      upgradeCost:1,
      upgradeValue:1,
      endRepair:0,
      barrierPerStage:0,
      stageGold:0,
      heroAura:1,
      rareDrafts:0,
      eliteGold:1,
      freeLevel:0,
      debuffDamage:1,
    },
    relicState: {},
    currentStage: null,
    stageOptions: [],
    towers: [],
    enemies: [],
    projectiles: [],
    fields: [],
    particles: [],
    popups: [],
    spawnQueue: [],
    spawnTimer:0,
    kills:0,
    pendingLevelUps:0,
    selectedTowerId:null,
    selectedTowerRef:null,
    nextRoute:null,
    hero: {
      x: heroPos.x,
      y: heroPos.y,
      radius: 13,
      attackCd:0,
      abilityTimer:0,
      overclock:0,
      vectorBoost:0,
      reactorBoost:0,
      stats: null,
    },
    core: { maxHp: 120, hp: 120, barrier: 0, hourglassUsed: false },
  };
  updateHeroStats(run);
  return run;
}

function updateHeroStats(run){
  const base = run.heroDef.base;
  run.hero.stats = {
    speed: base.speed * run.mods.heroSpeed,
    range: base.range,
    damage: base.damage * run.mods.heroDamage,
    rate: base.rate * run.mods.heroRate,
    crit: clamp(base.crit + run.mods.crit, 0, 0.95),
    abilityCd: base.abilityCd * run.mods.abilityCd,
  };
}

function startRun(){
  G.run = createRun(G.selectedHero, G.selectedDiff);
  G.hudTick = 0;
  G.state = 'prepare';
  ui.title.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  createTowerButtons();
  nextStage('start');
  hint('빈 타일을 눌러 타워 배치 · 조이스틱으로 영웅 이동');
}

function createTowerButtons(){
  ui.towerTray.innerHTML = '';
  Object.values(TOWERS).forEach(tower => {
    const el = document.createElement('button');
    el.className = 'towerBtn';
    el.dataset.id = tower.id;
    el.innerHTML = `<div class="name"><span>${tower.name}</span><span class="towerDot" style="color:${tower.color};background:${tower.color}"></span></div><div class="cost">${fmt(tower.cost)} G</div><div class="desc">${tower.desc}</div>`;
    el.onclick = () => {
      if (!G.run || G.state !== 'prepare') return;
      if (G.input.buildType === tower.id) {
        G.input.buildType = null;
        el.classList.remove('active');
        updateContext();
        return;
      }
      G.input.buildType = tower.id;
      [...ui.towerTray.children].forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      clearSelection();
      updateContext();
      hint(`${tower.name} 배치 모드`);
    };
    ui.towerTray.appendChild(el);
  });
}

function nextStage(mode='normal'){
  const run = G.run;
  if (!run) return;
  G.hudTick = 0;
  run.stageIndex += 1;
  run.selectedTowerId = null;
  run.selectedTowerRef = null;
  clearSelection();
  if (mode !== 'start') {
    const refund = liquidateTowers(run, 1.0);
    if (refund > 0) toast(`재배치 회수 +${fmt(refund)} G`);
  }
  if (run.mods.stageGold > 0) gainGold(run, run.mods.stageGold);
  run.core.barrier += run.mods.barrierPerStage;
  run.core.hourglassUsed = false;
  const stage = generateStage(run, run.nextRoute || null);
  run.nextRoute = null;
  run.currentStage = stage;
  stageApplyEntry(stage, run);
  run.enemies.length = 0;
  run.projectiles.length = 0;
  run.fields.length = 0;
  run.particles.length = 0;
  run.popups.length = 0;
  run.spawnQueue = buildEncounter(run, stage);
  run.spawnTimer = 0;
  run.hero.overclock = 0;
  run.hero.vectorBoost = 0;
  updateHeroStats(run);
  const startCell = cellCenter(CORE_CELL.x - 1, CORE_CELL.y + 0.5);
  run.hero.x = startCell.x;
  run.hero.y = startCell.y;
  run.state = 'prepare';
  G.state = 'prepare';
  G.input.buildType = null;
  [...ui.towerTray.children].forEach(c => c.classList.remove('active'));
  toast(`스테이지 ${run.stageIndex}: ${stage.biome.name} / ${stage.layoutName}`);
  updateContext();
  updateHUD();
  if (run.stageIndex === 1) {
    hint('타워를 2~3개 먼저 세우고 파동 시작을 누르세요');
  }
}

function stageApplyEntry(stage, run){
  if (stage.entryReward.gold) {
    const gained = gainGold(run, stage.entryReward.gold);
    toast(`입장 보급 +${fmt(gained)} G`);
  }
  if (stage.entryReward.repair) {
    const heal = stage.entryReward.repair;
    run.core.hp = Math.min(run.core.maxHp, run.core.hp + heal);
  }
}

function generateStage(run, routeOpt=null){
  const boss = run.stageIndex === 3 || run.stageIndex === 6;
  const biome = routeOpt?.biome || randomBiome(run);
  const layout = routeOpt?.layout || randomLayout();
  const mutator = boss ? weightedPick([MUTATORS.fortified,MUTATORS.frenzy,MUTATORS.storm,MUTATORS.glacier], () => 1) : (routeOpt?.mutator || randomMutator());
  const stage = {
    boss,
    biome,
    layoutName: layout.name,
    paths: layout.paths(),
    blocked: new Set(),
    pathSet: new Set(),
    buildSet: new Set(),
    specialTiles: new Map(),
    specialCount: boss ? 4 : 3,
    specialBoost: 1,
    enemyHp: boss ? 1.15 : 1,
    enemySpeed: 1,
    enemyContact: 1,
    baseSlow: 0,
    clearReward: { gold: boss ? 90 : 40, repair:0, relic: boss, tech:1 },
    entryReward: { gold: boss ? 10 : 0, repair:0 },
    scoreMul: boss ? 1.6 : 1,
    storm:false,
    playerBonus: [],
    bossType: boss ? weightedPick(Object.values(BOSSES), () => 1) : null,
    enemyTheme: biome.theme.slice(),
    mutator,
  };

  for (const path of stage.paths) {
    for (const cell of path) stage.pathSet.add(keyOf(cell.x, cell.y));
  }

  const obstacleCount = boss ? 3 : 5;
  const buildCandidates = [];
  for (let y=0;y<GRID.rows;y++) {
    for (let x=0;x<GRID.cols;x++) {
      if (x === CORE_CELL.x && y === CORE_CELL.y) continue;
      const key = keyOf(x,y);
      if (stage.pathSet.has(key)) continue;
      buildCandidates.push({x,y});
    }
  }
  shuffle(buildCandidates);
  let placed = 0;
  for (const c of buildCandidates) {
    if (placed >= obstacleCount) break;
    if (isNearPath(stage, c.x, c.y, 0)) continue;
    if (dist(c.x, c.y, CORE_CELL.x, CORE_CELL.y) < 2.2) continue;
    stage.blocked.add(keyOf(c.x,c.y));
    placed += 1;
  }
  for (let y=0;y<GRID.rows;y++) {
    for (let x=0;x<GRID.cols;x++) {
      const key = keyOf(x,y);
      if (stage.pathSet.has(key) || stage.blocked.has(key) || (x === CORE_CELL.x && y === CORE_CELL.y)) continue;
      stage.buildSet.add(key);
    }
  }

  mutator.applyStage(stage);
  if (routeOpt?.clearReward) {
    stage.clearReward.gold = Math.max(stage.clearReward.gold, routeOpt.clearReward.gold || 0);
    stage.clearReward.repair = Math.max(stage.clearReward.repair, routeOpt.clearReward.repair || 0);
    if (routeOpt.clearReward.relic) stage.clearReward.relic = true;
  }

  const specialTypes = Object.keys(SPECIALS);
  const nearby = buildCandidates.filter(c => stage.buildSet.has(keyOf(c.x,c.y)) && isNearPath(stage, c.x, c.y, 1));
  shuffle(nearby);
  let specialPlaced = 0;
  for (const c of nearby) {
    if (specialPlaced >= stage.specialCount) break;
    const key = keyOf(c.x,c.y);
    if (stage.specialTiles.has(key)) continue;
    stage.specialTiles.set(key, specialTypes[specialPlaced % specialTypes.length]);
    specialPlaced += 1;
  }
  return stage;
}

function randomBiome(run){
  const ids = Object.keys(BIOMES);
  if (!run.currentStage) return BIOMES[ids[irand(0, ids.length-1)]];
  const prev = run.currentStage.biome.id;
  const filtered = ids.filter(id => id !== prev);
  return BIOMES[filtered[irand(0, filtered.length-1)]];
}
function randomMutator(){
  const list = Object.values(MUTATORS);
  return list[irand(0, list.length-1)];
}
function randomLayout(){
  const list = [
    { name:'사행 협곡', paths:layoutSnake },
    { name:'분기 합류', paths:layoutSplit },
    { name:'나선 회랑', paths:layoutSpiral },
    { name:'절벽 굴곡', paths:layoutCanyon },
    { name:'교차 요새', paths:layoutCross },
  ];
  return list[irand(0, list.length-1)];
}

function lineCells(a,b){
  const cells = [];
  let x = a.x, y = a.y;
  cells.push({x,y});
  while (x !== b.x || y !== b.y) {
    if (x < b.x) x++; else if (x > b.x) x--;
    else if (y < b.y) y++; else if (y > b.y) y--;
    cells.push({x,y});
  }
  return cells;
}
function pathFromPoints(points){
  const out = [];
  for (let i=0;i<points.length-1;i++) {
    const seg = lineCells(points[i], points[i+1]);
    if (i) seg.shift();
    out.push(...seg);
  }
  return out;
}
function layoutSnake(){
  return [pathFromPoints([{x:0,y:1},{x:4,y:1},{x:4,y:6},{x:8,y:6},{x:8,y:2},{x:10,y:2},{x:10,y:3}])];
}
function layoutSplit(){
  return [
    pathFromPoints([{x:0,y:1},{x:3,y:1},{x:3,y:3},{x:7,y:3},{x:10,y:3}]),
    pathFromPoints([{x:0,y:6},{x:4,y:6},{x:4,y:4},{x:7,y:4},{x:7,y:3},{x:10,y:3}]),
  ];
}
function layoutSpiral(){
  return [pathFromPoints([{x:0,y:0},{x:11,y:0},{x:11,y:7},{x:1,y:7},{x:1,y:2},{x:8,y:2},{x:8,y:5},{x:10,y:5},{x:10,y:3}])];
}
function layoutCanyon(){
  return [pathFromPoints([{x:0,y:6},{x:3,y:6},{x:3,y:1},{x:6,y:1},{x:6,y:5},{x:10,y:5},{x:10,y:3}])];
}
function layoutCross(){
  return [
    pathFromPoints([{x:2,y:0},{x:2,y:3},{x:10,y:3}]),
    pathFromPoints([{x:0,y:6},{x:6,y:6},{x:6,y:3},{x:10,y:3}]),
  ];
}
function isNearPath(stage, x, y, distMax){
  for (const path of stage.paths) {
    for (const c of path) {
      if (Math.abs(c.x - x) + Math.abs(c.y - y) <= distMax) return true;
    }
  }
  return false;
}

function buildEncounter(run, stage){
  const queue = [];
  if (stage.boss) {
    const level = run.stageIndex;
    const filler = 12 + level * 2;
    for (let i=0;i<filler;i++) {
      queue.push({ t:(i===0?0.5:0.35), kind: weightedPick(stage.enemyTheme.map(id => ENEMIES[id]), () => 1).id, pathIndex: irand(0, stage.paths.length-1), elite: i > filler - 4 });
    }
    queue.push({ t:1.6, boss:true, kind:stage.bossType.id, pathIndex:0 });
    for (let i=0;i<10 + level;i++) {
      queue.push({ t:0.9, kind: weightedPick(stage.enemyTheme.map(id => ENEMIES[id]), e => e.id === 'runner' ? 2 : 1).id, pathIndex: irand(0, stage.paths.length-1), elite:false });
    }
    return queue;
  }
  let budget = 16 + run.stageIndex * 8;
  while (budget > 0) {
    const choices = stage.enemyTheme.map(id => ENEMIES[id]);
    const pick = weightedPick(choices, e => {
      let w = 1;
      if (run.stageIndex < 2 && e.id === 'brute') w *= 0.6;
      if (run.stageIndex >= 4 && e.id === 'shielder') w *= 1.2;
      return w;
    });
    const elite = run.stageIndex >= 4 && Math.random() < 0.10;
    queue.push({ t: rand(0.28, 0.65), kind: pick.id, pathIndex: irand(0, stage.paths.length - 1), elite });
    budget -= pick.cost * (elite ? 1.8 : 1);
  }
  return queue;
}

function startWave(){
  const run = G.run;
  if (!run || run.state !== 'prepare') return;
  run.state = 'battle';
  G.state = 'battle';
  ui.startWaveBtn.classList.add('hidden');
  toast('파동 시작');
  updateContext();
  updateHUD();
}

function spawnEnemy(run, sp){
  const stage = run.currentStage;
  const isBoss = !!sp.boss;
  const def = isBoss ? BOSSES[sp.kind] : ENEMIES[sp.kind];
  const routeIndex = Number.isInteger(sp.pathIndex) ? clamp(sp.pathIndex, 0, stage.paths.length - 1) : 0;
  const path = stage.paths[routeIndex].map(c => cellCenter(c.x,c.y));
  const start = path[0];
  const progress = -0.6;
  const hpScale = (isBoss ? def.hp : def.hp) * (22 + run.stageIndex * 18) * run.diff.hp * stage.enemyHp * (sp.elite ? 1.7 : 1);
  const enemy = {
    id: `${Date.now()}-${Math.random()}`,
    kind: sp.kind,
    isBoss,
    elite: !!sp.elite,
    routeIndex,
    x: start.x,
    y: start.y,
    path,
    pathIndex: 0,
    progress,
    baseSpeed: (58 + run.stageIndex * 6) * (isBoss ? def.speed : def.speed) * run.diff.speed * stage.enemySpeed,
    radius: G.layout.cell * (isBoss ? 0.34 * def.size : 0.28 * def.size),
    hp: hpScale,
    maxHp: hpScale,
    contact: Math.round(def.damage * stage.enemyContact),
    reward: Math.round(def.reward * run.diff.gold * (sp.elite ? 1.5 : 1) * ((sp.elite || isBoss) ? run.mods.eliteGold : 1)),
    def,
    shield: def.shield ? hpScale * def.shield : 0,
    poison:0,
    poisonTimer:0,
    slow: stage.baseSlow,
    slowTimer: stage.baseSlow > 0 ? 999 : 0,
    freeze:0,
    frozen:0,
    vuln:0,
    burn:0,
    burnTimer:0,
    stun:0,
    skillCd: isBoss ? 5.5 : 0,
    slowResist: def.slowResist || 0,
  };
  run.enemies.push(enemy);
}

function update(dt){
  G.now += dt;
  G.dt = dt;
  if (G.toastTimer > 0) {
    G.toastTimer -= dt;
    if (G.toastTimer <= 0) ui.toast.classList.remove('show');
  }
  if (G.hintTimer > 0) {
    G.hintTimer -= dt;
    if (G.hintTimer <= 0) ui.hintLine.classList.remove('show');
  }
  if (!G.run || G.modal) {
    render();
    return;
  }
  const run = G.run;
  G.shake = Math.max(0, G.shake - dt * 3);

  if (run.state === 'battle') {
    if (run.currentStage.storm) updateStorm(run, dt);
    updateHero(run, dt);
    updateTowers(run, dt);
    updateProjectiles(run, dt);
    updateFields(run, dt);
    updateEnemies(run, dt);
    updateParticles(run, dt);
    handleSpawning(run, dt);
    handleLevelUps(run);
    if (run.currentStage.storm) maybeSpawnStormFx(run, dt);
    if (run.relicState.heart) updateHeart(run, dt);
    if (run.relicState.reactor) updateReactor(run, dt);

    if (run.spawnQueue.length === 0 && run.enemies.length === 0 && run.projectiles.length === 0 && run.fields.length === 0) {
      clearStage(run);
    }
  } else {
    updateHero(run, dt, true);
    updateParticles(run, dt);
  }

  updatePopups(run, dt);
  render();
  G.hudTick -= dt;
  if (G.hudTick <= 0) {
    G.hudTick = 0.1;
    updateHUD();
  }
}

function handleSpawning(run, dt){
  if (run.spawnQueue.length === 0) return;
  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  const next = run.spawnQueue.shift();
  spawnEnemy(run, next);
  run.spawnTimer = next.t;
}

function updateHero(run, dt, prepareOnly=false){
  const h = run.hero;
  const input = G.input;
  let dx = input.joystick.x;
  let dy = input.joystick.y;
  if (input.keys['KeyA'] || input.keys['ArrowLeft']) dx -= 1;
  if (input.keys['KeyD'] || input.keys['ArrowRight']) dx += 1;
  if (input.keys['KeyW'] || input.keys['ArrowUp']) dy -= 1;
  if (input.keys['KeyS'] || input.keys['ArrowDown']) dy += 1;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const boost = h.vectorBoost > 0 ? 1.12 : 1;
  h.x += dx * h.stats.speed * boost * dt;
  h.y += dy * h.stats.speed * boost * dt;
  const b = G.layout.board;
  h.x = clamp(h.x, b.x + 12, b.x + b.w - 12);
  h.y = clamp(h.y, b.y + 12, b.y + b.h - 12);
  h.attackCd -= dt;
  h.abilityTimer = Math.max(0, h.abilityTimer - dt);
  h.overclock = Math.max(0, h.overclock - dt);
  h.vectorBoost = Math.max(0, h.vectorBoost - dt);
  h.reactorBoost = Math.max(0, h.reactorBoost - dt);
  if (prepareOnly) return;
  if (h.attackCd <= 0) {
    const target = findNearestEnemy(run, h.x, h.y, h.stats.range);
    if (target) {
      heroAttack(run, target);
      h.attackCd = 1 / h.stats.rate;
    }
  }
}

function heroAttack(run, target){
  const h = run.hero;
  const hero = run.heroDef;
  if (hero.id === 'arcanist') {
    const dmg = calcDamage(run, h.stats.damage, 'energy', false, false);
    chainDamage(run, target, dmg, 1 + run.mods.chain, '#cab0ff', 120);
  } else if (hero.id === 'machinist') {
    for (let i=0;i<3;i++) {
      const ang = Math.atan2(target.y - h.y, target.x - h.x) + rand(-0.18, 0.18);
      run.projectiles.push({ kind:'bullet', friendly:true, x:h.x, y:h.y, vx:Math.cos(ang)*560, vy:Math.sin(ang)*560, r:4, life:0.8, color:hero.bulletColor, damage:calcDamage(run, h.stats.damage * 0.72, 'ballistic', true, false, h.stats.crit), effects:{} });
    }
  } else {
    const ang = Math.atan2(target.y - h.y, target.x - h.x);
    run.projectiles.push({ kind:'bullet', friendly:true, x:h.x, y:h.y, vx:Math.cos(ang)*620, vy:Math.sin(ang)*620, r:4, life:0.8, color:hero.bulletColor, damage:calcDamage(run, h.stats.damage, 'ballistic', true, false, h.stats.crit), effects:{} });
  }
}

function updateTowers(run, dt){
  for (const tower of run.towers) {
    tower.cd -= dt;
    tower.anim += dt;
    if (tower.buff > 0) tower.buff -= dt;
    if (tower.cd > 0) continue;
    const stats = getTowerStats(run, tower);
    const target = tower.type === 'mortar' ? findClusterTarget(run, stats.aoe ? stats.aoe * 1.6 : 80, tower.x, tower.y, stats.range) : findNearestEnemy(run, tower.x, tower.y, stats.range);
    if (!target) continue;
    fireTower(run, tower, stats, target);
    tower.cd = 1 / stats.rate;
  }
}

function getTowerStats(run, tower){
  const def = TOWERS[tower.type];
  const base = def.base;
  const levelMul = 1 + (tower.level - 1) * 0.28 * run.mods.upgradeValue;
  const tile = run.currentStage.specialTiles.get(keyOf(tower.cx, tower.cy));
  const tileBonus = tile ? run.currentStage.specialBoost * run.mods.specialBoost : 1;
  const nearHero = dist(tower.x, tower.y, run.hero.x, run.hero.y) < 150 ? run.mods.heroAura : 1;
  const buff = (tower.buff > 0 ? 1.24 : 1) * (run.hero.overclock > 0 && dist(tower.x, tower.y, run.hero.x, run.hero.y) < 170 ? 1.3 : 1) * (run.hero.vectorBoost > 0 ? 1.18 : 1);
  const kindMul = tower.type === 'bolt' ? run.mods.ballistic : tower.type === 'mortar' ? run.mods.explosive : tower.type === 'arc' ? run.mods.energy : tower.type === 'frost' ? run.mods.frost : run.mods.poison;
  return {
    damage: base.damage * levelMul * run.mods.towerDamage * kindMul * tileBonus * nearHero * (buff > 0 ? buff : 1),
    rate: base.rate * run.mods.towerRate * (1 + (tower.level - 1) * 0.06) * buff,
    range: base.range * run.mods.towerRange * (tile === 'ley' ? 1.25 * run.mods.specialBoost : 1),
    crit: clamp(base.crit + run.mods.crit, 0, 0.95),
    kind: base.kind,
    speed: base.speed || 0,
    aoe: (base.aoe || 0) * run.mods.splash,
    slow: (base.slow || 0) * run.mods.frost,
    freeze: (base.freeze || 0) * run.mods.freeze,
    poison: (base.poison || 0) * run.mods.poison,
    chains: (base.chains || 0) + run.mods.chain,
  };
}

function fireTower(run, tower, stats, target){
  const ang = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.angle = ang;
  if (tower.type === 'arc') {
    const dmg = calcDamage(run, stats.damage, 'energy', false, false);
    chainDamage(run, target, dmg, stats.chains, '#bba8ff', 128, tower);
    if (run.mods.arcVuln > 0) target.vuln = Math.max(target.vuln, run.mods.arcVuln);
    spark(run, tower.x, tower.y, target.x, target.y, '#c4b0ff');
    return;
  }
  if (tower.type === 'mortar') {
    run.projectiles.push({ kind:'mortar', friendly:true, x:tower.x, y:tower.y, sx:tower.x, sy:tower.y, tx:target.x, ty:target.y, travel:0.55, age:0, r:8, color:'#ffbe7d', damage:calcDamage(run, stats.damage, 'explosive', true, true, stats.crit), aoe:stats.aoe, effects:{} });
    return;
  }
  const extra = tower.type === 'bolt' ? run.mods.extraBolt : 0;
  const shots = 1 + extra;
  for (let i=0;i<shots;i++) {
    const spread = shots > 1 ? (i - (shots-1)/2) * 0.08 : 0;
    const a = ang + spread;
    const p = { kind:'bullet', friendly:true, x:tower.x, y:tower.y, vx:Math.cos(a) * stats.speed, vy:Math.sin(a) * stats.speed, r:tower.type === 'frost' ? 5 : tower.type === 'bloom' ? 6 : 4, life:1.2, color:TOWERS[tower.type].color, damage:calcDamage(run, stats.damage, stats.kind, true, tower.type === 'mortar', stats.crit), effects:{} };
    if (tower.type === 'frost') { p.effects.slow = stats.slow; p.effects.freeze = stats.freeze; }
    if (tower.type === 'bloom') { p.effects.poison = stats.poison; }
    run.projectiles.push(p);
  }
}

function calcDamage(run, base, kind, canCrit=true, explosive=false, critChance=0.05 + run.mods.crit){
  let dmg = base;
  if (run.hero.reactorBoost > 0) dmg *= 1.20;
  if (run.currentStage.playerBonus.includes('volatile') && (kind === 'explosive' || kind === 'poison')) dmg *= 1.20;
  if (explosive && run.mods.burning) dmg *= 1.05;
  if (canCrit && Math.random() < clamp(critChance, 0, 0.95)) dmg *= 1.55 + run.mods.critDamage;
  return dmg;
}

function applyFrostSplash(run, sourceEnemy, projectile){
  if (!run.mods.frostSplash || !projectile.effects?.freeze) return;
  const radius = 44;
  burst(run, sourceEnemy.x, sourceEnemy.y, projectile.damage * 0.34, radius, 'frost', { color:'#aeefff' });
  for (const enemy of run.enemies) {
    if (enemy === sourceEnemy) continue;
    if (dist(sourceEnemy.x, sourceEnemy.y, enemy.x, enemy.y) > radius + enemy.radius) continue;
    enemy.slow = Math.max(enemy.slow, (projectile.effects.slow || 0) * 0.8);
    enemy.slowTimer = Math.max(enemy.slowTimer, 0.7);
    enemy.freeze += (projectile.effects.freeze || 0) * 0.45;
  }
}

function updateProjectiles(run, dt){
  for (let i = run.projectiles.length - 1; i >= 0; i--) {
    const p = run.projectiles[i];
    if (p.kind === 'mortar') {
      p.age += dt;
      const t = clamp(p.age / p.travel, 0, 1);
      p.x = lerp(p.sx, p.tx, t);
      p.y = lerp(p.sy, p.ty, t) - Math.sin(t * Math.PI) * 54;
      if (t >= 1) {
        burst(run, p.tx, p.ty, p.damage, p.aoe, 'explosive', { burn: run.mods.burning ? 3.2 : 0, color:'#ffbc6e' });
        run.projectiles.splice(i, 1);
      }
      continue;
    }
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    let dead = p.life <= 0;
    if (!dead) {
      for (const enemy of run.enemies) {
        if (dist(p.x, p.y, enemy.x, enemy.y) <= enemy.radius + p.r) {
          applyHit(run, enemy, p.damage, p.effects, p.kind);
          applyFrostSplash(run, enemy, p);
          dead = true;
          break;
        }
      }
    }
    if (dead) run.projectiles.splice(i, 1);
  }
}

function updateFields(run, dt){
  for (let i = run.fields.length - 1; i >= 0; i--) {
    const f = run.fields[i];
    f.t -= dt;
    f.tick -= dt;
    if (f.kind === 'stasis' && f.tick <= 0) {
      f.tick = 0.22;
      for (const enemy of run.enemies) {
        if (dist(f.x, f.y, enemy.x, enemy.y) <= f.r + enemy.radius) {
          enemy.slow = Math.max(enemy.slow, 0.55);
          enemy.slowTimer = Math.max(enemy.slowTimer, 0.3);
          applyDamage(run, enemy, calcDamage(run, 6 * run.mods.abilityPower, 'energy', false, false), 'energy');
        }
      }
    }
    if (f.kind === 'burn' && f.tick <= 0) {
      f.tick = 0.24;
      for (const enemy of run.enemies) {
        if (dist(f.x, f.y, enemy.x, enemy.y) <= f.r + enemy.radius) {
          enemy.burn = Math.max(enemy.burn, 14 * run.mods.explosive);
          enemy.burnTimer = Math.max(enemy.burnTimer, 2.2);
        }
      }
    }
    if (f.kind === 'spores' && f.tick <= 0) {
      f.tick = 0.3;
      for (const enemy of run.enemies) {
        if (dist(f.x, f.y, enemy.x, enemy.y) <= f.r + enemy.radius) {
          enemy.poison = Math.max(enemy.poison, 18 * run.mods.poison);
          enemy.poisonTimer = Math.max(enemy.poisonTimer, 3.0);
        }
      }
    }
    if (f.t <= 0) run.fields.splice(i, 1);
  }
}

function updateEnemies(run, dt){
  for (let i = run.enemies.length - 1; i >= 0; i--) {
    const e = run.enemies[i];
    if (e.frozen > 0) e.frozen -= dt;
    if (e.stun > 0) e.stun -= dt;
    if (e.vuln > 0) e.vuln -= dt;
    if (e.poisonTimer > 0) {
      e.poisonTimer -= dt;
      e.hp -= e.poison * dt;
      if (Math.random() < 0.4) dust(run, e.x, e.y, '#92f4b5', 1.2);
    } else e.poison = 0;
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.hp -= e.burn * dt;
      if (Math.random() < 0.35) dust(run, e.x, e.y, '#ffb56f', 1.0);
    } else e.burn = 0;
    if (e.slowTimer > 0) e.slowTimer -= dt; else e.slow = run.currentStage.baseSlow;
    if (e.freeze > 100) {
      e.freeze = 0;
      e.frozen = 1.0;
      ring(run, e.x, e.y, e.radius * 2.2, '#a2f5ff');
    }

    if (e.isBoss) updateBoss(run, e, dt);

    if (e.hp <= 0) {
      killEnemy(run, e);
      run.enemies.splice(i,1);
      continue;
    }

    if (e.frozen > 0 || e.stun > 0) continue;

    const path = e.path;
    let targetIndex = Math.min(path.length - 1, e.pathIndex + 1);
    const target = path[targetIndex] || path[path.length - 1];
    const speedMul = 1 - (e.slow * (1 - e.slowResist));
    const speed = e.baseSpeed * Math.max(0.18, speedMul);
    const d = dist(e.x, e.y, target.x, target.y);
    if (d <= speed * dt + 2) {
      e.x = target.x; e.y = target.y; e.pathIndex = targetIndex;
      if (targetIndex >= path.length - 1) {
        hitCore(run, e.contact);
        run.enemies.splice(i,1);
        continue;
      }
    } else {
      e.x += (target.x - e.x) / d * speed * dt;
      e.y += (target.y - e.y) / d * speed * dt;
    }
  }
}

function updateBoss(run, e, dt){
  e.skillCd -= dt;
  if (e.skillCd > 0) return;
  e.skillCd = e.def.skill === 'summon' ? 6.2 : e.def.skill === 'barrier' ? 5.8 : 7.0;
  if (e.def.skill === 'summon') {
    for (let i=0;i<3;i++) {
      const spawn = { kind:'runner', pathIndex:0, elite:false, boss:false, t:0 };
      spawnEnemy(run, spawn);
      const child = run.enemies[run.enemies.length - 1];
      child.x = e.x + rand(-18,18); child.y = e.y + rand(-18,18); child.pathIndex = e.pathIndex;
    }
    toast('보스: 군집 소환');
  } else if (e.def.skill === 'barrier') {
    e.shield += e.maxHp * 0.16;
    for (const enemy of run.enemies) {
      if (enemy !== e && dist(enemy.x, enemy.y, e.x, e.y) < 160) enemy.shield += enemy.maxHp * 0.12;
    }
    ring(run, e.x, e.y, 120, '#c7bdff');
    toast('보스: 방벽 전개');
  } else {
    for (const enemy of run.enemies) {
      if (dist(enemy.x, enemy.y, e.x, e.y) < 180) enemy.slow = Math.max(0, enemy.slow - 0.25);
    }
    run.core.barrier = Math.max(0, run.core.barrier - 10);
    ring(run, e.x, e.y, 150, '#ffbf7c');
    G.shake = 0.7;
    toast('보스: 충격 강타');
  }
}

function hitCore(run, damage){
  if (run.relicState.hourglass && !run.core.hourglassUsed) {
    run.core.hourglassUsed = true;
    for (const enemy of run.enemies) {
      enemy.slow = Math.max(enemy.slow, 0.65);
      enemy.slowTimer = Math.max(enemy.slowTimer, 2.0);
    }
    ring(run, cellCenter(CORE_CELL.x, CORE_CELL.y).x, cellCenter(CORE_CELL.x, CORE_CELL.y).y, 160, '#87e7ff');
  }
  if (run.core.barrier > 0) {
    const block = Math.min(run.core.barrier, damage);
    run.core.barrier -= block;
    damage -= block;
  }
  if (damage > 0) {
    run.core.hp -= damage;
    G.shake = 0.9;
    toast(`코어 피해 -${fmt(damage)}`);
  }
  if (run.core.hp <= 0) {
    gameOver();
  }
}

function applyHit(run, enemy, damage, effects, kind='physical'){
  applyDamage(run, enemy, damage, kind);
  if (effects) {
    if (effects.slow) {
      enemy.slow = Math.max(enemy.slow, effects.slow);
      enemy.slowTimer = Math.max(enemy.slowTimer, 1.0);
    }
    if (effects.freeze) enemy.freeze += effects.freeze;
    if (effects.poison) {
      enemy.poison = Math.max(enemy.poison, effects.poison);
      enemy.poisonTimer = Math.max(enemy.poisonTimer, 3.2);
    }
  }
}

function applyDamage(run, enemy, damage, kind='physical'){
  let dmg = damage;
  if (enemy.vuln > 0) dmg *= 1.20 * run.mods.vulnDamage;
  if (enemy.frozen > 0) dmg *= run.mods.shatter;
  if ((enemy.poison > 0 || enemy.slow > 0) && run.mods.debuffDamage > 1) dmg *= run.mods.debuffDamage;
  if (enemy.hp / enemy.maxHp <= 0.22) dmg *= 1 + run.mods.execute;
  if (enemy.shield > 0) {
    const block = Math.min(enemy.shield, dmg);
    enemy.shield -= block;
    dmg -= block;
  }
  if (dmg > 0) {
    enemy.hp -= dmg;
    popup(run, enemy.x, enemy.y - enemy.radius - 6, fmt(dmg), kind === 'explosive' ? '#ffc476' : kind === 'energy' ? '#ccb8ff' : kind === 'frost' ? '#98f1ff' : kind === 'poison' ? '#a2f7bc' : '#eef4ff');
  }
}

function burst(run, x, y, damage, radius, kind, extra={}){
  ring(run, x, y, radius, extra.color || '#ffd08f');
  for (const enemy of run.enemies) {
    const d = dist(x, y, enemy.x, enemy.y);
    if (d <= radius + enemy.radius) {
      const falloff = 1 - clamp(d / (radius + enemy.radius), 0, 0.6) * 0.5;
      applyDamage(run, enemy, damage * falloff, kind);
      if (extra.vuln) enemy.vuln = Math.max(enemy.vuln, extra.vuln);
      if (extra.burn) { enemy.burn = Math.max(enemy.burn, 12 * run.mods.explosive); enemy.burnTimer = Math.max(enemy.burnTimer, extra.burn); }
    }
  }
  if (extra.burn) run.fields.push({ kind:'burn', x, y, r:radius * 0.65, t:extra.burn, tick:0, color:'#ffb56f' });
  G.shake = Math.max(G.shake, 0.4);
}

function chainDamage(run, start, damage, jumps, color, range, tower){
  const hit = new Set();
  let current = start;
  let remaining = jumps;
  let prevX = tower ? tower.x : run.hero.x;
  let prevY = tower ? tower.y : run.hero.y;
  while (current && remaining >= 0) {
    spark(run, prevX, prevY, current.x, current.y, color);
    applyDamage(run, current, damage, 'energy');
    hit.add(current.id);
    prevX = current.x; prevY = current.y;
    remaining -= 1;
    current = run.enemies.find(e => !hit.has(e.id) && dist(prevX, prevY, e.x, e.y) <= range);
    damage *= 0.78;
  }
}

function findNearestEnemy(run, x, y, range){
  let best = null, bestD = range;
  for (const enemy of run.enemies) {
    const d = dist(x,y,enemy.x,enemy.y);
    if (d < bestD) { bestD = d; best = enemy; }
  }
  return best;
}

function findClusterTarget(run, radius, ox, oy, maxRange){
  const originX = ox ?? run.hero.x;
  const originY = oy ?? run.hero.y;
  let best = null, bestScore = 0;
  for (const enemy of run.enemies) {
    if (maxRange && dist(originX, originY, enemy.x, enemy.y) > maxRange) continue;
    let score = 0;
    for (const other of run.enemies) {
      const d = dist(enemy.x, enemy.y, other.x, other.y);
      if (d < radius) score += 1 + (other.isBoss ? 4 : 0) + (other.elite ? 1.5 : 0);
    }
    if (score > bestScore) { bestScore = score; best = enemy; }
  }
  return best;
}

function killEnemy(run, enemy){
  gainGold(run, enemy.reward);
  run.xp += (enemy.isBoss ? 36 : enemy.elite ? 12 : 5) * run.mods.xp;
  run.kills += 1;
  run.score += Math.round((enemy.isBoss ? 320 : enemy.elite ? 48 : 14) * run.currentStage.scoreMul * run.diff.score);
  dust(run, enemy.x, enemy.y, enemy.isBoss ? '#ffd19a' : enemy.def.color, enemy.isBoss ? 2.4 : 1.6);
  if (enemy.def.split) {
    for (let i=0;i<2;i++) {
      const path = enemy.path.map(p => ({x:p.x,y:p.y}));
      const child = {
        id: `${Date.now()}-${Math.random()}`,
        kind:'runner',
        isBoss:false,
        elite:false,
        x: enemy.x + rand(-10,10), y: enemy.y + rand(-10,10),
        path,
        pathIndex: enemy.pathIndex,
        routeIndex: enemy.routeIndex ?? 0,
        baseSpeed: enemy.baseSpeed * 1.05,
        radius: enemy.radius * 0.62,
        hp: enemy.maxHp * 0.28, maxHp: enemy.maxHp * 0.28,
        contact: 4, reward:2, def: ENEMIES.runner,
        shield:0, poison:0, poisonTimer:0, slow:0, slowTimer:0, freeze:0, frozen:0, vuln:0, burn:0, burnTimer:0, stun:0, skillCd:0, slowResist:0,
      };
      run.enemies.push(child);
    }
  }
  if (run.mods.sporeBurst && enemy.poisonTimer > 0) run.fields.push({ kind:'spores', x:enemy.x, y:enemy.y, r:52 * run.mods.poisonSpread, t:2.8, tick:0, color:'#9af1b7' });
  if (run.relicState.crown && dist(run.hero.x, run.hero.y, enemy.x, enemy.y) < 130) {
    for (let i=0;i<3;i++) {
      const a = rand(0, TAU);
      run.projectiles.push({ kind:'bullet', friendly:true, x:enemy.x, y:enemy.y, vx:Math.cos(a)*520, vy:Math.sin(a)*520, r:4, life:0.55, color:'#f6f1ff', damage:calcDamage(run, 16, 'energy', false, false), effects:{} });
    }
  }
  if (run.relicState.reactor && run.kills % 20 === 0) {
    run.hero.reactorBoost = 8.0;
    toast('반응로 폭주');
  }
  maybeLevelUp(run);
}

function maybeLevelUp(run){
  while (run.xp >= run.xpNeed) {
    run.xp -= run.xpNeed;
    run.level += 1;
    run.xpNeed = Math.round(run.xpNeed * 1.28 + 16);
    run.pendingLevelUps += 1;
  }
}

function handleLevelUps(run){
  if (run.pendingLevelUps > 0 && !G.modal) {
    run.pendingLevelUps -= 1;
    openTechDraft('레벨 업', '세 가지 강화 중 하나를 선택하세요.', 3, false);
  }
}

function openTechDraft(titleTxt, descTxt, count=3, forceRare=false){
  const run = G.run;
  const choices = drawTechChoices(run, count, forceRare || run.mods.rareDrafts > 0);
  if (run.mods.rareDrafts > 0) run.mods.rareDrafts -= 1;
  openModal({
    type:'tech',
    title:titleTxt,
    text:descTxt,
    reroll: run.rerolls > 0,
    choices: choices.map(choice => ({
      title: choice.name,
      tag: choice.tag,
      desc: choice.desc,
      footer: techFooter(choice.id, run),
      onChoose(){
        applyCard(run, choice);
        closeModal();
      }
    })),
    onReroll(){
      if (run.rerolls <= 0) return;
      run.rerolls -= 1;
      closeModal();
      openTechDraft(titleTxt, descTxt, count, forceRare);
    }
  });
}

function techFooter(id, run){
  const count = run.cardCounts[id] || 0;
  return count ? `현재 중첩 ${count}` : '새 강화';
}

function applyCard(run, card){
  run.cardCounts[card.id] = (run.cardCounts[card.id] || 0) + 1;
  card.apply(run);
  updateHeroStats(run);
  toast(`${card.name} 획득`);
}

function drawTechChoices(run, count, forceRare=false){
  const pool = TECHS.filter(c => (run.cardCounts[c.id] || 0) < 3);
  const tags = ['공격','제어','방어','영웅','경제','위험'];
  const choices = [];
  const used = new Set();
  while (choices.length < count && pool.length > choices.length) {
    const targetTag = tags[choices.length % tags.length];
    const filtered = pool.filter(c => !used.has(c.id) && (forceRare ? c.tag !== '경제' : true));
    if (filtered.length === 0) break;
    const pick = weightedPick(filtered, c => {
      let w = 1;
      if (c.tag === targetTag) w *= 1.35;
      if (run.heroId === 'machinist' && ['공격','경제'].includes(c.tag)) w *= 1.1;
      if (run.heroId === 'arcanist' && ['제어','영웅'].includes(c.tag)) w *= 1.1;
      if (run.heroId === 'vanguard' && ['공격','방어'].includes(c.tag)) w *= 1.1;
      if (c.id.startsWith('bloom') && towerCount(run,'bloom') === 0) w *= 0.72;
      if (c.id.startsWith('frost') && towerCount(run,'frost') === 0) w *= 0.72;
      if (c.id.startsWith('arc') && towerCount(run,'arc') === 0) w *= 0.72;
      if (c.id.startsWith('mortar') && towerCount(run,'mortar') === 0) w *= 0.72;
      if (c.id.startsWith('bolt') && towerCount(run,'bolt') === 0) w *= 0.72;
      return w;
    });
    if (!pick) break;
    used.add(pick.id);
    choices.push(pick);
  }
  return choices;
}

function openRelicDraft(){
  const run = G.run;
  const pool = RELICS.filter(r => !run.relicIds.has(r.id));
  shuffle(pool);
  const choices = pool.slice(0, 3);
  openModal({
    type:'relic',
    title:'유물 획득',
    text:'런 전체를 뒤틀 강한 유물 중 하나를 고르세요.',
    reroll:false,
    choices: choices.map(choice => ({
      title: choice.name,
      tag: choice.tag,
      desc: choice.desc,
      footer: '런 전체 적용',
      onChoose(){
        run.relicIds.add(choice.id);
        choice.apply(run);
        updateHeroStats(run);
        toast(`${choice.name} 획득`);
        closeModal();
      }
    }))
  });
}

function clearStage(run){
  run.state = 'prepare';
  G.state = 'prepare';
  ui.startWaveBtn.classList.remove('hidden');
  run.score += Math.round((160 + run.stageIndex * 40 + (run.currentStage.boss ? 420 : 0)) * run.diff.score);
  gainGold(run, run.currentStage.clearReward.gold);
  if (run.currentStage.clearReward.repair) run.core.hp = Math.min(run.core.maxHp, run.core.hp + run.currentStage.clearReward.repair);
  if (run.mods.endRepair) run.core.hp = Math.min(run.core.maxHp, run.core.hp + run.core.maxHp * run.mods.endRepair);
  updateContext();
  updateHUD();

  const chain = [];
  if (run.currentStage.clearReward.relic) chain.push(() => openRelicDraft());

  if (run.stageIndex >= 6) {
    chain.push(() => victory());
  } else if (run.stageIndex === 2 || run.stageIndex === 5) {
    chain.push(() => nextStage('normal'));
  } else {
    chain.push(() => openStageChoice());
  }

  run.afterModalChain = chain;
  toast(`스테이지 ${run.stageIndex} 클리어`);
  openTechDraft('스테이지 보상', '강화 하나를 선택하세요.', 3, false);
}

function afterAnyModalClosed(){
  const run = G.run;
  if (!run || !run.afterModalChain || G.modal) return;
  if (run.afterModalChain.length === 0) return;
  const next = run.afterModalChain.shift();
  if (next) next();
}

function openStageChoice(){
  const run = G.run;
  const options = [generateRouteOption(run), generateRouteOption(run)];
  openModal({
    type:'route',
    title:'다음 전장 선택',
    text:'스테이지 구성과 클리어 보상이 다릅니다. 재배치 시 기존 타워는 100% 환급됩니다.',
    reroll:false,
    choices: options.map(opt => ({
      title: `${opt.biome.name} · ${opt.layoutName}`,
      tag: opt.mutator.name,
      desc: `${opt.mutator.desc}\n클리어 보상: ${routeRewardText(opt)}`,
      footer: `적 테마: ${opt.themeText}`,
      onChoose(){
        run.nextRoute = opt;
        closeModal();
        nextStage('normal');
      }
    }))
  });
}

function routeRewardText(opt){
  const parts = [];
  if (opt.clearReward.gold) parts.push(`금화 +${fmt(opt.clearReward.gold)}`);
  if (opt.clearReward.repair) parts.push(`수리 +${fmt(opt.clearReward.repair)}`);
  if (opt.clearReward.relic) parts.push('유물');
  return parts.join(' · ');
}

function generateRouteOption(run){
  const biome = randomBiome(run);
  const layout = randomLayout();
  const mutator = randomMutator();
  const stage = {
    biome,
    layout,
    layoutName: layout.name,
    mutator,
    clearReward: { gold: irand(45, 90), repair: Math.random() < 0.3 ? 18 : 0, relic:false },
    themeText: shuffle(biome.theme.slice()).slice(0,3).map(id => ENEMIES[id].name).join(' / '),
  };
  if (Math.random() < 0.22) stage.clearReward.relic = true;
  return stage;
}

function victory(){
  const run = G.run;
  G.state = 'victory';
  G.meta.bestScore = Math.max(G.meta.bestScore, Math.round(run.score));
  G.meta.bestStage = Math.max(G.meta.bestStage, run.stageIndex);
  G.meta.clears += 1;
  saveMeta();
  updateMetaUI();
  openModal({
    type:'result',
    title:'런 클리어',
    text:`최종 점수 ${fmt(run.score)} · 클리어 스테이지 ${run.stageIndex}`,
    reroll:false,
    choices:[{
      title:'다시 시작',
      tag:'새 런',
      desc:'현재 런을 종료하고 다시 시작합니다.',
      footer:'터치로 시작',
      onChoose(){ closeModal(); resetToTitle(); }
    }]
  });
}

function gameOver(){
  const run = G.run;
  G.state = 'gameover';
  G.meta.bestScore = Math.max(G.meta.bestScore, Math.round(run.score));
  G.meta.bestStage = Math.max(G.meta.bestStage, run.stageIndex);
  saveMeta();
  updateMetaUI();
  openModal({
    type:'result',
    title:'코어 붕괴',
    text:`점수 ${fmt(run.score)} · 도달 스테이지 ${run.stageIndex}`,
    reroll:false,
    choices:[{
      title:'다시 시작',
      tag:'새 런',
      desc:'현재 런을 종료하고 다시 시작합니다.',
      footer:'터치로 시작',
      onChoose(){ closeModal(); resetToTitle(); }
    }]
  });
}

function resetToTitle(){
  G.run = null;
  G.state = 'title';
  G.hudTick = 0;
  G.modal = null;
  ui.modalLayer.classList.add('hidden');
  ui.title.classList.remove('hidden');
  ui.hud.classList.add('hidden');
  G.input.buildType = null;
  updateMetaUI();
}

function openModal(config){
  G.modal = config;
  ui.modalLayer.classList.remove('hidden');
  ui.modalTitle.textContent = config.title;
  ui.modalText.textContent = config.text;
  ui.modalChoices.innerHTML = '';
  config.choices.forEach(choice => {
    const el = document.createElement('button');
    el.className = 'choiceCard';
    el.innerHTML = `<div class="choiceTag">${choice.tag}</div><h3>${choice.title}</h3><p>${choice.desc.replace(/\n/g, '<br/>')}</p><div class="choiceFooter">${choice.footer || ''}</div>`;
    el.onclick = choice.onChoose;
    ui.modalChoices.appendChild(el);
  });
  if (config.reroll) {
    ui.modalReroll.classList.remove('hidden');
    ui.modalReroll.textContent = `리롤 (${G.run.rerolls})`;
    ui.modalReroll.onclick = config.onReroll;
  } else ui.modalReroll.classList.add('hidden');
  ui.modalSecondary.classList.add('hidden');
}

function closeModal(){
  G.modal = null;
  ui.modalLayer.classList.add('hidden');
  afterAnyModalClosed();
}

function liquidateTowers(run, ratio){
  let total = 0;
  for (const tower of run.towers) total += sellValue(run, tower, ratio);
  run.towers.length = 0;
  run.selectedTowerId = null;
  run.selectedTowerRef = null;
  run.gold += total;
  return Math.round(total);
}

function sellValue(run, tower, ratio){
  return Math.round((tower.spent || TOWERS[tower.type].cost) * ratio);
}

function towerCount(run, type){
  return run.towers.filter(t => t.type === type).length;
}

function buildTower(cell){
  const run = G.run;
  const type = G.input.buildType;
  if (!run || !type || run.state !== 'prepare') return;
  const stage = run.currentStage;
  const key = keyOf(cell.x, cell.y);
  if (!stage.buildSet.has(key)) return toast('여기는 건설할 수 없습니다');
  if (run.towers.some(t => t.cx === cell.x && t.cy === cell.y)) return toast('이미 타워가 있습니다');
  const def = TOWERS[type];
  const cost = Math.round(def.cost * run.mods.cost);
  if (run.gold < cost) return toast('금화가 부족합니다');
  const pos = cellCenter(cell.x, cell.y);
  const tower = {
    id: `${Date.now()}-${Math.random()}`,
    type,
    cx: cell.x,
    cy: cell.y,
    x: pos.x,
    y: pos.y,
    angle:0,
    level: 1 + run.mods.freeLevel,
    cd: rand(0, 0.2),
    anim: rand(0, TAU),
    buff:0,
    spent: cost,
  };
  run.towers.push(tower);
  run.gold -= cost;
  selectTower(tower);
  updateContext();
  hint(`${def.name} 배치 완료`);
}

function upgradeSelectedTower(){
  const run = G.run;
  if (!run || run.state !== 'prepare') return;
  const tower = run.selectedTowerRef;
  if (!tower) return;
  if (tower.level >= 5) return toast('최대 레벨입니다');
  const cost = upgradeCost(run, tower);
  if (run.gold < cost) return toast('금화가 부족합니다');
  run.gold -= cost;
  tower.level += 1;
  tower.spent += cost;
  tower.buff = 0.6;
  updateContext();
  toast(`${TOWERS[tower.type].name} 강화 +1`);
}

function upgradeCost(run, tower){
  const tile = run.currentStage.specialTiles.get(keyOf(tower.cx, tower.cy));
  const discount = tile === 'forge' ? 0.85 : 1;
  return Math.round((TOWERS[tower.type].cost * (0.55 + tower.level * 0.45)) * run.mods.upgradeCost * run.mods.cost * discount);
}

function sellSelectedTower(){
  const run = G.run;
  if (!run || run.state !== 'prepare') return;
  const tower = run.selectedTowerRef;
  if (!tower) return;
  const value = sellValue(run, tower, run.mods.sellRefund);
  run.gold += value;
  run.towers = run.towers.filter(t => t.id !== tower.id);
  clearSelection();
  updateContext();
  toast(`타워 판매 +${fmt(value)} G`);
}

function clearSelection(){
  const run = G.run;
  if (!run) return;
  run.selectedTowerId = null;
  run.selectedTowerRef = null;
  ui.upgradeBtn.disabled = true;
  ui.sellBtn.disabled = true;
  ui.upgradeSmall.textContent = '선택 필요';
  ui.sellSmall.textContent = '선택 필요';
}

function selectTower(tower){
  const run = G.run;
  run.selectedTowerId = tower.id;
  run.selectedTowerRef = tower;
  G.input.buildType = null;
  [...ui.towerTray.children].forEach(c => c.classList.remove('active'));
  ui.upgradeBtn.disabled = false;
  ui.sellBtn.disabled = false;
  ui.upgradeSmall.textContent = `${fmt(upgradeCost(run, tower))} G`;
  ui.sellSmall.textContent = `${fmt(sellValue(run, tower, run.mods.sellRefund))} G`;
}

function tryUseAbility(){
  const run = G.run;
  if (!run || run.state !== 'battle') return;
  if (run.hero.abilityTimer > 0) return;
  const used = run.heroDef.ability(run);
  if (used && run.relicState.echo) {
    setTimeout(() => {
      if (!G.run || G.run !== run) return;
      if (run.heroDef.id === 'vanguard') {
        const target = findClusterTarget(run, 150);
        if (target) burst(run, target.x, target.y, 40 * run.mods.abilityPower, 70, 'explosive', { vuln:2.0, color:'#97f0ff' });
      } else if (run.heroDef.id === 'arcanist') {
        const target = findClusterTarget(run, 180) || { x:run.hero.x, y:run.hero.y };
        run.fields.push({ kind:'stasis', x:target.x, y:target.y, r:72, t:2.8, tick:0, color:'#bea8ff' });
      } else {
        run.hero.overclock = Math.max(run.hero.overclock, 3.2);
      }
    }, 130);
    if (run.relicState.vector) run.hero.vectorBoost = 4.0;
  } else if (used && run.relicState.vector) {
    run.hero.vectorBoost = 4.0;
  }
}

function openPointerSelect(clientX, clientY){
  G.pointer.x = clientX;
  G.pointer.y = clientY;
  if (!G.run || G.modal) return;
  if (!boardContains(clientX, clientY)) return;
  const cell = worldToCell(clientX, clientY);
  if (!inGrid(cell.x, cell.y)) return;
  G.hoverCell = cell;
  const tower = G.run.towers.find(t => t.cx === cell.x && t.cy === cell.y);
  if (tower) {
    selectTower(tower);
    updateContext();
    return;
  }
  clearSelection();
  if (G.input.buildType && G.run.state === 'prepare') buildTower(cell);
  updateContext();
}

function updateContext(){
  const run = G.run;
  if (!run) return;
  const stage = run.currentStage;
  ui.brandSub.textContent = `${stage.biome.name} · ${stage.layoutName}`;
  ui.stageBadge.textContent = `${run.state === 'prepare' ? '준비 단계' : '전투 단계'} · 변이: ${stage.mutator.name}`;
  if (run.selectedTowerRef) {
    const t = run.selectedTowerRef;
    const stats = getTowerStats(run, t);
    const tile = stage.specialTiles.get(keyOf(t.cx, t.cy));
    ui.contextTitle.textContent = `${TOWERS[t.type].name} Lv.${t.level}`;
    ui.contextText.innerHTML = `피해 <b>${fmt(stats.damage)}</b> · 사거리 <b>${fmt(stats.range)}</b> · 공속 <b>${stats.rate.toFixed(2)}</b>/s` + (tile ? `<br/>특수 타일: <b>${SPECIALS[tile].name}</b> — ${SPECIALS[tile].desc}` : '');
    ui.upgradeBtn.disabled = run.state !== 'prepare';
    ui.sellBtn.disabled = run.state !== 'prepare';
    ui.upgradeSmall.textContent = run.state === 'prepare' ? `${fmt(upgradeCost(run, t))} G` : '전투 중';
    ui.sellSmall.textContent = run.state === 'prepare' ? `${fmt(sellValue(run, t, run.mods.sellRefund))} G` : '전투 중';
  } else if (G.input.buildType) {
    const def = TOWERS[G.input.buildType];
    ui.contextTitle.textContent = `${def.name} 배치`;
    ui.contextText.textContent = `${def.desc} · 비용 ${fmt(Math.round(def.cost * run.mods.cost))} G`;
  } else {
    ui.contextTitle.textContent = `스테이지 ${run.stageIndex}`;
    ui.contextText.textContent = `${stage.biome.name} / ${stage.layoutName} · ${stage.mutator.desc} · 클리어 보상 ${routeRewardText(stage)}`;
  }
}

function updateHUD(){
  const run = G.run;
  if (!run) return;
  if (!G.hudStatEls) {
    const labels = ['금화', '코어', '장벽', '레벨', '스테이지', '점수'];
    const keys = ['gold', 'core', 'barrier', 'level', 'stage', 'score'];
    G.hudStatEls = {};
    ui.statBar.innerHTML = '';
    for (let i = 0; i < labels.length; i++) {
      const chip = document.createElement('div');
      chip.className = 'statChip panel';
      const label = document.createElement('span');
      label.textContent = labels[i];
      const value = document.createElement('strong');
      chip.appendChild(label);
      chip.appendChild(value);
      ui.statBar.appendChild(chip);
      G.hudStatEls[keys[i]] = value;
    }
  }

  G.hudStatEls.gold.textContent = fmt(run.gold);
  G.hudStatEls.core.textContent = `${fmt(run.core.hp)} / ${fmt(run.core.maxHp)}`;
  G.hudStatEls.barrier.textContent = fmt(run.core.barrier);
  G.hudStatEls.level.textContent = fmt(run.level);
  G.hudStatEls.stage.textContent = `${run.stageIndex} / 6`;
  G.hudStatEls.score.textContent = fmt(run.score);

  ui.abilitySmall.textContent = run.hero.abilityTimer > 0 ? `${run.hero.abilityTimer.toFixed(1)}s` : '준비';
  ui.abilityBtn.classList.toggle('ready', run.hero.abilityTimer <= 0 && run.state === 'battle');
  ui.startWaveBtn.classList.toggle('hidden', run.state !== 'prepare');
  ui.startWaveBtn.classList.toggle('ready', run.state === 'prepare');
  ui.startWaveSub.textContent = `적 ${run.spawnQueue.length}기 예정 · 리롤 ${run.rerolls}`;
}

function render(){
  ctx.clearRect(0,0,G.width,G.height);
  drawBackground();
  if (G.run) {
    drawBoard(G.run);
    drawFieldsVisual(G.run);
    drawCore(G.run);
    drawTowers(G.run);
    drawHero(G.run);
    drawEnemies(G.run);
    drawProjectiles(G.run);
    drawParticlesVisual(G.run);
    drawPopups(G.run);
    drawHover();
  } else {
    drawTitleBackdrop();
  }
}

function drawBackground(){
  const stage = G.run?.currentStage;
  const biome = stage ? stage.biome : BIOMES.ruins;
  const g = ctx.createLinearGradient(0,0,0,G.height);
  g.addColorStop(0, biome.bg1);
  g.addColorStop(1, biome.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,G.width,G.height);
  for (let i=0;i<42;i++) {
    const x = (i * 157 + G.now * 10 * ((i % 3) + 1)) % G.width;
    const y = (i * 87) % G.height;
    ctx.fillStyle = rgba(biome.accent, 0.05 + (i % 5) * 0.01);
    ctx.beginPath();
    ctx.arc(x,y,1.3 + (i % 3),0,TAU);
    ctx.fill();
  }
}
function drawTitleBackdrop(){
  const cx = G.width * 0.3, cy = G.height * 0.2;
  const g = ctx.createRadialGradient(cx,cy,20,cx,cy,340);
  g.addColorStop(0,'rgba(121,229,255,.18)');
  g.addColorStop(1,'rgba(121,229,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,G.width,G.height);
}
function drawBoard(run){
  const b = G.layout.board;
  roundRect(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 24);
  ctx.fillStyle = 'rgba(255,255,255,.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.09)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const s = G.layout.cell;
  for (let y=0;y<GRID.rows;y++) {
    for (let x=0;x<GRID.cols;x++) {
      const wx = b.x + x*s;
      const wy = b.y + y*s;
      const key = keyOf(x,y);
      const isCore = x === CORE_CELL.x && y === CORE_CELL.y;
      const isPath = run.currentStage.pathSet.has(key);
      const isBlocked = run.currentStage.blocked.has(key);
      const special = run.currentStage.specialTiles.get(key);
      roundRect(ctx, wx + 1.5, wy + 1.5, s - 3, s - 3, 8);
      if (isCore) ctx.fillStyle = 'rgba(255,255,255,.08)';
      else if (isPath) ctx.fillStyle = rgba(run.currentStage.biome.path, 0.86);
      else if (isBlocked) ctx.fillStyle = 'rgba(11,14,20,.95)';
      else ctx.fillStyle = rgba(run.currentStage.biome.tile, 0.82);
      ctx.fill();
      if (!isBlocked) {
        ctx.strokeStyle = 'rgba(255,255,255,.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (special) {
        const c = cellCenter(x,y);
        ctx.strokeStyle = rgba(SPECIALS[special].color, 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x, c.y, s * 0.22 + Math.sin(G.now * 3 + x + y) * 1.4, 0, TAU); ctx.stroke();
      }
      if (isBlocked) {
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.beginPath(); ctx.arc(wx + s*0.35, wy + s*0.38, s*0.12, 0, TAU); ctx.arc(wx + s*0.58, wy + s*0.62, s*0.16, 0, TAU); ctx.fill();
      }
    }
  }
}
function drawCore(run){
  const c = cellCenter(CORE_CELL.x, CORE_CELL.y);
  const hp = clamp(run.core.hp / run.core.maxHp, 0, 1);
  const pulse = 1 + Math.sin(G.now * 4) * 0.03;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(pulse, pulse);
  const g = ctx.createRadialGradient(0,0,6,0,0,42);
  g.addColorStop(0,'rgba(255,255,255,.95)');
  g.addColorStop(0.26,'rgba(121,229,255,.96)');
  g.addColorStop(0.55,'rgba(121,132,255,.28)');
  g.addColorStop(1,'rgba(121,132,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0,0,40,0,TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0,0,31,0,TAU); ctx.stroke();
  ctx.strokeStyle = '#ff8f7d';
  ctx.beginPath(); ctx.arc(0,0,31,-Math.PI/2,-Math.PI/2 + TAU * hp); ctx.stroke();
  if (run.core.barrier > 0) {
    ctx.strokeStyle = 'rgba(124,246,255,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0,0,39,0,TAU); ctx.stroke();
  }
  ctx.fillStyle = '#102034';
  ctx.beginPath(); ctx.arc(0,0,18,0,TAU); ctx.fill();
  ctx.fillStyle = '#b7f4ff';
  ctx.beginPath(); ctx.arc(0,0,10,0,TAU); ctx.fill();
  ctx.restore();
}
function drawHero(run){
  const h = run.hero;
  ctx.save();
  ctx.translate(h.x, h.y);
  if (run.hero.overclock > 0) {
    ctx.strokeStyle = rgba('#8ff0ff', 0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0,0,42 + Math.sin(G.now * 6) * 4,0,TAU); ctx.stroke();
  }
  if (run.hero.vectorBoost > 0) {
    ctx.strokeStyle = rgba('#ffcf7e', 0.4);
    ctx.beginPath(); ctx.arc(0,0,26 + Math.sin(G.now * 8) * 2,0,TAU); ctx.stroke();
  }
  ctx.fillStyle = HEROES[run.heroId].bulletColor;
  ctx.beginPath(); ctx.arc(0,0,12,0,TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(0,-15,5,0,TAU); ctx.fill();
  ctx.restore();
}
function drawTowers(run){
  for (const tower of run.towers) {
    const selected = run.selectedTowerId === tower.id;
    ctx.save();
    ctx.translate(tower.x, tower.y);
    if (selected) {
      ctx.strokeStyle = 'rgba(121,229,255,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,G.layout.cell * 0.34,0,TAU); ctx.stroke();
      const stats = getTowerStats(run, tower);
      ctx.strokeStyle = 'rgba(121,229,255,.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0,0,stats.range,0,TAU); ctx.stroke();
    }
    const col = TOWERS[tower.type].color;
    ctx.fillStyle = rgba(col, 0.18);
    ctx.beginPath(); ctx.arc(0,0,G.layout.cell*0.28,0,TAU); ctx.fill();
    ctx.strokeStyle = rgba(col, .85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = G.layout.cell * 0.22;
    for (let i=0;i<6;i++) {
      const a = i / 6 * TAU;
      const x = Math.cos(a)*r, y = Math.sin(a)*r;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.rotate(tower.angle);
    if (tower.type === 'arc') {
      ctx.strokeStyle = '#ede3ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(-8,4); ctx.lineTo(0,15); ctx.lineTo(8,4); ctx.closePath(); ctx.stroke();
    } else if (tower.type === 'mortar') {
      ctx.fillStyle = '#ffd7a8';
      roundRect(ctx,-9,-9,18,18,6); ctx.fill();
      ctx.fillStyle = '#372212'; roundRect(ctx,-4,-18,8,18,4); ctx.fill();
    } else if (tower.type === 'frost') {
      ctx.fillStyle = '#e4ffff';
      ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(8,3); ctx.lineTo(0,16); ctx.lineTo(-8,3); ctx.closePath(); ctx.fill();
    } else if (tower.type === 'bloom') {
      ctx.fillStyle = '#d9ffe4';
      for (let i=0;i<5;i++) { const a = i / 5 * TAU + tower.anim; ctx.beginPath(); ctx.arc(Math.cos(a)*7,Math.sin(a)*7,4,0,TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0,0,5,0,TAU); ctx.fillStyle='#75ff9a'; ctx.fill();
    } else {
      ctx.fillStyle = '#d6fbff'; roundRect(ctx,-4,-20,8,20,4); ctx.fill();
    }
    if (tower.level > 1) {
      text(`${tower.level}`, G.layout.cell*0.12, -G.layout.cell*0.28, 12, '#eef4ff', 'center', '900');
    }
    ctx.restore();
  }
}
function drawEnemies(run){
  for (const e of run.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const color = e.isBoss ? e.def.color : e.def.color;
    ctx.fillStyle = rgba(color, e.shield > 0 ? 0.95 : 0.86);
    ctx.beginPath(); ctx.arc(0,0,e.radius,0,TAU); ctx.fill();
    if (e.shield > 0) {
      ctx.strokeStyle = 'rgba(125,235,255,.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,e.radius+3,0,TAU); ctx.stroke();
    }
    if (e.vuln > 0) {
      ctx.strokeStyle = 'rgba(255,236,140,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,e.radius+6 + Math.sin(G.now*10)*1.5,0,TAU); ctx.stroke();
    }
    if (e.frozen > 0) {
      ctx.strokeStyle = 'rgba(150,245,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,e.radius+4,0,TAU); ctx.stroke();
    }
    ctx.restore();

    const w = e.isBoss ? 92 : 44;
    const x = e.x - w/2, y = e.y - e.radius - 14;
    ctx.fillStyle = 'rgba(0,0,0,.36)';
    roundRect(ctx,x,y,w,6,999); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,120,.9)';
    roundRect(ctx,x,y,w * clamp(e.hp/e.maxHp,0,1),6,999); ctx.fill();
  }
}
function drawProjectiles(run){
  for (const p of run.projectiles) {
    if (p.kind === 'mortar') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,6,0,TAU); ctx.fill();
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
  }
}
function drawFieldsVisual(run){
  for (const f of run.fields) {
    const alpha = clamp(f.t / 5, 0.12, 0.28);
    ctx.fillStyle = rgba(f.color || '#bba8ff', alpha);
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(f.color || '#bba8ff', alpha + 0.14);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.82 + Math.sin(G.now*3)*0.03), 0, TAU); ctx.stroke();
  }
}
function drawParticlesVisual(run){
  for (const p of run.particles) {
    ctx.fillStyle = rgba(p.color, p.a);
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
  }
}
function drawPopups(run){
  for (const p of run.popups) {
    text(p.text, p.x, p.y, 12, rgba(p.color, p.a), 'center', '900');
  }
}
function drawHover(){
  if (!G.run || !G.hoverCell || G.state !== 'prepare' || !G.input.buildType) return;
  const cell = G.hoverCell;
  if (!inGrid(cell.x, cell.y)) return;
  const s = G.layout.cell;
  const x = G.layout.board.x + cell.x * s;
  const y = G.layout.board.y + cell.y * s;
  ctx.strokeStyle = 'rgba(121,229,255,.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, x+2, y+2, s-4, s-4, 8); ctx.stroke();
}

function updateParticles(run, dt){
  for (let i = run.particles.length - 1; i >= 0; i--) {
    const p = run.particles[i];
    p.t -= dt;
    p.a = Math.max(0, p.t / p.ttl);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    if (p.t <= 0) run.particles.splice(i,1);
  }
}
function updatePopups(run, dt){
  for (let i=run.popups.length-1;i>=0;i--) {
    const p = run.popups[i];
    p.t -= dt;
    p.y -= 22 * dt;
    p.a = clamp(p.t / p.ttl, 0, 1);
    if (p.t <= 0) run.popups.splice(i,1);
  }
}
function popup(run,x,y,textValue,color){ run.popups.push({x,y,text:textValue,color,t:0.6,ttl:0.6,a:1}); }
function dust(run,x,y,color,power=1){ for (let i=0;i<6*power;i++) run.particles.push({x,y,vx:rand(-70,70),vy:rand(-70,70),r:rand(1.6,3.6),t:rand(0.24,0.5),ttl:0.5,a:1,color}); }
function ring(run,x,y,r,color){ for (let i=0;i<18;i++) run.particles.push({x,y,vx:Math.cos(i/18*TAU)*r*0.8,vy:Math.sin(i/18*TAU)*r*0.8,r:rand(1.5,2.5),t:0.35,ttl:0.35,a:1,color}); }
function spark(run,x1,y1,x2,y2,color){
  const steps = 8;
  for (let i=0;i<steps;i++) {
    const t = i/(steps-1);
    run.particles.push({x:lerp(x1,x2,t)+rand(-3,3),y:lerp(y1,y2,t)+rand(-3,3),vx:0,vy:0,r:2.1,t:0.18,ttl:0.18,a:1,color});
  }
}

function updateStorm(run, dt){
  run.stormTimer = (run.stormTimer || 4.8) - dt;
  if (run.stormTimer > 0) return;
  run.stormTimer = rand(4.4, 5.8);
  if (run.enemies.length === 0) return;
  const target = run.enemies.reduce((a,b) => a.hp > b.hp ? a : b);
  burst(run, target.x, target.y, 28 + run.stageIndex * 6, 54, 'energy', { color:'#c4b3ff' });
  toast('폭풍 전선 발동');
}
function maybeSpawnStormFx(run, dt){
  if (Math.random() < dt * 1.2) {
    const x = rand(G.layout.board.x, G.layout.board.x + G.layout.board.w);
    const y = rand(G.layout.board.y, G.layout.board.y + G.layout.board.h);
    run.particles.push({x,y,vx:0,vy:0,r:rand(1.2,2.8),t:0.22,ttl:0.22,a:1,color:'#cbb8ff'});
  }
}
function updateHeart(run, dt){
  run.heartTimer = (run.heartTimer || 7.5) - dt;
  if (run.heartTimer > 0) return;
  run.heartTimer = 8.0;
  for (const enemy of run.enemies) {
    if (dist(run.hero.x, run.hero.y, enemy.x, enemy.y) < 120) {
      enemy.slow = Math.max(enemy.slow, 0.35);
      enemy.slowTimer = Math.max(enemy.slowTimer, 1.6);
      enemy.freeze += 24;
    }
  }
  ring(run, run.hero.x, run.hero.y, 120, '#98efff');
}
function updateReactor(run, dt){
  // timer handled on kills, function retained for future hooks.
}

function hint(msg){
  G.hintText = msg;
  ui.hintLine.textContent = msg;
  ui.hintLine.classList.add('show');
  G.hintTimer = 2.4;
}
function toast(msg){
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  G.toastTimer = 1.8;
}

function bindInput(){
  ui.startRunBtn.addEventListener('click', startRun);
  ui.startWaveBtn.addEventListener('click', startWave);
  ui.abilityBtn.addEventListener('click', tryUseAbility);
  ui.upgradeBtn.addEventListener('click', upgradeSelectedTower);
  ui.sellBtn.addEventListener('click', sellSelectedTower);

  window.addEventListener('resize', resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
    window.visualViewport.addEventListener('scroll', resize);
  }
  window.addEventListener('keydown', e => {
    G.input.keys[e.code] = true;
    if (e.code === 'Enter') startWave();
    if (e.code === 'Space') { e.preventDefault(); tryUseAbility(); }
  });
  window.addEventListener('keyup', e => { G.input.keys[e.code] = false; });

  canvas.addEventListener('pointerdown', e => {
    openPointerSelect(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', e => {
    G.pointer.x = e.clientX; G.pointer.y = e.clientY;
    if (!G.run || G.modal || G.run.state !== 'prepare') return;
    if (boardContains(e.clientX, e.clientY)) G.hoverCell = worldToCell(e.clientX, e.clientY);
  });

  ui.joystick.addEventListener('pointerdown', e => {
    e.preventDefault();
    const rect = ui.stickBase.getBoundingClientRect();
    G.input.joystick.active = true;
    G.input.joystick.id = e.pointerId;
    G.input.joystick.rect = rect;
    updateStickFromPointer(e.clientX, e.clientY, rect);
    ui.joystick.setPointerCapture(e.pointerId);
  });
  ui.joystick.addEventListener('pointermove', e => {
    if (!G.input.joystick.active || G.input.joystick.id !== e.pointerId) return;
    const rect = G.input.joystick.rect || ui.stickBase.getBoundingClientRect();
    updateStickFromPointer(e.clientX, e.clientY, rect);
  });
  const endStick = e => {
    if (!G.input.joystick.active || G.input.joystick.id !== e.pointerId) return;
    G.input.joystick.active = false;
    G.input.joystick.id = null;
    G.input.joystick.rect = null;
    G.input.joystick.x = 0;
    G.input.joystick.y = 0;
    ui.stickThumb.style.transform = 'translate(-50%, -50%)';
  };
  ui.joystick.addEventListener('pointerup', endStick);
  ui.joystick.addEventListener('pointercancel', endStick);
  ui.joystick.addEventListener('pointerleave', e => {
    if (e.buttons === 0) endStick(e);
  });

  document.addEventListener('contextmenu', e => e.preventDefault());
}

function updateStickFromPointer(x, y, rect){
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  const dx = x - cx;
  const dy = y - cy;
  const max = Math.max(1, rect.width * 0.33);
  const len = Math.hypot(dx,dy) || 1;
  const clamped = Math.min(max, len);
  const nx = dx / len * clamped;
  const ny = dy / len * clamped;
  G.input.joystick.x = clamp(nx / max, -1, 1);
  G.input.joystick.y = clamp(ny / max, -1, 1);
  ui.stickThumb.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
}

let lastTime = performance.now();
function loop(now){
  const dt = clamp((now - lastTime) / 1000, 0, 0.033);
  lastTime = now;
  update(dt);
  requestAnimationFrame(loop);
}

function init(){
  resize();
  initTitle();
  bindInput();
  updateMetaUI();
  updateHUD();
  requestAnimationFrame(loop);
}


export function bootGame(){
  init();
}
