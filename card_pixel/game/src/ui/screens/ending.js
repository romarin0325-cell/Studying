import { $ } from '../dom.js';
import { background } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { sceneActors } from './hub.js';
import { hitText, longestText, recordTable } from './records.js';

export function endingScreen(node, { profile, widgets, finish }) {
  const { records, recruits } = profile;
  const companions = Object.keys(recruits).sort((a, b) => recruits[a].since - recruits[b].since);
  const regions = Object.values(DUNGEONS).filter(({ id }) => {
    const clears = records.clears[id];
    return clears?.normal || clears?.nightmare;
  });
  node.innerHTML = `
    <section class="meta-panel meta-ending-record">
      ${recordTable([
        ['원정', `${records.runs}회`],
        ['영입한 동료', `${companions.length}명`],
        ['최고 피해', hitText(records.bestHit, widgets.card)],
        ['가장 오래 함께한 동료', longestText(records.longestServing, widgets.card)],
        ['생환 지역', regions.map(region => region.name).join(' · ') || '기록 없음']
      ])}
    </section>
    <div class="meta-scene meta-ending-stage" style="background-image:url(${background('observatory')})" aria-hidden="true">
      ${sceneActors(companions, widgets)}
    </div>
    <button class="btn go" id="meta-ending-finish">관측소로</button>
  `;
  $('#meta-ending-finish', node).addEventListener('click', finish, { once: true });
}
