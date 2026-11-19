import { $, show } from '../dom.js';
import { background } from '../assets.js';
import { tools } from '../settings.js';

export function titleScreen(start) {
  const node = $('#title');
  node.innerHTML = `
    <div class="meta-title-art" style="background-image:url(${background('dawn_forest')})"></div>
    <div class="corner">${tools()}</div>
    <div class="meta-title-name"><h1>다음은 너</h1><span>RELAYMARE</span></div>
    <button class="btn go" id="b-start">꿈길로 들어간다</button>
  `;
  show('title');
  $('#b-start', node).addEventListener('click', start, { once: true });
}
