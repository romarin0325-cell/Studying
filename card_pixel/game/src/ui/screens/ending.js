import { $, esc } from '../dom.js';
import { background } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { sceneActors } from './hub.js';
import { hitText, longestText, recordTable } from './records.js';
import { bindScreenTabs } from '../nav/screen-tabs.js';
import { storyLine } from '../story-lines.js';

export function endingScreen(node, { profile, widgets, goal, finish }) {
  const { records, recruits } = profile;
  const companions = Object.keys(recruits).sort((a, b) => recruits[a].since - recruits[b].since);
  const regions = Object.values(DUNGEONS).filter(({ id }) => {
    const clears = records.clears[id];
    return clears?.easy || clears?.normal || clears?.nightmare;
  });
  const towerStories = records.towerRunId ? Object.entries(profile.history ?? {}).flatMap(([id, entries]) => {
    const entry = entries.find(fact => fact.runId === records.towerRunId);
    const name = widgets.card(id)?.name;
    if (!entry || !name || (entry.outcome !== 'fell' && !entry.inherited.length)) return [];
    const line = storyLine(entry, widgets.card);
    return line ? [`<li class="companion-story" title="${esc(name + ' · ' + line)}"><b>${esc(name)}</b> · ${esc(line)}</li>`] : [];
  }) : [];
  node.classList.add('screen-split');
  node.innerHTML = `
    <div class="fixed-top">
      <div class="meta-scene meta-ending-stage" style="background-image:url(${background('observatory')})" aria-hidden="true">
        ${sceneActors(companions, widgets)}
      </div>
      <div class="screen-tabs" role="group" aria-label="엔딩 기록">
        <button class="btn" data-screen-tab="settlement">정산</button>
        <button class="btn" data-screen-tab="dreams">꿈 기록</button>
      </div>
    </div>
    <div class="scroll-list">
      <section class="meta-panel meta-ending-record" data-screen-panel="settlement">
        ${recordTable([
          ['원정', `${records.runs}회`],
          ['영입한 동료', `${companions.length}명`],
          ['최고 피해', hitText(records.bestHit, widgets.card)],
          ['인연이 가장 높은 동료', longestText(records.longestServing, widgets.card)]
        ])}
        ${towerStories.length ? `<h3>창조의 탑에서 함께한 기록</h3><ul class="companion-records">${towerStories.join('')}</ul>` : ''}
      </section>
      <section class="meta-panel meta-ending-record" data-screen-panel="dreams">
        ${recordTable([['생환 지역', regions.length ? `${regions.length}곳 · ${regions.map(region => region.name).join(' · ')}` : '기록 없음']])}
      </section>
    </div>
    <div class="fixed-foot">
      ${goal?.text ? `<p class="meta-next-goal">${esc([goal.text, goal.reward].filter(Boolean).join(' · '))}</p>` : ''}
      <button class="btn go" id="meta-ending-finish">관측소로</button>
    </div>
  `;
  bindScreenTabs(node, 'settlement');
  $('#meta-ending-finish', node).addEventListener('click', finish, { once: true });
}
