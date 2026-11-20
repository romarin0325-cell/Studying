import { $, $$, esc, show } from '../dom.js';
import { head, TYPE } from '../widgets.js';
import { ELEMENT, GRADE } from '../../engine/roster.js';
import { heirloomSkill } from '../../engine/bridge.js';
import * as Run from '../../engine/run.js';

export function reinforceScreen(run, ui) {
  ui.playMusic();
  const node = $('#reinforce');
  const pending = run.pending;
  const limit = pending.limit ?? 6;
  const full = run.bench.length >= limit;
  const { card, faceBadge } = ui.widgets;
  let incoming = null;
  let outgoing = null;

  function submit(id, replaceId = null) {
    if (run.pending !== pending || typeof Run.resolveReinforcement !== 'function') return;
    const result = ui.command(Run.resolveReinforcement, { key: pending.key, id, replaceId });
    if (result.ok) {
      if (result.joined) ui.audio.sfx.awaken();
      ui.leave();
    } else {
      $('#reinforce-feedback', node).textContent = '합류할 동료와 보낼 동료를 확인한다.';
    }
  }

  function render() {
    const candidates = (pending.candidates ?? []).slice(0, 3).filter(id => card(id));
    const canResolve = typeof Run.resolveReinforcement === 'function';
    const selected = id => incoming === id;
    const takeLabel = outgoing ? card(outgoing).name + ' 보내고 ' + card(incoming).name + ' 합류' :
      incoming && !full ? card(incoming).name + ' 합류' : full && incoming ? '보낼 동료를 고른다' : '한 명을 고른다';
    node.innerHTML = head(run, '동료 보충', run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">동료 ' + run.bench.length + '/' + limit + '명</p><div class="reinforce-candidates">' +
      candidates.map(id => {
        const fighter = card(id);
        const skill = heirloomSkill(fighter) ?? fighter.skills?.[0];
        return '<button class="win g-' + esc(fighter.grade) + '" data-candidate="' + esc(id) +
          '" aria-pressed="' + selected(id) + '">' + faceBadge(id) + '<span>' + esc(GRADE[fighter.grade]) + ' · ' +
          esc(ELEMENT[fighter.element]) + '</span>' + (skill ? '<small>' + esc(skill.name + ' · ' + TYPE[skill.type]) + '</small>' : '') +
          '</button>';
      }).join('') + '</div>' +
      (full && incoming ? '<h3>보낼 동료</h3><div class="reserve-cards">' +
        run.bench.map(id => '<button class="win" data-release="' + esc(id) + '" aria-pressed="' + (outgoing === id) + '">' +
          faceBadge(id) + '</button>').join('') + '</div>' : '') +
      '<p id="reinforce-feedback" class="run-status" role="status"></p></div>' +
      '<div class="footer"><button class="btn" id="b-reinforce-pass">넘기기</button>' +
      '<button class="btn go" id="b-reinforce-take"' + (canResolve && incoming && (!full || outgoing) ? '' : ' disabled') +
      '>' + esc(takeLabel) + '</button></div>';
    show('reinforce');
    for (const button of $$('[data-candidate]', node)) button.addEventListener('click', () => {
      incoming = button.dataset.candidate;
      outgoing = null;
      ui.audio.sfx.tap();
      render();
    });
    for (const button of $$('[data-release]', node)) button.addEventListener('click', () => {
      outgoing = button.dataset.release;
      ui.audio.sfx.tap();
      render();
    });
    $('#b-reinforce-take', node).addEventListener('click', () => submit(incoming, outgoing));
    $('#b-reinforce-pass', node).addEventListener('click', () => canResolve ? submit(null) : ui.leave());
  }
  render();
}
