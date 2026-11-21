import { $ } from './dom.js';

const PAD = 4;
const GAP = 10;

function placeBox(node, left, top, width, height) {
  Object.assign(node.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
}

function portBounds(node) {
  const rect = node.getBoundingClientRect();
  const left = rect.left + node.clientLeft, top = rect.top + node.clientTop;
  return { left, top, right: left + node.clientWidth, bottom: top + node.clientHeight };
}

function scrollIntoView(target) {
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (!/auto|scroll/.test(getComputedStyle(parent).overflowY)) continue;
    const rect = target.getBoundingClientRect();
    const port = portBounds(parent);
    if (rect.top < port.top || rect.height > parent.clientHeight) parent.scrollTop += rect.top - port.top - PAD;
    else if (rect.bottom > port.bottom) parent.scrollTop += rect.bottom - port.bottom + PAD;
  }
}

function visibleRect(target, bounds) {
  if (!target.getClientRects().length || target.disabled || getComputedStyle(target).visibility !== 'visible') return null;
  const rect = target.getBoundingClientRect();
  let { left, top, right, bottom } = rect;
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(parent);
    if (overflowX === 'visible' && overflowY === 'visible') continue;
    const port = portBounds(parent);
    if (overflowX !== 'visible') { left = Math.max(left, port.left); right = Math.min(right, port.right); }
    if (overflowY !== 'visible') { top = Math.max(top, port.top); bottom = Math.min(bottom, port.bottom); }
  }
  left = Math.max(left, bounds.left); right = Math.min(right, bounds.right);
  top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom);
  return right - left > 2 && bottom - top > 2 ? { left, top, right, bottom } : null;
}

