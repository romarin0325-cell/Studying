import { $, esc } from '../dom.js';
import { logButton } from '../widgets.js';
import { josa } from '../text.js';
import { retreatStoryLine } from '../story-lines.js';
import { RESUME, TERMS } from '../glossary.js';
import { focusPrimary } from '../sheet.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { CONTRACT_ESCROW } from '../../content/contracts.js';
import { runRewards } from '../../engine/run.js';

export function resultMarkup() {
  return '<div class="sheet" id="result" role="dialog" aria-modal="true" aria-labelledby="result-title" tabindex="-1"><div class="in win" id="result-in"></div></div>';
}

export function battleFailure(run) {
  const result = run.lastBattleResult;
  if (run.result === 'win' || (run.result !== 'lose' && result?.outcome !== 'lose')) return null;
  // An intro retry keeps the fallen fighters in the roster for the new attempt.
  const alive = run.bench.filter(id => !result?.fallenIds.includes(id));
  if (result?.wiped || !alive.length) return { title: '전멸', subtitle: '꿈길이 끊겼다', survivors: [] };
  const fielded = (result?.survivorIds ?? []).filter(id => alive.includes(id));
  const survivors = [...fielded, ...alive.filter(id => !fielded.includes(id))];
  return { title: '원정 실패', subtitle: `살아남은 동료 ${survivors.length}명`, survivors };
}

export function contractSettlement(floor, contract) {
  if (!contract) return [];
  const rows = [];
  if (contract.metNow) rows.push('<p class="contract-met">계약 달성</p>');
  if (floor === 6) {
    if (contract.paid) rows.push('<p class="gain">7층 앞에서 ◆' + contract.paid + '</p>');
    else if (contract.failed) rows.push('<p class="contract-failed">계약 실패 · 맡긴 ◆' +
      (contract.escrowed || CONTRACT_ESCROW) + ' 사라짐</p>');
  }
  return rows;
}

export function resultNextLabel(run, { floor, roomType, won, retry }) {
  if (retry) return '편성 바꿔 재도전';
  if (run.result && !run.pending) {
    const rewards = runRewards(run);
    if (run.daily) return RESUME.dailyResult;
    if (won && rewards.recruitable.length) return '영입할 동료 고르기';
    return rewards.shardCandidates.length ? '다음 원정 후보 고르기' : '관측소로';
  }
  if (roomType === 'borrowed') return '다음 동료 고르기';
  if (run.pending?.kind === 'reinforcement') return '동료 보충하기';
  if (run.pending?.kind === 'gate') return '문지기 보상 고르기';
  if (run.pending?.kind === 'relic') return '유물 보상 고르기';
  return (floor + 1) + '층으로';
}

