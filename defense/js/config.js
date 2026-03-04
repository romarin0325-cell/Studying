export const TAU = Math.PI * 2;
export const DPR_CAP = 2;
export const GRID = { cols: 13, rows: 8 };
export const CORE_CELL = { x: 10, y: 3 };
export const SAVE_KEY = 'rift-bastion-mobile-v1';

const DIFFICULTIES = {
  relaxed: { id:'relaxed', name:'정찰', desc:'보상이 넉넉하고 적이 느슨합니다.', hp:0.88, speed:0.93, gold:1.16, score:0.85, stars:1 },
  standard: { id:'standard', name:'표준', desc:'의도한 밸런스. 첫 런 추천.', hp:1.0, speed:1.0, gold:1.0, score:1.0, stars:2 },
  eclipse: { id:'eclipse', name:'월식', desc:'고위험 고보상. 정예와 보스가 강합니다.', hp:1.18, speed:1.08, gold:1.08, score:1.22, stars:3 },
};

const TOWERS = {
  bolt: {
    id:'bolt', name:'볼트 둥지', color:'#7ddcff', cost:56,
    desc:'빠른 단일 탄막. 초반 안정감이 좋다.',
    base:{ damage:13, rate:4.1, range:175, crit:0.05, kind:'ballistic', speed:580 }
  },
  mortar: {
    id:'mortar', name:'박격 포탑', color:'#ffb66c', cost:82,
    desc:'느리지만 강력한 광역 폭발.',
    base:{ damage:36, rate:1.0, range:255, crit:0.05, kind:'explosive', speed:290, aoe:60 }
  },
  arc: {
    id:'arc', name:'연쇄 코일', color:'#ad91ff', cost:92,
    desc:'뭉친 적에게 강한 즉발 연쇄.',
    base:{ damage:16, rate:1.55, range:166, crit:0.03, kind:'energy', chains:2 }
  },
  frost: {
    id:'frost', name:'빙결 첨탑', color:'#8ef7f3', cost:72,
    desc:'감속과 동결로 라인을 붙잡는다.',
    base:{ damage:8, rate:2.45, range:180, crit:0.04, kind:'frost', speed:500, slow:0.22, freeze:18 }
  },
  bloom: {
    id:'bloom', name:'포자 둥지', color:'#90f4b0', cost:86,
    desc:'중독 누적과 사망 전염으로 후반 폭발.',
    base:{ damage:7, rate:1.85, range:168, crit:0.04, kind:'poison', speed:340, poison:12 }
  }
};

const BIOMES = {
  verdant: { id:'verdant', name:'녹음 수림', bg1:'#122b1f', bg2:'#07120d', tile:'#183425', path:'#2c5940', accent:'#79f0a5', theme:['splitter','brute','grunt'] },
  dune: { id:'dune', name:'잿빛 사구', bg1:'#362612', bg2:'#100c07', tile:'#3f2b18', path:'#6a4c2c', accent:'#ffc978', theme:['runner','runner','grunt','shielder'] },
  tundra: { id:'tundra', name:'균열 설원', bg1:'#1c2c37', bg2:'#081017', tile:'#203c49', path:'#3a6272', accent:'#8be8ff', theme:['wisp','grunt','brute'] },
  ruins: { id:'ruins', name:'붕괴 유적', bg1:'#2d2135', bg2:'#0f0c14', tile:'#342742', path:'#5c436f', accent:'#d0a6ff', theme:['shielder','wisp','grunt'] },
  crimson: { id:'crimson', name:'혈흔 황무지', bg1:'#36181f', bg2:'#12070a', tile:'#47222c', path:'#7a3640', accent:'#ff99af', theme:['runner','splitter','shielder','brute'] },
};

const MUTATORS = {
  stockpile: { id:'stockpile', name:'보급 창고', desc:'클리어 시 금화 +70.', applyStage(stage){ stage.clearReward.gold = (stage.clearReward.gold || 0) + 70; } },
  frenzy: { id:'frenzy', name:'광란 조류', desc:'적 이동속도 +12%, 점수 보너스.', applyStage(stage){ stage.enemySpeed *= 1.12; stage.scoreMul *= 1.08; } },
  fortified: { id:'fortified', name:'철갑 진군', desc:'적 체력 +18%, 금화 +35.', applyStage(stage){ stage.enemyHp *= 1.18; stage.clearReward.gold = (stage.clearReward.gold || 0) + 35; } },
  glacier: { id:'glacier', name:'빙점 지형', desc:'적이 상시 10% 감속.', applyStage(stage){ stage.baseSlow = 0.10; } },
  leyline: { id:'leyline', name:'증폭 도관', desc:'특수 타일 +1, 특수 타일 효과 강화.', applyStage(stage){ stage.specialCount += 1; stage.specialBoost *= 1.28; } },
  storm: { id:'storm', name:'폭풍 전선', desc:'주기적으로 번개가 적을 강타.', applyStage(stage){ stage.storm = true; } },
  repair: { id:'repair', name:'수리 드론', desc:'클리어 시 코어 수리 +24.', applyStage(stage){ stage.clearReward.repair = (stage.clearReward.repair || 0) + 24; } },
  volatile: { id:'volatile', name:'휘발성 균열', desc:'폭발/독 피해 +20%, 적 접촉 피해 +10%.', applyStage(stage){ stage.enemyContact *= 1.10; stage.playerBonus.push('volatile'); } },
};

