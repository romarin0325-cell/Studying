import { $ } from '../dom.js';
import { enterRun } from '../run/index.js';
import { dailyResultScreen, dailyResultTitle, openDailyHistory, openDailyPreparation, openEarlierRift, shortRiftDate } from '../screens/daily-rift.js';

export function createDailyNavigation({
  currentProfile, dailyStore, roster, widgets, details, assets, runtime,
  page, showHub, warnSave, sessionNotice, setReview
}) {
  const { audio, sheets } = runtime;
  let dailyRun = null;
  let unsavedDailyResult = null;

  const dailyHost = {
    profile: currentProfile,
    assets,
    runtime,
    save(current) {
      if (current === dailyRun && !dailyStore?.save?.(current)?.ok) warnSave();
    },
    finish: finishDaily
  };

  function hubView() {
    const rift = dailyStore?.view?.(currentProfile(), new Date());
    return unsavedDailyResult ? { ...rift, unsavedResult: unsavedDailyResult.daily?.spec?.dayKey } : rift;
  }

  function showDailyHistory(node) {
    const cursors = [null];
    function render() {
      openDailyHistory(dailyStore.history({ before: cursors.at(-1), limit: 7 }) ?? {}, {
        node, sheets,
        next(cursor) { cursors.push(cursor); render(); },
        previous: cursors.length > 1 ? () => { cursors.pop(); render(); } : null
      });
    }
    render();
  }

  function showDaily(message) {
    if (unsavedDailyResult) return finishDaily(unsavedDailyResult);
    const view = dailyStore?.view?.(currentProfile(), new Date());
    if (!view?.unlocked) return;
    if (view.active) {
      const today = view.dayKey ?? view.spec?.dayKey;
      if (view.active.dayKey && today && view.active.dayKey !== today) return promptDailyResume(view.active);
      return resumeDaily();
    }
    openDailyPreparation(view, {
      roster, widgets, sheets, message, start: startDaily,
      inspectLoan: (id, onClose) => details.charSheet(null, id, { loaned: true, onClose })
    });
  }

  function promptDailyResume(active) {
    openEarlierRift(active, { sheets, resume: resumeDaily, abandon: abandonDaily });
  }

  function startDaily(expectedDayKey, kind) {
    const now = new Date();
    const result = dailyStore?.start?.({ profile: currentProfile(), now, expectedDayKey, kind });
    if (result?.ok && result.run) return enterDaily(result.run);
    if (result?.reason === 'date_changed') {
      const view = dailyStore.view?.(currentProfile(), now);
      const date = shortRiftDate(view?.dayKey ?? view?.spec?.dayKey);
      if ($('#hub').classList.contains('on')) showHub();
      showDaily(date ? `날짜가 변경되었습니다. ${date} 균열을 확인해 주세요.` : '날짜가 변경되었습니다. 오늘의 균열을 확인해 주세요.');
    } else if (['active_exists', 'already_recorded', 'official_required'].includes(result?.reason)) {
      showDaily();
    } else if (result?.reason === 'storage_failed') {
      warnSave();
    } else {
      sessionNotice('균열을 시작하지 못했습니다.');
    }
  }

  function resumeDaily() {
    const restored = dailyStore?.resume?.();
    if (restored?.ok && restored.run) return enterDaily(restored.run);
    sessionNotice('진행 중인 균열을 불러오지 못했습니다.');
    const active = dailyStore?.view?.(currentProfile(), new Date())?.active;
    if (active && !$('#meta-rift-resume')) promptDailyResume(active);
  }

  function abandonDaily(runId) {
    const result = dailyStore?.abandon?.(runId);
    if (result?.ok) {
      showHub();
      showDaily();
    } else if (result?.reason === 'storage_failed') warnSave();
    else sessionNotice('균열을 포기하지 못했습니다.');
  }

  function enterDaily(current) {
    dailyRun = current;
    setReview(null);
    sheets.closeSheet();
    audio.unlockAudio();
    if (current.phase === 'done') return finishDaily(current);
    setReview(enterRun(current, dailyHost) || null);
  }

  function finishDaily(current) {
    if (current !== (dailyRun ?? unsavedDailyResult) || current.phase !== 'done') return;
    const result = dailyStore?.finish?.(current);
    if (!result?.ok) {
      unsavedDailyResult = current;
      if (result?.reason === 'storage_failed') warnSave();
      const node = page('daily-result', { title: '균열 기록' });
      node.innerHTML = `<div class="meta-sheet rift-actions">
        <p role="alert">균열 기록을 저장하지 못했습니다. 새로고침하거나 게임을 닫으면 마지막 저장 지점으로 돌아갑니다. 결과를 보관하려면 기록 파일을 내보내 주세요.</p>
        <button class="btn go" data-backup-action="export">기록 내보내기</button>
        <button class="btn" id="meta-rift-retry">다시 저장</button>
        <button class="btn" id="meta-rift-hub">관측소로 돌아가기</button>
      </div>`;
      $('#meta-rift-retry', node).addEventListener('click', () => finishDaily(current));
      $('#meta-rift-hub', node).addEventListener('click', () => {
        dailyRun = null;
        setReview(null);
        showHub();
        sessionNotice('균열 결과가 아직 저장되지 않았습니다. 게임을 닫기 전에 기록을 내보내 주세요.');
      });
      return;
    }
    const spec = current.daily?.spec;
    const score = {
      runId: current.id, dayKey: spec?.dayKey, kind: current.daily?.kind, outcome: current.result,
      floor: current.floor, turns: current.stats?.turns, livingIds: current.bench, heirloomsUsed: current.stats?.heirloomsUsed,
      ...result.score
    };
    const view = dailyStore?.view?.(currentProfile(), new Date());
    dailyRun = null;
    unsavedDailyResult = null;
    setReview(null);
    const node = page('daily-result', { title: dailyResultTitle(score), track: score.outcome === 'win' ? 'victory' : 'defeat' });
    dailyResultScreen(node, { spec, score, official: result.official }, {
      widgets, today: view?.dayKey ?? view?.spec?.dayKey, practice: dayKey => startDaily(dayKey, 'practice'),
      openToday: showDaily, hub: showHub
    });
  }

  function reset() {
    dailyRun = null;
    unsavedDailyResult = null;
  }

  return {
    hubView, showDaily, showDailyHistory, reset,
    get run() { return dailyRun; },
    get backupRun() { return unsavedDailyResult ?? dailyRun; }
  };
}
