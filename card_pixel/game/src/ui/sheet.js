import { $, esc } from './dom.js';

export function sheetMarkup() {
  return '<div class="sheet" id="sheet"><div class="in win"><h3 id="sh-title"></h3><div id="sh-body" class="shbody"></div><button class="btn" id="b-sheetclose">닫기</button></div></div>';
}

/* Reading a detail sheet pauses the battle clock. */
export function createSheet(stage) {
  function openSheet(title, html) {
    $('#sh-title').textContent = title;
    const body = $('#sh-body');
    body.innerHTML = html;
    body.scrollTop = 0;
    $('#sheet').classList.add('on');
    stage.pause(true);
  }

  function closeSheet() {
    $('#sheet').classList.remove('on');
    stage.pause(false);
  }

  function sheet(title, body) {
    openSheet(title, '<p>' + esc(body) + '</p>');
  }

  $('#b-sheetclose').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', event => {
    if (event.target.id === 'sheet') closeSheet();
  });

  return { openSheet, closeSheet, sheet };
}
