export function openingModel(bridge) {
  const state = bridge.state();
  const retreat = bridge.previewRetreat();
  const attack = bridge.options().find(option => option.index === 0 && option.usable && option.preview);
  if (!retreat || !attack || !state.enemy) return null;
  const actorId = state.allies[state.cur].form;
  const incoming = state.allies[retreat.next.idx];
  const { dmg, min = dmg, max = dmg } = attack.preview;
  return {
    stand: { optionIndex: attack.index, actorId, targetId: state.enemy.form, damageRange: [min, max] },
    rescue: { actorId, incomingId: incoming.form, damageRange: retreat.dmg.slice(), incomingHpAfter: Math.max(0, incoming.hp - retreat.dmg[1]) }
  };
}
