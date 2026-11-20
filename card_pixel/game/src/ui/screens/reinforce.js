import { $, $$, esc, show } from '../dom.js';
import { head, TYPE } from '../widgets.js';
import { ELEMENT, GRADE } from '../../engine/roster.js';
import * as Run from '../../engine/run.js';

export function reinforceScreen(run, ui) {
  ui.playMusic();
  const node = $('#reinforce');
  const pending = run.pending;
  const limit = pending.limit ?? 6;
  const full = run.bench.length >= limit;
  const { card, sprite, faceBadge } = ui.widgets;
  const candidates = (pending.candidates ?? []).slice(0, 3).filter(id => card(id));
  const canResolve = typeof Run.resolveReinforcement === 'function';
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

  function candidateCard(id) {
    const fighter = card(id);
    const { hp, atk, matk } = fighter.stats;
    const skills = fighter.skills.slice(0, 2).map(skill => '<span>' + esc(skill.name) +
      ' <small>' + esc(TYPE[skill.type] ?? '') + '</small></span>').join('');
    return '<button class="win reinforce-card g-' + esc(fighter.grade) + '" data-candidate="' + esc(id) +
      '" aria-pressed="' + (incoming === id) + '"><span class="reinforce-art">' + sprite(id) + '</span>' +
      '<span class="reinforce-copy"><span class="reinforce-name"><b>' + esc(fighter.name) + '</b><small>' +
      esc(GRADE[fighter.grade] ?? fighter.grade) + ' · <span class="el-' + esc(fighter.element) + '">' +
      esc(ELEMENT[fighter.element] ?? fighter.element) + '</span></small></span>' +
      '<span class="reinforce-stats">HP ' + hp + ' · 공 ' + atk + ' · 마공 ' + matk + '</span>' +
      '<span class="reinforce-trait">' + esc(fighter.trait?.desc ?? '') + '</span>' +
      '<span class="reinforce-skills">' + skills + '</span></span></button>';
  }

  function render() {
    const scrollTop = $('.scroll', node)?.scrollTop ?? 0;
    node.innerHTML = head(run, '동료 보충', run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">동료 ' + run.bench.length + '/' + limit + '명</p><div class="reinforce-candidates">' +
      candidates.map(candidateCard).join('') + '</div>' +
      (full && incoming ? '<h3>보낼 동료</h3><div class="reserve-cards">' +
        run.bench.map(id => '<button class="win" data-release="' + esc(id) + '" aria-pressed="' + (outgoing === id) + '">' +
          faceBadge(id) + '</button>').join('') + '</div>' : '') +
      '<p id="reinforce-feedback" class="run-status" role="status"></p></div>' +
      '<div class="footer"><button class="btn" id="b-reinforce-pass">넘기기</button>' +
      '<button class="btn go" id="b-reinforce-take"' + (canResolve && incoming && (!full || outgoing) ? '' : ' disabled') +
      '>데려간다</button></div>';
    show('reinforce');
    $('.scroll', node).scrollTop = scrollTop;
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
