// Canvas roundRect is unavailable on older Safari. Keep the path identical
// without requiring a global polyfill or risking the animation loop.
export function roundedRect(context, x, y, width, height, radius = 0) {
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

export function drawFallbackToken(ctx, { x, y, size, label = '', color = '#678c84', kind = 'normal' }) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff7df';
  ctx.lineWidth = Math.max(1, size * .04);
  ctx.beginPath();
  if (kind === 'core' || kind === 'air') {
    ctx.moveTo(x, y-size*.5); ctx.lineTo(x+size*.4,y);
    ctx.lineTo(x,y+size*.5); ctx.lineTo(x-size*.4,y); ctx.closePath();
  } else if (kind === 'heavy' || kind === 'boss') {
    roundedRect(ctx,x-size*.4,y-size*.4,size*.8,size*.8,size*.12);
  } else ctx.arc(x,y,size*.4,0,Math.PI*2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(10,size*.3)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.restore();
}
