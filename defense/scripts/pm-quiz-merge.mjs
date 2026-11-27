// Merge rewritten self-made PM questions (docs/review/pm-quiz-20261128/batches/*.jsonl) into src/course.js.
// Only prompt, choices, answer and explain of self-made and adapted questions change; ids, sources and every other field stay.
// Usage: node defense/scripts/pm-quiz-merge.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {SELF_SOURCE} from './pm-quiz-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const coursePath = path.join(here, '../src/course.js');
const dir = path.join(here, '../docs/review/pm-quiz-20261128/batches');
const rows = new Map();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort())
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(l => l.trim())) {
    const r = JSON.parse(line);
    rows.set(r.id, r);
  }
// IPA spellings for terms the batches wrote two ways.
const TERMS = [[/作業パッケージ/g, 'ワークパッケージ'], [/仕掛作業/g, '仕掛かり作業']];
const spell = s => TERMS.reduce((t, [re, to]) => t.replace(re, to), s);
// IPA lists purely numeric choices in ascending order; the answer and the explanation's ①-④ follow the move.
const MARK = '①②③④';
const numeric = c => { const m = c.replace(/[，,]/g, '').match(/^約?([＋－+\-−]?)(\d+(?:\.\d+)?)(?:日|件|台|時間|万円|%|％)?$/); return m ? (/[－\-−]/.test(m[1]) ? -1 : 1) * Number(m[2]) : null; };
// Lettered choices (A社の提案, 案A，580万円) go A→D, then by amount.
const lettered = c => { const m = c.match(/^案?([A-D])(?:社の提案|，(約?[＋－+\-−]?[\d,，.]+(?:万円)?))$/); return m ? [m[1], m[2] ? numeric(m[2]) : 0] : null; };
function ascending(r) {
  const nums = r.choices.map(numeric), labs = r.choices.map(lettered);
  let order;
  if (nums.every(v => v !== null)) order = nums.map((v, i) => i).sort((a, b) => nums[a] - nums[b]);
  else if (labs.every(v => v !== null)) order = labs.map((v, i) => i).sort((a, b) => labs[a][0].localeCompare(labs[b][0]) || labs[a][1] - labs[b][1]);
  else return r;
  if (order.every((o, i) => o === i)) return r;
  const to = new Map(order.map((old, now) => [MARK[old], MARK[now]]));
  return {...r, choices: order.map(i => r.choices[i]), answer: order.indexOf(r.answer), explain: r.explain.replace(/[①②③④]/g, m => to.get(m))};
}
// Korean particles after a circled number follow its reading: 일·삼 end in a consonant, 이·사 in a vowel.
const PAIRS = [['은', '는'], ['이', '가'], ['을', '를'], ['과', '와']];
const particles = s => s
  .replace(/([①②③④])(은|는|이|가|을|를|과|와)(?=[\s,.，)]|$)/g, (_, m, p) => { const closed = m === '①' || m === '③'; const pair = PAIRS.find(x => x.includes(p)); return m + pair[closed ? 0 : 1]; })
  .replace(/([①②③④])(이에요|예요)/g, (_, m) => m + (m === '①' || m === '③' ? '이에요' : '예요'));
for (const [id, r] of rows) { const s = ascending({...r, prompt: spell(r.prompt), choices: r.choices.map(spell), explain: spell(r.explain)}); rows.set(id, {...s, explain: particles(s.explain)}); }
const src = fs.readFileSync(coursePath, 'utf8').replace(/\r\n/g, '\n');
const marker = 'export const COURSE=Object.freeze(';
const head = src.slice(0, src.indexOf(marker));
const {COURSE} = await import(pathToFileURL(coursePath).href);
const course = structuredClone(COURSE);
let merged = 0;
const unknown = new Set(rows.keys());
for (const owner of [...course.lectures, ...course.terms]) for (const q of owner.quizzes) {
  const r = rows.get(q.id);
  if (!r) continue;
  // Self-made questions and the adapted ("재구성"/"변형") ones may change; verbatim IPA originals never do.
  if (q.source !== SELF_SOURCE && !/재구성|변형/.test(q.source)) throw new Error(`${q.id} is an IPA original (${q.source})`);
  Object.assign(q, {prompt: r.prompt, choices: r.choices, answer: r.answer, explain: r.explain});
  unknown.delete(q.id);
  merged++;
}
if (unknown.size) throw new Error('unknown ids: ' + [...unknown].join(' '));
// Explanations are our Korean text for every question (IPA originals included), so their particles are fixed too.
for (const owner of [...course.lectures, ...course.terms]) for (const q of owner.quizzes) q.explain = particles(q.explain);
const out = head + marker + JSON.stringify(course, null, 1) + ');\n';
if (process.argv.includes('--dry')) console.log(`would merge ${merged}`);
else { fs.writeFileSync(coursePath, out); console.log(`merged ${merged} question(s) into src/course.js`); }