export function createCoach({ face, pause }) {
  const frame = $('#frame');
  const root = document.createElement('div');
  root.className = 'coach';
  root.hidden = true;
  root.innerHTML = `
    <i class="coach-shade" aria-hidden="true"></i>
    <div class="coach-say win">
      <span class="coach-face">${face}</span>
      <p class="coach-line" aria-live="polite"></p>
      <div class="coach-buttons">
        <button type="button" class="btn coach-next">알겠어</button>
        <button type="button" class="btn coach-skip">건너뛰기</button>
      </div>
    </div>`;
  document.body.append(root);
  const shade = $('.coach-shade', root);
  const say = $('.coach-say', root);
  const line = $('.coach-line', root);
  const next = $('.coach-next', root);
  const skip = $('.coach-skip', root);
  let current;
  let targets = [];
  let groups = [];
  let visible = [];
  const rings = [];
  let reservedPort;
  let animationFrame;

  function clearReservation() {
    reservedPort?.style.removeProperty('margin-block-start');
    reservedPort?.style.removeProperty('margin-block-end');
    reservedPort = null;
  }

  function place(reserve = false) {
    const frameRect = frame.getBoundingClientRect();
    const bounds = { left: Math.max(0, frameRect.left), right: Math.min(innerWidth, frameRect.right),
      top: Math.max(0, frameRect.top), bottom: Math.min(innerHeight, frameRect.bottom) };
    const header = frame.querySelector('.run-screen.on > header.top');
    const targetTop = header && targets.every(target => !header.contains(target))
      ? Math.max(bounds.top, header.getBoundingClientRect().bottom) : bounds.top;
    const rects = new Map(groups.flat().map(target => [target, visibleRect(target, { ...bounds, top: targetTop })]));
    visible = targets.filter(target => rects.get(target));
    const holes = groups.flatMap(group => {
      const boxes = group.map(target => rects.get(target)).filter(Boolean);
      if (!boxes.length) return [];
      return [{
        left: Math.max(bounds.left, Math.floor(Math.min(...boxes.map(r => r.left))) - PAD),
        right: Math.min(bounds.right, Math.ceil(Math.max(...boxes.map(r => r.right))) + PAD),
        top: Math.max(targetTop, Math.floor(Math.min(...boxes.map(r => r.top))) - PAD),
        bottom: Math.min(bounds.bottom, Math.ceil(Math.max(...boxes.map(r => r.bottom))) + PAD)
      }];
    }).sort((a, b) => a.top - b.top);
    say.style.left = bounds.left + GAP + 'px';
    say.style.width = Math.max(0, bounds.right - bounds.left - 2 * GAP) + 'px';
    let previous = bounds.top;
    const gaps = holes.map(hole => {
      const gap = { start: previous, end: hole.top };
      previous = Math.max(previous, hole.bottom);
      return gap;
    });
    gaps.push({ start: previous, end: bounds.bottom });
    const gap = gaps.reduce((best, next) => next.end - next.start > best.end - best.start ? next : best);
    const space = Math.max(0, gap.end - gap.start - 2 * GAP);
    const height = say.offsetHeight + Math.max(0, line.scrollHeight - line.clientHeight);
    const above = gap.start === bounds.top;
    if (reserve && targets.length > 1 && space < height) {
      const port = targets[0].closest('.scroll, .scroll-list, .run-route');
      const summary = groups.length > 1 && port?.matches('.scroll-list') ? port.previousElementSibling : null;
      if (port && (groups.length === 1 || summary?.classList.contains('fixed-top')) &&
        targets.every(target => port.contains(target))) {
        const room = port.getBoundingClientRect();
        // Keep the highlighted summary above the bubble and the choices below it.
        const start = summary ? summary.getBoundingClientRect().bottom + PAD : bounds.top;
        const beforeList = summary || above;
        const available = beforeList ? room.top - start : bounds.bottom - room.bottom;
        const extra = Math.min(port.clientHeight / 2, Math.max(0, height + 2 * GAP + PAD - available));
        if (extra > 0) {
          reservedPort = port;
          port.style.setProperty(beforeList ? 'margin-block-start' : 'margin-block-end', extra + 'px');
          scrollIntoView(targets[0]);
          return place();
        }
      }
    }
    const rectangle = ({ left, top, right, bottom }) => `M${left} ${top}H${right}V${bottom}H${left}Z`;
    shade.style.clipPath = `path(evenodd, "${rectangle({ left: 0, top: 0, right: innerWidth, bottom: innerHeight })}${holes.map(rectangle).join('')}")`;
    while (rings.length > holes.length) rings.pop().remove();
    for (const [index, { left, right, top, bottom }] of holes.entries()) {
      if (!rings[index]) {
        const ring = document.createElement('span');
        ring.className = 'coach-ring';
        ring.setAttribute('aria-hidden', 'true');
        root.insertBefore(ring, say);
        rings.push(ring);
      }
      placeBox(rings[index], left, top, right - left, bottom - top);
    }
    say.style.maxHeight = space + 'px';
    say.style.top = (above ? gap.end - Math.min(say.offsetHeight, space) - GAP : gap.start + GAP) + 'px';
  }

  function follow() {
    if (!current) return;
    if (!targets.some(target => target.isConnected && target.getClientRects().length && !target.disabled)) return hide();
    place();
    animationFrame = requestAnimationFrame(follow);
  }

  function canActivate() {
    return !current.acknowledge || current.activate;
  }

  function nudge() {
    for (const ring of rings) ring.classList.remove('nudge');
    void root.offsetWidth;
    for (const ring of rings) ring.classList.add('nudge');
  }

  function block(event) {
    if (!current || say.contains(event.target)) return;
    if (event.type !== 'contextmenu' && canActivate() && targets.some(target => target.contains(event.target))) {
      place();
      if (visible.some(target => target.contains(event.target))) {
        if (event.type === 'click') current.activate?.();
        return;
      }
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    nudge();
  }

  for (const type of ['pointerdown', 'click', 'contextmenu']) document.addEventListener(type, block, true);
  document.addEventListener('keydown', event => {
    if (!current || event.key !== 'Tab') return;
    const controls = [...(canActivate() ? targets : []), next, skip].filter(button => !button.hidden && !button.disabled);
    const focused = controls.indexOf(document.activeElement);
    const index = focused < 0 ? (event.shiftKey ? controls.length - 1 : 0) :
      (focused + controls.length + (event.shiftKey ? -1 : 1)) % controls.length;
    event.preventDefault();
    const control = controls[index];
    if (targets.includes(control)) scrollIntoView(control);
    control?.focus({ preventScroll: true });
    place();
  });
  next.addEventListener('click', () => {
    const target = targets[0];
    current?.acknowledge?.();
    target?.focus({ preventScroll: true });
  });
  skip.addEventListener('click', () => current?.skip?.());
  window.addEventListener('resize', () => {
    if (!current) return;
    clearReservation();
    scrollIntoView(targets.find(target => target === document.activeElement) ?? targets[0]);
    place(true);
  });

  function show(step, buttons, spotlights = [buttons]) {
    if (current?.id === step.id && current.line === step.line && buttons.every((button, index) => button === targets[index]) &&
      buttons.length === targets.length) return;
    const previous = current;
    clearReservation();
    current = step;
    targets = buttons;
    groups = spotlights;
    root.hidden = false;
    root.dataset.coachStep = step.id;
    line.textContent = step.line;
    next.hidden = !step.acknowledge;
    skip.hidden = !step.skip;
    if (previous?.battle !== step.battle) pause(!!step.battle);
    cancelAnimationFrame(animationFrame);
    const first = buttons[0];
    say.style.maxHeight = '';
    scrollIntoView(first);
    place(true);
    (step.acknowledge ? next : first).focus({ preventScroll: true });
    follow();
  }

  function hide() {
    cancelAnimationFrame(animationFrame);
    clearReservation();
    if (current?.battle) pause(false);
    current = null;
    targets = [];
    groups = [];
    visible = [];
    root.hidden = true;
    delete root.dataset.coachStep;
  }

  return { show, hide, get id() { return current?.id; } };
}
