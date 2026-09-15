import { HEROES } from './content.js';
export const ARTIFACTS = [
  { id: 'spellbook', name: '마도서', icon: '▤', rarity: 'normal', text: '봄 공격력 +20%', bomb: .20 },
  { id: 'nail', name: '어쌔신네일', icon: '†', rarity: 'normal', text: '공격력 +25% · 최대 생명 −2', attack: .25, life: -2 },
  { id: 'frozen', name: '프로즌하트', icon: '♡', rarity: 'normal', text: '최대 생명 +1', life: 1 },
  { id: 'crystal', name: '마나수정', icon: '◇', rarity: 'normal', text: '공격력 +5%', attack: .05 },
  { id: 'holy', name: '홀리밤', icon: '❖', rarity: 'normal', text: '시작 봄과 최대 봄 +1', bombs: 1 },
  { id: 'cloak', name: '투명망토', icon: '☾', rarity: 'normal', text: '피격 후 4초 무적' },
  { id: 'crown', name: '로열크라운', icon: '♕', rarity: 'normal', text: '봄 공격력 +30%', bomb: .30 },
  { id: 'shield', name: '수호방패', icon: '◈', rarity: 'normal', text: '피격 시 생명 대신 봄을 먼저 소모' },
  { id: 'mask', name: '광기의가면', icon: '◐', rarity: 'normal', text: '봄이 없으면 생명 1로 발동 · 스테이지당 3회' },
  { id: 'pendant', name: '검은펜던트', icon: '♦', rarity: 'rare', text: '파워 최대일 때 공격력 +20%' },
  { id: 'chocolate', name: '드림초콜릿', icon: '▦', rarity: 'rare', text: '보스에게 공격력 +50%' },
  { id: 'dragon', name: '드래곤하트', icon: '♥', rarity: 'rare', text: '생명 1일 때 공격력 +50%' },
  { id: 'core', name: '마나코어', icon: '✺', rarity: 'rare', text: '봄 공격력 +50%', bomb: .50 },
  { id: 'leaf', name: '세계수의잎', icon: '❧', rarity: 'rare', text: '곁에서 자동 공격하는 페어리 소환' },
  { id: 'dream', name: '꿈의조각', icon: '✧', rarity: 'rare', text: '최대 생명 +2', life: 2 },
  { id: 'magnet', name: '황금자석', icon: '⊂', rarity: 'normal', text: '아이템 획득 범위 +300' },
  { id: 'mirror', name: '악마의거울', icon: '◐', rarity: 'normal', text: '이동속도 −300 · 다크페어리 소환', speed: -300 },
  { id: 'will', name: '수호의의지', icon: '♡', rarity: 'normal', text: '스테이지 클리어마다 생명 1 추가 회복' },
  { id: 'origin', name: '시작의보석', icon: '◆', rarity: 'normal', text: '시작 파워 +1' },
  { id: 'boots', name: '바람의장화', icon: '➶', rarity: 'normal', text: '이동속도 +200', speed: 200 },
  { id: 'moonlight', name: '월광의목걸이', icon: '☽', rarity: 'rare', text: '스테이지 클리어마다 봄 1 추가 회복' },
  { id: 'sun', name: '황금의태양', icon: '☀', rarity: 'rare', text: '필살기를 코로나로 교체 · 피해 1900 · 지속/무적 1초' },
  { id: 'hourglass', name: '모래시계', rarity: 'normal', text: '콤보 유지 시간 +2초' },
  { id: 'clover', name: '네잎클로버', rarity: 'normal', text: '시작 시 피격 1회를 막는 보호막 생성' },
  { id: 'witch', name: '마녀의계약서', rarity: 'normal', text: '일반 몬스터에게 피해 +20%' },
  { id: 'silver', name: '은탄', rarity: 'normal', text: '엘리트·중간 보스에게 피해 +30%' },
  { id: 'eye', name: '마안', rarity: 'normal', text: '봄이 없을 때 공격력 +30%' },
  { id: 'startboost', name: '스타트부스트', rarity: 'normal', text: '파워 1일 때 공격력 +50%' },
  { id: 'slipper', name: '유리구두', rarity: 'rare', text: '그레이즈 20회마다 보호막 생성 · 중첩 불가' },
  { id: 'dew', name: '신록의이슬', rarity: 'rare', text: '파워업에 필요한 P −1 · 공격력 +5%', attack: .05 },
  { id: 'bigbang', name: '빅뱅', rarity: 'rare', text: '일반 공격력 −10% · 봄 공격력 +60%', normalAttack: -.10, bomb: .60 },
  { id: 'kaleidoscope', name: '만화경', rarity: 'rare', text: '봄 공격력 −20% · 일반 공격력 +30%', normalAttack: .30, bomb: -.20 }
];
export const DIFFICULTIES = [
  { id: 'easy', name: '쉬움', hp: .836, speed: .78, interval: 1.2, lives: 4, maxLife:4, rare: .15, tickets: 1 },
  { id: 'normal', name: '보통', hp: 1.15, speed: 1, interval: 1, lives: 3, maxLife:4, rare: .15, tickets: 1 },
  { id: 'hard', name: '어려움', hp: 1.56, speed: 1.19, interval: .82, lives: 3, maxLife:3, rare: .15, tickets: 2 }
];
export const BASE_HEROES = Object.freeze([
  { hero:0, name:'루미' }, { hero:1, name:'루나' }, { hero:2, name:'지크' },
  { hero:3, name:'자스민' }, { hero:4, name:'눈토끼' }, { hero:6, name:'밤토끼' }
]);
const _josa=(name)=>{const c=name.charCodeAt(name.length-1);return(c>=0xAC00&&(c-0xAC00)%28!==0)?'으로':'로';};
export const ACHIEVEMENTS = Object.freeze(BASE_HEROES.flatMap(({hero,name})=>[0,1].flatMap(weapon=>{const wName=HEROES[hero].weapons[weapon].name;return[
  { id:`${hero}-${weapon}-all`, hero, weapon, difficulty:null, name:`${name} ${wName} · 여섯 하늘`, text:`${name}의 ${wName}${_josa(wName)} 모든 던전 클리어` },
  { id:`${hero}-${weapon}-hard`, hero, weapon, difficulty:'hard', name:`${name} ${wName} · 어려움`, text:`${name}의 ${wName}${_josa(wName)} 모든 던전 어려움 클리어` }
];})));
export function normalizeDifficulty(mode) { return mode === 'relaxed' ? 'easy' : DIFFICULTIES.some(d => d.id === mode) ? mode : 'normal'; }
export function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function weekKey(date = new Date()) { const d = new Date(date); d.setHours(12,0,0,0); d.setDate(d.getDate() - (d.getDay()+6)%7); return dayKey(d); }
export function dailyHeroes(date = new Date()) { const day = date.getDay(); return day === 0 ? [0,1,2,3,4,6] : day <= 2 ? [0,1] : day <= 4 ? [2,3] : [4,6]; }
export function createProfile(raw = {}) {
  if(!raw || typeof raw !== 'object')raw={};
  const valid = id => ARTIFACTS.some(a => a.id === id);
  // Preserve old Chaos ownership when it moves from index 3 to index 5.
  const migrate = !Number.isFinite(Number(raw.version)) || Number(raw.version) < 3;
  const claims = Object.fromEntries(Object.entries(raw.claims && typeof raw.claims === 'object' ? raw.claims : {}).map(([key,value])=>[migrate ? key.replace(/:3$/,':5') : key,value]));
  const uses=raw.randomDraws;
  const clears=Object.fromEntries(Object.entries(raw.clears && typeof raw.clears==='object' ? raw.clears : {}).filter(([key,value])=>value===true&&/^(0|1|2|3|4|6):[01]:(easy|normal|hard):[0-5]$/.test(key)));
  return { version: 4, randomDraws: uses && typeof uses.date==='string' ? {date:uses.date,count:Math.max(0,Math.min(10,Math.floor(Number(uses.count)||0)))} : {date:'',count:0}, owned: [...new Set(['spellbook','frozen','crystal', ...(Array.isArray(raw.owned) ? raw.owned.filter(valid) : [])])],
    equipped: [...new Set((Array.isArray(raw.equipped) ? raw.equipped : ['spellbook','frozen','crystal']).filter(valid))].slice(0,3),
    claims,
    tickets: Array.isArray(raw.tickets) ? raw.tickets.filter(t => DIFFICULTIES.some(d => d.id === t.difficulty) && Number.isInteger(t.dungeon) && t.dungeon >= 0 && t.dungeon < (migrate?4:6)).map(t=>({...t,dungeon:migrate&&t.dungeon===3?5:t.dungeon})) : [],
    unlocks: raw.unlocks && typeof raw.unlocks === 'object' ? raw.unlocks : {},
    clears,
    learning: raw.learning && typeof raw.learning === 'object' ? raw.learning : { correct: 0, total: 0, mistakes: [], read: [] } };
}
export function recordDungeonClear(profile,hero,weapon,dungeon,difficulty) {
  if(!BASE_HEROES.some(entry=>entry.hero===hero)||![0,1].includes(weapon)||!Number.isInteger(dungeon)||dungeon<0||dungeon>5||!DIFFICULTIES.some(mode=>mode.id===difficulty))return false;
  if(!profile.clears||typeof profile.clears!=='object')profile.clears={};
  profile.clears[`${hero}:${weapon}:${difficulty}:${dungeon}`]=true;return true;
}
export function achievementProgress(profile) {
  const clears=profile?.clears&&typeof profile.clears==='object'?profile.clears:{};
  return ACHIEVEMENTS.map(achievement=>{
    let progress=0;
    for(let dungeon=0;dungeon<6;dungeon++) {
      const modes=achievement.difficulty?[achievement.difficulty]:DIFFICULTIES.map(mode=>mode.id);
      if(modes.some(mode=>clears[`${achievement.hero}:${achievement.weapon}:${mode}:${dungeon}`]))progress++;
    }
    return {...achievement,progress,complete:progress===6};
  });
}
export function heroAvailable(profile, hero, date = new Date()) { return [0,1,2,3,4,6].includes(hero) && (dailyHeroes(date).includes(hero) || profile.unlocks[hero] === dayKey(date)); }
export function unlockHero(profile, hero, date = new Date()) { if ([0,1,2,3,4,6].includes(hero)) profile.unlocks[hero] = dayKey(date); }
// Random departures can discover hidden heroes; a retry rolls again.
export function randomHero(profile, random = Math.random, date = new Date()) {
  // Every playable hero has the same chance, including locked and hidden heroes.
  return Math.min(8, Math.floor(Math.max(0,random()) * 9));
}
export function randomRemaining(profile,date=new Date()) {
  return profile.randomDraws?.date===dayKey(date) ? Math.max(0,10-profile.randomDraws.count) : 10;
}
export function consumeRandom(profile,random=Math.random,date=new Date()) {
  if(randomRemaining(profile,date)<=0)return null;
  const count=profile.randomDraws?.date===dayKey(date)?profile.randomDraws.count:0;
  profile.randomDraws={date:dayKey(date),count:count+1};
  return randomHero(profile,random,date);
}
export function claimDungeon(profile, dungeon, difficulty, date = new Date()) {
  if (!Number.isInteger(dungeon) || dungeon < 0 || dungeon > 5 || !DIFFICULTIES.some(d => d.id === difficulty)) return null;
  const week = weekKey(date), key = `${week}:${dungeon}`;
  if (profile.claims[key]) return null;
  const ticket = { dungeon, difficulty, week }; profile.claims[key] = difficulty; const count=DIFFICULTIES.find(d=>d.id===difficulty).tickets; for(let i=0;i<count;i++)profile.tickets.push({...ticket}); return {...ticket,count};
}
export function drawArtifact(profile, random = Math.random, quizCorrect = false) {
  const ticket = profile.tickets.shift(); if (!ticket) return null;
  const chance = quizCorrect ? .30 : .15;
  const rarity = random() < chance ? 'rare' : 'normal', pool = ARTIFACTS.filter(a => a.rarity === rarity);
  const artifact = pool[Math.min(pool.length-1, Math.floor(Math.max(0, random()) * pool.length))];
  const duplicate = profile.owned.includes(artifact.id); if (!duplicate) profile.owned.push(artifact.id);
  return { artifact, duplicate, ticket };
}
export function loadoutStats(ids = [], difficulty = 'normal') {
  const equipment = [...new Set(ids)].slice(0,3).map(id => ARTIFACTS.find(a => a.id === id)).filter(Boolean);
  const sum = field => equipment.reduce((n,a) => n+(a[field] || 0), 0);
  const mode=DIFFICULTIES.find(d=>d.id===difficulty) || DIFFICULTIES[1];
  return { ids: equipment.map(a=>a.id), maxLife: Math.max(1, mode.maxLife + sum('life')), lives:Math.max(1,mode.lives+sum('life')),
    speed: sum('speed'), attack: 1+sum('attack'), normalAttack: sum('normalAttack'), bomb: 1+sum('bomb'), bombs: 3+sum('bombs'), maxBombs: 5+sum('bombs') };
}
