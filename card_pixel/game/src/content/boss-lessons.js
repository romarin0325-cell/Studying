export const LESSON_VERSION = 1;
export const LESSON_TURN = 2;
export const LESSON_USES = 1;
export const LESSON_SALT = 0x1ee50b55;

const attack = (name, type, val, rule, extra = {}) => ({ name, type, val, rule, ...extra });
const physical = { name: '일반 공격', type: 'phy', val: 1 };
const charge = { name: '충전', type: 'sup', val: 0, rule: 'charge', isChargeStart: true };
const cleanse = { name: '정화', type: 'sup', val: 0, rule: 'cleanse' };
const protocol = { ...physical, rule: 'defense_protocol' };
const alternating = { ...physical, rule: 'alternating_defense' };

// A few fragile encounters need enough armor to reach the lesson. Room HP and enemy counts stay the same.
const lessons = {
  iris_curse: {
    2: { steps: [null, attack('아포칼립스 예행', 'phy', 1.5, 'front_hit')] },
    6: { steps: [null, attack('아포칼립스 예행', 'phy', 2, 'front_hit')] }
  },
  iris_love: {
    2: { armor: { wild_night_bat: 1.9, wild_wraith: 1.4 }, steps: [null, attack('소울드레인 예행', 'mag', 0, 'mana_drain', { drainFlat: 12 })] },
    6: { steps: [null, attack('소울드레인 예행', 'mag', 0, 'mana_drain', { drainFlat: 24 })] }
  },
  pharaoh: {
    2: { steps: [null, attack('고대의저주 예행', 'mag', 0.7, 'retaliation', { hitPower: 1.6 })] },
    6: { steps: [null, attack('고대의저주 예행', 'mag', 0.9, 'retaliation', { hitPower: 2.1 })] }
  },
  poseidon: {
    2: { startDebuffs: { corrosion: 1 }, steps: [null, cleanse] },
    6: { startDebuffs: { corrosion: 1, curse: 1 }, steps: [null, cleanse] }
  },
  ares: {
    2: { variants: ['phy'], steps: [charge, attack('충전 일격', 'variant', 1.6, 'charged_hit', { chargeReset: true })] },
    6: { variants: ['phy', 'mag'], steps: [charge, attack('충전 일격', 'variant', 2.2, 'charged_hit', { chargeReset: true })] }
  },
  creator_god: {
    2: { tideAfter: { name: '잔물결', type: 'phy', val: 0.75 }, steps: [physical, attack('저지먼트 예행', 'mag', 1.5, 'magic_followup')] },
    6: { tideAfter: { name: '잔물결', type: 'phy', val: 0.75 }, steps: [physical, attack('저지먼트 예행', 'mag', 2, 'magic_followup')] }
  },
  artificial_demon_god: {
    2: { steps: [{ ...protocol, bonus: 0.2 }, null] },
    6: { armor: { all: 1.09 }, steps: [{ ...protocol, bonus: 0.35 }, null] }
  },
  gray: {
    2: { variants: ['phy', 'mag'], steps: [null, attack('절단', 'variant', 1.25, 'cleave')] },
    6: { variants: ['phy', 'mag'], steps: [null, attack('절단', 'variant', 1.75, 'cleave')] }
  },
  flora: {
    2: { steps: [null, { name: '꽃의 보호', type: 'sup', val: 0, rule: 'lesson_guard', reduction: 0.25 }] },
    6: { steps: [null, { name: '꽃의 보호', type: 'sup', val: 0, rule: 'lesson_guard', reduction: 0.5 }] }
  },
  demon_god: {
    2: { steps: [{ ...alternating, stat: 'mdef', bonus: 0.2 }, { ...alternating, stat: 'def', bonus: 0.2 }] },
    6: { steps: [{ ...alternating, stat: 'mdef', bonus: 0.35 }, { ...alternating, stat: 'def', bonus: 0.35 }] }
  },
  thor: {
    2: { steps: [null, attack('썬더러쉬 예행', 'mag', 1, 'swap_stats')] },
    6: { steps: [null, attack('썬더러쉬 예행', 'mag', 1.5, 'swap_stats')] }
  }
};

export function makeBossLesson(bossId, floor, roll) {
  const data = lessons[bossId]?.[floor];
  if (!data) return null;
  const { variants, steps, ...setup } = data;
  const variant = variants ? variants[Math.floor(roll * variants.length)] : 'fixed';
  return {
    bossId, floor, variant,
    steps: steps.map(step => {
      if (!step) return null;
      const type = step.type === 'variant' ? variant : step.type;
      let name = step.name;
      if (step.rule === 'charge') name = variant === 'phy' ? '물리 충전' : '마법 충전';
      if (step.rule === 'cleave') name = type === 'phy' ? '물리 절단' : '마법 절단';
      return { ...step, type, name };
    }),
    transferBeforeLocalTurn: LESSON_TURN, maxUsesPerRoom: LESSON_USES, ...structuredClone(setup)
  };
}
