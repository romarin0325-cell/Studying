export function fullscreenActive(doc = document) {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}
export async function toggleFullscreen(doc = document) {
  if (fullscreenActive(doc)) {
    const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    try { await exit?.call(doc); }
    catch { return '전체화면을 종료하지 못했습니다. 브라우저의 전체화면 종료 기능을 이용하세요.'; }
    return '';
  }
  const request = doc.documentElement.requestFullscreen ?? doc.documentElement.webkitRequestFullscreen;
  if (!request) return '이 브라우저에서는 홈 화면에 추가하여 넓은 화면으로 플레이할 수 있습니다.';
  try {
    await request.call(doc.documentElement, { navigationUI: 'hide' });
  } catch {
    try { await request.call(doc.documentElement); }
    catch { return '전체화면 전환을 허용하지 않았습니다. 현재 화면에서 계속 플레이할 수 있습니다.'; }
  }
  return '';
}
export function bindFullscreen(root) {
  const doc = root.ownerDocument;
  const sync = () => root.querySelectorAll('[data-action="fullscreen"]').forEach(button => {
    button.setAttribute('aria-label', fullscreenActive(doc) ? '전체화면 종료' : '전체화면');
    button.setAttribute('aria-pressed', String(fullscreenActive(doc)));
  });
  root.querySelectorAll('[data-action="fullscreen"]').forEach(button => {
    button.onclick = async () => {
      const message = await toggleFullscreen(doc);
      let note = root.querySelector('[data-fullscreen-note]');
      if (message && !note) {
        note = doc.createElement('p'); note.dataset.fullscreenNote = '';
        note.className = 'fullscreen-note'; note.setAttribute('role', 'status'); root.append(note);
      }
      if (note) note.textContent = message;
      sync();
    };
  });
  doc.addEventListener('fullscreenchange', sync);
  doc.addEventListener('webkitfullscreenchange', sync);
  sync();
  return () => {
    doc.removeEventListener('fullscreenchange', sync);
    doc.removeEventListener('webkitfullscreenchange', sync);
  };
}
