import { AFFIXES } from '../content/affixes.js';
import { LESSON_SALT, makeBossLesson } from '../content/boss-lessons.js';
import { DUNGEONS } from '../content/dungeons.js';
import { EVENTS, eventForRun } from '../content/events.js';
import { INTRO } from '../content/intro.js';
import { LAYOUTS, ROOM_NAMES } from '../content/layouts.js';
import { QUIRKS } from '../content/quirks.js';
import { RELICS } from '../content/relics.js';
import {
  BLESSING_MULTIPLIERS, ENTRY_FIRST_MAIN_ENEMY_HP, FIRST_MAIN_ASSIST, FLOOR_SEED_STEP, INTRO_MULTIPLIERS,
  LESSON_NIGHTMARE_MULTIPLIERS, NIGHTMARE_MULTIPLIERS,
  REGION_MULTIPLIERS, ROOM_MULTIPLIERS, START_MP, TEMPO_SEEDS, usesTempo
} from '../content/tempo.js';
import {
  applyDraw, BLESS, canJoin, drawEncounter, drawFrom, drawKind, join, RATES, release,
  replacementCount, seeCharacters, seeRelic, usesRepeatDraws, validateReplacements
} from './awakenings.js';
import { heldHeirloomSkill } from './bridge.js';
import { hasFeature } from './entry.js';
import { gradeOf } from './roster.js';
import { nextFloat, pick, shuffle } from './rng.js';

export const RELIC_LIMIT = 4;
const SALE_PRICE = { normal: 1, rare: 2, epic: 3, legend: 4 };
const SKY = ['sun_bless', 'star_powder'];
const ATTACK_TYPES = ['phy', 'mag'];
export const copy = value => structuredClone(value);
export const invalid = reason => ({ ok: false, reason });

function fitsRelic(run, roster, rule) {
  const cards = run.bench.map(roster.card);
  const skills = cards.flatMap(card => card.skills || []);
  const effects = skills.flatMap(skill => skill.effects || []);
  if (rule.element) return cards.some(card => card.element === rule.element || card.trait?.type === 'joker_wild');
  if (rule.grades) return cards.some(card => rule.grades.includes(card.grade));
  if (rule.relic && run.relics.includes(rule.relic)) return true;
  if (rule.deathDamage) return cards.some(card => /^death_.*dmg/.test(card.trait?.type || ''));
  if (rule.normalAttack) return cards.length > 0;
  if (rule.support) return skills.some(skill => skill.type === 'sup' && skill.cost > 0);
  const critOrEvade = cards.some(card => /crit|eva/.test(card.trait?.type || '')
    || (card.stats.crit || 0) > 0 || (card.stats.eva || 0) > 0);
  if (rule.field) return critOrEvade || effects.some(effect => effect.buff === rule.field);
  if (rule.critOrEvade) return critOrEvade;
  if (rule.fieldSources) {
    const fields = new Set([
      ...(run.region?.id === 'starlit_sky' ? SKY : []),
      ...(run.nextBattle?.start?.field || []),
      ...effects.filter(effect => ['field_buff', 'conditional_field_buff'].includes(effect.type)).map(effect => effect.id),
      ...effects.flatMap(effect => effect.field || (effect.type === 'delayed_field_buffs' ? effect.buffs : []))
    ]);
    return fields.size >= rule.fieldSources || effects.some(effect => effect.type === 'random_field_buff');
  }
  if (rule.debuff) {
    const hasDebuff = effects.some(effect => (effect.type === 'debuff' && effect.id === rule.debuff)
      || effect.debuffs?.includes(rule.debuff) || effect.pool?.includes(rule.debuff))
      || cards.some(card => card.trait?.debuff === rule.debuff
        || (card.trait?.type === 'normal_attack_burn_divine' && ['burn', 'divine'].includes(rule.debuff)));
    if (!hasDebuff) return false;
  }
  if (rule.attack) return skills.some(skill => rule.attack === 'any' ? ATTACK_TYPES.includes(skill.type) : skill.type === rule.attack);
  return true;
}

