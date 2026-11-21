import { DUNGEONS } from '../content/dungeons.js';
import { josa } from './text.js';

const OUTCOME_NAMES = { survived: '생환', reserve: '예비로 생환', fell: '쓰러짐', released: '보냄' };
const BATTLE_NAMES = { gate: '문지기전', boss: '보스전' };

export function outcomeText(entry) {
  if (entry.runId) return OUTCOME_NAMES[entry.outcome] ?? '';
  return entry.result === 'win' && entry.returned === true ? '생환' : '귀환 여부 미기록';
}

export function storyLine(entry, card) {
  if (!entry) return '';
  const dungeon = DUNGEONS[entry.dungeonId]?.name;
  if (!dungeon) return '';
  const place = floor => floor === undefined ? dungeon : `${dungeon} ${floor}층`;
  const name = id => card(id)?.name;
  const skillObject = ({ fromId, skillName }) => josa([name(fromId), skillName].filter(Boolean).join('의 '), '을/를');
  const inherited = entry.inherited[0];
  if (entry.outcome === 'fell') {
    const where = entry.fallenFloor === undefined ? `${dungeon} 원정에서` : `${place(entry.fallenFloor)}에서`;
    const given = entry.given.find(fact => name(fact.toId));
    if (given) return `${where} 쓰러져 ${name(given.toId)}에게 ${josa(given.skillName, '을/를')} 남겼다.`;
    if (inherited) return `${skillObject(inherited)} 이어받고 ${where} 쓰러졌다.`;
    return `${where} 쓰러졌다.`;
  }
  const used = entry.used.find(fact => BATTLE_NAMES[fact.roomType] && fact.won) ?? entry.used[0];
  if (used) {
    const battle = BATTLE_NAMES[used.roomType] ?? '전투';
    return `${skillObject(used)} 쓴 ${place(used.floor)} ${battle}에서 ${used.won ? '이겼다' : '패했다'}.`;
  }
  if (inherited) return `${skillObject(inherited)} 이어받았다.`;
  if (entry.outcome === 'released') return `${dungeon} 원정 도중 일행과 헤어졌다.`;
  const victory = entry.victories.find(fact => fact.roomType === 'boss') ?? entry.victories[0];
  if (victory) return `${place(victory.floor)} ${BATTLE_NAMES[victory.roomType]}에서 함께 이겼다.`;
  if (entry.outcome === 'reserve') return '예비석에 남아 함께 돌아왔다.';
  if (entry.outcome === 'survived') return `${dungeon} 전투에 나섰고 함께 돌아왔다.`;
  if (entry.fielded) return `${dungeon} 원정에서 전투에 나섰다.`;
  return '';
}
