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
    <i class="coach-shade"></i><i class="coach-shade"></i><i class="coach-shade"></i><i class="coach-shade"></i>
    <span class="coach-ring" aria-hidden="true"></span>
    <div class="coach-say win">
      <span class="coach-face">${face}</span>
      <p class="coach-line" aria-live="polite"></p>
      <div class="coach-buttons">
        <button type="button" class="btn coach-next">알겠어</button>
        <button type="button" class="btn coach-skip">건너뛰기</button>
      </div>
    </div>`;
  document.body.append(root);
  const shades = [...root.querySelectorAll('.coach-shade')];
  const ring = $('.coach-ring', root);
  const say = $('.coach-say', root);
  const line = $('.coach-line', root);
  const next = $('.coach-next', root);
  const skip = $('.coach-skip', root);
  let current;
  let targets = [];
  let visible = [];
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
    const rects = targets.map(target => visibleRect(target, { ...bounds, top: targetTop }));
    visible = targets.filter((_, index) => rects[index]);
    const holes = rects.filter(Boolean);
    const left = holes.length ? Math.max(bounds.left, Math.floor(Math.min(...holes.map(r => r.left))) - PAD) : 0;
    const right = holes.length ? Math.min(bounds.right, Math.ceil(Math.max(...holes.map(r => r.right))) + PAD) : 0;
    const top = holes.length ? Math.max(targetTop, Math.floor(Math.min(...holes.map(r => r.top))) - PAD) : bounds.bottom;
    const bottom = holes.length ? Math.min(bounds.bottom, Math.ceil(Math.max(...holes.map(r => r.bottom))) + PAD) : bounds.bottom;
    say.style.left = bounds.left + GAP + 'px';
    say.style.width = Math.max(0, bounds.right - bounds.left - 2 * GAP) + 'px';
    const aboveSpace = top - bounds.top - 2 * GAP;
    const belowSpace = bounds.bottom - bottom - 2 * GAP;
    const above = aboveSpace >= belowSpace;
    const space = Math.max(0, aboveSpace, belowSpace);
    const height = say.offsetHeight + Math.max(0, line.scrollHeight - line.clientHeight);
    if (reserve && targets.length > 1 && space < height) {
      const port = targets[0].closest('.scroll, .run-route');
      if (port && targets.every(target => port.contains(target))) {
        const room = port.getBoundingClientRect();
        const available = above ? room.top - bounds.top : bounds.bottom - room.bottom;
        const extra = Math.min(port.clientHeight / 2, Math.max(0, height + 2 * GAP + PAD - available));
        if (extra > 0) {
          reservedPort = port;
          port.style.setProperty(above ? 'margin-block-start' : 'margin-block-end', extra + 'px');
          scrollIntoView(targets[0]);
          return place();
        }
      }
    }
    placeBox(shades[0], 0, 0, innerWidth, top);
    placeBox(shades[1], 0, bottom, innerWidth, innerHeight - bottom);
    placeBox(shades[2], 0, top, left, bottom - top);
    placeBox(shades[3], right, top, innerWidth - right, bottom - top);
    placeBox(ring, left, top, right - left, bottom - top);
    say.style.maxHeight = space + 'px';
    say.style.top = (above ? top - Math.min(say.offsetHeight, space) - GAP : bottom + GAP) + 'px';
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
    ring.classList.remove('nudge');
    void ring.offsetWidth;
    ring.classList.add('nudge');
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

  function show(step, buttons) {
    if (current?.id === step.id && buttons.every((button, index) => button === targets[index]) &&
      buttons.length === targets.length) return;
    const previous = current;
    clearReservation();
    current = step;
    targets = buttons;
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
    visible = [];
    root.hidden = true;
    delete root.dataset.coachStep;
  }

  return { show, hide, get id() { return current?.id; } };
}
