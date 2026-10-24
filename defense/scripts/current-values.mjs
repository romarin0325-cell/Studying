// docs/CURRENT_VALUES.md: every companion, relic and ultimate constant as the code has it today.
// Generated with the other reports (node defense/scripts/generated-reports.mjs) and checked by --check and the unit
// tests, so the numbers cannot drift from the game. The other docs are dated records of the day they were written;
// when one of their numbers disagrees with this file, this file is right.
import {HEROES,ARTIFACTS,ROSTER,HIDDEN,TUNING,MAIN_STAGES,PART_STAGES,PARTS} from '../src/content.js';
import * as E from '../src/combat/engine.js';
import {relicThreshold,relicRates,PERFECT_REWARD,guardianOf,critChance,critDamage,stardustRate,bedCost,GARDENS,roseAttack,springGauge,seedGold,heroPool} from '../src/economy.js';

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
    '> 이 파일은 `node defense/scripts/generated-reports.mjs`가 코드에서 만든다. 직접 고치지 말고, 숫자가 이 파일과 다른 문서는 그날의 기록으로 읽는다. 코드와 다르면 테스트가 실패한다.','');
  lines.push('## 규칙','',
    '- **필살기 피해:** 필살기는 시전 순간 동료 정보에 보이는 위력(`combatStats().damage`)에 배율을 곱한다. 성급·훈련·강화·온실·수집 보너스에 더해 배치 오라, 켜져 있는 필살기 버프, 유물 위력 보너스가 모두 들어간다. 같은 종류 안에서는 가장 센 것 하나(유물은 합산)이고 종류끼리는 곱한다. 그 시전이 거는 버프·노출은 그 시전의 피해에 들어가지 않는다.',
    '- **받는 피해 증가 효과(노출, 확대경, 왕의 인장 등):** 위와 별개로 적에게 걸려 필살기와 일반 공격 모두에 적용된다.',
    `- **메인 스테이지:** ${MAIN_STAGES}개. ${PARTS.map(x=>`제${x.id}부 「${x.name}」`).join(', ')} 각 ${PART_STAGES}개(5개 장 × 9). 적 체력은 두 부 모두 같은 기울기로 이어진다. 제2부는 스테이지 ${PART_STAGES}를 클리어하면 열린다.`,
    `- **스테이지 ${PART_STAGES} 첫 클리어:** 제2부와 새벽 온실이 열리고 베히모스·베놈 등 신규 동료가 정규 소환 풀에 합류한다. 동료를 확정 지급하지 않으며 기존 보유 개체는 유지한다.`,
    `- **퍼펙트 클리어:** 코어 체력을 잃지 않고 메인 스테이지를 클리어하면 퍼펙트. 스테이지마다 첫 퍼펙트에 꿈의결정 ${PERFECT_REWARD}.`,
    `- **일반 소환 UR(${ROSTER.UR.length}명):** ${ROSTER.UR.map(id=>HEROES.find(h=>h.id===id).name).join(', ')}. 픽업은 초기 정규 UR ${heroPool('UR',false).length}명을 매주 월요일(UTC+9) 순서대로 순환한다. 베놈·베히모스는45클리어 후 일반 풀에 합류한다.`,
    `- **이달의 수호자(히든 ${HIDDEN.length}명, 시즌 소환에서만):** ${HIDDEN.map(id=>HEROES.find(h=>h.id===id).name).join(' → ')} 순서로 월마다 한 명. 월 번호는 (연도×12+월 인덱스) % ${HIDDEN.length}이고 지금 2026년 10월은 ${HEROES.find(h=>h.id===guardianOf(2026,9)).name}, 2027년 1월은 ${HEROES.find(h=>h.id===guardianOf(2027,0)).name}.`,
    `- **소환 확률:** C/R/SR/UR = ${TUNING.heroRates.map(r=>(r*100).toFixed(1).replace(/\.0$/,'')+'%').join(' / ')}, 천장 ${TUNING.pity.normal}/${TUNING.pity.season}.`,'');
  const bedRows=GARDENS.flatMap(g=>g.beds.map(id=>{const b=TUNING.beds[id],cap=b.knee2,name={rose:'용기의 장미',spring:'별이슬 샘',seed:'황금 씨앗',crit:'여명의 엉겅퀴',critDamage:'노을빛 불꽃나리',stardust:'유성우 은방울'}[id];
    const effect={rose:['위력',l=>'+'+num(roseAttack(l)*100)+'%'],spring:['최대 별빛',l=>String(springGauge(l))],seed:['시작 골드',l=>'+'+seedGold(l)],crit:['치명타 확률',l=>num(critChance(l)*100)+'%'],critDamage:['치명타 대미지',l=>num(critDamage(l)*100)+'%'],stardust:['별똥별 가속(방치·파견 별가루)',l=>'+'+num(stardustRate(l)*100)+'%']}[id];
    const total=Array.from({length:cap},(_,l)=>bedCost(id,l)).reduce((a,c)=>a+c,0);
    return `| ${g.id==='dream'?'꿈의 온실':'새벽 온실'} | ${name} | 스테이지 ${b.unlock} | ${effect[0]} | ${effect[1](0)} | ${effect[1](cap)} (레벨 ${cap}) | ${bedCost(id,0)} | ${total} |`;}));
  lines.push('## 정원','',
    `두 정원에 화단이 셋씩 있다. 기본 치명타는 확률 5%, 대미지 150%다. 여명의 엉겅퀴는 레벨당 +0.5%p로 30레벨에서 20%가 된다. 여기까지 비용은 이전38레벨 예산을30구간으로 재배분한다. 이후 ${TUNING.beds.crit.priceTransition}개 가격 구간을 로그 가격의 완만한 보간으로 이어 역전을 없애고, 레벨${TUNING.beds.crit.knee2+TUNING.beds.crit.priceTransition-1}부터 이전 대응 구간 비용의 절반과 일치한다. 효과는 계속 +0.5%p, 기존 투자 레벨은 보존한다. 치명타는 직접 타격·지속 피해·필살기 모두에 적용되며 즉사와 고정 피해는 제외한다. 공격 당시의 치명타 확률과 대미지를 저장한다. 별똥별 가속은 방치 보상과 파견 보상을 받는 순간에 곱한다.`,'',
    '| 정원 | 화단 | 열리는 곳 | 효과 | 시작 | 소프트캡 | 첫 레벨 별가루 | 소프트캡까지 합계 |','|---|---|---|---|---|---|---:|---:|',
    ...bedRows,'');
  lines.push('## 필살기 상수','',
    '| 항목 | 값 |','|---|---|',
    `| 가디언 대륙의 맥동 | 위력 ${E.QUAKE_FACTOR}배 |`,
    `| 혹한의마녀 겨울 노출 | ${E.WINTER_EXPOSURE*100}% (겨울이 이어지는 동안) |`,
    `| 은하고래 수확 | 위력 ${E.WHALE.factor}배 + 성광 중첩당 +${E.WHALE.perMark*100}% |`,
    `| 베히모스 대지분쇄 | 위력 ${E.CRUSH.factor}배 × ${E.CRUSH.hits}회, 기본 반경 ${E.CRUSH.radius}, 훈련마다 기본 반경 +${E.CRUSH.trainingRadius*100}%, 간격 ${E.CRUSH.gap}초, 저장 한도 ${E.CRUSH.queue}회분 |`,
    `| 애쉬 아마겟돈 | 위력 ${E.ARMAGEDDON.factor}배, 반경 ${E.ARMAGEDDON.radius} |`,
    `| 마왕 데스핸드 | 위력 ${E.DEATHHAND.base}배 + 대상별 디버프 1종당 ${E.DEATHHAND.perDebuff}배, 반경 ${E.DEATHHAND.radius}. 감속·노출·기절·빙결·성광·중독·화상 7종, 소모 없음 |`,
    '| 기적의우화 | 별빛 50, 전장의 라바·코쿤 전부를 각각 50%/50%로 미라클윙/어비스윙으로 전환. 합성 결과는 코쿤. 대상이 없으면 사용 불가 |',
    `| 신데렐라 자정의 기적 | 위력 ${E.CINDERELLA.ult}배 |`,
    `| 화상 | 일반 공격 위력 ${num(E.BURN.attack*100)}% · ${E.BURN.attackSeconds}초, 필살기 위력 ${num(E.BURN.skill*100)}% · ${E.BURN.skillSeconds}초 (초당) |`,
    `| 시간의마술사 트라우마 | 위력 +${num(E.TRAUMA.power*100)}% · 공속 +${num(E.TRAUMA.speed*100)}% |`,
    `| 루미 꿈의 형태 | ${E.RUMI_DREAM.phases.map(p=>p.factor+'배').join(' · ')} |`,'',
    '| 필살기 버프 | 위력 | 공속 | 지속 |','|---|---|---|---|',
    ...Object.entries(E.ULT_BUFF).map(([id,b])=>`| ${id} | ${b.power!==undefined?'+'+num(b.power*100)+'%':b.ratio!==undefined?'평타 반복 '+num(b.ratio*100)+'%':'-'} | ${b.speed!==undefined?'+'+num(b.speed*100)+'%':'-'} | ${b.seconds}초 |`),'');
  lines.push('## 이번 성장 규칙','',
    '성급 보너스는 1성을 기준으로 `1 + 0.1 × (성급 - 1)`이다. 강화 5단계마다의 기존 특수 배율과는 곱하며, 감속률의 공통 상한은 80%다.','',
    '| 동료 | 현재 성장 |','|---|---|',
    `| 눈토끼 훈련 | 기본 ${E.SNOW_RABBIT.slow*100}%에서 훈련마다 +${E.SNOW_RABBIT.trainingSlow*100}%p. 0~5회는 ${Array.from({length:6},(_,level)=>num((E.SNOW_RABBIT.slow+level*E.SNOW_RABBIT.trainingSlow)*100)+'%').join(' / ')} (1성·강화 없음) |`,
    `| 눈토끼 필살기 | 빙결 ${E.SNOW_RABBIT.freeze}초와 감속 ${E.SNOW_RABBIT.skillSlow*100}%가 성급당 +10%. 감속 지속은 ${E.SNOW_RABBIT.seconds}초 유지 |`,
    '| 폭풍의현자 | 즉사율 1% + (성급 - 1) × 0.1%p + 강화 5단계 횟수 × 0.1%p. 훈련은 즉사율을 늘리지 않음 |',
    `| 혹한의마녀 필살기 | 감속 ${E.WINTER_COURT.slow*100}%와 겨울 ${E.WINTER_COURT.seconds}초가 성급당 +10%. 감속·노출·겨울 종료는 동일. 처치 시 후속 빙결 ${E.WINTER_COURT.killFreeze}초 고정 |`,
    `| 베히모스 훈련 | 반경 ${Array.from({length:6},(_,level)=>num(E.CRUSH.radius*(1+level*E.CRUSH.trainingRadius))).join(' / ')}. 시전 순간 값이 충격 3회와 저장에 유지됨 |`,'');
  lines.push('## 동료','',
    '공격력·공격 주기는 1성 기준 기본값이다. 키는 HEAD_PROFILE의 키 그룹이다.','',
    '| 동료 | 등급 | 공격력 | 주기 | 방식 | 사거리 | 키 | 특성 | 필살기 | 별빛 |','|---|---|---:|---:|---|---:|---|---|---|---:|',
    ...heroes.map(h=>`| ${cell(h.name)} | ${kind(h)} | ${h.damage} | ${h.interval} | ${SHAPE[h.shape]||h.shape} | ${h.range}${h.radius?'/'+h.radius:''} | ${CLASS[h.heightGroup]||'-'} | ${cell(h.trait.text)} | **${cell(h.skill.name)}**: ${cell(h.skill.text)} | ${h.skill.cost} |`),'');
  lines.push('## 미라클 개체의 형태','',
    '네 형태는 슈퍼레어 미라클라바 한 수집 슬롯을 공유한다. 소환은 라바, 같은 성급의 형태 간 합성·루미 합성은 코쿤이다. 성급·훈련·강화는 공통이며 형태는 개체마다 저장한다. 미라클윙의 오라는 자신을 제외한 상하좌우에 적용하고 같은 종류는 가장 큰 값 하나만 쓴다. 1성 +20%p에 성급 지원 배율과 강화 특수 배율을 적용한다.','',
    '| 형태 | 공격력 | 주기 | 공격 | 사거리/반경 | 특성 |','|---|---:|---:|---|---|---|',
    ...Object.values(E.MIRACLE_FORMS).map(h=>`| ${cell(h.name)} | ${h.damage} | ${h.interval} | ${SHAPE[h.shape]} | ${h.range}/${h.radius} | ${cell(h.trait.text)} |`),'');
  lines.push('## 유물','',
    '| 유물 | 등급 | 효과 |','|---|---|---|',
    ...ARTIFACTS.map(a=>`| ${cell(a.name)} | ${a.rarity} | ${cell(a.text)} |`),'',
    '유물 효과 수치 원본(`RELIC_VALUES`, 레벨당 +5%가 곱해진다):','','```json',JSON.stringify(E.RELIC_VALUES),'```','',
    `유물 소환 단계: 누적 소환 횟수가 경계에 닿으면 다음 1회부터 오른다 (1회 ${TUNING.relicDrawCost} 꿈의결정).`,'','| 단계 | 누적 소환 | C / R / SR / UR |','|---|---|---|',
    ...Array.from({length:13},(_,t)=>`| ${t} | ${relicThreshold(t)} | ${relicRates(relicThreshold(t)).map(x=>(x*100).toFixed(2)+'%').join(' / ')} |`),'');
  return lines.join('\n');
}
