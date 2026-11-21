import { $, $$, esc, svg } from './dom.js';
import { storage } from './storage.js';
import * as Save from '../engine/save.js';
import { DUNGEONS } from '../content/dungeons.js';

const ICON = {
  full: svg('M0 0h5v2H2v3H0zM7 0h5v5h-2V2H7zM0 7h2v3h3v2H0zM10 7h2v5H7v-2h3z'),
  shrink: svg('M3 0h2v5H0V3h3zM7 0h2v3h3v2H7zM0 7h5v5H3V9H0zM7 7h5v2H9v3H7z'),
  gear: svg('M0 1h12v2H0zM7 0h3v4H7zM0 5h12v2H0zM2 4h3v4H2zM0 9h12v2H0zM6 8h3v4H6z')
};
export const tools = () => '<button class="b-full ic" aria-label="' + (document.fullscreenElement ? '전체화면 나가기' : '전체화면') + '"><span class="i-full">' + ICON.full + '</span><span class="i-shrink">' + ICON.shrink + '</span></button><button class="b-set ic" aria-label="설정">' + ICON.gear + '</button>';

const SETTINGS_KEY = 'relaymare.settings';

function readingSettings(raw) {
  return Save.normalizeSettings?.(raw) ?? {
    sound: raw?.sound !== false, music: raw?.music !== false, rim: raw?.rim !== false,
    speed: raw?.speed === 2 ? 2 : 1, textScale: raw?.textScale === 1.25 ? 1.25 : 1, markers: raw?.markers !== false
  };
}

export function syncBattleSpeed(stage) {
  const button = $('#b-speed');
  if (!button) return;
  button.textContent = stage.clock.speed + '배';
  button.setAttribute('aria-label', '전투 속도 ' + button.textContent);
  button.classList.toggle('on', stage.clock.speed === 2);
}

export function settingsSnapshot(stage, audio, music) {
  const root = document.documentElement;
  return {
    sound: audio.soundOn, music: music.enabled, rim: stage.RIM.on, speed: stage.clock.speed,
    textScale: root.classList.contains('large-text') ? 1.25 : 1,
    markers: root.classList.contains('emphasize-markers')
  };
}

