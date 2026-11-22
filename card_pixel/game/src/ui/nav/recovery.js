import { $, esc } from '../dom.js';
import { DUNGEONS } from '../../content/dungeons.js';

const BACKUP_ERRORS = {
  invalid_format: 'RELAYMARE 기록 파일을 선택해 주세요.',
  invalid_session: '파일의 동료와 수첩 기록이 손상되었습니다.',
  invalid_run: '파일의 진행 중 원정 기록이 손상되었습니다.',
  invalid_daily: '파일의 오늘의 균열 기록이 손상되었습니다.',
  invalid_settings: '파일의 설정 데이터가 손상되었습니다.',
  storage_failed: '파일 기록을 저장하지 못했습니다.'
};

function comparisonColumn(title, data, summary) {
  const profile = data.session?.profile;
  const { dungeonId, floor, dailyActive } = summary ?? {};
  const rows = [
    ['영입 동료', profile && summary ? `${summary.recruits}명` : '확인 불가'],
    ['완료한 원정', profile?.records ? `${profile.records.runs}회` : '확인 불가'],
    ['수첩 완료', profile?.notebook ? `${profile.notebook.chapters.length}장` : '확인 불가'],
    ['진행 중 원정', dungeonId ? `${DUNGEONS[dungeonId]?.name ?? dungeonId} ${floor}층` : '없음'],
    ['균열 공식 도전', summary?.dailyOfficialStarts == null ? '확인 불가' :
      `${summary.dailyOfficialStarts}회 · 정산 ${summary.dailyOfficialResults ?? 0}회`],
    ['진행 중 균열', dailyActive ? `${dailyActive.dayKey} · ${dailyActive.floor}층` : '없음']
  ];
  return `<section><h4>${title}</h4><dl>${rows.map(([label, value]) =>
    `<dt>${label}</dt><dd>${esc(value)}</dd>`).join('')}</dl></section>`;
}

export function bindRecoveryImport(node, { sheets, store, currentBackup, recovered }) {
  const input = $('#meta-recovery-file', node);
  const action = $('[data-backup-action="import"]', node);
  const feedback = $('.meta-feedback', node);
  action.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    action.disabled = true;
    feedback.textContent = '';
    let data;
    try { data = JSON.parse(await file.text()); } catch { /* Report invalid files on the recovery page. */ }
    if (!input.isConnected) return;
    action.disabled = false;
    const imported = store.inspectBackup?.(data);
    if (!imported?.ok) {
      feedback.textContent = BACKUP_ERRORS[imported?.reason] ?? BACKUP_ERRORS.invalid_format;
      return;
    }
    const previous = currentBackup({ lastGood: true });
    const current = store.inspectBackup(previous);
    sheets.openSheet('기록 가져오기 확인', `<div class="meta-sheet meta-backup">
      <div class="meta-backup-compare">
        ${comparisonColumn('직전 기록', previous, current.summary)}
        ${comparisonColumn('파일 기록', data, imported.summary)}
      </div>
      ${imported.warnings?.includes('invalid_daily') ? '<p>파일의 손상된 균열 기록은 별도 보관합니다.</p>' : ''}
      <p>가져오기를 진행하면 이 브라우저의 기록이 파일 기록으로 대체됩니다.</p>
      <p class="meta-feedback" role="status"></p>
      <button class="btn" id="meta-backup-repick">다른 파일 고르기</button>
      <button class="btn go" id="meta-backup-confirm">파일 기록으로 복원</button>
    </div>`);
    $('#meta-backup-repick').addEventListener('click', () => {
      sheets.closeSheet();
      input.click();
    });
    $('#meta-backup-confirm').addEventListener('click', event => {
      const restored = store.restoreBackup?.(data);
      if (restored?.ok) {
        event.currentTarget.disabled = true;
        recovered();
      } else $('#sh-body .meta-feedback').textContent = BACKUP_ERRORS[restored?.reason] ?? '기록을 복원하지 못했습니다.';
    });
  });
}
