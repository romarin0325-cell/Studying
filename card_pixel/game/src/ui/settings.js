import { $, $$, svg } from './dom.js';
import { storage } from './storage.js';

const ICON = {
  full: svg('M0 0h5v2H2v3H0zM7 0h5v5h-2V2H7zM0 7h2v3h3v2H0zM10 7h2v5H7v-2h3z'),
  shrink: svg('M3 0h2v5H0V3h3zM7 0h2v3h3v2H7zM0 7h5v5H3V9H0zM7 7h5v2H9v3H7z'),
  gear: svg('M0 1h12v2H0zM7 0h3v4H7zM0 5h12v2H0zM2 4h3v4H2zM0 9h12v2H0zM6 8h3v4H6z')
};
export const tools = () => '<button class="b-full ic" aria-label="' + (document.fullscreenElement ? '전체화면 나가기' : '전체화면') + '"><span class="i-full">' + ICON.full + '</span><span class="i-shrink">' + ICON.shrink + '</span></button><button class="b-set ic" aria-label="설정">' + ICON.gear + '</button>';

const SETTINGS_KEY = 'relaymare.settings';

export function createSettings(St, audio, sheets, clearRecords) {
  const { sfx } = audio;
  const { openSheet, sheet } = sheets;

  /* ---------- fullscreen and settings (every screen carries the two icons) ---------- */
  const fsSupported = !!document.documentElement.requestFullscreen;   // iOS Safari has no page fullscreen
  function syncFullscreen() {
    const root = document.documentElement;
    root.classList.toggle('nofs', !fsSupported); root.classList.toggle('fs', !!document.fullscreenElement);
    $$('.b-full').forEach(b => b.setAttribute('aria-label', document.fullscreenElement ? '전체화면 나가기' : '전체화면'));
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { await document.documentElement.requestFullscreen(); } }
    } catch (e) { sheet('전체화면', '이 브라우저에서는 전체화면을 열지 못했다. 브라우저 메뉴에서 다시 시도해 보자.'); }
    syncFullscreen();
  }
  document.addEventListener('fullscreenchange', syncFullscreen);
  function syncOutline() {
    document.documentElement.classList.toggle('meta-rim', St.RIM.on);
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}');
      if (typeof saved.sound === 'boolean') audio.soundOn = saved.sound;
      if (typeof saved.rim === 'boolean') St.RIM.on = saved.rim;
    } catch { /* Keep defaults for an invalid settings entry. */ }
    syncOutline();
  }
  function saveSettings() {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ sound: audio.soundOn, rim: St.RIM.on }));
  }

  function settingsSheet() {
    const row = (k, label, on, sub) => '<button class="tog' + (on ? ' on' : '') + '" data-set="' + k + '"><b>' + label + '</b><small>' + sub + '</small><span>' + (on ? '켜짐' : '꺼짐') + '</span></button>';
    openSheet('설정', '<div class="meta-sheet togs">' + row('sound', '소리', audio.soundOn, '효과음') +
      row('rim', '윤곽선 강조', St.RIM.on, '동료와 적의 윤곽을 밝게 표시한다.') +
      (fsSupported ? row('full', '전체화면', !!document.fullscreenElement, '주소창과 탭을 숨긴다.') : '') +
      '<button class="btn meta-danger" id="meta-erase">기록 지우기</button></div>');
    $$('#sheet .tog').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.set;
      if (k === 'sound') { audio.soundOn = !audio.soundOn; audio.unlockAudio(); }
      else if (k === 'rim') { St.RIM.on = !St.RIM.on; syncOutline(); }
      else if (k === 'full') await toggleFullscreen();
      saveSettings(); settingsSheet();
    }));
    $('#meta-erase').addEventListener('click', () => {
      openSheet('기록을 지울까요?', `<div class="meta-sheet meta-erase-confirm">
        <p>동료, 수첩, 기록과 진행 중인 원정을 모두 지운다. 되돌릴 수 없다.</p>
        <button class="btn" id="meta-erase-back">취소</button>
        <button class="btn meta-danger" id="meta-erase-confirm">모든 기록 지우기</button>
      </div>`);
      $('#meta-erase-back').addEventListener('click', settingsSheet);
      $('#meta-erase-confirm').addEventListener('click', clearRecords);
    });
  }
  document.addEventListener('click', ev => {
    const t = ev.target.closest('.b-full, .b-set');
    if (!t) return;
    audio.unlockAudio();
    sfx.tap();
    if (t.classList.contains('b-full')) toggleFullscreen();
    else settingsSheet();
  });

  return { loadSettings, syncFullscreen, settingsSheet };
}
