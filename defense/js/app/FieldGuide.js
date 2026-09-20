import { ATTACK_TYPE_IDS, DEFENSE_TYPE_IDS, MATCHUP_MULTIPLIERS } from '../content/combat.js';
import { DEFENSE_LABELS } from '../content/presentation.js';
export const ATTACK_LABELS = Object.freeze({ normal: '물리', anti_air: '대공', lethal: '필살', magic: '마법', flame: '화염', holy: '신성' });
export function openFieldGuide(root) {
  const doc = root.ownerDocument, previous = doc.activeElement, backdrop = doc.createElement('div');
  backdrop.className = 'modal-backdrop'; backdrop.dataset.fieldGuide = '';
  backdrop.innerHTML = `<section class="info-sheet field-guide" role="dialog" aria-modal="true" aria-labelledby="guide-title">
    <div class="modal-heading"><div><span class="eyebrow">FIELD GUIDE</span><h2 id="guide-title">전장 도감</h2></div><button class="icon-button" data-close-guide aria-label="닫기">×</button></div>
    <p>행은 적의 방어 유형, 열은 수호자의 공격 유형입니다. 속성과 공격 유형은 별개입니다.</p>
    <div class="matchup-scroll"><table class="matchup-table"><thead><tr><th scope="col">적 / 공격</th>${ATTACK_TYPE_IDS.map(id=>`<th scope="col">${ATTACK_LABELS[id]}</th>`).join('')}</tr></thead>
    <tbody>${DEFENSE_TYPE_IDS.map(defense=>`<tr><th scope="row">${DEFENSE_LABELS[defense]}</th>${ATTACK_TYPE_IDS.map(attack=>{const value=MATCHUP_MULTIPLIERS[defense][attack];return `<td class="${value>1?'strong':value<1?'weak':''}">×${value}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>
    <p>공격 범위는 점선, 조준 방향은 실선으로 표시됩니다. 배치 중 동료와 이어지는 선은 오라입니다. 같은 이름의 오라는 중복되지 않습니다.</p>
  </section>`;
  const close = () => { backdrop.remove(); previous?.focus?.(); };
  backdrop.querySelector('[data-close-guide]').onclick = close;
  backdrop.onclick = event => { if (event.target === backdrop) close(); };
  backdrop.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') { event.preventDefault(); backdrop.querySelector('button').focus(); }
  };
  root.append(backdrop); backdrop.querySelector('button').focus();
  return close;
}
