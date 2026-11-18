// Wraps the card game's rule files (data, logic, skill text, battle runtime) into one script that exposes
// `window.RelayCore`. The files are used unchanged. The wrapper only replaces `setTimeout`
// inside them so that the pixel screen, not a 500 ms timer, decides when the enemy turn runs.
import fs from 'node:fs';
import path from 'node:path';

export const CORE_FILES = ['data.js', 'logic.js', 'skill_display.js', 'battle_runtime.js'];
const EXPORTS = [
  'CARDS', 'ENEMIES', 'BASIC_CARD_SETS', 'BUFF_NAMES', 'DISPLAY_NAMES',
  'GameUtils', 'Logic', 'StatusRules', 'SideEffects', 'SkillDisplay', 'BattleRuntime',
  'getMaxMana', 'findDelayedSkillEffect', 'buildBattleEnemy'
];

export function coreBundle(repoRoot) {
  const source = CORE_FILES
    .map(file => `/* ---- card/game/${file} ---- */\n` + fs.readFileSync(path.join(repoRoot, 'card/game', file), 'utf8'))
    .join('\n;\n');
  return 'window.RelayCore = (function (setTimeout) {\n' + source +
    '\n;return { GAME_CONSTANTS: window.GAME_CONSTANTS, ' + EXPORTS.join(', ') + ' };\n' +
    '})(function (fn) { return window.__relayCoreTimer(fn); });\n';
}