function relicOffer(run, roster) {
  const available = Object.keys(RELICS).filter(id => !run.relics.includes(id));
  const fits = available.filter(id => fitsRelic(run, roster, RELICS[id].fits));
  const id = pick(run.rng, fits.length ? fits : available);
  seeRelic(run, id);
  return id || null;
}

export function grantRelic(run, id, cost = 0) {
  seeRelic(run, id);
  if (run.relics.includes(id)) return { id, equipped: false, duplicate: true };
  if (run.relics.length === RELIC_LIMIT) {
    run.pending = { kind: 'relic', id, cost, replace: run.relics.slice(), after: run.pending };
    return { id, equipped: false, chooseReplacement: true };
  }
  run.crystals -= cost;
  run.relics.push(id);
  return { id, equipped: true };
}

function drawShadow(run, roster, grades, taken) {
  const ids = run.pool.filter(id => canJoin(run, id) && !taken.includes(id) && grades.includes(gradeOf(roster.card(id).grade)));
  return pick(run.rng, ids);
}

function gateEnemies(run, roster, tier) {
  const grades = ['normal', 'rare', 'epic', 'legend'];
  const first = run.reserved || drawShadow(run, roster, ['rare', 'epic'], []) || drawShadow(run, roster, grades, []);
  const second = drawShadow(run, roster, ['epic', 'legend'], [first]) || drawShadow(run, roster, grades, [first]);
  // A small pool can be exhausted by the spring. Keep a two-enemy gate even then.
  const backup = run.pool.filter(id => !run.fallen.includes(id) && !run.released.includes(id) && id !== first);
  const ids = [first, second || pick(run.rng, backup)];
  return ids.map(id => id ? roster.shadowOf(id, tier) : roster.wildOf(DUNGEONS[run.dungeonId].wild[0], tier));
}

function wildEnemies(run, roster, dungeon, template, tier, region, quirk) {
  const elite = template.type === 'elite';
  const double = !elite && region?.id === 'ember_carry';
  const count = (double ? 2 : 1) + Number(quirk === 'overflow');
  const taken = [];
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const canRollShadow = run.floor >= 6 && nextFloat(run.rng) < (elite ? 0.5 : 0.35);
    const shadow = canRollShadow && drawShadow(run, roster, elite ? ['epic', 'legend'] : ['normal', 'rare', 'epic'], taken);
    if (shadow) {
      taken.push(shadow);
      enemies.push(roster.shadowOf(shadow, tier));
    } else {
      const large = dungeon.wild.filter(id => roster.LARGE.includes(id));
      const id = template.creature || pick(run.rng, elite && large.length ? large : dungeon.wild);
      enemies.push(roster.wildOf(id, tier * (double ? 0.65 : 1)));
    }
  }
  return enemies;
}

export function floorRng(run, salt) {
  return { state: (run.seed ^ Math.imul(run.floor, FLOOR_SEED_STEP) ^ salt) >>> 0 };
}

function battleBlessing(run, roster) {
  let ids = run.bench.slice().sort();
  const [older, recent] = run.blessingHistory ?? [];
  if (run.lessonVersion && recent && recent === older && ids.length > 1) {
    ids = ids.filter(id => id !== recent);
  }
  const preferred = ids.filter(id => ['normal', 'rare'].includes(roster.card(id).grade));
  const id = pick(floorRng(run, TEMPO_SEEDS.blessing), preferred.length ? preferred : ids);
  return id ? { id, multiplier: BLESSING_MULTIPLIERS[roster.card(id).grade] } : null;
}

function battleScale(run, room) {
  const key = room.risk && room.type === 'wild' ? 'risk' : room.type;
  const assist = run.firstMainAssist && (FIRST_MAIN_ASSIST[run.dungeonId]?.[key] || FIRST_MAIN_ASSIST[key]);
  const tunedNightmare = run.lessonVersion && LESSON_NIGHTMARE_MULTIPLIERS[run.dungeonId]?.[key];
  const nightmare = run.difficulty === 'nightmare' && (tunedNightmare || NIGHTMARE_MULTIPLIERS[run.dungeonId]?.[key]);
  return assist || nightmare || (hasFeature(run, 'regionRules') && REGION_MULTIPLIERS[run.dungeonId]?.[key]) || ROOM_MULTIPLIERS[key];
}

