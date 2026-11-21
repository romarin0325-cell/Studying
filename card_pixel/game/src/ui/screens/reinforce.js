import { $, $$, esc, show } from '../dom.js';
import { departureLoss, head, heirloomOffer, replacementCount, repeatBadge, traitText, TYPE } from '../widgets.js';
import { ELEMENT, GRADE } from '../../engine/roster.js';
import * as Run from '../../engine/run.js';
import { drawKind, usesRepeatDraws } from '../../engine/awakenings.js';
import { drawCard } from '../reveal.js';
import { TERMS } from '../glossary.js';

export function reinforceScreen(run, ui, { node = $('#reinforce'), inline = false } = {}) {
  if (!inline) ui.playMusic();
  const pending = run.pending;
  const limit = pending.limit ?? 6;
  const full = run.bench.length >= limit;
  const kind = id => usesRepeatDraws(run) ? drawKind(run, id) : 'join';
  const { card, sprite, faceBadge } = ui.widgets;
  const candidates = (pending.candidates ?? []).slice(0, 3).filter(id => card(id));
  const canResolve = typeof Run.resolveReinforcement === 'function';
  let incoming = null;
  let outgoing = null;
  const swap = () => incoming && kind(incoming) === 'join' && replacementCount(run, 1) > 0;

  function submit(id, replaceId = null) {
    if (run.pending !== pending || typeof Run.resolveReinforcement !== 'function') return;
    const result = ui.command(Run.resolveReinforcement, { key: pending.key, id, replaceId });
    if (result.ok) {
      const draw = result.draw ?? (result.joined ? { kind: 'join', id: result.joined } : null);
      if (!draw) return ui.leave();
      ui.audio.sfx.awaken();
      node.innerHTML = (inline ? '<h4>동료 보충</h4>' : head(run, '동료 보충', run.floor + '층')) +
        '<div class="' + (inline ? 'decision-body' : 'scroll') + '">' + drawCard(run, ui.widgets, draw) + '</div>' +
        '<div class="footer"><button class="btn go" id="b-reinforce-done">계속하기</button></div>';
      $('#b-reinforce-done', node).addEventListener('click', ui.leave, { once: true });
    } else {
      $('#reinforce-feedback', node).textContent = '합류할 동료와 보낼 동료를 확인해 주세요.';
    }
  }

  function candidateCard(id) {
    const fighter = card(id);
    const { hp, atk, matk } = fighter.stats;
    const skills = fighter.skills.slice(0, 2).map(skill => '<span>' + esc(skill.name) +
      ' <small>' + esc(TYPE[skill.type] ?? '') + '</small></span>').join('');
    return '<button class="win reinforce-card g-' + esc(fighter.grade) + '" data-candidate="' + esc(id) +
      '" aria-pressed="' + (incoming === id) + '"><span class="reinforce-art">' + sprite(id) + '</span>' +
      '<span class="reinforce-copy"><span class="reinforce-name"><b>' + esc(fighter.name) + repeatBadge(run, id) + '</b><small>' +
      esc(GRADE[fighter.grade] ?? fighter.grade) + ' · <span class="el-' + esc(fighter.element) + '">' +
      esc(ELEMENT[fighter.element] ?? fighter.element) + '</span></small></span>' +
      '<small>' + TERMS[kind(id)].firstUse + '</small>' +
      '<span class="reinforce-stats">HP ' + hp + ' · 공 ' + atk + ' · 마공 ' + matk + '</span>' +
      '<span class="reinforce-trait">' + esc(traitText(fighter.trait)) + '</span>' +
      '<span class="reinforce-skills">' + skills + '</span>' + heirloomOffer(fighter) + '</span></button>';
  }

  function render() {
    const scrollTop = $('.scroll', node)?.scrollTop ?? 0;
    node.innerHTML = (inline ? '<h4>동료 보충</h4>' : head(run, '동료 보충', run.floor + '층')) +
      '<div class="' + (inline ? 'decision-body' : 'scroll') + '">' +
      '<p class="lead">' + (full ? '동료 ' : '무료 합류 · ') + run.bench.length + '/' + limit + '명</p><div class="reinforce-candidates">' +
      candidates.map(candidateCard).join('') + '</div>' +
      (swap() ? '<h3>보낼 동료</h3><div class="reserve-cards">' +
        run.bench.map(id => '<button class="win" data-release="' + esc(id) + '" aria-pressed="' + (outgoing === id) + '">' +
          faceBadge(id, undefined, 40, run) + '</button>').join('') + '</div>' : '') +
      '<p id="reinforce-feedback" class="run-status" role="status"></p></div>' +
      (outgoing ? '<p class="loss release-loss">' + esc(card(outgoing).name + ' · ' + departureLoss(run, outgoing)) + '</p>' : '') +
      '<div class="footer"><button class="btn" id="b-reinforce-pass">' + (full ? '현재 편성 유지' : '건너뛰기') + '</button>' +
      '<button class="btn' + (swap() ? '' : ' go') + '" id="b-reinforce-take"' + (canResolve && incoming && (!swap() || outgoing) ? '' : ' disabled') +
      '>' + esc(incoming ? (outgoing ? card(outgoing).name + ' 보내고 ' : '') + card(incoming).name + ' · ' + TERMS[kind(incoming)].short : '동료 고르기') + '</button></div>';
    if (!inline) {
      show('reinforce');
      $('.scroll', node).scrollTop = scrollTop;
    }
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
