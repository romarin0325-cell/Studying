// Quiz helpers over the course data (course.js). A question is {kind, id, prompt, choices[], answer, explain, source, lecture?|term?}.
// kind 'concept' = a lecture question (three per lecture), kind 'term' = a term question (two per term).
import {COURSE} from './course.js';

export const lectureById=id=>COURSE.lectures.find(l=>l.id===id)||null;
export const termById=id=>COURSE.terms.find(t=>t.id===id)||null;
const index=new Map();
for(const l of COURSE.lectures)for(const q of l.quizzes)index.set('concept:'+q.id,{kind:'concept',...q,lecture:l.id});
for(const t of COURSE.terms)for(const q of t.quizzes)index.set('term:'+q.id,{kind:'term',...q,term:t.id});
export const questionOf=(kind,id)=>index.get(`${kind}:${id}`)||null;
export const conceptQuestion=id=>questionOf('concept',id);
export const termQuestion=id=>questionOf('term',id);
export const lectureQuestions=id=>(lectureById(id)?.quizzes||[]).map(q=>questionOf('concept',q.id));
export const termQuestions=id=>(termById(id)?.quizzes||[]).map(q=>questionOf('term',q.id));
export const allQuestions=kind=>[...index.values()].filter(q=>q.kind===kind);
// Picks a question of a kind, avoiding the last one shown when possible.
export function pickQuestion(kind,rand=Math.random,avoid=null){
  const pool=allQuestions(kind),choices=pool.length>1?pool.filter(q=>q.id!==avoid):pool;
  return choices.length?choices[Math.floor(rand()*choices.length)]:null;
}
export const KIND_NAME={concept:'강의',term:'용어'};