export function applyDoorTempo(run, roster, door) {
  if (!usesTempo(run)) return null;
  const intro = DUNGEONS[run.dungeonId].layout === 'intro';
  const scale = intro ? INTRO_MULTIPLIERS[run.floor] : battleScale(run, door);
  if (scale) {
    const [hp, attack] = scale;
    const firstMainEntry = !intro && run.difficulty === 'easy' && run.features?.firstMainCleared === false;
    const hpScale = firstMainEntry ? hp * ENTRY_FIRST_MAIN_ENEMY_HP : hp;
    for (const { stats } of door.enemies) {
      stats.hp = Math.round(stats.hp * hpScale);
      stats.atk = Math.round(stats.atk * attack);
      stats.matk = Math.round(stats.matk * attack);
    }
  }
  let pattern = 'threeBeat';
  if (door.type === 'boss') pattern = 'bossScript';
  else if (door.type === 'borrowed' || door.intent) pattern = 'introFixed';
  else if (door.region?.id === 'tide_cycle') pattern = 'tide';
  const roll = run.lessonVersion && !intro ? nextFloat(floorRng(run, LESSON_SALT ^ door.index)) : 0;
  const lesson = run.lessonVersion && !intro ? makeBossLesson(run.boss, run.floor, roll) : null;
  if (lesson?.armor) {
    for (const { id, stats } of door.enemies) {
      const armor = lesson.armor[id] ?? lesson.armor.all;
      if (!armor) continue;
      stats.def = Math.round(stats.def * armor);
      stats.mdef = Math.round(stats.mdef * armor);
    }
  }
  return {
    pattern,
    ...(lesson && { lesson }),
    blessing: !intro && hasFeature(run, 'battleBlessing') ? battleBlessing(run, roster) : null,
    startMp: intro ? (door.type === 'borrowed' ? INTRO.start.allyStart[0].mp : null) : QUIRKS[door.quirk]?.ally?.mp ?? START_MP
  };
}

function makeBattleDoor(run, roster, dungeon, template, index, region, battleCount) {
  const challenge = run.difficulty === 'nightmare' ? dungeon.nightmareRule : null;
  const elite = template.type === 'elite';
  const singleRisk = run.difficulty !== 'nightmare' && template.type === 'wild';
  const quirks = Object.keys(QUIRKS);
  const riskRoll = !run.plain && template.risk && (hasFeature(run, 'quirks') || hasFeature(run, 'affixes'))
    ? nextFloat(run.rng) * quirks.length : -1;
  const quirk = quirks[Math.floor(riskRoll)] || null;
  // Use the unused fraction of the roll to choose which modifier applies on a normal door.
  // Overflow always keeps its quirk because it adds an enemy to the room.
  const affixOnly = singleRisk && quirk && quirk !== 'overflow' && riskRoll % 1 < 0.5;
  const tier = dungeon.tiers[run.floor - 1] * (elite ? 1.12 : 1) * (challenge?.scale || 1);
  let enemies;
  if (template.type === 'borrowed') {
    const enemy = roster.wildOf(INTRO.creature);
    enemy.stats.hp = INTRO.enemyHp;
    enemies = [enemy];
  } else if (template.type === 'gate') {
    enemies = gateEnemies(run, roster, tier);
  } else if (template.type === 'boss') {
    enemies = [roster.bossOf(run.boss, tier)];
  } else {
    enemies = wildEnemies(run, roster, dungeon, template, tier, region, hasFeature(run, 'quirks') ? quirk : null);
  }
  const affixCount = run.plain || !hasFeature(run, 'affixes') ? 0
    : (elite ? 2 : Number(!!template.risk && quirk !== 'overflow')) + Number(!!challenge?.extraAffix);
  if (affixCount) {
    const affixes = shuffle(run.rng, Object.keys(AFFIXES)).slice(0, affixCount);
    if (!singleRisk || affixOnly) enemies[0].affixes = affixes;
  }
  const skyBet = run.nextBattle?.bet?.kind === 'empty_sky';
  const hasSky = region?.id === 'starlit_sky';
  const filledSky = hasSky && !skyBet && (battleCount > 1 ? index === 1 : nextFloat(run.rng) < 0.5);
  const start = template.type === 'borrowed' ? INTRO.start : hasSky ? { field: filledSky ? SKY : [] } : null;
  const door = {
    ...template, index, name: ROOM_NAMES[template.type], bg: dungeon.background, region: copy(region),
    enemies, quirk: affixOnly || !hasFeature(run, 'quirks') ? null : quirk,
    start: copy(start), relic: elite || template.type === 'gate' ? relicOffer(run, roster) : null
  };
  door.tempo = applyDoorTempo(run, roster, door);
  return door;
}

