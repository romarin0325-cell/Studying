import { $ } from './dom.js';

const PAD = 4;
const GAP = 10;

function placeBox(node, left, top, width, height) {
  Object.assign(node.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
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
  const next = $('.coach-next', root);
  const skip = $('.coach-skip', root);
  let current;
  let targets = [];
  let animationFrame;

  function place() {
    const bounds = frame.getBoundingClientRect();
    const rects = targets.map(target => target.getBoundingClientRect());
    const left = Math.max(0, Math.floor(Math.min(...rects.map(r => r.left))) - PAD);
    const right = Math.min(innerWidth, Math.ceil(Math.max(...rects.map(r => r.right))) + PAD);
    const top = Math.max(0, Math.floor(Math.min(...rects.map(r => r.top))) - PAD);
    const bottom = Math.min(innerHeight, Math.ceil(Math.max(...rects.map(r => r.bottom))) + PAD);
    placeBox(shades[0], 0, 0, innerWidth, top);
    placeBox(shades[1], 0, bottom, innerWidth, innerHeight - bottom);
    placeBox(shades[2], 0, top, left, bottom - top);
    placeBox(shades[3], right, top, innerWidth - right, bottom - top);
    placeBox(ring, left, top, right - left, bottom - top);

    say.style.left = Math.max(10, bounds.left + 10) + 'px';
    say.style.width = Math.min(innerWidth - 20, bounds.width - 20) + 'px';
    const height = say.offsetHeight;
    const above = top - Math.max(0, bounds.top) >= height + 2 * GAP;
    say.style.top = (above ? top - height - GAP : bottom + GAP) + 'px';
  }

  function follow() {
    if (!current) return;
    if (targets.some(target => !target.isConnected || !target.getClientRects().length)) return hide();
    place();
    animationFrame = requestAnimationFrame(follow);
  }

  function allowed(node) {
    return (!current.acknowledge && targets.some(target => target.contains(node))) ||
      (next.contains(node) && !next.hidden) || (skip.contains(node) && !skip.hidden);
  }

  function nudge() {
    ring.classList.remove('nudge');
    void ring.offsetWidth;
    ring.classList.add('nudge');
  }

  function block(event) {
    if (!current || allowed(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    nudge();
  }

  for (const type of ['pointerdown', 'click', 'contextmenu']) document.addEventListener(type, block, true);
  document.addEventListener('keydown', event => {
    if (!current || event.key !== 'Tab') return;
    const controls = [...(current.acknowledge ? [] : targets), next, skip].filter(button => !button.hidden && !button.disabled);
    const focused = controls.indexOf(document.activeElement);
    const index = focused < 0 ? (event.shiftKey ? controls.length - 1 : 0) :
      (focused + controls.length + (event.shiftKey ? -1 : 1)) % controls.length;
    event.preventDefault();
    controls[index]?.focus({ preventScroll: true });
  });
  next.addEventListener('click', () => {
    const target = targets[0];
    current?.acknowledge?.();
    target?.focus({ preventScroll: true });
  });
  skip.addEventListener('click', () => current?.skip?.());

  function show(step, buttons) {
    if (current?.id === step.id && buttons.every((button, index) => button === targets[index]) &&
      buttons.length === targets.length) return;
    const previous = current;
    current = step;
    targets = buttons;
    root.hidden = false;
    root.dataset.coachStep = step.id;
    $('.coach-line', root).textContent = step.line;
    next.hidden = !step.acknowledge;
    skip.hidden = !step.skip;
    if (previous?.battle !== step.battle) pause(!!step.battle);
    cancelAnimationFrame(animationFrame);
    const first = buttons[0];
    const last = buttons.at(-1);
    // Position the scroll pane around enabled controls before measuring the hole.
    first.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (last !== first) last.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    (step.acknowledge ? next : first).focus({ preventScroll: true });
    follow();
  }

  function hide() {
    cancelAnimationFrame(animationFrame);
    if (current?.battle) pause(false);
    current = null;
    targets = [];
    root.hidden = true;
    delete root.dataset.coachStep;
  }

  return { show, hide, get id() { return current?.id; } };
}