const SPECIALS = {
  ley: { name:'도관', desc:'배치한 타워 피해/사거리 +25%', color:'#7ae8ff' },
  forge: { name:'주조지', desc:'배치한 타워 업그레이드 비용 -15%', color:'#ffbf74' },
  grove: { name:'균사대', desc:'배치한 타워 독/빙결 효과 +30%', color:'#8cf3af' },
};

const ENEMIES = {
  runner: { id:'runner', name:'주자', color:'#ffd77a', hp:0.72, speed:1.48, damage:6, reward:4, size:0.34, cost:1.0 },
  grunt: { id:'grunt', name:'보병', color:'#ff8e8e', hp:1.0, speed:1.0, damage:8, reward:5, size:0.40, cost:1.4 },
  brute: { id:'brute', name:'거수', color:'#ffb476', hp:2.4, speed:0.68, damage:15, reward:8, size:0.60, cost:3.2 },
  wisp: { id:'wisp', name:'망령', color:'#b7a4ff', hp:0.92, speed:1.18, damage:9, reward:6, size:0.36, cost:1.7, slowResist:0.45 },
  shielder: { id:'shielder', name:'방패병', color:'#a5d0ff', hp:1.6, speed:0.88, damage:9, reward:7, size:0.46, cost:2.0, shield:0.35 },
  splitter: { id:'splitter', name:'분열체', color:'#95f3b5', hp:1.35, speed:0.94, damage:8, reward:6, size:0.44, cost:2.0, split:true },
};

const BOSSES = {
  colossus: { id:'colossus', name:'균열 거신', color:'#ffcf96', hp:12, speed:0.55, damage:30, reward:70, size:1.0, skill:'stomp' },
  brood: { id:'brood', name:'혈흔 모태', color:'#ff9cb4', hp:10.2, speed:0.63, damage:26, reward:72, size:0.92, skill:'summon' },
  prism: { id:'prism', name:'청명 프리즘', color:'#b8b1ff', hp:9.6, speed:0.70, damage:24, reward:74, size:0.88, skill:'barrier' },
};