function eventCandidates(run) {
  const present = id => (run.pool.includes(id) || run.bench.includes(id))
    && !run.fallen.includes(id) && !run.released.includes(id);
  return EVENTS.filter(event => (event.minTempoVersion ?? 1) <= (run.tempoVersion ?? 1)
    && (!event.dungeons || event.dungeons.includes(run.dungeonId))
    && (event.requires.present || []).every(present)
    && (event.requires.bench || []).every(id => run.bench.includes(id)))
    .map(event => configuredEvent(run, event)).filter(event => event.choices.length);
}

const DEFERRED_EVENT_OPS = ['bet', 'altar', 'field', 'start', 'firstSurvivalPay', 'relic'];

function configuredEvent(run, event) {
  const configured = eventForRun(event, run);
  const choices = configured.choices.filter(choice => {
    if (!hasFeature(run, 'bets') && choice.ops.some(op => op.type === 'bet')) return false;
    if (!hasFeature(run, 'altar') && choice.ops.some(op => op.type === 'altar')) return false;
    return hasFeature(run, 'pricedEvents') || (!choice.cost && choice.ops.every(op => !DEFERRED_EVENT_OPS.includes(op.type)));
  });
  return { ...configured, choices };
}

export function makeDoors(run, roster) {
  const dungeon = DUNGEONS[run.dungeonId];
  const layout = LAYOUTS[dungeon.layout][run.floor - 1]
    .filter(template => template.type !== 'altar' || hasFeature(run, 'altar'))
    .filter(template => template.type !== 'event' || run.floor >= 5 || hasFeature(run, 'pricedEvents'))
    .filter(template => dungeon.layout !== 'intro' || template.type !== 'spring' || hasFeature(run, 'introSpring'));
  const battleCount = layout.filter(template => template.reward != null || ['borrowed', 'boss'].includes(template.type)).length;
  return layout.map((template, index) => {
    const regionChoice = hasFeature(run, 'regionRules') && run.floor === 5 ? run.laterRegions?.[index] : null;
    const region = hasFeature(run, 'regionRules') ? regionChoice || run.region : null;
    if (template.reward != null || ['borrowed', 'boss'].includes(template.type)) {
      const standard = !hasFeature(run, 'riskDoors') && (template.risk || template.type === 'elite')
        ? { type: 'wild', reward: 1 } : template;
      return makeBattleDoor(run, roster, dungeon, standard, index, region, battleCount);
    }
    const event = template.type === 'event' ? pick(run.rng, eventCandidates(run)) : null;
    const merchant = event?.id === 'grand_merchant';
    const relic = template.type === 'treasure' || merchant ? relicOffer(run, roster) : null;
    return {
      ...template, index, name: event?.name || ROOM_NAMES[template.type], bg: dungeon.background,
      enemies: [], tempo: null, region: copy(region), regionChoice: copy(regionChoice || null),
      event: event ? copy(event) : null, relic
    };
  });
}

function canAttemptBet(run, core, roster, kind) {
  if (run.nextBattle?.bet) return false;
  if (kind === 'empty_sky') return !run.relics.includes('gale_storm') && !run.nextBattle?.start?.field?.length;
  if (kind === 'delayed_on_time') {
    return run.bench.some(id => {
      const card = roster.card(id);
      const inherited = heldHeirloomSkill(core, run.heirlooms[id]);
      return card.trait?.type !== 'instant_delayed_skills' && [...card.skills, inherited]
        .some(skill => skill && ATTACK_TYPES.includes(skill.type) && core.findDelayedSkillEffect(skill));
    });
  }
  if (kind === 'same_grade_full') {
    const grades = run.bench.map(id => roster.card(id).grade);
    return grades.some(grade => grades.filter(other => other === grade).length >= 3);
  }
  return run.bench.length > 0;
}

