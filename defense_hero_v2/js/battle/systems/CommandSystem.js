import { BATTLE_PHASE } from '../../core/enums.js';
import { autoPlaceHeroes, placeHero } from './PlacementSystem.js';
import { startWave } from './WaveSystem.js';

function traitOptions(hero, level) {
  const traits = hero.definition.traits;
  if (Array.isArray(traits)) return traits.filter((trait) => trait.level === level);
  return traits?.[`lv${level}`] ?? [];
}
export function levelUpHero(state, heroId, traitId = null) {
  if (![BATTLE_PHASE.PREPARATION, BATTLE_PHASE.INTERMISSION].includes(state.phase)) return false;
  const hero = state.heroes.find((candidate) => candidate.id === heroId);
  if (!hero || hero.level >= 6 || state.crystals < 1) return false;
  const nextLevel = hero.level + 1;
  if (nextLevel === 4 || nextLevel === 6) {
    const options = traitOptions(hero, nextLevel);
    const selected = options.find((trait) => trait.id === traitId);
    if (!selected) return false;
    hero.selectedTraits[`lv${nextLevel}`] = selected.id;
  }
  state.crystals -= 1;
  hero.level = nextLevel;
  return true;
}

export function executeCommand(state, command) {
  switch (command.type) {
    case 'place_hero':
      return placeHero(state, command.payload.heroId, command.payload.x, command.payload.y);
    case 'auto_place':
      autoPlaceHeroes(state);
      return true;
    case 'start_wave':
      return startWave(state);
    case 'level_up':
      return levelUpHero(state, command.payload.heroId, command.payload.traitId);
    case 'set_speed':
      if (![1, 2].includes(command.payload.speed)) return false;
      state.speed = command.payload.speed;
      return true;
    case 'toggle_pause':
      state.paused = !state.paused;
      return true;
    default:
      throw new RangeError(`Unknown battle command: ${command.type}`);
  }
}
