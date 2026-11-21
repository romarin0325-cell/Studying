export const RELICS = {
  reverse: { fits: { element: 'nature' } },
  companion: { fits: { deathDamage: true, relic: 'big_bang' }, comboHint: '전설·초월 동료가 쓰러질 때 빅뱅 피해 2배' },
  double_attack: { fits: { normalAttack: true } },
  over_flame: { fits: { debuff: 'burn' } },
  over_divine: { fits: { debuff: 'divine' } },
  flame_piercing: { fits: { debuff: 'burn', attack: 'phy' } },
  frozen_body: { fits: { element: 'water' } },
  ice_break: { fits: { debuff: 'stun', relic: 'frozen_body' }, comboHint: '기절한 적에게 피해 2배' },
  support_boost: { fits: { support: true } },
  lucky_vicky: { fits: { critOrEvade: true } },
  big_bang: { fits: { grades: ['legend', 'transcendence'] } },
  death_roulette: { fits: { attack: 'any' } },
  gale_storm: { fits: { field: 'gale', critOrEvade: true } },
  buff_overload: { fits: { fieldSources: 4 } }
};

export const RELIC_COMBOS = Object.entries(RELICS).flatMap(([id, { fits, comboHint }]) =>
  fits.relic ? [{ ids: [fits.relic, id], hint: comboHint }] : []);

export function relicPartners(held) {
  return RELIC_COMBOS.flatMap(({ ids, hint }) => {
    const owned = ids.filter(id => held.includes(id));
    return owned.length === 1 ? [{ id: ids.find(id => id !== owned[0]), held: owned[0], hint }] : [];
  });
}