export function eventChoices(run, core, roster) {
  return (run.room.event?.choices || []).map(choice => {
    let targets = null;
    if (choice.target === 'bench') targets = run.bench.slice();
    if (choice.target === 'release') {
      targets = run.bench.length > 1 ? run.bench.filter(id => id !== run.lead) : [];
    }
    const eligible = choice.ops.every(op => {
      if (op.type === 'join' && !op.random) return op.ids.every(id => canJoin(run, id));
      if (op.type === 'join' || (op.type === 'release' && op.randomReplacement)) {
        return usesRepeatDraws(run) ? run.pool.length > 0 : run.pool.some(id => canJoin(run, id));
      }
      if (op.type === 'bet') return canAttemptBet(run, core, roster, op.kind);
      if (op.type === 'relic') {
        const id = op.id === 'offered' ? run.room.relic : op.id;
        return !!id && !run.relics.includes(id) && (!op.temporary
          || (!run.nextBattle?.relic && run.relics.length < RELIC_LIMIT));
      }
      return true;
    });
    const view = { ...copy(choice), targets, enabled: eligible && (targets === null || targets.length > 0) && run.crystals >= (choice.cost || 0) };
    if (run.lessonVersion) addEventChoiceDetails(view, run, core, roster);
    return view;
  });
}

export function joinCount(ops) {
  return ops.filter(op => op.type === 'join').reduce((sum, op) => sum + (op.random ? 1 : op.ids.length), 0);
}

function addEventChoiceDetails(choice, run, core, roster) {
  const incoming = joinCount(choice.ops);
  if (incoming) {
    // Event details use the lesson version, independently of tempo validation.
    const random = usesRepeatDraws(run) && choice.ops.filter(op => op.type === 'join' && op.random).length;
    choice.requiredReleases = random && replacementCount(run, incoming) > 0
      ? null : replacementCount(run, incoming, { enforceLimit: true });
    if (choice.requiredReleases > run.bench.filter(id => id !== run.lead).length) choice.enabled = false;
  }
  const blessing = choice.ops.find(op => op.type === 'bless' && Number.isFinite(op.multiplier));
  if (blessing) {
    const ids = blessing.all ? run.bench : choice.targets ?? [];
    choice.blessingChanges = Object.fromEntries(ids.map(id => [id, {
      before: run.blessings[id] ?? 0, after: blessing.multiplier
    }]));
  }
  if (run.room.event.id === 'kobold_boot_exchange' && choice.id === 'exchange') {
    choice.netCrystals = Object.fromEntries(choice.targets.map(id => [id, SALE_PRICE[gradeOf(roster.card(id).grade)] - choice.cost]));
  }
  if (run.room.event.id === 'penguin_ice_seam' && choice.id === 'carry') {
    choice.waterAllies = run.bench.filter(id => core.GameUtils.cardMatchesElement(roster.card(id), 'water'));
    if (!choice.waterAllies.length) choice.text += ' · 물 동료 없음';
  }
}