const TECHS = [
  tech('ballistics1','관통 볼트','탄도 타워 피해 +15%.','공격', run => run.mods.ballistic *= 1.15),
  tech('explosive1','중폭 포신','폭발 타워 피해 +18%, 범위 +12%.','공격', run => { run.mods.explosive *= 1.18; run.mods.splash *= 1.12; }),
  tech('energy1','자속 정렬','에너지 타워 피해 +16%, 연쇄 +1.','공격', run => { run.mods.energy *= 1.16; run.mods.chain += 1; }),
  tech('frost1','극저온 매트릭스','빙결 타워 감속 +12%, 동결 축적 +25%.','제어', run => { run.mods.frost *= 1.12; run.mods.freeze *= 1.25; }),
  tech('poison1','독성 증식','중독 피해 +35%, 전염 반경 +20%.','제어', run => { run.mods.poison *= 1.35; run.mods.poisonSpread *= 1.2; }),
  tech('range1','목표 추적 렌즈','모든 타워 사거리 +12%.','공격', run => run.mods.towerRange *= 1.12),
  tech('rate1','고속 장전','모든 타워 공격 속도 +12%.','공격', run => run.mods.towerRate *= 1.12),
  tech('crit1','사격 연산','치명타 확률 +8%, 치명타 피해 +15%.','공격', run => { run.mods.crit += 0.08; run.mods.critDamage += 0.15; }),
  tech('core1','보루 외피','코어 최대 체력 +24, 즉시 24 수리.','방어', run => { run.core.maxHp += 24; run.core.hp = Math.min(run.core.maxHp, run.core.hp + 24); }),
  tech('barrier1','장벽 증폭기','매 스테이지 시작 시 장벽 +28.','방어', run => run.mods.barrierPerStage += 28),
  tech('hero1','영웅의 박자','영웅 피해 +18%, 공격 속도 +14%.','영웅', run => { run.mods.heroDamage *= 1.18; run.mods.heroRate *= 1.14; }),
  tech('hero2','기동 교범','영웅 이동 속도 +18%, 능력 재사용 -12%.','영웅', run => { run.mods.heroSpeed *= 1.18; run.mods.abilityCd *= 0.88; }),
  tech('gold1','반짝이는 비축분','즉시 금화 +80, 이후 금화 수급 +8%.','경제', run => { run.gold += 80; run.mods.gold *= 1.08; }),
  tech('gold2','회수 프로토콜','판매 환급률 +15%, 재배치 환급률 100% 유지.','경제', run => run.mods.sellRefund = Math.min(1, run.mods.sellRefund + 0.15)),
  tech('xp1','전장 기록기','경험치 획득 +20%, 리롤 +1.','경제', run => { run.mods.xp *= 1.2; run.rerolls += 1; }),
  tech('execute1','처형 프로토콜','체력 22% 이하 적에게 주는 피해 +35%.','공격', run => run.mods.execute = Math.max(run.mods.execute, 0.35)),
  tech('shatter1','균열 파편화','동결 상태 적이 받는 피해 +28%.','제어', run => run.mods.shatter *= 1.28),
  tech('vuln1','노출 추적','취약 상태 적이 받는 피해 +18%.','제어', run => run.mods.vulnDamage *= 1.18),
  tech('bolt2','분산 포열','볼트 둥지 추가 탄환 +1.','공격', run => run.mods.extraBolt += 1),
  tech('mortar2','화염 파편','박격 포탑 폭발에 잔화 장판 추가.','공격', run => run.mods.burning = true),
  tech('arc2','오버차지','연쇄 코일이 적중 시 취약 2초 부여.','제어', run => run.mods.arcVuln = 2.0),
  tech('frost2','빙산 핵','빙결 첨탑 투사체가 작은 범위 냉기 폭발.','제어', run => run.mods.frostSplash = true),
  tech('bloom2','포자 폭발','중독 상태 적 처치 시 독 구름 생성.','제어', run => run.mods.sporeBurst = true),
  tech('special1','특수 지형 활용','특수 타일 효과 +25%.','경제', run => run.mods.specialBoost *= 1.25),
  tech('upgrade1','현장 공정','업그레이드 비용 -12%, 업그레이드 효율 +15%.','경제', run => { run.mods.upgradeCost *= 0.88; run.mods.upgradeValue *= 1.15; }),
  tech('volatile1','불안정 연료','폭발/독 피해 +20%, 코어 장벽 -10.','위험', run => { run.mods.explosive *= 1.2; run.mods.poison *= 1.2; run.core.barrier = Math.max(0, run.core.barrier - 10); }),
  tech('bounty1','현상금 게시판','정예와 보스 보상 금화 +40%.','경제', run => run.mods.eliteGold *= 1.4),
  tech('repair1','긴급 수복','매 스테이지 종료 시 코어 체력 15% 수리.','방어', run => run.mods.endRepair += 0.15),
  tech('field1','이동 요새','영웅 주변 타워 피해 +12%.','영웅', run => run.mods.heroAura *= 1.12),
  tech('luck1','예비 전력','즉시 리롤 +2, 다음 2회 드래프트에 희귀 카드 1장 추가.','경제', run => { run.rerolls += 2; run.mods.rareDrafts += 2; }),
  tech('ability1','능력 증폭','영웅 능력 위력 +30%, 재사용 -8%.','영웅', run => { run.mods.abilityPower *= 1.3; run.mods.abilityCd *= 0.92; }),
  tech('economy1','보급선 단축','스테이지 시작 금화 +25.','경제', run => run.mods.stageGold += 25),
  tech('tempo1','압축 조준','모든 타워 사거리 -8%, 공격 속도 +22%.','위험', run => { run.mods.towerRange *= 0.92; run.mods.towerRate *= 1.22; }),
];

const RELICS = [
  relic('hourglass','왜곡 시계','매 스테이지 한 번, 코어가 피해를 받으면 2초 동안 적 전체 65% 감속.', run => run.relicState.hourglass = true),
  relic('wallet','깊은 주머니','즉시 금화 +120, 이후 모든 비용 -8%.', run => { run.gold += 120; run.mods.cost *= 0.92; }),
  relic('crown','가시 왕관','영웅 근처 적 처치 시 칼날 파편이 튄다.', run => run.relicState.crown = true),
  relic('reactor','반응로 종자','20킬마다 8초간 전체 피해 +20%.', run => run.relicState.reactor = true),
  relic('heart','서리 심장','8초마다 영웅 주변에 냉기 파동 발생.', run => run.relicState.heart = true),
  relic('echo','반향 렌즈','영웅 능력이 약한 추가 효과를 한 번 더 발동.', run => run.relicState.echo = true),
  relic('fortress','살아있는 성채','스테이지 시작 장벽 +40, 종료 수리 +10%.', run => { run.mods.barrierPerStage += 40; run.mods.endRepair += 0.10; }),
  relic('anvil','전장의 모루','모든 타워 기본 레벨 +1 상태로 건설.', run => run.mods.freeLevel += 1),
  relic('hive','군집 핵','중독과 동결 상태 적이 받는 피해 +20%.', run => { run.mods.poison *= 1.1; run.mods.frost *= 1.1; run.mods.debuffDamage *= 1.2; }),
  relic('vector','벡터 엔진','영웅 속도 +20%, 능력 사용 후 4초간 타워 속도 +18%.', run => { run.mods.heroSpeed *= 1.2; run.relicState.vector = true; }),
];

function tech(id, name, desc, tag, apply){ return { kind:'tech', id, name, desc, tag, apply }; }
function relic(id, name, desc, apply){ return { kind:'relic', id, name, desc, tag:'유물', apply }; }

export { DIFFICULTIES, TOWERS, BIOMES, MUTATORS, SPECIALS, ENEMIES, BOSSES, TECHS, RELICS };
