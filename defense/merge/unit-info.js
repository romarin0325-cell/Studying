import {HERO} from './content.js';
import {combatStats,bestUnit,has,unitEconomy,trainingBonus,skillDuration,unitForm,harmonyStrength} from './engine.js';

export const number=n=>Number(n.toFixed(1)).toLocaleString('ko-KR');
export function inspection(s,id,selected){
  const unit=selected?.hero===id?selected:bestUnit(s,id)||{hero:id,rank:1};
  return {unit,stats:combatStats(s,unit),deployed:s.board.includes(unit)};
}
export function attackDescription(s,u,stats=combatStats(s,u)){
  const h=HERO[u.hero],n=f=>number(stats.damage*f),level=s.upgrades[u.hero]||0;
  const zone=`반경 ${h.radius} · ${has(s,'roots')?4.5:3}초 장판 · 0.5초마다 ${n(.22)} 피해`;
  const extra=has(s,'prism')?1:0;
  const burn=has(s,'ember')?1.6:1,boss=has(s,'lens')?1.3:1;
  const harmony=harmonyStrength(s,s.board.indexOf(u));
  const text={
    zeke:`전방 90° 베기 · 3초간 화상 ${n(.23*burn)}/초`,
    rumi:`폭 ${h.radius} 관통 · 같은 성급의 모든 동료와 합성 가능`,
    luna:`보스 타격 ${n(1.35*boss)} · 처형 시 일반 ${n(2)} / 보스 ${n(2.7*boss)} (체력 35% / 40% 이하)`,
    cinderella:`세 번째 공격은 ${n(1.8)} 방어 무시 피해`,
    doom:unitEconomy(s,u),
    santa:`반경 ${h.radius} 포격 · 네 번째 명중은 상하좌우 공격 대기 −${number(.6+level*.1)}초`,
    jasmine:`성광 6초 · 최대 3중첩 · 3중첩 대상 ${n(1.65)} 피해`,
    star_boy:`다섯 번째 공격은 ${n(2.2)} 피해`,
    time_magician:`폭 ${h.radius} 관통 · 세 번째 명중은 상하좌우 공격 대기 −${number(.6+level*.1)}초${unitForm(s,u)?` · 트라우마 ${Math.ceil(s.buffs.trauma)}초 · 방어 무시`:''}`,
    cherry_prince:`보스 ${n(1.25*boss)} 피해 · 화상 / 성광 3중첩: 일반 ${n(1.6)} / 보스 ${n(2*boss)}`,
    frost_witch:`폭 ${h.radius} 관통 · 2.4초간 40% 감속 · 서리 3중첩: 추가 ${n(1.2)} 피해 + ${number(.9+level*.06)}초 빙결 (보스 ${number(.45+level*.03)}초) · 중첩 6초 유지`,
    harmonious:`인접한 다른 동료 ${harmony.count}종 · 상하좌우 위력 +${number(harmony.damage*100)}% / 공속 +${number(harmony.speed*100)}% · 같은 종류는 한 번만 계산 · 조화 중복 불가`,
    aurora:`명중 약 0.66초 후 같은 적에게 반사 ${n(.75+level*.03)} 피해 · 표적이 사라지면 소멸`,
    snow_rabbit:`반경 ${h.radius} 폭발 · 2.4초간 40% 감속`,
    avalanche_maid:`반경 ${h.radius} 폭발 · 감속 중인 적에게 ${n(1.75)} 피해`,
    night_rabbit:`추가 ${1+extra}명에게 ${n(.65)} 도탄 · 도탄 거리 ${h.radius}`,
    guardian:`자신 주변 반경 ${h.range} · 세 번째 공격마다 0.7초 기절`,
    storm_sage:`폭 ${h.radius} 관통 · 주변 ${1+extra}명에게 ${n(.65)} 추가 피해`,
    lightning_sage:`추가 ${2+extra}명에게 ${n(.65)} 연쇄 · 연쇄 거리 ${h.radius}`,
    red_dragon:`반경 ${h.radius} 폭발 · 불타는 적에게 ${n(1.4)} 피해`,
    flame_sage:`${zone} · 화상 ${n(.23*burn)}/초`,
    mushroom_king:`${zone} · 독 +${u.rank+(has(s,'seed')?1:0)} · ${unitEconomy(s,u)}`,
    great_detective:`보스 타격 ${n(1.25*boss)} · 4초 노출: 일반 +${18+level*2}% / 보스 +${30+level*2}% 받는 피해`,
    siren:`반경 ${h.radius} 폭발 · 상하좌우 공속 +${22+level*3}%`,
    phantom:`${zone} · 25% 감속 · 세 번째 직격은 35만큼 밀침`,
    queen:unitEconomy(s,u),
    galaxy_whale:`${zone} · 40% 감속`,
    silver_rabbit:`폭 ${h.radius} 관통 · 명중 추가 별빛 +${number((.5+level*.1)*(s.buffs.march>0?2:1))}`,
    ancient_dragon:`폭 ${h.radius} 십자 관통 · 상하좌우 위력 +${25+level*3}%`,
    time_ruler:`${zone} · ${25+level*3}% 감속`,
  };
  return text[h.id];
}
export function skillDescription(s,id){
  const u=bestUnit(s,id);if(!u)return HERO[id].skill.text;
  const {skillPower:base}=combatStats(s,u),n=f=>number(base*f);
  const burn=has(s,'ember')?1.6:1,boss=has(s,'lens')?1.3:1;
  const descriptions={
    inferno:`전장 전체 ${n(6)} 피해 · 5초간 화상 ${n(.6*burn)}/초`,
    dragon:`전장 전체 ${n(8)} 피해 · 5초간 화상 ${n(.6*burn)}/초`,
    echo:`${skillDuration(s,8)}초 동안 모든 동료가 65% 위력의 추가 공격`,
    haste:`${skillDuration(s,8)}초 동안 모든 동료 공격속도 +65%`,
    awaken:`${skillDuration(s,10)}초 동안 모든 동료 타격 위력 +70%`,
    march:`${skillDuration(s,6)}초 동안 모든 동료 공격속도 +40% · 은토끼 추가 별빛 2배`,
    glassfall:`전장 전체 ${n(8)} 방어 무시 피해`,
    gift:`무작위 동료 1명 2성 합류 · ${skillDuration(s,6)}초 동안 전체 공속 +30%`,
    goddess:`전장 전체 ${n(5)} 피해 · 성광 3중첩 · ${skillDuration(s,8)}초 동안 전체 위력 +35%`,
    trauma:`전장 전체 ${n(4)} 피해 · ${skillDuration(s,10)}초 트라우마 변신: 타격 위력 +110% · 공속 +35% · 일반 공격 방어 무시`,
    starfall:`최대 체력 1위 한 명 · 1.2초 후 ${n(32*(has(s,'royal_seal')?1.25:1))} 피해 · 시전 시 표적 고정`,
    royal:`최대 체력 1위 한 명 · 1.05초 후 방어 무시: 일반 ${n(34*(has(s,'royal_seal')?1.25:1))} / 보스 ${n(42.5*boss*(has(s,'royal_seal')?1.25:1))} · 화상 / 성광 3중첩이면 +40%`,
    ice_court:`전장 전체 ${n(5)} 피해 · 서리 2중첩 (6초) · 6초간 50% 감속`,
    harmony:`전체 공격 대기 −1.5초 · ${skillDuration(s,8)}초 동안 모든 하모니어스의 조화 지원 2배`,
    mirror:`최대 체력 1위 한 명을 3초 고정 · ${n(10)} + 그동안 받은 피해의 45% (추가 최대 ${n(18)}) · 반사 타격도 방어·피해 증감 적용`,
    freeze:`전장 전체 ${n(2)} 피해 · 3초 기절 · 6초간 50% 감속`,
    avalanche:`전장 전체 ${n(6)} 피해 (기절 중 ${n(12)}) · 4초간 50% 감속`,
    combust:`전장 전체 ${n(4)} 피해 (화상 중 ${n(10)}) · 6초간 화상 ${n(.65*burn)}/초`,
    plague:`전장 전체 ${n(3)} 방어 무시 피해 · 독 +${u.rank*8+(has(s,'seed')?1:0)} · 12초 지속`,
    expose:`전장 전체를 10초간 노출 (+60% 받는 피해) 후 ${n(3)} 타격`,
    quake:`전장 전체 ${n(5)} 피해 · 160만큼 밀침 · 2초 기절`,
    nightmare:`전장 전체 ${n(4)} 피해 · 220만큼 밀침 · 6초 노출 (+25% 받는 피해)`,
    rewind:`전장 전체 ${n(3)} 피해 · 기본 이동 6초분 되감기 · 2초 기절`,
    vortex:`전장 전체를 한곳으로 끌어당겨 ${n(5)} 피해 · 1.5초 기절 · 4초간 60% 감속`,
    singularity:`전장 전체를 한곳으로 끌어당겨 ${n(10)} 피해 · 2초 기절 · 4초간 60% 감속`,
    execute:`보스 우선 최대 5명 · 방어 무시: 일반 ${n(16)} / 보스 ${n(21.6*boss)} · 처형 시 ${n(30)} / ${n(40.5*boss)}`,
    flurry:`선두 최대 9명에게 각각 ${n(14)} 피해`,
    thunder:`전장 전체 ${n(7)} 피해 · 1.2초 기절`,
    fortune:`전장 전체 ${n(3)} 피해 · 즉시 +25 G`,
    dividend:`전장 전체 ${n(3)} 피해 · 즉시 +30 G`,
  };
  return descriptions[HERO[id].skill.type];
}
export function trainingPreview(s,id){
  const {unit,stats,deployed}=inspection(s,id),level=s.upgrades[id]||0;
  const next=level<5?combatStats({...s,upgrades:{...s.upgrades,[id]:level+1}},unit,s.board.indexOf(unit)):null;
  return {rank:unit.rank,deployed,damage:stats.damage,nextDamage:next?.damage,
    bonus: ['doom','queen','mushroom_king'].includes(id)?unitEconomy(s,unit):trainingBonus(id,level),
    nextBonus:next?(['doom','queen','mushroom_king'].includes(id)?unitEconomy({...s,upgrades:{...s.upgrades,[id]:level+1}},unit):trainingBonus(id,level+1)):''};
}
