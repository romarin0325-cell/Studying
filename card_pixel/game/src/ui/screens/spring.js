import { $, $$, esc, show } from '../dom.js';
import { chooseReplacements, head, replacementCount } from '../widgets.js';
import * as Run from '../../engine/run.js';
import { canJoin, drawKind, ratesView, usesRepeatDraws } from '../../engine/awakenings.js';
import { drawCard, reveal } from '../reveal.js';
import { TERMS } from '../glossary.js';

const { COST } = Run;
const percentText = percent => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(percent) + '%';

function rates(run, kind) {
  const groups = ratesView(run, kind);
  const label = group => group.group === 'legend' ? TERMS.legend.short : group.label;
  const summary = groups.map(group => label(group) + ' ' + percentText(group.percent)).join(' · ');
  return '<details class="spring-rates"><summary>' + esc(summary) + '</summary><p>' + TERMS.legend.detail +
    '</p><p>' + esc(groups.map(group => label(group) + ' ' + group.count + '명').join(' · ')) + '</p></details>';
}

export function springScreen(run, ui) {
  ui.playMusic();
  const { widgets, audio, command, leave } = ui;
  const { sfx } = audio;
  const { card, cardRow, benchMinis } = widgets;
  const node = $('#spring');
  const fresh = [];
  const repeat = usesRepeatDraws(run);

  function base() {
    const pending = run.pending?.kind === 'springDraw' ? run.pending : null;
    const pick = run.features?.springPick !== false || run.pending?.kind === 'spring';
    node.innerHTML = head(run, TERMS.spring.short, run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">' + TERMS.crystal.firstUse + '</p>' +
      '<div class="svc"><div class="spring-service win"><button class="btn big" id="b-draw"><b>' +
      (pending ? esc(card(pending.id).name) + ' 합류 계속' : TERMS.spring.detail) + '</b></button>' + rates(run, 'draw') + '</div>' +
      (pick ? '<div class="spring-service win"><button class="btn big" id="b-pick"><b>후보 3칸 중 하나 선택</b>' +
        '<small>보기 무료 · 선택할 때 결정 ' + COST.pick + '개</small></button>' +
        '<p class="sm">무작위 한 칸당</p>' + rates(run, 'pick') + '</div>' : '') + '</div>' +
      '<p class="run-status" id="spring-status" role="status"></p>' +
      '<div class="cards" id="fresh">' + fresh.map(draw => drawCard(run, widgets, draw)).join('') + '</div>' +
      '<h3>동료 <span class="sm" id="sp-count"></span></h3><div class="benchrow" id="sp-bench"></div></div>' +
      '<div class="footer"><button class="btn go" id="b-leave">샘 나가기</button></div>';
    show('spring');
    $('#b-draw', node).addEventListener('click', () => {
      if (pending) return completeDraw(pending);
      if (!repeat && replacementCount(run, 1)) {
        chooseReplacements(run, ui, 1, ([id]) => finish(command(Run.springDraw, id), true));
        return;
      }
      const result = command(Run.springDraw);
      if (result.pending?.kind === 'springDraw') {
        base();
        completeDraw(result.pending);
      } else finish(result, true);
    });
    $('#b-pick', node)?.addEventListener('click', () => openOffer());
    $('#b-leave', node).addEventListener('click', () => {
      if (run.pending?.kind === 'spring' && !command(Run.springTake, null).ok) return;
      leave();
    });
    refresh();
  }

  function completeDraw(pending) {
    chooseReplacements(run, ui, 1, ([replaceId]) =>
      finish(command(Run.commitSpringDraw, { key: pending.key, replaceId }), true), { incoming: [pending.id] });
  }

  function showFailure(reason) {
    $('#spring-status', node).textContent = reason === 'empty_pool' ? '더 이상 깨울 수 있는 동료가 없습니다.' :
      reason === 'insufficient_crystals' ? '결정이 부족합니다.' :
        reason === 'invalid_spring_key' || reason === 'invalid_spring_slot' ? '후보 목록이 바뀌었습니다. 다시 골라 주세요.' :
          '합류할 동료와 보낼 동료를 확인해 주세요.';
  }

  function refresh() {
    $('#b-draw', node).disabled = run.crystals < COST.draw || run.pending?.kind === 'spring' || repeat && !run.bench.length;
    const pick = $('#b-pick', node);
    if (pick) pick.disabled = run.pending?.kind === 'springDraw' || repeat && !run.bench.length;
    $('#b-leave', node).disabled = run.tempoVersion !== 2 && run.pending?.kind === 'spring';
    $('.gems', node).textContent = '◆ ' + run.crystals;
    $('#sp-count', node).textContent = run.bench.length + '명';
    $('#sp-bench', node).innerHTML = benchMinis(run);
  }

  async function finish(result, roll) {
    if (!result.ok) return showFailure(result.reason);
    const draw = result.draw ?? { kind: 'join', id: result.joined ?? result.id };
    base();
    const box = $('#fresh', node);
    for (const id of ['b-draw', 'b-pick', 'b-leave']) {
      const button = $('#' + id, node);
      if (button) button.disabled = true;
    }
    await reveal(run, widgets, sfx, box, draw, { first: true, roll });
    if ($('#fresh', node) === box) {
      fresh.unshift(draw);
      refresh();
    }
  }

  function openOffer(message) {
    const offer = command(Run.getSpringOffer);
    if (!offer.ok) return showFailure(offer.reason);
    choose(offer);
    if (message) showFailure(message);
  }

  function choose(offer) {
    const cost = offer.alreadyPaid ? 0 : offer.cost;
    const price = cost ? ' · ◆' + cost : ' · 결제 완료';
    const previewKind = id => repeat && !offer.alreadyPaid ? drawKind(run, id) : 'join';
    node.innerHTML = head(run, '후보 3칸 중 하나 선택', null) +
      '<div class="scroll"><div class="cards">' + offer.slots.map(({ slotId, id, source }) =>
        cardRow(run, id, {
          slotId, offer: true, tag: source === 'invite' ? '초대 확정 · ' + card(id).name : '무작위',
          detail: TERMS[previewKind(id)].firstUse
        })).join('') +
      '</div><p class="run-status" id="spring-status" role="status"></p></div>' +
      '<div class="footer"><button class="btn" id="b-spring-pass">닫기</button>' +
      '<button class="btn go" id="b-take" disabled>동료 선택</button></div>';
    show('spring');
    let selected;
    const rows = $$('.cardrow', node);
    const take = $('#b-take', node);
    if (run.crystals < cost) $('#spring-status', node).textContent = '결정 ' + (cost - run.crystals) + '개가 부족합니다.';
    for (const row of rows) {
      row.disabled = (!repeat || offer.alreadyPaid) && !canJoin(run, row.dataset.id);
      row.addEventListener('click', () => {
        selected = offer.slots.find(slot => slot.slotId === row.dataset.slotId);
        sfx.tap();
        for (const other of rows) other.classList.toggle('sel', other === row);
        take.disabled = run.crystals < cost;
        take.textContent = card(selected.id).name + ' · ' + TERMS[previewKind(selected.id)].short + price;
      });
    }
    take.addEventListener('click', () => {
      if (!selected) return;
      const { id, slotId } = selected;
      function commit(replaceId = null) {
        const result = command(Run.commitSpringOffer, { offerKey: offer.offerKey, slotId, replaceId });
        if (result.reason === 'invalid_spring_key') return openOffer(result.reason);
        finish(result, false);
      }
      const count = previewKind(id) === 'join' ? replacementCount(run, 1) : 0;
      if (count) chooseReplacements(run, ui, count, ([replaceId]) => commit(replaceId), { incoming: [id] });
      else commit();
    });
    $('#b-spring-pass', node).addEventListener('click', base);
  }

  base();
  if (run.pending?.kind === 'spring') openOffer();
  if (run.pending?.kind === 'springDraw') completeDraw(run.pending);
}
