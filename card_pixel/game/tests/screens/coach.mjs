export async function checkCoachPlacement(page, id, selector) {
  await page.waitForFunction(({ id, selector }) => {
    const layer = document.querySelector('.coach:not([hidden])');
    if (layer?.dataset.coachStep !== id) return false;
    const hole = layer.querySelector('.coach-ring').getBoundingClientRect();
    const bubble = layer.querySelector('.coach-say').getBoundingClientRect();
    const inside = rect => rect.width > 0 && rect.height > 0 &&
      rect.top >= 0 && rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    if (!inside(bubble) || !inside(hole) || (bubble.bottom > hole.top && hole.bottom > bubble.top)) return false;
    for (const button of layer.querySelectorAll('.coach-buttons button:not([hidden])')) {
      const box = button.getBoundingClientRect();
      if (!inside(box) || box.bottom > bubble.bottom || box.top < bubble.top) return false;
    }
    const header = document.querySelector('.run-screen.on > header.top');
    const targets = [...document.querySelectorAll(selector)].filter(node => !node.disabled &&
      node.checkVisibility({ visibilityProperty: true }));
    let visible = 0;
    for (const target of targets) {
      let { left, right, top, bottom } = target.getBoundingClientRect();
      left = Math.max(left, 0); right = Math.min(right, innerWidth);
      top = Math.max(top, header?.getBoundingClientRect().bottom ?? 0); bottom = Math.min(bottom, innerHeight);
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(parent);
        const port = parent.getBoundingClientRect();
        if (overflowX !== 'visible') {
          left = Math.max(left, port.left + parent.clientLeft);
          right = Math.min(right, port.left + parent.clientLeft + parent.clientWidth);
        }
        if (overflowY !== 'visible') {
          top = Math.max(top, port.top + parent.clientTop);
          bottom = Math.min(bottom, port.top + parent.clientTop + parent.clientHeight);
        }
      }
      if (right - left <= 2 || bottom - top <= 2) continue;
      visible++;
      if (hole.left > left + 1 || hole.right < right - 1 || hole.top > top + 1 || hole.bottom < bottom - 1) return false;
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      if (!target.contains(hit)) return false;
    }
    return visible > 0;
  }, { id, selector });
}
