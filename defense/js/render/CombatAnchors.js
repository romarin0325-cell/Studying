// Combat coordinates remain on the ground plane. Only the drawing attachment
// rises to the hero's chest / enemy body; viewport rotation cannot move it to feet.
export function combatAnchor(layout, x, y, kind = 'enemy') {
  const point = layout.logicalToCanvas(x, y), cell = layout.logicalRadiusToCanvas(1);
  const elevation = kind === 'hero' ? .92 : kind === 'boss' ? .95 : kind === 'ground' ? 0 : .43;
  return { x: point.x, y: point.y - cell * elevation };
}
