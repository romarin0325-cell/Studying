// Wraps RELAYMARE's local rule files into one script that exposes window.RelayCore.
// The wrapper supplies a timer hook so the RELAYMARE screen can schedule enemy turns.
import fs from 'node:fs';

export const CORE_FILES = ['data.js', 'logic.js', 'skill_display.js', 'battle_runtime.js'];
const EXPORTS = [
  'CARDS', 'ENEMIES', 'BASIC_CARD_SETS', 'ARTIFACT_LIST', 'BUFF_NAMES', 'DISPLAY_NAMES',
  'GameUtils', 'Logic', 'StatusRules', 'SideEffects', 'SkillDisplay', 'BattleRuntime',
  'getMaxMana', 'findDelayedSkillEffect', 'buildBattleEnemy'
];

// Keep repoRoot in the signature for existing callers. The rules live next to tools/.
export function coreBundle(repoRoot) {
  const source = CORE_FILES
    .map(file => `/* ---- card_pixel/game/core/${file} ---- */\n` + fs.readFileSync(new URL(`../core/${file}`, import.meta.url), 'utf8'))
    .join('\n;\n');
  return 'window.RelayCore = (function (setTimeout) {\n' + source +
    '\n;return { GAME_CONSTANTS: window.GAME_CONSTANTS, ' + EXPORTS.join(', ') + ' };\n' +
    '})(function (fn) { return window.__relayCoreTimer(fn); });\n';
}
