import { BLESS, replacementCount, usesRepeatDraws } from '../engine/awakenings.js';
import { joinCount } from '../engine/rooms.js';
import { relicEffect } from './relics.js';
import { josa } from './text.js';

const NEXT = '다음 전투 한 번';
const STAYS = '이번 원정 끝까지';
const BET = {
  empty_sky: '필드 효과 없이 승리',
  delayed_on_time: '예약 공격을 정시에 발동하고 승리',
  same_grade_full: '같은 등급 셋으로 출전해 승리'
};

export function eventEffectText(effect, { card, artifacts, core, room }, target) {
  const name = id => card(id).name;
  switch (effect.type) {
    case 'join':
      return STAYS + ' · ' + (effect.random ? '무작위 동료 1명' : effect.ids.map(name).join(' · ')) + ' 합류';
    case 'release':
      return (target ? name(target) : '동료 1명') + ' 이탈 · 축복·유품 소멸 · 등급에 따라 결정 획득';
    case 'bless': {
      const amount = effect.multiplier === 'grade' ? (target ? BLESS[card(target).grade] : null) : effect.multiplier;
      return STAYS + ' · ' + (effect.all ? '모든 동료' : target ? name(target) : '동료 1명') +
        (amount ? ' 능력치 +' + Math.round(amount * 100) + '%' : ' 등급별 축복');
    }
    case 'altar':
      return '무작위 동료 1명 축복 · 최대 3회 굴리기';
    case 'relic': {
      const relic = artifacts.get(effect.id === 'offered' ? room.relic : effect.id);
      return (effect.temporary ? NEXT : STAYS) + ' · ' + (relic?.name || '유물 품절');
    }
    case 'field':
      return NEXT + ' · 시작 필드: ' + effect.ids.map(id => core.BUFF_NAMES[id] || id).join(' · ');
    case 'start':
      return NEXT + ' · 적 ' + Object.entries(effect.enemyDebuffs).map(([id, stacks]) =>
        (core.BUFF_NAMES[id] || id) + ' +' + stacks).join(' · ');
    case 'bet': {
      const condition = effect.kind === 'kill_on_turn' ? effect.turn + '턴에 적 하나 처치 후 승리' : BET[effect.kind];
      const prize = effect.reward.crystals ? '결정 +' + effect.reward.crystals : artifacts.get(effect.reward.relic)?.name;
      return (effect.kind === 'kill_on_turn' ? '다음 전투 ' : NEXT + ' · ') + condition + ' → ' + prize + ' · 실패 시 보상 없음';
    }
    case 'crystals':
      return '결정 +' + effect.amount;
    case 'heirloom':
      return STAYS + ' · ' + (target ? name(target) + '에게 ' : '') + '유품 ' + effect.name;
  }
}

export function eventReleaseCount(run, choice) {
  if (usesRepeatDraws(run) && choice.ops.some(op => op.type === 'join' && op.random)) return 0;
  return choice.requiredReleases ?? replacementCount(run, joinCount(choice.ops));
}

export function describeEventOffer(run, choice, context) {
  const { card, artifacts, core, room } = context;
  const promise = choice.ops.find(effect => effect.type === 'promise')?.offer;
  const relic = artifacts.get(promise?.relic);
  const effects = choice.ops.map(effect => eventEffectText(effect, context)).filter(Boolean);
  if (room.event.id === 'penguin_ice_seam' && choice.id === 'carry' && !choice.text.includes('물 동료 없음') &&
    !run.bench.some(id => core.GameUtils.cardMatchesElement(card(id), 'water'))) effects.push('물 동료 없음');

  const price = choice.cost ? '◆' + choice.cost : '무료';
  const crystalGain = !choice.cost && choice.ops.find(op => op.type === 'crystals');
  const heirloom = choice.ops.find(op => op.type === 'heirloom');
  const shortfall = (choice.cost || 0) - run.crystals;
  const unmet = shortfall > 0 ? '결정 ' + shortfall + '개 부족'
    : choice.targets?.length === 0 ? '선택할 동료 없음' : '지금은 선택할 수 없음';
  const releases = eventReleaseCount(run, choice);
  return {
    name: relic ? josa(price, '을/를') + ' 맡기면 ' + promise.floor + '층에서 ' + relic.name + ' 인수' : choice.text,
    detail: relic ? relic.name + ' · ' + relicEffect(relic) : [price, ...effects].join(' · '),
    shortName: relic?.name ?? heirloom?.name ?? choice.text.split(' · ')[0],
    compactPrice: crystalGain ? eventEffectText(crystalGain, context) : price,
    condition: choice.enabled ? '' : '조건 · ' + unmet,
    releaseNote: releases ? '보낼 동료 ' + releases + '명 필요' : '',
    promiseRelic: relic?.id
  };
}