export function resolveEvent(run, core, roster, choiceId, targetId, replaceIds = []) {
  const choice = eventChoices(run, core, roster).find(entry => entry.id === choiceId);
  if (!choice?.enabled || (choice.targets ? !choice.targets.includes(targetId) : targetId != null)) return invalid('invalid_event_choice');
  const rolled = new Map();
  const preview = usesRepeatDraws(run) ? { ...run, rng: { ...run.rng } } : null;
  let incoming = joinCount(choice.ops);
  if (preview) {
    for (const op of choice.ops) {
      if (!op.random && !op.randomReplacement) continue;
      const id = drawEncounter(preview, roster);
      if (!id) return invalid('empty_pool');
      rolled.set(op, id);
      if (op.type === 'join' && drawKind(run, id) !== 'join') incoming--;
    }
  }
  const error = validateReplacements(run, incoming, replaceIds);
  if (error) return rolled.size ? { ...invalid(error), requiredReleases: replacementCount(run, incoming) } : invalid(error);
  if (rolled.size) run.rng.state = preview.rng.state;
  const result = { ok: true, choiceId, effects: [] };
  const before = run.crystals;
  const paidRelic = choice.ops.some(op => op.type === 'relic' && !op.temporary);
  if (!paidRelic) run.crystals -= choice.cost || 0;
  run.pending = null;
  run.room.status = 'resolved';
  for (const id of replaceIds) {
    release(run, id);
    result.effects.push({ type: 'release', id });
  }
  for (const op of choice.ops) {
    switch (op.type) {
      case 'crystals':
        run.crystals += op.amount;
        break;
      case 'firstSurvivalPay':
        (run.firstSurvivalPay ||= {})[op.id] = op.amount;
        break;
      case 'join': {
        if (rolled.has(op)) {
          const draw = applyDraw(run, rolled.get(op));
          result.effects.push({ type: 'join', ids: draw.kind === 'join' ? [draw.id] : [], draw });
          break;
        }
        const ids = op.random ? [drawFrom(run, roster, RATES.draw)] : op.ids;
        for (const id of ids) join(run, id);
        result.effects.push({ type: 'join', ids: ids.slice() });
        break;
      }
      case 'release':
        release(run, targetId);
        run.crystals += SALE_PRICE[gradeOf(roster.card(targetId).grade)];
        result.effects.push({ type: 'release', id: targetId });
        // The selected release has already opened the incoming fighter's seat.
        if (op.randomReplacement) {
          if (rolled.has(op)) {
            const draw = applyDraw(run, rolled.get(op));
            result.effects.push({ type: 'join', ids: draw.kind === 'join' ? [draw.id] : [], draw });
          } else {
            const id = drawFrom(run, roster, RATES.draw);
            join(run, id);
            result.effects.push({ type: 'join', ids: [id] });
          }
        }
        break;
      case 'bless':
        for (const id of op.all ? run.bench : [targetId]) {
          const multiplier = op.multiplier === 'grade' ? BLESS[roster.card(id).grade] || 0.2 : op.multiplier;
          run.blessings[id] = multiplier;
          result.effects.push({ type: 'bless', id, multiplier });
        }
        break;
      case 'altar':
        run.pending = { kind: 'altar', rolls: 0, roll: null };
        run.room.status = 'service';
        break;
      case 'relic':
        if (op.temporary) {
          (run.nextBattle ||= {}).relic = op.id;
          seeRelic(run, op.id);
          result.effects.push({ type: 'relic', id: op.id, temporary: true });
        } else {
          const relic = grantRelic(run, op.id === 'offered' ? run.room.relic : op.id, choice.cost || 0);
          result.effects.push({ type: 'relic', ...relic });
        }
        break;
      case 'field':
        ((run.nextBattle ||= {}).start ||= {}).field = op.ids.slice();
        result.effects.push(copy(op));
        break;
      case 'start':
        (run.nextBattle ||= {}).start = { ...run.nextBattle.start, enemyDebuffs: copy(op.enemyDebuffs) };
        result.effects.push(copy(op));
        break;
      case 'bet': {
        const bet = op.turn ? { kind: op.kind, turn: op.turn } : { kind: op.kind };
        Object.assign(run.nextBattle ||= {}, { bet, reward: copy(op.reward) });
        result.effects.push(copy(op));
        break;
      }
      case 'heirloom': {
        const id = op.to || targetId;
        const held = { from: op.from, name: op.name, form: op.from };
        run.heirlooms[id] = { ...held, skill: heldHeirloomSkill(core, held) };
        result.effects.push({ type: 'heirloom', id, ...run.heirlooms[id] });
        break;
      }
      default:
        throw new Error('Unknown event operation ' + op.type);
    }
  }
  result.crystals = run.crystals - before;
  result.pending = copy(run.pending);
  return result;
}

export function observeDoors(run) {
  seeCharacters(run, run.doors.flatMap(door => door.enemies.map(enemy => enemy.source).filter(Boolean)));
}
