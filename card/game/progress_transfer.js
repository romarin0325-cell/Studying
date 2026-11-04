/* Shared, validated record transfer for every Card UI. API keys are excluded. */
'use strict';

const CardProgressTransfer = {
  // Backup only the documented game progress keys, never API credentials.
  backupKeys() { return Object.values(Storage.keys).filter(key => key !== Storage.keys.API_KEY); },
  exportSave(notify = message => RPG.showAlert(message)) {
    const values = {};
    try {
      for (const key of this.backupKeys()) {
        const raw = localStorage.getItem(key);
        if (raw !== null) values[key] = key === Storage.keys.FORTUNE_LAST_USED ? raw : JSON.parse(raw);
      }
      const payload = { format:'astra-progress', version:1, exportedAt:new Date().toISOString(), values };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Dreamweaver-progress-${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('저장된 기록을 내보냈습니다. 진행 중인 여정은 게임 메뉴에서 먼저 저장하세요.');
    } catch { notify('기록을 읽지 못했습니다. 현재 저장은 변경하지 않았습니다.'); }
  },
  validateImport(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('올바른 기록 파일이 아닙니다.');
    let values;
    if (payload.format === 'astra-progress') {
      if (payload.version !== 1 || !payload.values || typeof payload.values !== 'object' || Array.isArray(payload.values)) throw new Error('지원하지 않는 기록 버전입니다.');
      values = payload.values;
    } else { values = { [Storage.keys.SAVE]:payload }; }
    const allowed = new Set(this.backupKeys());
    const safe = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
    if (!Object.keys(safe).length) throw new Error('게임 기록이 들어 있지 않습니다.');
    const hasOwn = key => Object.prototype.hasOwnProperty.call(safe, key);
    if (hasOwn(Storage.keys.GLOBAL) && !RPG.validateGlobalData(safe[Storage.keys.GLOBAL])) {
      throw new Error('전역 기록 형식이 잘못되었습니다.');
    }
    if (hasOwn(Storage.keys.SAVE)) {
      const normalized = SaveDataMigrator.normalizeRunState(safe[Storage.keys.SAVE], RPG.state, {
        defaultBlessingUses:GAME_CONSTANTS.DEFAULT_BLESSING_USES,
        defaultDraftRerolls:GAME_CONSTANTS.DRAFT.INITIAL_REROLLS,
        normalizeBonusPoolIds:ids => RPG.normalizeActiveBonusPoolIds(ids),
        normalizeSpecialSelections:items => RPG.normalizeSpecialCardSelections(items),
        defaultSpecialSelections:RPG.global.activeSpecialCardSelections
      });
      if (!normalized) throw new Error('불러올 수 없는 여정 기록입니다.');
    }
    if (hasOwn(Storage.keys.MODE_RECORDS) && !ModeRecords.validate(safe[Storage.keys.MODE_RECORDS])) throw new Error('모드별 최고 기록 형식 또는 버전이 잘못되었습니다.');
    for (const [key,value] of Object.entries(safe)) {
      if ([Storage.keys.VOCAB,Storage.keys.COLLOCATION,Storage.keys.RECORDS].includes(key) && !Array.isArray(value)) throw new Error('학습 또는 전투 기록 형식이 잘못되었습니다.');
      if (key === Storage.keys.FORTUNE_LAST_USED && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw new Error('포춘쿠키 기록 형식이 잘못되었습니다.');
    }
    return safe;
  },
  async importFile(file, { notify = message => RPG.showAlert(message), reset = () => {} } = {}) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('기록 파일은 5MB 이하여야 합니다.');
      const safe = this.validateImport(JSON.parse(await file.text()));
      const recordNotice = Object.prototype.hasOwnProperty.call(safe, Storage.keys.MODE_RECORDS) ? '' : '<br>파일에 없는 모드별 최고 기록은 현재 기록을 유지합니다.';
      RPG.showConfirm('이 파일의 기록을 가져올까요?<br>같은 항목의 현재 저장 기록이 교체됩니다.' + recordNotice, () => {
        const previous = new Map();
        try {
          for (const key of this.backupKeys()) previous.set(key,localStorage.getItem(key));
          const writes = new Map(Object.entries(safe).map(([key,value]) => [key,key === Storage.keys.FORTUNE_LAST_USED ? value : JSON.stringify(value)]));
          for (const [key,raw] of writes) localStorage.setItem(key,raw);
          for (const [key,raw] of writes) {
            if (localStorage.getItem(key) !== raw) throw new Error(`Failed to verify imported key: ${key}`);
          }
          try { sessionStorage.setItem('astraImportNotice','기록을 가져왔습니다. 메모리를 새 기록으로 다시 불러왔어요. 직접 선택한 초상화 파일은 다시 연결해주세요.'); } catch { /* Reload still protects in-memory state. */ }
          location.reload();
        } catch {
          for (const [key,raw] of previous) {
            try { if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key,raw); } catch { /* Report failure below. */ }
          }
          notify('저장 공간에 기록을 쓰지 못했습니다. 기록 가져오기를 중단했습니다.');
        }
      });
    } catch (error) { notify(error.message || '기록을 가져오지 못했습니다.'); }
    reset();
  }
};
