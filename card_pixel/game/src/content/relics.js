export const RELICS = {
  reverse: { fits: { element: 'nature' } },
  companion: { fits: { deathDamage: true, relic: 'big_bang' } },
  double_attack: { fits: { normalAttack: true } },
  over_flame: { fits: { debuff: 'burn' } },
  over_divine: { fits: { debuff: 'divine' } },
  flame_piercing: { fits: { debuff: 'burn', attack: 'phy' } },
  frozen_body: { fits: { element: 'water' } },
  ice_break: { fits: { debuff: 'stun', relic: 'frozen_body' } },
  support_boost: { fits: { support: true } },
  lucky_vicky: { fits: { critOrEvade: true } },
  big_bang: { fits: { grades: ['legend', 'transcendence'] } },
  death_roulette: { fits: { attack: 'any' } },
  gale_storm: { fits: { field: 'gale', critOrEvade: true } },
  buff_overload: { fits: { fieldSources: 4 } }
};
