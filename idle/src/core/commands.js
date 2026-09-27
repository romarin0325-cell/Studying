import {HERO,COMPANION,ARTIFACTS,balance,STYLES} from '../data/catalog.js';
import {clone,requireThat} from './rng.js';
import {totalStage} from './state.js';
import {settleAccrual,logicalNow,refreshRates} from './clock.js';
import {resolveCalendar,daily} from '../systems/seasons.js';
import {purchaseLevels,upgradeGear,buyNode} from '../systems/growth.js';
import {claimAccrual,collectButterfly,collectLetter,research} from '../systems/rewards.js';
import {resolveSummon,exchange} from '../systems/gacha.js';
import {beginGate,answerGate} from '../systems/learning.js';
import {applyBattleResult} from '../systems/expeditions.js';
import {startAdventure,chooseEvent,adventureResult} from '../systems/adventure.js';
import {readScene,homeLine} from '../systems/bond.js';

export function reduce(current,command,context={now:Date.now()}){
 requireThat(typeof command.id==='string'&&command.id.length<=150,'명령 ID가 필요합니다.');
 if(current.commands.includes(command.id))return {state:current,result:{duplicate:true}};
 requireThat(command.expectedRevision===current.revision,'REVISION_CONFLICT');
 const s=clone(current),now=logicalNow(s,context.now),c=command;
 settleAccrual(s,now);resolveCalendar(s,now);
 let result=null;const hero=()=>{requireThat(HERO[c.heroId],'영웅을 확인해 주세요.');return s.heroes[c.heroId];};
 switch(c.type){
 case 'tick':break;
 case 'homeLine':{const line=homeLine(s,now,c.recentType);s.ui.lastHomeLines=[...s.ui.lastHomeLines.filter(id=>id!==line.id),line.id].slice(-14);result=line;break;}
 case 'tutorial':requireThat(!s.ui.tutorialDone,'안내를 이미 마쳤어요.');s.ui.tutorialDone=true;daily(s,'claim',now);daily(s,'maintain',now);break;
 case 'claim':result=claimAccrual(s,c.id,now);break;
 case 'maintain':daily(s,'maintain',now);break;
 case 'level':hero();result=purchaseLevels(s,c.heroId,c.count);daily(s,'maintain',now);break;
 case 'levelAll':{
  requireThat(Number.isInteger(c.count)&&c.count>0&&c.count<=5,'일괄 훈련 수량을 확인해 주세요.');result=[];
  for(const id of Object.keys(s.heroes)){try{result.push({heroId:id,...purchaseLevels(s,id,c.count)});}catch(error){if(!error.message.includes('자원'))throw error;}}
  requireThat(result.length,'훈련할 자원이 부족합니다.');daily(s,'maintain',now);break;
 }
 case 'gear':hero();result=upgradeGear(s,c.heroId,c.slot,c.count);daily(s,'maintain',now);break;
 case 'mastery':hero();result=buyNode(s,c.heroId);daily(s,'maintain',now);break;
 case 'style':{const h=hero();requireThat(h.nodes>=2&&[0,1].includes(c.value),'스타일은 숙련 2에서 열립니다.');h.style=c.value;break;}
 case 'gearChoice':{const h=hero();requireThat(['weapon','armor','accessory'].includes(c.slot)&&h.gear[c.slot]>=5&&[0,1].includes(c.value),'장비 효과는 강화 5에서 열립니다.');h.gearChoices[c.slot]=c.value;break;}
 case 'tactics':{const h=hero();requireThat(['standard','survival','burst'].includes(c.tactics.preset)&&typeof c.tactics.hold==='boolean','전술을 확인해 주세요.');const order=c.tactics.order||[];requireThat(new Set(order).size===order.length&&order.every(id=>HERO[c.heroId].skills.some(sk=>sk.id===id)),'기술 순서를 확인해 주세요.');h.tactics=clone(c.tactics);break;}
 case 'assign':{const h=hero();requireThat([0,1].includes(c.slot)&&(c.slot===0||totalStage(s)>=15),'두 번째 슬롯은 원정 합계 15에서 열립니다.');requireThat(c.companionId===null||s.companions[c.companionId]?.owned,'보유 동료를 선택해 주세요.');const prior=h.companions[c.slot];if(c.companionId)for(const other of Object.values(s.heroes))for(let i=0;i<2;i++)if(other.companions[i]===c.companionId)other.companions[i]=prior;h.companions[c.slot]=c.companionId;break;}
 case 'rank':{const member=s.companions[c.companionId];requireThat(member?.owned&&member.rank<5,'강화 가능한 동료가 아닙니다.');const cost=balance.summon.companion.rankCosts[member.rank];requireThat(s.wallets.bondTokens>=cost,'인연토큰이 부족합니다.');s.wallets.bondTokens-=cost;member.rank++;break;}
 case 'artifact':{const a=ARTIFACTS.find(x=>x.id===c.artifactId);requireThat(a&&totalStage(s)>=30,'유물 제작은 원정 합계 30에서 열립니다.');const rank=s.artifacts[a.id],cost=rank===0?12:[20,35,55,80][rank-1];requireThat(rank<5&&(s.bossTraces[a.bossId]||0)>=cost,'보스 흔적이 부족하거나 완성된 유물입니다.');s.bossTraces[a.bossId]-=cost;s.artifacts[a.id]++;break;}
 case 'equipArtifact':{const h=hero();requireThat(c.artifactId===null||s.artifacts[c.artifactId]>0,'보유한 유물을 선택해 주세요.');const prior=h.artifact;if(c.artifactId)for(const other of Object.values(s.heroes))if(other.artifact===c.artifactId)other.artifact=prior;h.artifact=c.artifactId;break;}
 case 'research':result=research(s,c.bossId);break;
 case 'traceDecor':{const a=ARTIFACTS.find(x=>x.bossId===c.bossId);requireThat(a&&s.artifacts[a.id]===5&&(s.bossTraces[c.bossId]||0)>=20,'완성 유물의 흔적 20개가 필요합니다.');s.bossTraces[c.bossId]-=20;s.wallets.decorTokens++;break;}
 case 'savePreset':{const h=hero();requireThat(['expedition','boss','adventure'].includes(c.slot),'프리셋 종류를 확인해 주세요.');h.presets[c.slot]=clone({companions:h.companions,artifact:h.artifact,tactics:h.tactics,style:h.style,gearChoices:h.gearChoices});break;}
 case 'loadPreset':{const h=hero(),p=h.presets[c.slot];requireThat(p,'저장한 프리셋이 없습니다.');for(const other of Object.values(s.heroes))if(other!==h){other.companions=other.companions.map(id=>p.companions.includes(id)?null:id);if(other.artifact===p.artifact)other.artifact=null;}Object.assign(h,clone(p));break;}
 case 'summon':result=resolveSummon(s,c.pool,c.count,c.id);break;
 case 'reveal':{const b=s.gacha.batches.find(x=>x.id===c.batchId);requireThat(b,'소환 결과가 없습니다.');b.revealed=true;break;}
 case 'exchange':exchange(s,c.pool,c.itemId,c.method);break;
 case 'selectorTokens':requireThat(c.pool==='companion'&&Object.values(s.companions).every(x=>x.owned)&&s.wallets.companionSelectors>0,'동료 전체 보유 후 사용할 수 있습니다.');s.wallets.companionSelectors--;s.wallets.bondTokens+=120;break;
 case 'interact':{const h=hero();requireThat(s.calendar.interactionCharges>0,'교류 횟수가 없습니다.');s.calendar.interactionCharges--;h.bond+=12;break;}
 case 'gift':{const h=hero();requireThat(s.wallets.gifts>0,'보관 중인 선물이 없습니다.');s.wallets.gifts--;h.bond+=4;break;}
 case 'scene':result=readScene(s,c.sceneId,!!c.skip);break;
 case 'butterfly':result=collectButterfly(s,now);break;
 case 'letter':result=collectLetter(s,now);break;
 case 'gate':result=beginGate(s,c.gate,now,c.batchId);break;
 case 'lecture':{const q=s.gates.challenge;requireThat(q&&q.id===c.challengeId&&q.question.lecture,'연결된 강의가 없습니다.');q.lectureRead=true;if(!s.learning.readLectures.includes(q.question.lecture.id))s.learning.readLectures.push(q.question.lecture.id);break;}
 case 'answer':result=answerGate(s,c.challengeId,c.answer,now);break;
 case 'battle':result=applyBattleResult(s,c.result,now);break;
 case 'adventureStart':hero();result=startAdventure(s,c.heroId);break;
 case 'adventureEvent':result=chooseEvent(s,c.choice);break;
 case 'adventureBattle':result=adventureResult(s,c.result);break;
 case 'adventureRelic':requireThat(s.adventure?.offer.includes(c.itemId),'제시된 유물을 선택해 주세요.');s.adventure.items.push(c.itemId);s.adventure.offer=[];break;
 case 'adventureAbandon':requireThat(s.adventure,'진행 중인 모험이 없습니다.');s.adventure.failed=true;break;
 case 'buyDecor':{const cost={frame:6,desk:12,album:18}[c.itemId];requireThat(cost&&s.wallets.adventureBadges>=cost&&!s.decor.includes(c.itemId),'장식 구매 조건을 확인해 주세요.');s.wallets.adventureBadges-=cost;s.decor.push(c.itemId);break;}
 case 'pinMemory':requireThat(typeof c.itemId==='string','기억을 선택해 주세요.');s.gacha.pinned=c.itemId;break;
 case 'homeArt':requireThat(c.itemId===null||s.memories.includes(c.itemId),'보유 기억만 홈에 표시할 수 있습니다.');s.ui.homeArt=c.itemId;break;
 case 'settings':for(const [key,value]of Object.entries(c.values)){requireThat(['hero','reducedMotion','volume','muted','vibration','textScale','tutorialDone'].includes(key),'알 수 없는 설정입니다.');if(key==='hero')requireThat(HERO[value],'대표 영웅을 확인해 주세요.');if(['reducedMotion','muted','vibration','tutorialDone'].includes(key))requireThat(typeof value==='boolean','설정 값을 확인해 주세요.');if(key==='volume')requireThat(Number.isFinite(value)&&value>=0&&value<=1,'음량 범위를 확인해 주세요.');if(key==='textScale')requireThat(Number.isFinite(value)&&value>=.9&&value<=1.3,'글자 크기를 확인해 주세요.');s.ui[key]=value;}break;
 case 'resetClock':s.clockOffsetMs=s.lastTrustedLogicalMs-context.now;s.diagnostics.clockWarning=false;break;
 default:throw Error('Unknown command: '+c.type);
 }
 refreshRates(s);s.revision++;s.commands.push(c.id);s.commands=s.commands.slice(-256);return {state:s,result};
}
