import { $, esc } from './dom.js';

export function sheetMarkup() {
  return '<div class="sheet" id="sheet"><div class="in win"><h3 id="sh-title"></h3><div id="sh-body" class="shbody"></div><button class="btn" id="b-sheetclose">닫기</button></div></div>';
}

/* Reading a detail sheet pauses the battle clock. */
export function createSheet(stage) {
  let afterDismiss;

  function openSheet(title, html, { onClose } = {}) {
    afterDismiss = onClose;
    $('#sh-title').textContent = title;
    const body = $('#sh-body');
    body.innerHTML = html;
    body.scrollTop = 0;
    $('#sheet').classList.add('on');
    stage.pause(true);
  }

  function closeSheet() {
    afterDismiss = undefined;
    $('#sheet').classList.remove('on');
    stage.pause(false);
  }

  function sheet(title, body) {
    openSheet(title, '<p>' + esc(body) + '</p>');
  }

  function dismiss() {
    const onClose = afterDismiss;
    closeSheet();
    onClose?.();
  }

  $('#b-sheetclose').addEventListener('click', dismiss);
  $('#sheet').addEventListener('click', event => {
    if (event.target.id === 'sheet') dismiss();
  });

  return { openSheet, closeSheet, sheet };
}
