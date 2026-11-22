import { $, $$, esc } from './dom.js';

const TABBABLE = 'button, input, select, textarea, a[href], summary, [tabindex], [contenteditable="true"]';
const canFocus = node => node?.isConnected && !node.matches(':disabled') && !node.closest('[inert]') &&
  node.getClientRects().length > 0 && getComputedStyle(node).visibility === 'visible';
const tabStops = scope => $$(TABBABLE, scope).filter(node => node.tabIndex >= 0 && canFocus(node));
const activeResult = () => $('#battle.on #result.on');

export function focusPrimary(scope) {
  const controls = tabStops(scope);
  const primary = controls.find(node => node.matches('.go, .claim, #b-start, #b-next, #b-go')) ??
    controls.find(node => node.matches('#acts .act, .fixed-foot button')) ?? controls[0];
  primary?.focus({ preventScroll: true });
}

export function sheetMarkup() {
  return '<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-title"><div class="in win"><h3 id="sh-title" tabindex="-1"></h3><div id="sh-body" class="shbody"></div><button class="btn" id="b-sheetclose">닫기</button></div></div>';
}

/* Reading a detail sheet pauses the battle clock. */
export function createSheet(stage) {
  const panel = $('#sheet');
  const heading = $('#sh-title');
  const body = $('#sh-body');
  const closeButton = $('#b-sheetclose');
  let afterDismiss;
  let opening;

  function openSheet(title, html, { onClose, variant, latest, opener = document.activeElement } = {}) {
    if (!opening) {
      const result = activeResult();
      opening = { opener: opener === document.body ? null : opener, result };
      if (result) result.inert = true;
    }
    afterDismiss = onClose;
    heading.textContent = title;
    body.innerHTML = html;
    panel.classList.toggle('battle-log-sheet', variant === 'battle-log');
    panel.classList.add('on');
    body.scrollTop = latest ? body.scrollHeight : 0;
    const target = latest ? $(latest, body) : null;
    const focus = canFocus(target) ? target : tabStops(body)[0] ?? heading;
    focus.focus({ preventScroll: true });
    if (target) body.scrollTop = target.offsetTop;
    stage.pause(true);
  }

  function restoreFocus(opener) {
    const result = activeResult();
    if ((!result || result.contains(opener)) && canFocus(opener)) {
      opener.focus({ preventScroll: true });
      if (document.activeElement === opener) return;
    }
    const screen = result ?? $('.screen.on');
    if (screen) focusPrimary(screen);
  }

  function closeSheet() {
    const closed = opening;
    opening = undefined;
    afterDismiss = undefined;
    panel.classList.remove('on', 'battle-log-sheet');
    stage.pause(false);
    if (closed) {
      if (closed.result) closed.result.inert = false;
      restoreFocus(closed.opener);
      // Closing preparation can synchronously render a new copy of the screen.
      queueMicrotask(() => {
        if (!opening && document.activeElement === document.body) restoreFocus(closed.opener);
      });
    }
  }

  function sheet(title, body, options) {
    openSheet(title, '<p>' + esc(body) + '</p>', options);
  }

  function dismiss() {
    const onClose = afterDismiss;
    closeSheet();
    onClose?.();
  }

  closeButton.addEventListener('click', dismiss);
  panel.addEventListener('click', event => {
    if (event.target === panel) dismiss();
  });
  document.addEventListener('keydown', event => {
    if (!['Tab', 'Escape'].includes(event.key)) return;
    const scope = opening ? panel : activeResult();
    if (!scope || (!opening && (event.key !== 'Tab' || $('.coach:not([hidden])') || event.target?.closest?.('dialog[open]')))) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      if (event.repeat) return;
      const current = opening;
      closeButton.click(); // Also run the navigation's normal close-button handler.
      if (opening === current) dismiss(); // A tutorial spotlight can intercept the click.
      return;
    }

    const controls = tabStops(scope);
    if (event.shiftKey) controls.reverse();
    const active = document.activeElement;
    const index = controls.indexOf(active);
    const next = index >= 0 ? controls[index + 1] : scope.contains(active)
      ? controls.find(node => active.compareDocumentPosition(node) &
          (event.shiftKey ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING)) : null;
    (next ?? controls[0] ?? (opening ? heading : scope)).focus();
  }, true);

  return { openSheet, closeSheet, sheet };
}
