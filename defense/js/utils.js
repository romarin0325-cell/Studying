function rand(a,b){ return a + Math.random() * (b-a); }
function irand(a,b){ return Math.floor(rand(a, b+1)); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a) * t; }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function fmt(n){ return Math.floor(Math.max(0,n)).toLocaleString('ko-KR'); }
function rgba(hex, a){
  const c = hex.replace('#','');
  const n = parseInt(c.length===3 ? c.split('').map(s=>s+s).join('') : c, 16);
  const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return `rgba(${r},${g},${b},${a})`;
}
function weightedPick(items, weightFn){
  if (!items || items.length === 0) return null;
  let sum = 0;
  for (const item of items) sum += Math.max(0, weightFn(item));
  if (sum <= 0) return items[0] ?? null;
  let r = Math.random() * sum;
  for (const item of items){
    r -= Math.max(0, weightFn(item));
    if (r <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}
function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j = irand(0,i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function keyOf(x,y){ return `${x},${y}`; }

export { rand, irand, clamp, lerp, dist, fmt, rgba, weightedPick, shuffle, keyOf };
