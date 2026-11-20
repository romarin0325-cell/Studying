const WIDTH = 366;
const HEIGHT = 350;
const FRAME_MS = 1000 / 60;
const ENTRY_END = 22;
const ZOOM_START = 14;
const ROOM_OPEN = 23;
const FORK = [195, 243];
const BRANCHES = {
  1: [{ center: [276, 203], bends: [[229, 231]] }],
  2: [
    { center: [278, 162], bends: [[220, 209], [248, 186]] },
    { center: [282, 275], bends: [[231, 260], [255, 291]] }
  ],
  3: [
    { center: [278, 162], bends: [[220, 209], [248, 186]] },
    { center: [320, 230], bends: [[235, 240], [272, 252]] },
    { center: [274, 295], bends: [[220, 269], [241, 307]] }
  ]
};
const lastExit = new WeakMap();

export function getWalkLayout(run) {
  const prior = lastExit.get(run);
  const slope = prior?.floor === run.floor - 1 ? prior.slope : 0;
  const entry = [[-100, 326 - slope * 46], [34, 303 - slope * 4], [102, 278], FORK];
  const branches = BRANCHES[run.doors.length].map(({ center, bends }) => ({
    center, path: [FORK, ...bends, [center[0], center[1] + 23]]
  }));
  return { entry, branches };
}

export function mapPosition([x, y]) {
  return [x * 100 / WIDTH + '%', y * 100 / HEIGHT + '%'];
}

function paintPath(canvas, points) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'bevel';
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  for (const [width, color] of [[32, '#130e20b8'], [28, '#a38d8a88'], [24, '#312436ad']]) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.setLineDash([3, 12]);
  ctx.strokeStyle = '#cbb09d66';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function measurePath(points) {
  let length = 0;
  const segments = points.slice(1).map(([x, y], index) => {
    const [fromX, fromY] = points[index];
    const dx = x - fromX, dy = y - fromY;
    const start = length;
    length += Math.hypot(dx, dy);
    return { start, end: length, fromX, fromY, dx, dy };
  });
  return { segments, length };
}

const clamp = value => Math.min(1, Math.max(0, value));
const lerp = (from, to, t) => from + (to - from) * t;
const pixelStep = value => 2 * Math.round(value / 2);

function moveActor(actor, track, distance, step, stance) {
  const segment = track.segments.find(part => part.end >= distance) ?? track.segments.at(-1);
  const t = clamp((distance - segment.start) / (segment.end - segment.start));
  const point = [pixelStep(segment.fromX + segment.dx * t), pixelStep(segment.fromY + segment.dy * t)];
  const [x, y] = mapPosition(point);
  const lift = step >= 0 && Math.floor(step / 2) % 2 ? -2 : 0;
  const lean = stance && step >= 0 ? 6 * segment.dy / Math.hypot(segment.dx, segment.dy) : 0;
  actor.style.transform = 'translate3d(' + x + ',' + y + ',0)';
  actor.style.zIndex = point[1];
  actor.style.setProperty('--foot-lift', lift + 'px');
  actor.style.setProperty('--walk-lean', lean + 'deg');
}

export function mountWalkingMap(scene, layout, { run, instant, open, footstep }) {
  const landscape = scene.querySelector('.map-landscape');
  const trunks = scene.querySelector('.map-trails');
  const canvases = scene.querySelectorAll('.map-trail');
  const doors = scene.querySelectorAll('.map-door');
  const skip = scene.querySelector('.map-skip');
  const actors = [...scene.querySelectorAll('.map-walker-anchor')].map(node => ({
    node, seat: Number(node.dataset.seat)
  }));
  paintPath(canvases[0], layout.entry);
  const tracks = layout.branches.map((branch, index) => {
    paintPath(canvases[index + 1], branch.path);
    return measurePath([...layout.entry, ...branch.path.slice(1)]);
  });
  const entryTrack = measurePath(layout.entry);
  const readyDistance = entryTrack.length - 31;
  let raf = 0, completed = false;

  function play(lastFrame, draw, finish) {
    const start = performance.now();
    function tick(now) {
      if (!scene.isConnected) return;
      const frame = Math.min(lastFrame, Math.max(0, Math.floor((now - start) / FRAME_MS)));
      draw(frame);
      if (frame === lastFrame) finish?.();
      else raf = requestAnimationFrame(tick);
    }
    draw(0);
    raf = requestAnimationFrame(tick);
  }

  function enter(frame) {
    const approach = clamp((frame - 5) / 8);
    scene.dataset.walkPhase = frame === ENTRY_END ? 'ready' : 'arrival';
    landscape.style.transform = 'translateX(' + (approach * 2 - 2) + 'px)';
    trunks.style.transform = 'translateX(' + (approach * 4 - 4) + 'px)';
    scene.style.setProperty('--branch-light', clamp((frame - 13) / 9));
    for (const { node, seat } of actors) {
      const step = frame - 5 - seat * 2;
      const distance = lerp(106, readyDistance, clamp(step / 8)) - seat * 39;
      moveActor(node, entryTrack, distance, step < 8 ? step : -1, false);
    }
  }

  function walkThrough(index) {
    if (completed) return;
    completed = true;
    cancelAnimationFrame(raf);
    if (!scene.isConnected) return;
    const y = layout.branches[index].center[1];
    lastExit.set(run, { floor: run.floor, slope: y < 188 ? -1 : y > 253 ? 1 : 0 });
    open();
  }

  function select(index) {
    cancelAnimationFrame(raf);
    if (instant()) return walkThrough(index);
    enter(ENTRY_END);
    skip.hidden = false;
    skip.onclick = () => walkThrough(index);
    const track = tracks[index];
    const zoom = doors[index].querySelector('.map-door-frame');
    doors[index].classList.add('chosen');
    canvases[index + 1].classList.add('chosen');
    let footsteps = 0;

    play(ROOM_OPEN, frame => {
      scene.dataset.walkPhase = frame < 4 ? 'chosen' : frame < ZOOM_START ? 'walking' : 'zoom';
      for (const { node, seat } of actors) {
        const step = frame - 3 - seat * 2;
        const distance = lerp(readyDistance, track.length, clamp(step / 10)) - seat * 39;
        moveActor(node, track, distance, step < 10 ? step : -1, true);
      }
      const due = Number(frame >= 5) + Number(frame >= 11);
      while (footsteps < due) {
        footstep();
        footsteps++;
      }
      const progress = clamp((frame - (ZOOM_START - 1)) / 9);
      scene.style.setProperty('--other-paths', 1 - progress);
      scene.style.setProperty('--scene-opacity', 1 - progress);
      zoom.style.transform = 'scale(' + (1 + 14 * progress ** 2) + ')';
      zoom.style.setProperty('--door-dark', clamp((progress - .43) / .57));
    }, () => walkThrough(index));
  }

  if (instant()) enter(ENTRY_END);
  else play(ENTRY_END, enter);
  return select;
}
