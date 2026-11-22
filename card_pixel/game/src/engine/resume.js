import { previewNextFloor } from './run.js';

export function resumePoint(run, { entryDoor, entryBattle } = {}) {
  if (!run) return null;
  const floor = Math.max(run.floor, 1);
  const point = (kind, detail) => ({ kind, floor, ...detail });
  const { room, pending } = run;
  const borrowed = () => point('borrowed', {
    replay: entryBattle?.runId === run.id && Array.isArray(entryBattle.actions) && entryBattle.actions.length > 0
  });

  if (run.phase === 'done') return point(run.daily ? 'dailyResult' : 'recruit');
  if (run.phase === 'result') return point('result');
  if (pending?.kind === 'start' || run.phase === 'start') return point('awakening');
  if (room?.status === 'left' || (room?.type === 'treasure' && room.status === 'resolved'
    && !pending && run.relics.includes(room.relic))) {
    const next = previewNextFloor(run);
    return next ? resumePoint(next, { entryDoor, entryBattle }) : point('map');
  }
  if (run.phase === 'reward') return point('result');
  if (run.phase === 'map') {
    const [first] = run.doors;
    if (first?.type === 'borrowed') return borrowed();
    if (first?.type === 'awakening') return point('awakening');
    const savedDoor = run.floor === 3 && entryDoor?.runId === run.id ? run.doors[entryDoor.index] : null;
    const door = savedDoor?.enemies.length ? savedDoor : run.doors.length === 1 ? first : null;
    return door?.enemies.length ? point('battle', { roomType: door.type, doorIndex: door.index }) : point('map');
  }
  if (room?.status === 'order' || room?.status === 'battle') {
    return room.type === 'borrowed' ? borrowed() : point('battle', { roomType: room.type, doorIndex: room.index });
  }
  if (pending?.kind === 'relic' || (room?.type === 'event' && room.status === 'resolved'
    && run.relics.includes(room.relic))) return point('treasure');
  return point(room?.type ?? 'map');
}