export function createSettings(St, audio, music, sheets, clearRecords) {
  const { sfx } = audio;
  const { openSheet, sheet } = sheets;
  let textScale = 1;
  let markers = true;

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
  function syncReading() {
    const root = document.documentElement;
    root.classList.toggle('meta-rim', St.RIM.on);
    root.classList.toggle('large-text', textScale === 1.25);
    root.classList.toggle('emphasize-markers', markers);
    syncBattleSpeed(St);
  }

  function loadSettings() {
    let raw;
    try { raw = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}'); } catch { /* Use defaults. */ }
    const saved = readingSettings(raw);
    audio.soundOn = saved.sound;
    music.setEnabled(saved.music);
    St.RIM.on = saved.rim;
    St.clock.speed = saved.speed;
    textScale = saved.textScale;
    markers = saved.markers;
    syncReading();
  }
  function saveSettings() {
    try {
      storage.setItem(SETTINGS_KEY, JSON.stringify(settingsSnapshot(St, audio, music)));
    } catch { /* This visit keeps the changed settings in memory. */ }
  }

  function toggleBattleSpeed() {
    St.clock.speed = St.clock.speed === 1 ? 2 : 1;
    syncBattleSpeed(St);
    saveSettings();
  }

  function settingsSheet() {
    const row = (k, label, on, sub = '', value = on ? '켜짐' : '꺼짐') =>
      `<button class="tog${on ? ' on' : ''}" data-set="${k}" aria-pressed="${on}"><b>${label}</b>
        ${sub ? `<small>${sub}</small>` : ''}<span>${value}</span></button>`;
    const backup = $('#title.on, #hub.on, #recovery.on') ? `<div class="meta-backup-actions">
      <button class="btn" data-backup-action="export">기록 내보내기</button>
      <button class="btn" data-backup-action="import">기록 가져오기</button>
    </div>` : '';
    openSheet('설정', '<div class="meta-sheet togs">' + row('sound', '소리', audio.soundOn, '효과음') +
      row('music', '음악', music.enabled, '배경 음악') +
      row('rim', '윤곽선 강조', St.RIM.on, '동료와 적의 윤곽을 밝게 표시한다.') +
      row('text', '글자', textScale === 1.25, '', textScale === 1.25 ? '크게(125%)' : '보통') +
      row('markers', '표식 강조', markers, '선택 ✓ · 위험 !') +
      row('speed', '전투 속도', St.clock.speed === 2, '', St.clock.speed + '배') +
      (fsSupported ? row('full', '전체화면', !!document.fullscreenElement, '주소창과 탭을 숨긴다.') : '') +
      backup + '<button class="btn meta-danger" id="meta-erase">기록 지우기</button></div>');
    $$('#sheet .tog').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.set;
      const scroll = $('#sh-body').scrollTop;
      if (k === 'sound') { audio.soundOn = !audio.soundOn; audio.unlockAudio(); }
      else if (k === 'music') music.setEnabled(!music.enabled);
      else if (k === 'rim') St.RIM.on = !St.RIM.on;
      else if (k === 'text') textScale = textScale === 1 ? 1.25 : 1;
      else if (k === 'markers') markers = !markers;
      else if (k === 'speed') toggleBattleSpeed();
      else if (k === 'full') await toggleFullscreen();
      syncReading();
      if (k !== 'speed') saveSettings();
      settingsSheet();
      $('#sh-body').scrollTop = scroll;
      $(`[data-set="${k}"]`)?.focus({ preventScroll: true });
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
    if (ev.target.closest('#b-speed')) return toggleBattleSpeed();
    const t = ev.target.closest('.b-full, .b-set');
    if (!t) return;
    audio.unlockAudio();
    sfx.tap();
    if (t.classList.contains('b-full')) toggleFullscreen();
    else settingsSheet();
  });

  return { loadSettings, syncFullscreen, settingsSheet };
}

const BACKUP_ERROR = {
  invalid_format: 'RELAYMARE 기록 파일을 골라 주세요.',
  invalid_session: '파일의 동료와 수첩 기록이 손상됐다.',
  invalid_run: '파일의 진행 중 원정이 손상됐다.',
  invalid_daily: '파일의 오늘의 균열 기록이 손상됐다.',
  invalid_settings: '파일의 설정이 손상됐다.',
  storage_failed: '저장하지 못했다. 현재 기록은 그대로다.'
};

