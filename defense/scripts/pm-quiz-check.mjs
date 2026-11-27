// PM quiz quality check for the self-made ("개념 확인") questions in src/course.js.
// The IPA originals keep their official wording and order and are only checked for shape.
// Usage:
//   node defense/scripts/pm-quiz-check.mjs                 check course.js (set-wide stats + per-question rules)
//   node defense/scripts/pm-quiz-check.mjs <batch.jsonl>   check rewrite rows ({id,prompt,choices,answer,explain}) against the plan
// Rules are exported so tests/study.test.mjs uses the same ones.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const SELF_SOURCE = '개념 확인';
export const MARKS = '①②③④';
const HANGUL = /[가-힣]/;
// IPA booklets punctuate with ，and 。 and quote with “ ”. 「」 and 、 read as a different (non-exam) house style.
const NON_IPA = /[、「」『』]/;
// Wrong choices that no candidate would pick: misconduct, giving up, or limitless absolutes.
const ABSURD = /改ざん|改竄|隠蔽|隠ぺい|無視して|放置する|強行|何年間でも|無制限|一切行わない|手書き/;
const len = s => [...s].length;

// Per-question rules. Returns a list of problems (empty = fine).
export function questionProblems(q, {target} = {}) {
  const out = [];
  if (typeof q.prompt !== 'string' || !q.prompt) out.push('prompt missing');
  if (!Array.isArray(q.choices) || q.choices.length !== 4) { out.push('needs exactly 4 choices'); return out; }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) out.push('answer must be 0-3');
  if (new Set(q.choices).size !== 4) out.push('duplicate choices');
  const texts = [q.prompt, ...q.choices];
  if (texts.some(t => HANGUL.test(t))) out.push('Korean in prompt or choices');
  if (texts.some(t => NON_IPA.test(t))) out.push('non-IPA punctuation (use ， and “ ”, not 、 or 「」)');
  if (q.choices.some(c => ABSURD.test(c))) out.push('absurd distractor wording');
  if (typeof q.explain !== 'string' || !HANGUL.test(q.explain)) out.push('explain must be Korean');
  else if (!q.explain.includes(MARKS[q.answer])) out.push(`explain must name the answer as ${MARKS[q.answer]}`);
  else if (/[アイウエ][)）]|選択肢[アイウエ]/.test(q.explain)) out.push('explain uses ア-エ; the game shows ①-④');
  const lens = q.choices.map(len), a = lens[q.answer], others = lens.filter((_, i) => i !== q.answer);
  const longestOther = Math.max(...others), shortest = Math.min(...lens), longest = Math.max(...lens);
  // Short term-only choices (≤12 chars) may vary more; sentences must look alike.
  if (longest > 12 && longest > shortest * 1.8) out.push(`choice lengths too uneven (${lens.join('/')})`);
  if (a > 12 && a > longestOther * 1.2) out.push(`answer clearly longest (${lens.join('/')})`);
  if (target !== undefined && q.answer !== target) out.push(`answer should be at ${MARKS[target]} per plan`);
  return out;
}

// Set-wide stats over the self-made questions.
export function setStats(qs) {
  const n = qs.length, pos = [0, 0, 0, 0];
  let longest = 0, ratio = 0;
  for (const q of qs) {
    const lens = q.choices.map(len), a = lens[q.answer], others = lens.filter((_, i) => i !== q.answer);
    if (a > Math.max(...others)) longest++;
    ratio += a / (others.reduce((x, y) => x + y, 0) / others.length);
    pos[q.answer]++;
  }
  return {n, longestRate: longest / n, lengthRatio: ratio / n, positions: pos.map(p => p / n)};
}
export const SET_LIMITS = {longestRate: 0.35, lengthRatio: [0.85, 1.2], position: [0.18, 0.32]};
export function setProblems(stats) {
  const out = [];
  if (stats.longestRate > SET_LIMITS.longestRate) out.push(`answer is the longest choice in ${(stats.longestRate * 100).toFixed(1)}% (limit ${SET_LIMITS.longestRate * 100}%)`);
  if (stats.lengthRatio < SET_LIMITS.lengthRatio[0] || stats.lengthRatio > SET_LIMITS.lengthRatio[1]) out.push(`answer/other length ratio ${stats.lengthRatio.toFixed(2)}`);
  stats.positions.forEach((p, i) => { if (p < SET_LIMITS.position[0] || p > SET_LIMITS.position[1]) out.push(`${MARKS[i]} holds ${(p * 100).toFixed(1)}% of answers`); });
  return out;
}

export function selfQuestions(course) {
  const qs = [];
  for (const l of course.lectures) for (const q of l.quizzes) if (q.source === SELF_SOURCE) qs.push({...q, owner: l.id});
  for (const t of course.terms) for (const q of t.quizzes) if (q.source === SELF_SOURCE) qs.push({...q, owner: t.id});
  return qs;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const planPath = path.join(here, '../docs/review/pm-quiz-20261128/plan.json');
  const plan = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : null;
  const target = id => plan?.questions.find(p => p.id === id)?.target;
  const file = process.argv[2];
  let rows, failures = 0;
  if (file) {
    rows = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    const want = plan?.batches[path.basename(file).replace(/\.jsonl$/, '')];
    if (want) { const got = new Set(rows.map(r => r.id)); const missing = want.filter(id => !got.has(id)); if (missing.length) { console.log(`missing ${missing.length}: ${missing.join(' ')}`); failures++; } }
  } else {
    const {COURSE} = await import(pathToFileURL(path.join(here, '../src/course.js')).href);
    rows = selfQuestions(COURSE);
  }
  // The plan's target index binds the GPT batches only; the merge then sorts numeric choices ascending as IPA does.
  for (const q of rows) { const p = questionProblems(q, {target: file ? target(q.id) : undefined}); if (p.length) { failures++; console.log(`${q.id}: ${p.join('; ')}`); } }
  const stats = setStats(rows), sp = file ? [] : setProblems(stats);
  console.log(`questions ${stats.n}, answer longest ${(stats.longestRate * 100).toFixed(1)}%, answer/other length ${stats.lengthRatio.toFixed(2)}, positions ${stats.positions.map((p, i) => MARKS[i] + (p * 100).toFixed(1) + '%').join(' ')}`);
  for (const p of sp) console.log('SET: ' + p);
  if (failures || sp.length) { console.log(`FAIL (${failures} question(s), ${sp.length} set rule(s))`); process.exitCode = 1; } else console.log('OK');
}
