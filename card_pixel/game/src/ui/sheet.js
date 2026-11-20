import { $, esc } from './dom.js';

export function sheetMarkup() {
  return '<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-title"><div class="in win"><h3 id="sh-title"></h3><div id="sh-body" class="shbody"></div><button class="btn" id="b-sheetclose">닫기</button></div></div>';
}

/* Reading a detail sheet pauses the battle clock. */
export function createSheet(stage) {
  let afterDismiss;
  let opener;

  function openSheet(title, html, { onClose, variant, latest } = {}) {
    afterDismiss = onClose;
    opener = latest ? document.activeElement : null;
    $('#sh-title').textContent = title;
    const body = $('#sh-body');
    body.innerHTML = html;
    const panel = $('#sheet');
    panel.classList.toggle('battle-log-sheet', variant === 'battle-log');
    panel.classList.add('on');
    body.scrollTop = latest ? body.scrollHeight : 0;
    if (latest) {
      const target = body.querySelector(latest);
      target?.focus({ preventScroll: true });
      if (target) body.scrollTop = target.offsetTop;
    }
    stage.pause(true);
  }

  function closeSheet() {
    afterDismiss = undefined;
    $('#sheet').classList.remove('on');
    $('#sheet').classList.remove('battle-log-sheet');
    stage.pause(false);
  }

  function sheet(title, body) {
    openSheet(title, '<p>' + esc(body) + '</p>');
  }

  function dismiss() {
    const onClose = afterDismiss;
    const focus = opener;
    closeSheet();
    focus?.focus({ preventScroll: true });
    onClose?.();
  }

  $('#b-sheetclose').addEventListener('click', dismiss);
  $('#sheet').addEventListener('click', event => {
    if (event.target.id === 'sheet') dismiss();
  });

  return { openSheet, closeSheet, sheet };
}