export function createResultBoard({ getRun, widgets, details, showLog, closeSheet, sfx, music }) {
  const panel = $('#result');
  const box = $('#result-in', panel);
  const screen = panel.parentElement;
  const { card, face } = widgets;
  const isOpen = () => panel.classList.contains('on');
  const primarySelector = 'button.go:not([hidden]), #b-reinforce-take';
  let primary = null;

  function setOpen(open) {
    panel.classList.toggle('on', open);
    for (const background of screen.children) {
      if (background !== panel) background.inert = open;
    }
  }

  function close() {
    if (!isOpen()) return;
    setOpen(false);
    screen.classList.remove('resumed-result');
    if (panel.inert) closeSheet();
    panel.inert = false;
    primary = null;
  }

  function focusAction() {
    const action = $(primarySelector, box);
    // Keep the current focus for updates that leave the same action in place.
    if (action === primary || panel.inert) return;
    primary = action;
    focusPrimary(action?.closest('.victory-decision') ?? panel, primarySelector);
  }

  // Reward screens can replace their own controls or navigate directly out of battle.
  const updates = new MutationObserver(() => {
    if (!isOpen()) return;
    if (screen.classList.contains('on')) focusAction();
    else close();
  });
  updates.observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  updates.observe(panel, { attributes: true, attributeFilter: ['inert'] });
  updates.observe(screen, { attributes: true, attributeFilter: ['class'] });

  panel.addEventListener('click', event => {
    const id = event.target.closest('[data-sheet]')?.dataset.sheet;
    if (id) {
      sfx.tap();
      details.charSheet(getRun(), id);
    }
  });

  function show({ advance, decision, restored = false }) {
    const run = getRun();
    const result = run.lastBattleResult ?? {
      floor: run.floor, roomType: run.room.type, outcome: run.result ?? 'win', wiped: false,
      fallenIds: [], survivorIds: [], transfers: [],
      rewardDelta: { crystals: 0, relicIds: run.lastBattleRelic ? [run.lastBattleRelic] : [] }
    };
    const { floor, roomType, outcome, wiped, fallenIds, survivorIds, transfers, rewardDelta } = result;
    const failure = battleFailure(run);
    const won = outcome === 'win' && !failure;
    const final = roomType === 'boss' || run.room.final;
    const retry = run.phase === 'result' && run.result === null;
    const name = id => card(id)?.name ?? id;
    const rows = [];
    if (fallenIds.length) {
      const list = fallenIds.map(name).join('·');
      rows.push('<p class="result-fallen">' + esc(josa(list, '이/가') + ' 쓰러졌습니다.') + '</p>');
    }
    if (failure?.survivors.length) {
      const [first, ...others] = failure.survivors;
      const lead = card(first)?.name ?? '동료';
      rows.push('<p class="result-return">' + esc(lead + (others.length ? ` 외 ${others.length}명` : '') + ' 생존') + '</p>');
    }
    const retreat = retreatStoryLine(run, card);
    if (retreat) rows.push('<p class="result-retreat">' + esc(retreat) + '</p>');
    if (transfers.length) {
      const lines = transfers.map(({ toId, skillName }) => {
        const skill = esc(skillName);
        return '<p data-coach="heirloom-transfer">' + esc(josa(name(toId), '이/가')) + ' <b>' + skill + '</b>' +
          esc(josa(skillName, '을/를').slice(skillName.length)) + ' 물려받았습니다.</p>';
      });
      rows.push('<div class="heirline"><span class="run-face">' + face(transfers[0].toId, 40) + '</span>' +
        '<div>' + lines.join('') + '</div></div>');
    }
    const lastStand = run.lastBattleLog?.flatMap(turn => turn.rows).find(row => row.kind === 'last-stand')?.faces[0]?.id;
    if (lastStand && survivorIds.includes(lastStand)) {
      rows.push('<div class="result-last-stand chips">' + esc(name(lastStand)) +
        ' <i class="last" data-coach="last-stand">최후의 일인</i></div>');
    }
    if (rewardDelta.crystals > 0) {
      rows.push('<p class="gain">' + TERMS.crystal.short + ' +' + rewardDelta.crystals + ' · 보유 ' + run.crystals + '개</p>');
    }
    const contract = run.contract && { ...run.contract, metNow: run.contract.metAtFloor === floor };
    if (!retry) rows.push(...contractSettlement(floor, contract));
    const wager = (run.lastBattleLog?.at(-1)?.rows ?? []).find(row => row.kind === 'wager');
    if (run.features?.bets !== false && wager) rows.push('<p>' + esc(wager.text) + '</p>');
    if (won && wiped && final) rows.push('<p class="result-return">보스 격파 · 돌아온 동료 0명</p>');
    else if (outcome === 'win' && wiped) rows.push('<p>전투에서 이겼습니다. 돌아온 동료가 없어 원정이 끝났습니다.</p>');

    const label = resultNextLabel(run, { floor, roomType, won, retry });
    const title = failure?.title ?? (run.daily ? '균열' : DUNGEONS[run.dungeonId].name) + ' ' + floor + '층 돌파';
    box.innerHTML = '<header class="result-heading ' + (won ? 'won' : 'lost') + '"><h3 id="result-title">' + esc(title) + '</h3>' +
      logButton('id="b-result-log"') + '</header>' + rows.join('') +
      '<div class="result-decision"></div><button class="btn go" id="b-next" data-coach="result-next">' + esc(label) + '</button>';
    setOpen(true);
    if (!restored) {
      if (rewardDelta.crystals > 0) sfx.credit();
      if (rewardDelta.relicIds.length) sfx.gem();
    }
    $('#b-result-log', box).addEventListener('click', showLog);
    const next = $('#b-next', box);
    const reward = won && ['reward', 'result'].includes(run.phase) && roomType !== 'borrowed';
    const pending = () => reward && ['reinforcement', 'gate', 'relic'].includes(getRun().pending?.kind);
    const content = $('.result-decision', box);
    const singleReinforcement = run.pending?.kind === 'reinforcement' && run.pending.candidates.length === 1;
    if (reward) decision?.(content, result, next, singleReinforcement);
    if (pending() && !restored) music?.holdReward(getRun().dungeonId);
    box.scrollTop = 0;
    focusAction();
    next.addEventListener('click', () => {
      sfx.tap();
      if (pending()) {
        decision(content, result, next, true);
        focusAction();
      } else {
        next.disabled = true;
        close();
        advance();
      }
    });
  }

  return { show, close, isOpen };
}
