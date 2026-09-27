import {newState} from './state.js';
import {HEROES,COMPANIONS,ARTIFACTS,MEMORIES} from '../data/catalog.js';
import {hash,canonical,requireThat} from './rng.js';
const fail=message=>{throw Error('백업 오류: '+message);};
function walk(value,depth=0){if(depth>32)fail('중첩이 너무 깊습니다.');if(typeof value==='number'&&(!Number.isFinite(value)||value<0))fail('음수 또는 유효하지 않은 수치입니다.');if(typeof value==='string'&&value.length>20000)fail('문자열이 너무 깁니다.');if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))fail('위험한 키가 있습니다.');walk(v,depth+1);}}
export function exportSave(state){return JSON.stringify({format:'AstralCompanions',version:1,checksum:hash(canonical(state)),state});}
export function validateState(s){
 requireThat(s&&s.schemaVersion===1&&typeof s.profileId==='string'&&s.profileId.startsWith('astral-'),'다른 게임 또는 지원하지 않는 저장 버전입니다.');
 // Negative sentinels are legitimate internal fields, so bounds are validated by field.
 for(const [key,value]of Object.entries(s.wallets||{}))if(!Number.isSafeInteger(value)||value<0||value>1e12)fail('재화 범위: '+key);
 const baseline=newState(s.createdAt,1);for(const key of Object.keys(baseline.wallets))if(!(key in s.wallets))fail('필수 재화 누락');
 for(const field of ['revision','createdAt','epochDay','lastTrustedLogicalMs'])if(!Number.isSafeInteger(s[field])||s[field]<0)fail('시간/리비전 오류');
 if(!Number.isSafeInteger(s.clockOffsetMs)||Math.abs(s.clockOffsetMs)>1e15)fail('시계 보정 범위 오류');
 const members=[];for(const {id}of HEROES){const h=s.heroes?.[id];if(!h)fail('다섯 영웅이 필요합니다.');for(const [key,max]of [['level',400],['stage',1200],['nodes',60],['training',1e9],['bond',1e9]])if(!Number.isSafeInteger(h[key])||h[key]<(key==='level'?1:0)||h[key]>max)fail('영웅 범위: '+id+'/'+key);
  for(const slot of ['weapon','armor','accessory'])if(!Number.isInteger(h.gear?.[slot])||h.gear[slot]<0||h.gear[slot]>100||![0,1].includes(h.gearChoices?.[slot]))fail('장비 오류');
  if(![0,1].includes(h.style)||!Array.isArray(h.companions)||h.companions.length!==2)fail('편성 오류');for(const cid of h.companions.filter(Boolean)){if(!s.companions[cid]?.owned)fail('미보유 지원자');members.push(cid);}
 }
 if(new Set(members).size!==members.length)fail('중복 지원 배속');
 for(const {id}of COMPANIONS){const c=s.companions?.[id];if(!c||typeof c.owned!=='boolean'||!Number.isInteger(c.rank)||c.rank<0||c.rank>5||!Array.isArray(c.gates))fail('동료 오류');}
 for(const {id}of ARTIFACTS)if(!Number.isInteger(s.artifacts?.[id])||s.artifacts[id]<0||s.artifacts[id]>5)fail('유물 오류');
 if(!Array.isArray(s.memories)||new Set(s.memories).size!==s.memories.length)fail('기억 중복');
 for(const name of ['calendar','gacha','rng','rewards','gates','learning','ui','accrual'])if(!s[name]||typeof s[name]!=='object')fail('필수 장부 누락: '+name);
 validateLedgers(s);
 return s;
}
const integer=(value,min=0,max=1e12)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail('장부의 수치 범위 오류');};
const strings=(value,max=10000)=>{if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=='string'||x.length>180))fail('장부의 문자열 목록 오류');};
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))fail('장부 형식 오류');};
function question(q){object(q);if(!['vocab','collocation','grammar'].includes(q.kind)||typeof q.prompt!=='string'||q.prompt.length>20000||typeof q.answer!=='string')fail('학습 문제 형식');strings(q.options,10);if(!q.options.includes(q.answer))fail('학습 정답 누락');if(q.kind==='grammar'&&(!q.lecture||typeof q.lecture.content!=='string'||typeof q.lecture.title!=='string'))fail('강의 누락');}
function validateLedgers(s){
 strings(s.commands,256);strings(s.readScenes,2000);strings(s.skippedScenes,2000);strings(s.memories,500);strings(s.decor,500);strings(s.adventureRecords,100);
 strings(s.ui.lastHomeLines,14);if(!HEROES.some(h=>h.id===s.ui.hero)||!Number.isFinite(s.ui.textScale)||s.ui.textScale<.9||s.ui.textScale>1.3||!Number.isFinite(s.ui.volume)||s.ui.volume<0||s.ui.volume>1)fail('설정 범위');
 for(const k of ['muted','reducedMotion','vibration','tutorialDone'])if(typeof s.ui[k]!=='boolean')fail('설정 형식');
 const equipped=[];for(const h of Object.values(s.heroes)){object(h.presets);object(h.tactics);if(!['standard','survival','burst'].includes(h.tactics.preset)||typeof h.tactics.hold!=='boolean')fail('전술 형식');strings(h.tactics.order,3);if(h.artifact){if(!s.artifacts[h.artifact])fail('미보유 유물');equipped.push(h.artifact);}}
 if(equipped.length!==new Set(equipped).size)fail('중복 유물 장착');
 for(const c of Object.values(s.companions))strings(c.gates,6000);
 const a=s.accrual;integer(a.duration,0,86400000);integer(a.cursorMs,0,1e15);object(a.pending);object(a.pending.heroes);
 for(const k of ['xp','gold','forgeOre'])integer(a.pending[k],0,1e15);
 for(const h of HEROES){object(a.pending.heroes[h.id]);integer(a.pending.heroes[h.id].training,0,1e15);integer(a.pending.heroes[h.id].bond,0,1e15);object(a.rateSnapshot?.[h.id]);for(const k of ['xp','gold','forgeOre','training','bond'])integer(a.rateSnapshot[h.id][k],0,1e8);}
 for(const bucket of ['boostQ','comebackQ']){object(a[bucket]);for(const k of ['xp','gold'])integer(a[bucket][k],0,1e15);}
 if(!Array.isArray(a.segments)||a.segments.length>6001)fail('수율 구간 목록');let duration=0;for(const row of a.segments){integer(row.duration,0,86400000);integer(row.xp,0,1e8);integer(row.gold,0,1e8);duration+=row.duration;}if(duration!==a.duration)fail('수율 구간 시간 합계');
 const cal=s.calendar;integer(cal.day,s.epochDay-1,1e7);strings(cal.bits,10);integer(cal.interactionCharges,0,2);for(const key of ['qualified','weeks','seasonPoints','seasonRewards'])object(cal[key]);for(const [day,ok]of Object.entries(cal.qualified)){integer(Number(day),s.epochDay,1e7);if(ok!==true)fail('일일 장부');}for(const value of Object.values(cal.seasonPoints)){integer(value,0,280);if(value%10)fail('시즌 점수');}for(const week of Object.values(cal.weeks)){integer(week.days,0,7);if(!Array.isArray(week.awarded)||week.awarded.some(x=>![2,4,6].includes(x)))fail('주간 보상');}
 for(const key of ['companion','memory']){integer(s.gacha.counts[key],0,1e9);integer(s.gacha.issued[key],0,1e9);if(s.gacha.issued[key]!==Math.floor(s.gacha.counts[key]/(key==='companion'?30:60)))fail('누적 소환 선택권 장부');}
 if(!Array.isArray(s.gacha.batches)||s.gacha.batches.length>30)fail('소환 기록');for(const b of s.gacha.batches){if(typeof b.id!=='string'||!['companion','memory'].includes(b.pool)||!Array.isArray(b.results)||b.results.length!==b.count||b.count<1||b.count>100||typeof b.revealed!=='boolean')fail('소환 묶음 형식');for(const r of b.results)if(!['white','bronze','silver','gold','star'].includes(r.tier))fail('소환 등급');}
 for(const key of ['companion','memory','reward','adventure','learning'])integer(s.rng[key],0,4294967295);
 object(s.gates.used);for(const key of Object.keys(s.gates.used)){if(!['return','echo','grace'].includes(key))fail('보너스 종류');integer(s.gates.used[key],s.epochDay,cal.day);}if(typeof s.gates.echoCharge!=='boolean')fail('잔향 장부');
 if(s.gates.claim){object(s.gates.claim.amounts);for(const k of ['xp','gold'])integer(s.gates.claim.amounts[k]);}
 if(s.gates.grace){integer(s.gates.grace.start,0,1e15);integer(s.gates.grace.end,0,1e15);if(s.gates.grace.end-s.gates.grace.start!==1800000)fail('가호 시간');}
 if(s.gates.challenge){question(s.gates.challenge.question);if(!['return','echo','grace'].includes(s.gates.challenge.gate)||typeof s.gates.challenge.lectureRead!=='boolean')fail('학습 보너스 형식');}
 integer(s.learning.total,0,1e9);integer(s.learning.correct,0,s.learning.total);strings(s.learning.readLectures.map(String),1000);if(!Array.isArray(s.learning.mistakes)||s.learning.mistakes.length>100)fail('학습 기록');s.learning.mistakes.forEach(question);
 if(!Array.isArray(s.battleHistory)||s.battleHistory.length>200)fail('전투 기록');object(s.bossRecords);object(s.bossTraces);for(const value of Object.values(s.bossTraces))integer(value);
 object(s.adventureSlots);if(s.adventure){const r=s.adventure;integer(r.node,1,9);integer(r.slot,0,3);integer(r.week,0,1e6);if(!Number.isFinite(r.hpRatio)||r.hpRatio<0||r.hpRatio>1||(!r.failed&&r.hpRatio===0)||!HEROES.some(h=>h.id===r.heroId))fail('모험 상태');strings(r.items,12);strings(r.offer,3);strings(r.path,4);if(r.path.length!==4)fail('모험 경로');object(r.eventBonus);object(r.bossBonus);}
}
export function validateAndMigrate(bytes){
 if(typeof bytes!=='string'||new TextEncoder().encode(bytes).length>2097152)fail('최대 2 MiB 파일만 가져올 수 있습니다.');let document;try{document=JSON.parse(bytes);}catch{fail('JSON 형식이 아닙니다.');}
 function safe(value,depth=0){if(depth>32)fail('중첩이 너무 깊습니다.');if(typeof value==='number'&&!Number.isFinite(value))fail('유한 수치가 아닙니다.');if(typeof value==='string'&&value.length>50000)fail('문자열이 너무 깁니다.');if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))fail('위험한 키');safe(v,depth+1);}}
 safe(document);requireThat(document.format==='AstralCompanions'&&document.version===1,'별의 동행 백업이 아닙니다.');const s=document.state;
 requireThat(document.checksum===hash(canonical(s)),'백업 체크섬이 다릅니다.');
 if(s.schemaVersion===0){const old=structuredClone(s),defaults=newState(s.createdAt,s.profileId);Object.assign(defaults,old);defaults.schemaVersion=1;return validateState(defaults);}
 const result=validateState(s);result.orphanIds=result.orphanIds||[];for(const id of result.memories)if(!MEMORIES.some(m=>m.id===id)&&!result.orphanIds.includes(id))result.orphanIds.push(id);return result;
}
