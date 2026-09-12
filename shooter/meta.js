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
  { id: 'dragon', name: '드래곤하트', icon: '♥', rarity: 'rare', text: '생명 1일 때 공격력 +40%' },
  { id: 'core', name: '마나코어', icon: '✺', rarity: 'rare', text: '봄 공격력 +50%', bomb: .50 },
  { id: 'leaf', name: '세계수의잎', icon: '❧', rarity: 'rare', text: '곁에서 자동 공격하는 페어리 소환' },
  { id: 'dream', name: '꿈의조각', icon: '✧', rarity: 'rare', text: '최대 생명 +2', life: 2 },
  { id: 'magnet', name: '황금자석', icon: '⊂', rarity: 'normal', text: '아이템 획득 범위 +300' }
];
export const DIFFICULTIES = [
  { id: 'easy', name: '쉬움', hp: .836, speed: .78, interval: 1.2, lives: 4, maxLife:4, rare: .10 },
  { id: 'normal', name: '보통', hp: 1.15, speed: 1, interval: 1, lives: 3, maxLife:4, rare: .25 },
  { id: 'hard', name: '어려움', hp: 1.56, speed: 1.19, interval: .82, lives: 3, maxLife:3, rare: .45 }
];
export function normalizeDifficulty(mode) { return mode === 'relaxed' ? 'easy' : DIFFICULTIES.some(d => d.id === mode) ? mode : 'normal'; }
export function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function weekKey(date = new Date()) { const d = new Date(date); d.setHours(12,0,0,0); d.setDate(d.getDate() - (d.getDay()+6)%7); return dayKey(d); }
export function dailyHeroes(date = new Date()) { const day = date.getDay(); return day === 0 ? [0,1,2,3,4,6] : day <= 2 ? [0,1] : day <= 4 ? [2,3] : [4,6]; }
export function createProfile(raw = {}) {
  if(!raw || typeof raw !== 'object')raw={};
  const valid = id => ARTIFACTS.some(a => a.id === id);
  return { version: 2, owned: [...new Set(['spellbook','frozen','crystal', ...(Array.isArray(raw.owned) ? raw.owned.filter(valid) : [])])],
    equipped: [...new Set((Array.isArray(raw.equipped) ? raw.equipped : ['spellbook','frozen','crystal']).filter(valid))].slice(0,3),
    claims: raw.claims && typeof raw.claims === 'object' ? raw.claims : {},
    tickets: Array.isArray(raw.tickets) ? raw.tickets.filter(t => DIFFICULTIES.some(d => d.id === t.difficulty) && Number.isInteger(t.dungeon) && t.dungeon >= 0 && t.dungeon < 4) : [],
    unlocks: raw.unlocks && typeof raw.unlocks === 'object' ? raw.unlocks : {},
    learning: raw.learning && typeof raw.learning === 'object' ? raw.learning : { correct: 0, total: 0, mistakes: [], read: [] } };
}
export function heroAvailable(profile, hero, date = new Date()) { return [0,1,2,3,4,6].includes(hero) && (dailyHeroes(date).includes(hero) || profile.unlocks[hero] === dayKey(date)); }
export function unlockHero(profile, hero, date = new Date()) { if ([0,1,2,3,4,6].includes(hero)) profile.unlocks[hero] = dayKey(date); }
// Random departures can discover hidden heroes; a retry rolls again.
export function randomHero(profile, random = Math.random, date = new Date()) {
  const hidden = [5,7,8], normal = [0,1,2,3,4,6].filter(i => heroAvailable(profile,i,date));
  const pool = random() < .2 ? hidden : normal;
  return pool[Math.min(pool.length-1, Math.floor(Math.max(0,random()) * pool.length))];
}
export function claimDungeon(profile, dungeon, difficulty, date = new Date()) {
  if (!Number.isInteger(dungeon) || dungeon < 0 || dungeon > 3 || !DIFFICULTIES.some(d => d.id === difficulty)) return null;
  const week = weekKey(date), key = `${week}:${dungeon}`;
  if (profile.claims[key]) return null;
  const ticket = { dungeon, difficulty, week }; profile.claims[key] = difficulty; profile.tickets.push(ticket); return ticket;
}
export function drawArtifact(profile, random = Math.random) {
  const ticket = profile.tickets.shift(); if (!ticket) return null;
  const chance = DIFFICULTIES.find(d => d.id === ticket.difficulty).rare;
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
    attack: 1+sum('attack'), bomb: 1+sum('bomb'), bombs: 3+sum('bombs'), maxBombs: 5+sum('bombs') };
}
