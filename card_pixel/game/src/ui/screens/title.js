import { $, show } from '../dom.js';
import { background } from '../assets.js';
import { tools } from '../settings.js';
import { INTRO } from '../../content/intro.js';
import { hubLineup, sceneActors } from './hub.js';

export function titleScreen({ profile, widgets, start }) {
  const node = $('#title');
  const lineup = profile ? hubLineup(profile.lead, profile.ui?.returners || []) : INTRO.party;
  node.innerHTML = `
    <div class="meta-title-art" style="background-image:url(${background('dawn_forest')})" aria-hidden="true">
      ${sceneActors(lineup, widgets)}
    </div>
    <div class="corner">${tools()}</div>
    <div class="meta-title-name"><h1>다음은 너</h1><span>RELAYMARE</span></div>
    <p class="title-relay">쓰러진 동료가 다음 동료의 힘이 된다</p>
    <button class="btn go" id="b-start">꿈길로 들어간다</button>
  `;
  show('title');
  $('#b-start', node).addEventListener('click', start, { once: true });
}
