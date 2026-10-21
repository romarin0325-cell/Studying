/* SYNAPSE runtime: a thin presentation adapter over the shared Astra controller.
   It never reads or mutates save data; it only decorates rendered DOM. */
'use strict';

(() => {
  const body = document.body;
  const $ = id => document.getElementById(id);
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const darkChrome = { astra:'#04060d', strawberry:'#0a0409', dreamsky:'#03090f' };

  // The shared adapter still reports the light Astra colours to the browser chrome.
  const setTheme = Astra.setTheme.bind(Astra);
  Astra.setTheme = name => {
    setTheme(name);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = darkChrome[body.dataset.theme] || darkChrome.astra;
  };

  // Tag rendered cards with their element so the frame gradient can answer to it.
  const tagCard = (node, card) => {
    if (!node || !card) return node;
    node.dataset.element = card.element;
    node.dataset.role = card.role;
    return node;
  };
  const cardButton = Astra.cardButton.bind(Astra);
  Astra.cardButton = (card, count, onClick) => tagCard(cardButton(card, count, onClick), card);

  const renderParty = Astra.renderParty.bind(Astra);
  Astra.renderParty = () => {
    renderParty();
    const party = $('astra-party');
    if (!party) return;
    [...party.children].forEach((node, index) => tagCard(node, RPG.getCardData(RPG.state.deck[index])));
  };

  // Skill headings carry their type in text; a data attribute lets the list colour itself.
  const tagSkills = () => {
    for (const node of document.querySelectorAll('#md-skills .skill-detail')) {
      const heading = node.querySelector('.skill-detail-heading')?.textContent || '';
      node.dataset.type = /마법/.test(heading) ? 'mag' : /보조/.test(heading) ? 'sup' : 'phy';
    }
  };
  // The shared view prints "label: value / label: value" lines; split them into a
  // stat grid. Unparsable content is left exactly as the controller wrote it.
  const decorateStats = () => {
    const node = $('md-stats');
    if (!node) return;
    const rows = [];
    for (const line of node.innerHTML.split(/<br\s*\/?>/i)) {
      const cells = [];
      for (const chunk of line.split('/')) {
        const match = chunk.match(/^\s*([^:]+):\s*(.+?)\s*$/);
        if (!match) return;
        cells.push([match[1], match[2]]);
      }
      rows.push(cells);
    }
    if (!rows.length) return;
    node.replaceChildren(...rows.flatMap(cells => cells.map(([label, value]) => {
      const stat = document.createElement('span');
      stat.className = cells.length === 1 ? 'ds-stat ds-stat-wide' : 'ds-stat';
      const key = document.createElement('b');
      key.textContent = label;
      const amount = document.createElement('i');
      amount.textContent = value;
      stat.append(key, amount);
      return stat;
    })));
  };
  const showCardInfo = RPG.showCardInfo;
  RPG.showCardInfo = function (...args) {
    const result = showCardInfo.apply(this, args);
    tagSkills();
    decorateStats();
    tagCard($('modal-card'), this.getCardData(args[0]));
    return result;
  };

  // Result dialogs get a win/lose tint without parsing their layout.
  const markResult = () => {
    const modal = $('modal-info');
    if (!modal || !modal.classList.contains('active')) return;
    const text = `${$('info-title')?.textContent || ''} ${$('info-content')?.textContent || ''}`;
    const result = /승리|클리어|성공|획득/.test(text) ? 'win' : /패배|실패/.test(text) ? 'lose' : '';
    if (result && modal.dataset.result !== result) modal.dataset.result = result;
    else if (!result) delete modal.dataset.result;
  };
  new MutationObserver(markResult).observe($('modal-info'), { attributes:true, attributeFilter:['class'] });
  new MutationObserver(markResult).observe($('info-content'), { childList:true, subtree:true, characterData:true });

  // The study archive has a lot of empty canvas on tall phones; a compact ledger of
  // real progress fills it without inventing new state.
  const studyLedger = () => {
    const screen = $('screen-study');
    if (!screen) return;
    let panel = $('ds-study-ledger');
    if (!panel) {
      const grid = screen.querySelector('.study-grid');
      if (!grid) return;
      panel = document.createElement('div');
      panel.id = 'ds-study-ledger';
      panel.className = 'ds-ledger';
      panel.setAttribute('aria-hidden', 'true');
      grid.after(panel);
    }
    const state = (typeof RPG !== 'undefined' && RPG.state) || {};
    const quiz = state.quiz_stats || {};
    const total = Number(quiz.total) || 0;
    const rate = total ? Math.round((Number(quiz.correct) || 0) / total * 100) : 0;
    const owned = Array.isArray(state.inventory) ? new Set(state.inventory).size : 0;
    const rows = [
      ['정답률', total ? `${rate}%` : '—'],
      ['누적 퀴즈', String(total)],
      ['보유 카드', String(owned)]
    ];
    panel.replaceChildren();
    const title = document.createElement('p');
    title.className = 'ds-ledger-title';
    title.textContent = '// STUDY LEDGER';
    const list = document.createElement('ul');
    for (const [label, value] of rows) {
      const item = document.createElement('li');
      const key = document.createElement('span');
      key.textContent = label;
      const amount = document.createElement('b');
      amount.textContent = value;
      item.append(key, amount);
      list.append(item);
    }
    panel.append(title, list);
  };

  // One entrance cue per screen change keeps navigation legible.
  const screenChanged = Astra.screenChanged.bind(Astra);
  Astra.screenChanged = id => {
    screenChanged(id);
    if (String(id).replace('screen-', '') === 'study') studyLedger();
    const screen = document.querySelector('.screen.active');
    if (!screen) return;
    screen.classList.remove('ds-screen-in');
    void screen.offsetWidth;
    screen.classList.add('ds-screen-in');
  };

  // A single soft ripple on the surfaces that own a frame.
  const rippleHosts = '.primary,.secondary,.title-utilities button,.lobby-shortcuts button,.study-grid>button,.astra-nav button,#battle-controls .skill-btn,.card-item';
  document.addEventListener('pointerdown', event => {
    if (reduceMotion() || event.button > 0) return;
    const host = event.target.closest?.(rippleHosts);
    if (!host || host.disabled) return;
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.7;
    const ripple = document.createElement('span');
    ripple.className = 'ds-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.setProperty('--ds-ripple-size', `${size}px`);
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    host.append(ripple);
    setTimeout(() => ripple.remove(), 700);
  }, { passive:true });

  body.classList.add('ds');
  body.dataset.edition = 'deepseek';
})();
