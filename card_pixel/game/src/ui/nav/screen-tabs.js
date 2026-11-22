import { $, $$ } from '../dom.js';

export function bindScreenTabs(node, initial) {
  const tabs = $$('[data-screen-tab]', node);
  const panels = $$('[data-screen-panel]', node);
  const list = $('.scroll-list', node);

  function select(key) {
    node.dataset.screenTabActive = key;
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.screenTab === key));
    for (const panel of panels) panel.hidden = panel.dataset.screenPanel !== key;
    list.scrollTop = 0;
  }

  for (const tab of tabs) tab.addEventListener('click', () => {
    if (tab.dataset.screenTab !== node.dataset.screenTabActive) select(tab.dataset.screenTab);
  });
  select(tabs.some(tab => tab.dataset.screenTab === initial) ? initial : tabs[0].dataset.screenTab);
}
