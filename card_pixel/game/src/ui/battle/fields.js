const FIELD_STATS = {
  atk: ['공격력', '공격'], matk: ['마법공격력', '마공'], def: ['방어력', '방어'], mdef: ['마법방어력', '마방'],
  crit: ['치명타율', '치명타율'], evasion: ['회피율', '회피율']
};

export function fieldInfo(core, id, artifacts, short = false) {
  if (id === 'arena') return '일반 공격 피해 2배';
  const stats = core.GAME_CONSTANTS.FIELD_BUFF_STATS[id];
  if (!stats) return '';
  const boosts = {
    earth_bless: ['divine_flora', 'nature_blessing'],
    star_powder: ['divine_thor', 'milkshake']
  }[id];
  const mult = boosts && artifacts?.includes(boosts[0]) ? 2.5 : boosts && artifacts?.includes(boosts[1]) ? 2 : 1;
  const groups = new Map();
  for (const [stat, value] of Object.entries(stats)) {
    const rate = stat === 'crit' || stat === 'evasion';
    const amount = '+' + ((rate ? value : value * 100) * mult) + (rate ? '%p' : '%');
    const names = groups.get(amount) || [];
    names.push(FIELD_STATS[stat][Number(short)]);
    groups.set(amount, names);
  }
  const lines = Array.from(groups, ([amount, names]) => names.join('·') + ' ' + amount);
  if (id === 'sun_bless') lines.push('치명타 피해 +' + core.GAME_CONSTANTS.SUN_BLESS_CRIT_BONUS * 100 + '%p');
  if (id === 'reaper_realm') lines.push('치명타 피해 +40%p');
  return lines.join(' · ');
}

const RANDOM_FIELDS = ['sun_bless', 'moon_bless', 'sanctuary', 'goddess_descent', 'earth_bless', 'twinkle_party', 'star_powder'];

function fieldEffect(effect, instant, describe) {
  const after = effect.turns && !instant ? effect.turns + '턴 뒤 ' : '';
  switch (effect.type) {
    case 'field_buff':
      return { ids: [effect.id], line: describe(effect.id) };
    case 'delayed_attack_field':
      return { ids: [effect.field], line: after + describe(effect.field) };
    case 'delayed_field_buffs':
      return { ids: effect.buffs, line: after + effect.buffs.map(describe).join(' · ') };
    case 'random_field_buff':
      return { ids: effect.pool || [...RANDOM_FIELDS, 'arena'], line: '무작위 아군 강화 1종' };
    case 'roulette_field':
      return { ids: RANDOM_FIELDS, line: '하늘 초기화 · 무작위 아군 강화 1종' };
    case 'delayed_random_unique_field_buffs':
      return { ids: effect.pool, line: after + '없는 하늘 효과 최대 ' + effect.count + '종' };
    case 'consume_all_burn_cond_buff':
      return { ids: ['sun_bless', 'earth_bless'], line: '아군 공격·마공 증가 · 작열로 강화' };
    case 'moon_to_sun':
      return { ids: ['moon_bless', 'sun_bless'], line: '아군 마공 증가 · 달이 있으면 태양' };
    default:
      return null;
  }
}

export function skillFields(core, option, artifacts) {
  if (option.type !== 'sup') return null;
  const other = [], fields = [];
  for (const effect of option.effects) {
    const field = fieldEffect(effect, option.preview?.instant, id => fieldInfo(core, id, artifacts, true));
    if (field) fields.push(field);
    else other.push(effect);
  }
  if (!fields.length) return null;
  const ids = [...new Set(fields.flatMap(field => field.ids))];
  return {
    line: fields.map(field => field.line).join(' · '),
    names: ids.map(id => core.BUFF_NAMES[id] || id),
    detail: ids.map(id => (core.BUFF_NAMES[id] || id) + ' — 아군 ' + fieldInfo(core, id, artifacts)).join('. ') + '.',
    other
  };
}
