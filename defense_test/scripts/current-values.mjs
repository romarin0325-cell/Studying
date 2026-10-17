// docs/CURRENT_VALUES.md: every companion, relic and ultimate constant as the code has it today.
// Generated with the other reports (node defense_test/scripts/generated-reports.mjs) and checked by --check and the unit
// tests, so the numbers cannot drift from the game. The other docs are dated records of the day they were written;
// when one of their numbers disagrees with this file, this file is right.
import {HEROES,ARTIFACTS,ROSTER,HIDDEN,TUNING} from '../src/content.js';
import * as E from '../src/combat/engine.js';
import {PERFECT_REWARD,guardianOf} from '../src/economy.js';

const SHAPE={single:'단일',pulse:'원형(자기 칸)',beam:'관통',splash:'범위',cleave:'부채꼴',zone:'장판',cross:'십자',bounce:'도약',chain:'연쇄'};
const CLASS={tall:'큼',medium:'보통',short:'작음'};
const cell=text=>String(text??'').replaceAll('|','\\|').replace(/\s+/g,' ').trim();
const num=n=>Number.isInteger(n)?String(n):String(+n.toFixed(3));
const RARITY_ORDER=['C','R','SR','UR'];
const kind=h=>h.hidden?'UR·히든':h.rarity;

export function currentValues(){
  const heroes=[...HEROES].sort((a,b)=>RARITY_ORDER.indexOf(a.rarity)-RARITY_ORDER.indexOf(b.rarity)||a.hidden-b.hidden);
  const lines=[];
  lines.push('# 현재 수치 (자동 생성)','',
    '> 이 파일은 `node defense_test/scripts/generated-reports.mjs`가 코드에서 만든다. 직접 고치지 말고, 숫자가 이 파일과 다른 문서는 그날의 기록으로 읽는다. 코드와 다르면 테스트가 실패한다.','');
  lines.push('## 규칙','',
    '- **필살기 피해:** 필살기는 시전 순간 동료 정보에 보이는 위력(`combatStats().damage`)에 배율을 곱한다. 성급·훈련·강화·온실·수집 보너스에 더해 배치 오라, 켜져 있는 필살기 버프, 유물 위력 보너스가 모두 들어간다. 같은 종류 안에서는 가장 센 것 하나(유물은 합산)이고 종류끼리는 곱한다. 그 시전이 거는 버프·노출은 그 시전의 피해에 들어가지 않는다.',
    '- **받는 피해 증가 효과(노출, 확대경, 왕의 인장 등):** 위와 별개로 적에게 걸려 필살기와 일반 공격 모두에 적용된다.',
    `- **퍼펙트 클리어:** 코어 체력을 잃지 않고 메인 스테이지를 클리어하면 퍼펙트. 스테이지마다 첫 퍼펙트에 꿈의결정 ${PERFECT_REWARD}.`,
    `- **일반 소환 UR(${ROSTER.UR.length}명):** ${ROSTER.UR.map(id=>HEROES.find(h=>h.id===id).name).join(', ')}. 매주 월요일(UTC+9) 순서대로 픽업이 돈다.`,
    `- **이달의 수호자(히든 ${HIDDEN.length}명, 시즌 소환에서만):** ${HIDDEN.map(id=>HEROES.find(h=>h.id===id).name).join(' → ')} 순서로 월마다 한 명. 월 번호는 (연도×12+월 인덱스) % ${HIDDEN.length}이고 지금 2026년 10월은 ${HEROES.find(h=>h.id===guardianOf(2026,9)).name}, 2027년 1월은 ${HEROES.find(h=>h.id===guardianOf(2027,0)).name}.`,
    `- **소환 확률:** C/R/SR/UR = ${TUNING.heroRates.map(r=>(r*100).toFixed(1).replace(/\.0$/,'')+'%').join(' / ')}, 천장 ${TUNING.pity.normal}/${TUNING.pity.season}.`,'');
  lines.push('## 필살기 상수','',
    '| 항목 | 값 |','|---|---|',
    `| 가디언 대륙의 맥동 | 위력 ${E.QUAKE_FACTOR}배 |`,
    `| 혹한의마녀 겨울 노출 | ${E.WINTER_EXPOSURE*100}% (겨울이 이어지는 동안) |`,
    `| 은하고래 수확 | 위력 ${E.WHALE.factor}배 + 성광 중첩당 +${E.WHALE.perMark*100}% |`,
    `| 베히모스 대지분쇄 | 위력 ${E.CRUSH.factor}배 × ${E.CRUSH.hits}회, 반경 ${E.CRUSH.radius}, 간격 ${E.CRUSH.gap}초, 저장 한도 ${E.CRUSH.queue}회분 |`,
    `| 신데렐라 자정의 기적 | 위력 ${E.CINDERELLA.ult}배 |`,
    `| 루미 꿈의 형태 | ${E.RUMI_DREAM.phases.map(p=>p.factor+'배').join(' · ')} |`,'',
    '| 필살기 버프 | 위력 | 공속 | 지속 |','|---|---|---|---|',
    ...Object.entries(E.ULT_BUFF).map(([id,b])=>`| ${id} | ${b.power!==undefined?'+'+num(b.power*100)+'%':b.ratio!==undefined?'평타 반복 '+num(b.ratio*100)+'%':'-'} | ${b.speed!==undefined?'+'+num(b.speed*100)+'%':'-'} | ${b.seconds}초 |`),'');
  lines.push('## 동료','',
    '공격력·공격 주기는 1성 기준 기본값이다. 키는 HEAD_PROFILE의 키 그룹이다.','',
    '| 동료 | 등급 | 공격력 | 주기 | 방식 | 사거리 | 키 | 특성 | 필살기 | 별빛 |','|---|---|---:|---:|---|---:|---|---|---|---:|',
    ...heroes.map(h=>`| ${cell(h.name)} | ${kind(h)} | ${h.damage} | ${h.interval} | ${SHAPE[h.shape]||h.shape} | ${h.range}${h.radius?'/'+h.radius:''} | ${CLASS[h.heightGroup]||'-'} | ${cell(h.trait.text)} | **${cell(h.skill.name)}**: ${cell(h.skill.text)} | ${h.skill.cost} |`),'');
  lines.push('## 유물','',
    '| 유물 | 등급 | 효과 |','|---|---|---|',
    ...ARTIFACTS.map(a=>`| ${cell(a.name)} | ${a.rarity} | ${cell(a.text)} |`),'',
    '유물 효과 수치 원본(`RELIC_VALUES`, 레벨당 +5%가 곱해진다):','','```json',JSON.stringify(E.RELIC_VALUES),'```','');
  return lines.join('\n');
}
