import {
  createBasicAttackAction,
  resolveBasicAttackAction,
} from './BasicAttackSystem.js';
import {
  createSkillAction,
  resolveSkillAction,
} from './SkillSystem.js';

const ACTION_KIND_PRIORITY = Object.freeze({ skill: 0, basic: 1 });

export function actionPriority(left, right) {
  return left.tick - right.tick
    || left.slot - right.slot
    || ACTION_KIND_PRIORITY[left.actionKind] - ACTION_KIND_PRIORITY[right.actionKind]
    || left.targetSpawnOrder - right.targetSpawnOrder
    || String(left.target?.id).localeCompare(String(right.target?.id));
}

export function createBattleActions(state, deltaSeconds, { landscape = false } = {}) {
  const actions = [];
  const occupied = new Set([...(state.registry?.projectiles?.values() ?? [])]
    .filter(action => action.phase === 'windup' || action.actionKind === 'skill').map(action => action.sourceId));
  const heroes = [...state.heroes].sort((left, right) => left.slot - right.slot || left.id.localeCompare(right.id));
  for (const hero of heroes) {
    if (!hero.placed) continue;
    if (occupied.has(hero.id)) {
      hero.attackTimer = Math.max(0, hero.attackTimer - deltaSeconds);
      hero.skillTimer = Math.max(0, hero.skillTimer - deltaSeconds);
      continue;
    }
    const skill = createSkillAction(state, hero, deltaSeconds, landscape);
    if (skill) {
      // Let the signature action land before this hero resumes basics. Both
      // cooldowns keep ticking, but a basic cannot steal its own skill target.
      hero.attackTimer = Math.max(0, hero.attackTimer - deltaSeconds);
      actions.push(skill);
      continue;
    }
    const basic = createBasicAttackAction(state, hero, deltaSeconds, landscape);
    if (basic) actions.push(basic);
  }
  return actions.sort(actionPriority);
}

export function resolveBattleActions(state, actions) {
  for (const action of actions) {
    if (action.actionKind === 'skill') resolveSkillAction(state, action);
    else if (action.actionKind === 'basic') resolveBasicAttackAction(state, action);
    else throw new RangeError(`Unknown battle action kind: ${action.actionKind}`);
  }
  return actions.length;
}

export const BATTLE_ACTION_KIND_PRIORITY = ACTION_KIND_PRIORITY;
