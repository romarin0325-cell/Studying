import { drawKind, usesRepeatDraws } from '../engine/awakenings.js';
import { GRADE } from '../engine/roster.js';
import { TERMS } from './glossary.js';

export const SPRING_PICK_TITLE = '후보 3칸 중 하나 선택';
export const SPRING_EMPTY_POOL = '더 이상 깨울 수 있는 동료가 없습니다.';
export const springPickPrice = cost => '보기 무료 · 선택할 때 결정 ' + cost + '개';

export function describeSpringCandidates(run, offer, card) {
  const repeat = usesRepeatDraws(run) && !offer.alreadyPaid;
  return offer.slots.map(slot => {
    const name = card(slot.id).name;
    const kind = repeat ? drawKind(run, slot.id) : 'join';
    return {
      ...slot, name, kind, short: TERMS[kind].short, detail: TERMS[kind].firstUse,
      tag: slot.source === 'invite' ? '초대 확정 · ' + name : '무작위'
    };
  });
}

const percent = multiplier => '+' + Math.round(multiplier * 100) + '%';

export function describeAltarRoll(run, roll, card, previous = run.blessings[roll.id] ?? 0) {
  const fighter = card(roll.id);
  return {
    name: fighter.name,
    previous: '기존 축복 ' + percent(previous),
    next: '새 축복 ' + percent(roll.multiplier),
    effect: (roll.jackpot ? '대성공! · ' : '') + (GRADE[fighter.grade] || '') + ' · 모든 능력치 상승'
  };
}