function backupProgress(summary, backup) {
  const profile = backup?.session?.profile;
  const { dungeonId, floor, dailyActive } = summary ?? {};
  const mainKnown = summary?.recruits != null;
  const rows = [
    ['영입 동료', mainKnown ? summary.recruits + '명' : '확인 불가'],
    ['완료한 원정', mainKnown ? (profile?.records?.runs ?? 0) + '회' : '확인 불가'],
    ['수첩 완료', mainKnown ? (profile?.notebook?.chapters?.length ?? 0) + '장' : '확인 불가'],
    ['진행 중 원정', dungeonId ? `${DUNGEONS[dungeonId]?.name ?? dungeonId} ${Math.max(floor ?? 1, 1)}층`
      : mainKnown ? '없음' : '확인 불가'],
    ['균열 공식 도전', summary?.dailyOfficialStarts != null
      ? `${summary.dailyOfficialStarts}회 · 정산 ${summary.dailyOfficialResults ?? 0}회` : '확인 불가'],
    ['진행 중 균열', dailyActive ? `${dailyActive.dayKey} · ${dailyActive.kind === 'official' ? '기록 도전' : '연습'} · ${dailyActive.floor}층`
      : summary?.dailyOfficialStarts != null ? '없음' : '확인 불가']
  ];
  return rows.map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`).join('');
}

export function openBackupSheet({ mode, sheets, store, currentBackup, recovered }) {
  const { openSheet } = sheets;
  const available = store.exportBackup && store.inspectBackup && (mode === 'export' || store.restoreBackup);
  if (!available) return sheets.sheet('기록 파일', '이 버전에서는 기록 파일 기능을 사용할 수 없다.');

  if (mode === 'export') {
    const backup = currentBackup({ lastGood: true });
    const check = store.inspectBackup(backup);
    if (!check.ok) return sheets.sheet('기록 내보내기', BACKUP_ERROR[check.reason] ?? '내보낼 기록을 확인하지 못했다.');
    const label = backup.session?.profile ? `영입 동료 ${check.summary?.recruits ?? 0}명` : '설정과 균열 기록';
    const active = check.summary?.dailyActive;
    openSheet('기록 내보내기', `<div class="meta-sheet meta-backup"><p>${label}</p>
      ${active ? `<p>균열 ${esc(active.dayKey)} · ${active.floor}층</p>` : ''}
      ${check.warnings?.includes('invalid_daily') ? '<p role="status">손상된 균열 기록은 파일에 따로 보관했다.</p>' : ''}
      <button class="btn go" id="meta-backup-download">기록 파일 받기</button></div>`);
    $('#meta-backup-download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'relaymare-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return;
  }

  function choose(message = '') {
    openSheet('기록 가져오기', `<div class="meta-sheet meta-backup">
      <label for="meta-backup-file">RELAYMARE 기록 파일</label>
      <input id="meta-backup-file" type="file" accept=".json,application/json">
      <p class="meta-feedback" role="status">${esc(message)}</p>
    </div>`);
    const input = $('#meta-backup-file');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { /* Invalid file. */ }
      if (!input.isConnected || !$('#sheet').classList.contains('on')) return;
      const result = store.inspectBackup(data);
      if (!result.ok) return choose(BACKUP_ERROR[result.reason] ?? '기록 파일을 확인하지 못했다.');
      compare(data, result);
    });
  }

  function compare(data, imported) {
    const live = currentBackup();
    const current = store.inspectBackup(live);
    const main = current.ok ? current : store.inspectBackup({ ...live, daily: null });
    const daily = current.ok ? current : store.inspectBackup({ ...live, session: null });
    const currentSummary = {
      ...main.summary,
      dailyOfficialStarts: daily.summary?.dailyOfficialStarts,
      dailyOfficialResults: daily.summary?.dailyOfficialResults,
      dailyActive: daily.summary?.dailyActive
    };
    openSheet('기록 가져오기 확인', `<div class="meta-sheet meta-backup">
      <div class="meta-backup-compare">
        <section><h4>현재 기록</h4><dl>${backupProgress(currentSummary, main.ok ? live : null)}</dl></section>
        <section><h4>파일 기록</h4><dl>${backupProgress(imported.summary, data)}</dl></section>
      </div>
      ${imported.warnings?.includes('invalid_daily') ? '<p>파일의 손상된 균열 기록은 따로 보관한다.</p>' : ''}
      <p>가져오면 이 브라우저의 기록이 파일 기록으로 바뀐다.</p>
      <p class="meta-feedback" role="status"></p>
      <button class="btn" id="meta-backup-repick">다른 파일 고르기</button>
      <button class="btn go" id="meta-backup-confirm">파일 기록으로 복원</button>
    </div>`);
    $('#meta-backup-repick').addEventListener('click', () => choose());
    $('#meta-backup-confirm').addEventListener('click', () => {
      const restored = store.restoreBackup(data);
      if (restored.ok) recovered();
      else $('.meta-backup .meta-feedback').textContent = BACKUP_ERROR[restored.reason] ?? '기록을 복원하지 못했다.';
    });
  }
  choose();
}
