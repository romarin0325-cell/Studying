const fs = require('fs');

const code = fs.readFileSync('data.js', 'utf8') + `
let md = '## 7. 모든 카드 상세 데이터\\n\\n### 7-1. 일반 (Normal) 등급\\n';
const getElem = e => e==='fire'?'불':e==='water'?'물':e==='nature'?'자연':e==='light'?'빛':'어둠';
const cardsByGrade = { normal: [], rare: [], epic: [], legend: [], transcendence: [] };
CARDS.concat(BONUS_CARDS).concat(TRANSCENDENCE_CARDS).forEach(c => { cardsByGrade[c.grade].push(c); });
['normal', 'rare', 'epic', 'legend', 'transcendence'].forEach(g => {
    md += '\\n### ' + g.toUpperCase() + ' 등급\\n';
    md += '| 이름 | 속성 | 역할 | HP | ATK | MATK | DEF | MDEF | 특성 |\\n|---|---|---|---|---|---|---|---|---|\\n';
    cardsByGrade[g].forEach(c => {
        md += '| **' + c.name + '** | ' + getElem(c.element) + ' | ' + c.role + ' | ' + c.stats.hp + ' | ' + c.stats.atk + ' | ' + c.stats.matk + ' | ' + c.stats.def + ' | ' + c.stats.mdef + ' | ' + (c.trait ? c.trait.desc : '-') + ' |\\n';
    });
    md += '\\n#### 스킬 목록 (' + g.toUpperCase() + ')\\n';
    cardsByGrade[g].forEach(c => {
        md += '- **' + c.name + '**\\n';
        c.skills.forEach(s => {
            md += '  - [' + s.type.toUpperCase() + ' / 티어' + s.tier + ' / 마나 ' + s.cost + '] **' + s.name + '** ' + (s.val ? '(배율 ' + s.val + ')' : '') + ': ' + s.desc + '\\n';
        });
    });
});
fs.writeFileSync('cards_md.txt', md);
console.log('Done!');
`;
eval(code);
