export const CELL = 512;
export const TOLERANCE = 8;
export const MAX_SCALE = 1.6;

const layout = [
  ['eye', '눈 높이'],
  ['chin', '턱~발'],
  ['shoulder', '어깨 높이'],
  ['hip', '골반 높이']
];

function extentLimit([left, top, right, bottom], [x, y]) {
  const edges = [[x, x-left], [y, y-top], [CELL-x, right-x], [CELL-y, bottom-y]];
  return Math.min(MAX_SCALE, ...edges.filter(([,distance]) => distance > 0)
    .map(([available,distance]) => available / distance));
}

function fit(rows, limit, useUncertainty = false) {
  if (!rows.length) return null;
  const targetError = r => TOLERANCE + (useUncertainty ? r.targetError : 0);
  const valueError = r => useUncertainty ? r.valueError : 0;
  const min = Math.max(1, ...rows.map(r => (r.target-targetError(r))/(r.value+valueError(r))));
  const max = Math.min(limit, ...rows.map(r => (r.target+targetError(r))/Math.max(0,r.value-valueError(r))));
  const best = preset(rows);
  const feasible = min <= max + 1e-9;
  const scale = feasible ? Math.min(max,Math.max(min,best)) : Math.min(limit,Math.max(1,best));
  return { scale, range: feasible ? [min,Math.max(min,max)] : null };
}

const preset = rows => rows.length
  ? rows.reduce((sum,r)=>sum+r.value*r.target,0) / rows.reduce((sum,r)=>sum+r.value*r.value,0) : null;

function geometry(frame, points, uncertainty, visibleUncertainty, index) {
  if (!frame) return null;
  const [x, y, w, h, angle] = frame.ellipse;
  const radians = angle * Math.PI / 180;
  const height = Math.hypot(w*Math.sin(radians),h*Math.cos(radians));
  return { ellipse:frame.ellipse, crown:[x,y-height/2], height,
    eye:points?.eye, chin:points?.chin ?? (index===1 ? null : frame.chin),
    shoulder:points?.shoulder, hip:points?.hip, uncertainty,
    pointUncertainty:Object.fromEntries(layout.map(([key])=>[
      key, points?.[key] ? visibleUncertainty[key] : uncertainty
    ])) };
}

export function scaleReview(bounds, anchor, entry, visible, visibleUncertainty) {
  const [x, ground] = anchor;
  const directions = bounds.map((rect,i) => ({
    rect,
    points:geometry(entry?.frames[i],visible?.frames[i],
      (entry?.uncertaintySourcePixels?.[['front','back','profile','profile'][i]] ?? 18) * (entry?.commonScale ?? 1),
      visibleUncertainty,i),
    rows:[]
  }));
  const front = directions[0];
  for (const [index,direction] of directions.entries()) {
    const a = front.points, b = direction.points;
    const add = (key,label,target,value,targetError=0,valueError=0) => {
      if (target > 0 && value > 0) direction.rows.push({key,label,target,value,targetError,valueError});
    };
    if (a && b) {
      const depthRatio = index >= 2 ? .9 : 1;
      add('height','두개골 높이',a.height,b.height,a.uncertainty,b.uncertainty);
      add('depth',index>=2?'두개골 측면 폭':'두개골 폭',a.ellipse[2]*depthRatio,b.ellipse[2],a.uncertainty*depthRatio,b.uncertainty);
      add('crown','두개골 꼭대기',ground-a.crown[1],ground-b.crown[1],a.uncertainty,b.uncertainty);
      for (const [key,label] of layout) {
        if (a[key] && b[key]) add(key,label,ground-a[key][1],ground-b[key][1],a.pointUncertainty[key],b.pointUncertainty[key]);
      }
    }
    add('outline','겉윤곽 꼭대기',ground-front.rect[1],ground-direction.rect[1]);
  }
  const profiles = directions.slice(2);
  const rows = profiles.flatMap(direction=>direction.rows);
  const anatomy = rows.filter(r=>r.key!=='outline');
  const maxScale = Math.min(...profiles.map(direction=>extentLimit(direction.rect,anchor)));
  const structural = fit(anatomy,maxScale);
  const includingOutline = fit(rows,maxScale);
  const uncertain = fit(anatomy,maxScale,true);
  const rearMisses = directions[1].rows.filter(r=>Math.abs(r.target-r.value)>TOLERANCE)
    .map(r=>r.key);
  let verdict = 'missing';
  if (structural) {
    if (!structural.range) verdict = 'shape';
    else if (!includingOutline.range) verdict = 'outline';
    else if (rearMisses.length) verdict = 'rear';
    else verdict = includingOutline.range[0] === 1 ? 'original' : 'scale';
  }
  return { anchor:[x,ground], directions, maxScale, structural, includingOutline, uncertain,
    rearMisses, verdict, reread:Boolean(visible), presets:{
      original:1,
      head:preset(rows.filter(r=>r.key==='height')),
      chin:preset(rows.filter(r=>r.key==='chin')),
      outline:preset(rows.filter(r=>r.key==='outline')),
      balanced:includingOutline.range && structural ? includingOutline.scale : (structural ?? includingOutline).scale
    } };
}
